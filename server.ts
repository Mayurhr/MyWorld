import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  verifyAdminCredentials,
  createAdminSession,
  getAdminSession,
  destroyAdminSession,
  extractAdminToken,
  requireAdminAuth,
  getAdminAccountInfo,
  updateAdminUsername,
  updateAdminPassword,
} from './src/server/auth.ts';
import {
  loadStore,
  saveStore,
  type ProjectItem,
  type CertificateItem,
  type ProfileData,
  type ResumeData,
  type ResumeHistoryEntry,
  type MediaAssetRecord,
  type QualificationItem,
  type SkillCategoryItem,
  type SkillItem,
  type SocialLinkItem,
  type ContactMessage,
  type AnalyticsEvent,
} from './src/server/storage.ts';
import { handleMayuAiChat, type ChatMessage } from './src/server/mayuAi.ts';
import {
  filterEventsByDateRange,
  calculateAnalyticsMetrics,
} from './src/server/analyticsService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.disable('x-powered-by');

// ==========================================
// Authentication Endpoints
// ==========================================

function getClientIp(req: express.Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function setAdminSessionCookie(res: express.Response, token: string): void {
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

// Connected SSE response streams for real-time admin message notifications
const adminMessageSseClients = new Set<express.Response>();

function sanitizeAdminMessage(msg: ContactMessage) {
  return {
    id: msg.id,
    name: msg.name,
    email: msg.email,
    subject: msg.subject,
    message: msg.message,
    timestamp: msg.timestamp,
    isRead: Boolean(msg.isRead),
    status: msg.isRead ? 'read' : 'unread',
    readAt: msg.readAt,
  };
}

function broadcastAdminMessageEvent(payload: Record<string, any>): void {
  const serialized = `data: ${JSON.stringify(payload)}\n\n`;
  for (const clientRes of adminMessageSseClients) {
    try {
      clientRes.write(serialized);
    } catch {
      adminMessageSseClients.delete(clientRes);
    }
  }
}

/**
 * POST /api/admin/login
 * Verifies username and password using bcrypt with rate-limiting.
 */
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const clientIp = getClientIp(req);
  const rateLimitKey = `${clientIp}_${String(username || '').toLowerCase()}`;

  // 1. Check Rate Limiting
  const rateLimitStatus = checkRateLimit(rateLimitKey);
  if (!rateLimitStatus.allowed) {
    res.status(429).json({
      error: rateLimitStatus.message,
      locked: true,
    });
    return;
  }

  // 2. Validate Credentials with bcrypt
  const result = await verifyAdminCredentials(username, password);
  if (!result.success) {
    const attempt = recordFailedAttempt(rateLimitKey);
    const msg = attempt.locked
      ? 'Too many failed attempts. Account login has been locked for 15 minutes.'
      : `Invalid username or password. ${attempt.remaining} attempt(s) remaining before temporary lockout.`;

    res.status(401).json({
      error: msg,
      remainingAttempts: attempt.remaining,
      locked: attempt.locked,
    });
    return;
  }

  // 3. Reset rate limit counter on success
  resetRateLimit(rateLimitKey);

  // 4. Create Cryptographic Session
  const session = createAdminSession(
    { username: result.canonicalUsername || String(username).trim(), role: 'admin' },
    clientIp
  );

  // 5. Set Secure HTTP-only Cookie
  setAdminSessionCookie(res, session.token);

  res.json({
    success: true,
    message: 'Authentication successful',
    user: session.user,
    token: session.token,
  });
});

/**
 * GET /api/admin/me
 * Checks if current session is active and valid.
 */
app.get('/api/admin/me', (req, res) => {
  const token = extractAdminToken(req, false);
  const session = getAdminSession(token);
  if (!session) {
    res.status(401).json({
      authenticated: false,
      error: 'Not authenticated',
    });
    return;
  }

  res.json({
    authenticated: true,
    user: session.user,
  });
});

/**
 * GET /api/admin/account
 * Returns current admin account info (never returns password hashes).
 */
app.get('/api/admin/account', requireAdminAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(getAdminAccountInfo());
});

/**
 * POST /api/admin/logout
 * Destroys session and clears cookie.
 */
app.post('/api/admin/logout', (req, res) => {
  const token = extractAdminToken(req, false);
  destroyAdminSession(token);

  res.clearCookie('admin_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * POST /api/admin/change-username
 * Validates format & conflict, updates persisted admin username, and refreshes session.
 */
app.post('/api/admin/change-username', requireAdminAuth, async (req, res) => {
  const { newUsername } = req.body || {};
  const clientIp = getClientIp(req);

  try {
    const result = await updateAdminUsername(newUsername, clientIp);
    setAdminSessionCookie(res, result.token);
    res.json({
      success: true,
      message: `Username updated to "${result.user.username}" successfully.`,
      user: result.user,
      token: result.token,
      updatedAt: result.updatedAt,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update username.' });
  }
});

/**
 * POST /api/admin/change-password
 * Verifies current password, validates strength & confirmation match, hashes & persists password,
 * invalidates prior sessions, and refreshes active session.
 */
app.post('/api/admin/change-password', requireAdminAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  const clientIp = getClientIp(req);

  try {
    const result = await updateAdminPassword(
      currentPassword,
      newPassword,
      confirmPassword,
      clientIp
    );
    setAdminSessionCookie(res, result.token);
    res.json({
      success: true,
      message: 'Password updated successfully.',
      user: result.user,
      token: result.token,
      updatedAt: result.updatedAt,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update password.' });
  }
});

// ==========================================
// Public Portfolio Read Endpoints
// ==========================================

app.get('/api/public/projects', (req, res) => {
  const store = loadStore();
  const published = store.projects
    .filter((p) => p.status === 'published')
    .sort((a, b) => a.order - b.order);
  res.json(published);
});

app.get('/api/public/certificates', (req, res) => {
  const store = loadStore();
  const published = store.certificates
    .filter((c) => c.status === 'published')
    .sort((a, b) => a.order - b.order);
  res.json(published);
});

app.get('/api/public/qualifications', (req, res) => {
  const store = loadStore();
  const published = store.qualifications
    .filter((q) => q.status === 'published' || !q.status)
    .sort((a, b) => a.order - b.order);
  res.json(published);
});

app.get('/api/public/skills', (req, res) => {
  const store = loadStore();
  const published = store.skillCategories
    .filter((cat) => cat.status === 'published' || !cat.status)
    .sort((a, b) => a.order - b.order)
    .map((cat) => ({
      ...cat,
      skills: [...cat.skills].sort((a, b) => a.order - b.order),
    }));
  res.json(published);
});

app.get('/api/public/social-links', (req, res) => {
  const store = loadStore();
  const active = store.socialLinks
    .filter((l) => l.isActive !== false)
    .sort((a, b) => a.order - b.order);
  res.json(active);
});

app.get('/api/public/profile', (req, res) => {
  const store = loadStore();
  res.json(store.profile);
});

let cachedDirectPdfAllowed: boolean | null = null;

function buildCloudinaryPublicPdfBridgeUrl(params: {
  publicId: string;
  resourceType?: 'image' | 'raw' | 'video';
  fileName?: string;
  download?: boolean;
}): string {
  const qs = new URLSearchParams({
    publicId: params.publicId,
    rt: params.resourceType || 'image',
  });
  if (params.fileName) {
    qs.set('filename', params.fileName);
  }
  if (params.download) {
    qs.set('download', '1');
  }
  return `/api/public/cloudinary/pdf?${qs.toString()}`;
}

function parseCloudinaryAssetFromUrl(
  rawUrl: string,
  expectedCloudName: string
): { publicId: string; resourceType: 'image' | 'raw' | 'video' } | null {
  const trimmed = rawUrl.trim();
  const prefix = `https://res.cloudinary.com/${expectedCloudName}/`;
  if (!trimmed.startsWith(prefix)) return null;

  const rest = trimmed.slice(prefix.length);
  const match = rest.match(
    /^(image|raw|video)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(portfolio-media\/[a-zA-Z0-9/_-]+?)(?:\.([a-zA-Z0-9]+))?(?:\?.*)?$/
  );
  if (!match) return null;

  const rType = match[1] as 'image' | 'raw' | 'video';
  const publicId = match[2];
  if (!/^[a-zA-Z0-9/_-]+$/.test(publicId) || publicId.length > 500) {
    return null;
  }
  return { publicId, resourceType: rType };
}

function sanitizePdfFilename(raw?: unknown): string {
  const cleaned =
    typeof raw === 'string'
      ? raw
          .trim()
          .replace(/[^\w.\- ]+/g, '_')
          .replace(/^_+|_+$/g, '')
      : '';
  const base = cleaned || 'document.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base.slice(0, 140) : `${base.slice(0, 136)}.pdf`;
}

app.get('/api/public/resume', (req, res) => {
  const store = loadStore();
  res.json(store.resume);
});

app.get('/api/public/media', (req, res) => {
  const store = loadStore();
  const published = (store.mediaAssets || []).filter((m) => m.status === 'published');
  res.json(published);
});

/**
 * Checks whether a given Cloudinary publicId is authorized for public or admin viewing.
 */
function checkIsCloudinaryPdfAuthorized(publicId: string, isAdminReq: boolean): boolean {
  if (isAdminReq) return true;
  const store = loadStore();

  const matchesResume =
    store.resume.status === 'published' &&
    (store.resume.publicId === publicId ||
      store.resume.storagePath === publicId ||
      Boolean(store.resume.resumePdfUrl && store.resume.resumePdfUrl.includes(publicId)) ||
      Boolean(store.resume.cloudinaryUrl && store.resume.cloudinaryUrl.includes(publicId)) ||
      Boolean(
        Array.isArray(store.resume.history) &&
          store.resume.history.some(
            (h) =>
              h.publicId === publicId ||
              h.storagePath === publicId ||
              h.resumePdfUrl?.includes(publicId) ||
              h.cloudinaryUrl?.includes(publicId)
          )
      ));

  if (matchesResume) return true;

  const matchesCert = store.certificates.some(
    (c) =>
      c.status === 'published' &&
      (c.publicId === publicId ||
        c.storagePath === publicId ||
        c.driveLink?.includes(publicId) ||
        c.cloudinaryUrl?.includes(publicId))
  );

  if (matchesCert) return true;

  const matchesMedia = (store.mediaAssets || []).some(
    (m) =>
      m.status === 'published' &&
      (m.publicId === publicId ||
        m.storagePath === publicId ||
        m.downloadUrl?.includes(publicId) ||
        m.cloudinaryUrl?.includes(publicId))
  );

  return Boolean(matchesMedia);
}

/**
 * GET /api/public/cloudinary/status
 * Public non-sensitive capability check so viewers know whether direct CDN PDF delivery
 * is permitted or whether the server-signed PDF bridge should be used.
 */
app.get('/api/public/cloudinary/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const cfg = getCloudinaryConfig();
  res.json({
    configured: cfg.configured,
    directPdfAllowed: cachedDirectPdfAllowed === true,
  });
});

/**
 * GET /api/public/cloudinary/pdf
 * Delivers published portfolio PDFs stored in Cloudinary without exposing CLOUDINARY_API_SECRET.
 * Works both when direct Cloudinary CDN PDF delivery is enabled AND when Cloudinary's account-level
 * PDF/ZIP CDN restriction returns 401 ("deny or ACL failure").
 */
app.get('/api/public/cloudinary/pdf', async (req, res) => {
  const cfg = getCloudinaryConfig();
  if (!cfg.configured) {
    res.status(503).json({ error: 'Cloudinary is not configured on the server.' });
    return;
  }

  let publicId = typeof req.query.publicId === 'string' ? req.query.publicId.trim() : '';
  let preferredRt: 'image' | 'raw' | 'video' =
    req.query.rt === 'raw' || req.query.rt === 'video' ? req.query.rt : 'image';

  if (!publicId && typeof req.query.url === 'string' && req.query.url.trim()) {
    const parsed = parseCloudinaryAssetFromUrl(req.query.url, cfg.cloudName);
    if (parsed) {
      publicId = parsed.publicId;
      preferredRt = parsed.resourceType;
    }
  }

  if (
    !publicId ||
    publicId.length > 500 ||
    !/^portfolio-media\/[a-zA-Z0-9/_-]+$/.test(publicId)
  ) {
    res.status(400).json({ error: 'Valid Cloudinary portfolio-media publicId is required.' });
    return;
  }

  const isAdminReq = Boolean(getAdminSession(extractAdminToken(req, true)));
  const isAuthorized = checkIsCloudinaryPdfAuthorized(publicId, isAdminReq);

  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden: This PDF document is not published.' });
    return;
  }

  const isDownload = req.query.download === '1' || req.query.download === 'true';
  const safeFileName = sanitizePdfFilename(req.query.filename);
  const candidateTypes: Array<'image' | 'raw'> =
    preferredRt === 'raw' ? ['raw', 'image'] : ['image', 'raw'];

  try {
    // Try direct CDN URL first only if known allowed or untested
    if (cachedDirectPdfAllowed !== false) {
      const directCdnCandidate = `https://res.cloudinary.com/${encodeURIComponent(
        cfg.cloudName
      )}/${preferredRt}/upload/${publicId}${preferredRt === 'raw' ? '' : '.pdf'}`;
      const directRes = await fetch(directCdnCandidate, { method: 'GET' }).catch(() => null);
      if (directRes && directRes.ok) {
        const directBuf = Buffer.from(await directRes.arrayBuffer());
        const isPdfType = (directRes.headers.get('content-type') || '').includes('application/pdf');
        const isPdfMagic = directBuf.length >= 4 && directBuf.subarray(0, 4).toString('ascii') === '%PDF';
        if (directBuf.length > 0 && (isPdfType || isPdfMagic)) {
          cachedDirectPdfAllowed = true;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `${isDownload ? 'attachment' : 'inline'}; filename="${safeFileName}"`
          );
          res.setHeader('Content-Length', String(directBuf.length));
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Cache-Control', isAdminReq ? 'private, max-age=120' : 'public, max-age=300');
          res.status(200).send(directBuf);
          return;
        } else {
          cachedDirectPdfAllowed = false;
        }
      } else if (directRes && directRes.status === 401) {
        cachedDirectPdfAllowed = false;
      }
    }

    // Stream via server-signed Cloudinary Download API (works even when account PDF/ZIP CDN delivery is restricted)
    for (const rType of candidateTypes) {
      const signedDownloadUrl = buildCloudinaryPrivateDownloadUrl({
        cloudName: cfg.cloudName,
        apiKey: cfg.apiKey,
        apiSecret: cfg.apiSecret,
        publicId,
        resourceType: rType,
        format: 'pdf',
        attachment: isDownload,
        expiresInSeconds: 300,
      });

      const upstream = await fetch(signedDownloadUrl, { method: 'GET' }).catch(() => null);
      if (upstream && upstream.ok) {
        const pdfBuf = Buffer.from(await upstream.arrayBuffer());
        if (pdfBuf.length > 0) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `${isDownload ? 'attachment' : 'inline'}; filename="${safeFileName}"`
          );
          res.setHeader('Content-Length', String(pdfBuf.length));
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Cache-Control', isAdminReq ? 'private, max-age=120' : 'public, max-age=300');
          res.status(200).send(pdfBuf);
          return;
        }
      }
    }

    res.status(404).json({ error: 'PDF document could not be retrieved from Cloudinary.' });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Failed delivering PDF from Cloudinary.',
    });
  }
});

