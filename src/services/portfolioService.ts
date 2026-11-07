import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Certificate, Project } from '../types';
import bundledCertificates from '../data/certificates.json';
import { projects as bundledProjects } from '../data/projects';
import { sortCertificatesByPriority } from './certificateService';
import {
  DEFAULT_QUALIFICATIONS,
  DEFAULT_SKILL_CATEGORIES,
  DEFAULT_SOCIAL_LINKS,
  QualificationItem,
  SkillCategoryItem,
  SkillItem,
  SocialLinkItem,
} from '../data/portfolioDefaults';
import {
  auth,
  db,
  isFirebaseAuthorizedAdmin,
  OperationType,
  handleFirestoreError,
} from './firebase';

export type {
  QualificationItem,
  SkillCategoryItem,
  SkillItem,
  SocialLinkItem,
};

export interface ProjectItem extends Project {
  id: string;
  publicId?: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  storagePath?: string;
  status: 'draft' | 'published';
  order: number;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CertificateItem extends Certificate {
  id: string;
  cloudinaryUrl?: string;
  publicId?: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  directPdfDelivery?: boolean;
  storagePath?: string;
  status: 'draft' | 'published';
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileData {
  id: string;
  name: string;
  tagline: string;
  aboutParagraphs: string[];
  profileImageUrl: string;
  profileImagePublicId?: string;
  profileImageResourceType?: 'image' | 'raw' | 'video';
  profileImageStoragePath?: string;
  status: 'draft' | 'published';
  updatedAt?: string;
}

export interface ResumeHistoryEntry {
  id: string;
  fileName: string;
  resumePdfUrl: string;
  downloadUrl: string;
  cloudinaryUrl?: string;
  publicId?: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  directPdfDelivery?: boolean;
  storagePath?: string;
  sizeBytes?: number;
  source: 'cloudinary' | 'firebase' | 'drive' | 'url';
  savedAt: string;
}

export interface ResumeData {
  id: string;
  resumePdfUrl: string;
  downloadUrl: string;
  cloudinaryUrl?: string;
  fileName?: string;
  publicId?: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  directPdfDelivery?: boolean;
  storagePath?: string;
  sizeBytes?: number;
  history?: ResumeHistoryEntry[];
  status: 'draft' | 'published';
  updatedAt?: string;
}

const DEFAULT_PROFILE: ProfileData = {
  id: 'main',
  name: 'Mayur H R',
  tagline: '"Passionate about Learning & Growth"',
  aboutParagraphs: [
    "I'm a Web Developer from Honnali, Davanagere, passionate about creating functional and user-friendly websites. I enjoy turning ideas into reality through clean code and intuitive designs.",
    "My focus is on building responsive websites that deliver great user experiences. I pay attention to details and ensure my work meets both technical requirements and design standards.",
  ],
  profileImageUrl:
    'https://drive.google.com/thumbnail?id=1EUeICFZ7u0iSG1M5HDmMMpz19uExqvo-&sz=w2000',
  status: 'published',
};

const DEFAULT_RESUME: ResumeData = {
  id: 'main',
  resumePdfUrl: 'https://drive.google.com/file/d/1mQIj4WNOSE7aTStKP8wON80vGggYgZeY/preview',
  downloadUrl: 'https://drive.google.com/uc?export=download&id=1mQIj4WNOSE7aTStKP8wON80vGggYgZeY',
  status: 'published',
};

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('admin_session_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function canWriteFirestoreAsAdmin(): boolean {
  return isFirebaseAuthorizedAdmin(auth.currentUser);
}

/**
 * Ensures a Firestore collection has the baseline records from the backend store
 * before single-item admin edits are written, preventing partial-collection shadowing.
 */
async function ensureCollectionSeededInFirestore(
  collectionName: 'projects' | 'certificates' | 'qualifications' | 'skills' | 'socialLinks'
): Promise<void> {
  if (!canWriteFirestoreAsAdmin()) return;

  try {
    const existingSnap = await getDocs(collection(db, collectionName));
    if (!existingSnap.empty) return;

    const endpointMap: Record<typeof collectionName, string> = {
      projects: '/api/admin/projects',
      certificates: '/api/admin/certificates',
      qualifications: '/api/admin/qualifications',
      skills: '/api/admin/skills',
      socialLinks: '/api/admin/social-links',
    };

    const res = await fetch(endpointMap[collectionName], {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) return;

    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    const batch = writeBatch(db);
    for (const item of items) {
      if (item?.id) {
        batch.set(doc(db, collectionName, item.id), stripUndefinedDeep(item));
      }
    }
    await batch.commit();
  } catch (err) {
    console.warn(`[Firestore] Pre-seed check for ${collectionName} skipped:`, err);
  }
}

function getMaxUpdatedTime(items: Array<{ updatedAt?: string; createdAt?: string }>): number {
  let maxTs = 0;
  for (const item of items) {
    const raw = item?.updatedAt || item?.createdAt;
    if (raw) {
      const ts = new Date(raw).getTime();
      if (Number.isFinite(ts) && ts > maxTs) {
        maxTs = ts;
      }
    }
  }
  return maxTs;
}

function shouldPreferApiList<T extends { updatedAt?: string; createdAt?: string }>(
  fsList: T[],
  apiList: T[]
): boolean {
  if (apiList.length === 0) return false;
  if (fsList.length === 0) return true;
  const fsMax = getMaxUpdatedTime(fsList);
  const apiMax = getMaxUpdatedTime(apiList);
  if (apiMax > fsMax) return true;
  if (!canWriteFirestoreAsAdmin() && fsList.length !== apiList.length && apiMax >= fsMax) {
    return true;
  }
  return false;
}

// ==========================================
// Projects API
// ==========================================

export async function getProjects(includeDrafts = false): Promise<ProjectItem[]> {
  let fsList: ProjectItem[] = [];
  let apiList: ProjectItem[] = [];

  await Promise.all([
    (async () => {
      try {
        const isAdminReader = includeDrafts && canWriteFirestoreAsAdmin();
        const q = isAdminReader
          ? collection(db, 'projects')
          : query(collection(db, 'projects'), where('status', '==', 'published'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          fsList = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ProjectItem, 'id'>),
            }))
            .sort((a, b) => (a.order || 999) - (b.order || 999));
        }
      } catch (err) {
        if (includeDrafts && canWriteFirestoreAsAdmin()) {
          handleFirestoreError(err, OperationType.LIST, 'projects');
        }
        console.warn('[getProjects] Firestore read fallback to API:', err);
      }
    })(),
    (async () => {
      try {
        const url = includeDrafts ? '/api/admin/projects' : '/api/public/projects';
        const res = await fetch(url, {
          headers: includeDrafts ? getAuthHeaders() : {},
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            apiList = data;
          }
        }
      } catch (err) {
        console.warn('[getProjects] API fetch failed:', err);
      }
    })(),
  ]);

