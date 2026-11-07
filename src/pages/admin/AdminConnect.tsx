import React, { useState, useEffect } from 'react';
import {
  portfolioService,
  SocialLinkItem,
} from '../../services/portfolioService';

interface PresetItem {
  label: string;
  icon: string;
  faIcon?: string;
  defaultUrl: string;
  description: string;
}

const POPULAR_PRESETS: PresetItem[] = [
  {
    label: 'GitHub',
    icon: 'logo-github',
    faIcon: 'fab fa-github',
    defaultUrl: 'https://github.com/Mayurhr',
    description: 'Code repositories & open source',
  },
  {
    label: 'LinkedIn',
    icon: 'logo-linkedin',
    faIcon: 'fab fa-linkedin',
    defaultUrl: 'https://www.linkedin.com/in/mayur-hr-2507962ba?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    description: 'Professional career profile',
  },
  {
    label: 'LeetCode',
    icon: 'leetcode',
    defaultUrl: 'https://leetcode.com/u/qE84fwcT6p/',
    description: 'Data structures & algorithms',
  },
  {
    label: 'Email',
    icon: 'mail-outline',
    faIcon: 'fas fa-envelope',
    defaultUrl: 'https://mail.google.com/mail/?view=cm&fs=1&to=mayurhr57@gmail.com',
    description: 'Direct email inquiries',
  },
  {
    label: 'WhatsApp',
    icon: 'call-outline',
    faIcon: 'fab fa-whatsapp',
    defaultUrl: 'https://wa.me/919663124725',
    description: 'Instant mobile messaging',
  },
  {
    label: 'Instagram',
    icon: 'logo-instagram',
    faIcon: 'fab fa-instagram',
    defaultUrl: 'https://www.instagram.com/mayur___.hr',
    description: 'Personal & creative updates',
  },
  {
    label: 'Location',
    icon: 'location-outline',
    faIcon: 'fas fa-map-marker-alt',
    defaultUrl: 'https://www.google.com/maps/search/?api=1&query=Honnali+Davanagere+Karnataka+India',
    description: 'Geographic location / base',
  },
  {
    label: 'Twitter / X',
    icon: 'logo-twitter',
    faIcon: 'fab fa-x-twitter',
    defaultUrl: 'https://twitter.com/',
    description: 'Tech thoughts & discussions',
  },
  {
    label: 'Personal Website',
    icon: 'globe-outline',
    faIcon: 'fas fa-globe',
    defaultUrl: 'https://',
    description: 'Custom domain or site',
  },
];

