/**
 * Authentication Module
 * Handles user authentication with signed session cookies.
 * Supports shared cookie domain for SSO across subdomains.
 * Supports both environment-based and database-based authentication.
 */

import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseCookies } from '../utils/cookies.js';
import { isDatabaseAvailable } from '../db/client.js';
import {
  getDatabaseUser,
  verifyPassword,
  normalizeEmail,
  type DbContext,
} from '../storage/password-utils.js';

const COOKIE_NAME = 'sb_session';

export interface User {
  email: string;
  role: 'admin' | 'user';
  name: string;
  isAdmin: boolean;
  v?: string;
}

export interface UserWithVersion extends User {
  v: string;
}

interface StoredUser {
  email: string;
  role: 'admin' | 'user';
  name: string;
  key: Buffer;
  v: string;
}

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64urlToBuf(s: string): Buffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad)
    .replaceAll('-', '+')
    .replaceAll('_', '/');
  return Buffer.from(b64, 'base64');
}

function getAdminEmail(): string {
  return String(
    process.env.AUTH_ADMIN_EMAIL || 'jaap@ciiic.nl'
  )
    .trim()
    .toLowerCase();
}

function getSecret(): string {
  const s = String(process.env.AUTH_SECRET || '').trim();
  if (!s)
    throw new Error(
      'AUTH_SECRET is required when auth is enabled'
    );
  return s;
}

function getCookieDomain(): string | null {
  const d = String(process.env.COOKIE_DOMAIN || '').trim();
  return d || null;
}

function deriveSalt(secret: string, email: string): Buffer {
  return crypto
    .createHmac('sha256', secret)
    .update(`pw:${email.toLowerCase()}`)
    .digest()
    .subarray(0, 16);
}

function derivePwKey(secret: string, email: string, password: string): Buffer {
  const salt = deriveSalt(secret, email);
  return crypto.scryptSync(
    String(password || ''),
    salt,
    32
  );
}

let cachedUsers: Map<string, StoredUser> | null = null;
let warnedAuthMisconfig = false;

/**
 * Check if auth is enabled.
 * Auth is enabled if:
 * - AUTH_SECRET is set AND (AUTH_USERS_* is set OR database mode is available)
 */
export function authEnabled(): boolean {
  const hasUsers =
    !!String(process.env.AUTH_USERS_JSON || '').trim() ||
    !!String(process.env.AUTH_USERS_B64 || '').trim();
  const hasSecret = !!String(
    process.env.AUTH_SECRET || ''
  ).trim();
  const hasDatabase = isDatabaseAvailable();

  if (hasUsers && !hasSecret && !warnedAuthMisconfig) {
    warnedAuthMisconfig = true;
    console.warn(
      '[auth] AUTH_USERS_* is set but AUTH_SECRET is missing; auth disabled until configured.'
    );
  }

  // Auth is enabled if we have a secret AND (env users OR database)
  return hasSecret && (hasUsers || hasDatabase);
}

