import React, { useState, useEffect } from 'react';
import {
  getSkills,
  saveSkillCategory,
  deleteSkillCategory,
  saveSkill,
  deleteSkill,
  saveAllSkillCategories,
  SkillCategoryItem,
  SkillItem,
} from '../../services/portfolioService';

const COMMON_ICONS = [
  { label: 'Code', value: 'fas fa-code' },
  { label: 'Laptop Code', value: 'fas fa-laptop-code' },
  { label: 'Server', value: 'fas fa-server' },
  { label: 'Brain', value: 'fas fa-brain' },
  { label: 'Database', value: 'fas fa-database' },
  { label: 'Tools', value: 'fas fa-tools' },
  { label: 'Microchip', value: 'fas fa-microchip' },
  { label: 'Cloud', value: 'fas fa-cloud' },
  { label: 'Language', value: 'fas fa-language' },
  { label: 'Users', value: 'fas fa-users' },
  { label: 'Python', value: 'fab fa-python python-icon' },
  { label: 'React', value: 'fab fa-react react-icon' },
  { label: 'JavaScript', value: 'fab fa-js js-icon' },
  { label: 'Java', value: 'fab fa-java java-icon' },
  { label: 'HTML', value: 'fab fa-html5 html-icon' },
  { label: 'CSS', value: 'fab fa-css3-alt css-icon' },
  { label: 'Node.js', value: 'fab fa-node-js node-icon' },
  { label: 'Git', value: 'fab fa-git-alt' },
  { label: 'GitHub', value: 'fab fa-github' },
  { label: 'Robot', value: 'fas fa-robot' },
  { label: 'Terminal', value: 'fas fa-terminal' },
  { label: 'Lightbulb', value: 'fas fa-lightbulb' },
];

