import React, { useState, useEffect } from 'react';
import { getProfile, saveProfile, ProfileData } from '../../services/portfolioService';
import { GoogleDrivePickerModal } from '../../components/admin/GoogleDrivePickerModal';
import { DeviceMediaUploader } from '../../components/admin/DeviceMediaUploader';
import { publishMediaAssetByPublicId } from '../../services/mediaStorageService';

export const AdminProfile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [imgPreviewError, setImgPreviewError] = useState<boolean>(false);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getProfile(true);
        setProfile(data);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleParagraphChange = (index: number, text: string) => {
    if (!profile) return;
    const updated = [...profile.aboutParagraphs];
    updated[index] = text;
    setProfile({ ...profile, aboutParagraphs: updated });
  };

  const handleAddParagraph = () => {
    if (!profile) return;
    setProfile({
      ...profile,
      aboutParagraphs: [...profile.aboutParagraphs, ''],
    });
  };

  const handleRemoveParagraph = (index: number) => {
    if (!profile) return;
    const updated = profile.aboutParagraphs.filter((_, idx) => idx !== index);
    setProfile({ ...profile, aboutParagraphs: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setIsSaving(true);
      setSaveSuccess(false);
      const saved = await saveProfile(profile);
      const activePubId = saved.profileImagePublicId || saved.profileImageStoragePath;
      if (saved.status === 'published' && activePubId) {
        await publishMediaAssetByPublicId(activePubId);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(`Failed to save profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px' }}></i>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
          Profile &amp; Biography Management
        </h1>
        <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
          Manage your personal introduction, biography paragraphs, photo, and public credentials.
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
          <span>Profile updated and saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Name and Tagline */}
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
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
            Basic Information
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
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
                Profile Tagline
              </label>
              <input
                type="text"
                value={profile.tagline}
                onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                placeholder='"Passionate about Learning & Growth"'
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
          </div>

          {/* Direct Device Upload for Profile Picture */}
          <DeviceMediaUploader
            category="Profile"
            acceptKind="image"
            currentUrl={profile.profileImageUrl}
            currentPublicId={profile.profileImagePublicId || profile.profileImageStoragePath}
            currentResourceType={profile.profileImageResourceType}
            defaultPublishImmediately={true}
            label="Upload Profile Picture from Laptop / Phone"
            helperText="Uploads persistently to Cloudinary. Your existing Google Drive profile image link stays active unless replaced."
            onUploaded={(asset) => {
              setImgPreviewError(false);
              setProfile({
                ...profile,
                profileImageUrl: asset.downloadUrl,
                profileImagePublicId: asset.publicId,
                profileImageResourceType: asset.cloudinaryResourceType,
                profileImageStoragePath: asset.publicId,
              });
            }}
            onDeleted={() => {
              setImgPreviewError(false);
              setProfile({
                ...profile,
                profileImageUrl:
                  'https://drive.google.com/thumbnail?id=1EUeICFZ7u0iSG1M5HDmMMpz19uExqvo-&sz=w2000',
                profileImagePublicId: undefined,
                profileImageResourceType: undefined,
                profileImageStoragePath: undefined,
              });
            }}
          />

          {/* Profile Photo URL */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>
                Profile Photo URL (Cloudinary / Google Drive)
              </label>
              <button
                type="button"
                onClick={() => setIsDrivePickerOpen(true)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#18181b',
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

            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              {profile.profileImageUrl && !imgPreviewError ? (
                <img
                  src={profile.profileImageUrl}
                  alt="Profile Preview"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    flexShrink: 0,
                  }}
                  onError={() => setImgPreviewError(true)}
                />
              ) : (
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#71717a',
                    fontSize: '20px',
                    flexShrink: 0,
                  }}
                >
                  <i className="fas fa-user"></i>
                </div>
              )}

              <input
                type="text"
                value={profile.profileImageUrl}
                onChange={(e) => {
                  setImgPreviewError(false);
                  setProfile({ ...profile, profileImageUrl: e.target.value });
                }}
                placeholder="https://res.cloudinary.com/... or https://drive.google.com/..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Biography Paragraphs */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
              About Me Biography
            </h2>
            <button
              type="button"
              onClick={handleAddParagraph}
              style={{
                padding: '4px 10px',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              + Add Paragraph
            </button>
          </div>

          {profile.aboutParagraphs.map((para, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <textarea
                rows={3}
                value={para}
                onChange={(e) => handleParagraphChange(idx, e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}
              />
              {profile.aboutParagraphs.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveParagraph(idx)}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                  title="Remove paragraph"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Publishing Status */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Publishing Status</div>
            <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
              {profile.status === 'published'
                ? 'Profile is currently Published and visible to the public.'
                : 'Profile is saved as a Draft.'}
            </div>
          </div>

          <select
            value={profile.status}
            onChange={(e) => setProfile({ ...profile, status: e.target.value as any })}
            style={{
              padding: '8px 14px',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            disabled={isSaving}
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            }}
          >
            {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      {/* Legacy Google Drive Picker */}
      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        filterMime="image"
        title="Select Profile Photo from Google Drive"
        onSelectFile={(file) => {
          setImgPreviewError(false);
          setProfile({
            ...profile,
            profileImageUrl: file.url,
            profileImagePublicId: undefined,
            profileImageResourceType: undefined,
            profileImageStoragePath: undefined,
          });
        }}
      />
    </div>
  );
};