  if (shouldPreferApiList(fsList, apiList)) {
    return apiList;
  }
  if (fsList.length > 0) {
    return fsList;
  }
  if (apiList.length > 0) {
    return apiList;
  }

  return bundledProjects.map((p, idx) => ({
    id: `bundled-proj-${idx}`,
    ...p,
    status: 'published',
    order: idx + 1,
    featured: idx === 0,
  }));
}

export async function saveProject(project: Partial<ProjectItem>): Promise<string> {
  const res = await fetch('/api/admin/projects', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(project),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save project' }));
    throw new Error(err.error || 'Failed to save project');
  }

  const data = await res.json();
  const savedProject: ProjectItem = data.project;
  const id = savedProject?.id || project.id || '';

  if (canWriteFirestoreAsAdmin() && id) {
    await ensureCollectionSeededInFirestore('projects');
    try {
      await setDoc(doc(db, 'projects', id), stripUndefinedDeep(savedProject));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `projects/${id}`);
    }
  }

  return id;
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete project' }));
    throw new Error(err.error || 'Failed to delete project');
  }

  if (canWriteFirestoreAsAdmin() && projectId) {
    await ensureCollectionSeededInFirestore('projects');
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
    }
  }
}

// ==========================================
// Certificates API
// ==========================================

export async function getCertificates(includeDrafts = false): Promise<CertificateItem[]> {
  let fsList: CertificateItem[] = [];
  let apiList: CertificateItem[] = [];

  await Promise.all([
    (async () => {
      try {
        const isAdminReader = includeDrafts && canWriteFirestoreAsAdmin();
        const q = isAdminReader
          ? collection(db, 'certificates')
          : query(collection(db, 'certificates'), where('status', '==', 'published'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CertificateItem, 'id'>),
          }));
          fsList = sortCertificatesByPriority(list) as CertificateItem[];
        }
      } catch (err) {
        if (includeDrafts && canWriteFirestoreAsAdmin()) {
          handleFirestoreError(err, OperationType.LIST, 'certificates');
        }
        console.warn('[getCertificates] Firestore read fallback to API:', err);
      }
    })(),
    (async () => {
      try {
        const url = includeDrafts ? '/api/admin/certificates' : '/api/public/certificates';
        const res = await fetch(url, {
          headers: includeDrafts ? getAuthHeaders() : {},
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            apiList = sortCertificatesByPriority(data) as CertificateItem[];
          }
        }
      } catch (err) {
        console.warn('[getCertificates] API fetch failed:', err);
      }
    })(),
  ]);

  if (shouldPreferApiList(fsList, apiList)) {
    return apiList;
  }
  if (fsList.length > 0) {
    return fsList;
  }
  if (apiList.length > 0) {
    return apiList;
  }

  const authoritative = sortCertificatesByPriority(bundledCertificates as Certificate[]);
  return authoritative.map((c, idx) => ({
    id: `bundled-cert-${idx}`,
    ...c,
    status: 'published',
    order: idx + 1,
  }));
}

