import React, { useState, useEffect, useCallback } from 'react';

export interface VisitorMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  status: 'unread' | 'read';
  readAt?: string;
}

interface MessagesApiResponse {
  messages: VisitorMessage[];
  totalCount: number;
  unreadCount: number;
  readCount: number;
  recentCount: number;
}

export const AdminMessages: React.FC = () => {
  const [messages, setMessages] = useState<VisitorMessage[]>([]);
  const [counts, setCounts] = useState<{
    totalCount: number;
    unreadCount: number;
    readCount: number;
    recentCount: number;
  }>({
    totalCount: 0,
    unreadCount: 0,
    readCount: 0,
    recentCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Explicit Delete Confirmation Dialog
  const [deleteTarget, setDeleteTarget] = useState<VisitorMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionBanner, setActionBanner] = useState<{
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

  const broadcastMessageCountUpdate = (unreadCount: number, totalCount: number) => {
    window.dispatchEvent(
      new CustomEvent('admin-messages-changed', {
        detail: { unreadCount, totalCount },
      })
    );
  };

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/messages', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to load visitor messages (${res.status})`);
      }

      const data = (await res.json()) as MessagesApiResponse;
      const list = Array.isArray(data.messages) ? data.messages : [];
      setMessages(list);
      setCounts({
        totalCount: data.totalCount ?? list.length,
        unreadCount: data.unreadCount ?? list.filter((m) => !m.isRead).length,
        readCount: data.readCount ?? list.filter((m) => m.isRead).length,
        recentCount: data.recentCount ?? 0,
      });

      broadcastMessageCountUpdate(
        data.unreadCount ?? list.filter((m) => !m.isRead).length,
        data.totalCount ?? list.length
      );
    } catch (err: any) {
      setError(err.message || 'Failed to fetch visitor messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();

    const handleLiveRefresh = () => {
      loadMessages();
    };
    window.addEventListener('admin-messages-incoming', handleLiveRefresh);
    return () => {
      window.removeEventListener('admin-messages-incoming', handleLiveRefresh);
    };
  }, [loadMessages]);

  const handleToggleReadStatus = async (msg: VisitorMessage, nextIsRead: boolean) => {
    if (updatingId) return;
    setUpdatingId(msg.id);
    setActionBanner(null);

    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(msg.id)}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ isRead: nextIsRead }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update message status.');
      }

      const updatedMsg: VisitorMessage = data.message;
      setMessages((prev) => {
        const nextList = prev.map((m) => (m.id === msg.id ? updatedMsg : m));
        const unread = nextList.filter((m) => !m.isRead).length;
        const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
        const recent = nextList.filter((m) => new Date(m.timestamp).getTime() >= dayAgoMs).length;
        setCounts({
          totalCount: nextList.length,
          unreadCount: unread,
          readCount: nextList.length - unread,
          recentCount: recent,
        });
        broadcastMessageCountUpdate(unread, nextList.length);
        return nextList;
      });

      setActionBanner({
        type: 'success',
        message: nextIsRead
          ? `Marked message from "${msg.name}" as Read.`
          : `Marked message from "${msg.name}" as Unread.`,
      });
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        message: err.message || 'Unable to update message read status.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setActionBanner(null);

    const deletingId = deleteTarget.id;
    const senderName = deleteTarget.name;

    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(deletingId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete message.');
      }

      setDeleteTarget(null);
      if (selectedId === deletingId) {
        setSelectedId(null);
      }

      setMessages((prev) => {
        const nextList = prev.filter((m) => m.id !== deletingId);
        const unread = nextList.filter((m) => !m.isRead).length;
        const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
        const recent = nextList.filter((m) => new Date(m.timestamp).getTime() >= dayAgoMs).length;
        setCounts({
          totalCount: nextList.length,
          unreadCount: unread,
          readCount: nextList.length - unread,
          recentCount: recent,
        });
        broadcastMessageCountUpdate(unread, nextList.length);
        return nextList;
      });

      setActionBanner({
        type: 'success',
        message: `Deleted message from "${senderName}".`,
      });
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        message: err.message || 'Unable to delete message.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (filterStatus === 'unread' && msg.isRead) return false;
    if (filterStatus === 'read' && !msg.isRead) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        msg.name.toLowerCase().includes(q) ||
        msg.email.toLowerCase().includes(q) ||
        msg.subject.toLowerCase().includes(q) ||
        msg.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedMessage =
    messages.find((m) => m.id === selectedId) ||
    filteredMessages[0] ||
    null;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Visitor Messages Inbox
            </h1>
            {counts.unreadCount > 0 && (
              <span
                data-testid="messages-unread-pill"
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.18)',
                  border: '1px solid rgba(59, 130, 246, 0.45)',
                  color: '#93c5fd',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontWeight: 700,
                }}
              >
                {counts.unreadCount} UNREAD
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0 0', color: '#a1a1aa', fontSize: '0.88rem' }}>
            Review inquiries submitted through the Get In Touch contact form. Messages remain unread until explicitly marked read.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMessages}
          disabled={loading}
          style={{
            padding: '9px 15px',
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '10px',
            color: '#e4e4e7',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className={loading ? 'fas fa-sync fa-spin' : 'fas fa-sync'}></i>
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Summary Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '6px' }}>
            Total Messages
          </div>
          <div data-testid="inbox-total-count" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff' }}>
            {counts.totalCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#121214',
            border: counts.unreadCount > 0 ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '6px' }}>
            Unread Messages
          </div>
          <div data-testid="inbox-unread-count" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#60a5fa' }}>
            {counts.unreadCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '6px' }}>
            Read Messages
          </div>
          <div data-testid="inbox-read-count" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399' }}>
            {counts.readCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '6px' }}>
            Recent (Last 24h)
          </div>
          <div data-testid="inbox-recent-count" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fbbf24' }}>
            {counts.recentCount}
          </div>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionBanner && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '10px',
            backgroundColor:
              actionBanner.type === 'success'
                ? 'rgba(16, 185, 129, 0.14)'
                : 'rgba(239, 68, 68, 0.14)',
            border: `1px solid ${actionBanner.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: actionBanner.type === 'success' ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionBanner.message}</span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            color: '#fca5a5',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '14px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: `All (${counts.totalCount})` },
              { id: 'unread', label: `Unread (${counts.unreadCount})` },
              { id: 'read', label: `Read (${counts.readCount})` },
            ] as const
          ).map((tab) => {
            const active = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: active ? '1px solid #3b82f6' : '1px solid #27272a',
                  backgroundColor: active ? '#2563eb' : '#18181b',
                  color: active ? '#ffffff' : '#a1a1aa',
                  fontSize: '0.82rem',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: '1 1 260px', maxWidth: '360px' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, subject, message..."
            aria-label="Search visitor messages"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.84rem',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Main Master-Detail Workspace */}
      {loading && messages.length === 0 ? (
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '48px',
            textAlign: 'center',
            color: '#a1a1aa',
          }}
        >
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px', display: 'block' }}></i>
          Loading visitor messages...
        </div>
      ) : filteredMessages.length === 0 ? (
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '56px 24px',
            textAlign: 'center',
            color: '#a1a1aa',
          }}
        >
          <i className="fas fa-inbox" style={{ fontSize: '36px', color: '#3f3f46', marginBottom: '12px', display: 'block' }}></i>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
            {messages.length === 0
              ? 'No visitor messages yet'
              : 'No messages match the current filter'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#71717a' }}>
            {messages.length === 0
              ? 'Messages submitted via the Get In Touch contact section will appear here.'
              : 'Try switching filter tabs or clearing your search query.'}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {/* Left: Message List */}
          <div
            style={{
              backgroundColor: '#121214',
              border: '1px solid #27272a',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #27272a',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#a1a1aa',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              Messages ({filteredMessages.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '640px', overflowY: 'auto' }}>
              {filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                const formattedTime = new Date(msg.timestamp).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });

                return (
                  <button
                    key={msg.id}
                    type="button"
                    data-testid={`message-row-${msg.id}`}
                    onClick={() => setSelectedId(msg.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '16px 18px',
                      border: 'none',
                      borderBottom: '1px solid #27272a',
                      backgroundColor: isSelected
                        ? 'rgba(37, 99, 235, 0.16)'
                        : !msg.isRead
                        ? 'rgba(59, 130, 246, 0.05)'
                        : 'transparent',
                      borderLeft: isSelected
                        ? '3px solid #3b82f6'
                        : !msg.isRead
                        ? '3px solid #60a5fa'
                        : '3px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        {!msg.isRead && (
                          <span
                            title="Unread message"
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              flexShrink: 0,
                            }}
                          ></span>
                        )}
                        <span
                          style={{
                            fontWeight: !msg.isRead ? 700 : 600,
                            fontSize: '0.94rem',
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {msg.name}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: !msg.isRead
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'rgba(16, 185, 129, 0.14)',
                          color: !msg.isRead ? '#93c5fd' : '#6ee7b7',
                          flexShrink: 0,
                        }}
                      >
                        {!msg.isRead ? 'UNREAD' : 'READ'}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: !msg.isRead ? 600 : 500,
                        color: '#e4e4e7',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {msg.subject}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.76rem',
                        color: '#71717a',
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {msg.email}
                      </span>
                      <span style={{ flexShrink: 0 }}>{formattedTime}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Detail View */}
          {selectedMessage && (
            <div
              data-testid="message-detail-panel"
              style={{
                backgroundColor: '#121214',
                border: '1px solid #27272a',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Detail Header & Status */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '14px',
                  flexWrap: 'wrap',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #27272a',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span
                      data-testid="selected-message-status"
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '5px',
                        backgroundColor: !selectedMessage.isRead
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(16, 185, 129, 0.15)',
                        color: !selectedMessage.isRead ? '#93c5fd' : '#34d399',
                        textTransform: 'uppercase',
                      }}
                    >
                      {!selectedMessage.isRead ? 'Unread' : 'Read'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#71717a' }}>
                      {new Date(selectedMessage.timestamp).toLocaleString([], {
                        dateStyle: 'full',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                    {selectedMessage.subject}
                  </h2>
                </div>

                {/* Action Controls: Mark Read/Unread + Delete */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {!selectedMessage.isRead ? (
                    <button
                      type="button"
                      data-testid="mark-read-btn"
                      onClick={() => handleToggleReadStatus(selectedMessage, true)}
                      disabled={updatingId === selectedMessage.id}
                      style={{
                        padding: '8px 14px',
                        background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: updatingId === selectedMessage.id ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <i className="fas fa-check-double"></i>
                      <span>Mark as Read</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="mark-unread-btn"
                      onClick={() => handleToggleReadStatus(selectedMessage, false)}
                      disabled={updatingId === selectedMessage.id}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                        color: '#e4e4e7',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: updatingId === selectedMessage.id ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <i className="fas fa-envelope"></i>
                      <span>Mark as Unread</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="delete-message-btn"
                    onClick={() => setDeleteTarget(selectedMessage)}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: 'rgba(239, 68, 68, 0.14)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="fas fa-trash-alt"></i>
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Sender Metadata Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  padding: '14px 16px',
                  backgroundColor: '#18181b',
                  borderRadius: '12px',
                  border: '1px solid #27272a',
                  fontSize: '0.84rem',
                }}
              >
                <div>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase' }}>
                    Visitor Name
                  </span>
                  <strong style={{ color: '#ffffff' }}>{selectedMessage.name}</strong>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase' }}>
                    Email Address
                  </span>
                  <a
                    href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(`Re: ${selectedMessage.subject}`)}`}
                    style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-all' }}
                  >
                    {selectedMessage.email}
                  </a>
                </div>
              </div>

              {/* Full Message Body */}
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#71717a',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: '8px',
                  }}
                >
                  Message Content
                </div>
                <div
                  data-testid="selected-message-body"
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '12px',
                    padding: '18px',
                    color: '#f4f4f5',
                    fontSize: '0.94rem',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedMessage.message}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Message Confirmation Dialog */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-message-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 120,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#121214',
              border: '1px solid #27272a',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
            }}
          >
            <h3
              id="delete-message-dialog-title"
              style={{ margin: '0 0 10px 0', fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}
            >
              Delete Visitor Message?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#a1a1aa', lineHeight: 1.55 }}>
              Are you sure you want to permanently delete the message from{' '}
              <strong style={{ color: '#ffffff' }}>{deleteTarget.name}</strong> regarding{' '}
              <strong style={{ color: '#ffffff' }}>{deleteTarget.subject}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
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
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-delete-message-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
