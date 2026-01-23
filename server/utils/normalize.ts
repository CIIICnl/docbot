/**
 * String normalization utilities.
 */

/**
 * Normalize an email address.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  const s = String(email || '').trim().toLowerCase();
  return s || null;
}

/**
 * Get current timestamp as ISO string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Get a timestamp in the future as ISO string.
 */
export function isoAfter(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/**
 * Get a timestamp in the past as ISO string.
 */
export function isoBefore(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}
