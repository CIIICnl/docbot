/**
 * Password utilities and database user management.
 * Handles password hashing, verification, and database user lookups.
 */

import crypto from 'node:crypto';
import { getDefaultOrganizationId } from '../config/database.js';
import { withDbGuard } from './utils/db-guard.js';

/**
 * Normalize an email address.
 * Trims whitespace and converts to lowercase.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  const s = String(email || '').trim().toLowerCase();
  return s || null;
}

/**
 * Hash a password using scrypt with a random salt.
 * @returns The hashed password in format salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a password against a stored hash using timing-safe comparison.
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = String(hash || '').split(':');
    if (!salt || !key) {
      resolve(false);
      return;
    }
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      try {
        resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
      } catch {
        resolve(false);
      }
    });
  });
}

export interface DbContext {
  organizationId?: string;
}

export interface DatabaseUser {
  id: string;
  organization_id: string;
  email: string;
  name: string | null;
  role: string;
  password_hash: string | null;
  password_changed_at: string | null;
  auth_source: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get the organization ID from context, falling back to default.
 */
function getOrgId(ctx?: DbContext): string {
  return ctx?.organizationId || getDefaultOrganizationId();
}

/**
 * Get a database user by email (with password hash).
 */
export async function getDatabaseUser(
  email: string,
  ctx?: DbContext
): Promise<DatabaseUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  return withDbGuard(null, async (db) => {
    const orgId = getOrgId(ctx);

    const row = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', normalized)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    return row || null;
  });
}

/**
 * Check if a user exists in the database with a password hash.
 */
export async function hasDatabaseCredentials(
  email: string,
  ctx?: DbContext
): Promise<boolean> {
  const user = await getDatabaseUser(email, ctx);
  return !!(user?.password_hash && user?.auth_source === 'database');
}

/**
 * Verify a user's current password.
 * @returns True if password is correct
 */
export async function verifyUserPassword(
  email: string,
  password: string,
  ctx?: DbContext
): Promise<boolean> {
  const user = await getDatabaseUser(email, ctx);
  if (!user?.password_hash) return false;

  return verifyPassword(password, user.password_hash);
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Validate password meets minimum requirements.
 */
export function validatePassword(password: string): { ok: boolean; reason?: string } {
  const pw = String(password || '');
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'too_short' };
  }
  return { ok: true };
}

/**
 * Set a user's password (creates/updates database user).
 */
export async function setUserPassword(
  email: string,
  password: string,
  ctx?: DbContext
): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, reason: 'invalid_email' };
  }

  const validation = validatePassword(password);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  return withDbGuard({ ok: false, reason: 'unavailable' }, async (db) => {
    const orgId = getOrgId(ctx);
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    // Check if user exists
    const existingUser = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', normalized)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (existingUser) {
      // Update existing user
      await db
        .updateTable('users')
        .set({
          password_hash: passwordHash,
          password_changed_at: now,
          auth_source: 'database',
          updated_at: now,
        })
        .where('id', '=', existingUser.id)
        .execute();
    } else {
      // Create new user
      await db
        .insertInto('users')
        .values({
          organization_id: orgId,
          email: normalized,
          password_hash: passwordHash,
          password_changed_at: now,
          auth_source: 'database',
          created_at: now,
          updated_at: now,
        })
        .execute();
    }

    return { ok: true };
  });
}
