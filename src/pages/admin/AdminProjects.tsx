import React, { useState, useEffect } from 'react';
import {
  getProjects,
  saveProject,
  deleteProject,
  ProjectItem,
} from '../../services/portfolioService';
import { GoogleDrivePickerModal } from '../../components/admin/GoogleDrivePickerModal';
import { DeviceMediaUploader } from '../../components/admin/DeviceMediaUploader';
import { publishMediaAssetByPublicId } from '../../services/mediaStorageService';

export const AdminProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

  // Modal form states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Partial<ProjectItem> | null>(null);
  const [techInput, setTechInput] = useState<string>('');
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);

  const loadAllProjects = async () => {
    try {
      setLoading(true);
      const list = await getProjects(true); // include drafts
      setProjects(list);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllProjects();
  }, []);

  const handleOpenAdd = () => {
    setEditingProject({
      title: '',
      category: 'web',
      description: '',
      tech: [],
      github: '',
      demo: '',
      videoDemo: '',
      image: '',
      featured: false,
      status: 'published',
      order: projects.length + 1,
    });
    setTechInput('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (project: ProjectItem) => {
    setEditingProject({ ...project });
    setTechInput('');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editingProject.title?.trim()) {
      alert('Please provide a project title.');
      return;
    }

    try {
      setIsSaving(true);
      await saveProject(editingProject);
      const activePubId = editingProject.publicId || editingProject.storagePath;
      if (editingProject.status === 'published' && activePubId) {
        await publishMediaAssetByPublicId(activePubId);
      }
      setIsFormOpen(false);
      setEditingProject(null);
      await loadAllProjects();
    } catch (err: any) {
      alert(`Failed to save project: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      await loadAllProjects();
    } catch (err: any) {
      alert(`Failed to delete project: ${err.message}`);
    }
  };

  const handleTogglePublish = async (project: ProjectItem) => {
    const nextStatus = project.status === 'published' ? 'draft' : 'published';
    try {
      await saveProject({ ...project, status: nextStatus });
      await loadAllProjects();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleAddTechTag = () => {
    if (!techInput.trim() || !editingProject) return;
    const currentTech = editingProject.tech || [];
    if (!currentTech.includes(techInput.trim())) {
      setEditingProject({
        ...editingProject,
        tech: [...currentTech, techInput.trim()],
      });
    }
    setTechInput('');
  };

  const handleRemoveTechTag = (tagToRemove: string) => {
    if (!editingProject) return;
    setEditingProject({
      ...editingProject,
      tech: (editingProject.tech || []).filter((t) => t !== tagToRemove),
    });
  };

  const filteredProjects = projects.filter((p) => {
    if (filterStatus === 'all') return true;
    return p.status === filterStatus;
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
            Project Management
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
            Add, update, reorder, and publish portfolio showcase projects.
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
          <span>Add New Project</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid #27272a',
          paddingBottom: '12px',
        }}
      >
        {(['all', 'published', 'draft'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: filterStatus === status ? '1px solid #3b82f6' : '1px solid #27272a',
              backgroundColor: filterStatus === status ? 'rgba(59, 130, 246, 0.15)' : '#18181b',
              color: filterStatus === status ? '#60a5fa' : '#a1a1aa',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {status === 'all' ? `All (${projects.length})` : status === 'published' ? `Published (${projects.filter(p => p.status === 'published').length})` : `Drafts (${projects.filter(p => p.status === 'draft').length})`}
          </button>
        ))}
      </div>

      {/* Projects List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px' }}></i>
          <p>Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
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
          <i className="fas fa-folder-open" style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.5 }}></i>
          <p>No projects found matching the filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredProjects.map((p, idx) => (
            <div
              key={p.id || idx}
              style={{
                backgroundColor: '#121214',
                border: '1px solid #27272a',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
                <img
                  src={p.image}
                  alt={p.title}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    backgroundColor: '#18181b',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
                      {p.title}
                    </h3>
                    {p.featured && (
                      <span style={{ fontSize: '0.7rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        ★ Featured
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: p.status === 'published' ? '#34d399' : '#f59e0b',
                        background: p.status === 'published' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {p.status.toUpperCase()}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: '0 0 6px 0',
                      color: '#a1a1aa',
                      fontSize: '0.82rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      maxWidth: '650px',
                    }}
                  >
                    {p.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {p.tech.slice(0, 5).map((t, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.72rem',
                          color: '#d4d4d8',
                          backgroundColor: '#1f1f23',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #2e2e34',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                    {p.tech.length > 5 && (
                      <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                        +{p.tech.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleTogglePublish(p)}
                  title={p.status === 'published' ? 'Unpublish to Draft' : 'Publish Project'}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: p.status === 'published' ? '#f59e0b' : '#34d399',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {p.status === 'published' ? 'Draft' : 'Publish'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(p)}
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
                  onClick={() => setDeleteTarget(p)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                  title="Delete project"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isFormOpen && editingProject && (
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
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px 28px',
              color: '#f4f4f5',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                {editingProject.id ? 'Edit Project' : 'Create New Project'}
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
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingProject.title || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                  placeholder="e.g., Smart AI Travel Planner"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={editingProject.category || 'web'}
                    onChange={(e) => setEditingProject({ ...editingProject, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="web">Web Application</option>
                    <option value="ai">AI / Agentic Platform</option>
                    <option value="mobile">Mobile / Full-Stack</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                    Publishing Status
                  </label>
                  <select
                    value={editingProject.status || 'published'}
                    onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="published">Published (Visible on Live Portfolio)</option>
                    <option value="draft">Draft (Private in Admin Panel)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  placeholder="Comprehensive description of the application..."
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

              {/* Direct Device Upload for Project Image */}
              <DeviceMediaUploader
                category="Projects"
                acceptKind="image"
                currentUrl={editingProject.image}
                currentPublicId={editingProject.publicId || editingProject.storagePath}
                currentResourceType={editingProject.cloudinaryResourceType}
                defaultPublishImmediately={true}
                label="Upload Project Screenshot from Laptop / Phone"
                helperText="Uploads persistently to Cloudinary. Existing Google Drive or local images remain supported."
                onUploaded={(asset) => {
                  setEditingProject({
                    ...editingProject,
                    image: asset.downloadUrl,
                    publicId: asset.publicId,
                    cloudinaryResourceType: asset.cloudinaryResourceType,
                    storagePath: asset.publicId,
                  });
                }}
                onDeleted={() => {
                  setEditingProject({
                    ...editingProject,
                    image: '',
                    publicId: undefined,
                    cloudinaryResourceType: undefined,
                    storagePath: undefined,
                  });
                }}
              />

              {/* Thumbnail URL with legacy Google Drive picker */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>
                    Thumbnail Image URL (Cloudinary / Google Drive / Path)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsDrivePickerOpen(true)}
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
                  {editingProject.image && (
                    <img
                      src={editingProject.image}
                      alt="Project thumbnail preview"
                      referrerPolicy="no-referrer"
                      style={{
                        width: '54px',
                        height: '42px',
                        borderRadius: '6px',
                        objectFit: 'cover',
                        border: '1px solid #3f3f46',
                        backgroundColor: '#121214',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <input
                    type="text"
                    value={editingProject.image || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, image: e.target.value })}
                    placeholder="https://res.cloudinary.com/... or /assest/projects/..."
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

              {/* Links */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    value={editingProject.github || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, github: e.target.value })}
                    placeholder="https://github.com/Mayurhr/..."
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
                    Live Demo URL
                  </label>
                  <input
                    type="url"
                    value={editingProject.demo || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, demo: e.target.value })}
                    placeholder="https://..."
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

              {/* Tech Stack Tags */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                  Technology Stack Badges
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTechTag();
                      }
                    }}
                    placeholder="Add a technology (e.g., React, TypeScript, Gemini API)..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTechTag}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#27272a',
                      color: '#fff',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Add Tag
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(editingProject.tech || []).map((t, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '3px 8px',
                        backgroundColor: '#1f1f23',
                        border: '1px solid #3f3f46',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        color: '#d4d4d8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTechTag(t)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Featured toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '6px' }}>
                <input
                  type="checkbox"
                  id="featuredToggle"
                  checked={Boolean(editingProject.featured)}
                  onChange={(e) => setEditingProject({ ...editingProject, featured: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="featuredToggle" style={{ fontSize: '0.85rem', color: '#d4d4d8', cursor: 'pointer' }}>
                  Mark as Featured Project
                </label>
              </div>

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
                  {isSaving ? 'Saving...' : 'Save Project'}
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
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Google Drive Picker Modal */}
      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        filterMime="image"
        title="Select Project Thumbnail from Google Drive"
        onSelectFile={(file) => {
          if (editingProject) {
            setEditingProject({
              ...editingProject,
              image: file.url,
              publicId: undefined,
              cloudinaryResourceType: undefined,
              storagePath: undefined,
            });
          }
        }}
      />
    </div>
  );
};
