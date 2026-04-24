/**
 * Document Versions Storage Layer
 * Version history management for documents.
 */

import { getDb, isDatabaseAvailable, type DocumentSettings } from '../db/client.js';
import { getDefaultOrganizationId } from '../config/database.js';

export type VersionReason = 'autosave' | 'manual' | 'restore' | 'import' | 'ai_enhance';

export interface DocumentVersion {
  id: string;
  documentId: string;
  organizationId: string;
  createdBy: string | null;
  reason: VersionReason;
  label: string | null;
  revision: number | null;
  title: string | null;
  content: string;
  settings: DocumentSettings | null;
  createdAt: string;
}

// Row type returned from database (all Generated<T> become T)
interface DocumentVersionRow {
  id: string;
  document_id: string;
  organization_id: string;
  created_by: string | null;
  reason: string;
  label: string | null;
  revision: number | null;
  title: string | null;
  content: string;
  settings: DocumentSettings | null;
  created_at: string;
}

export interface CreateVersionInput {
  documentId: string;
  createdBy?: string | null;
  reason?: VersionReason;
  label?: string | null;
  title?: string;
  content: string;
  settings?: DocumentSettings | null;
  organizationId?: string;
}

export interface ListVersionsOptions {
  documentId: string;
  limit?: number;
  offset?: number;
}

/**
 * Convert database row to DocumentVersion type
 */
function rowToVersion(row: DocumentVersionRow): DocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    reason: row.reason as VersionReason,
    label: row.label,
    revision: row.revision,
    title: row.title,
    content: row.content,
    settings: row.settings,
    createdAt: row.created_at,
  };
}

/**
 * Get the next revision number for a document
 */
async function getNextRevision(documentId: string): Promise<number> {
  if (!isDatabaseAvailable()) return 1;

  const db = getDb();

  const result = await db
    .selectFrom('document_versions')
    .select(db.fn.max('revision').as('max_revision'))
    .where('document_id', '=', documentId)
    .executeTakeFirst();

  return (Number(result?.max_revision) || 0) + 1;
}

/**
 * Create a new version of a document
 */
export async function createVersion(input: CreateVersionInput): Promise<DocumentVersion | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  const organizationId = input.organizationId || getDefaultOrganizationId();
  const revision = await getNextRevision(input.documentId);

  const result = await db
    .insertInto('document_versions')
    .values({
      document_id: input.documentId,
      organization_id: organizationId,
      created_by: input.createdBy || null,
      reason: input.reason || 'autosave',
      label: input.label || null,
      revision,
      title: input.title || null,
      content: input.content,
      settings: input.settings ? (JSON.stringify(input.settings) as unknown as DocumentSettings) : null,
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) return null;

  return rowToVersion(result as DocumentVersionRow);
}

/**
 * Get a specific version by ID
 */
export async function getVersion(id: string): Promise<DocumentVersion | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .selectFrom('document_versions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  if (!result) return null;

  return rowToVersion(result as DocumentVersionRow);
}

/**
 * List versions for a document
 */
export async function listVersions(options: ListVersionsOptions): Promise<DocumentVersion[]> {
  if (!isDatabaseAvailable()) return [];

  const db = getDb();
  const { documentId, limit = 50, offset = 0 } = options;

  const results = await db
    .selectFrom('document_versions')
    .selectAll()
    .where('document_id', '=', documentId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  return results.map(row => rowToVersion(row as DocumentVersionRow));
}

/**
 * Get the latest version of a document
 */
export async function getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .selectFrom('document_versions')
    .selectAll()
    .where('document_id', '=', documentId)
    .orderBy('created_at', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (!result) return null;

  return rowToVersion(result as DocumentVersionRow);
}

/**
 * Delete old versions, keeping the most recent N versions
 */
export async function pruneVersions(documentId: string, keepCount: number = 50): Promise<number> {
  if (!isDatabaseAvailable()) return 0;

  const db = getDb();

  // Get IDs to keep
  const keepVersions = await db
    .selectFrom('document_versions')
    .select(['id'])
    .where('document_id', '=', documentId)
    .orderBy('created_at', 'desc')
    .limit(keepCount)
    .execute();

  const keepIds = keepVersions.map(v => v.id);

  if (keepIds.length === 0) return 0;

  // Delete versions not in the keep list
  const result = await db
    .deleteFrom('document_versions')
    .where('document_id', '=', documentId)
    .where('id', 'not in', keepIds)
    .executeTakeFirst();

  return Number(result.numDeletedRows ?? 0);
}

/**
 * Update version label
 */
export async function updateVersionLabel(id: string, label: string | null): Promise<DocumentVersion | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .updateTable('document_versions')
    .set({ label })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!result) return null;

  return rowToVersion(result as DocumentVersionRow);
}

/**
 * Get version count for a document
 */
export async function getVersionCount(documentId: string): Promise<number> {
  if (!isDatabaseAvailable()) return 0;

  const db = getDb();

  const result = await db
    .selectFrom('document_versions')
    .select(db.fn.count<number>('id').as('count'))
    .where('document_id', '=', documentId)
    .executeTakeFirst();

  return Number(result?.count ?? 0);
}

/**
 * Delete all versions for a document (called when document is deleted)
 */
export async function deleteAllVersions(documentId: string): Promise<number> {
  if (!isDatabaseAvailable()) return 0;

  const db = getDb();

  const result = await db
    .deleteFrom('document_versions')
    .where('document_id', '=', documentId)
    .executeTakeFirst();

  return Number(result.numDeletedRows ?? 0);
}