export async function saveCertificate(cert: Partial<CertificateItem>): Promise<string> {
  const res = await fetch('/api/admin/certificates', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(cert),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save certificate' }));
    throw new Error(err.error || 'Failed to save certificate');
  }

  const data = await res.json();
  const savedCert: CertificateItem = data.certificate;
  const id = savedCert?.id || cert.id || '';

  if (canWriteFirestoreAsAdmin() && id) {
    await ensureCollectionSeededInFirestore('certificates');
    try {
      await setDoc(doc(db, 'certificates', id), stripUndefinedDeep(savedCert));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `certificates/${id}`);
    }
  }

  return id;
}

export async function deleteCertificate(certId: string): Promise<void> {
  const res = await fetch(`/api/admin/certificates/${encodeURIComponent(certId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete certificate' }));
    throw new Error(err.error || 'Failed to delete certificate');
  }

  if (canWriteFirestoreAsAdmin() && certId) {
    await ensureCollectionSeededInFirestore('certificates');
    try {
      await deleteDoc(doc(db, 'certificates', certId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `certificates/${certId}`);
    }
  }
}

// ==========================================
// Qualifications Management API
// ==========================================

export async function getQualifications(includeDrafts = false): Promise<QualificationItem[]> {
  try {
    const isAdminReader = includeDrafts && canWriteFirestoreAsAdmin();
    const q = isAdminReader
      ? collection(db, 'qualifications')
      : query(collection(db, 'qualifications'), where('status', '==', 'published'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QualificationItem, 'id'>),
      }));
      return list.sort((a, b) => (a.order || 999) - (b.order || 999));
    }
  } catch (err) {
    if (includeDrafts && canWriteFirestoreAsAdmin()) {
      handleFirestoreError(err, OperationType.LIST, 'qualifications');
    }
  }

  try {
    const url = includeDrafts ? '/api/admin/qualifications' : '/api/public/qualifications';
    const res = await fetch(url, {
      headers: includeDrafts ? getAuthHeaders() : {},
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[getQualifications] API fetch failed, using fallback:', err);
  }

  return DEFAULT_QUALIFICATIONS;
}

export async function saveQualification(qualification: Partial<QualificationItem>): Promise<QualificationItem> {
  const res = await fetch('/api/admin/qualifications', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(qualification),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save qualification' }));
    throw new Error(err.error || 'Failed to save qualification');
  }

  const data = await res.json();
  const saved: QualificationItem = data.qualification;

  if (canWriteFirestoreAsAdmin() && saved?.id) {
    await ensureCollectionSeededInFirestore('qualifications');
    try {
      await setDoc(doc(db, 'qualifications', saved.id), stripUndefinedDeep(saved));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `qualifications/${saved.id}`);
    }
  }

  return saved;
}

export async function deleteQualification(id: string): Promise<void> {
  const res = await fetch(`/api/admin/qualifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete qualification' }));
    throw new Error(err.error || 'Failed to delete qualification');
  }

  if (canWriteFirestoreAsAdmin() && id) {
    await ensureCollectionSeededInFirestore('qualifications');
    try {
      await deleteDoc(doc(db, 'qualifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `qualifications/${id}`);
    }
  }
}

// ==========================================
// Skills Management API
// ==========================================

export async function getSkills(includeDrafts = false): Promise<SkillCategoryItem[]> {
  try {
    const isAdminReader = includeDrafts && canWriteFirestoreAsAdmin();
    const q = isAdminReader
      ? collection(db, 'skills')
      : query(collection(db, 'skills'), where('status', '==', 'published'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SkillCategoryItem, 'id'>),
      }));
      return list.sort((a, b) => (a.order || 999) - (b.order || 999));
    }
  } catch (err) {
    if (includeDrafts && canWriteFirestoreAsAdmin()) {
      handleFirestoreError(err, OperationType.LIST, 'skills');
    }
  }

  try {
    const url = includeDrafts ? '/api/admin/skills' : '/api/public/skills';
    const res = await fetch(url, {
      headers: includeDrafts ? getAuthHeaders() : {},
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[getSkills] API fetch failed, using fallback:', err);
  }

  return DEFAULT_SKILL_CATEGORIES;
}

export async function saveSkillCategory(category: Partial<SkillCategoryItem>): Promise<SkillCategoryItem> {
  const res = await fetch('/api/admin/skill-category', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(category),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save skill category' }));
    throw new Error(err.error || 'Failed to save skill category');
  }

  const data = await res.json();
  const saved: SkillCategoryItem = data.category;

  if (canWriteFirestoreAsAdmin() && saved?.id) {
    await ensureCollectionSeededInFirestore('skills');
    try {
      await setDoc(doc(db, 'skills', saved.id), stripUndefinedDeep(saved));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `skills/${saved.id}`);
    }
  }

  return saved;
}