/**
 * GET /api/public/cloudinary/pdf/view
 * Renders an embedded HTML document viewer for Cloudinary PDFs.
 * Eliminates the Chromium nested-iframe / sandbox PDF plugin blocking error by rendering
 * PDF pages into responsive HTML5 canvas elements via PDF.js, with toolbar controls,
 * page navigation, zoom, and fallback links.
 */
app.get('/api/public/cloudinary/pdf/view', (req, res) => {
  const cfg = getCloudinaryConfig();
  if (!cfg.configured) {
    res.status(503).send(`
      <!DOCTYPE html>
      <html><head><title>Cloudinary Unavailable</title><style>body{background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:30px;text-align:center;}</style></head>
      <body><h3>Cloudinary Storage Not Configured</h3><p>Server credentials are required to preview this document.</p></body></html>
    `);
    return;
  }

  let publicId = typeof req.query.publicId === 'string' ? req.query.publicId.trim() : '';
  const preferredRt: 'image' | 'raw' | 'video' =
    req.query.rt === 'raw' || req.query.rt === 'video' ? req.query.rt : 'image';

  if (!publicId && typeof req.query.url === 'string' && req.query.url.trim()) {
    const parsed = parseCloudinaryAssetFromUrl(req.query.url, cfg.cloudName);
    if (parsed) {
      publicId = parsed.publicId;
    }
  }

  if (!publicId || !/^portfolio-media\/[a-zA-Z0-9/_-]+$/.test(publicId)) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Invalid Document</title><style>body{background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:30px;text-align:center;}</style></head>
      <body><h3>Invalid Document Identifier</h3><p>A valid Cloudinary portfolio-media document is required.</p></body></html>
    `);
    return;
  }

  const isAdminReq = Boolean(getAdminSession(extractAdminToken(req, true)));
  const isAuthorized = checkIsCloudinaryPdfAuthorized(publicId, isAdminReq);

  if (!isAuthorized) {
    res.status(403).send(`
      <!DOCTYPE html>
      <html><head><title>Access Forbidden</title><style>body{background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:30px;text-align:center;}</style></head>
      <body><h3>Document Not Published</h3><p>This PDF document is currently unpublished or restricted.</p></body></html>
    `);
    return;
  }

  const safeFileName = sanitizePdfFilename(req.query.filename);
  const tokenParam = extractAdminToken(req, true);
  const authQuery = tokenParam ? `&token=${encodeURIComponent(tokenParam)}` : '';
  const pdfStreamUrl = `/api/public/cloudinary/pdf?publicId=${encodeURIComponent(publicId)}&rt=${preferredRt}&filename=${encodeURIComponent(safeFileName)}${authQuery}`;
  const pdfDownloadUrl = `/api/public/cloudinary/pdf?publicId=${encodeURIComponent(publicId)}&rt=${preferredRt}&filename=${encodeURIComponent(safeFileName)}&download=1${authQuery}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', isAdminReq ? 'private, max-age=120' : 'public, max-age=300');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0">
  <title>${safeFileName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background-color: #0b0b0e;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    header.toolbar {
      flex-shrink: 0;
      height: 44px;
      background: #141418;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      gap: 10px;
      font-size: 13px;
      z-index: 10;
    }
    .toolbar-left, .toolbar-center, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .doc-title {
      font-weight: 600;
      color: #f4f4f5;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .doc-badge {
      font-size: 10px;
      font-weight: 700;
      color: #f87171;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      height: 28px;
      padding: 0 10px;
      border-radius: 6px;
      border: 1px solid #3f3f46;
      background: #1f1f23;
      color: #d4d4d8;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .btn:hover:not(:disabled) {
      background: #27272a;
      border-color: #52525b;
      color: #fff;
    }
    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-primary {
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      border-color: #3b82f6;
      color: #fff;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      color: #fff;
    }
    .page-nav {
      font-variant-numeric: tabular-nums;
      color: #a1a1aa;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .zoom-level {
      font-variant-numeric: tabular-nums;
      color: #a1a1aa;
      font-size: 12px;
      min-width: 42px;
      text-align: center;
    }
    #viewer-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 18px 12px 30px;
      gap: 16px;
      background: #09090b;
      position: relative;
    }
    .pdf-page-wrapper {
      position: relative;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      background: #ffffff;
      border-radius: 4px;
      overflow: hidden;
      line-height: 0;
      transition: width 0.1s ease, height 0.1s ease;
    }
    .pdf-page-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    #loading-state, #error-state {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
      text-align: center;
      background: #0b0b0e;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(96, 165, 250, 0.2);
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @media (max-width: 640px) {
      .doc-title { max-width: 110px; }
      .hide-mobile { display: none !important; }
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <div class="toolbar-left">
      <span class="doc-badge">PDF</span>
      <span class="doc-title" title="${safeFileName.replace(/"/g, '&quot;')}">${safeFileName.replace(/</g, '&lt;')}</span>
    </div>

    <div class="toolbar-center">
      <button id="prev-page-btn" class="btn" title="Previous Page" disabled>&larr;</button>
      <span class="page-nav">
        Page <span id="current-page-num">1</span> of <span id="total-pages-num">-</span>
      </span>
      <button id="next-page-btn" class="btn" title="Next Page" disabled>&rarr;</button>

      <div style="width: 1px; height: 18px; background: #27272a; margin: 0 4px;" class="hide-mobile"></div>

      <button id="zoom-out-btn" class="btn hide-mobile" title="Zoom Out">&minus;</button>
      <span id="zoom-text" class="zoom-level hide-mobile">100%</span>
      <button id="zoom-in-btn" class="btn hide-mobile" title="Zoom In">&plus;</button>
      <button id="fit-width-btn" class="btn hide-mobile" title="Fit to Container Width">Fit</button>
    </div>

    <div class="toolbar-right">
      <a href="${pdfStreamUrl}" target="_blank" rel="noopener noreferrer" class="btn" title="Open genuine PDF in fresh browser tab">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        <span class="hide-mobile">Open in Tab</span>
      </a>
      <a href="${pdfDownloadUrl}" download="${safeFileName.replace(/"/g, '&quot;')}" class="btn btn-primary" title="Download Resume PDF">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Download</span>
      </a>
    </div>
  </header>

  <div id="viewer-container">
    <div id="loading-state">
      <div class="spinner"></div>
      <div style="font-size: 13px; color: #a1a1aa;">Rendering Resume PDF...</div>
    </div>

    <div id="error-state" style="display: none;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
      <div style="font-weight: 600; font-size: 14px; color: #f4f4f5;" id="error-title">PDF Preview Fallback</div>
      <div style="font-size: 12px; color: #a1a1aa; max-width: 320px; line-height: 1.5;" id="error-desc">
        The document is available directly. Use the buttons below to open or download.
      </div>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <a href="${pdfStreamUrl}" target="_blank" class="btn btn-primary">Open PDF in New Tab</a>
        <a href="${pdfDownloadUrl}" class="btn">Download PDF</a>
      </div>
    </div>

    <div id="pages-container" style="display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%;"></div>
  </div>

  <script>
    (function() {
      const pdfUrl = ${JSON.stringify(pdfStreamUrl)};
      const container = document.getElementById('viewer-container');
      const pagesContainer = document.getElementById('pages-container');
      const loadingState = document.getElementById('loading-state');
      const errorState = document.getElementById('error-state');
      const currentPageNum = document.getElementById('current-page-num');
      const totalPagesNum = document.getElementById('total-pages-num');
      const prevBtn = document.getElementById('prev-page-btn');
      const nextBtn = document.getElementById('next-page-btn');
      const zoomInBtn = document.getElementById('zoom-in-btn');
      const zoomOutBtn = document.getElementById('zoom-out-btn');
      const fitWidthBtn = document.getElementById('fit-width-btn');
      const zoomText = document.getElementById('zoom-text');

      let pdfDoc = null;
      let totalPages = 0;
      let activePage = 1;
      let currentScale = 1.0;
      let baseViewportWidth = 612; // Standard Letter width

      function showError(title, desc) {
        loadingState.style.display = 'none';
        errorState.style.display = 'flex';
        if (title) document.getElementById('error-title').textContent = title;
        if (desc) document.getElementById('error-desc').textContent = desc;
      }

      function updateControls() {
        currentPageNum.textContent = String(activePage);
        totalPagesNum.textContent = String(totalPages || '-');
        prevBtn.disabled = activePage <= 1;
        nextBtn.disabled = activePage >= totalPages;
        zoomText.textContent = Math.round(currentScale * 100) + '%';
      }

      function calculateFitScale(pageViewport) {
        const availableWidth = Math.max(280, container.clientWidth - 48);
        return Math.min(2.0, Math.max(0.6, availableWidth / pageViewport.width));
      }

      async function renderPage(pageNum, scale) {
        if (!pdfDoc) return;
        const page = await pdfDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        baseViewportWidth = unscaledViewport.width;

        const effectiveScale = scale || currentScale;
        const viewport = page.getViewport({ scale: effectiveScale });
        const pixelRatio = window.devicePixelRatio || 1;

        let pageWrapper = document.getElementById('page-wrap-' + pageNum);
        let canvas = null;

        if (!pageWrapper) {
          pageWrapper = document.createElement('div');
          pageWrapper.id = 'page-wrap-' + pageNum;
          pageWrapper.className = 'pdf-page-wrapper';
          canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          pageWrapper.appendChild(canvas);
          pagesContainer.appendChild(pageWrapper);
        } else {
          canvas = pageWrapper.querySelector('canvas');
        }

        pageWrapper.style.width = Math.floor(viewport.width) + 'px';
        pageWrapper.style.height = Math.floor(viewport.height) + 'px';

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);

        const ctx = canvas.getContext('2d');
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;
      }

      async function renderAllPages() {
        if (!pdfDoc) return;
        for (let i = 1; i <= totalPages; i++) {
          await renderPage(i, currentScale);
        }
        updateControls();
      }

      // Check for PDF.js library availability
      if (typeof window.pdfjsLib === 'undefined') {
        showError('PDF Renderer Loading Failed', 'Could not initialize PDF renderer. You can view or download the PDF directly.');
        return;
      }

      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      // Load PDF via stream
      fetch(pdfUrl, { credentials: 'include' })
        .then(function(res) {
          if (!res.ok) {
            throw new Error('Server returned HTTP ' + res.status + ' while retrieving PDF.');
          }
          return res.arrayBuffer();
        })
        .then(function(arrayBuffer) {
          return window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        })
        .then(async function(doc) {
          pdfDoc = doc;
          totalPages = doc.numPages;
          totalPagesNum.textContent = String(totalPages);

          // Get first page to compute initial responsive scale
          const page1 = await doc.getPage(1);
          const vp = page1.getViewport({ scale: 1.0 });
          currentScale = calculateFitScale(vp);

          await renderAllPages();
          loadingState.style.display = 'none';

          // Intersection observer for tracking active visible page
          if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                  const idMatch = entry.target.id.match(/page-wrap-(\\d+)/);
                  if (idMatch) {
                    activePage = parseInt(idMatch[1], 10);
                    updateControls();
                  }
                }
              });
            }, { root: container, threshold: 0.5 });

            for (let i = 1; i <= totalPages; i++) {
              const el = document.getElementById('page-wrap-' + i);
              if (el) observer.observe(el);
            }
          }
        })
        .catch(function(err) {
          console.error('PDF view render error:', err);
          showError('Unable to Render PDF Preview', err.message || 'The PDF document could not be previewed.');
        });

      prevBtn.addEventListener('click', function() {
        if (activePage > 1) {
          activePage--;
          const target = document.getElementById('page-wrap-' + activePage);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          updateControls();
        }
      });

      nextBtn.addEventListener('click', function() {
        if (activePage < totalPages) {
          activePage++;
          const target = document.getElementById('page-wrap-' + activePage);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          updateControls();
        }
      });

      zoomInBtn.addEventListener('click', function() {
        currentScale = Math.min(2.5, currentScale + 0.15);
        renderAllPages();
      });

      zoomOutBtn.addEventListener('click', function() {
        currentScale = Math.max(0.5, currentScale - 0.15);
        renderAllPages();
      });

      fitWidthBtn.addEventListener('click', function() {
        if (baseViewportWidth > 0) {
          currentScale = calculateFitScale({ width: baseViewportWidth });
          renderAllPages();
        }
      });

      // Handle window resize debounce
      let resizeTimer = null;
      window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
          if (pdfDoc && baseViewportWidth > 0) {
            currentScale = calculateFitScale({ width: baseViewportWidth });
            renderAllPages();
          }
        }, 200);
      });
    })();
  </script>