export const AdminConnect: React.FC = () => {
  const [links, setLinks] = useState<SocialLinkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<SocialLinkItem | null>(null);
  const [formData, setFormData] = useState<Partial<SocialLinkItem>>({
    platform: '',
    url: '',
    icon: 'logo-github',
    title: '',
    order: 1,
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<SocialLinkItem | null>(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadLinks = async () => {
    setLoading(true);
    try {
      const data = await portfolioService.getAdminSocialLinks();
      setLinks(data.sort((a, b) => a.order - b.order));
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load social links');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingLink(null);
    setFormData({
      platform: '',
      url: '',
      icon: 'logo-github',
      title: '',
      order: links.length + 1,
      isActive: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (item: SocialLinkItem) => {
    setEditingLink(item);
    setFormData({ ...item });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: PresetItem) => {
    setEditingLink(null);
    setFormData({
      platform: preset.label,
      url: preset.defaultUrl,
      icon: preset.icon,
      title: `${preset.label} Profile`,
      order: links.length + 1,
      isActive: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.platform?.trim()) {
      errors.platform = 'Platform name is required (e.g. GitHub, LinkedIn)';
    }
    if (!formData.url?.trim()) {
      errors.url = 'Profile URL or contact link is required';
    } else {
      const url = formData.url.trim();
      const isEmail = url.startsWith('mailto:') || url.includes('mail.google.com');
      const isTel = url.startsWith('tel:') || url.startsWith('https://wa.me/');
      const isHttp = /^https?:\/\//i.test(url);
      const isAnchor = url.startsWith('#');
      if (!isEmail && !isTel && !isHttp && !isAnchor) {
        errors.url = 'Must be a valid web link (https://...), email, or phone link';
      }
    }
    if (!formData.icon?.trim()) {
      errors.icon = 'Icon identifier is required (e.g. logo-github, mail-outline, leetcode)';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const linkPayload: SocialLinkItem = {
        id: editingLink ? editingLink.id : `social_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        platform: formData.platform!.trim(),
        url: formData.url!.trim(),
        icon: formData.icon!.trim(),
        title: formData.title?.trim() || formData.platform!.trim(),
        order: Number(formData.order) || (links.length + 1),
        isActive: formData.isActive !== false,
      };

      const saved = await portfolioService.saveSocialLink(linkPayload);
      if (editingLink) {
        setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)).sort((a, b) => a.order - b.order));
        showToast('success', `Channel "${saved.platform}" updated successfully.`);
      } else {
        setLinks((prev) => [...prev, saved].sort((a, b) => a.order - b.order));
        showToast('success', `Channel "${saved.platform}" added successfully.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save contact link');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (link: SocialLinkItem) => {
    const updated: SocialLinkItem = {
      ...link,
      isActive: !link.isActive,
    };
    try {
      await portfolioService.saveSocialLink(updated);
      setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
      showToast('success', `"${link.platform}" is now ${updated.isActive ? 'Active (visible)' : 'Hidden'}.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await portfolioService.deleteSocialLink(deleteTarget.id);
      setLinks((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      showToast('success', `Deleted "${deleteTarget.platform}" successfully.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete contact link');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= links.length) return;

    const newLinks = [...links];
    const temp = newLinks[index];
    newLinks[index] = newLinks[targetIdx];
    newLinks[targetIdx] = temp;

    // re-assign orders
    const updated = newLinks.map((item, idx) => ({ ...item, order: idx + 1 }));
    setLinks(updated);

    try {
      await Promise.all([
        portfolioService.saveSocialLink(updated[index]),
        portfolioService.saveSocialLink(updated[targetIdx]),
      ]);
      showToast('success', 'Channel order updated successfully.');
    } catch {
      showToast('error', 'Failed to save reordered channels on server');
      loadLinks();
    }
  };

  const renderIcon = (iconName: string, size = 20) => {
    const clean = iconName.trim().toLowerCase();
    if (clean === 'leetcode') {
      return (
        <svg
          style={{ width: `${size}px`, height: `${size}px`, fill: 'currentColor', display: 'inline-block' }}
          viewBox="0 0 24 24"
        >
          <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.874 5.874 0 0 0 .349 1.017 5.938 5.938 0 0 0 .581.999l6.038 6.015c.49.478 1.143.748 1.83.75h.01a2.583 2.583 0 0 0 1.82-.75l4.316-4.303a1.373 1.373 0 0 0 0-1.942 1.374 1.374 0 0 0-1.942 0l-4.316 4.303a.35.35 0 0 1-.248.102h-.002a.35.35 0 0 1-.248-.102l-5.69-5.669a3.172 3.172 0 0 1-.689-1.396 3.003 3.003 0 0 1 .184-1.968c.168-.42.441-.787.794-1.066l3.85-4.122 5.4-5.786a1.374 1.374 0 0 0-.992-2.327zM16.5 10.5h-8a1.5 1.5 0 0 0 0 3h8a1.5 1.5 0 0 0 0-3z" />
        </svg>
      );
    }

    if (iconName.startsWith('fa-') || iconName.startsWith('fab ') || iconName.startsWith('fas ')) {
      return <i className={iconName} style={{ fontSize: `${size}px`, display: 'inline-block' }}></i>;
    }

    return (
      <ion-icon
        name={iconName}
        style={{
          fontSize: `${size}px`,
          width: `${size}px`,
          height: `${size}px`,
          display: 'inline-block',
          verticalAlign: 'middle',
        }}
      ></ion-icon>
    );
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', color: '#f4f4f5' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: '10px',
            backgroundColor: toast.type === 'success' ? '#065f46' : '#991b1b',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
            border: `1px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
          }}
        >
          <i className={toast.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle'}></i>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          marginBottom: '26px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              <i className="fas fa-share-alt"></i>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Connect With Me Management
            </h1>
          </div>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem', maxWidth: '640px', lineHeight: 1.5 }}>
            Configure your social links, channels, and direct contact endpoints displayed in the portfolio footer and LET&#39;S CONNECT.EXE section.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 22px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          <i className="fas fa-plus"></i>
          <span>Add Contact Link</span>
        </button>
      </div>

      {/* Platform Presets Section */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '22px 24px',
          marginBottom: '26px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#fbbf24', margin: '0 0 4px 0' }}>
              Popular Platform Presets
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#71717a' }}>
              Click any platform preset below to quickly create or configure that contact channel.
            </p>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 500 }}>
            {POPULAR_PRESETS.length} Platform Presets
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '12px',
          }}
        >
          {POPULAR_PRESETS.map((preset) => {
            const existing = links.find(
              (l) => l.platform.toLowerCase() === preset.label.toLowerCase() || l.icon === preset.icon
            );
            return (
              <div
                key={preset.label}
                onClick={() => handleApplyPreset(preset)}
                style={{
                  backgroundColor: '#18181b',
                  border: existing ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: existing ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                    color: existing ? '#34d399' : '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {renderIcon(preset.icon, 20)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap' }}>
                      {preset.label}
                    </span>
                    {existing && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#34d399',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.74rem',
                      color: '#71717a',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {preset.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Social & Contact Channels Card List */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid #27272a',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>
              Current Social &amp; Contact Channels ({links.length})
            </h2>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#a1a1aa' }}>
              Ordering determines appearance in LET&#39;S CONNECT.EXE and the live portfolio navigation.
            </p>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#71717a' }}>
            Active Channels: <strong style={{ color: '#34d399' }}>{links.filter((l) => l.isActive !== false).length}</strong> / {links.length}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#fbbf24', marginBottom: '12px' }}></i>
            <p style={{ margin: 0 }}>Loading contact channels from storage...</p>
          </div>
        ) : links.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: '#18181b',
              border: '1px dashed #27272a',
              borderRadius: '12px',
              color: '#71717a',
            }}
          >
            <i className="fas fa-share-alt" style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.4 }}></i>
            <h3 style={{ margin: '0 0 6px 0', color: '#e4e4e7' }}>No contact channels configured</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem' }}>
              Click any of the popular presets above or click &quot;Add Contact Link&quot; to connect GitHub, LinkedIn, Email, WhatsApp, etc.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              style={{
                padding: '9px 18px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add First Channel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {links.map((link, idx) => (
              <div
                key={link.id}
                style={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Left side: Reorder + Icon + Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
                  {/* Reorder controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveOrder(idx, 'up')}
                      title="Move Up"
                      style={{
                        padding: '4px 6px',
                        background: '#27272a',
                        border: 'none',
                        borderRadius: '4px',
                        color: idx === 0 ? '#4b5563' : '#d4d4d8',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#71717a',
                        fontFamily: 'monospace',
                        minWidth: '16px',
                        textAlign: 'center',
                      }}
                    >
                      {link.order || idx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={idx === links.length - 1}
                      onClick={() => handleMoveOrder(idx, 'down')}
                      title="Move Down"
                      style={{
                        padding: '4px 6px',
                        background: '#27272a',
                        border: 'none',
                        borderRadius: '4px',
                        color: idx === links.length - 1 ? '#4b5563' : '#d4d4d8',
                        cursor: idx === links.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>

                  {/* Icon Avatar */}
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {renderIcon(link.icon, 24)}
                  </div>

                  {/* Channel Meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>
                        {link.platform}
                      </span>

                      {/* Active Status Badge */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: link.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(113, 113, 122, 0.2)',
                          color: link.isActive ? '#34d399' : '#a1a1aa',
                          border: `1px solid ${link.isActive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(113, 113, 122, 0.35)'}`,
                        }}
                      >
                        {link.isActive ? 'Active' : 'Hidden'}
                      </span>

                      <span style={{ fontSize: '0.74rem', color: '#71717a', fontFamily: 'monospace' }}>
                        icon: {link.icon}
                      </span>
                    </div>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#60a5fa',
                        fontSize: '0.82rem',
                        textDecoration: 'none',
                        fontFamily: 'monospace',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        maxWidth: '520px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={link.url}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.url}</span>
                      <i className="fas fa-external-link-alt" style={{ fontSize: '10px', opacity: 0.7 }}></i>
                    </a>
                  </div>
                </div>

                {/* Right side: Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Toggle Active Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(link)}
                    title={link.isActive ? 'Hide from public site' : 'Activate on public site'}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: link.isActive ? '#fbbf24' : '#34d399',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className={link.isActive ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                    <span>{link.isActive ? 'Hide' : 'Show'}</span>
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => openEditModal(link)}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="fas fa-pencil-alt" style={{ color: '#60a5fa' }}></i>
                    <span>Edit</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(link)}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      color: '#f87171',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    title="Delete link"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              color: '#f4f4f5',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #27272a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <i className={`fas ${editingLink ? 'fa-edit' : 'fa-plus'}`}></i>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                  {editingLink ? `Edit Channel: ${editingLink.platform}` : 'Add New Contact Channel'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a1a1aa',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Quick Preset Picker */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '8px' }}>
                  Quick Preset (Auto-fills Icon &amp; Template URL)
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    padding: '8px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '10px',
                  }}
                >
                  {POPULAR_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          platform: preset.label,
                          icon: preset.icon,
                          url: prev.url || preset.defaultUrl,
                          title: prev.title || `${preset.label} Profile`,
                        }));
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: formData.platform === preset.label ? '1px solid #fbbf24' : '1px solid #27272a',
                        backgroundColor: formData.platform === preset.label ? 'rgba(245, 158, 11, 0.15)' : '#18181b',
                        color: formData.platform === preset.label ? '#fbbf24' : '#d4d4d8',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderIcon(preset.icon, 14)}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Platform Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.platform || ''}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  placeholder="e.g. GitHub, LinkedIn, LeetCode, Email, WhatsApp"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#121214',
                    border: formErrors.platform ? '1px solid #ef4444' : '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {formErrors.platform && (
                  <span style={{ display: 'block', color: '#f87171', fontSize: '0.78rem', marginTop: '4px' }}>
                    {formErrors.platform}
                  </span>
                )}
              </div>

              {/* URL or Contact Value */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Profile URL / Contact Value <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.url || ''}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://github.com/..., mailto:user@gmail.com, https://wa.me/..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#121214',
                    border: formErrors.url ? '1px solid #ef4444' : '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {formErrors.url && (
                  <span style={{ display: 'block', color: '#f87171', fontSize: '0.78rem', marginTop: '4px' }}>
                    {formErrors.url}
                  </span>
                )}
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#71717a', marginTop: '4px' }}>
                  Supports web URLs (<code>https://...</code>), mail links (<code>mailto:user@mail.com</code>), or phone/WhatsApp.
                </span>
              </div>

              {/* Icon Selection + Live Preview */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Icon Identifier &amp; Preview <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    value={formData.icon || ''}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="e.g. logo-github, logo-linkedin, leetcode, mail-outline"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: formErrors.icon ? '1px solid #ef4444' : '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title="Live Icon Preview"
                  >
                    {renderIcon(formData.icon || 'logo-github', 22)}
                  </div>
                </div>
                {formErrors.icon && (
                  <span style={{ display: 'block', color: '#f87171', fontSize: '0.78rem', marginTop: '4px' }}>
                    {formErrors.icon}
                  </span>
                )}
              </div>

              {/* Title / Tooltip Text */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Tooltip / Accessible Label
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. GitHub Profile, Email (mayurhr57@gmail.com)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#121214',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Order & Active Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.order ?? 1}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) || 1 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ paddingTop: '22px' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      color: '#fff',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <span>Active on Portfolio</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid #27272a',
                  marginTop: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#d4d4d8',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  }}
                >
                  {saving && <i className="fas fa-spinner fa-spin"></i>}
                  <span>{editingLink ? 'Update Channel' : 'Save Channel'}</span>
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
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setDeleteTarget(null)}
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
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                margin: '0 auto 16px auto',
              }}
            >
              <i className="fas fa-trash-alt"></i>
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 700 }}>
              Delete Contact Channel?
            </h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong style={{ color: '#fff' }}>&quot;{deleteTarget.platform}&quot;</strong> ({deleteTarget.url})? This will immediately remove it from your live portfolio.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '9px 20px',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#d4d4d8',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                style={{
                  padding: '9px 24px',
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {saving && <i className="fas fa-spinner fa-spin"></i>}
                <span>Delete Channel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
