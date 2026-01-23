/**
 * Database availability guard utilities.
 * Helps reduce repetitive `if (!isDatabaseAvailable()) return fallback;` patterns.
 */

import { getDb, isDatabaseAvailable, type Database } from '../../db/client.js';
import type { Kysely } from 'kysely';

/**
 * Execute a function only if the database is available.
 * Returns the fallback value if database is unavailable.
 *
 * @example
 * // Before:
 * export async function listItems(ctx) {
 *   if (!isDatabaseAvailable()) return [];
 *   const db = getDb();
 *   // ... rest of function
 * }
 *
 * // After:
 * export async function listItems(ctx) {
 *   return withDbGuard([], async (db) => {
 *     // ... rest of function
 *   });
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function withDbGuard<T>(
  fallback: any,
  fn: (db: Kysely<Database>) => Promise<T>
): Promise<T> {
  if (!isDatabaseAvailable()) return fallback as T;
  const db = getDb();
  return fn(db);
}

/**
 * Synchronous version of withDbGuard for non-async functions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withDbGuardSync<T>(
  fallback: any,
  fn: (db: Kysely<Database>) => T
): T {
  if (!isDatabaseAvailable()) return fallback as T;
  const db = getDb();
  return fn(db);
}

/**
 * Check if database is unavailable and return a fallback.
 * Useful when you need to keep existing function structure but reduce boilerplate.
 *
 * @example
 * export async function getItem(id, ctx) {
 *   const guard = dbGuard(null);
 *   if (guard.unavailable) return guard.fallback;
 *   const db = getDb();
 *   // ... rest of function
 * }
 */
export function dbGuard<T>(fallback: T): { unavailable: boolean; fallback: T } {
  return {
    unavailable: !isDatabaseAvailable(),
    fallback,
  };
}