</body>
</html>`);
});


// Rate limiter for contact submissions, MAYU AI chat & analytics tracking
const contactRateLimits = new Map<string, { count: number; first: number }>();
const chatRateLimits = new Map<string, { count: number; first: number }>();
const analyticsRateLimits = new Map<string, { count: number; first: number }>();

/**
 * POST /api/analytics/track
 * Accepts validated client analytics events, assigns trusted server timestamp,
 * detects device category, excludes authenticated admin sessions, and stores into database.
 */
app.post('/api/analytics/track', (req, res) => {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  // 1. Rate limiting: max 120 tracking calls per minute per IP
  const now = Date.now();
  const rl = analyticsRateLimits.get(clientIp);
  if (rl) {
    if (now - rl.first < 60 * 1000) {
      if (rl.count >= 120) {
        res.status(429).json({ error: 'Tracking rate limit exceeded' });
        return;
      }
      rl.count += 1;
    } else {
      analyticsRateLimits.set(clientIp, { count: 1, first: now });
    }
  } else {
    analyticsRateLimits.set(clientIp, { count: 1, first: now });
  }

  const {
    eventType,
    visitorId,
    sessionId,
    targetId,
    targetType,
    engagementSeconds,
    referrer,
    metadata,
    isTest,
  } = req.body || {};

  // 2. Validate event type against strict whitelist
  const validEventTypes: AnalyticsEvent['eventType'][] = [
    'session_start',
    'page_view',
    'section_view',
    'engagement_heartbeat',
    'resume_view',
    'resume_download',
    'project_view',
    'project_link_click',
    'certificate_view',
    'social_click',
    'contact_submit_success',
    'contact_submit_error',
  ];

  if (!eventType || !validEventTypes.includes(eventType)) {
    res.status(400).json({ error: 'Invalid or missing eventType' });
    return;
  }

  // 3. Exclude activity originating directly on /admin dashboard routes
  const refererHeader = String(req.headers.referer || '');
  if (refererHeader.includes('/admin') && isTest !== true) {
    res.json({ success: true, ignored: 'admin_route_excluded' });
    return;
  }

  // 4. Device category inference from User-Agent
  const ua = req.headers['user-agent'] || '';
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua);
  const isMobile = !isTablet && /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceCategory: 'desktop' | 'tablet' | 'mobile' = isTablet
    ? 'tablet'
    : isMobile
    ? 'mobile'
    : 'desktop';

  // 5. Construct secure event record with trusted server timestamp
  const cleanVisitorId = String(visitorId || 'anon').substring(0, 128);
  const cleanSessionId = String(sessionId || 'anon_session').substring(0, 128);
  const serverIso = new Date().toISOString();

  const event: AnalyticsEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    eventType,
    visitorId: cleanVisitorId,
    sessionId: cleanSessionId,
    timestamp: serverIso,
    targetId: targetId ? String(targetId).substring(0, 200) : undefined,
    targetType: targetType ? String(targetType).substring(0, 100) : undefined,
    deviceCategory,
    referrer: referrer ? String(referrer).substring(0, 500) : undefined,
    engagementSeconds:
      typeof engagementSeconds === 'number' && engagementSeconds > 0 && engagementSeconds < 3600
        ? Math.round(engagementSeconds)
        : undefined,
    metadata: typeof metadata === 'object' && metadata !== null ? metadata : undefined,
    isTest: isTest === true,
  };

  const store = loadStore();
  if (!store.analyticsEvents) {
    store.analyticsEvents = [];
  }

  // If a public page_view arrives for a session without an active session_start (e.g. after reset),
  // automatically record a session_start event so visit metrics remain accurate.
  if (
    event.eventType === 'page_view' &&
    event.isTest !== true &&
    !store.analyticsEvents.some(
      (e) => e.sessionId === cleanSessionId && e.eventType === 'session_start' && e.isTest !== true
    )
  ) {
    store.analyticsEvents.push({
      id: `evt_${Date.now()}_ss_${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'session_start',
      visitorId: cleanVisitorId,
      sessionId: cleanSessionId,
      timestamp: serverIso,
      deviceCategory,
      referrer: event.referrer,
      isTest: false,
    });
  }

  store.analyticsEvents.push(event);

  // Keep up to 5,000 recent events
  if (store.analyticsEvents.length > 5000) {
    store.analyticsEvents = store.analyticsEvents.slice(-5000);
  }

  saveStore(store);

  res.json({
    success: true,
    eventId: event.id,
  });
});

// Track recent contact signatures to prevent rapid duplicate submissions
const recentContactSignatures = new Map<string, number>();

/**
 * POST /api/public/contact
 * Validates and records contact message submissions
 */