export async function deleteSkillCategory(id: string): Promise<void> {
  const res = await fetch(`/api/admin/skill-category/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete skill category' }));
    throw new Error(err.error || 'Failed to delete skill category');
  }

  if (canWriteFirestoreAsAdmin() && id) {
    await ensureCollectionSeededInFirestore('skills');
    try {
      await deleteDoc(doc(db, 'skills', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `skills/${id}`);
    }
  }
}

export async function saveSkill(categoryId: string, skill: Partial<SkillItem>): Promise<SkillItem> {
  const res = await fetch('/api/admin/skill', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ categoryId, skill }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save skill' }));
    throw new Error(err.error || 'Failed to save skill');
  }

  const data = await res.json();
  if (canWriteFirestoreAsAdmin() && data.category?.id) {
    await ensureCollectionSeededInFirestore('skills');
    try {
      await setDoc(doc(db, 'skills', data.category.id), stripUndefinedDeep(data.category));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `skills/${data.category.id}`);
    }
  }

  return data.skill;
}

export async function deleteSkill(categoryId: string, skillId: string): Promise<void> {
  const res = await fetch('/api/admin/skill', {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ categoryId, skillId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete skill' }));
    throw new Error(err.error || 'Failed to delete skill');
  }

  if (canWriteFirestoreAsAdmin() && categoryId) {
    await ensureCollectionSeededInFirestore('skills');
    try {
      const catDoc = await getDoc(doc(db, 'skills', categoryId));
      if (catDoc.exists()) {
        const catData = catDoc.data() as SkillCategoryItem;
        await setDoc(
          doc(db, 'skills', categoryId),
          stripUndefinedDeep({
            ...catData,
            skills: (catData.skills || []).filter((s) => s.id !== skillId),
          })
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `skills/${categoryId}`);
    }
  }
}

export async function saveAllSkillCategories(categories: SkillCategoryItem[]): Promise<void> {
  const res = await fetch('/api/admin/skills', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ categories }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save skills' }));
    throw new Error(err.error || 'Failed to save skills');
  }

  if (canWriteFirestoreAsAdmin()) {
    try {
      const batch = writeBatch(db);
      for (const cat of categories) {
        if (cat.id) {
          batch.set(doc(db, 'skills', cat.id), stripUndefinedDeep(cat));
        }
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'skills');
    }
  }
}

// ==========================================
// Connect With Me / Social Links API
// ==========================================

export async function getSocialLinks(includeAll = false): Promise<SocialLinkItem[]> {
  try {
    const isAdminReader = includeAll && canWriteFirestoreAsAdmin();
    const q = isAdminReader
      ? collection(db, 'socialLinks')
      : query(collection(db, 'socialLinks'), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SocialLinkItem, 'id'>),
      }));
      return list.sort((a, b) => (a.order || 999) - (b.order || 999));
    }
  } catch (err) {
    if (includeAll && canWriteFirestoreAsAdmin()) {
      handleFirestoreError(err, OperationType.LIST, 'socialLinks');
    }
  }

  try {
    const url = includeAll ? '/api/admin/social-links' : '/api/public/social-links';
    const res = await fetch(url, {
      headers: includeAll ? getAuthHeaders() : {},
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[getSocialLinks] API fetch failed, using fallback:', err);
  }

  return DEFAULT_SOCIAL_LINKS;
}

export async function saveSocialLink(link: Partial<SocialLinkItem>): Promise<SocialLinkItem> {
  const res = await fetch('/api/admin/social-links', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(link),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save social link' }));
    throw new Error(err.error || 'Failed to save social link');
  }

  const data = await res.json();
  const saved: SocialLinkItem = data.link;

  if (canWriteFirestoreAsAdmin() && saved?.id) {
    await ensureCollectionSeededInFirestore('socialLinks');
    try {
      await setDoc(doc(db, 'socialLinks', saved.id), stripUndefinedDeep(saved));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `socialLinks/${saved.id}`);
    }
  }

  return saved;
}

export async function deleteSocialLink(id: string): Promise<void> {
  const res = await fetch(`/api/admin/social-links/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete social link' }));
    throw new Error(err.error || 'Failed to delete social link');
  }

  if (canWriteFirestoreAsAdmin() && id) {
    await ensureCollectionSeededInFirestore('socialLinks');
    try {
      await deleteDoc(doc(db, 'socialLinks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `socialLinks/${id}`);
    }
  }
}

// ==========================================
// Profile & Resume API
// ==========================================

export async function getProfile(includeDrafts = false): Promise<ProfileData> {
  let fsProfile: ProfileData | null = null;
  let apiProfile: ProfileData | null = null;

  await Promise.all([
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'profile', 'main'));
        if (snap.exists()) {
          const data = snap.data() as ProfileData;
          if (data && data.name && (includeDrafts || data.status === 'published')) {
            fsProfile = { ...data, id: 'main' };
          }
        }
      } catch (err) {
        if (includeDrafts && canWriteFirestoreAsAdmin()) {
          handleFirestoreError(err, OperationType.GET, 'profile/main');
        }
      }
    })(),
    (async () => {
      try {
        const url = includeDrafts ? '/api/admin/profile' : '/api/public/profile';
        const res = await fetch(url, {
          headers: includeDrafts ? getAuthHeaders() : {},
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.name && (includeDrafts || data.status === 'published')) {
            apiProfile = data;
          }
        }
      } catch (err) {
        console.warn('[getProfile] API fetch failed:', err);
      }
    })(),
  ]);

  if (fsProfile && apiProfile) {
    const fsTime = new Date((fsProfile as ProfileData).updatedAt || 0).getTime();
    const apiTime = new Date((apiProfile as ProfileData).updatedAt || 0).getTime();
    return apiTime > fsTime ? apiProfile : fsProfile;
  }

  return fsProfile || apiProfile || DEFAULT_PROFILE;
}

