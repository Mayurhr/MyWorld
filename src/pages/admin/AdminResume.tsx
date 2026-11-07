import React, { useState, useEffect, useRef } from 'react';
import {
  getResume,
  saveResume,
  ResumeData,
  ResumeHistoryEntry,
} from '../../services/portfolioService';
import { GoogleDrivePickerModal } from '../../components/admin/GoogleDrivePickerModal';
import { DeviceMediaUploader } from '../../components/admin/DeviceMediaUploader';
import {
  getCloudinaryDownloadUrl,
  getGoogleDriveFileId,
  getPublicCloudinaryStatus,
  isCloudinaryPdfBridgeUrl,
  isCloudinaryUrl,
  resolvePlayablePdfUrl,
} from '../../utils/drive';
import {
  MediaAsset,
  deleteCloudinaryFileByPublicId,
  formatFileSize,
  getAcceptAttribute,
  publishMediaAssetByPublicId,
  uploadMediaFile,
} from '../../services/mediaStorageService';

export const AdminResume: React.FC = () => {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState<boolean>(false);
  const [directPdfAllowed, setDirectPdfAllowed] = useState<boolean | null>(null);

  // History management states
  const [previewHistoryEntry, setPreviewHistoryEntry] = useState<ResumeHistoryEntry | null>(null);
  const [deleteHistoryTarget, setDeleteHistoryTarget] = useState<ResumeHistoryEntry | null>(null);
  const [deletingHistory, setDeletingHistory] = useState<boolean>(false);

  // Replace specific history record PDF
  const historyReplaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingHistoryId, setReplacingHistoryId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [data, cldStatus] = await Promise.all([
          getResume(true),
          getPublicCloudinaryStatus().catch(() => null),
        ]);
        setResume(data);
        if (cldStatus && typeof cldStatus.directPdfAllowed === 'boolean') {
          setDirectPdfAllowed(cldStatus.directPdfAllowed);
        } else if (typeof data.directPdfDelivery === 'boolean') {
          setDirectPdfAllowed(data.directPdfDelivery);
        }
      } catch (err) {
        console.error('Failed to load resume:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const buildArchiveIfChanged = (
    current: ResumeData,
    nextUrl: string
  ): ResumeHistoryEntry[] => {
    const existingHistory = Array.isArray(current.history) ? [...current.history] : [];
    if (
      !current.resumePdfUrl ||
      current.resumePdfUrl === nextUrl ||
      (current.cloudinaryUrl && current.cloudinaryUrl === nextUrl)
    ) {
      return existingHistory;
    }
    const alreadySaved = existingHistory.some(
      (h) =>
        h.resumePdfUrl === current.resumePdfUrl ||
        Boolean(current.cloudinaryUrl && h.cloudinaryUrl === current.cloudinaryUrl)
    );
    if (alreadySaved) {
      return existingHistory;
    }

    const prevPublicId = current.publicId || current.storagePath;
    const source: ResumeHistoryEntry['source'] =
      prevPublicId ||
      isCloudinaryUrl(current.resumePdfUrl) ||
      isCloudinaryPdfBridgeUrl(current.resumePdfUrl) ||
      isCloudinaryUrl(current.cloudinaryUrl)
        ? 'cloudinary'
        : current.resumePdfUrl.includes('drive.google.com')
        ? 'drive'
        : 'url';

    const archived: ResumeHistoryEntry = {
      id: `res_hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fileName:
        current.fileName ||
        (source === 'drive' ? 'Previous Resume (Google Drive)' : 'Previous Resume PDF'),
      resumePdfUrl: current.resumePdfUrl,
      downloadUrl: current.downloadUrl || current.resumePdfUrl,
      ...(current.cloudinaryUrl ? { cloudinaryUrl: current.cloudinaryUrl } : {}),
      ...(current.publicId ? { publicId: current.publicId } : {}),
      ...(current.cloudinaryResourceType
        ? { cloudinaryResourceType: current.cloudinaryResourceType }
        : {}),
      ...(typeof current.directPdfDelivery === 'boolean'
        ? { directPdfDelivery: current.directPdfDelivery }
        : {}),
      ...(current.storagePath ? { storagePath: current.storagePath } : {}),
      ...(typeof current.sizeBytes === 'number' ? { sizeBytes: current.sizeBytes } : {}),
      source,
      savedAt: current.updatedAt || new Date().toISOString(),
    };

    return [archived, ...existingHistory].slice(0, 25);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume) return;

    try {
      setIsSaving(true);
      setSaveSuccess(null);
      setActionError(null);
      const saved = await saveResume(resume);
      const activePubId = saved.publicId || saved.storagePath;
      if (saved.status === 'published' && activePubId) {
        await publishMediaAssetByPublicId(activePubId);
      }
      setResume(saved);
      setSaveSuccess('Resume configuration saved and updated on the portfolio.');
      setTimeout(() => setSaveSuccess(null), 4500);
    } catch (err: any) {
      setActionError(`Failed to save resume: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeviceResumeUploaded = async (asset: MediaAsset) => {
    if (!resume) return;

    const viewUrl = asset.publicViewUrl || asset.downloadUrl;
    const downloadUrl = asset.publicDownloadUrl || getCloudinaryDownloadUrl(viewUrl);
    const nextHistory = buildArchiveIfChanged(resume, viewUrl);

    if (typeof asset.directPdfDelivery === 'boolean') {
      setDirectPdfAllowed(asset.directPdfDelivery);
    }

    const nextResume: ResumeData = {
      ...resume,
      resumePdfUrl: viewUrl,
      downloadUrl,
      cloudinaryUrl: asset.cloudinaryUrl || asset.downloadUrl,
      ...(typeof asset.directPdfDelivery === 'boolean'
        ? { directPdfDelivery: asset.directPdfDelivery }
        : {}),
      fileName: asset.name,
      publicId: asset.publicId,
      cloudinaryResourceType: asset.cloudinaryResourceType || 'image',
      storagePath: asset.publicId,
      sizeBytes: asset.sizeBytes,
      history: nextHistory,
    };

    try {
      setIsSaving(true);
      setActionError(null);
      const saved = await saveResume(nextResume);
      const activePubId = saved.publicId || saved.storagePath || asset.publicId;
      if (saved.status === 'published' && activePubId) {
        await publishMediaAssetByPublicId(activePubId);
      }
      setResume(saved);

      // Verify the PDF route responds with HTTP 200 before displaying success message (Requirement 9)
      const testPreviewUrl = resolvePlayablePdfUrl(saved.resumePdfUrl, {
        directPdfAllowed: asset.directPdfDelivery,
        cloudinaryUrl: saved.cloudinaryUrl,
        fileName: saved.fileName,
        download: false,
        forIframeEmbed: false,
      });

      let verifyOk = false;
      try {
        const verifyCheck = await fetch(testPreviewUrl, { method: 'HEAD', credentials: 'include' });
        verifyOk = verifyCheck.ok;
      } catch {
        verifyOk = false;
      }

      if (verifyOk) {
        setSaveSuccess(
          `Uploaded "${asset.name}" to Cloudinary and verified active PDF preview! The live resume preview below is ready.`
        );
        setTimeout(() => setSaveSuccess(null), 6000);
      } else {
        setSaveSuccess(
          `Uploaded "${asset.name}" to Cloudinary and saved resume record. Loading active preview below...`
        );
        setTimeout(() => setSaveSuccess(null), 6000);
      }
    } catch (err: any) {
      setResume(nextResume);
      setActionError(err?.message || 'Uploaded PDF, but failed saving resume configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleActiveResumeDeleted = async () => {
    if (!resume) return;
    const history = Array.isArray(resume.history) ? [...resume.history] : [];
    const fallback = history.shift();

    const nextResume: ResumeData = fallback
      ? {
          ...resume,
          resumePdfUrl: fallback.resumePdfUrl,
          downloadUrl: fallback.downloadUrl,
          cloudinaryUrl: fallback.cloudinaryUrl,
          directPdfDelivery: fallback.directPdfDelivery,
          fileName: fallback.fileName,
          publicId: fallback.publicId,
          cloudinaryResourceType: fallback.cloudinaryResourceType,
          storagePath: fallback.storagePath,
          sizeBytes: fallback.sizeBytes,
          history,
        }
      : {
          ...resume,
          resumePdfUrl: 'https://drive.google.com/file/d/1mQIj4WNOSE7aTStKP8wON80vGggYgZeY/preview',
          downloadUrl: 'https://drive.google.com/uc?export=download&id=1mQIj4WNOSE7aTStKP8wON80vGggYgZeY',
          cloudinaryUrl: undefined,
          directPdfDelivery: undefined,
          fileName: 'Default Resume (Google Drive)',
          publicId: undefined,
          cloudinaryResourceType: undefined,
          storagePath: undefined,
          sizeBytes: undefined,
          history: [],
        };

    try {
      const saved = await saveResume(nextResume);
      setResume(saved);
      setSaveSuccess('Active uploaded resume deleted and reverted to previous preserved resume.');
    } catch (err: any) {
      setResume(nextResume);
      setActionError(err?.message || 'Deleted storage file, failed updating resume record.');
    }
  };

  const handleRestoreHistoryEntry = async (entry: ResumeHistoryEntry) => {
    if (!resume) return;
    try {
      setIsSaving(true);
      setActionError(null);
      const remaining = (resume.history || []).filter((h) => h.id !== entry.id);
      const archiveCurrent = buildArchiveIfChanged(
        { ...resume, history: remaining },
        entry.resumePdfUrl
      );

      const nextResume: ResumeData = {
        ...resume,
        resumePdfUrl: entry.resumePdfUrl,
        downloadUrl: entry.downloadUrl || entry.resumePdfUrl,
        cloudinaryUrl: entry.cloudinaryUrl,
        directPdfDelivery: entry.directPdfDelivery,
        fileName: entry.fileName,
        publicId: entry.publicId,
        cloudinaryResourceType: entry.cloudinaryResourceType,
        storagePath: entry.storagePath,
        sizeBytes: entry.sizeBytes,
        history: archiveCurrent,
      };

      const saved = await saveResume(nextResume);
      const activePubId = saved.publicId || saved.storagePath;
      if (saved.status === 'published' && activePubId) {
        await publishMediaAssetByPublicId(activePubId);
      }
      setResume(saved);
      setSaveSuccess(`Restored "${entry.fileName}" as the active portfolio resume.`);
      setTimeout(() => setSaveSuccess(null), 4500);
    } catch (err: any) {
      setActionError(err?.message || 'Failed restoring resume record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerReplaceHistory = (entry: ResumeHistoryEntry) => {
    setReplacingHistoryId(entry.id);
    setActionError(null);
    setTimeout(() => {
      historyReplaceInputRef.current?.click();
    }, 0);
  };

  const handleHistoryReplacementFilePicked = async (file?: File) => {
    if (!file || !resume || !replacingHistoryId) return;
    const targetEntry = (resume.history || []).find((h) => h.id === replacingHistoryId);
    if (!targetEntry) return;

    try {
      setIsSaving(true);
      setActionError(null);

      const uploaded = await uploadMediaFile({
        file,
        category: 'Resume',
        acceptKind: 'pdf',
        publishImmediately: resume.status === 'published',
      });

      const prevPubId = targetEntry.publicId || targetEntry.storagePath;
      if (
        prevPubId &&
        (isCloudinaryUrl(targetEntry.resumePdfUrl) ||
          isCloudinaryPdfBridgeUrl(targetEntry.resumePdfUrl) ||
          isCloudinaryUrl(targetEntry.cloudinaryUrl) ||
          targetEntry.source === 'cloudinary') &&
        (prevPubId !== uploaded.publicId ||
          (targetEntry.cloudinaryResourceType &&
            uploaded.cloudinaryResourceType !== targetEntry.cloudinaryResourceType))
      ) {
        await deleteCloudinaryFileByPublicId(
          prevPubId,
          targetEntry.cloudinaryResourceType
        ).catch(() => {});
      }

      const viewUrl = uploaded.publicViewUrl || uploaded.downloadUrl;
      const downloadUrl = uploaded.publicDownloadUrl || getCloudinaryDownloadUrl(viewUrl);
      const updatedHistory = (resume.history || []).map((h) =>
        h.id === replacingHistoryId
          ? {
              ...h,
              fileName: uploaded.name,
              resumePdfUrl: viewUrl,
              downloadUrl,
              cloudinaryUrl: uploaded.cloudinaryUrl || uploaded.downloadUrl,
              publicId: uploaded.publicId,
              cloudinaryResourceType: uploaded.cloudinaryResourceType || ('image' as const),
              ...(typeof uploaded.directPdfDelivery === 'boolean'
                ? { directPdfDelivery: uploaded.directPdfDelivery }
                : {}),
              storagePath: uploaded.publicId,
              sizeBytes: uploaded.sizeBytes,
              source: 'cloudinary' as const,
              savedAt: new Date().toISOString(),
            }
          : h
      );

      const saved = await saveResume({
        ...resume,
        history: updatedHistory,
      });

      setResume(saved);
      setSaveSuccess(`Replaced archived resume record with "${uploaded.name}".`);
      setTimeout(() => setSaveSuccess(null), 4500);
    } catch (err: any) {
      setActionError(err?.message || 'Failed replacing archived resume PDF.');
    } finally {
      setIsSaving(false);
      setReplacingHistoryId(null);
      if (historyReplaceInputRef.current) {
        historyReplaceInputRef.current.value = '';
      }
    }
  };

  const handleConfirmDeleteHistory = async () => {
    if (!resume || !deleteHistoryTarget) return;
    try {
      setDeletingHistory(true);
      setActionError(null);

      const targetPubId = deleteHistoryTarget.publicId || deleteHistoryTarget.storagePath;
      if (
        targetPubId &&
        (isCloudinaryUrl(deleteHistoryTarget.resumePdfUrl) ||
          isCloudinaryPdfBridgeUrl(deleteHistoryTarget.resumePdfUrl) ||
          isCloudinaryUrl(deleteHistoryTarget.cloudinaryUrl) ||
          deleteHistoryTarget.source === 'cloudinary')
      ) {
        await deleteCloudinaryFileByPublicId(
          targetPubId,
          deleteHistoryTarget.cloudinaryResourceType
        ).catch(() => {});
      }

      const nextHistory = (resume.history || []).filter((h) => h.id !== deleteHistoryTarget.id);
      const saved = await saveResume({
        ...resume,
        history: nextHistory,
      });

      setResume(saved);
      setSaveSuccess(`Deleted previous resume record "${deleteHistoryTarget.fileName}".`);
      setDeleteHistoryTarget(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed deleting previous resume record.');
    } finally {
      setDeletingHistory(false);
    }
  };

  const handleDriveSelect = (file: { id: string; name: string; url: string }) => {
    if (!resume) return;
    const fileId = file.id || getGoogleDriveFileId(file.url);
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const nextHistory = buildArchiveIfChanged(resume, previewUrl);
    setResume({
      ...resume,
      resumePdfUrl: previewUrl,
      downloadUrl,
      cloudinaryUrl: undefined,
      directPdfDelivery: undefined,
      fileName: file.name,
      publicId: undefined,
      cloudinaryResourceType: undefined,
      storagePath: undefined,
      sizeBytes: undefined,
      history: nextHistory,
    });
  };

  if (loading || !resume) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px' }}></i>
        <p>Loading resume settings...</p>
      </div>
    );
  }

  const historyList = Array.isArray(resume.history) ? resume.history : [];
  const activeIsCloudinary = Boolean(
    resume.publicId ||
      resume.storagePath ||
      isCloudinaryUrl(resume.resumePdfUrl) ||
      isCloudinaryPdfBridgeUrl(resume.resumePdfUrl) ||
      isCloudinaryUrl(resume.cloudinaryUrl)
  );
  const resolvedActivePreviewUrl = resolvePlayablePdfUrl(resume.resumePdfUrl, {
    directPdfAllowed,
    cloudinaryUrl: resume.cloudinaryUrl,
    fileName: resume.fileName,
    download: false,
    forIframeEmbed: true,
  });
  const resolvedActiveViewTabUrl = resolvePlayablePdfUrl(resume.resumePdfUrl, {
    directPdfAllowed,
    cloudinaryUrl: resume.cloudinaryUrl,
    fileName: resume.fileName,
    download: false,
    forIframeEmbed: false,
  });
  const resolvedHistoryPreviewUrl = previewHistoryEntry
    ? resolvePlayablePdfUrl(previewHistoryEntry.resumePdfUrl, {
        directPdfAllowed,
        cloudinaryUrl: previewHistoryEntry.cloudinaryUrl,
        fileName: previewHistoryEntry.fileName,
        download: false,
        forIframeEmbed: true,
      })
    : '';

  return (
    <div style={{ maxWidth: '940px', margin: '0 auto' }}>
      <input
        ref={historyReplaceInputRef}
        type="file"
        accept={getAcceptAttribute('pdf')}
        style={{ display: 'none' }}
        onChange={(e) => handleHistoryReplacementFilePicked(e.target.files?.[0])}
      />

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
          Resume Document Management
        </h1>
        <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
          Upload a new PDF resume directly from your device to update the portfolio Resume button while keeping previous resume records preserved.
        </p>
      </div>

      {saveSuccess && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            color: '#6ee7b7',
            fontSize: '0.9rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fas fa-check-circle"></i>
          <span>{saveSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#fca5a5',
            fontSize: '0.88rem',
            marginBottom: '20px',
          }}
        >
          <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
          {actionError}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Direct PDF Upload Card */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                Upload New Resume PDF (Cloudinary)
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
                Select a PDF from your laptop or phone. Uploading updates the active Resume URL and automatically archives the previous resume record below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDrivePickerOpen(true)}
              style={{
                padding: '6px 14px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                color: '#a1a1aa',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="fab fa-google-drive"></i>
              <span>Legacy Drive Picker</span>
            </button>
          </div>

          <DeviceMediaUploader
            category="Resume"
            acceptKind="pdf"
            currentUrl={resume.resumePdfUrl}
            currentPublicId={resume.publicId || resume.storagePath}
            currentResourceType={resume.cloudinaryResourceType}
            preservePreviousOnReplace={true}
            defaultPublishImmediately={true}
            label="Select Resume PDF from Laptop / Phone"
            helperText="PDF files up to 10 MB. Stored persistently in Cloudinary."
            onUploaded={handleDeviceResumeUploaded}
            onDeleted={handleActiveResumeDeleted}
          />

          {activeIsCloudinary && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor:
                  directPdfAllowed === true
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(59, 130, 246, 0.1)',
                border:
                  directPdfAllowed === true
                    ? '1px solid rgba(16, 185, 129, 0.28)'
                    : '1px solid rgba(59, 130, 246, 0.28)',
                borderRadius: '10px',
                fontSize: '0.78rem',
                color: directPdfAllowed === true ? '#a7f3d0' : '#bfdbfe',
                lineHeight: 1.5,
              }}
            >
              {directPdfAllowed === true ? (
                <>
                  <strong style={{ color: '#34d399' }}>Direct Cloudinary CDN PDF Delivery Verified:</strong>{' '}
                  Public PDF access is verified directly via Cloudinary CDN URLs.
                </>
              ) : (
                <>
                  <strong style={{ color: '#93c5fd' }}>
                    Public PDF Delivery Active (Protected Server Bridge):
                  </strong>{' '}
                  Your Cloudinary account restricts anonymous direct CDN PDF access (
                  <code>401 Transformation /pdf is not allowed</code>), so portfolio visitors automatically receive and preview this PDF at{' '}
                  <code>HTTP 200</code> via the server bridge without logging in or exposing your API secret. To also allow direct{' '}
                  <code>res.cloudinary.com/*.pdf</code> URLs, enable{' '}
                  <strong>Settings &rarr; Security &rarr; &ldquo;Allow delivery of PDF and ZIP files&rdquo;</strong> in your Cloudinary Dashboard.
                </>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                Active Resume Label
              </label>
              <input
                type="text"
                value={resume.fileName || ''}
                onChange={(e) => setResume({ ...resume, fileName: e.target.value })}
                placeholder="e.g., Mayur_HR_Resume_2026.pdf"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                Publishing Status
              </label>
              <select
                value={resume.status}
                onChange={(e) => setResume({ ...resume, status: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="published">Published (Visible via Portfolio Resume Button)</option>
                <option value="draft">Hidden / Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
              Active Resume Preview URL
            </label>
            <input
              type="text"
              required
              value={resume.resumePdfUrl}
              onChange={(e) => setResume({ ...resume, resumePdfUrl: e.target.value })}
              placeholder="https://res.cloudinary.com/... or https://drive.google.com/..."
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fff',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
              Direct Download URL
            </label>
            <input
              type="text"
              required
              value={resume.downloadUrl}
              onChange={(e) => setResume({ ...resume, downloadUrl: e.target.value })}
              placeholder="https://res.cloudinary.com/... or https://drive.google.com/..."
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fff',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              }}
            >
              {isSaving ? 'Saving Resume...' : 'Save Resume Settings'}
            </button>
          </div>
        </div>

        {/* Preserved Previous Resume Records */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>
                Previous Resume Records ({historyList.length})
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
                Previous resumes (including legacy Google Drive versions) are preserved here unless you explicitly replace or delete them.
              </p>
            </div>
          </div>

          {historyList.length === 0 ? (
            <div
              style={{
                backgroundColor: '#18181b',
                border: '1px dashed #27272a',
                borderRadius: '10px',
                padding: '20px',
                textAlign: 'center',
                color: '#71717a',
                fontSize: '0.84rem',
              }}
            >
              No previous resume versions archived yet. When you upload a new PDF resume above, your previous resume record will automatically appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyList.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.14)',
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        flexShrink: 0,
                      }}
                    >
                      <i className="fas fa-file-pdf"></i>
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.fileName}
                      </div>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: '#a1a1aa',
                          marginTop: '2px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {entry.source === 'cloudinary'
                          ? 'Cloudinary'
                          : entry.source === 'firebase'
                          ? 'Cloud Storage'
                          : entry.source === 'drive'
                          ? 'Google Drive'
                          : 'External URL'}{' '}
                        {typeof entry.sizeBytes === 'number' ? `• ${formatFileSize(entry.sizeBytes)}` : ''}
                        {' • Saved '}
                        {new Date(entry.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewHistoryEntry(entry)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#121214',
                        border: '1px solid #3f3f46',
                        borderRadius: '7px',
                        color: '#d4d4d8',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreHistoryEntry(entry)}
                      disabled={isSaving}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '7px',
                        color: '#60a5fa',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Set Active
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerReplaceHistory(entry)}
                      disabled={isSaving}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#121214',
                        border: '1px solid #3f3f46',
                        borderRadius: '7px',
                        color: '#fbbf24',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteHistoryTarget(entry)}
                      disabled={isSaving}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '7px',
                        color: '#f87171',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                      title="Delete archived resume record"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Active Resume Preview Box */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
              Live Active Resume Preview
            </h3>
            <a
              href={resolvedActiveViewTabUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                color: '#60a5fa',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              <i className="fas fa-external-link-alt"></i>
              <span>Open PDF in New Tab</span>
            </a>
          </div>

          <div style={{ height: '560px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #27272a', backgroundColor: '#09090b' }}>
            <iframe
              key={resolvedActivePreviewUrl}
              src={resolvedActivePreviewUrl}
              title="Resume Preview"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      </form>

      {/* Legacy Google Drive Picker */}
      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        filterMime="pdf"
        title="Select Resume PDF from Google Drive"
        onSelectFile={handleDriveSelect}
      />

      {/* Archived Resume Preview Modal */}
      {previewHistoryEntry && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setPreviewHistoryEntry(null)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              borderRadius: '14px',
              border: '1px solid #27272a',
              width: '100%',
              maxWidth: '850px',
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
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #27272a',
              }}
            >
              <div style={{ fontWeight: 600, color: '#fff' }}>{previewHistoryEntry.fileName}</div>
              <button
                type="button"
                onClick={() => setPreviewHistoryEntry(null)}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <iframe
              src={resolvedHistoryPreviewUrl}
              title={previewHistoryEntry.fileName}
              style={{ width: '100%', height: '70vh', border: 'none', backgroundColor: '#fff' }}
            />
          </div>
        </div>
      )}

      {/* Confirm Delete Archived Resume Modal */}
      {deleteHistoryTarget && (
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
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem' }}>Delete Previous Resume Record?</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.88rem', marginBottom: '22px', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong style={{ color: '#fff' }}>{deleteHistoryTarget.fileName}</strong> from your preserved resume records?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeleteHistoryTarget(null)}
                disabled={deletingHistory}
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
                onClick={handleConfirmDeleteHistory}
                disabled={deletingHistory}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: deletingHistory ? 'not-allowed' : 'pointer',
                }}
              >
                {deletingHistory ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