app.post('/api/public/contact', (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const clientIp = getClientIp(req);

  // Rate limit: max 15 messages per 10 minutes per IP
  const now = Date.now();
  const rl = contactRateLimits.get(clientIp);
  if (rl) {
    if (now - rl.first < 10 * 60 * 1000) {
      if (rl.count >= 15) {
        res.status(429).json({
          error: 'Rate limit reached. Please wait a few minutes before submitting another message.',
        });
        return;
      }
      rl.count += 1;
    } else {
      contactRateLimits.set(clientIp, { count: 1, first: now });
    }
  } else {
    contactRateLimits.set(clientIp, { count: 1, first: now });
  }

  // Field validation
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  const cleanSubject = String(subject || '').trim();
  const cleanMessage = String(message || '').trim();

  if (!cleanName || cleanName.length < 2) {
    res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    res.status(400).json({ error: 'Please provide a valid email address so Mayur can reply to you.' });
    return;
  }

  if (!cleanSubject || cleanSubject.length < 2) {
    res.status(400).json({ error: 'Please enter a subject or select a topic.' });
    return;
  }

  if (!cleanMessage || cleanMessage.length < 5) {
    res.status(400).json({ error: 'Message must be at least 5 characters.' });
    return;
  }

  // Duplicate submission prevention (identical payload within 8 seconds)
  const signature = `${cleanEmail.toLowerCase()}|${cleanSubject.toLowerCase()}|${cleanMessage}`;
  const lastSubmittedAt = recentContactSignatures.get(signature);
  if (lastSubmittedAt && now - lastSubmittedAt < 8000) {
    res.status(409).json({
      error: 'Duplicate submission prevented. Your message has already been received.',
      duplicate: true,
    });
    return;
  }
  recentContactSignatures.set(signature, now);
  if (recentContactSignatures.size > 200) {
    for (const [k, ts] of recentContactSignatures.entries()) {
      if (now - ts > 60000) recentContactSignatures.delete(k);
    }
  }

  const store = loadStore();
  if (!store.messages) {
    store.messages = [];
  }

  const newMsg: ContactMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: cleanName,
    email: cleanEmail,
    subject: cleanSubject,
    message: cleanMessage,
    timestamp: new Date().toISOString(),
    isRead: false,
    status: 'unread',
    ip: clientIp,
  };

  store.messages.unshift(newMsg);
  if (store.messages.length > 200) {
    store.messages = store.messages.slice(0, 200);
  }

  saveStore(store);

  const unreadCount = store.messages.filter((m) => !m.isRead).length;
  broadcastAdminMessageEvent({
    type: 'new_message',
    unreadCount,
    totalCount: store.messages.length,
    message: sanitizeAdminMessage(newMsg),
  });

  res.json({
    success: true,
    message: `Thank you, ${cleanName}! Your message has been received. Mayur will get in touch with you shortly.`,
    id: newMsg.id,
  });
});

/**
 * POST /api/mayu-ai/chat
 * Handles conversational inquiries with MAYU AI using Google Gemini API (gemini-3.8-flash)
 */
app.post('/api/mayu-ai/chat', async (req, res) => {
  const { message, history, mode } = req.body || {};
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    res.status(400).json({ error: 'Message content cannot be empty.' });
    return;
  }

  if (cleanMessage.length > 1000) {
    res.status(400).json({ error: 'Message is too long (maximum 1000 characters).' });
    return;
  }

  // Rate limit: max 30 chat messages per minute per IP
  const now = Date.now();
  const rl = chatRateLimits.get(clientIp);
  if (rl) {
    if (now - rl.first < 60 * 1000) {
      if (rl.count >= 30) {
        res.status(429).json({
          error: 'Slow down a bit! MAYU AI needs a quick breather. Please try again in a few seconds.',
        });
        return;
      }
      rl.count += 1;
    } else {
      chatRateLimits.set(clientIp, { count: 1, first: now });
    }
  } else {
    chatRateLimits.set(clientIp, { count: 1, first: now });
  }

  try {
    const result = await handleMayuAiChat(cleanMessage, Array.isArray(history) ? history : [], mode);
    res.json({
      success: true,
      reply: result.reply,
      usedModel: result.usedModel,
    });
  } catch (err: any) {
    console.error('[MAYU AI Error]:', err);
    res.status(500).json({
      error: 'MAYU AI is temporarily unavailable. Please try again in a moment.',
    });
  }
});

// ==========================================
// Protected Admin Management Endpoints
// Enforces server-side authorization on all operations
// ==========================================

/**
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const totalProjects = store.projects.length;
  const publishedProjects = store.projects.filter((p) => p.status === 'published').length;
  const totalCertificates = store.certificates.length;
  const publishedCertificates = store.certificates.filter((c) => c.status === 'published').length;
  const achievements = store.certificates.filter((c) => c.viewAchievement === true).length;
  const totalQualifications = store.qualifications.length;
  const publishedQualifications = store.qualifications.filter((q) => q.status === 'published' || !q.status).length;
  const totalSkillCategories = store.skillCategories.length;
  const totalSkills = store.skillCategories.reduce((acc, cat) => acc + (cat.skills?.length || 0), 0);
  const totalSocialLinks = store.socialLinks.length;
  const activeSocialLinks = store.socialLinks.filter((l) => l.isActive !== false).length;

  const totalDrafts =
    (totalProjects - publishedProjects) +
    (totalCertificates - publishedCertificates) +
    (totalQualifications - publishedQualifications);

  const totalMessages = (store.messages || []).length;
  const unreadMessages = (store.messages || []).filter((m) => !m.isRead).length;

  res.json({
    totalProjects,
    publishedProjects,
    totalCertificates,
    publishedCertificates,
    achievements,
    totalQualifications,
    publishedQualifications,
    totalSkillCategories,
    totalSkills,
    totalSocialLinks,
    activeSocialLinks,
    totalDrafts,
    totalMessages,
    unreadMessages,
    lastUpdated: store.lastUpdated,
  });
});

// ==========================================
// Cloudinary Server-Side Signing & Management
// ==========================================

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MEDIA_CATEGORIES = new Set<MediaAssetRecord['category']>([
  'Profile',
  'Certificates',
  'Projects',
  'Events',
  'Resume',
  'Other',
]);

const ALLOWED_CLOUDINARY_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const ALLOWED_CLOUDINARY_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
]);

function getCloudinaryConfig() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  const missing: string[] = [];
  if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!apiKey) missing.push('CLOUDINARY_API_KEY');
  if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');

  return {
    cloudName,
    apiKey,
    apiSecret,
    configured: missing.length === 0,
    missing,
  };
}

function generateCloudinarySignature(
  params: Record<string, string | number | boolean>,
  apiSecret: string
): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

function sanitizePublicIdSegment(rawName: string): string {
  const withoutExt = rawName.replace(/\.[a-z0-9]+$/i, '');
  const cleaned = withoutExt
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || `asset_${Date.now()}`).slice(0, 100);
}

async function destroyCloudinaryAssetOnServer(
  publicId: string,
  preferredResourceType?: 'image' | 'raw' | 'video'
): Promise<{ result: string; resourceType: 'image' | 'raw' | 'video' }> {
  const cfg = getCloudinaryConfig();
  if (!cfg.configured) {
    throw new Error(
      `Cloudinary is not configured on the server. Missing environment secret(s): ${cfg.missing.join(', ')}.`
    );
  }

  const candidateTypes: Array<'image' | 'raw' | 'video'> = preferredResourceType
    ? [preferredResourceType]
    : ['image', 'raw'];

  let lastResult = 'not found';
  let usedType: 'image' | 'raw' | 'video' = candidateTypes[0];

  for (const rType of candidateTypes) {
    usedType = rType;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateCloudinarySignature(
      {
        invalidate: 'true',
        public_id: publicId,
        timestamp,
      },
      cfg.apiSecret
    );

    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: cfg.apiKey,
      signature,
      invalidate: 'true',
    });

    const destroyEndpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      cfg.cloudName
    )}/${rType}/destroy`;

    const response = await fetch(destroyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg = data?.error?.message || `Cloudinary destroy HTTP ${response.status}`;
      throw new Error(errMsg);
    }
    if (data?.error?.message) {
      throw new Error(data.error.message);
    }

    lastResult = String(data?.result || 'ok');
    if (lastResult === 'ok') {
      return { result: 'ok', resourceType: rType };
    }
  }

  return { result: lastResult, resourceType: usedType };
}

/**
 * GET /api/admin/cloudinary/status
 * Checks whether server-side Cloudinary environment secrets are configured.
 * Never exposes apiKey or apiSecret.
 */
app.get('/api/admin/cloudinary/status', requireAdminAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const cfg = getCloudinaryConfig();
  res.json({
    configured: cfg.configured,
    cloudName: cfg.configured ? cfg.cloudName : null,
    missing: cfg.missing,
    maxFileSizeBytes: MAX_UPLOAD_BYTES,
    allowedExtensions: ['JPG', 'JPEG', 'PNG', 'WEBP', 'PDF'],
  });
});

/**
 * POST /api/admin/cloudinary/sign
 * Validates file type, extension, size, and category, then returns a short-lived SHA-1 signature
 * for direct signed upload to Cloudinary. Never exposes CLOUDINARY_API_SECRET.
 */
