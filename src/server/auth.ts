import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const AUTH_FILE = path.resolve(DATA_DIR, 'admin-auth.json');

interface PersistedAdminCredentials {
  username: string;
  passwordHash: string;
  updatedAt: string;
}

const RESERVED_USERNAMES = new Set([
  'root',
  'system',
  'superuser',
  'administrator',
  'anonymous',
  'guest',
  'null',
  'undefined',
  'support',
  'security',
  'postmaster',
  'webmaster',
]);

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

/**
 * Loads persisted admin credentials from disk, initializing safely on first run
 * so existing admin access is never locked out during upgrades.
 */
function loadAdminCredentials(): PersistedAdminCredentials {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedAdminCredentials>;
      if (
        typeof parsed.username === 'string' &&
        parsed.username.trim().length > 0 &&
        typeof parsed.passwordHash === 'string' &&
        parsed.passwordHash.startsWith('$2')
      ) {
        return {
          username: parsed.username.trim(),
          passwordHash: parsed.passwordHash,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('[AdminAuth] Failed reading persisted credentials file, re-initializing default:', err);
  }

  const defaultUsername = (process.env.ADMIN_USERNAME || 'mayurhr').trim();
  const defaultHash =
    process.env.ADMIN_PASSWORD_HASH ||
    bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Mayur@Admin2026!', 12);

  const initial: PersistedAdminCredentials = {
    username: defaultUsername,
    passwordHash: defaultHash,
    updatedAt: new Date().toISOString(),
  };

  saveAdminCredentials(initial);
  return initial;
}

function saveAdminCredentials(creds: PersistedAdminCredentials): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify(creds, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

// Initialize credentials store on module load
loadAdminCredentials();

export interface AdminUser {
  username: string;
  role: 'admin';
}

export interface SessionData {
  token: string;
  user: AdminUser;
  createdAt: number;
  expiresAt: number;
  ip: string;
}

// In-memory Session Store (token -> SessionData)
const sessions = new Map<string, SessionData>();

// Rate Limiter Store (key -> { count: number, firstAttempt: number, lockUntil: number })
interface RateLimitRecord {
  count: number;
  firstAttempt: number;
  lockUntil: number;
}
const rateLimits = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Checks rate limiting for login attempts by IP and username.
 */
export function checkRateLimit(key: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const record = rateLimits.get(key);

  if (!record) {
    return { allowed: true };
  }

  if (record.lockUntil > now) {
    const remainingMinutes = Math.ceil((record.lockUntil - now) / 60000);
    return {
      allowed: false,
      message: `Too many failed login attempts. Access is locked for security. Please try again in ${remainingMinutes} minute(s).`,
    };
  }

  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    rateLimits.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string): { locked: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimits.get(key) || { count: 0, firstAttempt: now, lockUntil: 0 };

  record.count += 1;
  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockUntil = now + LOCKOUT_DURATION_MS;
    rateLimits.set(key, record);
    return { locked: true, remaining: 0 };
  }

  rateLimits.set(key, record);
  return { locked: false, remaining };
}

export function resetRateLimit(key: string): void {
  rateLimits.delete(key);
}

/**
 * Validates admin credentials using constant-time username comparison and bcrypt password hash check.
 */
export async function verifyAdminCredentials(
  username: unknown,
  password: unknown
): Promise<{ success: boolean; canonicalUsername?: string; error?: string }> {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { success: false, error: 'Username and password are required' };
  }

  const cleanUser = username.trim();
  if (!cleanUser || !password) {
    return { success: false, error: 'Username and password cannot be empty' };
  }

  const creds = loadAdminCredentials();
  const storedUser = creds.username;

  // Constant-time comparison for username (case-sensitive canonical match)
  const cleanBuf = Buffer.from(cleanUser, 'utf-8');
  const storedBuf = Buffer.from(storedUser, 'utf-8');
  const isUserMatch =
    cleanBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(cleanBuf, storedBuf);

  if (!isUserMatch) {
    // Run dummy bcrypt compare to prevent timing attacks
    await bcrypt.compare(password, creds.passwordHash);
    return { success: false, error: 'Invalid username or password' };
  }

  const isPasswordMatch = await bcrypt.compare(password, creds.passwordHash);
  if (!isPasswordMatch) {
    return { success: false, error: 'Invalid username or password' };
  }

  return { success: true, canonicalUsername: storedUser };
}

/**
 * Creates a cryptographically secure session.
 */
export function createAdminSession(user: AdminUser, ip: string): SessionData {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: SessionData = {
    token,
    user,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    ip,
  };

  sessions.set(token, session);
  return session;
}