export async function saveProfile(profile: Partial<ProfileData>): Promise<ProfileData> {
  const res = await fetch('/api/admin/profile', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(profile),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save profile' }));
    throw new Error(err.error || 'Failed to save profile');
  }

  const data = await res.json();
  const savedProfile: ProfileData = { ...(data.profile || profile), id: 'main' };

  if (canWriteFirestoreAsAdmin()) {
    try {
      await setDoc(doc(db, 'profile', 'main'), stripUndefinedDeep(savedProfile));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'profile/main');
    }
  }

  return savedProfile;
}

export async function getResume(includeDrafts = false): Promise<ResumeData> {
  let fsResume: ResumeData | null = null;
  let apiResume: ResumeData | null = null;

  await Promise.all([
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'resume', 'main'));
        if (snap.exists()) {
          const data = snap.data() as ResumeData;
          if (data && data.resumePdfUrl && (includeDrafts || data.status === 'published')) {
            fsResume = { ...data, id: 'main' };
          }
        }
      } catch (err) {
        if (includeDrafts && canWriteFirestoreAsAdmin()) {
          handleFirestoreError(err, OperationType.GET, 'resume/main');
        }
      }
    })(),
    (async () => {
      try {
        const url = includeDrafts ? '/api/admin/resume' : '/api/public/resume';
        const res = await fetch(url, {
          headers: includeDrafts ? getAuthHeaders() : {},
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.resumePdfUrl && (includeDrafts || data.status === 'published')) {
            apiResume = data;
          }
        }
      } catch (err) {
        console.warn('[getResume] API fetch failed:', err);
      }
    })(),
  ]);

  if (fsResume && apiResume) {
    const fsTime = new Date((fsResume as ResumeData).updatedAt || 0).getTime();
    const apiTime = new Date((apiResume as ResumeData).updatedAt || 0).getTime();
    return apiTime > fsTime ? apiResume : fsResume;
  }

  return fsResume || apiResume || DEFAULT_RESUME;
}