app.post('/api/admin/cloudinary/sign', requireAdminAuth, (req, res) => {
  const {
    fileName,
    mimeType,
    sizeBytes,
    category = 'Other',
    acceptKind = 'both',
    replacePublicId,
  } = req.body || {};

  // 1. Validate file name & extension
  if (typeof fileName !== 'string' || !fileName.trim()) {
    res.status(400).json({ error: 'fileName is required.' });
    return;
  }

  const lowerName = fileName.trim().toLowerCase();
  const extMatch = lowerName.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : '';
  const cleanMime = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';

  const validMime = ALLOWED_CLOUDINARY_MIME_TYPES.has(cleanMime);
  const validExt = ALLOWED_CLOUDINARY_EXTENSIONS.has(ext);
  if (!validMime && !validExt) {
    res.status(400).json({
      error: 'Unsupported file type. Allowed formats: JPG, JPEG, PNG, WEBP, and PDF.',
    });
    return;
  }

  const isPdf = cleanMime === 'application/pdf' || ext === '.pdf';
  const isImage = !isPdf;

  if (acceptKind === 'image' && !isImage) {
    res.status(400).json({
      error: 'Only image files (JPG, JPEG, PNG, WEBP) are allowed for this field.',
    });
    return;
  }

  if (acceptKind === 'pdf' && !isPdf) {
    res.status(400).json({
      error: 'Only PDF documents (.pdf) are allowed for this field.',
    });
    return;
  }

  // 2. Validate file size (must be > 0 and <= 10 MB)
  const numericSize = Number(sizeBytes);
  if (!Number.isFinite(numericSize) || numericSize <= 0) {
    res.status(400).json({ error: 'Selected file is empty (0 bytes) or has invalid size.' });
    return;
  }
  if (numericSize > MAX_UPLOAD_BYTES) {
    res.status(400).json({
      error: 'File size exceeds the 10 MB maximum upload limit.',
    });
    return;
  }

  // 3. Validate category
  const resolvedCategory: MediaAssetRecord['category'] = ALLOWED_MEDIA_CATEGORIES.has(category)
    ? category
    : 'Other';

  // 4. Verify Cloudinary credentials in server environment secrets
  const cfg = getCloudinaryConfig();
  if (!cfg.configured) {
    res.status(503).json({
      configured: false,
      missing: cfg.missing,
      error: `Cloudinary secrets are not configured in server environment. Please add ${cfg.missing.join(
        ', '
      )} in Secrets.`,
    });
    return;
  }

  // 5. Build target public_id (either in-place replacement or fresh timestamped public_id)
  let targetPublicId: string;
  if (
    typeof replacePublicId === 'string' &&
    replacePublicId.trim().startsWith('portfolio-media/') &&
    /^[a-zA-Z0-9/_-]+$/.test(replacePublicId.trim())
  ) {
    targetPublicId = replacePublicId.trim();
  } else {
    const safeSegment = sanitizePublicIdSegment(fileName);
    const rand = crypto.randomBytes(3).toString('hex');
    targetPublicId = `portfolio-media/${resolvedCategory.toLowerCase()}/${Date.now()}_${safeSegment}_${rand}`;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams: Record<string, string | number> = {
    access_mode: 'public',
    invalidate: 'true',
    overwrite: 'true',
    public_id: targetPublicId,
    timestamp,
  };

  const signature = generateCloudinarySignature(signedParams, cfg.apiSecret);

  res.json({
    configured: true,
    cloudName: cfg.cloudName,
    apiKey: cfg.apiKey,
    timestamp,
    signature,
    publicId: targetPublicId,
    accessMode: 'public',
    overwrite: 'true',
    invalidate: 'true',
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/auto/upload`,
  });
});

function buildCloudinarySignedDeliveryUrl(params: {
  cloudName: string;
  apiSecret: string;
  publicId: string;
  resourceType?: 'image' | 'raw' | 'video';
  version?: string | number;
  format?: string;
  transformation?: string;
  algorithm?: 'sha1' | 'sha256';
}): string {
  const rType = params.resourceType || 'image';
  const cleanExt = params.format ? params.format.replace(/^\./, '').toLowerCase() : '';
  const suffix = cleanExt ? `.${cleanExt}` : '';
  const transPart = params.transformation ? `${params.transformation}/` : '';
  const pathWithoutVersion = `${transPart}${params.publicId}${suffix}`;
  const hashAlgo = params.algorithm || 'sha1';
  const rawDigest = crypto
    .createHash(hashAlgo)
    .update(`${pathWithoutVersion}${params.apiSecret}`)
    .digest('base64');
  const urlSafeSig = rawDigest.substring(0, 8).replace(/\+/g, '-').replace(/\//g, '_');
  const versionSegment = params.version ? `v${String(params.version).replace(/^v/i, '')}/` : '';
  return `https://res.cloudinary.com/${encodeURIComponent(
    params.cloudName
  )}/${rType}/upload/s--${urlSafeSig}--/${versionSegment}${pathWithoutVersion}`;
}

function buildCloudinaryPrivateDownloadUrl(params: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  publicId: string;
  resourceType?: 'image' | 'raw' | 'video';
  format?: string;
  attachment?: boolean;
  expiresInSeconds?: number;
}): string {
  const resourceType = params.resourceType || 'image';
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + (params.expiresInSeconds || 3600);
  const cleanFormat = (params.format || 'pdf').replace(/^\./, '').toLowerCase();
  const signPayload: Record<string, string | number> = {
    ...(params.attachment ? { attachment: 'true' } : {}),
    expires_at: expiresAt,
    format: cleanFormat,
    public_id: params.publicId,
    timestamp,
    type: 'upload',
  };
  const signature = generateCloudinarySignature(signPayload, params.apiSecret);
  const qs = new URLSearchParams({
    ...(params.attachment ? { attachment: 'true' } : {}),
    api_key: params.apiKey,
    expires_at: String(expiresAt),
    format: cleanFormat,
    public_id: params.publicId,
    signature,
    timestamp: String(timestamp),
    type: 'upload',
  });
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(
    params.cloudName
  )}/${resourceType}/download?${qs.toString()}`;
}

/**
 * POST /api/admin/cloudinary/verify-pdf
 * Verifies an uploaded Cloudinary PDF resource via Admin API and checks live public CDN delivery.
 */
app.post('/api/admin/cloudinary/verify-pdf', requireAdminAuth, async (req, res) => {
  const { publicId, resourceType = 'image', version, secureUrl, fileName } = req.body || {};

  if (
    typeof publicId !== 'string' ||
    !publicId.trim() ||
    !/^[a-zA-Z0-9/_-]+$/.test(publicId.trim())
  ) {
    res.status(400).json({ error: 'Valid Cloudinary publicId is required.' });
    return;
  }

  const cfg = getCloudinaryConfig();
  if (!cfg.configured) {
    res.status(503).json({
      configured: false,
      missing: cfg.missing,
      error: `Cloudinary secrets are not configured (${cfg.missing.join(', ')}).`,
    });
    return;
  }

  const cleanPublicId = publicId.trim();
  const rType: 'image' | 'raw' | 'video' =
    resourceType === 'raw' || resourceType === 'video' ? resourceType : 'image';
  const safeFileName = sanitizePdfFilename(fileName);

  try {
    // 1. Verify resource exists in Cloudinary via authenticated Admin API
    const basicAuth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64');
    const adminResourceUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      cfg.cloudName
    )}/resources/${rType}/upload/${encodeURIComponent(cleanPublicId)}`;

    const adminRes = await fetch(adminResourceUrl, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });
    const adminJson: any = await adminRes.json().catch(() => ({}));

    if (!adminRes.ok) {
      res.status(400).json({
        verified: false,
        error:
          adminJson?.error?.message ||
          `Cloudinary resource verification failed (HTTP ${adminRes.status}).`,
      });
      return;
    }

    // Ensure access_mode is 'public' via Admin API if not already public
    let currentAccessMode = adminJson.access_mode || 'public';
    if (currentAccessMode !== 'public') {
      const updateBody = new URLSearchParams({ access_mode: 'public' });
      const updateRes = await fetch(adminResourceUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: updateBody.toString(),
      });
      const updateJson: any = await updateRes.json().catch(() => ({}));
      if (updateRes.ok && updateJson.access_mode) {
        currentAccessMode = updateJson.access_mode;
      }
    }

    const effectiveVersion = adminJson.version || version;
    const directPdfUrl =
      (typeof secureUrl === 'string' && secureUrl.trim()) ||
      String(adminJson.secure_url || '');

    // 2. Test direct public CDN delivery of the PDF URL
    let directHttpStatus = 0;
    let directError: string | null = null;
    let directContentType = '';
    if (directPdfUrl) {
      const directCheck = await fetch(directPdfUrl, { method: 'GET' }).catch(() => null);
      if (directCheck) {
        directHttpStatus = directCheck.status;
        directError = directCheck.headers.get('x-cld-error');
        directContentType = (directCheck.headers.get('content-type') || '').toLowerCase();
      }
    }

    const directPdfDelivery = directHttpStatus === 200 && directContentType.includes('application/pdf');
    cachedDirectPdfAllowed = directPdfDelivery;

    // 3. Test signed CDN URL (sha1 & sha256) if direct failed
    let signedCdnUrl: string | null = null;
    let signedCdnStatus = 0;
    if (!directPdfDelivery) {
      for (const algo of ['sha1', 'sha256'] as const) {
        const candidate = buildCloudinarySignedDeliveryUrl({
          cloudName: cfg.cloudName,
          apiSecret: cfg.apiSecret,
          publicId: cleanPublicId,
          resourceType: rType,
          version: effectiveVersion,
          format: adminJson.format || (rType === 'raw' ? '' : 'pdf'),
          algorithm: algo,
        });
        const check = await fetch(candidate, { method: 'GET' }).catch(() => null);
        if (check && check.status === 200) {
          signedCdnUrl = candidate;
          signedCdnStatus = 200;
          break;
        }
        if (check) signedCdnStatus = check.status;
      }
    }

    // 4. Test authenticated Cloudinary Download API delivery
    const downloadApiUrl = buildCloudinaryPrivateDownloadUrl({
      cloudName: cfg.cloudName,
      apiKey: cfg.apiKey,
      apiSecret: cfg.apiSecret,
      publicId: cleanPublicId,
      resourceType: rType,
      format: adminJson.format || 'pdf',
    });
    const downloadCheck = await fetch(downloadApiUrl, { method: 'GET' }).catch(() => null);
    const downloadApiStatus = downloadCheck ? downloadCheck.status : 0;
    const downloadApiAvailable = downloadApiStatus === 200;

    const directDownloadVariant =
      directPdfUrl.includes('/upload/') && !directPdfUrl.includes('/raw/upload/')
        ? directPdfUrl.replace('/upload/', '/upload/fl_attachment/')
        : directPdfUrl;

    const bridgeViewUrl = buildCloudinaryPublicPdfBridgeUrl({
      publicId: cleanPublicId,
      resourceType: rType,
      fileName: safeFileName,
      download: false,
    });

    const bridgeDownloadUrl = buildCloudinaryPublicPdfBridgeUrl({
      publicId: cleanPublicId,
      resourceType: rType,
      fileName: safeFileName,
      download: true,
    });

    const publicViewUrl = directPdfDelivery
      ? directPdfUrl
      : signedCdnUrl || (downloadApiAvailable ? bridgeViewUrl : directPdfUrl);

    const publicDownloadUrl = directPdfDelivery
      ? directDownloadVariant
      : downloadApiAvailable
      ? bridgeDownloadUrl
      : directDownloadVariant;

    res.json({
      verified: directPdfDelivery || signedCdnStatus === 200 || downloadApiAvailable,
      publicId: cleanPublicId,
      resourceType: rType,
      accessMode: currentAccessMode,
      bytes: adminJson.bytes,
      pages: adminJson.pages,
      secureUrl: directPdfUrl,
      cloudinaryUrl: directPdfUrl,
      publicViewUrl,
      publicDownloadUrl,
      directPdfDelivery,
      directHttpStatus,
      directError,
      signedCdnUrl,
      signedCdnStatus,
      downloadApiAvailable,
      downloadApiStatus,
      accountPdfRestrictionActive: directHttpStatus === 401,
    });
  } catch (err: any) {
    res.status(500).json({
      verified: false,
      error: err?.message || 'Failed verifying Cloudinary PDF resource.',
    });
  }
});

/**
 * POST /api/admin/cloudinary/destroy
 * Securely destroys a Cloudinary asset by public_id using server-side SHA-1 signature.
 */
app.post('/api/admin/cloudinary/destroy', requireAdminAuth, async (req, res) => {
  const { publicId, resourceType } = req.body || {};

  if (
    typeof publicId !== 'string' ||
    !publicId.trim() ||
    publicId.length > 500 ||
    !/^[a-zA-Z0-9/_-]+$/.test(publicId.trim())
  ) {
    res.status(400).json({ error: 'Valid Cloudinary publicId is required.' });
    return;
  }

  const cleanPublicId = publicId.trim();
  const validResourceType =
    resourceType === 'image' || resourceType === 'raw' || resourceType === 'video'
      ? resourceType
      : undefined;

  try {
    const outcome = await destroyCloudinaryAssetOnServer(cleanPublicId, validResourceType);

    // Also remove any matching media_assets metadata record
    const store = loadStore();
    if (Array.isArray(store.mediaAssets)) {
      const before = store.mediaAssets.length;
      store.mediaAssets = store.mediaAssets.filter(
        (m) => m.publicId !== cleanPublicId && m.storagePath !== cleanPublicId
      );
      if (store.mediaAssets.length !== before) {
        saveStore(store);
      }
    }

    res.json({
      success: true,
      publicId: cleanPublicId,
      result: outcome.result,
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to delete asset from Cloudinary.';
    const status = msg.includes('Missing environment secret') ? 503 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * Projects CRUD (Protected)
 */
app.get('/api/admin/projects', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const sorted = [...store.projects].sort((a, b) => a.order - b.order);
  res.json(sorted);
});

app.post('/api/admin/projects', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<ProjectItem>;
  const store = loadStore();

  const id = item.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const index = store.projects.findIndex((p) => p.id === id);

  const existing = index >= 0 ? store.projects[index] : undefined;
  const nextImage = item.image || '';
  const keepExistingMedia = Boolean(nextImage && existing?.image === nextImage && !item.publicId);

  const updatedItem: ProjectItem = {
    id,
    title: item.title || 'Untitled Project',
    description: item.description || '',
    cardDescription: item.cardDescription ?? existing?.cardDescription,
    image: nextImage,
    publicId: item.publicId || (keepExistingMedia ? existing?.publicId : undefined),
    cloudinaryResourceType:
      item.cloudinaryResourceType ||
      (item.publicId ? 'image' : keepExistingMedia ? existing?.cloudinaryResourceType : undefined),
    storagePath: keepExistingMedia ? existing?.storagePath : undefined,
    category: item.category || 'web',
    tech: Array.isArray(item.tech) ? item.tech : [],
    cardTech: Array.isArray(item.cardTech) ? item.cardTech : existing?.cardTech,
    features: Array.isArray(item.features) ? item.features : existing?.features,
    github: item.github || '',
    demo: item.demo || '',
    videoDemo: item.videoDemo || '',
    featured: Boolean(item.featured),
    status: item.status === 'draft' ? 'draft' : 'published',
    order: typeof item.order === 'number' ? item.order : store.projects.length + 1,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    store.projects[index] = updatedItem;
  } else {
    store.projects.push(updatedItem);
  }

  saveStore(store);
  res.json({ success: true, project: updatedItem });
});

app.delete('/api/admin/projects/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const store = loadStore();
  store.projects = store.projects.filter((p) => p.id !== id);
  saveStore(store);
  res.json({ success: true, id });
});

/**
 * Certificates CRUD (Protected)
 */
app.get('/api/admin/certificates', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const sorted = [...store.certificates].sort((a, b) => a.order - b.order);
  res.json(sorted);
});

app.post('/api/admin/certificates', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<CertificateItem>;
  const store = loadStore();

  const id = item.id || `cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const index = store.certificates.findIndex((c) => c.id === id);

  const existingCert = index >= 0 ? store.certificates[index] : undefined;
  const nextLink = item.driveLink || '';
  const keepExistingMedia = Boolean(
    nextLink && existingCert?.driveLink === nextLink && !item.publicId
  );

  const updatedItem: CertificateItem = {
    id,
    title: item.title || 'Untitled Certificate',
    issuer: item.issuer || 'Unknown Issuer',
    year: String(item.year || ''),
    category: item.category || 'Activity',
    featured: Boolean(item.featured),
    viewAchievement: Boolean(item.viewAchievement),
    driveLink: nextLink,
    cloudinaryUrl:
      item.cloudinaryUrl ||
      (nextLink.includes('cloudinary.com')
        ? nextLink
        : keepExistingMedia
        ? existingCert?.cloudinaryUrl
        : undefined),
    publicId: item.publicId || (keepExistingMedia ? existingCert?.publicId : undefined),
    cloudinaryResourceType:
      item.cloudinaryResourceType ||
      (item.publicId
        ? 'image'
        : keepExistingMedia
        ? existingCert?.cloudinaryResourceType
        : undefined),
    ...(typeof item.directPdfDelivery === 'boolean'
      ? { directPdfDelivery: item.directPdfDelivery }
      : keepExistingMedia && typeof existingCert?.directPdfDelivery === 'boolean'
      ? { directPdfDelivery: existingCert.directPdfDelivery }
      : {}),
    storagePath: keepExistingMedia ? existingCert?.storagePath : undefined,
    github: item.github || '',
    presentation: item.presentation || '',
    offerLetter: item.offerLetter || '',
    demoVideo: item.demoVideo || '',
    achievement: item.achievement || null,
    status: item.status === 'draft' ? 'draft' : 'published',
    order: typeof item.order === 'number' ? item.order : store.certificates.length + 1,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    store.certificates[index] = updatedItem;
  } else {
    store.certificates.push(updatedItem);
  }

  saveStore(store);
  res.json({ success: true, certificate: updatedItem });
});

app.delete('/api/admin/certificates/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const store = loadStore();
  store.certificates = store.certificates.filter((c) => c.id !== id);
  saveStore(store);
  res.json({ success: true, id });
});

