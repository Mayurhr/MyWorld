import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Connect to configured database or default instance
const databaseId = (firebaseConfig as any).firestoreDatabaseId;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID: string = firebaseConfig.projectId || '';

// Authorized admin emails (portfolio owner + workspace runtime user)
export const AUTHORIZED_ADMIN_EMAIL = 'mayurhr57@gmail.com';
export const AUTHORIZED_ADMIN_EMAILS = [
  'mayurhr57@gmail.com',
  'raghugowd77@gmail.com',
];

export function isFirebaseAuthorizedAdmin(user: User | null | undefined): boolean {
  if (!user || !user.email) return false;
  const normalized = user.email.toLowerCase().trim();
  return AUTHORIZED_ADMIN_EMAILS.includes(normalized) && user.emailVerified !== false;
}

// Standard Google Auth Provider for Cloud Firestore sync (no restricted Drive scopes)
export const firebaseGoogleProvider = new GoogleAuthProvider();
firebaseGoogleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Legacy Google Auth Provider configured with Google Drive per-file scope (for existing Drive media browsing)
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Signs in to Firebase Auth using standard Google Sign-In so Cloud Firestore
 * security rules verify request.auth for admin sync operations.
 */
export async function signInToFirebaseAdmin(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, firebaseGoogleProvider);
    const user = result.user;

    if (!isFirebaseAuthorizedAdmin(user)) {
      throw new Error(
        `Account "${user.email || 'unknown'}" is not authorized for admin cloud storage. Sign in with ${AUTHORIZED_ADMIN_EMAILS.join(' or ')}.`
      );
    }

    // Register UID in /admins/{uid} as backup for rule checks
    try {
      await setDoc(
        doc(db, 'admins', user.uid),
        {
          email: user.email,
          role: 'admin',
        },
        { merge: true }
      );
    } catch {
      // Non-fatal if rule already authorizes via verified token email
    }

    return user;
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request' ||
      err?.message?.includes('popup-closed-by-user') ||
      err?.message?.includes('cancelled-popup-request')
    ) {
      return null;
    }
    throw err;
  }
}

// Diagnostic connection test per skill requirements
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Connection established successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Client is offline or Firestore is temporarily unreachable.');
      return false;
    }
    // A permission-denied on a test doc still proves network connection to Firestore
    return true;
  }
}

// Error handling helper conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('[Firestore Error Details]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
