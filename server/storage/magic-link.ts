/**
 * Storage layer for magic link (passwordless login) functionality.
 */

import crypto from 'node:crypto';
import { getOrgId } from '../utils/context.js';
import { normalizeEmail, nowIso, isoAfter, isoBefore } from '../utils/normalize.js';
import { generateSecureToken, hashToken, isValidEmail } from '../utils/secure-tokens.js';
import { withDbGuard } from './utils/db-guard.js';

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const RATE_LIMIT_PER_EMAIL = 5; // per hour
const RATE_LIMIT_PER_IP = 15; // per hour

/**
 * Check if a magic link request is rate limited by email.
 */
export async function isRateLimitedByEmail(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  return withDbGuard(false, async (db) => {
    const oneHourAgo = isoBefore(60 * 60 * 1000);

    const result = await db
      .selectFrom('magic_link_tokens')
      .select(db.fn.count('id').as('count'))
      .where('user_email', '=', normalized)
      .where('created_at', '>=', oneHourAgo)
      .executeTakeFirst();

    return Number(result?.count || 0) >= RATE_LIMIT_PER_EMAIL;
  });
}

/**
 * Check if a magic link request is rate limited by IP.
 */
export async function isRateLimitedByIp(ipAddress: string | null): Promise<boolean> {
  if (!ipAddress) return false;

  return withDbGuard(false, async (db) => {
    const oneHourAgo = isoBefore(60 * 60 * 1000);

    const result = await db
      .selectFrom('magic_link_tokens')
      .select(db.fn.count('id').as('count'))
      .where('ip_address', '=', ipAddress)
      .where('created_at', '>=', oneHourAgo)
      .executeTakeFirst();

    return Number(result?.count || 0) >= RATE_LIMIT_PER_IP;
  });
}

interface TokenInfo {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Create a magic link token for a user.
 */
export async function createMagicToken(
  email: string,
  info?: TokenInfo
): Promise<{ ok: boolean; reason?: string; token?: string; expiresAt?: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized || !isValidEmail(normalized)) {
    return { ok: false, reason: 'invalid_email' };
  }

  return withDbGuard({ ok: false, reason: 'unavailable' }, async (db) => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = isoAfter(MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    await db
      .insertInto('magic_link_tokens')
      .values({
        user_email: normalized,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ip_address: info?.ipAddress || null,
        user_agent: info?.userAgent || null,
      })
      .execute();

    return {
      ok: true,
      token: rawToken,
      expiresAt,
    };
  });
}

/**
 * Consume a magic link token and mark it as used.
 */
export async function consumeMagicToken(
  rawToken: string
): Promise<{ ok: boolean; reason?: string; email?: string }> {
  const token = String(rawToken || '').trim();
  if (!token) {
    return { ok: false, reason: 'invalid' };
  }

  return withDbGuard({ ok: false, reason: 'unavailable' }, async (db) => {
    const tokenHash = hashToken(token);
    const now = nowIso();

    const row = await db
      .updateTable('magic_link_tokens')
      .set({ used_at: now })
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .where('expires_at', '>', now)
      .returningAll()
      .executeTakeFirst();

    if (!row) {
      return { ok: false, reason: 'invalid_or_expired' };
    }

    return {
      ok: true,
      email: row.user_email,
    };
  });
}

interface DbContext {
  organizationId?: string;
}

interface MagicLinkUser {
  id: string;
  email: string;
  name: string;
  role: string;
  v: string;
}

/**
 * Get or create a user for magic link login.
 */
export async function getOrCreateMagicLinkUser(
  email: string,
  ctx?: DbContext
): Promise<{ ok: boolean; reason?: string; user?: MagicLinkUser }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, reason: 'invalid_email' };
  }

  return withDbGuard({ ok: false, reason: 'unavailable' }, async (db) => {
    const orgId = getOrgId(ctx);
    const now = nowIso();

    // Check if user exists
    let user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', normalized)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!user) {
      // Create new user with magic_link auth source
      const inserted = await db
        .insertInto('users')
        .values({
          organization_id: orgId,
          email: normalized,
          auth_source: 'magic_link',
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirst();
      user = inserted;
    }

    if (!user) {
      return { ok: false, reason: 'failed_to_create_user' };
    }

    // Generate session version based on updated_at
    const versionSource = user.password_changed_at || user.updated_at || now;
    const v = crypto
      .createHash('sha256')
      .update(String(versionSource))
      .digest('base64url')
      .slice(0, 12);

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role || 'user',
        v,
      },
    };
  });
}
