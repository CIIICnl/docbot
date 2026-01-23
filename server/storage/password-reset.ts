/**
 * Storage layer for password reset functionality.
 * Handles token generation, validation, and rate limiting.
 */

import { normalizeEmail, nowIso, isoAfter, isoBefore } from '../utils/normalize.js';
import { generateSecureToken, hashToken, isValidEmail } from '../utils/secure-tokens.js';
import { withDbGuard } from './utils/db-guard.js';

const TOKEN_EXPIRY_HOURS = 1;
const RATE_LIMIT_PER_EMAIL = 3; // per hour
const RATE_LIMIT_PER_IP = 10; // per hour

/**
 * Check if a password reset request is rate limited by email.
 */
export async function isRateLimitedByEmail(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  return withDbGuard(false, async (db) => {
    const oneHourAgo = isoBefore(60 * 60 * 1000);

    const result = await db
      .selectFrom('password_reset_tokens')
      .select(db.fn.count('id').as('count'))
      .where('user_email', '=', normalized)
      .where('created_at', '>=', oneHourAgo)
      .executeTakeFirst();

    return Number(result?.count || 0) >= RATE_LIMIT_PER_EMAIL;
  });
}

/**
 * Check if a password reset request is rate limited by IP.
 */
export async function isRateLimitedByIp(ipAddress: string | null): Promise<boolean> {
  if (!ipAddress) return false;

  return withDbGuard(false, async (db) => {
    const oneHourAgo = isoBefore(60 * 60 * 1000);

    const result = await db
      .selectFrom('password_reset_tokens')
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
 * Create a password reset token for a user.
 */
export async function createResetToken(
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
    const expiresAt = isoAfter(TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await db
      .insertInto('password_reset_tokens')
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
 * Validate a password reset token without consuming it.
 */
export async function validateResetToken(
  rawToken: string
): Promise<{ ok: boolean; reason?: string; email?: string; maskedEmail?: string; expiresAt?: string }> {
  const token = String(rawToken || '').trim();
  if (!token) {
    return { ok: false, reason: 'invalid' };
  }

  return withDbGuard({ ok: false, reason: 'unavailable' }, async (db) => {
    const tokenHash = hashToken(token);

    const row = await db
      .selectFrom('password_reset_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .executeTakeFirst();

    if (!row) {
      return { ok: false, reason: 'invalid' };
    }

    if (new Date(row.expires_at) < new Date()) {
      return { ok: false, reason: 'expired' };
    }

    // Mask email for display
    const email = row.user_email;
    const [localPart, domain] = email.split('@');
    const maskedLocal =
      localPart.length > 2 ? localPart.slice(0, 2) + '***' : '***';
    const maskedEmail = `${maskedLocal}@${domain}`;

    return {
      ok: true,
      email: row.user_email,
      maskedEmail,
      expiresAt: row.expires_at,
    };
  });
}

/**
 * Consume a password reset token and mark it as used.
 */
export async function consumeResetToken(
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
      .updateTable('password_reset_tokens')
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

interface AuthEvent {
  type: string;
  email?: string | null;
  success?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log an authentication-related event.
 */
export async function logAuthEvent(event: AuthEvent): Promise<void> {
  return withDbGuard(undefined, async (db) => {
    await db
      .insertInto('auth_audit_log')
      .values({
        user_email: event.email || null,
        event_type: event.type,
        success: event.success ?? false,
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null,
        metadata: event.metadata || {},
      })
      .execute();
  });
}