/**
 * Validates a session token.
 */
export function getAdminSession(token?: string): SessionData | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Destroys a single session.
 */
export function destroyAdminSession(token?: string): void {
  if (token) {
    sessions.delete(token);
  }
}

/**
 * Extracts admin token from cookie, Authorization header, or optional query parameter (for SSE).
 */
export function extractAdminToken(req: Request, allowQueryToken = false): string | undefined {
  const cookieToken = (req as any).cookies?.admin_session;
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  if (allowQueryToken && typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return undefined;
}

/**
 * Express middleware to enforce admin authentication on protected endpoints.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractAdminToken(req, false);
  const session = getAdminSession(token);
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized: Administrator authentication required.',
      authenticated: false,
    });
    return;
  }

  (req as any).adminSession = session;
  (req as any).adminToken = token;
  next();
}

/**
 * Returns public-safe metadata for the currently configured admin account.
 */
export function getAdminAccountInfo(): { username: string; updatedAt: string } {
  const creds = loadAdminCredentials();
  return {
    username: creds.username,
    updatedAt: creds.updatedAt,
  };
}

/**
 * Updates the administrator username with format and conflict validation,
 * persists to disk, invalidates old sessions, and issues a refreshed session.
 */
export async function updateAdminUsername(
  newUsername: unknown,
  clientIp: string = 'unknown'
): Promise<{ user: AdminUser; token: string; updatedAt: string }> {
  if (typeof newUsername !== 'string') {
    throw new Error('New username is required.');
  }

  const cleanUsername = newUsername.trim();
  if (!cleanUsername) {
    throw new Error('Username cannot be empty.');
  }

  if (!USERNAME_PATTERN.test(cleanUsername)) {
    throw new Error(
      'Username must be 3 to 32 characters and may only contain letters, numbers, dots, underscores, or hyphens.'
    );
  }

  if (RESERVED_USERNAMES.has(cleanUsername.toLowerCase())) {
    throw new Error('This username is reserved and cannot be used.');
  }

  const creds = loadAdminCredentials();
  if (cleanUsername.toLowerCase() === creds.username.toLowerCase()) {
    throw new Error('New username conflicts with your current username. Please choose a different username.');
  }

  const updatedAt = new Date().toISOString();
  const nextCreds: PersistedAdminCredentials = {
    username: cleanUsername,
    passwordHash: creds.passwordHash,
    updatedAt,
  };

  saveAdminCredentials(nextCreds);

  // Invalidate prior sessions and issue refreshed session
  sessions.clear();
  const refreshedSession = createAdminSession(
    { username: cleanUsername, role: 'admin' },
    clientIp
  );

  return {
    user: refreshedSession.user,
    token: refreshedSession.token,
    updatedAt,
  };
}

/**
 * Updates the administrator password after verifying current password,
 * enforcing strength & confirmation match, hashing with bcrypt, persisting to disk,
 * invalidating prior sessions, and issuing a refreshed session.
 */
export async function updateAdminPassword(
  currentPassword: unknown,
  newPassword: unknown,
  confirmPassword: unknown,
  clientIp: string = 'unknown'
): Promise<{ user: AdminUser; token: string; updatedAt: string }> {
  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    typeof confirmPassword !== 'string'
  ) {
    throw new Error('Current password, new password, and confirm password are required.');
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error('All password fields are required.');
  }

  const creds = loadAdminCredentials();

  // Verify existing password before permitting change
  const isCurrentValid = await bcrypt.compare(currentPassword, creds.passwordHash);
  if (!isCurrentValid) {
    throw new Error('Current password is incorrect.');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('New password and confirm password do not match.');
  }

  if (newPassword === currentPassword) {
    throw new Error('New password must be different from your current password.');
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    throw new Error('New password must be between 8 and 128 characters long.');
  }

  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new Error('New password must include at least one letter and one number.');
  }

  const nextHash = await bcrypt.hash(newPassword, 12);
  const updatedAt = new Date().toISOString();
  const nextCreds: PersistedAdminCredentials = {
    username: creds.username,
    passwordHash: nextHash,
    updatedAt,
  };

  saveAdminCredentials(nextCreds);

  // Invalidate prior sessions and issue refreshed session
  sessions.clear();
  const refreshedSession = createAdminSession(
    { username: creds.username, role: 'admin' },
    clientIp
  );

  return {
    user: refreshedSession.user,
    token: refreshedSession.token,
    updatedAt,
  };
}