/**
 * Qualifications CRUD (Protected)
 */
app.get('/api/admin/qualifications', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const sorted = [...store.qualifications].sort((a, b) => a.order - b.order);
  res.json(sorted);
});

app.post('/api/admin/qualifications', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<QualificationItem>;
  const store = loadStore();

  if (!item.degree?.trim() || !item.institution?.trim() || !item.startYear?.trim() || !item.endYear?.trim()) {
    res.status(400).json({ error: 'Degree, institution, start year, and end year are required fields.' });
    return;
  }

  const id = item.id || `qual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const index = store.qualifications.findIndex((q) => q.id === id);

  const updatedItem: QualificationItem = {
    id,
    degree: item.degree.trim(),
    institution: item.institution.trim(),
    specialization: item.specialization?.trim() || '',
    startYear: item.startYear.trim(),
    endYear: item.endYear.trim(),
    grade: item.grade?.trim() || '',
    location: item.location?.trim() || '',
    description: item.description?.trim() || '',
    order: typeof item.order === 'number' ? item.order : store.qualifications.length + 1,
    status: item.status === 'draft' ? 'draft' : 'published',
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    store.qualifications[index] = updatedItem;
  } else {
    store.qualifications.push(updatedItem);
  }

  saveStore(store);
  res.json({ success: true, qualification: updatedItem });
});

app.delete('/api/admin/qualifications/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const store = loadStore();
  store.qualifications = store.qualifications.filter((q) => q.id !== id);
  saveStore(store);
  res.json({ success: true, id });
});

/**
 * Skills Management (Protected)
 */
app.get('/api/admin/skills', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const sorted = [...store.skillCategories].sort((a, b) => a.order - b.order);
  res.json(sorted);
});

app.post('/api/admin/skills', requireAdminAuth, (req, res) => {
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    res.status(400).json({ error: 'Categories must be an array.' });
    return;
  }
  const store = loadStore();
  store.skillCategories = categories;
  saveStore(store);
  res.json({ success: true, categories: store.skillCategories });
});

app.post('/api/admin/skill-category', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<SkillCategoryItem>;
  const store = loadStore();

  if (!item.name?.trim()) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  const id = item.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const index = store.skillCategories.findIndex((c) => c.id === id);

  const updatedItem: SkillCategoryItem = {
    id,
    name: item.name.trim(),
    icon: item.icon?.trim() || 'fas fa-code',
    order: typeof item.order === 'number' ? item.order : store.skillCategories.length + 1,
    skills: Array.isArray(item.skills) ? item.skills : [],
    status: item.status === 'draft' ? 'draft' : 'published',
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    // Preserve existing skills if not overwritten
    if (!item.skills && store.skillCategories[index].skills) {
      updatedItem.skills = store.skillCategories[index].skills;
    }
    store.skillCategories[index] = updatedItem;
  } else {
    store.skillCategories.push(updatedItem);
  }

  saveStore(store);
  res.json({ success: true, category: updatedItem });
});

app.delete('/api/admin/skill-category/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const store = loadStore();
  store.skillCategories = store.skillCategories.filter((c) => c.id !== id);
  saveStore(store);
  res.json({ success: true, id });
});

app.post('/api/admin/skill', requireAdminAuth, (req, res) => {
  const { categoryId, skill } = req.body as { categoryId: string; skill: Partial<SkillItem> };
  const store = loadStore();

  if (!categoryId || !skill?.name?.trim()) {
    res.status(400).json({ error: 'Category ID and skill name are required.' });
    return;
  }

  const category = store.skillCategories.find((c) => c.id === categoryId);
  if (!category) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  const skillId = skill.id || `sk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const existingSkillIndex = category.skills.findIndex((s) => s.id === skillId);

  const updatedSkill: SkillItem = {
    id: skillId,
    name: skill.name.trim(),
    icon: skill.icon?.trim() || 'fas fa-check-circle',
    order: typeof skill.order === 'number' ? skill.order : category.skills.length + 1,
  };

  if (existingSkillIndex >= 0) {
    category.skills[existingSkillIndex] = updatedSkill;
  } else {
    category.skills.push(updatedSkill);
  }

  saveStore(store);
  res.json({ success: true, skill: updatedSkill, category });
});

app.delete('/api/admin/skill', requireAdminAuth, (req, res) => {
  const { categoryId, skillId } = req.body as { categoryId: string; skillId: string };
  const store = loadStore();

  const category = store.skillCategories.find((c) => c.id === categoryId);
  if (!category) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  category.skills = category.skills.filter((s) => s.id !== skillId);
  saveStore(store);
  res.json({ success: true, skillId });
});

/**
 * Connect With Me / Social Links CRUD (Protected)
 */
app.get('/api/admin/social-links', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const sorted = [...store.socialLinks].sort((a, b) => a.order - b.order);
  res.json(sorted);
});

