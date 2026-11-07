import React, { useState, useEffect } from 'react';
import {
  getQualifications,
  saveQualification,
  deleteQualification,
  QualificationItem,
} from '../../services/portfolioService';

export const AdminQualifications: React.FC = () => {
  const [qualifications, setQualifications] = useState<QualificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Partial<QualificationItem> | null>(null);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchQualifications = async () => {
    try {
      setLoading(true);
      const data = await getQualifications(true);
      setQualifications(data);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to fetch qualifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualifications();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleOpenAdd = () => {
    setEditingItem({
      degree: '',
      institution: '',
      specialization: '',
      startYear: '',
      endYear: 'Present',
      grade: '',
      location: '',
      description: '',
      order: qualifications.length + 1,
      status: 'published',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: QualificationItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.degree?.trim()) {
      showNotification('error', 'Degree / Qualification title is required.');
      return;
    }
    if (!editingItem.institution?.trim()) {
      showNotification('error', 'Institution name is required.');
      return;
    }
    if (!editingItem.startYear?.trim() || !editingItem.endYear?.trim()) {
      showNotification('error', 'Start and end years are required.');
      return;
    }

    try {
      setSaving(true);
      await saveQualification(editingItem);
      showNotification('success', `Qualification "${editingItem.degree}" saved successfully!`);
      setIsModalOpen(false);
      setEditingItem(null);
      await fetchQualifications();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save qualification');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setSaving(true);
      await deleteQualification(id);
      showNotification('success', 'Qualification deleted successfully.');
      setDeletingId(null);
      await fetchQualifications();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete qualification');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= qualifications.length) return;

    const list = [...qualifications];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Update order values
    list.forEach((item, idx) => {
      item.order = idx + 1;
    });

    setQualifications(list);

    try {
      await Promise.all([
        saveQualification(list[index]),
        saveQualification(list[targetIndex]),
      ]);
      showNotification('success', 'Display order updated.');
    } catch (err: any) {
      showNotification('error', 'Failed to update order');
      await fetchQualifications();
    }
  };

  const filteredQualifications = qualifications.filter((q) => {
    const qText = `${q.degree} ${q.institution} ${q.specialization || ''} ${q.location || ''}`.toLowerCase();
    return qText.includes(searchQuery.toLowerCase());
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#f4f4f5' }}>
      {/* Header */}
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
            Qualifications Management
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
            Add, update, reorder and delete academic credentials displayed in your portfolio.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 18px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          <i className="fas fa-plus"></i>
          <span>Add Qualification</span>
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor:
              notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border:
              notification.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444',
            color: notification.type === 'success' ? '#34d399' : '#f87171',
          }}
        >
          <i
            className={
              notification.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'
            }
          ></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Search & Statistics Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '24px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <i
            className="fas fa-search"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#71717a',
              fontSize: '14px',
            }}
          ></i>
          <input
            type="text"
            placeholder="Search by degree, college, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              backgroundColor: '#121214',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.88rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
          Total Records: <strong style={{ color: '#fff' }}>{qualifications.length}</strong>
        </div>
      </div>

      {/* Qualification Cards List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3b82f6', marginBottom: '12px' }}></i>
          <p>Loading qualification records...</p>
        </div>
      ) : filteredQualifications.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            backgroundColor: '#18181b',
            border: '1px dashed #27272a',
            borderRadius: '14px',
            color: '#71717a',
          }}
        >
          <i className="fas fa-graduation-cap" style={{ fontSize: '3rem', marginBottom: '12px', color: '#3f3f46' }}></i>
          <h3 style={{ margin: '0 0 6px 0', color: '#d4d4d8' }}>No qualifications found</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {searchQuery ? 'Try clearing your search query' : 'Click "Add Qualification" to create your first record'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredQualifications.map((item, index) => (
            <div
              key={item.id}
              style={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '12px',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'border-color 0.15s ease',
              }}
            >
              {/* Order buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px' }}>
                <button
                  type="button"
                  title="Move Up"
                  disabled={index === 0}
                  onClick={() => handleMoveOrder(index, 'up')}
                  style={{
                    background: '#27272a',
                    border: 'none',
                    borderRadius: '4px',
                    color: index === 0 ? '#52525b' : '#d4d4d8',
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                    padding: '4px 6px',
                    fontSize: '11px',
                  }}
                >
                  <i className="fas fa-chevron-up"></i>
                </button>
                <button
                  type="button"
                  title="Move Down"
                  disabled={index === qualifications.length - 1}
                  onClick={() => handleMoveOrder(index, 'down')}
                  style={{
                    background: '#27272a',
                    border: 'none',
                    borderRadius: '4px',
                    color: index === qualifications.length - 1 ? '#52525b' : '#d4d4d8',
                    cursor: index === qualifications.length - 1 ? 'not-allowed' : 'pointer',
                    padding: '4px 6px',
                    fontSize: '11px',
                  }}
                >
                  <i className="fas fa-chevron-down"></i>
                </button>
              </div>

              {/* Main Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>
                    {item.institution}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      fontWeight: 600,
                    }}
                  >
                    {item.startYear} - {item.endYear}
                  </span>
                  {item.status === 'draft' && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(234, 179, 8, 0.15)',
                        color: '#facc15',
                      }}
                    >
                      Draft
                    </span>
                  )}
                </div>

                <div style={{ color: '#e4e4e7', fontSize: '0.92rem', fontWeight: 500, marginBottom: '4px' }}>
                  {item.degree}
                  {item.grade ? ` • ${item.grade}` : ''}
                </div>

                <div style={{ fontSize: '0.82rem', color: '#a1a1aa', marginBottom: '8px' }}>
                  {item.specialization && <span>Specialization: <strong>{item.specialization}</strong></span>}
                  {item.location && <span> | Location: {item.location}</span>}
                </div>

                {item.description && (
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#71717a',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-line',
                      backgroundColor: '#121214',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #27272a',
                    }}
                  >
                    {item.description}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(item)}
                  style={{
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    color: '#e4e4e7',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fas fa-edit"></i>
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingId(item.id)}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fas fa-trash-alt"></i>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Modal */}
      {isModalOpen && editingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 10000,
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
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #27272a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
                {editingItem.id ? 'Edit Qualification' : 'Add New Qualification'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a1a1aa',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    Degree / Qualification *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bachelor's in Information Science"
                    value={editingItem.degree || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, degree: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    Institution Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PES Institute of Technology"
                    value={editingItem.institution || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, institution: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Python & Web Development"
                    value={editingItem.specialization || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, specialization: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    Grade / Percentage / CGPA
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 88% Distinction or CGPA 8.5"
                    value={editingItem.grade || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, grade: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    Start Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2023"
                    value={editingItem.startYear || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, startYear: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    End Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Present or 2027"
                    value={editingItem.endYear || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, endYear: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingItem.order || 1}
                    onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value, 10) || 1 })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#121214',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Honnali, Davanagere or Shivamogga, Karnataka"
                  value={editingItem.location || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Description &amp; Highlights (Supports multi-line bullet points)
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. • Completed with distinction&#10;• Participant in science exhibition"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="statusToggle"
                  checked={editingItem.status === 'published'}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      status: e.target.checked ? 'published' : 'draft',
                    })
                  }
                  style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                />
                <label htmlFor="statusToggle" style={{ fontSize: '0.85rem', color: '#d4d4d8', cursor: 'pointer' }}>
                  Publish immediately (visible on public portfolio)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#e4e4e7',
                    fontWeight: 500,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 22px',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                  <span>{saving ? 'Saving...' : 'Save Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setDeletingId(null)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #ef4444',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '420px',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: '#ef4444', fontSize: '2.5rem', marginBottom: '14px' }}>
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1.2rem' }}>Delete Qualification?</h3>
            <p style={{ margin: '0 0 20px 0', color: '#a1a1aa', fontSize: '0.88rem', lineHeight: '1.5' }}>
              Are you sure you want to delete this qualification record? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
