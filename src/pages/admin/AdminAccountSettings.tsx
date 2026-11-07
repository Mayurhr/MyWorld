import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

export const AdminAccountSettings: React.FC = () => {
  const { user, updateSession } = useAdminAuth();

  // Current account metadata from server
  const [serverUsername, setServerUsername] = useState<string>(user?.username || 'mayurhr');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Username form state
  const [newUsername, setNewUsername] = useState<string>('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState<boolean>(false);
  const [usernameFeedback, setUsernameFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPwd, setShowCurrentPwd] = useState<boolean>(false);
  const [showNewPwd, setShowNewPwd] = useState<boolean>(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState<boolean>(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = sessionStorage.getItem('admin_session_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  useEffect(() => {
    let active = true;
    async function loadAccountInfo() {
      try {
        const res = await fetch('/api/admin/account', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (active) {
            if (data.username) setServerUsername(data.username);
            if (data.updatedAt) setLastUpdated(data.updatedAt);
          }
        }
      } catch {
        // Fallback to context user
      }
    }
    loadAccountInfo();
    return () => {
      active = false;
    };
  }, [user?.username]);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdatingUsername) return;
    setUsernameFeedback(null);

    const trimmed = newUsername.trim();
    if (!trimmed) {
      setUsernameFeedback({
        type: 'error',
        message: 'Username cannot be empty. Please enter a valid username.',
      });
      return;
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
      setUsernameFeedback({
        type: 'error',
        message:
          'Username must be 3 to 32 characters and may only contain letters, numbers, dots (.), underscores (_), or hyphens (-).',
      });
      return;
    }

    const activeName = serverUsername || user?.username || '';
    if (trimmed.toLowerCase() === activeName.toLowerCase()) {
      setUsernameFeedback({
        type: 'error',
        message: 'New username conflicts with your current username. Please choose a different username.',
      });
      return;
    }

    setIsUpdatingUsername(true);
    try {
      const res = await fetch('/api/admin/change-username', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ newUsername: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update username.');
      }

      if (data.user) {
        updateSession(data.user, data.token);
        setServerUsername(data.user.username);
      }
      if (data.updatedAt) {
        setLastUpdated(data.updatedAt);
      }
      setNewUsername('');
      setUsernameFeedback({
        type: 'success',
        message: data.message || `Username updated to "${trimmed}" successfully.`,
      });
    } catch (err: any) {
      setUsernameFeedback({
        type: 'error',
        message: err.message || 'Unable to update username.',
      });
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdatingPassword) return;
    setPasswordFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'Please fill in your current password, new password, and confirm new password.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'New password and confirm password do not match.',
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'New password must be different from your current password.',
      });
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordFeedback({
        type: 'error',
        message: 'New password must be at least 8 characters long and include both letters and numbers.',
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      if (data.user) {
        updateSession(data.user, data.token);
      }
      if (data.updatedAt) {
        setLastUpdated(data.updatedAt);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({
        type: 'success',
        message:
          data.message ||
          'Password updated successfully. Your active session has been refreshed and future logins require the new password.',
      });
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err.message || 'Unable to update password.',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const hasMinLen = newPassword.length >= 8;
  const hasLetterAndDigit = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const matchesConfirm = Boolean(newPassword) && newPassword === confirmPassword;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Account Settings
          </h1>
          <span
            style={{
              fontSize: '0.72rem',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd',
              padding: '3px 10px',
              borderRadius: '6px',
              fontWeight: 600,
              letterSpacing: '0.4px',
            }}
          >
            ADMINISTRATOR CREDENTIALS
          </span>
        </div>
        <p style={{ margin: '8px 0 0 0', color: '#a1a1aa', fontSize: '0.9rem' }}>
          Update your administrator username and password. Credential changes are hashed, persisted securely on the server, and applied immediately.
        </p>
      </div>

      {/* Active Account Overview Banner */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '18px 22px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            {(serverUsername || user?.username || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>
              Current Administrator Username
            </div>
            <div
              data-testid="current-admin-username"
              style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}
            >
              {serverUsername || user?.username}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {lastUpdated && (
            <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
              Last credential update:{' '}
              <span style={{ color: '#e4e4e7', fontWeight: 500 }}>
                {new Date(lastUpdated).toLocaleString()}
              </span>
            </div>
          )}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: '#34d399',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '5px 12px',
              borderRadius: '8px',
              fontWeight: 600,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            Session Active
          </span>
        </div>
      </div>

      {/* Settings Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* CARD 1: CHANGE USERNAME */}
        <section
          aria-labelledby="change-username-heading"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fas fa-user-tag"></i>
              </div>
              <div>
                <h2
                  id="change-username-heading"
                  style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}
                >
                  Change Username
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#71717a' }}>
                  Update your sign-in identifier
                </p>
              </div>
            </div>

            {usernameFeedback && (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  fontSize: '0.84rem',
                  backgroundColor:
                    usernameFeedback.type === 'success'
                      ? 'rgba(16, 185, 129, 0.14)'
                      : 'rgba(239, 68, 68, 0.14)',
                  border: `1px solid ${
                    usernameFeedback.type === 'success' ? '#10b981' : '#ef4444'
                  }`,
                  color: usernameFeedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
                }}
              >
                <i
                  className={
                    usernameFeedback.type === 'success'
                      ? 'fas fa-check-circle'
                      : 'fas fa-exclamation-circle'
                  }
                  style={{ marginRight: '8px' }}
                ></i>
                {usernameFeedback.message}
              </div>
            )}

            <form onSubmit={handleUsernameSubmit} noValidate>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#a1a1aa',
                    marginBottom: '6px',
                  }}
                >
                  Current Username
                </label>
                <input
                  type="text"
                  value={serverUsername || user?.username || ''}
                  readOnly
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '10px',
                    color: '#71717a',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="new-username-input"
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#e4e4e7',
                    marginBottom: '6px',
                  }}
                >
                  New Username
                </label>
                <input
                  id="new-username-input"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new username (e.g. mayur.admin)"
                  autoComplete="username"
                  disabled={isUpdatingUsername}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    marginTop: '6px',
                    fontSize: '0.75rem',
                    color: '#71717a',
                  }}
                >
                  Must be 3–32 characters using letters, numbers, dots (.), underscores (_), or hyphens (-).
                </span>
              </div>

              <button
                type="submit"
                disabled={isUpdatingUsername}
                style={{
                  width: '100%',
                  padding: '11px 18px',
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isUpdatingUsername ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isUpdatingUsername ? 0.7 : 1,
                }}
              >
                <i className={isUpdatingUsername ? 'fas fa-spinner fa-spin' : 'fas fa-save'}></i>
                <span>{isUpdatingUsername ? 'Updating Username...' : 'Save New Username'}</span>
              </button>
            </form>
          </div>
        </section>

        {/* CARD 2: CHANGE PASSWORD */}
        <section
          aria-labelledby="change-password-heading"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-key"></i>
            </div>
            <div>
              <h2
                id="change-password-heading"
                style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}
              >
                Change Password
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#71717a' }}>
                Verify your current password and set a strong new password
              </p>
            </div>
          </div>

          {passwordFeedback && (
            <div
              role="alert"
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '0.84rem',
                backgroundColor:
                  passwordFeedback.type === 'success'
                    ? 'rgba(16, 185, 129, 0.14)'
                    : 'rgba(239, 68, 68, 0.14)',
                border: `1px solid ${
                  passwordFeedback.type === 'success' ? '#10b981' : '#ef4444'
                }`,
                color: passwordFeedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
              }}
            >
              <i
                className={
                  passwordFeedback.type === 'success'
                    ? 'fas fa-check-circle'
                    : 'fas fa-exclamation-circle'
                }
                style={{ marginRight: '8px' }}
              ></i>
              {passwordFeedback.message}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} noValidate>
            {/* Current Password */}
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="current-password-input"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#e4e4e7',
                  marginBottom: '6px',
                }}
              >
                Current Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="current-password-input"
                  type={showCurrentPwd ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  disabled={isUpdatingPassword}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd((v) => !v)}
                  aria-label="Toggle current password visibility"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                  }}
                >
                  <i className={showCurrentPwd ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                </button>
              </div>
            </div>

            {/* New Password */}
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="new-password-input"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#e4e4e7',
                  marginBottom: '6px',
                }}
              >
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password-input"
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 chars with letters & numbers"
                  autoComplete="new-password"
                  disabled={isUpdatingPassword}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((v) => !v)}
                  aria-label="Toggle new password visibility"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                  }}
                >
                  <i className={showNewPwd ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="confirm-password-input"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#e4e4e7',
                  marginBottom: '6px',
                }}
              >
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-password-input"
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  disabled={isUpdatingPassword}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd((v) => !v)}
                  aria-label="Toggle confirm password visibility"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                  }}
                >
                  <i className={showConfirmPwd ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                </button>
              </div>
            </div>

            {/* Strength Checklist */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px 12px',
                backgroundColor: '#18181b',
                borderRadius: '8px',
                border: '1px solid #27272a',
                marginBottom: '18px',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ color: hasMinLen ? '#34d399' : '#71717a' }}>
                <i className={hasMinLen ? 'fas fa-check-circle' : 'far fa-circle'} style={{ marginRight: '6px' }}></i>
                At least 8 characters
              </div>
              <div style={{ color: hasLetterAndDigit ? '#34d399' : '#71717a' }}>
                <i className={hasLetterAndDigit ? 'fas fa-check-circle' : 'far fa-circle'} style={{ marginRight: '6px' }}></i>
                Contains both letters and numbers
              </div>
              <div style={{ color: matchesConfirm ? '#34d399' : '#71717a' }}>
                <i className={matchesConfirm ? 'fas fa-check-circle' : 'far fa-circle'} style={{ marginRight: '6px' }}></i>
                New password and confirmation match
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              style={{
                width: '100%',
                padding: '11px 18px',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: isUpdatingPassword ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isUpdatingPassword ? 0.7 : 1,
              }}
            >
              <i className={isUpdatingPassword ? 'fas fa-spinner fa-spin' : 'fas fa-shield-alt'}></i>
              <span>{isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
