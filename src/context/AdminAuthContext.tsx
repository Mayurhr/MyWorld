import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import {
  auth,
  googleAuthProvider,
  isFirebaseAuthorizedAdmin,
  signInToFirebaseAdmin,
} from '../services/firebase';
import { syncPortfolioStoreToFirestore } from '../services/portfolioService';

export interface AdminUser {
  username: string;
  role: 'admin';
}

interface AdminAuthContextType {
  user: AdminUser | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  driveToken: string | null;
  firebaseUser: User | null;
  isFirebaseAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSession: (nextUser: AdminUser, nextToken?: string) => void;
  connectGoogleDrive: () => Promise<string | null>;
  connectFirebaseCloud: () => Promise<User | null>;
  disconnectFirebaseCloud: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [driveToken, setDriveToken] = useState<string | null>(() => {
    return sessionStorage.getItem('admin_drive_token');
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);

  const isAuthenticated = Boolean(user && user.role === 'admin');
  const isAdmin = isAuthenticated;
  const isFirebaseAdmin = isFirebaseAuthorizedAdmin(firebaseUser);

  const getStoredToken = () => sessionStorage.getItem('admin_session_token');

  // Track Firebase Auth state across reloads
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && isFirebaseAuthorizedAdmin(fbUser)) {
        syncPortfolioStoreToFirestore(false).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const token = getStoredToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/admin/me', {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          if (mounted && data.authenticated && data.user) {
            setUser(data.user);
          }
        } else {
          if (mounted) {
            setUser(null);
            sessionStorage.removeItem('admin_session_token');
          }
        }
      } catch (err) {
        console.warn('[AdminAuth] Session check failed:', err);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Log in with username and password against backend API.
   */
  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      if (data.token) {
        sessionStorage.setItem('admin_session_token', data.token);
      }
      // Reset login notification dismissal state for fresh login session
      sessionStorage.removeItem('admin_msg_popup_dismissed');
      setUser(data.user);
    } catch (err) {
      console.error('[Admin Login Failed]:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Updates active session user and token after credential updates.
   */
  const updateSession = (nextUser: AdminUser, nextToken?: string) => {
    if (nextToken) {
      sessionStorage.setItem('admin_session_token', nextToken);
    }
    setUser(nextUser);
  };

  /**
   * Log out and terminate backend session.
   */
  const logout = async () => {
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/admin/logout', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[Admin Logout Error]:', err);
    } finally {
      setUser(null);
      sessionStorage.removeItem('admin_session_token');
      sessionStorage.removeItem('admin_drive_token');
      sessionStorage.removeItem('admin_msg_popup_dismissed');
      setDriveToken(null);
    }
  };

  /**
   * Sign in to Firebase Auth with standard Google Sign-In for optional Cloud Firestore sync
   */
  const connectFirebaseCloud = async (): Promise<User | null> => {
    const signedInUser = await signInToFirebaseAdmin();
    if (signedInUser) {
      setFirebaseUser(signedInUser);
      await syncPortfolioStoreToFirestore(false);
    }
    return signedInUser;
  };

  const disconnectFirebaseCloud = async (): Promise<void> => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
  };

  /**
   * Connect Google Drive OAuth separately for legacy Drive media browsing
   */
  const connectGoogleDrive = async (): Promise<string | null> => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveToken(credential.accessToken);
        sessionStorage.setItem('admin_drive_token', credential.accessToken);
        return credential.accessToken;
      }
      return null;
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user') ||
        err?.message?.includes('cancelled-popup-request')
      ) {
        return null;
      }
      console.warn('[Connect Drive]:', err?.message || err);
      throw err;
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isAdmin,
        isAuthenticated,
        loading,
        driveToken,
        firebaseUser,
        isFirebaseAdmin,
        login,
        logout,
        updateSession,
        connectGoogleDrive,
        connectFirebaseCloud,
        disconnectFirebaseCloud,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
