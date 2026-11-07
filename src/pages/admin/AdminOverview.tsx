import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getProjects,
  getCertificates,
  getProfile,
  getResume,
  seedInitialPortfolioData,
  exportPortfolioBackup,
  portfolioService,
  ProjectItem,
  CertificateItem,
  QualificationItem,
  SkillCategoryItem,
  SocialLinkItem,
} from '../../services/portfolioService';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  CloudinaryStatus,
  getCloudinaryStatus,
  listMediaAssets,
  MediaAsset,
} from '../../services/mediaStorageService';

export const AdminOverview: React.FC = () => {
  const { driveToken } = useAdminAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [qualifications, setQualifications] = useState<QualificationItem[]>([]);
  const [skillCategories, setSkillCategories] = useState<SkillCategoryItem[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinkItem[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<CloudinaryStatus | null>(null);
  const [messageCounts, setMessageCounts] = useState<{ total: number; unread: number }>({
    total: 0,
    unread: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('admin_session_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [projList, certList, qualList, skillsList, socialList, mediaList, cloudStat, statsRes] = await Promise.all([
        getProjects(true),
        getCertificates(true),
        portfolioService.getAdminQualifications().catch(() => []),
        portfolioService.getAdminSkills().catch(() => []),
        portfolioService.getAdminSocialLinks().catch(() => []),
        listMediaAssets(true).catch(() => []),
        getCloudinaryStatus().catch(() => null),
        fetch('/api/admin/stats', { headers, credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setProjects(projList);
      setCertificates(certList);
      setQualifications(qualList);
      setSkillCategories(skillsList);
      setSocialLinks(socialList);
      setMediaAssets(mediaList);
      setCloudinaryStatus(cloudStat);
      if (statsRes) {
        setMessageCounts({
          total: Number(statsRes.totalMessages || 0),
          unread: Number(statsRes.unreadMessages || 0),
        });
      }
    } catch (err) {
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleSeedData = async () => {
    if (!window.confirm('Do you want to sync/seed all 49 certificates and projects into Cloud Firestore? Existing records will be preserved.')) {
      return;
    }

    try {
      setIsSeeding(true);
      setSeedMessage(null);
      const result = await seedInitialPortfolioData(false);
      setSeedMessage(
        `✓ Data Sync Complete: ${result.certificatesSeeded} certificates and ${result.projectsSeeded} projects are active in Cloud Firestore.`
      );
      await loadMetrics();
    } catch (err: any) {
      setSeedMessage(`Error syncing data: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const backupJson = await exportPortfolioBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mayur-portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate backup JSON.');
    }
  };

  const publishedProjects = projects.filter((p) => p.status === 'published').length;
  const draftProjects = projects.filter((p) => p.status === 'draft').length;

  const publishedCertificates = certificates.filter((c) => c.status === 'published').length;
  const draftCertificates = certificates.filter((c) => c.status === 'draft').length;
  const achievementCount = certificates.filter((c) => c.viewAchievement === true).length;

  const totalSkills = skillCategories.reduce((acc, cat) => acc + (cat.skills?.length || 0), 0);
  const activeSocialLinks = socialLinks.filter((s) => s.isActive !== false).length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
            Dashboard Overview
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
            Welcome back, Mayur. Manage and publish your portfolio content, projects, and credentials.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleDownloadBackup}
            style={{
              padding: '9px 16px',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '10px',
              color: '#d4d4d8',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="fas fa-download"></i>
            <span>Export Backup</span>
          </button>

          <button
            type="button"
            onClick={handleSeedData}
            disabled={isSeeding}
            style={{
              padding: '9px 16px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isSeeding ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <i className={isSeeding ? 'fas fa-spinner fa-spin' : 'fas fa-sync'}></i>
            <span>{isSeeding ? 'Syncing...' : 'Sync Firestore Database'}</span>
          </button>
        </div>
      </div>

      {seedMessage && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: seedMessage.startsWith('✓') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: seedMessage.startsWith('✓') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: seedMessage.startsWith('✓') ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.9rem',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{seedMessage}</span>
          <button
            type="button"
            onClick={() => setSeedMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '18px',
          marginBottom: '32px',
        }}
      >
        {/* Projects Card */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Total Projects</span>
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
                fontSize: '16px',
              }}
            >
              <i className="fas fa-layer-group"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {projects.length}
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
            <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              {publishedProjects} Published
            </span>
            {draftProjects > 0 && (
              <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                {draftProjects} Draft
              </span>
            )}
          </div>
        </div>

        {/* Certificates Card */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Total Certificates</span>
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
                fontSize: '16px',
              }}
            >
              <i className="fas fa-award"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {certificates.length}
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
            <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              {publishedCertificates} Published
            </span>
            {draftCertificates > 0 && (
              <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                {draftCertificates} Draft
              </span>
            )}
          </div>
        </div>

        {/* Achievements Card */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Achievements & Hackathons</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fas fa-trophy"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {achievementCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
            Interactive event galleries & demo media
          </div>
        </div>

        {/* Qualifications Card */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Qualifications</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fas fa-graduation-cap"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {qualifications.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
            Degrees, institutes &amp; academic records
          </div>
        </div>

        {/* Skills Card */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Skills &amp; Tech Stack</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: '#06b6d4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fas fa-tools"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {totalSkills}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#06b6d4' }}>
            Across {skillCategories.length} structured categories
          </div>
        </div>

        {/* Connect With Me Card */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Connect Channels</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fas fa-share-alt"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {activeSocialLinks}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981' }}>
            GitHub, LinkedIn, LeetCode &amp; contacts
          </div>
        </div>

        {/* Visitor Messages Card */}
        <Link
          to="/admin/messages"
          style={{
            backgroundColor: '#121214',
            border: messageCounts.unread > 0 ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            textDecoration: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Visitor Messages</span>
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
                fontSize: '16px',
              }}
            >
              <i className="fas fa-envelope"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {messageCounts.total}
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
            <span
              style={{
                color: messageCounts.unread > 0 ? '#93c5fd' : '#34d399',
                background:
                  messageCounts.unread > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {messageCounts.unread > 0 ? `${messageCounts.unread} Unread` : 'All Read'}
            </span>
          </div>
        </Link>

        {/* Media Manager & Cloud Storage Card */}
        <Link
          to="/admin/media"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            textDecoration: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>Media Manager</span>
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
                fontSize: '16px',
              }}
            >
              <i className="fas fa-photo-video"></i>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {mediaAssets.length}
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: cloudinaryStatus?.configured === false ? '#fbbf24' : '#34d399',
            }}
          >
            {cloudinaryStatus?.configured
              ? `Cloudinary (${cloudinaryStatus.cloudName})`
              : cloudinaryStatus?.configured === false
              ? 'Setup Cloudinary Secrets'
              : 'Cloudinary Media Ready'}
            {driveToken ? ' • Drive Linked' : ''}
          </div>
        </Link>
      </div>

      {/* Quick Actions Grid */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
        Quick Management Actions
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '36px',
        }}
      >
        <Link
          to="/admin/analytics"
          style={{
            backgroundColor: '#121214',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-chart-line"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#c7d2fe' }}>Real-Time Analytics</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Visits, engagement &amp; events</div>
          </div>
        </Link>
        <Link
          to="/admin/projects"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-plus-circle"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Manage Projects</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Add, edit &amp; reorder</div>
          </div>
        </Link>

        <Link
          to="/admin/certificates"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-certificate"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Manage Certificates</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>All 49 records &amp; photos</div>
          </div>
        </Link>

        <Link
          to="/admin/qualifications"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Qualifications</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Degrees, CGPA &amp; institutes</div>
          </div>
        </Link>

        <Link
          to="/admin/skills"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(6, 182, 212, 0.12)',
              color: '#06b6d4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-tools"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Skills Management</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Categories &amp; technologies</div>
          </div>
        </Link>

        <Link
          to="/admin/connect"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-share-alt"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Connect With Me</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Social links &amp; contacts</div>
          </div>
        </Link>

        <Link
          to="/admin/profile"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-user-edit"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Edit Bio &amp; Profile</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Profile details &amp; about</div>
          </div>
        </Link>

        <Link
          to="/admin/resume"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-file-pdf"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Resume PDF</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Upload, preview &amp; history</div>
          </div>
        </Link>

        <Link
          to="/admin/media"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-photo-video"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Media Manager</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Upload images &amp; PDFs</div>
          </div>
        </Link>

        <Link
          to="/admin/messages"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-inbox"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Visitor Messages</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>
              {messageCounts.unread} unread • {messageCounts.total} total
            </div>
          </div>
        </Link>

        <Link
          to="/admin/account"
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '18px',
            textDecoration: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <i className="fas fa-user-shield"></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Account Settings</div>
            <div style={{ color: '#71717a', fontSize: '0.78rem' }}>Username &amp; password</div>
          </div>
        </Link>
      </div>

      {/* Recent Updates & Published List Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Recent Projects preview */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Active Projects</h3>
            <Link to="/admin/projects" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 500 }}>
              View All ({projects.length})
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {projects.slice(0, 4).map((p, idx) => (
              <div
                key={p.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#18181b',
                  borderRadius: '10px',
                  border: '1px solid #27272a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={p.image}
                    alt={p.title}
                    style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>{p.title}</div>
                    <div style={{ color: '#71717a', fontSize: '0.75rem' }}>{p.category.toUpperCase()}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {p.featured && (
                    <span style={{ fontSize: '0.7rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                      ★ Featured
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: p.status === 'published' ? '#34d399' : '#f59e0b',
                      background: p.status === 'published' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured / Achievement Certificates Preview */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Top Priority Credentials</h3>
            <Link to="/admin/certificates" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 500 }}>
              View All ({certificates.length})
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {certificates.slice(0, 4).map((c, idx) => (
              <div
                key={c.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#18181b',
                  borderRadius: '10px',
                  border: '1px solid #27272a',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>{c.title}</div>
                  <div style={{ color: '#71717a', fontSize: '0.75rem' }}>
                    {c.issuer} • {c.year} • {c.category}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {c.viewAchievement && (
                    <span style={{ fontSize: '0.7rem', color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                      Achievement
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: c.status === 'published' ? '#34d399' : '#f59e0b',
                      background: c.status === 'published' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
