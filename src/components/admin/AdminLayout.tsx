import React, { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getCloudinaryStatus, CloudinaryStatus } from '../../services/mediaStorageService';

interface IncomingMessagePreview {
  id: string;
  name: string;
  email: string;
  subject: string;
  timestamp: string;
}

export const AdminLayout: React.FC = () => {
  const {
    user,
    logout,
    driveToken,
    connectGoogleDrive,
  } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<CloudinaryStatus | null>(null);

  // Unread messages & notification popup state
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showMessagePopup, setShowMessagePopup] = useState<boolean>(false);
  const [latestIncoming, setLatestIncoming] = useState<IncomingMessagePreview | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const handleConnectDrive = async () => {
    try {
      setIsConnectingDrive(true);
      await connectGoogleDrive();
    } catch (err) {
      console.error('Failed to connect Drive:', err);
    } finally {
      setIsConnectingDrive(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refreshCloudinary = () => {
      getCloudinaryStatus()
        .then((status) => {
          if (active) setCloudinaryStatus(status);
        })
        .catch(() => {});
    };
    refreshCloudinary();
    window.addEventListener('cloudinary-status-updated', refreshCloudinary);
    return () => {
      active = false;
      window.removeEventListener('cloudinary-status-updated', refreshCloudinary);
    };
  }, [user]);

  // Fetch initial unread message count and subscribe to real-time SSE stream
  useEffect(() => {
    if (!user) return;
    let active = true;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const token = sessionStorage.getItem('admin_session_token');

    const fetchUnreadCount = async (triggerLoginPopup: boolean) => {
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/admin/messages/unread-count', {
          headers,
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const count = Number(data.unreadCount || 0);
        if (!active) return;

        setUnreadCount(count);
        const alreadyDismissed = sessionStorage.getItem('admin_msg_popup_dismissed') === 'true';
        const onMessagesRoute = window.location.pathname.startsWith('/admin/messages');

        if (triggerLoginPopup && count > 0 && !alreadyDismissed && !onMessagesRoute) {
          setShowMessagePopup(true);
        }
      } catch {
        // Ignore network transient failure
      }
    };

    fetchUnreadCount(true);

    const connectSse = () => {
      if (!active) return;
      const streamUrl = token
        ? `/api/admin/messages/stream?token=${encodeURIComponent(token)}`
        : '/api/admin/messages/stream';

      try {
        eventSource = new EventSource(streamUrl);
        eventSource.onmessage = (event) => {
          if (!active) return;
          try {
            const payload = JSON.parse(event.data);
            if (typeof payload.unreadCount === 'number') {
              setUnreadCount(payload.unreadCount);
            }

            if (payload.type === 'init') {
              const count = Number(payload.unreadCount || 0);
              const alreadyDismissed = sessionStorage.getItem('admin_msg_popup_dismissed') === 'true';
              const onMessagesRoute = window.location.pathname.startsWith('/admin/messages');
              if (count > 0 && !alreadyDismissed && !onMessagesRoute) {
                setShowMessagePopup(true);
              }
            } else if (payload.type === 'new_message') {
              if (payload.message) {
                setLatestIncoming(payload.message);
              }
              window.dispatchEvent(new CustomEvent('admin-messages-incoming'));
              const onMessagesRoute = window.location.pathname.startsWith('/admin/messages');
              if (!onMessagesRoute) {
                sessionStorage.removeItem('admin_msg_popup_dismissed');
                setShowMessagePopup(true);
              }
            }
          } catch {
            // Ignore malformed SSE payload
          }
        };

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          if (active) {
            reconnectTimer = setTimeout(connectSse, 5000);
          }
        };
      } catch {
        // Fallback polling if EventSource unsupported
      }
    };

    connectSse();

    const handleMessagesChanged = (e: Event) => {
      const custom = e as CustomEvent<{ unreadCount?: number }>;
      if (typeof custom.detail?.unreadCount === 'number') {
        setUnreadCount(custom.detail.unreadCount);
      } else {
        fetchUnreadCount(false);
      }
    };

    window.addEventListener('admin-messages-changed', handleMessagesChanged);

    return () => {
      active = false;
      window.removeEventListener('admin-messages-changed', handleMessagesChanged);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [user]);

  const handlePopupViewMessages = () => {
    sessionStorage.setItem('admin_msg_popup_dismissed', 'true');
    setShowMessagePopup(false);
    setLatestIncoming(null);
    navigate('/admin/messages');
  };

  const handlePopupLater = () => {
    sessionStorage.setItem('admin_msg_popup_dismissed', 'true');
    setShowMessagePopup(false);
    setLatestIncoming(null);
  };

  const navItems: {
    to: string;
    label: string;
    icon: string;
    end: boolean;
    badge?: number;
  }[] = [
    { to: '/admin', label: 'Overview', icon: 'fas fa-chart-pie', end: true },
    { to: '/admin/messages', label: 'Messages', icon: 'fas fa-envelope', end: false, badge: unreadCount },
    { to: '/admin/analytics', label: 'Analytics', icon: 'fas fa-chart-line', end: false },
    { to: '/admin/projects', label: 'Projects', icon: 'fas fa-layer-group', end: false },
    { to: '/admin/certificates', label: 'Certificates', icon: 'fas fa-award', end: false },
    { to: '/admin/qualifications', label: 'Qualifications', icon: 'fas fa-graduation-cap', end: false },
    { to: '/admin/skills', label: 'Skills', icon: 'fas fa-tools', end: false },
    { to: '/admin/connect', label: 'Connect With Me', icon: 'fas fa-share-alt', end: false },
    { to: '/admin/profile', label: 'Profile & Bio', icon: 'fas fa-user-edit', end: false },
    { to: '/admin/resume', label: 'Resume', icon: 'fas fa-file-pdf', end: false },
    { to: '/admin/media', label: 'Media Manager', icon: 'fas fa-photo-video', end: false },
    { to: '/admin/account', label: 'Account Settings', icon: 'fas fa-user-shield', end: false },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          height: '64px',
          borderBottom: '1px solid #27272a',
          backgroundColor: '#121214',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
            }}
            className="admin-mobile-toggle"
            aria-label="Toggle Navigation Menu"
          >
            <i className={mobileMenuOpen ? 'fas fa-times' : 'fas fa-bars'}></i>
          </button>

          <Link
            to="/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: '#fff',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              M
            </div>
            <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.3px' }}>
              Portfolio Admin
            </span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Unread Visitor Messages Notification Bell */}
          <Link
            to="/admin/messages"
            data-testid="header-unread-bell"
            title={
              unreadCount > 0
                ? `${unreadCount} unread visitor message(s)`
                : 'Visitor Messages'
            }
            onClick={() => {
              sessionStorage.setItem('admin_msg_popup_dismissed', 'true');
              setShowMessagePopup(false);
            }}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: unreadCount > 0 ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid #27272a',
              backgroundColor: unreadCount > 0 ? 'rgba(59, 130, 246, 0.14)' : '#18181b',
              color: unreadCount > 0 ? '#93c5fd' : '#a1a1aa',
              textDecoration: 'none',
            }}
          >
            <i className="fas fa-bell" style={{ fontSize: '14px' }}></i>
            {unreadCount > 0 && (
              <span
                data-testid="header-unread-badge"
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 5px',
                  borderRadius: '999px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 2px #121214',
                }}
              >
                {unreadCount}
              </span>
            )}
          </Link>

          {/* Public site link */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#a1a1aa',
              textDecoration: 'none',
              fontSize: '0.85rem',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #27272a',
              background: '#18181b',
              transition: 'all 0.2s ease',
            }}
          >
            <i className="fas fa-external-link-alt" style={{ fontSize: '11px' }}></i>
            <span>Live Portfolio</span>
          </a>

          {/* Cloudinary Media Storage Status Indicator */}
          <Link
            to="/admin/media"
            title={
              cloudinaryStatus?.configured
                ? `Cloudinary storage active (${cloudinaryStatus.cloudName || 'Configured'})`
                : 'Configure Cloudinary environment secrets in Google AI Studio'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor:
                cloudinaryStatus?.configured === false
                  ? 'rgba(245, 158, 11, 0.14)'
                  : 'rgba(16, 185, 129, 0.12)',
              border:
                cloudinaryStatus?.configured === false
                  ? '1px solid rgba(245, 158, 11, 0.35)'
                  : '1px solid rgba(16, 185, 129, 0.3)',
              color: cloudinaryStatus?.configured === false ? '#fbbf24' : '#34d399',
              fontSize: '0.78rem',
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <i
              className={
                cloudinaryStatus?.configured === false
                  ? 'fas fa-exclamation-triangle'
                  : 'fas fa-cloud-upload-alt'
              }
            ></i>
            <span>
              {cloudinaryStatus?.configured === false ? 'Cloudinary Setup' : 'Cloudinary Ready'}
            </span>
          </Link>

          {/* Legacy Drive Status Indicator */}
          {driveToken ? (
            <div
              title="Google Drive legacy picker is connected"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#93c5fd',
                fontSize: '0.78rem',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              <i className="fab fa-google-drive"></i>
              <span>Drive Active</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={isConnectingDrive}
              title="Connect legacy Google Drive picker"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 11px',
                borderRadius: '8px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                color: '#a1a1aa',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: isConnectingDrive ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <i className="fab fa-google-drive"></i>
              <span>{isConnectingDrive ? 'Connecting...' : 'Legacy Drive'}</span>
            </button>
          )}

          {/* User info */}
          <Link
            to="/admin/account"
            title="Account Settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '12px',
              borderLeft: '1px solid #27272a',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                data-testid="header-admin-username"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#f4f4f5',
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.username || 'admin'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Admin
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: '6px 8px',
              fontSize: '14px',
              borderRadius: '6px',
            }}
          >
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: '250px',
            backgroundColor: '#121214',
            borderRight: '1px solid #27272a',
            padding: '20px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
          className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div
              style={{
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: '#71717a',
                padding: '0 12px 10px 12px',
                letterSpacing: '0.5px',
              }}
            >
              Management Modules
            </div>

            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (item.to === '/admin/messages') {
                    sessionStorage.setItem('admin_msg_popup_dismissed', 'true');
                    setShowMessagePopup(false);
                  }
                }}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#a1a1aa',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <i className={item.icon} style={{ width: '18px', textAlign: 'center' }}></i>
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    data-testid="sidebar-unread-badge"
                    style={{
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      backgroundColor: location.pathname.startsWith('/admin/messages')
                        ? '#ffffff'
                        : '#3b82f6',
                      color: location.pathname.startsWith('/admin/messages')
                        ? '#1d4ed8'
                        : '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div
            style={{
              padding: '14px',
              backgroundColor: '#18181b',
              borderRadius: '12px',
              border: '1px solid #27272a',
              fontSize: '0.75rem',
              color: '#71717a',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', marginBottom: '4px', fontWeight: 600 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              Portfolio Store Active
            </div>
            <span>Server-Persisted Data</span>
          </div>
        </aside>

        {/* Content Outlet */}
        <main
          style={{
            flex: 1,
            backgroundColor: '#09090b',
            padding: '28px 32px',
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Login / Real-Time Unread Visitor Message Notification Popup */}
      {showMessagePopup && unreadCount > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-message-popup-title"
          data-testid="new-message-notification-popup"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 130,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '450px',
              backgroundColor: '#121214',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '11px',
                  backgroundColor: 'rgba(59, 130, 246, 0.18)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                <i className="fas fa-envelope-open-text"></i>
              </div>
              <div>
                <h3
                  id="new-message-popup-title"
                  style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}
                >
                  New Message Received
                </h3>
                <span style={{ fontSize: '0.76rem', color: '#93c5fd', fontWeight: 600 }}>
                  {unreadCount} Unread Visitor Inquiry
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#d4d4d8', lineHeight: 1.55 }}>
              You have <strong style={{ color: '#ffffff' }}>{unreadCount}</strong> unread{' '}
              {unreadCount === 1 ? 'message' : 'messages'} from your portfolio visitors.
            </p>

            {latestIncoming && (
              <div
                style={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ color: '#ffffff', fontWeight: 600 }}>
                  {latestIncoming.name}{' '}
                  <span style={{ color: '#71717a', fontWeight: 400 }}>
                    ({latestIncoming.email})
                  </span>
                </div>
                <div style={{ color: '#93c5fd', marginTop: '3px' }}>
                  Subject: {latestIncoming.subject}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                data-testid="popup-later-btn"
                onClick={handlePopupLater}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#d4d4d8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Later
              </button>
              <button
                type="button"
                data-testid="popup-view-messages-btn"
                onClick={handlePopupViewMessages}
                style={{
                  padding: '9px 18px',
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View Messages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