export function devAuthBypassEnabled(): boolean {
  const v = String(process.env.AUTH_DEV_BYPASS || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function devBypassUser(): User {
  return {
    email: 'dev@local',
    role: 'admin',
    name: 'Dev',
    isAdmin: true,
    v: 'dev',
  };
}

export function getUsers(): Map<string, StoredUser> {
  if (cachedUsers) return cachedUsers;
  let raw = String(
    process.env.AUTH_USERS_JSON || ''
  ).trim();
  const rawB64 = String(
    process.env.AUTH_USERS_B64 || ''
  ).trim();
  if (!raw && rawB64) {
    try {
      raw = Buffer.from(rawB64, 'base64').toString('utf8');
    } catch {
      raw = '';
    }
  }
  if (!raw) return (cachedUsers = new Map());

  const adminEmail = getAdminEmail();
  const secret = getSecret();
  const obj = JSON.parse(raw) as Record<string, string | { password?: string; name?: string; role?: string }>;
  const out = new Map<string, StoredUser>();

  for (const [emailRaw, cfg] of Object.entries(obj || {})) {
    const email = String(emailRaw || '')
      .trim()
      .toLowerCase();
    if (!email) continue;
    const password =
      typeof cfg === 'string'
        ? cfg
        : String(cfg?.password || '');
    if (!password) continue;
    const name =
      typeof cfg === 'object' && cfg?.name
        ? String(cfg.name).trim()
        : '';
    const roleRaw =
      typeof cfg === 'object' && cfg?.role
        ? String(cfg.role)
        : email === adminEmail
        ? 'admin'
        : 'user';
    const role = roleRaw === 'admin' ? 'admin' : 'user';
    const key = derivePwKey(secret, email, password);
    const v = base64url(key).slice(0, 12);
    out.set(email, { email, role, name, key, v });
  }
  cachedUsers = out;
  return out;
}

function sign(secret: string, payloadB64: string): string {
  return base64url(
    crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest()
  );
}

export function getUserFromRequest(req: IncomingMessage): User | null {
  if (!authEnabled())
    return {
      email: 'anonymous',
      role: 'admin',
      name: '',
      isAdmin: true,
    };
  if (devAuthBypassEnabled()) return devBypassUser();
  const secret = getSecret();
  const cookies = parseCookies(req.headers?.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const [payloadB64, sig] = String(token).split('.');
  if (!payloadB64 || !sig) return null;
  const expected = sign(secret, payloadB64);
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expected)
      )
    )
      return null;
  } catch {
    return null;
  }

  let payload: { email?: string; exp?: number; v?: string } | null = null;
  try {
    payload = JSON.parse(
      base64urlToBuf(payloadB64).toString('utf8')
    );
  } catch {
    return null;
  }

  const now = Date.now();
  if (!payload?.exp || Number(payload.exp) < now)
    return null;
  const email = String(payload?.email || '').toLowerCase();
  if (!email) return null;

  const users = getUsers();
  const u = users.get(email);
  if (!u) return null;
  if (String(payload?.v || '') !== String(u.v)) return null;

  const adminEmail = getAdminEmail();
  const role =
    u.role === 'admin' || email === adminEmail
      ? 'admin'
      : 'user';
  return {
    email,
    role,
    name: u.name || '',
    isAdmin: role === 'admin',
  };
}

export function isHttpsRequest(req: IncomingMessage): boolean {
  const xf = String(
    req.headers?.['x-forwarded-proto'] || ''
  ).toLowerCase();
  if (xf === 'https') return true;
  const force = String(
    process.env.SECURE_COOKIES || ''
  ).trim();
  if (force === '1' || force.toLowerCase() === 'true')
    return true;
  return false;
}

