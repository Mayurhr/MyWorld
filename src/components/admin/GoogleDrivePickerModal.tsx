import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  loadGooglePickerApi,
  openGoogleDrivePicker,
  resolveGooglePickerApiKey,
  GooglePickerFile,
} from '../../services/googlePickerService';
import { getGoogleDriveFileId } from '../../utils/drive';
import { formatDriveViewUrl } from '../../services/googleDriveService';

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: { id: string; name: string; url: string; mimeType: string }) => void;
  filterMime?: 'image' | 'pdf' | 'all';
  title?: string;
}

const RECENT_FILES_STORAGE_KEY = 'admin_recent_picked_files';

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  filterMime = 'all',
  title = 'Select Media from Google Drive',
}) => {
  const { driveToken, connectGoogleDrive } = useAdminAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [pickerReady, setPickerReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMime, setCurrentMime] = useState<'image' | 'pdf' | 'all'>(filterMime);
  const [manualInput, setManualInput] = useState<string>('');
  const [recentFiles, setRecentFiles] = useState<GooglePickerFile[]>(() => {
    try {
      const stored = sessionStorage.getItem(RECENT_FILES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setCurrentMime(filterMime);
  }, [filterMime]);

  // Pre-load Google Picker API when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    loadGooglePickerApi()
      .then(() => {
        if (mounted) setPickerReady(true);
      })
      .catch((err) => {
        console.warn('[GooglePickerModal] Picker script preload failed:', err);
        if (mounted) {
          setError(
            'Failed to load Google Picker library. You can still paste Drive links directly or click Retry.'
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const saveRecentFile = (file: GooglePickerFile) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== file.id);
      const updated = [file, ...filtered].slice(0, 12);
      try {
        sessionStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed saving recent file to session storage:', e);
      }
      return updated;
    });
  };

  /**
   * Opens Google's official Picker dialog configured with the current drive.file token
   */
  const handleLaunchPicker = async () => {
    setError(null);
    setLoading(true);

    try {
      let activeToken = driveToken;

      // If not yet authenticated with Google, trigger popup authentication
      if (!activeToken) {
        activeToken = await connectGoogleDrive();
        if (!activeToken) {
          setLoading(false);
          return;
        }
      }

      // Ensure Picker script is fully loaded and API key is resolved
      await loadGooglePickerApi();
      setPickerReady(true);
      const activeApiKey = await resolveGooglePickerApiKey();

      openGoogleDrivePicker({
        oauthToken: activeToken,
        apiKey: activeApiKey,
        filterMime: currentMime,
        title:
          currentMime === 'pdf'
            ? 'Select Certificate or Resume PDF'
            : currentMime === 'image'
            ? 'Select Certificate or Project Image'
            : 'Select Media from Google Drive',
        onSelect: (file) => {
          setLoading(false);
          saveRecentFile(file);
          onSelectFile({
            id: file.id,
            name: file.name,
            url: file.url,
            mimeType: file.mimeType,
          });
          onClose();
        },
        onCancel: () => {
          setLoading(false);
        },
        onError: (pickerErr) => {
          setLoading(false);
          console.error('[Google Picker Dialog Error]', pickerErr);
          if (pickerErr.message.includes('developer key') || pickerErr.message.includes('API key')) {
            setError(
              'Google Picker requires an authorized API Key for this project. Check your VITE_GOOGLE_API_KEY environment variable.'
            );
          } else if (pickerErr.message.includes('origin') || pickerErr.message.includes('referrer')) {
            setError(
              'Google Picker was blocked by origin restrictions. Ensure your domain is listed under Authorized JavaScript Origins in Google Cloud.'
            );
          } else {
            setError(
              `Google Picker encountered an error: ${pickerErr.message}. You can paste a direct Drive link below.`
            );
          }
        },
      });
    } catch (err: any) {
      setLoading(false);
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user')
      ) {
        return;
      }
      console.error('[Launch Picker Error]', err);
      setError(err?.message || 'Failed to initialize Google Picker.');
    }
  };

  /**
   * Handles manual link / ID entry
   */
  const handleSelectManual = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    const fileId = getGoogleDriveFileId(trimmed) || trimmed;
    const viewUrl = formatDriveViewUrl(fileId);
    onSelectFile({
      id: fileId,
      name: `Drive File (${fileId.substring(0, 8)}...)`,
      url: viewUrl,
      mimeType: currentMime === 'pdf' ? 'application/pdf' : 'image/jpeg',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="admin-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal-content"
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          color: '#f4f4f5',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #1f1f23, #18181b)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
              }}
            >
              <i className="fab fa-google-drive" style={{ fontSize: '20px' }}></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>{title}</h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                  }}
                  title="Uses Google-recommended per-file OAuth scope (drive.file) without restricted-scope verification"
                >
                  <i className="fas fa-lock" style={{ marginRight: '4px', fontSize: '9px' }}></i>
                  drive.file Scope
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
                Browse your Google Drive safely via official Google Picker
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: '#27272a',
              border: 'none',
              color: '#d4d4d8',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Filter Tabs */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#121214',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: '#71717a', marginRight: '4px' }}>
              File Filter:
            </span>
            {(['all', 'image', 'pdf'] as const).map((mime) => (
              <button
                key={mime}
                type="button"
                onClick={() => setCurrentMime(mime)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: currentMime === mime ? '1px solid #3b82f6' : '1px solid #3f3f46',
                  background: currentMime === mime ? 'rgba(59, 130, 246, 0.2)' : '#1f1f23',
                  color: currentMime === mime ? '#93c5fd' : '#a1a1aa',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <i
                  className={
                    mime === 'image'
                      ? 'fas fa-image'
                      : mime === 'pdf'
                      ? 'fas fa-file-pdf'
                      : 'fas fa-th-large'
                  }
                  style={{ fontSize: '11px' }}
                ></i>
                {mime === 'all' ? 'All Supported' : mime === 'image' ? 'Images' : 'PDFs'}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#71717a' }}>
            {driveToken ? (
              <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                OAuth Active
              </span>
            ) : (
              <span style={{ color: '#fbbf24' }}>Connect to browse</span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                color: '#f87171',
                marginBottom: '20px',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-exclamation-circle"></i>
                Picker Notice
              </div>
              {error}
            </div>
          )}

          {/* Primary Action Card: Launch Google Picker */}
          <div
            style={{
              backgroundColor: '#1f1f23',
              border: '1px solid #3f3f46',
              borderRadius: '14px',
              padding: '24px',
              textAlign: 'center',
              marginBottom: '24px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                color: '#3b82f6',
                fontSize: '24px',
              }}
            >
              <i className="fab fa-google-drive"></i>
            </div>

            <h4 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', margin: '0 0 8px 0' }}>
              Google Drive Picker
            </h4>

            <p
              style={{
                color: '#a1a1aa',
                maxWidth: '520px',
                margin: '0 auto 20px auto',
                fontSize: '0.86rem',
                lineHeight: 1.5,
              }}
            >
              Open Google&apos;s native file picker to securely browse folders, search file names, preview certificates,
              and select {currentMime === 'image' ? 'images' : currentMime === 'pdf' ? 'PDFs' : 'images or PDFs'}.
            </p>

            <button
              type="button"
              onClick={handleLaunchPicker}
              disabled={loading}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.15s ease',
              }}
            >
              <i className={loading ? 'fas fa-spinner fa-spin' : 'fab fa-google-drive'}></i>
              <span>{loading ? 'Launching Picker...' : 'Open Google Drive Picker'}</span>
            </button>

            {/* Scope explanation badge */}
            <div
              style={{
                marginTop: '16px',
                fontSize: '0.76rem',
                color: '#71717a',
              }}
            >
              <i className="fas fa-shield-alt" style={{ color: '#10b981', marginRight: '5px' }}></i>
              Uses <code>drive.file</code> scope: grants per-file permission to selected media without restricted access.
            </div>
          </div>

          {/* Recently Picked Media Section (if any files were selected in this session) */}
          {recentFiles.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e4e4e7' }}>
                  <i className="fas fa-history" style={{ marginRight: '6px', color: '#60a5fa' }}></i>
                  Recently Picked Files
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecentFiles([]);
                    sessionStorage.removeItem(RECENT_FILES_STORAGE_KEY);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#71717a',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear history
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '12px',
                }}
              >
                {recentFiles
                  .filter((f) => {
                    if (currentMime === 'image') return f.mimeType.startsWith('image/');
                    if (currentMime === 'pdf') return f.mimeType === 'application/pdf';
                    return true;
                  })
                  .map((file) => {
                    const isPdf = file.mimeType === 'application/pdf';
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          onSelectFile({
                            id: file.id,
                            name: file.name,
                            url: file.url,
                            mimeType: file.mimeType,
                          });
                          onClose();
                        }}
                        style={{
                          backgroundColor: '#1f1f23',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'border-color 0.15s ease, transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#27272a';
                          e.currentTarget.style.transform = 'none';
                        }}
                        title={`Select: ${file.name}`}
                      >
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: '#121214',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: isPdf ? '#ef4444' : '#3b82f6',
                            fontSize: '16px',
                          }}
                        >
                          <i className={isPdf ? 'fas fa-file-pdf' : 'fas fa-image'}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.80rem',
                              fontWeight: 500,
                              color: '#f4f4f5',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {file.name}
                          </div>
                          <div style={{ fontSize: '0.70rem', color: '#71717a' }}>
                            ID: {file.id.substring(0, 8)}...
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600 }}>
                          Select
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Manual URL / File ID Fallback Entry Section */}
          <div
            style={{
              paddingTop: '20px',
              borderTop: '1px dashed #27272a',
            }}
          >
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              <i className="fas fa-link" style={{ marginRight: '6px', color: '#a1a1aa' }}></i>
              Manual Link or File ID Entry (Fallback)
            </div>

            <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#a1a1aa', lineHeight: 1.45 }}>
              Paste a direct Google Drive link (e.g. <code>https://drive.google.com/file/d/...</code>) or File ID.
              The file must be set to <em>&ldquo;Anyone with the link can view&rdquo;</em> in Google Drive so public visitors can view it.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Paste Google Drive URL or File ID..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSelectManual();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  backgroundColor: '#121214',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleSelectManual}
                disabled={!manualInput.trim()}
                style={{
                  padding: '9px 18px',
                  backgroundColor: manualInput.trim() ? '#2563eb' : '#27272a',
                  color: manualInput.trim() ? '#fff' : '#71717a',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: manualInput.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s ease',
                  flexShrink: 0,
                }}
              >
                Use File
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#121214',
            fontSize: '0.78rem',
            color: '#71717a',
          }}
        >
          <span>
            Tip: Files chosen via Google Picker automatically receive app authorization without third-party audit requirements.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              background: '#27272a',
              border: 'none',
              borderRadius: '6px',
              color: '#d4d4d8',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.82rem',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
