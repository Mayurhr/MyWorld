import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { listDriveFiles, DriveFile } from '../../services/googleDriveService';
import {
  loadGooglePickerApi,
  openGoogleDrivePicker,
  resolveGooglePickerApiKey,
} from '../../services/googlePickerService';
import {
  CloudinaryStatus,
  MEDIA_CATEGORIES,
  MediaAsset,
  MediaCategory,
  UploadProgressInfo,
  deleteMediaAsset,
  formatFileSize,
  getAcceptAttribute,
  getCloudinaryStatus,
  listMediaAssets,
  replaceMediaFile,
  updateMediaAssetStatus,
  uploadMediaFile,
  validateMediaFile,
} from '../../services/mediaStorageService';
import {
  getDocumentDownloadUrl,
  isCloudinaryPdfBridgeUrl,
  isCloudinaryUrl,
  resolvePlayablePdfUrl,
} from '../../utils/drive';

type PreviewModalItem =
  | { kind: 'cloudinary'; asset: MediaAsset }
  | { kind: 'drive'; file: DriveFile };

export const AdminMediaManager: React.FC = () => {
  const { driveToken, connectGoogleDrive, firebaseUser, isFirebaseAdmin, connectFirebaseCloud } =
    useAdminAuth();

  // Primary Cloudinary Media Library State
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState<boolean>(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<CloudinaryStatus | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState<boolean>(false);

  // New Upload Form State
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cancelUploadRef = useRef<(() => void) | null>(null);
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('Projects');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingIsImage, setPendingIsImage] = useState<boolean>(false);
  const [publishImmediately, setPublishImmediately] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filters & Search for Uploaded Media Library
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | MediaCategory>('All');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'pdf'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<PreviewModalItem | null>(null);

  // Replace Asset Modal / State
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const cancelReplaceRef = useRef<(() => void) | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<MediaAsset | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<boolean>(false);
  const [replaceProgress, setReplaceProgress] = useState<UploadProgressInfo | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Delete Asset Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Updating Status tracking
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Legacy Google Drive Section (Collapsible)
  const [showLegacyDrive, setShowLegacyDrive] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>(() => {
    try {
      const stored = sessionStorage.getItem('admin_recent_picked_files');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((p: any) => ({
          id: p.id,
          name: p.name,
          mimeType: p.mimeType,
          thumbnailLink: p.thumbnailLink || `https://lh3.googleusercontent.com/d/${p.id}=w400`,
          webViewLink: p.url || `https://drive.google.com/file/d/${p.id}/view`,
          size: p.sizeBytes ? String(p.sizeBytes) : undefined,
        }));
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [driveLoading, setDriveLoading] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSearchQuery, setDriveSearchQuery] = useState<string>('');

  const loadMediaLibrary = async () => {
    try {
      setMediaLoading(true);
      setMediaError(null);
      const [list, status] = await Promise.all([
        listMediaAssets(true),
        getCloudinaryStatus().catch(() => null),
      ]);
      setMediaAssets(list);
      if (status) {
        setCloudinaryStatus(status);
        window.dispatchEvent(new CustomEvent('cloudinary-status-updated'));
      }
    } catch (err: any) {
      setMediaError(err?.message || 'Failed to load uploaded media assets.');
    } finally {
      setMediaLoading(false);
    }
  };

  useEffect(() => {
    loadMediaLibrary();
  }, [isFirebaseAdmin]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  useEffect(() => {
    return () => {
      if (replacePreviewUrl) URL.revokeObjectURL(replacePreviewUrl);
    };
  }, [replacePreviewUrl]);

  const handleConnectCloud = async () => {
    try {
      setIsConnectingCloud(true);
      setUploadError(null);
      await connectFirebaseCloud();
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to sync with Cloud Firestore.');
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const handleSelectUploadFile = (file?: File) => {
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);

    const validation = validateMediaFile(file, 'both');
    if (!validation.valid) {
      setUploadError(validation.error || 'Unsupported file.');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      return;
    }

    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }

    setPendingFile(file);
    setPendingIsImage(validation.isImage);
    setPendingPreviewUrl(validation.isImage ? URL.createObjectURL(file) : null);
  };

  const clearPendingUpload = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setPendingIsImage(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const handleStartUpload = async () => {
    if (!pendingFile) return;

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);
      setUploadProgress({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: pendingFile.size,
        state: 'running',
      });

      const uploaded = await uploadMediaFile({
        file: pendingFile,
        category: uploadCategory,
        acceptKind: 'both',
        publishImmediately,
        onProgress: (info) => setUploadProgress(info),
        onTaskCreated: (cancelFn) => {
          cancelUploadRef.current = cancelFn;
        },
      });

      clearPendingUpload();
      setUploadSuccess(
        `Uploaded "${uploaded.name}" (${formatFileSize(uploaded.sizeBytes)}) to ${uploaded.category}.`
      );
      setMediaAssets((prev) => [uploaded, ...prev.filter((item) => item.id !== uploaded.id)]);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
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

  const handleTriggerReplace = (asset: MediaAsset) => {
    setReplaceTarget(asset);
    setReplaceFile(null);
    if (replacePreviewUrl) {
      URL.revokeObjectURL(replacePreviewUrl);
      setReplacePreviewUrl(null);
    }
    setReplaceError(null);
    setReplaceProgress(null);
    setTimeout(() => {
      replaceInputRef.current?.click();
    }, 0);
  };

  const handleReplaceFileSelected = (file?: File) => {
    if (!file || !replaceTarget) return;
    setReplaceError(null);
    const validation = validateMediaFile(file, 'both');
    if (!validation.valid) {
      setReplaceError(validation.error || 'Unsupported file.');
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }
    if (replacePreviewUrl) {
      URL.revokeObjectURL(replacePreviewUrl);
    }
    setReplaceFile(file);
    setReplacePreviewUrl(validation.isImage ? URL.createObjectURL(file) : null);
  };

  const closeReplaceModal = () => {
    if (replacing && cancelReplaceRef.current) {
      cancelReplaceRef.current();
    }
    if (replacePreviewUrl) {
      URL.revokeObjectURL(replacePreviewUrl);
    }
    setReplaceTarget(null);
    setReplaceFile(null);
    setReplacePreviewUrl(null);
    setReplaceError(null);
    setReplaceProgress(null);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const handleConfirmReplace = async () => {
    if (!replaceTarget || !replaceFile) return;

    try {
      setReplacing(true);
      setReplaceError(null);
      setReplaceProgress({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: replaceFile.size,
        state: 'running',
      });

      const updated = await replaceMediaFile(replaceTarget, replaceFile, {
        acceptKind: 'both',
        onProgress: (info) => setReplaceProgress(info),
        onTaskCreated: (cancelFn) => {
          cancelReplaceRef.current = cancelFn;
        },
      });

      setMediaAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setUploadSuccess(`Replaced "${updated.name}" (${formatFileSize(updated.sizeBytes)}) successfully.`);
      closeReplaceModal();
    } catch (err: any) {
      setReplaceError(err?.message || 'Failed to replace file.');
    } finally {
      setReplacing(false);
      cancelReplaceRef.current = null;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setMediaError(null);
      await deleteMediaAsset(deleteTarget);
      setMediaAssets((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setUploadSuccess(`Deleted "${deleteTarget.name}" from Cloudinary.`);
      setDeleteTarget(null);
    } catch (err: any) {
      setMediaError(err?.message || 'Failed to delete file.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleAssetStatus = async (asset: MediaAsset) => {
    const nextStatus = asset.status === 'published' ? 'draft' : 'published';
    try {
      setUpdatingStatusId(asset.id);
      setMediaError(null);
      const updated = await updateMediaAssetStatus(asset, nextStatus);
      setMediaAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err: any) {
      setMediaError(err?.message || 'Failed to update asset publish status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredAssets = mediaAssets.filter((asset) => {
    if (categoryFilter !== 'All' && asset.category !== categoryFilter) return false;
    const isImg = asset.mimeType.startsWith('image/');
    const isPdf = asset.mimeType === 'application/pdf';
    if (typeFilter === 'image' && !isImg) return false;
    if (typeFilter === 'pdf' && !isPdf) return false;
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = asset.name.toLowerCase().includes(q);
      const matchCat = asset.category.toLowerCase().includes(q);
      if (!matchName && !matchCat) return false;
    }
    return true;
  });

  // Legacy Google Drive helpers
  const fetchLegacyDriveFiles = async (query = '') => {
    if (!driveToken) return;
    try {
      setDriveLoading(true);
      setDriveError(null);
      const results = await listDriveFiles(driveToken, {
        searchQuery: query || undefined,
        pageSize: 40,
      });
      setDriveFiles((prev) => {
        const existingIds = new Set(results.map((r) => r.id));
        const keptPrev = prev.filter((p) => !existingIds.has(p.id));
        return [...results, ...keptPrev];
      });
    } catch (err: any) {
      console.warn('Error fetching legacy Drive files:', err);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleOpenLegacyPicker = async () => {
    try {
      setDriveLoading(true);
      setDriveError(null);
      let token = driveToken;
      if (!token) {
        token = await connectGoogleDrive();
        if (!token) {
          setDriveLoading(false);
          return;
        }
      }

      await loadGooglePickerApi();
      const activeApiKey = await resolveGooglePickerApiKey();

      openGoogleDrivePicker({
        oauthToken: token,
        apiKey: activeApiKey,
        filterMime: 'all',
        onSelect: (picked) => {
          const newDriveFile: DriveFile = {
            id: picked.id,
            name: picked.name,
            mimeType: picked.mimeType,
            thumbnailLink: picked.thumbnailLink || `https://lh3.googleusercontent.com/d/${picked.id}=w400`,
            webViewLink: picked.url || `https://drive.google.com/file/d/${picked.id}/view`,
            size: picked.sizeBytes ? String(picked.sizeBytes) : undefined,
          };
          setDriveFiles((prev) => {
            const filtered = prev.filter((f) => f.id !== picked.id);
            return [newDriveFile, ...filtered];
          });
          try {
            const stored = sessionStorage.getItem('admin_recent_picked_files');
            const list = stored ? JSON.parse(stored) : [];
            const updated = [picked, ...list.filter((f: any) => f.id !== picked.id)].slice(0, 30);
            sessionStorage.setItem('admin_recent_picked_files', JSON.stringify(updated));
          } catch (e) {
            console.warn(e);
          }
          setDriveLoading(false);
        },
        onCancel: () => setDriveLoading(false),
        onError: (err) => {
          setDriveLoading(false);
          setDriveError(err.message);
        },
      });
    } catch (err: any) {
      setDriveLoading(false);
      setDriveError(err?.message || 'Failed opening Google Picker.');
    }
  };

  useEffect(() => {
    if (showLegacyDrive && driveToken) {
      fetchLegacyDriveFiles(driveSearchQuery);
    }
  }, [showLegacyDrive, driveToken]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Hidden inputs for new upload & replacement */}
      <input
        ref={uploadInputRef}
        type="file"
        accept={getAcceptAttribute('both')}
        style={{ display: 'none' }}
        onChange={(e) => handleSelectUploadFile(e.target.files?.[0])}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={getAcceptAttribute('both')}
        style={{ display: 'none' }}
        onChange={(e) => handleReplaceFileSelected(e.target.files?.[0])}
      />

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
            Portfolio Media Manager
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
            Upload images and PDFs directly from your laptop or phone to persistent Cloudinary storage. Existing Google Drive assets remain untouched.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {cloudinaryStatus && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                backgroundColor: cloudinaryStatus.configured
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(245, 158, 11, 0.14)',
                border: cloudinaryStatus.configured
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid rgba(245, 158, 11, 0.35)',
                color: cloudinaryStatus.configured ? '#34d399' : '#fbbf24',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <i
                className={
                  cloudinaryStatus.configured
                    ? 'fas fa-check-circle'
                    : 'fas fa-exclamation-triangle'
                }
              ></i>
              <span>
                {cloudinaryStatus.configured
                  ? `Cloudinary: ${cloudinaryStatus.cloudName}`
                  : 'Cloudinary Setup Needed'}
              </span>
            </div>
          )}

          {isFirebaseAdmin ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#93c5fd',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <i className="fas fa-database"></i>
              <span>Firestore: {firebaseUser?.email}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectCloud}
              disabled={isConnectingCloud}
              title="Optional: Sign in with Google to mirror media metadata to Cloud Firestore"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 14px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#d4d4d8',
                fontWeight: 500,
                fontSize: '0.83rem',
                cursor: isConnectingCloud ? 'not-allowed' : 'pointer',
              }}
            >
              <i className="fab fa-google"></i>
              <span>{isConnectingCloud ? 'Syncing...' : 'Sync Firestore'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadMediaLibrary}
            disabled={mediaLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: mediaLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <i className={`fas fa-sync-alt ${mediaLoading ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Cloudinary Configuration Notice if server environment secrets are missing */}
      {cloudinaryStatus && !cloudinaryStatus.configured && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '12px',
            color: '#fde68a',
            marginBottom: '22px',
            fontSize: '0.86rem',
            lineHeight: 1.55,
          }}
        >
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '4px', fontSize: '0.94rem' }}>
            <i className="fas fa-key" style={{ marginRight: '8px' }}></i>
            Action Required: Configure Cloudinary Secrets in Google AI Studio
          </div>
          <div style={{ marginBottom: '6px' }}>
            Missing server environment secret(s):{' '}
            <code>
              {cloudinaryStatus.missing.join(', ') ||
                'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'}
            </code>
            .
          </div>
          <div style={{ fontSize: '0.82rem', color: '#fcd34d' }}>
            1. Open your{' '}
            <a
              href="https://console.cloudinary.com/settings/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#93c5fd', textDecoration: 'underline', fontWeight: 600 }}
            >
              Cloudinary Dashboard → API Keys
            </a>{' '}
            and copy your <strong>Cloud Name</strong>, <strong>API Key</strong>, and{' '}
            <strong>API Secret</strong>.
            <br />
            2. Add <code>CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_API_KEY</code>, and{' '}
            <code>CLOUDINARY_API_SECRET</code> in Google AI Studio <strong>Secrets</strong> (secrets stay strictly on the server and are never exposed to visitors).
            <br />
            3. In Cloudinary <strong>Settings → Security</strong>, enable{' '}
            <strong>&ldquo;Allow delivery of PDF and ZIP files&rdquo;</strong> so uploaded resume and certificate PDFs open and download cleanly.
          </div>
        </div>
      )}

      {/* Upload New Media Card */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '22px 24px',
          marginBottom: '26px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
              Upload New Media
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#a1a1aa' }}>
              Select an image (JPG, JPEG, PNG, WEBP) or PDF document up to 10 MB directly from your device.
            </p>
          </div>

          {/* Category Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>
              Category:
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as MediaCategory)}
              disabled={uploading}
              style={{
                padding: '8px 14px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              {MEDIA_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag & Drop / File Picker Zone */}
        {!pendingFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              handleSelectUploadFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => uploadInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDraggingOver ? '#3b82f6' : '#3f3f46'}`,
              backgroundColor: isDraggingOver ? 'rgba(59, 130, 246, 0.08)' : '#18181b',
              borderRadius: '12px',
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.14)',
                color: '#60a5fa',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                marginBottom: '12px',
              }}
            >
              <i className="fas fa-cloud-upload-alt"></i>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
              Click to choose a file from your laptop or phone, or drag and drop here
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
              Category: <strong style={{ color: '#93c5fd' }}>{uploadCategory}</strong> • Images &amp; PDFs up to 10 MB • Saved as Draft until published
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {pendingIsImage && pendingPreviewUrl ? (
                <img
                  src={pendingPreviewUrl}
                  alt="Preview before upload"
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: '1px solid #3f3f46',
                    backgroundColor: '#09090b',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f87171',
                    fontSize: '28px',
                  }}
                >
                  <i className="fas fa-file-pdf"></i>
                </div>
              )}

              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', wordBreak: 'break-all' }}>
                  {pendingFile.name}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#a1a1aa',
                    marginTop: '3px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatFileSize(pendingFile.size)} • {pendingFile.type || 'Document'} • Category:{' '}
                  <strong style={{ color: '#93c5fd' }}>{uploadCategory}</strong>
                </div>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontSize: '0.8rem',
                    color: '#d4d4d8',
                    marginTop: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={publishImmediately}
                    onChange={(e) => setPublishImmediately(e.target.checked)}
                    disabled={uploading}
                  />
                  <span>Publish uploaded asset immediately (otherwise saved as Draft)</span>
                </label>
              </div>
            </div>

            {uploading && uploadProgress && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: '#93c5fd',
                    marginBottom: '5px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span>Uploading to Cloudinary...</span>
                  <span>
                    {uploadProgress.progress}% ({formatFileSize(uploadProgress.bytesTransferred)} /{' '}
                    {formatFileSize(uploadProgress.totalBytes)})
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#27272a',
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${uploadProgress.progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #2563eb, #34d399)',
                      transition: 'width 0.15s ease',
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {uploading ? (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    fontSize: '0.84rem',
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
                    onClick={clearPendingUpload}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#27272a',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#d4d4d8',
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                    }}
                  >
                    Clear Selection
                  </button>
                  <button
                    type="button"
                    onClick={handleStartUpload}
                    style={{
                      padding: '8px 20px',
                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                    }}
                  >
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>Upload to Cloudinary</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {uploadError && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              lineHeight: 1.45,
            }}
          >
            <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              color: '#6ee7b7',
              fontSize: '0.85rem',
            }}
          >
            <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
            {uploadSuccess}
          </div>
        )}
      </div>

      {/* Category & Search Filter Bar for Uploaded Media */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {(['All', ...MEDIA_CATEGORIES] as const).map((cat) => {
            const count =
              cat === 'All'
                ? mediaAssets.length
                : mediaAssets.filter((m) => m.category === cat).length;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: active ? '#3b82f6' : '#27272a',
                  backgroundColor: active ? 'rgba(59, 130, 246, 0.16)' : '#18181b',
                  color: active ? '#93c5fd' : '#a1a1aa',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + Type + Status Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <i
              className="fas fa-search"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a',
                fontSize: '13px',
              }}
            ></i>
            <input
              type="text"
              placeholder="Search uploaded files by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.82rem',
              }}
            >
              <option value="all">All Types</option>
              <option value="image">Images Only</option>
              <option value="pdf">PDFs Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.82rem',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {mediaError && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            marginBottom: '20px',
            fontSize: '0.86rem',
          }}
        >
          {mediaError}
        </div>
      )}

      {/* Uploaded Media Assets Grid */}
      {mediaLoading ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: '#a1a1aa' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '28px', color: '#3b82f6', marginBottom: '12px' }}></i>
          <div>Loading uploaded media library...</div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px dashed #27272a',
            borderRadius: '14px',
            padding: '44px 24px',
            textAlign: 'center',
            color: '#a1a1aa',
            marginBottom: '32px',
          }}
        >
          <i className="fas fa-photo-video" style={{ fontSize: '34px', color: '#60a5fa', marginBottom: '12px' }}></i>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f4f4f5', marginBottom: '6px' }}>
            {mediaAssets.length === 0
              ? 'No directly uploaded files yet'
              : 'No uploaded files match your current filters'}
          </div>
          <p style={{ margin: '0 auto 16px', maxWidth: '460px', fontSize: '0.85rem' }}>
            Use the uploader above to select images or PDFs from your laptop or phone. Existing Google Drive files continue working automatically across your portfolio.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '36px',
          }}
        >
          {filteredAssets.map((asset) => {
            const isImg = asset.mimeType.startsWith('image/');
            const isPdf = asset.mimeType === 'application/pdf';

            return (
              <div
                key={asset.id}
                style={{
                  backgroundColor: '#121214',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Preview Thumbnail */}
                <div
                  onClick={() => setPreviewItem({ kind: 'cloudinary', asset })}
                  style={{
                    height: '155px',
                    backgroundColor: '#09090b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  {isImg ? (
                    <img
                      src={asset.downloadUrl}
                      alt={asset.name}
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <i
                        className={isPdf ? 'fas fa-file-pdf' : 'fas fa-file-alt'}
                        style={{ fontSize: '42px', color: isPdf ? '#ef4444' : '#60a5fa' }}
                      ></i>
                      <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '6px' }}>
                        {isPdf ? 'PDF Document' : asset.mimeType}
                      </div>
                    </div>
                  )}

                  {/* Top-left Status Badge */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor:
                        asset.status === 'published'
                          ? 'rgba(16, 185, 129, 0.9)'
                          : 'rgba(245, 158, 11, 0.9)',
                      color: '#fff',
                    }}
                  >
                    {asset.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
                  </span>

                  {/* Top-right Preview Icon */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewItem({ kind: 'cloudinary', asset });
                    }}
                    title="Preview file"
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      padding: '5px 9px',
                      backgroundColor: 'rgba(9, 9, 11, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                </div>

                {/* Card Metadata & Actions */}
                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div
                      title={asset.name}
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: '#f4f4f5',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {asset.name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.76rem',
                        color: '#a1a1aa',
                        marginTop: '4px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span title={asset.publicId ? `Cloudinary ID: ${asset.publicId}` : undefined}>
                        {asset.category} •{' '}
                        {isCloudinaryUrl(asset.downloadUrl) ||
                        isCloudinaryPdfBridgeUrl(asset.downloadUrl) ||
                        isCloudinaryUrl(asset.cloudinaryUrl)
                          ? 'Cloudinary'
                          : 'External'}
                      </span>
                      <span>
                        {formatFileSize(asset.sizeBytes)} • {isPdf ? 'PDF' : isImg ? 'Image' : 'File'}
                      </span>
                    </div>
                  </div>

                  {/* Primary Action: Copy Media Link */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(asset.downloadUrl, `url-${asset.id}`)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      backgroundColor:
                        copiedId === `url-${asset.id}` ? 'rgba(16, 185, 129, 0.18)' : '#18181b',
                      border: '1px solid',
                      borderColor: copiedId === `url-${asset.id}` ? '#10b981' : '#3f3f46',
                      borderRadius: '7px',
                      color: copiedId === `url-${asset.id}` ? '#34d399' : '#e4e4e7',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <i className={copiedId === `url-${asset.id}` ? 'fas fa-check' : 'fas fa-link'}></i>
                    <span>{copiedId === `url-${asset.id}` ? 'Media Link Copied!' : 'Copy Media Link'}</span>
                  </button>

                  {/* Secondary Actions Row: Preview, Publish/Draft, Replace, Delete */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleAssetStatus(asset)}
                      disabled={updatingStatusId === asset.id}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        color: asset.status === 'published' ? '#fbbf24' : '#34d399',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {updatingStatusId === asset.id
                        ? '...'
                        : asset.status === 'published'
                        ? 'Unpublish'
                        : 'Publish'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerReplace(asset)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        color: '#60a5fa',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Replace
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(asset)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '6px',
                        color: '#f87171',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy Google Drive Media Section (Preserved & Collapsible) */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setShowLegacyDrive((prev) => !prev)}
          style={{
            width: '100%',
            padding: '16px 20px',
            backgroundColor: '#121214',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#d4d4d8',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fab fa-google-drive" style={{ color: '#60a5fa', fontSize: '16px' }}></i>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>
                Legacy Google Drive Media Browser (Existing Drive Assets)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                Optional tool to view previously linked Google Drive files. All existing Drive links in your portfolio remain active.
              </div>
            </div>
          </div>
          <i className={`fas fa-chevron-${showLegacyDrive ? 'up' : 'down'}`} style={{ color: '#71717a' }}></i>
        </button>

        {showLegacyDrive && (
          <div style={{ padding: '20px', borderTop: '1px solid #27272a' }}>
            {!driveToken ? (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <p style={{ color: '#a1a1aa', fontSize: '0.86rem', marginBottom: '14px' }}>
                  Connect your Google Drive only if you need to look up a legacy Drive file ID. For all new uploads, use the Cloudinary uploader at the top of this page.
                </p>
                <button
                  type="button"
                  onClick={() => connectGoogleDrive()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fab fa-google-drive"></i>
                  <span>Connect Legacy Google Drive</span>
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                  <input
                    type="text"
                    placeholder="Search legacy Drive files..."
                    value={driveSearchQuery}
                    onChange={(e) => setDriveSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '8px 12px',
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fetchLegacyDriveFiles(driveSearchQuery)}
                    disabled={driveLoading}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Search Drive
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenLegacyPicker}
                    disabled={driveLoading}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#2563eb',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open Google Picker
                  </button>
                </div>

                {driveError && (
                  <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '12px' }}>
                    {driveError}
                  </div>
                )}

                {driveLoading ? (
                  <div style={{ color: '#a1a1aa', fontSize: '0.85rem', padding: '16px 0' }}>
                    Loading Drive files...
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div style={{ color: '#71717a', fontSize: '0.85rem', padding: '12px 0' }}>
                    No legacy Drive files selected in this session.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        style={{
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: '#f4f4f5',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.name}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewItem({ kind: 'drive', file })}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              backgroundColor: '#27272a',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(file.webViewLink, `drive-${file.id}`)}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              backgroundColor: '#27272a',
                              border: 'none',
                              borderRadius: '6px',
                              color: copiedId === `drive-${file.id}` ? '#34d399' : '#60a5fa',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {copiedId === `drive-${file.id}` ? 'Copied!' : 'Copy Link'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal (Images & PDFs) */}
      {previewItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setPreviewItem(null)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              borderRadius: '14px',
              border: '1px solid #27272a',
              width: '100%',
              maxWidth: '880px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #27272a',
              }}
            >
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '1rem' }}>
                {previewItem.kind === 'cloudinary' ? previewItem.asset.name : previewItem.file.name}
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a1a1aa',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: '420px',
                backgroundColor: '#09090b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {previewItem.kind === 'cloudinary' ? (
                previewItem.asset.mimeType.startsWith('image/') ? (
                  <img
                    src={previewItem.asset.downloadUrl}
                    alt={previewItem.asset.name}
                    referrerPolicy="no-referrer"
                    style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                  />
                ) : (
                  <iframe
                    src={resolvePlayablePdfUrl(previewItem.asset.downloadUrl, {
                      directPdfAllowed: cloudinaryStatus?.directPdfAllowed ?? null,
                      cloudinaryUrl: previewItem.asset.cloudinaryUrl,
                      fileName: previewItem.asset.name,
                      download: false,
                    })}
                    title={previewItem.asset.name}
                    style={{ width: '100%', height: '65vh', border: 'none', backgroundColor: '#fff' }}
                  />
                )
              ) : previewItem.file.mimeType.startsWith('image/') ? (
                <img
                  src={`https://drive.google.com/thumbnail?id=${previewItem.file.id}&sz=w1200`}
                  alt={previewItem.file.name}
                  referrerPolicy="no-referrer"
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              ) : (
                <iframe
                  src={`https://drive.google.com/file/d/${previewItem.file.id}/preview`}
                  title={previewItem.file.name}
                  style={{ width: '100%', height: '65vh', border: 'none' }}
                />
              )}
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #27272a',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <a
                href={
                  previewItem.kind === 'cloudinary'
                    ? previewItem.asset.mimeType === 'application/pdf'
                      ? resolvePlayablePdfUrl(previewItem.asset.downloadUrl, {
                          directPdfAllowed: cloudinaryStatus?.directPdfAllowed ?? null,
                          cloudinaryUrl: previewItem.asset.cloudinaryUrl,
                          fileName: previewItem.asset.name,
                          download: true,
                        })
                      : getDocumentDownloadUrl(previewItem.asset.downloadUrl)
                    : getDocumentDownloadUrl(previewItem.file.webViewLink)
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '6px',
                  color: '#d4d4d8',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                }}
              >
                <i className="fas fa-download"></i>
                <span>Download</span>
              </a>
              <a
                href={
                  previewItem.kind === 'cloudinary'
                    ? previewItem.asset.mimeType === 'application/pdf'
                      ? resolvePlayablePdfUrl(previewItem.asset.downloadUrl, {
                          directPdfAllowed: cloudinaryStatus?.directPdfAllowed ?? null,
                          cloudinaryUrl: previewItem.asset.cloudinaryUrl,
                          fileName: previewItem.asset.name,
                          download: false,
                        })
                      : previewItem.asset.downloadUrl
                    : previewItem.file.webViewLink
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#27272a',
                  borderRadius: '6px',
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                }}
              >
                <i className="fas fa-external-link-alt"></i>
                <span>Open in New Tab</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace File Confirmation & Progress Modal */}
      {replaceTarget && replaceFile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #3b82f6',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              color: '#fff',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 700 }}>
              Replace Media File
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem', color: '#a1a1aa', lineHeight: 1.5 }}>
              Replacing <strong style={{ color: '#fff' }}>{replaceTarget.name}</strong> with your newly selected file will update the storage object and download URL.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#121214',
                border: '1px solid #27272a',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '16px',
              }}
            >
              {replacePreviewUrl ? (
                <img
                  src={replacePreviewUrl}
                  alt="Replacement preview"
                  style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }}
                />
              ) : (
                <i className="fas fa-file-pdf" style={{ fontSize: '28px', color: '#ef4444' }}></i>
              )}
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#fff', wordBreak: 'break-all' }}>
                  {replaceFile.name}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#a1a1aa' }}>
                  {formatFileSize(replaceFile.size)} • {replaceTarget.category}
                </div>
              </div>
            </div>

            {replacing && replaceProgress && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#93c5fd', marginBottom: '4px' }}>
                  <span>Uploading replacement...</span>
                  <span>{replaceProgress.progress}%</span>
                </div>
                <div style={{ width: '100%', height: '7px', backgroundColor: '#27272a', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${replaceProgress.progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #2563eb, #34d399)',
                    }}
                  />
                </div>
              </div>
            )}

            {replaceError && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  marginBottom: '14px',
                }}
              >
                {replaceError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={closeReplaceModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#27272a',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#d4d4d8',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReplace}
                disabled={replacing}
                style={{
                  padding: '8px 18px',
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: replacing ? 'not-allowed' : 'pointer',
                }}
              >
                {replacing ? 'Replacing...' : 'Confirm Replace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Confirmation Modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #ef4444',
              borderRadius: '16px',
              padding: '26px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '2.2rem', color: '#ef4444', marginBottom: '12px' }}></i>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.18rem' }}>Delete Media File?</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.88rem', marginBottom: '22px', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong style={{ color: '#fff' }}>{deleteTarget.name}</strong> ({formatFileSize(deleteTarget.sizeBytes)}) from Cloudinary and your media library?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#d4d4d8',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
