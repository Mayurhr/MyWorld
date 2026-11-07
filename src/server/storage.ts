import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.resolve(DATA_DIR, 'portfolio-store.json');

// Bundled sources
const certificatesFilePath = path.resolve(__dirname, '../../certificates.json');
let bundledCerts: any[] = [];
try {
  if (fs.existsSync(certificatesFilePath)) {
    bundledCerts = JSON.parse(fs.readFileSync(certificatesFilePath, 'utf-8'));
  }
} catch (e) {
  console.warn('Failed reading certificates.json:', e);
}
import { projects as bundledProjects } from '../data/projects.ts';

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  cardDescription?: string;
  image: string;
  publicId?: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  storagePath?: string;
  category: string;
  tech: string[];
  cardTech?: string[];
  features?: string[];
  github?: string;
  demo?: string;
  videoDemo?: string;
  featured?: boolean;
  status: 'draft' | 'published';
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CertificateItem {
  id: string;
  title: string;
  issuer: string;
  year: string;
  category: string;
  featured: boolean;
  viewAchievement: boolean;
  driveLink: string;
  cloudinaryUrl?: string;
  publicId?: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  directPdfDelivery?: boolean;
  storagePath?: string;
  github?: string;
  presentation?: string;
  offerLetter?: string;
  demoVideo?: string;
  achievement?: any;
  status: 'draft' | 'published';
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

import {
  type QualificationItem,
  type SkillCategoryItem,
  type SkillItem,
  type SocialLinkItem,
  DEFAULT_QUALIFICATIONS,
  DEFAULT_SKILL_CATEGORIES,
  DEFAULT_SOCIAL_LINKS,
} from '../data/portfolioDefaults.ts';

export type {
  QualificationItem,
  SkillCategoryItem,
  SkillItem,
  SocialLinkItem,
};
export {
  DEFAULT_QUALIFICATIONS,
  DEFAULT_SKILL_CATEGORIES,
  DEFAULT_SOCIAL_LINKS,
};

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

export interface MediaAssetRecord {
  id: string;
  name: string;
  category: 'Profile' | 'Certificates' | 'Projects' | 'Events' | 'Resume' | 'Other';
  downloadUrl: string;
  cloudinaryUrl?: string;
  publicId: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  directPdfDelivery?: boolean;
  format?: string;
  storagePath?: string;
  mimeType: string;
  sizeBytes: number;
  status: 'draft' | 'published';
  linkedEntityType?: string;
  linkedEntityId?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  status: 'unread' | 'read';
  readAt?: string;
  ip?: string;
}

export interface AnalyticsEvent {
  id: string;
  eventType:
    | 'session_start'
    | 'page_view'
    | 'section_view'
    | 'engagement_heartbeat'
    | 'resume_view'
    | 'resume_download'
    | 'project_view'
    | 'project_link_click'
    | 'certificate_view'
    | 'social_click'
    | 'contact_submit_success'
    | 'contact_submit_error';
  visitorId: string;
  sessionId: string;
  timestamp: string; // ISO 8601 server timestamp
  targetId?: string; // e.g. section id, project title, certificate title, social platform
  targetType?: string; // e.g. 'section', 'project', 'certificate', 'social', 'resume'
  deviceCategory: 'desktop' | 'tablet' | 'mobile';
  referrer?: string;
  engagementSeconds?: number;
  metadata?: Record<string, any>;
  isTest?: boolean;
}

export interface PortfolioStore {
  projects: ProjectItem[];
  certificates: CertificateItem[];
  qualifications: QualificationItem[];
  skillCategories: SkillCategoryItem[];
  socialLinks: SocialLinkItem[];
  profile: ProfileData;
  resume: ResumeData;
  mediaAssets?: MediaAssetRecord[];
  messages?: ContactMessage[];
  analyticsEvents?: AnalyticsEvent[];
  analyticsResetAt?: number;
  lastUpdated: string;
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



/**
 * Initializes store from bundled data if not already existing.
 */
function initializeDefaultStore(): PortfolioStore {
  const initialProjects: ProjectItem[] = bundledProjects.map((p, idx) => ({
    id: `proj_${String(idx + 1).padStart(3, '0')}`,
    ...p,
    status: 'published',
    order: idx + 1,
    featured: idx === 0,
  }));

  const initialCertificates: CertificateItem[] = (bundledCerts as any[]).map((c, idx) => ({
    id: `cert_${String(idx + 1).padStart(3, '0')}`,
    title: c.title,
    issuer: c.issuer,
    year: String(c.year),
    category: c.category || 'Activity',
    featured: Boolean(c.featured),
    viewAchievement: Boolean(c.viewAchievement),
    driveLink: c.driveLink || '',
    github: c.github || c.achievement?.github || '',
    presentation: c.presentation || c.achievement?.presentation || '',
    offerLetter: c.offerLetter || c.achievement?.offerLetter || '',
    demoVideo: c.demoVideo || c.achievement?.demoVideo || '',
    achievement: c.achievement || null,
    status: 'published',
    order: idx + 1,
  }));

  return {
    projects: initialProjects,
    certificates: initialCertificates,
    qualifications: DEFAULT_QUALIFICATIONS,
    skillCategories: DEFAULT_SKILL_CATEGORIES,
    socialLinks: DEFAULT_SOCIAL_LINKS,
    profile: DEFAULT_PROFILE,
    resume: DEFAULT_RESUME,
    lastUpdated: new Date().toISOString(),
  };
}

export function loadStore(): PortfolioStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.projects && parsed.certificates) {
        let needsSave = false;

        if (!parsed.qualifications || !Array.isArray(parsed.qualifications) || parsed.qualifications.length === 0) {
          parsed.qualifications = DEFAULT_QUALIFICATIONS;
          needsSave = true;
        }

        if (!parsed.skillCategories || !Array.isArray(parsed.skillCategories) || parsed.skillCategories.length === 0) {
          parsed.skillCategories = DEFAULT_SKILL_CATEGORIES;
          needsSave = true;
        }

        if (!parsed.socialLinks || !Array.isArray(parsed.socialLinks) || parsed.socialLinks.length === 0) {
          parsed.socialLinks = DEFAULT_SOCIAL_LINKS;
          needsSave = true;
        }

        if (!Array.isArray(parsed.mediaAssets)) {
          parsed.mediaAssets = [];
          needsSave = true;
        } else {
          parsed.mediaAssets = parsed.mediaAssets.map((m: any) => {
            const publicId = m?.publicId || m?.storagePath || m?.id;
            if (!m?.publicId && publicId) {
              needsSave = true;
            }
            return {
              ...m,
              publicId,
            };
          });
        }

        if (!Array.isArray(parsed.messages)) {
          parsed.messages = [];
          needsSave = true;
        } else {
          parsed.messages = parsed.messages.map((m: any) => {
            const readFlag = Boolean(m?.isRead) || m?.status === 'read';
            if (typeof m?.isRead !== 'boolean' || (m?.status !== 'read' && m?.status !== 'unread')) {
              needsSave = true;
            }
            return {
              ...m,
              isRead: readFlag,
              status: readFlag ? 'read' : 'unread',
              readAt: readFlag ? (m.readAt || m.timestamp) : undefined,
            };
          });
        }

        if (needsSave) {
          saveStore(parsed);
        }

        return parsed as PortfolioStore;
      }
    }
  } catch (err) {
    console.error('[Store] Error reading store file:', err);
  }

  // Generate and persist default store
  const store = initializeDefaultStore();
  saveStore(store);
  return store;
}

export function saveStore(store: PortfolioStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to write store file:', err);
    throw err;
  }
}
