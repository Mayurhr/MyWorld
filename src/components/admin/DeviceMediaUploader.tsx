import React, { useState, useEffect, useRef } from 'react';
import {
  CloudinaryStatus,
  MediaAcceptKind,
  MediaAsset,
  MediaCategory,
  UploadProgressInfo,
  deleteCloudinaryFileByPublicId,
  formatFileSize,
  getAcceptAttribute,
  getCloudinaryStatus,
  listMediaAssets,
  replaceMediaFile,
  uploadMediaFile,
  validateMediaFile,
} from '../../services/mediaStorageService';
import { isCloudinaryPdfBridgeUrl, isCloudinaryUrl } from '../../utils/drive';

interface DeviceMediaUploaderProps {
  category: MediaCategory;
  acceptKind: MediaAcceptKind;
  currentUrl?: string;
  currentPublicId?: string;
  currentResourceType?: 'image' | 'raw' | 'video';
  currentStoragePath?: string;
  preservePreviousOnReplace?: boolean;
  defaultPublishImmediately?: boolean;
  label?: string;
  helperText?: string;
  onUploaded: (asset: MediaAsset) => void;
  onDeleted?: () => void;
}

export const DeviceMediaUploader: React.FC<DeviceMediaUploaderProps> = ({
  category,
  acceptKind,
  currentUrl,
  currentPublicId,
  currentResourceType,
  currentStoragePath,
  preservePreviousOnReplace = false,
  defaultPublishImmediately = false,
  label = 'Upload from Laptop / Phone (Cloudinary)',
  helperText,
  onUploaded,
  onDeleted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelUploadRef = useRef<(() => void) | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingIsImage, setPendingIsImage] = useState<boolean>(false);
  const [publishImmediately, setPublishImmediately] = useState<boolean>(
    defaultPublishImmediately
  );
  const [isReplacingMode, setIsReplacingMode] = useState<boolean>(false);

  const [uploading, setUploading] = useState<boolean>(false);
  const [progressInfo, setProgressInfo] = useState<UploadProgressInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<CloudinaryStatus | null>(null);

  // Confirm delete state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Pick from existing uploaded media library
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState<boolean>(false);

  const resolvedCurrentPublicId = currentPublicId || currentStoragePath;

  useEffect(() => {
    let active = true;
    getCloudinaryStatus()
      .then((res) => {
        if (active) setCloudinaryStatus(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Revoke object URL on cleanup or file change
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
    };
  }, [pendingPreviewUrl]);

  const clearPendingSelection = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setPendingIsImage(false);
    setIsReplacingMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFilePicked = (file: File | undefined, replaceExisting = false) => {
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validateMediaFile(file, acceptKind);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Invalid file selected.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }

    const objectUrl = validation.isImage ? URL.createObjectURL(file) : null;
    setPendingFile(file);
    setPendingPreviewUrl(objectUrl);
    setPendingIsImage(validation.isImage);
    setIsReplacingMode(replaceExisting);
  };

  const handleTriggerPicker = (replaceExisting = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsReplacingMode(replaceExisting);
    fileInputRef.current?.click();
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    try {
      setUploading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      setProgressInfo({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: pendingFile.size,
        state: 'running',
      });

      let resultAsset: MediaAsset;

      if (isReplacingMode && resolvedCurrentPublicId && !preservePreviousOnReplace) {
        const existingList = await listMediaAssets(true).catch(() => []);
        const matched = existingList.find(
          (m) =>
            m.publicId === resolvedCurrentPublicId || m.storagePath === resolvedCurrentPublicId
        );
        const targetExisting: MediaAsset = matched || {
          id: `media_${Date.now()}`,
          name: pendingFile.name,
          category,
          downloadUrl: currentUrl || '',
          publicId: resolvedCurrentPublicId,
          cloudinaryResourceType:
            currentResourceType || (acceptKind === 'pdf' ? 'image' : 'image'),
          storagePath: resolvedCurrentPublicId,
          mimeType: pendingFile.type || 'image/jpeg',
          sizeBytes: pendingFile.size,
          status: publishImmediately ? 'published' : 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        resultAsset = await replaceMediaFile(targetExisting, pendingFile, {
          acceptKind,
          onProgress: (info) => setProgressInfo(info),
          onTaskCreated: (cancelFn) => {
            cancelUploadRef.current = cancelFn;
          },
        });
      } else {
        resultAsset = await uploadMediaFile({
          file: pendingFile,
          category,
          acceptKind,
          publishImmediately,
          onProgress: (info) => setProgressInfo(info),
          onTaskCreated: (cancelFn) => {
            cancelUploadRef.current = cancelFn;
          },
        });
      }

      clearPendingSelection();
      const deliveryNote =
        resultAsset.mimeType === 'application/pdf'
          ? resultAsset.directPdfDelivery === true
            ? ' Direct CDN PDF delivery verified.'
            : ' Public PDF delivery active via protected server bridge (Cloudinary CDN PDF restriction bypassed).'
          : '';
      setSuccessMsg(
        `Uploaded "${resultAsset.name}" (${formatFileSize(resultAsset.sizeBytes)}) to Cloudinary.${deliveryNote}`
      );
      onUploaded(resultAsset);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
      cancelUploadRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (cancelUploadRef.current) {
      cancelUploadRef.current();
      cancelUploadRef.current = null;
    }
  };

  const handleDeleteCurrent = async () => {
    if (!resolvedCurrentPublicId) return;

    try {
      setDeleting(true);
      setErrorMsg(null);
      await deleteCloudinaryFileByPublicId(resolvedCurrentPublicId, currentResourceType);
      setConfirmDeleteOpen(false);
      setSuccessMsg('Uploaded file deleted from Cloudinary.');
      onDeleted?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete file from Cloudinary.');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenLibrary = async () => {
    if (libraryOpen) {
      setLibraryOpen(false);
      return;
    }
    setLibraryOpen(true);
    try {
      setLibraryLoading(true);
      const all = await listMediaAssets(true);
      const filtered = all.filter((item) => {
        if (acceptKind === 'image' && !item.mimeType.startsWith('image/')) return false;
        if (acceptKind === 'pdf' && item.mimeType !== 'application/pdf') return false;
        return true;
      });
      setLibraryAssets(filtered);
    } finally {
      setLibraryLoading(false);
    }
  };

  const hasCurrentCloudinaryFile = Boolean(
    resolvedCurrentPublicId ||
      (currentUrl && (isCloudinaryUrl(currentUrl) || isCloudinaryPdfBridgeUrl(currentUrl)))
  );

  return (
    <div
      style={{
        backgroundColor: '#121214',
        border: '1px solid #27272a',
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Hidden native file picker (works on laptop & mobile) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptAttribute(acceptKind)}
        style={{ display: 'none' }}
        onChange={(e) => handleFilePicked(e.target.files?.[0], isReplacingMode)}
      />

      {/* Top Row: Title + Cloudinary Status Indicator */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f4f4f5' }}>
            <i className="fas fa-cloud-upload-alt" style={{ color: '#60a5fa', marginRight: '6px' }}></i>
            {label}
          </div>
          {helperText && (
            <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px' }}>
              {helperText}
            </div>
          )}
        </div>

        {cloudinaryStatus?.configured === false ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#fbbf24',
              backgroundColor: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              padding: '3px 9px',
              borderRadius: '999px',
            }}
          >
            <i className="fas fa-exclamation-triangle"></i>
            <span>Cloudinary Secrets Needed</span>
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#34d399',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '3px 9px',
              borderRadius: '999px',
            }}
          >
            <i className="fas fa-check-circle"></i>
            <span>
              Cloudinary Ready
              {cloudinaryStatus?.cloudName ? ` (${cloudinaryStatus.cloudName})` : ''}
            </span>
          </span>
        )}
      </div>

      {/* Warning if Cloudinary Secrets are not configured yet */}
      {cloudinaryStatus && !cloudinaryStatus.configured && (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            fontSize: '0.76rem',
            color: '#fde68a',
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '2px' }}>
            <i className="fas fa-key" style={{ marginRight: '6px' }}></i>
            Cloudinary Secrets Required in Google AI Studio
          </div>
          <div>
            Add{' '}
            <code>
              {cloudinaryStatus.missing.join(', ') ||
                'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'}
            </code>{' '}
            to your environment secrets to enable signed uploads.
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      {!pendingFile && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => handleTriggerPicker(false)}
            disabled={uploading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            <i className="fas fa-file-upload"></i>
            <span>
              {acceptKind === 'pdf'
                ? 'Choose PDF from Device'
                : acceptKind === 'image'
                ? 'Choose Image from Device'
                : 'Choose Image or PDF from Device'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenLibrary}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#d4d4d8',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-photo-video"></i>
            <span>{libraryOpen ? 'Hide Uploaded Library' : 'Choose Uploaded File'}</span>
          </button>

          {hasCurrentCloudinaryFile && (
            <>
              <button
                type="button"
                onClick={() => handleTriggerPicker(true)}
                disabled={uploading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  color: '#fbbf24',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-exchange-alt"></i>
                <span>Replace File</span>
              </button>

              {resolvedCurrentPublicId && onDeleted && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={uploading || deleting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <i className="fas fa-trash-alt"></i>
                  <span>Delete File</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Pre-Upload Preview & Confirm Card */}
      {pendingFile && (
        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid rgba(59, 130, 246, 0.45)',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {pendingIsImage && pendingPreviewUrl ? (
              <img
                src={pendingPreviewUrl}
                alt="Pre-upload preview"
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1px solid #3f3f46',
                  backgroundColor: '#09090b',
                }}
              />
            ) : (
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f87171',
                  fontSize: '24px',
                }}
              >
                <i className="fas fa-file-pdf"></i>
              </div>
            )}

            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff', wordBreak: 'break-all' }}>
                {pendingFile.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px' }}>
                {formatFileSize(pendingFile.size)} • {pendingFile.type || 'Document'} • Category:{' '}
                <strong style={{ color: '#93c5fd' }}>{category}</strong>
              </div>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.74rem',
                  color: '#d4d4d8',
                  marginTop: '6px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                />
                <span>Publish uploaded asset immediately</span>
              </label>
            </div>
          </div>

          {/* Progress Bar while Uploading */}
          {uploading && progressInfo && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.74rem',
                  color: '#93c5fd',
                  marginBottom: '4px',
                }}
              >
                <span>Uploading to Cloudinary...</span>
                <span>
                  {progressInfo.progress}% ({formatFileSize(progressInfo.bytesTransferred)} /{' '}
                  {formatFileSize(progressInfo.totalBytes)})
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '7px',
                  backgroundColor: '#27272a',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progressInfo.progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #2563eb, #34d399)',
                    transition: 'width 0.15s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Confirm / Cancel Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {uploading ? (
              <button
                type="button"
                onClick={handleCancelUpload}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '7px',
                  color: '#fca5a5',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel Upload
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={clearPendingSelection}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#27272a',
                    border: 'none',
                    borderRadius: '7px',
                    color: '#d4d4d8',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  style={{
                    padding: '6px 14px',
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    border: 'none',
                    borderRadius: '7px',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fas fa-cloud-upload-alt"></i>
                  <span>{isReplacingMode ? 'Upload Replacement' : 'Upload to Cloudinary'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Existing Uploaded Media Library Picker */}
      {libraryOpen && (
        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '10px',
            padding: '10px',
            maxHeight: '210px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '8px' }}>
            Select from Previously Uploaded Cloudinary Media ({libraryAssets.length})
          </div>
          {libraryLoading ? (
            <div style={{ fontSize: '0.78rem', color: '#71717a', padding: '12px 0' }}>
              Loading uploaded media...
            </div>
          ) : libraryAssets.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: '#71717a', padding: '8px 0' }}>
              No uploaded files found for this media type yet.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '8px',
              }}
            >
              {libraryAssets.map((item) => {
                const isImg = item.mimeType.startsWith('image/');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onUploaded(item);
                      setLibraryOpen(false);
                      setSuccessMsg(`Selected "${item.name}" from Media Library.`);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {isImg ? (
                      <img
                        src={item.downloadUrl}
                        alt={item.name}
                        style={{ width: '32px', height: '32px', borderRadius: '5px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <i className="fas fa-file-pdf" style={{ color: '#ef4444', fontSize: '20px', flexShrink: 0 }}></i>
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#71717a' }}>
                        {item.category} • {formatFileSize(item.sizeBytes)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inline Delete Confirmation */}
      {confirmDeleteOpen && (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '0.78rem',
            color: '#fca5a5',
          }}
        >
          <span>Delete this uploaded file from Cloudinary?</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleting}
              style={{
                padding: '4px 10px',
                backgroundColor: '#27272a',
                border: 'none',
                borderRadius: '6px',
                color: '#d4d4d8',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteCurrent}
              disabled={deleting}
              style={{
                padding: '4px 10px',
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: deleting ? 'not-allowed' : 'pointer',
              }}
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '0.78rem',
            lineHeight: 1.4,
          }}
        >
          <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i>
          {errorMsg}
        </div>
      )}

      {/* Success Message */}
      {successMsg && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: '#6ee7b7',
            fontSize: '0.78rem',
          }}
        >
          <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>
          {successMsg}
        </div>
      )}
    </div>
  );
};