app.post('/api/admin/social-links', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<SocialLinkItem>;
  const store = loadStore();

  if (!item.platform?.trim() || !item.url?.trim() || !item.icon?.trim()) {
    res.status(400).json({ error: 'Platform name, URL/Contact value, and icon are required.' });
    return;
  }

  const id = item.id || `social_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const index = store.socialLinks.findIndex((l) => l.id === id);

  const updatedItem: SocialLinkItem = {
    id,
    platform: item.platform.trim(),
    url: item.url.trim(),
    icon: item.icon.trim(),
    title: item.title?.trim() || item.platform.trim(),
    order: typeof item.order === 'number' ? item.order : store.socialLinks.length + 1,
    isActive: item.isActive !== false,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    store.socialLinks[index] = updatedItem;
  } else {
    store.socialLinks.push(updatedItem);
  }

  saveStore(store);
  res.json({ success: true, link: updatedItem });
});

app.delete('/api/admin/social-links/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const store = loadStore();
  store.socialLinks = store.socialLinks.filter((l) => l.id !== id);
  saveStore(store);
  res.json({ success: true, id });
});

/**
 * Profile Management (Protected)
 */
app.get('/api/admin/profile', requireAdminAuth, (req, res) => {
  const store = loadStore();
  res.json(store.profile);
});

app.post('/api/admin/profile', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<ProfileData>;
  const store = loadStore();
  const prev = store.profile;
  const nextUrl = item.profileImageUrl ?? prev.profileImageUrl;
  const imageChanged = Boolean(item.profileImageUrl && item.profileImageUrl !== prev.profileImageUrl);

  store.profile = {
    ...prev,
    ...item,
    profileImageUrl: nextUrl,
    profileImagePublicId:
      item.profileImagePublicId ||
      (imageChanged ? undefined : prev.profileImagePublicId),
    profileImageResourceType:
      item.profileImageResourceType ||
      (item.profileImagePublicId
        ? 'image'
        : imageChanged
        ? undefined
        : prev.profileImageResourceType),
    profileImageStoragePath: imageChanged ? undefined : prev.profileImageStoragePath,
    updatedAt: new Date().toISOString(),
  };

  saveStore(store);
  res.json({ success: true, profile: store.profile });
});

/**
 * Resume Management (Protected)
 * Automatically preserves previous resume records in history unless explicitly replaced/deleted.
 */
app.get('/api/admin/resume', requireAdminAuth, (req, res) => {
  const store = loadStore();
  res.json(store.resume);
});

app.post('/api/admin/resume', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<ResumeData>;
  const store = loadStore();
  const prev = store.resume;

  let nextHistory: ResumeHistoryEntry[] = Array.isArray(item.history)
    ? item.history
    : Array.isArray(prev.history)
    ? [...prev.history]
    : [];

  const urlChanged =
    Boolean(item.resumePdfUrl && prev.resumePdfUrl && item.resumePdfUrl !== prev.resumePdfUrl);

  if (urlChanged && !Array.isArray(item.history)) {
    const alreadySaved = nextHistory.some((h) => h.resumePdfUrl === prev.resumePdfUrl);
    if (!alreadySaved) {
      const source: ResumeHistoryEntry['source'] =
        prev.publicId ||
        prev.cloudinaryUrl?.includes('cloudinary.com') ||
        prev.resumePdfUrl.includes('cloudinary.com') ||
        prev.resumePdfUrl.includes('/api/public/cloudinary/pdf')
          ? 'cloudinary'
          : prev.storagePath
          ? 'firebase'
          : prev.resumePdfUrl.includes('drive.google.com')
          ? 'drive'
          : 'url';
      nextHistory = [
        {
          id: `res_hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          fileName:
            prev.fileName ||
            (source === 'drive' ? 'Previous Resume (Google Drive)' : 'Previous Resume PDF'),
          resumePdfUrl: prev.resumePdfUrl,
          downloadUrl: prev.downloadUrl || prev.resumePdfUrl,
          ...(prev.cloudinaryUrl ? { cloudinaryUrl: prev.cloudinaryUrl } : {}),
          ...(prev.publicId ? { publicId: prev.publicId } : {}),
          ...(prev.cloudinaryResourceType
            ? { cloudinaryResourceType: prev.cloudinaryResourceType }
            : {}),
          ...(typeof prev.directPdfDelivery === 'boolean'
            ? { directPdfDelivery: prev.directPdfDelivery }
            : {}),
          ...(prev.storagePath ? { storagePath: prev.storagePath } : {}),
          ...(typeof prev.sizeBytes === 'number' ? { sizeBytes: prev.sizeBytes } : {}),
          source,
          savedAt: prev.updatedAt || new Date().toISOString(),
        },
        ...nextHistory,
      ].slice(0, 25);
    }
  }

  store.resume = {
    ...store.resume,
    ...item,
    cloudinaryUrl:
      item.cloudinaryUrl ||
      (item.resumePdfUrl?.includes('cloudinary.com')
        ? item.resumePdfUrl
        : urlChanged
        ? undefined
        : store.resume.cloudinaryUrl),
    publicId:
      item.publicId ||
      item.storagePath ||
      (urlChanged ? undefined : store.resume.publicId),
    cloudinaryResourceType:
      item.cloudinaryResourceType ||
      (item.publicId ? 'image' : urlChanged ? undefined : store.resume.cloudinaryResourceType),
    ...(typeof item.directPdfDelivery === 'boolean'
      ? { directPdfDelivery: item.directPdfDelivery }
      : typeof store.resume.directPdfDelivery === 'boolean'
      ? { directPdfDelivery: store.resume.directPdfDelivery }
      : {}),
    storagePath:
      item.storagePath ||
      item.publicId ||
      (urlChanged ? undefined : store.resume.storagePath),
    history: nextHistory,
    updatedAt: new Date().toISOString(),
  };

  saveStore(store);
  res.json({ success: true, resume: store.resume });
});

/**
 * Media Assets Metadata CRUD (Protected)
 */
app.get('/api/admin/media', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const list = [...(store.mediaAssets || [])].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
  res.json(list);
});

app.post('/api/admin/media', requireAdminAuth, (req, res) => {
  const item = req.body as Partial<MediaAssetRecord>;
  const resolvedId = String(item.id || '').trim();
  const resolvedPublicId = String(item.publicId || item.storagePath || '').trim();
  const resolvedDownloadUrl = String(item.downloadUrl || '').trim();
  const resolvedMime = String(item.mimeType || '').trim().toLowerCase();
  const resolvedSize = Number(item.sizeBytes);

  const isValidMediaUrl = (u: string): boolean =>
    u.length > 0 &&
    u.length <= 2000 &&
    (/^https?:\/\/.+/i.test(u) || u.startsWith('/api/public/cloudinary/pdf?'));

  if (
    !resolvedId ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(resolvedId) ||
    !resolvedDownloadUrl ||
    !isValidMediaUrl(resolvedDownloadUrl) ||
    !resolvedPublicId ||
    resolvedPublicId.length > 500 ||
    !/^[a-zA-Z0-9/._-]+$/.test(resolvedPublicId)
  ) {
    res.status(400).json({ error: 'Valid id, downloadUrl, and publicId are required.' });
    return;
  }

  if (!ALLOWED_CLOUDINARY_MIME_TYPES.has(resolvedMime)) {
    res.status(400).json({
      error: 'Unsupported media mimeType. Allowed types: JPG, JPEG, PNG, WEBP, and PDF.',
    });
    return;
  }

  if (!Number.isFinite(resolvedSize) || resolvedSize <= 0 || resolvedSize > MAX_UPLOAD_BYTES) {
    res.status(400).json({
      error: 'Media file size must be between 1 byte and 10 MB.',
    });
    return;
  }

  const store = loadStore();
  const list = store.mediaAssets || [];
  const idx = list.findIndex((m) => m.id === resolvedId);
  const nowIso = new Date().toISOString();

  const resolvedCategory: MediaAssetRecord['category'] =
    item.category && ALLOWED_MEDIA_CATEGORIES.has(item.category) ? item.category : 'Other';

  const record: MediaAssetRecord = {
    id: resolvedId,
    name: String(item.name || 'Untitled Asset').slice(0, 250),
    category: resolvedCategory,
    downloadUrl: resolvedDownloadUrl,
    ...(typeof item.cloudinaryUrl === 'string' && /^https?:\/\/.+/i.test(item.cloudinaryUrl.trim())
      ? { cloudinaryUrl: item.cloudinaryUrl.trim().slice(0, 2000) }
      : {}),
    publicId: resolvedPublicId,
    cloudinaryResourceType:
      item.cloudinaryResourceType === 'image' ||
      item.cloudinaryResourceType === 'raw' ||
      item.cloudinaryResourceType === 'video'
        ? item.cloudinaryResourceType
        : 'image',
    ...(typeof item.directPdfDelivery === 'boolean'
      ? { directPdfDelivery: item.directPdfDelivery }
      : {}),
    ...(item.format ? { format: String(item.format).slice(0, 32) } : {}),
    ...(item.storagePath ? { storagePath: String(item.storagePath).slice(0, 500) } : {}),
    mimeType: resolvedMime.slice(0, 120),
    sizeBytes: resolvedSize,
    status: item.status === 'published' ? 'published' : 'draft',
    ...(item.linkedEntityType ? { linkedEntityType: String(item.linkedEntityType).slice(0, 60) } : {}),
    ...(item.linkedEntityId ? { linkedEntityId: String(item.linkedEntityId).slice(0, 120) } : {}),
    ...(item.uploadedBy ? { uploadedBy: String(item.uploadedBy).slice(0, 200) } : {}),
    createdAt: item.createdAt || (idx >= 0 ? list[idx].createdAt : nowIso),
    updatedAt: item.updatedAt || nowIso,
  };

  if (idx >= 0) {
    list[idx] = record;
  } else {
    list.unshift(record);
  }

  store.mediaAssets = list;
  saveStore(store);
  res.json({ success: true, asset: record });
});

app.patch('/api/admin/media/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const patch = (req.body || {}) as Partial<MediaAssetRecord>;
  const store = loadStore();
  const list = store.mediaAssets || [];
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) {
    res.status(404).json({ error: 'Media asset not found.' });
    return;
  }

  const current = list[idx];
  const updated: MediaAssetRecord = {
    ...current,
    ...(typeof patch.name === 'string' && patch.name.trim()
      ? { name: patch.name.trim().slice(0, 250) }
      : {}),
    ...(patch.category && ALLOWED_MEDIA_CATEGORIES.has(patch.category)
      ? { category: patch.category }
      : {}),
    ...(patch.status === 'published' || patch.status === 'draft'
      ? { status: patch.status }
      : {}),
    ...(typeof patch.linkedEntityType === 'string'
      ? { linkedEntityType: patch.linkedEntityType.slice(0, 60) }
      : {}),
    ...(typeof patch.linkedEntityId === 'string'
      ? { linkedEntityId: patch.linkedEntityId.slice(0, 120) }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  list[idx] = updated;
  store.mediaAssets = list;
  saveStore(store);
  res.json({ success: true, asset: updated });
});

