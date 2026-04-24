/**
 * Document Locks Storage Layer
 * Turn-based editing lock management.
 */

import { getDb, isDatabaseAvailable } from '../db/client.js';

export interface DocumentLock {
  documentId: string;
  holderEmail: string;
  holderName: string | null;
  acquiredAt: string;
  expiresAt: string;
}

export interface LockRequest {
  id: string;
  documentId: string;
  requesterEmail: string;
  message: string | null;
  status: 'pending' | 'approved' | 'denied';
  respondedAt: string | null;
  respondedBy: string | null;
  createdAt: string;
}

// Row types
interface LockRow {
  document_id: string;
  holder_email: string;
  holder_name: string | null;
  acquired_at: string;
  expires_at: string;
}

interface LockRequestRow {
  id: string;
  document_id: string;
  requester_email: string;
  message: string | null;
  status: string;
  responded_at: string | null;
  responded_by: string | null;
  created_at: string;
}

// Default lock duration: 30 minutes
const DEFAULT_LOCK_DURATION_MS = 30 * 60 * 1000;

function rowToLock(row: LockRow): DocumentLock {
  return {
    documentId: row.document_id,
    holderEmail: row.holder_email,
    holderName: row.holder_name,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
  };
}

function rowToRequest(row: LockRequestRow): LockRequest {
  return {
    id: row.id,
    documentId: row.document_id,
    requesterEmail: row.requester_email,
    message: row.message,
    status: row.status as LockRequest['status'],
    respondedAt: row.responded_at,
    respondedBy: row.responded_by,
    createdAt: row.created_at,
  };
}

/**
 * Get current lock for a document
 */
export async function getLock(documentId: string): Promise<DocumentLock | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  const now = new Date().toISOString();

  // Delete expired locks first
  await db
    .deleteFrom('document_locks')
    .where('document_id', '=', documentId)
    .where('expires_at', '<', now)
    .execute();

  // Get active lock
  const result = await db
    .selectFrom('document_locks')
    .selectAll()
    .where('document_id', '=', documentId)
    .executeTakeFirst();

  return result ? rowToLock(result as LockRow) : null;
}

/**
 * Acquire a lock on a document
 * Returns the lock if acquired, null if already locked by someone else
 */
export async function acquireLock(
  documentId: string,
  holderEmail: string,
  holderName?: string,
  durationMs = DEFAULT_LOCK_DURATION_MS
): Promise<DocumentLock | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMs).toISOString();

  // Check for existing lock
  const existingLock = await getLock(documentId);

  if (existingLock) {
    // If same holder, extend the lock
    if (existingLock.holderEmail === holderEmail) {
      const result = await db
        .updateTable('document_locks')
        .set({
          expires_at: expiresAt,
          holder_name: holderName || existingLock.holderName,
        })
        .where('document_id', '=', documentId)
        .returningAll()
        .executeTakeFirst();

      return result ? rowToLock(result as LockRow) : null;
    }

    // Locked by someone else
    return null;
  }

  // Create new lock
  try {
    const result = await db
      .insertInto('document_locks')
      .values({
        document_id: documentId,
        holder_email: holderEmail,
        holder_name: holderName || null,
        expires_at: expiresAt,
      })
      .returningAll()
      .executeTakeFirst();

    return result ? rowToLock(result as LockRow) : null;
  } catch (err: unknown) {
    // Unique constraint violation = race condition, someone else got the lock
    if ((err as { code?: string }).code === '23505') {
      return null;
    }
    throw err;
  }
}

/**
 * Release a lock on a document
 * Only the holder can release the lock
 */
export async function releaseLock(
  documentId: string,
  holderEmail: string
): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const db = getDb();

  const result = await db
    .deleteFrom('document_locks')
    .where('document_id', '=', documentId)
    .where('holder_email', '=', holderEmail)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0) > 0;
}

/**
 * Force release a lock (admin action)
 */
export async function forceReleaseLock(documentId: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const db = getDb();

  const result = await db
    .deleteFrom('document_locks')
    .where('document_id', '=', documentId)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0) > 0;
}

/**
 * Extend an existing lock
 */
export async function extendLock(
  documentId: string,
  holderEmail: string,
  durationMs = DEFAULT_LOCK_DURATION_MS
): Promise<DocumentLock | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  const expiresAt = new Date(Date.now() + durationMs).toISOString();

  const result = await db
    .updateTable('document_locks')
    .set({ expires_at: expiresAt })
    .where('document_id', '=', documentId)
    .where('holder_email', '=', holderEmail)
    .returningAll()
    .executeTakeFirst();

  return result ? rowToLock(result as LockRow) : null;
}

/**
 * Check if a user holds the lock
 */
export async function holdsLock(documentId: string, userEmail: string): Promise<boolean> {
  const lock = await getLock(documentId);
  return lock?.holderEmail === userEmail;
}

// ========== Lock Requests ==========

/**
 * Create a lock request
 */
export async function createLockRequest(
  documentId: string,
  requesterEmail: string,
  message?: string
): Promise<LockRequest | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  // Check for existing pending request
  const existing = await db
    .selectFrom('document_lock_requests')
    .selectAll()
    .where('document_id', '=', documentId)
    .where('requester_email', '=', requesterEmail)
    .where('status', '=', 'pending')
    .executeTakeFirst();

  if (existing) {
    return rowToRequest(existing as LockRequestRow);
  }

  const result = await db
    .insertInto('document_lock_requests')
    .values({
      document_id: documentId,
      requester_email: requesterEmail,
      message: message || null,
    })
    .returningAll()
    .executeTakeFirst();

  return result ? rowToRequest(result as LockRequestRow) : null;
}

/**
 * Get pending lock requests for a document
 */
export async function getPendingRequests(documentId: string): Promise<LockRequest[]> {
  if (!isDatabaseAvailable()) return [];

  const db = getDb();

  const results = await db
    .selectFrom('document_lock_requests')
    .selectAll()
    .where('document_id', '=', documentId)
    .where('status', '=', 'pending')
    .orderBy('created_at', 'asc')
    .execute();

  return results.map(row => rowToRequest(row as LockRequestRow));
}

/**
 * Respond to a lock request
 */
export async function respondToRequest(
  requestId: string,
  status: 'approved' | 'denied',
  respondedBy: string
): Promise<LockRequest | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .updateTable('document_lock_requests')
    .set({
      status,
      responded_at: new Date().toISOString(),
      responded_by: respondedBy,
    })
    .where('id', '=', requestId)
    .where('status', '=', 'pending')
    .returningAll()
    .executeTakeFirst();

  return result ? rowToRequest(result as LockRequestRow) : null;
}

/**
 * Get lock request by ID
 */
export async function getLockRequest(requestId: string): Promise<LockRequest | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .selectFrom('document_lock_requests')
    .selectAll()
    .where('id', '=', requestId)
    .executeTakeFirst();

  return result ? rowToRequest(result as LockRequestRow) : null;
}