export function setSessionCookie(
  req: IncomingMessage,
  res: ServerResponse,
  user: UserWithVersion,
  { days = 30 } = {}
): void {
  const secret = getSecret();
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = {
    email: user.email,
    role: user.role,
    name: user.name || '',
    exp,
    v: user.v,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = sign(secret, payloadB64);
  const token = `${payloadB64}.${sig}`;

  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor((exp - Date.now()) / 1000)}`,
  ];

  // Add cookie domain for cross-subdomain SSO
  const domain = getCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);

  if (isHttpsRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: IncomingMessage, res: ServerResponse): void {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  // Include domain when clearing to match the original cookie
  const domain = getCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);

  if (isHttpsRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function verifyLogin(emailRaw: string, passwordRaw: string): UserWithVersion | null {
  if (!authEnabled())
    return {
      email: 'anonymous',
      role: 'admin',
      name: '',
      isAdmin: true,
      v: 'anon',
    };
  if (devAuthBypassEnabled()) return { ...devBypassUser(), v: 'dev' };
  const email = String(emailRaw || '')
    .trim()
    .toLowerCase();
  const password = String(passwordRaw || '');
  const users = getUsers();
  const u = users.get(email);
  if (!u) return null;
  const secret = getSecret();
  const candidate = derivePwKey(secret, email, password);
  try {
    if (!crypto.timingSafeEqual(candidate, u.key))
      return null;
  } catch {
    return null;
  }
  const adminEmail = getAdminEmail();
  const role =
    u.role === 'admin' || email === adminEmail
      ? 'admin'
      : 'user';
  return {
    email,
    role,
    name: u.name || '',
    isAdmin: role === 'admin',
    v: u.v,
  };
}

/**
 * Async login verification that checks database users first, then falls back to env users.
 */
export async function verifyLoginAsync(
  emailRaw: string,
  passwordRaw: string,
  ctx?: DbContext
): Promise<UserWithVersion | null> {
  if (!authEnabled()) {
    return {
      email: 'anonymous',
      role: 'admin',
      name: '',
      isAdmin: true,
      v: 'anon',
    };
  }
  if (devAuthBypassEnabled()) return { ...devBypassUser(), v: 'dev' };

  const email = normalizeEmail(emailRaw);
  if (!email) return null;
  const password = String(passwordRaw || '');

  // Try database authentication first (if available)
  if (isDatabaseAvailable()) {
    const dbUser = await getDatabaseUser(email, ctx);
    if (dbUser?.password_hash && dbUser.auth_source === 'database') {
      const isValid = await verifyPassword(password, dbUser.password_hash);
      if (isValid) {
        const adminEmail = getAdminEmail();
        const role =
          dbUser.role === 'admin' || email === adminEmail
            ? 'admin'
            : 'user';
        // Use password_changed_at timestamp as version for session invalidation
        // Must match slidecreator's calculation: SHA256 hash of timestamp, then base64url
        const v = dbUser.password_changed_at
          ? base64url(
              crypto
                .createHash('sha256')
                .update(String(dbUser.password_changed_at))
                .digest()
            ).slice(0, 12)
          : 'db';
        return {
          email,
          role,
          name: dbUser.name || '',
          isAdmin: role === 'admin',
          v,
        };
      }
      // If DB user exists with database auth source but password doesn't match, fail
      return null;
    }
  }

  // Fall back to environment-based authentication
  return verifyLogin(emailRaw, passwordRaw);
}

/**
 * Build a session user for an already-verified email (no password check), used
 * by trusted external sign-in paths such as OIDC/ZITADEL after the IdP has
 * verified the user. Returns null when the email is not a database user in the
 * shared `users` table — external auth does not auto-provision accounts.
 *
 * Mirrors getUserFromRequestAsync's version key (`password_changed_at` only)
 * so the minted sb_session validates on the very next request.
 */
export async function createSessionUserForEmail(
  emailRaw: string,
  ctx?: DbContext
): Promise<UserWithVersion | null> {
  const email = normalizeEmail(emailRaw);
  if (!email || !isDatabaseAvailable()) return null;

  const dbUser = await getDatabaseUser(email, ctx);
  if (!dbUser || dbUser.auth_source !== 'database') return null;

  const adminEmail = getAdminEmail();
  const role =
    dbUser.role === 'admin' || email === adminEmail ? 'admin' : 'user';
  const v = dbUser.password_changed_at
    ? base64url(
        crypto.createHash('sha256').update(String(dbUser.password_changed_at)).digest()
      ).slice(0, 12)
    : 'db';

  return { email, role, name: dbUser.name || '', isAdmin: role === 'admin', v };
}

/**
 * Async version of getUserFromRequest that validates sessions against database.
 */
export async function getUserFromRequestAsync(
  req: IncomingMessage,
  ctx?: DbContext
): Promise<User | null> {
  if (!authEnabled()) {
    return {
      email: 'anonymous',
      role: 'admin',
      name: '',
      isAdmin: true,
    };
  }
  if (devAuthBypassEnabled()) return devBypassUser();

  const secret = getSecret();
  const cookies = parseCookies(req.headers?.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const [payloadB64, sig] = String(token).split('.');
  if (!payloadB64 || !sig) return null;
  const expected = sign(secret, payloadB64);
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expected)
      )
    )
      return null;
  } catch {
    return null;
  }

  let payload: { email?: string; exp?: number; v?: string } | null = null;
  try {
    payload = JSON.parse(
      base64urlToBuf(payloadB64).toString('utf8')
    );
  } catch {
    return null;
  }

  const now = Date.now();
  if (!payload?.exp || Number(payload.exp) < now) return null;
  const email = normalizeEmail(payload?.email);
  if (!email) return null;

  // Check database user first (if available)
  if (isDatabaseAvailable()) {
    const dbUser = await getDatabaseUser(email, ctx);
    if (dbUser?.auth_source === 'database') {
      // Verify session version matches password_changed_at
      // Must match slidecreator's calculation: SHA256 hash of timestamp, then base64url
      const expectedV = dbUser.password_changed_at
        ? base64url(
            crypto
              .createHash('sha256')
              .update(String(dbUser.password_changed_at))
              .digest()
          ).slice(0, 12)
        : 'db';
      if (String(payload?.v || '') !== expectedV) {
        // Password was changed, invalidate session
        return null;
      }
      const adminEmail = getAdminEmail();
      const role =
        dbUser.role === 'admin' || email === adminEmail
          ? 'admin'
          : 'user';
      return {
        email,
        role,
        name: dbUser.name || '',
        isAdmin: role === 'admin',
      };
    }
  }

  // Fall back to env-based user validation
  const users = getUsers();
  const u = users.get(email);
  if (!u) return null;
  if (String(payload?.v || '') !== String(u.v)) return null;

  const adminEmail = getAdminEmail();
  const role =
    u.role === 'admin' || email === adminEmail
      ? 'admin'
      : 'user';
  return {
    email,
    role,
    name: u.name || '',
    isAdmin: role === 'admin',
  };
}