export const AdminSkills: React.FC = () => {
  const [categories, setCategories] = useState<SkillCategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Category Modal
  const [categoryModal, setCategoryModal] = useState<{
    isOpen: boolean;
    item: Partial<SkillCategoryItem> | null;
  }>({ isOpen: false, item: null });

  // Skill Modal
  const [skillModal, setSkillModal] = useState<{
    isOpen: boolean;
    categoryId: string;
    item: Partial<SkillItem> | null;
  }>({ isOpen: false, categoryId: '', item: null });

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'category' | 'skill';
    categoryId: string;
    skillId?: string;
    name: string;
  } | null>(null);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const data = await getSkills(true);
      setCategories(data);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to fetch skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Category Actions
  const handleOpenAddCategory = () => {
    setCategoryModal({
      isOpen: true,
      item: {
        name: '',
        icon: 'fas fa-code',
        order: categories.length + 1,
        status: 'published',
        skills: [],
      },
    });
  };

  const handleOpenEditCategory = (cat: SkillCategoryItem) => {
    setCategoryModal({
      isOpen: true,
      item: { ...cat },
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryModal.item?.name?.trim()) {
      showNotification('error', 'Category name is required.');
      return;
    }

    try {
      setSaving(true);
      await saveSkillCategory(categoryModal.item);
      showNotification('success', `Category "${categoryModal.item.name}" saved.`);
      setCategoryModal({ isOpen: false, item: null });
      await fetchSkills();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setSaving(true);
      if (deleteConfirm.type === 'category') {
        await deleteSkillCategory(deleteConfirm.categoryId);
        showNotification('success', `Category "${deleteConfirm.name}" deleted.`);
      } else if (deleteConfirm.type === 'skill' && deleteConfirm.skillId) {
        await deleteSkill(deleteConfirm.categoryId, deleteConfirm.skillId);
        showNotification('success', `Skill "${deleteConfirm.name}" removed.`);
      }
      setDeleteConfirm(null);
      await fetchSkills();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveCategoryOrder = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= categories.length) return;

    const list = [...categories];
    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;

    list.forEach((item, idx) => {
      item.order = idx + 1;
    });

    setCategories(list);
    try {
      await saveAllSkillCategories(list);
      showNotification('success', 'Category order updated.');
    } catch (err: any) {
      showNotification('error', 'Failed to update category order');
      await fetchSkills();
    }
  };

  // Skill Actions
  const handleOpenAddSkill = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    setSkillModal({
      isOpen: true,
      categoryId,
      item: {
        name: '',
        icon: 'fas fa-check-circle',
        order: (category?.skills.length || 0) + 1,
      },
    });
  };

  const handleOpenEditSkill = (categoryId: string, skill: SkillItem) => {
    setSkillModal({
      isOpen: true,
      categoryId,
      item: { ...skill },
    });
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillModal.item?.name?.trim()) {
      showNotification('error', 'Skill name is required.');
      return;
    }

    try {
      setSaving(true);
      await saveSkill(skillModal.categoryId, skillModal.item);
      showNotification('success', `Skill "${skillModal.item.name}" saved.`);
      setSkillModal({ isOpen: false, categoryId: '', item: null });
      await fetchSkills();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveSkillOrder = async (
    categoryId: string,
    skillIndex: number,
    direction: 'up' | 'down'
  ) => {
    const catIndex = categories.findIndex((c) => c.id === categoryId);
    if (catIndex === -1) return;

    const category = { ...categories[catIndex] };
    const skills = [...category.skills];
    const targetIndex = direction === 'up' ? skillIndex - 1 : skillIndex + 1;

    if (targetIndex < 0 || targetIndex >= skills.length) return;

    const temp = skills[skillIndex];
    skills[skillIndex] = skills[targetIndex];
    skills[targetIndex] = temp;

    skills.forEach((s, idx) => {
      s.order = idx + 1;
    });

    category.skills = skills;
    const updatedCategories = [...categories];
    updatedCategories[catIndex] = category;
    setCategories(updatedCategories);

    try {
      await saveAllSkillCategories(updatedCategories);
    } catch (err: any) {
      showNotification('error', 'Failed to reorder skill');
      await fetchSkills();
    }
  };

  const handleChangeSkillCategory = async (fromCatId: string, toCatId: string, skill: SkillItem) => {
    if (fromCatId === toCatId) return;

    try {
      setSaving(true);
      // Remove from old
      await deleteSkill(fromCatId, skill.id);
      // Add to new
      await saveSkill(toCatId, skill);
      showNotification('success', `Moved "${skill.name}" to new category.`);
      await fetchSkills();
    } catch (err: any) {
      showNotification('error', 'Failed to move skill to another category');
    } finally {
      setSaving(false);
    }
  };

  const totalSkillsCount = categories.reduce((acc, cat) => acc + (cat.skills?.length || 0), 0);

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', color: '#f4f4f5' }}>
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
            Technical &amp; Professional Skills Management
          </h1>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>
            Organize skills into categories, add new technical domains, reorder skills, and manage tags.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddCategory}
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
          <i className="fas fa-folder-plus"></i>
          <span>Create Category</span>
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

      {/* Stats Summary Bar */}
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
        }}
      >
        <div style={{ display: 'flex', gap: '20px', fontSize: '0.88rem', color: '#a1a1aa' }}>
          <div>
            Total Categories: <strong style={{ color: '#fff' }}>{categories.length}</strong>
          </div>
          <div>
            Total Skills: <strong style={{ color: '#60a5fa' }}>{totalSkillsCount}</strong>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#71717a' }}>
          Drag or use arrows to organize categories and skills
        </div>
      </div>

      {/* Categories & Skills Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3b82f6', marginBottom: '12px' }}></i>
          <p>Loading skill categories...</p>
        </div>
      ) : categories.length === 0 ? (
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
          <i className="fas fa-brain" style={{ fontSize: '3rem', marginBottom: '12px', color: '#3f3f46' }}></i>
          <h3 style={{ margin: '0 0 6px 0', color: '#d4d4d8' }}>No skill categories found</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Click &ldquo;Create Category&rdquo; to begin organizing your skills.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {categories.map((cat, catIdx) => (
            <div
              key={cat.id}
              style={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '14px',
                overflow: 'hidden',
              }}
            >
              {/* Category Header */}
              <div
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#121214',
                  borderBottom: '1px solid #27272a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Category Order Arrows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      type="button"
                      title="Move Category Up"
                      disabled={catIdx === 0}
                      onClick={() => handleMoveCategoryOrder(catIdx, 'up')}
                      style={{
                        background: '#27272a',
                        border: 'none',
                        borderRadius: '3px',
                        color: catIdx === 0 ? '#52525b' : '#d4d4d8',
                        cursor: catIdx === 0 ? 'not-allowed' : 'pointer',
                        padding: '2px 5px',
                        fontSize: '10px',
                      }}
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      title="Move Category Down"
                      disabled={catIdx === categories.length - 1}
                      onClick={() => handleMoveCategoryOrder(catIdx, 'down')}
                      style={{
                        background: '#27272a',
                        border: 'none',
                        borderRadius: '3px',
                        color: catIdx === categories.length - 1 ? '#52525b' : '#d4d4d8',
                        cursor: catIdx === categories.length - 1 ? 'not-allowed' : 'pointer',
                        padding: '2px 5px',
                        fontSize: '10px',
                      }}
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>

                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#60a5fa',
                      fontSize: '15px',
                    }}
                  >
                    <i className={cat.icon || 'fas fa-code'}></i>
                  </div>

                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>
                      {cat.name}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                      {cat.skills?.length || 0} skill(s)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenAddSkill(cat.id)}
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#60a5fa',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <i className="fas fa-plus"></i>
                    <span>Add Skill</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditCategory(cat)}
                    title="Rename / Edit Category"
                    style={{
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      color: '#e4e4e7',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fas fa-edit"></i>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirm({
                        type: 'category',
                        categoryId: cat.id,
                        name: cat.name,
                      })
                    }
                    title="Delete Category"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>

              {/* Skills List in Category */}
              <div style={{ padding: '18px 20px' }}>
                {(!cat.skills || cat.skills.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#71717a', fontSize: '0.88rem' }}>
                    No skills in this category yet. Click &ldquo;Add Skill&rdquo; to add technologies.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {cat.skills.map((skill, sIdx) => (
                      <div
                        key={skill.id}
                        style={{
                          backgroundColor: '#121214',
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.88rem',
                          color: '#e4e4e7',
                        }}
                      >
                        {skill.icon && (
                          <i className={skill.icon} style={{ color: '#60a5fa', fontSize: '14px' }}></i>
                        )}
                        <span style={{ fontWeight: 500 }}>{skill.name}</span>

                        {/* Skill Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '6px' }}>
                          <button
                            type="button"
                            title="Move Left"
                            disabled={sIdx === 0}
                            onClick={() => handleMoveSkillOrder(cat.id, sIdx, 'up')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: sIdx === 0 ? '#3f3f46' : '#71717a',
                              cursor: sIdx === 0 ? 'not-allowed' : 'pointer',
                              padding: '2px 3px',
                              fontSize: '10px',
                            }}
                          >
                            <i className="fas fa-chevron-left"></i>
                          </button>

                          <button
                            type="button"
                            title="Move Right"
                            disabled={sIdx === cat.skills.length - 1}
                            onClick={() => handleMoveSkillOrder(cat.id, sIdx, 'down')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: sIdx === cat.skills.length - 1 ? '#3f3f46' : '#71717a',
                              cursor: sIdx === cat.skills.length - 1 ? 'not-allowed' : 'pointer',
                              padding: '2px 3px',
                              fontSize: '10px',
                            }}
                          >
                            <i className="fas fa-chevron-right"></i>
                          </button>

                          <button
                            type="button"
                            title="Edit Skill"
                            onClick={() => handleOpenEditSkill(cat.id, skill)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#a1a1aa',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '11px',
                            }}
                          >
                            <i className="fas fa-pen"></i>
                          </button>

                          <button
                            type="button"
                            title="Delete Skill"
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'skill',
                                categoryId: cat.id,
                                skillId: skill.id,
                                name: skill.name,
                              })
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '11px',
                            }}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal (Create / Edit) */}
      {categoryModal.isOpen && categoryModal.item && (
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
          onClick={() => setCategoryModal({ isOpen: false, item: null })}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 18px 0', fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
              {categoryModal.item.id ? 'Edit Skill Category' : 'Create Skill Category'}
            </h2>

            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud &amp; Deployment, AI &amp; ML"
                  value={categoryModal.item.name || ''}
                  onChange={(e) =>
                    setCategoryModal({
                      ...categoryModal,
                      item: { ...categoryModal.item, name: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Font Awesome Icon Class
                </label>
                <input
                  type="text"
                  placeholder="e.g. fas fa-cloud or fas fa-code"
                  value={categoryModal.item.icon || ''}
                  onChange={(e) =>
                    setCategoryModal({
                      ...categoryModal,
                      item: { ...categoryModal.item, icon: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    marginBottom: '8px',
                  }}
                />
                {/* Icon Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {COMMON_ICONS.slice(0, 10).map((icon) => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() =>
                        setCategoryModal({
                          ...categoryModal,
                          item: { ...categoryModal.item, icon: icon.value },
                        })
                      }
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #27272a',
                        backgroundColor: categoryModal.item?.icon === icon.value ? '#2563eb' : '#121214',
                        color: categoryModal.item?.icon === icon.value ? '#fff' : '#a1a1aa',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className={icon.value}></i>
                      <span>{icon.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Display Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={categoryModal.item.order || 1}
                  onChange={(e) =>
                    setCategoryModal({
                      ...categoryModal,
                      item: { ...categoryModal.item, order: parseInt(e.target.value, 10) || 1 },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCategoryModal({ isOpen: false, item: null })}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#e4e4e7',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Skill Modal (Create / Edit) */}
      {skillModal.isOpen && skillModal.item && (
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
          onClick={() => setSkillModal({ isOpen: false, categoryId: '', item: null })}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 18px 0', fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
              {skillModal.item.id ? 'Edit Skill' : 'Add New Skill'}
            </h2>

            <form onSubmit={handleSaveSkill} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Target Category *
                </label>
                <select
                  value={skillModal.categoryId}
                  onChange={(e) => {
                    const newCatId = e.target.value;
                    if (skillModal.item?.id) {
                      // Move category assignment
                      handleChangeSkillCategory(skillModal.categoryId, newCatId, skillModal.item as SkillItem);
                      setSkillModal({ isOpen: false, categoryId: '', item: null });
                    } else {
                      setSkillModal({ ...skillModal, categoryId: newCatId });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Skill / Technology Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TypeScript, Docker, TensorFlow"
                  value={skillModal.item.name || ''}
                  onChange={(e) =>
                    setSkillModal({
                      ...skillModal,
                      item: { ...skillModal.item, name: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                  Icon Class (Font Awesome or custom)
                </label>
                <input
                  type="text"
                  placeholder="e.g. fab fa-python or fas fa-star"
                  value={skillModal.item.icon || ''}
                  onChange={(e) =>
                    setSkillModal({
                      ...skillModal,
                      item: { ...skillModal.item, icon: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#121214',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    marginBottom: '8px',
                  }}
                />
                {/* Skill Icon Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {COMMON_ICONS.slice(10).map((icon) => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() =>
                        setSkillModal({
                          ...skillModal,
                          item: { ...skillModal.item, icon: icon.value },
                        })
                      }
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #27272a',
                        backgroundColor: skillModal.item?.icon === icon.value ? '#2563eb' : '#121214',
                        color: skillModal.item?.icon === icon.value ? '#fff' : '#a1a1aa',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className={icon.value}></i>
                      <span>{icon.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setSkillModal({ isOpen: false, categoryId: '', item: null })}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#e4e4e7',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
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
          onClick={() => setDeleteConfirm(null)}
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
            <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1.2rem' }}>
              Delete {deleteConfirm.type === 'category' ? 'Category' : 'Skill'}?
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#a1a1aa', fontSize: '0.88rem', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong>&ldquo;{deleteConfirm.name}&rdquo;</strong>?
              {deleteConfirm.type === 'category' && ' All skills inside this category will also be removed.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
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
                onClick={handleConfirmDelete}
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