app.delete('/api/admin/media/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const store = loadStore();
  const list = store.mediaAssets || [];
  const target = list.find((m) => m.id === id);

  if (!target) {
    res.status(404).json({ error: 'Media asset not found.' });
    return;
  }

  // Destroy on Cloudinary if asset has a Cloudinary publicId and wasn't already destroyed in this call chain
  if (
    req.query.cloudDestroyed !== 'true' &&
    target.publicId &&
    (target.downloadUrl?.includes('cloudinary.com') ||
      target.downloadUrl?.includes('/api/public/cloudinary/pdf') ||
      target.cloudinaryUrl?.includes('cloudinary.com'))
  ) {
    const cfg = getCloudinaryConfig();
    if (cfg.configured) {
      try {
        await destroyCloudinaryAssetOnServer(
          target.publicId,
          target.cloudinaryResourceType
        );
      } catch (err: any) {
        res.status(500).json({
          error: err?.message || 'Failed to delete asset binary from Cloudinary.',
        });
        return;
      }
    }
  }

  store.mediaAssets = list.filter((m) => m.id !== id);
  saveStore(store);
  res.json({ success: true, id });
});

/**
 * Backup Export (Protected)
 */
app.get('/api/admin/backup', requireAdminAuth, (req, res) => {
  const store = loadStore();
  res.setHeader('Content-Disposition', `attachment; filename="portfolio-backup-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(store);
});

/**
 * Data Reset / Reseed (Protected)
 */
app.post('/api/admin/seed', requireAdminAuth, (req, res) => {
  const store = loadStore();
  res.json({
    success: true,
    projectsCount: store.projects.length,
    certificatesCount: store.certificates.length,
    qualificationsCount: store.qualifications.length,
    skillsCount: store.skillCategories.length,
    socialLinksCount: store.socialLinks.length,
    message: 'Data synchronization verified successfully.',
  });
});

/**
 * Visitor Contact Messages Inbox & Real-Time Notifications (Protected)
 */
app.get('/api/admin/messages', requireAdminAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const store = loadStore();
  const list = [...(store.messages || [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map(sanitizeAdminMessage);

  const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
  const unreadCount = list.filter((m) => !m.isRead).length;
  const readCount = list.length - unreadCount;
  const recentCount = list.filter((m) => new Date(m.timestamp).getTime() >= dayAgoMs).length;

  res.json({
    messages: list,
    totalCount: list.length,
    unreadCount,
    readCount,
    recentCount,
  });
});

app.get('/api/admin/messages/unread-count', requireAdminAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const store = loadStore();
  const list = store.messages || [];
  const unreadCount = list.filter((m) => !m.isRead).length;
  res.json({
    unreadCount,
    totalCount: list.length,
  });
});

app.get('/api/admin/messages/stream', (req, res) => {
  const token = extractAdminToken(req, true);
  const session = getAdminSession(token);
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized: Administrator authentication required.',
      authenticated: false,
    });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const store = loadStore();
  const list = store.messages || [];
  const unreadCount = list.filter((m) => !m.isRead).length;

  res.write(
    `data: ${JSON.stringify({
      type: 'init',
      unreadCount,
      totalCount: list.length,
    })}\n\n`
  );

  adminMessageSseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      adminMessageSseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    adminMessageSseClients.delete(res);
  });
});

app.patch('/api/admin/messages/:id/read', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { isRead } = req.body || {};
  const store = loadStore();
  if (!store.messages) store.messages = [];

  const idx = store.messages.findIndex((m) => m.id === id);
  if (idx < 0) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  const nextRead = typeof isRead === 'boolean' ? isRead : true;
  store.messages[idx] = {
    ...store.messages[idx],
    isRead: nextRead,
    status: nextRead ? 'read' : 'unread',
    readAt: nextRead ? new Date().toISOString() : undefined,
  };

  saveStore(store);

  const unreadCount = store.messages.filter((m) => !m.isRead).length;
  broadcastAdminMessageEvent({
    type: 'messages_updated',
    unreadCount,
    totalCount: store.messages.length,
  });

  res.json({
    success: true,
    message: sanitizeAdminMessage(store.messages[idx]),
    unreadCount,
    totalCount: store.messages.length,
  });
});

app.delete('/api/admin/messages/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const store = loadStore();
  if (!store.messages) store.messages = [];

  const exists = store.messages.some((m) => m.id === id);
  if (!exists) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  store.messages = store.messages.filter((m) => m.id !== id);
  saveStore(store);

  const unreadCount = store.messages.filter((m) => !m.isRead).length;
  broadcastAdminMessageEvent({
    type: 'messages_updated',
    unreadCount,
    totalCount: store.messages.length,
  });

  res.json({
    success: true,
    deletedId: id,
    unreadCount,
    totalCount: store.messages.length,
  });
});

// ==========================================
// Admin Analytics System (Protected)
// ==========================================

/**
 * GET /api/admin/analytics/overview
 * Returns verifiable metrics calculated from actual stored events.
 */
app.get('/api/admin/analytics/overview', requireAdminAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const store = loadStore();
  const events = store.analyticsEvents || [];

  const range = String(req.query.range || '7d');
  const customStart = req.query.startDate ? String(req.query.startDate) : undefined;
  const customEnd = req.query.endDate ? String(req.query.endDate) : undefined;
  const includeTest = req.query.includeTest === 'true';

  const eligibleEvents = includeTest ? events : events.filter((e) => e.isTest !== true);

  const { filtered, rangeDesc } = filterEventsByDateRange(
    events,
    range,
    customStart,
    customEnd,
    includeTest
  );

  const metrics = calculateAnalyticsMetrics(filtered, rangeDesc, eligibleEvents);
  res.json({
    metrics,
    totalRawEvents: events.length,
    testEventsCount: events.filter((e) => e.isTest === true).length,
    analyticsResetAt: store.analyticsResetAt || null,
  });
});

/**
 * GET /api/admin/analytics/events
 * Returns recent raw events for transparency and inspection.
 */
app.get('/api/admin/analytics/events', requireAdminAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const store = loadStore();
  let events = [...(store.analyticsEvents || [])];

  const includeTest = req.query.includeTest === 'true';
  if (!includeTest) {
    events = events.filter((e) => e.isTest !== true);
  }

  const type = req.query.type ? String(req.query.type) : undefined;
  if (type) {
    events = events.filter((e) => e.eventType === type);
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json(events.slice(0, limit));
});

/**
 * POST /api/admin/analytics/test-event
 * Injects a clearly marked test event to verify end-to-end tracking.
 */
app.post('/api/admin/analytics/test-event', requireAdminAuth, (req, res) => {
  const { eventType, targetId, targetType } = req.body || {};
  const store = loadStore();
  if (!store.analyticsEvents) store.analyticsEvents = [];

  const testEvent: AnalyticsEvent = {
    id: `test_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    eventType: eventType || 'page_view',
    visitorId: 'test_admin_verifier',
    sessionId: `test_session_${Date.now()}`,
    timestamp: new Date().toISOString(),
    targetId: targetId || 'home',
    targetType: targetType || 'test_verification',
    deviceCategory: 'desktop',
    referrer: 'admin_dashboard_test',
    isTest: true,
  };

  store.analyticsEvents.push(testEvent);
  saveStore(store);

  res.json({
    success: true,
    message: 'Test event generated successfully for analytics verification.',
    event: testEvent,
  });
});

/**
 * POST /api/admin/analytics/clear-test-data
 * Removes test events while preserving production analytics.
 */
app.post('/api/admin/analytics/clear-test-data', requireAdminAuth, (req, res) => {
  const store = loadStore();
  const initialCount = store.analyticsEvents?.length || 0;
  if (store.analyticsEvents) {
    store.analyticsEvents = store.analyticsEvents.filter((e) => e.isTest !== true);
  }
  const clearedCount = initialCount - (store.analyticsEvents?.length || 0);
  saveStore(store);

  res.json({
    success: true,
    clearedCount,
    message: `Cleared ${clearedCount} test event(s). Production analytics remain intact.`,
  });
});

/**
 * POST /api/admin/analytics/reset
 * Permanently resets all stored analytics events to zero while preserving all portfolio content & messages.
 */
app.post('/api/admin/analytics/reset', requireAdminAuth, (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== true) {
    res.status(400).json({
      error: 'Explicit confirmation is required to reset analytics data.',
    });
    return;
  }

  const store = loadStore();
  const clearedCount = store.analyticsEvents?.length || 0;
  const resetAt = Date.now();
  store.analyticsEvents = [];
  store.analyticsResetAt = resetAt;

  saveStore(store);

  res.json({
    success: true,
    clearedCount,
    resetAt,
    message: `Analytics reset complete (${clearedCount} historical event(s) cleared). Fresh visitor tracking is active.`,
  });
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * Google Picker runtime configuration endpoint
 * Securely shares the Google Cloud Project Number and Picker developer key
 * across preview and production environments without exposing server-only secrets.
 */
app.get('/api/config/picker', (req, res) => {
  let fallbackKey = '';
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    fallbackKey = parsed.apiKey || '';
  } catch {
    // ignore
  }

  const effectiveKey =
    (process.env.VITE_GOOGLE_API_KEY && process.env.VITE_GOOGLE_API_KEY.trim()) ||
    (process.env.GOOGLE_PICKER_API_KEY && process.env.GOOGLE_PICKER_API_KEY.trim()) ||
    (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim()) ||
    fallbackKey;

  res.json({
    apiKey: effectiveKey,
    appId: '83483776639',
    projectId: '83483776639',
    hasCustomSecret: Boolean(
      process.env.VITE_GOOGLE_API_KEY ||
      process.env.GOOGLE_PICKER_API_KEY ||
      process.env.GOOGLE_API_KEY
    ),
  });
});

// ==========================================
// Vite Dev Server / Static File Serving
// ==========================================

async function startServer() {
  if (!isProduction) {
    // Development mode: Vite middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { index: false }));

    app.use((req, res) => {
      const indexPath = path.resolve(distPath, 'index.html');
      try {
        let html = fs.readFileSync(indexPath, 'utf-8');
        let fallbackKey = '';
        try {
          const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8');
          const parsed = JSON.parse(raw);
          fallbackKey = parsed.apiKey || '';
        } catch {
          // ignore
        }
        const effectiveKey =
          (process.env.VITE_GOOGLE_API_KEY && process.env.VITE_GOOGLE_API_KEY.trim()) ||
          (process.env.GOOGLE_PICKER_API_KEY && process.env.GOOGLE_PICKER_API_KEY.trim()) ||
          (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim()) ||
          fallbackKey;

        const injection = `<script>window.__APP_ENV__ = { VITE_GOOGLE_API_KEY: ${JSON.stringify(effectiveKey)} };</script>`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${injection}\n</head>`);
        } else {
          html = `${injection}\n${html}`;
        }
        res.type('html').send(html);
      } catch (err) {
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Portfolio Server] Listening on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Portfolio Server] Failed to start:', err);
  process.exit(1);
});