export async function saveResume(resume: Partial<ResumeData>): Promise<ResumeData> {
  const res = await fetch('/api/admin/resume', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(resume),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save resume' }));
    throw new Error(err.error || 'Failed to save resume');
  }

  const data = await res.json();
  const savedResume: ResumeData = { ...(data.resume || resume), id: 'main' };

  if (canWriteFirestoreAsAdmin()) {
    try {
      await setDoc(doc(db, 'resume', 'main'), stripUndefinedDeep(savedResume));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'resume/main');
    }
  }

  return savedResume;
}

/**
 * Syncs missing baseline portfolio collections into Cloud Firestore without overwriting
 * existing Firestore records unless force=true.
 */
export async function syncPortfolioStoreToFirestore(force = false): Promise<void> {
  if (!canWriteFirestoreAsAdmin()) return;

  try {
    const backupRes = await fetch('/api/admin/backup', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!backupRes.ok) return;
    const store = await backupRes.json();

    const batch = writeBatch(db);
    let ops = 0;

    // 1. Profile
    const profileSnap = await getDoc(doc(db, 'profile', 'main'));
    if ((force || !profileSnap.exists()) && store.profile) {
      batch.set(doc(db, 'profile', 'main'), stripUndefinedDeep({ ...store.profile, id: 'main' }));
      ops++;
    }

    // 2. Resume
    const resumeSnap = await getDoc(doc(db, 'resume', 'main'));
    if ((force || !resumeSnap.exists()) && store.resume) {
      batch.set(doc(db, 'resume', 'main'), stripUndefinedDeep({ ...store.resume, id: 'main' }));
      ops++;
    }

    // 3. Projects
    const projSnap = await getDocs(collection(db, 'projects'));
    if ((force || projSnap.empty) && Array.isArray(store.projects)) {
      for (const p of store.projects) {
        if (p?.id) {
          batch.set(doc(db, 'projects', p.id), stripUndefinedDeep(p));
          ops++;
        }
      }
    }

    // 4. Certificates
    const certSnap = await getDocs(collection(db, 'certificates'));
    if ((force || certSnap.empty) && Array.isArray(store.certificates)) {
      for (const c of store.certificates) {
        if (c?.id) {
          batch.set(doc(db, 'certificates', c.id), stripUndefinedDeep(c));
          ops++;
        }
      }
    }

    // 5. Qualifications
    const qualSnap = await getDocs(collection(db, 'qualifications'));
    if ((force || qualSnap.empty) && Array.isArray(store.qualifications)) {
      for (const q of store.qualifications) {
        if (q?.id) {
          batch.set(doc(db, 'qualifications', q.id), stripUndefinedDeep(q));
          ops++;
        }
      }
    }

    // 6. Skills
    const skillSnap = await getDocs(collection(db, 'skills'));
    if ((force || skillSnap.empty) && Array.isArray(store.skillCategories)) {
      for (const s of store.skillCategories) {
        if (s?.id) {
          batch.set(doc(db, 'skills', s.id), stripUndefinedDeep(s));
          ops++;
        }
      }
    }

    // 7. Social Links
    const socialSnap = await getDocs(collection(db, 'socialLinks'));
    if ((force || socialSnap.empty) && Array.isArray(store.socialLinks)) {
      for (const l of store.socialLinks) {
        if (l?.id) {
          batch.set(doc(db, 'socialLinks', l.id), stripUndefinedDeep(l));
          ops++;
        }
      }
    }

    if (ops > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('[Firestore] Background store sync warning:', err);
  }
}

export async function seedInitialPortfolioData(force = false): Promise<{
  certificatesSeeded: number;
  projectsSeeded: number;
  qualificationsSeeded: number;
  skillsSeeded: number;
  socialLinksSeeded: number;
}> {
  const res = await fetch('/api/admin/seed', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ force }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Synchronization failed' }));
    throw new Error(err.error || 'Synchronization failed');
  }

  const data = await res.json();

  if (canWriteFirestoreAsAdmin()) {
    await syncPortfolioStoreToFirestore(force);
  }

  return {
    certificatesSeeded: data.certificatesCount || 49,
    projectsSeeded: data.projectsCount || 8,
    qualificationsSeeded: data.qualificationsCount || 3,
    skillsSeeded: data.skillsCount || 9,
    socialLinksSeeded: data.socialLinksCount || 7,
  };
}

export async function exportPortfolioBackup(): Promise<string> {
  const res = await fetch('/api/admin/backup', {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to generate portfolio backup');
  }

  const data = await res.json();
  return JSON.stringify(data, null, 2);
}

export const portfolioService = {
  getQualifications,
  saveQualification,
  deleteQualification,
  getSkills,
  saveSkillCategory,
  deleteSkillCategory,
  saveSkill,
  deleteSkill,
  saveAllSkillCategories,
  getSocialLinks,
  saveSocialLink,
  deleteSocialLink,
  getProjects,
  saveProject,
  deleteProject,
  getCertificates,
  saveCertificate,
  deleteCertificate,
  getProfile,
  saveProfile,
  getResume,
  saveResume,
  seedInitialPortfolioData,
  syncPortfolioStoreToFirestore,
  exportPortfolioBackup,
  getAdminQualifications: () => getQualifications(true),
  getAdminSkills: () => getSkills(true),
  getAdminSocialLinks: () => getSocialLinks(true),
};
