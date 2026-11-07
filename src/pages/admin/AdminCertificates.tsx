import React, { useState, useEffect, useMemo } from 'react';
import {
  getCertificates,
  saveCertificate,
  deleteCertificate,
  CertificateItem,
} from '../../services/portfolioService';
import { GoogleDrivePickerModal } from '../../components/admin/GoogleDrivePickerModal';
import { DeviceMediaUploader } from '../../components/admin/DeviceMediaUploader';
import { DriveImage } from '../../components/DriveImage';
import { FullscreenImageModal } from '../../components/FullscreenImageModal';
import { PdfModal } from '../../components/PdfModal';
import { isPdfCertificate } from '../../utils/drive';
import { publishMediaAssetByPublicId } from '../../services/mediaStorageService';

export const AdminCertificates: React.FC = () => {
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

  // Modal form states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingCert, setEditingCert] = useState<Partial<CertificateItem> | null>(null);
  const [eventPhotoInput, setEventPhotoInput] = useState<string>('');
  const [uploadedEventPhotoPaths, setUploadedEventPhotoPaths] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Drive Picker modal state
  const [drivePickerState, setDrivePickerState] = useState<{
    isOpen: boolean;
    target: 'certificate' | 'eventPhoto';
  }>({
    isOpen: false,
    target: 'certificate',
  });

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<CertificateItem | null>(null);

  // Preview modals
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);

  const loadAllCertificates = async () => {
    try {
      setLoading(true);
      const list = await getCertificates(true); // include drafts
      setCertificates(list);
    } catch (err) {
      console.error('Error loading certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCertificates();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    certificates.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [certificates]);

  const handleOpenAdd = () => {
    setEditingCert({
      title: '',
      issuer: '',
      year: new Date().getFullYear().toString(),
      category: 'Activity',
      featured: false,
      viewAchievement: false,
      driveLink: '',
      status: 'published',
      order: certificates.length + 1,
      achievement: {
        experience: '',
        eventPhotos: [],
        github: '',
        presentation: '',
        demoVideo: '',
      },
    });
    setEventPhotoInput('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cert: CertificateItem) => {
    setEditingCert({
      ...cert,
      achievement: cert.achievement
        ? {
            ...cert.achievement,
            eventPhotos: cert.achievement.eventPhotos || [],
          }
        : {
            experience: '',
            eventPhotos: [],
            github: '',
            presentation: '',
            demoVideo: '',
          },
    });
    setEventPhotoInput('');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCert || !editingCert.title?.trim()) {
      alert('Please provide a certificate title.');
      return;
    }

    try {
      setIsSaving(true);
      await saveCertificate(editingCert);
      if (editingCert.status === 'published') {
        const activePubId = editingCert.publicId || editingCert.storagePath;
        if (activePubId) {
          await publishMediaAssetByPublicId(activePubId);
        }
        const photos = editingCert.achievement?.eventPhotos || [];
        for (const pUrl of photos) {
          const path = uploadedEventPhotoPaths[pUrl];
          if (path) {
            await publishMediaAssetByPublicId(path);
          }
        }
      }
      setIsFormOpen(false);
      setEditingCert(null);
      await loadAllCertificates();
    } catch (err: any) {
      alert(`Failed to save certificate: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCertificate(deleteTarget.id);
      setDeleteTarget(null);
      await loadAllCertificates();
    } catch (err: any) {
      alert(`Failed to delete certificate: ${err.message}`);
    }
  };

  const handleTogglePublish = async (cert: CertificateItem) => {
    const nextStatus = cert.status === 'published' ? 'draft' : 'published';
    try {
      await saveCertificate({ ...cert, status: nextStatus });
      await loadAllCertificates();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleAddEventPhoto = (url: string) => {
    if (!url.trim() || !editingCert) return;
    const currentPhotos = editingCert.achievement?.eventPhotos || [];
    setEditingCert({
      ...editingCert,
      achievement: {
        ...editingCert.achievement,
        eventPhotos: [...currentPhotos, url.trim()],
      },
    });
    setEventPhotoInput('');
  };

  const handleRemoveEventPhoto = (photoUrl: string) => {
    if (!editingCert) return;
    const currentPhotos = editingCert.achievement?.eventPhotos || [];
    setEditingCert({
      ...editingCert,
      achievement: {
        ...editingCert.achievement,
        eventPhotos: currentPhotos.filter((p) => p !== photoUrl),
      },
    });
  };

  const filteredCertificates = certificates.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterCategory !== 'all' && c.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchIssuer = c.issuer.toLowerCase().includes(q);
      if (!matchTitle && !matchIssuer) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
            Certificate &amp; Achievement Management
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
            Manage all credentials, achievements, event photos, and Drive document links.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
          }}
        >
          <i className="fas fa-plus"></i>
          <span>Add New Certificate</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Search by title or issuer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 14px',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              padding: '8px 14px',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{
              padding: '8px 14px',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#a1a1aa' }}>
          Showing <strong>{filteredCertificates.length}</strong> of <strong>{certificates.length}</strong> records
        </div>
      </div>

      {/* Certificates List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px' }}></i>
          <p>Loading certificate collection...</p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '48px 20px',
            textAlign: 'center',
            color: '#a1a1aa',
          }}
        >
          <i className="fas fa-award" style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.5 }}></i>
          <p>No certificates found matching your search or filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredCertificates.map((c, idx) => (
            <div
              key={c.id || idx}
              style={{
                backgroundColor: '#121214',
                border: '1px solid #27272a',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '300px' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#18181b',
                    flexShrink: 0,
                  }}
                >
                  <DriveImage
                    driveUrl={c.driveLink}
                    alt={c.title}
                    className="certificate-thumb"
                    size={200}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 600, color: '#fff' }}>
                      {c.title}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#1f1f23',
                        color: '#60a5fa',
                        border: '1px solid #2e2e34',
                      }}
                    >
                      {c.category}
                    </span>
                    {c.featured && (
                      <span style={{ fontSize: '0.68rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                        ★ Featured
                      </span>
                    )}
                    {c.viewAchievement && (
                      <span style={{ fontSize: '0.68rem', color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                        🏆 Achievement ({c.achievement?.eventPhotos?.length || 0} photos)
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: c.status === 'published' ? '#34d399' : '#f59e0b',
                        background: c.status === 'published' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {c.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>
                    {c.issuer} • {c.year}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewCert(c)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#d4d4d8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="fas fa-eye"></i>
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePublish(c)}
                  title={c.status === 'published' ? 'Move to Draft' : 'Publish Certificate'}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: c.status === 'published' ? '#f59e0b' : '#34d399',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {c.status === 'published' ? 'Draft' : 'Publish'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(c)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#60a5fa',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="fas fa-edit"></i>
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(c)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                  title="Delete certificate"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Certificate Modal */}
      {isFormOpen && editingCert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px 28px',
              color: '#f4f4f5',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                {editingCert.id ? 'Edit Certificate' : 'Create New Certificate'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                  Certificate Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingCert.title || ''}
                  onChange={(e) => setEditingCert({ ...editingCert, title: e.target.value })}
                  placeholder="e.g., PYTHON PROGRAMMING BY VEDA TECHNOLOGY"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#121214',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                    Issuer
                  </label>
                  <input
                    type="text"
                    value={editingCert.issuer || ''}
                    onChange={(e) => setEditingCert({ ...editingCert, issuer: e.target.value })}
                    placeholder="e.g., Veda Technology"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                    Year
                  </label>
                  <input
                    type="text"
                    value={editingCert.year || ''}
                    onChange={(e) => setEditingCert({ ...editingCert, year: e.target.value })}
                    placeholder="e.g., 2026"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    value={editingCert.category || 'Activity'}
                    onChange={(e) => setEditingCert({ ...editingCert, category: e.target.value })}
                    placeholder="e.g., Hackathon, Activity, AI/ML"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Direct Device Upload for Certificate Document (Image or PDF) */}
              <DeviceMediaUploader
                category="Certificates"
                acceptKind="both"
                currentUrl={editingCert.driveLink}
                currentPublicId={editingCert.publicId || editingCert.storagePath}
                currentResourceType={editingCert.cloudinaryResourceType}
                defaultPublishImmediately={true}
                label="Upload Certificate Image or PDF from Laptop / Phone"
                helperText="Supports images (JPG, JPEG, PNG, WEBP) or PDF documents via Cloudinary. Existing Google Drive links stay intact."
                onUploaded={(asset) => {
                  setEditingCert({
                    ...editingCert,
                    driveLink: asset.publicViewUrl || asset.downloadUrl,
                    cloudinaryUrl: asset.cloudinaryUrl || asset.downloadUrl,
                    ...(typeof asset.directPdfDelivery === 'boolean'
                      ? { directPdfDelivery: asset.directPdfDelivery }
                      : {}),
                    publicId: asset.publicId,
                    cloudinaryResourceType: asset.cloudinaryResourceType,
                    storagePath: asset.publicId,
                  });
                }}
                onDeleted={() => {
                  setEditingCert({
                    ...editingCert,
                    driveLink: '',
                    cloudinaryUrl: undefined,
                    directPdfDelivery: undefined,
                    publicId: undefined,
                    cloudinaryResourceType: undefined,
                    storagePath: undefined,
                  });
                }}
              />

              {/* Document URL Input + Preview */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>
                    Certificate Document URL (Cloudinary / Google Drive) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setDrivePickerState({ isOpen: true, target: 'certificate' })}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      color: '#a1a1aa',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <i className="fab fa-google-drive"></i>
                    <span>Legacy Drive Picker</span>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {editingCert.driveLink && (
                    <div
                      style={{
                        width: '56px',
                        height: '44px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        backgroundColor: '#121214',
                        border: '1px solid #3f3f46',
                        flexShrink: 0,
                      }}
                    >
                      <DriveImage
                        driveUrl={editingCert.driveLink}
                        alt={editingCert.title || 'Certificate Preview'}
                        className="certificate-thumb"
                        size={200}
                      />
                    </div>
                  )}
                  <input
                    type="text"
                    required
                    value={editingCert.driveLink || ''}
                    onChange={(e) => setEditingCert({ ...editingCert, driveLink: e.target.value })}
                    placeholder="https://res.cloudinary.com/... or https://drive.google.com/file/d/..."
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: '24px', padding: '8px 0', borderTop: '1px solid #27272a', borderBottom: '1px solid #27272a' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(editingCert.featured)}
                    onChange={(e) => setEditingCert({ ...editingCert, featured: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>Featured (Starred badge)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(editingCert.viewAchievement)}
                    onChange={(e) => setEditingCert({ ...editingCert, viewAchievement: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>View Achievement (Detail Modal &amp; Event Photos)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', marginLeft: 'auto' }}>
                  <span>Status:</span>
                  <select
                    value={editingCert.status || 'published'}
                    onChange={(e) => setEditingCert({ ...editingCert, status: e.target.value as any })}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8rem',
                    }}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
              </div>

              {/* Achievement Section (if enabled) */}
              {editingCert.viewAchievement && (
                <div style={{ padding: '16px', backgroundColor: '#121214', borderRadius: '12px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fas fa-trophy"></i> Achievement Details &amp; Event Gallery
                  </h4>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#d4d4d8', marginBottom: '4px' }}>
                      Experience / Achievement Story
                    </label>
                    <textarea
                      rows={3}
                      value={editingCert.achievement?.experience || ''}
                      onChange={(e) =>
                        setEditingCert({
                          ...editingCert,
                          achievement: {
                            ...editingCert.achievement,
                            experience: e.target.value,
                          },
                        })
                      }
                      placeholder="Share your experience, problem solved, role in team..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  {/* Event Photos */}
                  <div>
                    <div style={{ marginBottom: '10px' }}>
                      <DeviceMediaUploader
                        category="Events"
                        acceptKind="image"
                        defaultPublishImmediately={true}
                        label="Upload Hackathon / Event Photo from Laptop / Phone"
                        helperText="Uploaded photos are appended to this achievement's event photo gallery below."
                        onUploaded={(asset) => {
                          setUploadedEventPhotoPaths((prev) => ({
                            ...prev,
                            [asset.downloadUrl]: asset.publicId,
                          }));
                          handleAddEventPhoto(asset.downloadUrl);
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.8rem', color: '#d4d4d8' }}>
                        Event Photos Gallery ({editingCert.achievement?.eventPhotos?.length || 0})
                      </label>
                      <button
                        type="button"
                        onClick={() => setDrivePickerState({ isOpen: true, target: 'eventPhoto' })}
                        style={{
                          padding: '3px 8px',
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          color: '#a1a1aa',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                        }}
                      >
                        + Legacy Drive Photo
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="url"
                        value={eventPhotoInput}
                        onChange={(e) => setEventPhotoInput(e.target.value)}
                        placeholder="Paste Cloudinary or Google Drive Photo URL..."
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '0.82rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddEventPhoto(eventPhotoInput)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#27272a',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Add
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                      {(editingCert.achievement?.eventPhotos || []).map((photoUrl, pIdx) => (
                        <div
                          key={pIdx}
                          style={{
                            position: 'relative',
                            height: '70px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                          }}
                        >
                          <img
                            src={photoUrl}
                            alt={`Event ${pIdx + 1}`}
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveEventPhoto(photoUrl)}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              background: 'rgba(239, 68, 68, 0.85)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              fontSize: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GitHub, Presentation, Demo Video */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#d4d4d8', marginBottom: '4px' }}>
                        GitHub Repository URL
                      </label>
                      <input
                        type="url"
                        value={editingCert.github || ''}
                        onChange={(e) => setEditingCert({ ...editingCert, github: e.target.value })}
                        placeholder="https://github.com/..."
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#d4d4d8', marginBottom: '4px' }}>
                        Demo Video URL
                      </label>
                      <input
                        type="url"
                        value={editingCert.demoVideo || ''}
                        onChange={(e) => setEditingCert({ ...editingCert, demoVideo: e.target.value })}
                        placeholder="https://..."
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #27272a' }}>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: '#27272a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#d4d4d8',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '9px 24px',
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
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
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #ef4444',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '2.5rem', color: '#ef4444', marginBottom: '14px' }}></i>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Confirm Delete</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '24px' }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>{deleteTarget.title}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
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
                onClick={handleDelete}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Google Drive Picker */}
      <GoogleDrivePickerModal
        isOpen={drivePickerState.isOpen}
        onClose={() => setDrivePickerState({ ...drivePickerState, isOpen: false })}
        filterMime={drivePickerState.target === 'eventPhoto' ? 'image' : 'all'}
        title={
          drivePickerState.target === 'eventPhoto'
            ? 'Select Event Photo from Google Drive'
            : 'Select Certificate Document from Google Drive'
        }
        onSelectFile={(file) => {
          if (!editingCert) return;
          if (drivePickerState.target === 'certificate') {
            setEditingCert({
              ...editingCert,
              driveLink: file.url,
              cloudinaryUrl: undefined,
              directPdfDelivery: undefined,
              publicId: undefined,
              cloudinaryResourceType: undefined,
              storagePath: undefined,
            });
          } else {
            handleAddEventPhoto(file.url);
          }
        }}
      />

      {/* Preview Modal */}
      {previewCert && (
        isPdfCertificate(previewCert.driveLink) ? (
          <PdfModal
            isOpen={Boolean(previewCert)}
            onClose={() => setPreviewCert(null)}
            certificate={previewCert}
          />
        ) : (
          <FullscreenImageModal
            isOpen={Boolean(previewCert)}
            onClose={() => setPreviewCert(null)}
            certificates={[previewCert]}
            initialIndex={0}
            showNavigation={false}
          />
        )
      )}
    </div>
  );
};
