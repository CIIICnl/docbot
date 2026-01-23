/**
 * Secure token utilities for authentication flows.
 * Shared by magic-link and password-reset functionality.
 */

import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure token.
 * Uses 32 bytes (256 bits) of randomness, URL-safe base64 encoded.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash a token for storage using SHA-256.
 * Never store raw tokens - only the hash.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Basic email validation regex.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validate an email address format.
 */
export function validateEmail(email: string): { valid: boolean; reason?: string } {
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized) {
    return { valid: false, reason: 'missing' };
  }

  if (normalized.length > 320) {
    return { valid: false, reason: 'too_long' };
  }

  if (!normalized.includes('@')) {
    return { valid: false, reason: 'missing_at' };
  }

  const [localPart, domain] = normalized.split('@');

  if (!localPart || localPart.length > 64) {
    return { valid: false, reason: 'invalid_local_part' };
  }

  if (!domain || domain.length > 255) {
    return { valid: false, reason: 'invalid_domain' };
  }

  if (normalized.includes('..')) {
    return { valid: false, reason: 'consecutive_dots' };
  }

  if (!domain.includes('.')) {
    return { valid: false, reason: 'missing_tld' };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, reason: 'invalid_format' };
  }

  return { valid: true };
}

/**
 * Check if an email is valid (simple boolean helper).
 */
export function isValidEmail(email: string): boolean {
  return validateEmail(email).valid;
}
