/**
 * Document Storage Layer
 * CRUD operations for documents using PostgreSQL.
 */

import { getDb, isDatabaseAvailable, type DocumentSettings } from '../db/client.js';
import { getDefaultOrganizationId } from '../config/database.js';

export interface Document {
  id: string;
  organizationId: string;
  userId: string | null;
  ownerEmail: string;
  title: string;
  content: string;
  settings: DocumentSettings;
  aiChanges: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
  trashedBy: string | null;
}

// Row type returned from database (all Generated<T> become T)
interface DocumentRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  owner_email: string;
  title: string;
  content: string;
  settings: DocumentSettings;
  ai_changes: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  trashed_at: string | null;
  trashed_by: string | null;
}

export interface CreateDocumentInput {
  title: string;
  content?: string;
  settings?: Partial<DocumentSettings>;
  aiChanges?: Record<string, unknown> | null;
  ownerEmail: string;
  userId?: string | null;
  organizationId?: string;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  settings?: Partial<DocumentSettings>;
  aiChanges?: Record<string, unknown> | null;
}

export interface ListDocumentsOptions {
  ownerEmail: string;
  organizationId?: string;
  includeTrashed?: boolean;
  limit?: number;
  offset?: number;
}

const DEFAULT_SETTINGS: DocumentSettings = {
  themeId: 'default',
  generateToc: true,
  pageNumbers: true,
  coverPage: true,
};

/**
 * Convert database row to Document type
 */
function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    ownerEmail: row.owner_email,
    title: row.title,
    content: row.content,
    settings: row.settings || DEFAULT_SETTINGS,
    aiChanges: row.ai_changes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trashedAt: row.trashed_at,
    trashedBy: row.trashed_by,
  };
}

/**
 * Create a new document
 */
export async function createDocument(input: CreateDocumentInput): Promise<Document | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  const organizationId = input.organizationId || getDefaultOrganizationId();

  const settings: DocumentSettings = {
    ...DEFAULT_SETTINGS,
    ...input.settings,
  };

  const result = await db
    .insertInto('documents')
    .values({
      organization_id: organizationId,
      user_id: input.userId || null,
      owner_email: input.ownerEmail,
      title: input.title,
      content: input.content || '',
      settings: JSON.stringify(settings) as unknown as DocumentSettings,
      ai_changes: input.aiChanges ? (JSON.stringify(input.aiChanges) as unknown as Record<string, unknown>) : null,
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) return null;

  return rowToDocument(result as DocumentRow);
}

/**
 * Get a document by ID
 */
export async function getDocument(id: string, ownerEmail?: string): Promise<Document | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  let query = db
    .selectFrom('documents')
    .selectAll()
    .where('id', '=', id);

  // If ownerEmail is provided, verify ownership
  if (ownerEmail) {
    query = query.where('owner_email', '=', ownerEmail);
  }

  const result = await query.executeTakeFirst();

  if (!result) return null;

  return rowToDocument(result as DocumentRow);
}

/**
 * Update a document
 */
export async function updateDocument(
  id: string,
  ownerEmail: string,
  input: UpdateDocumentInput
): Promise<Document | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  // Build update values
  const updateValues: Record<string, unknown> = {};

  if (input.title !== undefined) {
    updateValues.title = input.title;
  }

  if (input.content !== undefined) {
    updateValues.content = input.content;
  }

  if (input.settings !== undefined) {
    // Merge settings with existing
    const existing = await getDocument(id, ownerEmail);
    if (!existing) return null;

    const mergedSettings: DocumentSettings = {
      ...existing.settings,
      ...input.settings,
    };
    updateValues.settings = JSON.stringify(mergedSettings);
  }

  if ('aiChanges' in input) {
    updateValues.ai_changes = input.aiChanges ? JSON.stringify(input.aiChanges) : null;
  }

  if (Object.keys(updateValues).length === 0) {
    // No updates, just return existing
    return getDocument(id, ownerEmail);
  }

  const result = await db
    .updateTable('documents')
    .set(updateValues)
    .where('id', '=', id)
    .where('owner_email', '=', ownerEmail)
    .where('trashed_at', 'is', null)
    .returningAll()
    .executeTakeFirst();

  if (!result) return null;

  return rowToDocument(result as DocumentRow);
}

/**
 * List documents for a user
 */
export async function listDocuments(options: ListDocumentsOptions): Promise<Document[]> {
  if (!isDatabaseAvailable()) return [];

  const db = getDb();
  const { ownerEmail, includeTrashed = false, limit = 100, offset = 0 } = options;

  let query = db
    .selectFrom('documents')
    .selectAll()
    .where('owner_email', '=', ownerEmail)
    .orderBy('updated_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (!includeTrashed) {
    query = query.where('trashed_at', 'is', null);
  }

  const results = await query.execute();

  return results.map(row => rowToDocument(row as DocumentRow));
}

/**
 * Trash a document (soft delete)
 */
export async function trashDocument(id: string, ownerEmail: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const db = getDb();

  const result = await db
    .updateTable('documents')
    .set({
      trashed_at: new Date().toISOString(),
      trashed_by: ownerEmail,
    })
    .where('id', '=', id)
    .where('owner_email', '=', ownerEmail)
    .where('trashed_at', 'is', null)
    .executeTakeFirst();

  return (result.numUpdatedRows ?? 0) > 0;
}

/**
 * Restore a document from trash
 */
export async function restoreDocument(id: string, ownerEmail: string): Promise<Document | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .updateTable('documents')
    .set({
      trashed_at: null,
      trashed_by: null,
    })
    .where('id', '=', id)
    .where('owner_email', '=', ownerEmail)
    .where('trashed_at', 'is not', null)
    .returningAll()
    .executeTakeFirst();

  if (!result) return null;

  return rowToDocument(result as DocumentRow);
}

/**
 * Permanently delete a document
 */
export async function deleteDocument(id: string, ownerEmail: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const db = getDb();

  const result = await db
    .deleteFrom('documents')
    .where('id', '=', id)
    .where('owner_email', '=', ownerEmail)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0) > 0;
}

/**
 * Check if user can access document (owner or collaborator)
 */
export async function canAccessDocument(
  id: string,
  userEmail: string
): Promise<{ canAccess: boolean; isOwner: boolean; permission?: string }> {
  if (!isDatabaseAvailable()) return { canAccess: false, isOwner: false };

  const db = getDb();

  // Check ownership
  const doc = await db
    .selectFrom('documents')
    .select(['owner_email'])
    .where('id', '=', id)
    .executeTakeFirst();

  if (!doc) {
    return { canAccess: false, isOwner: false };
  }

  if (doc.owner_email === userEmail) {
    return { canAccess: true, isOwner: true, permission: 'owner' };
  }

  // Check collaborator access
  const collaborator = await db
    .selectFrom('document_collaborators')
    .select(['permission'])
    .where('document_id', '=', id)
    .where('user_email', '=', userEmail.toLowerCase())
    .where('revoked_at', 'is', null)
    .executeTakeFirst();

  if (collaborator) {
    return { canAccess: true, isOwner: false, permission: collaborator.permission };
  }

  return { canAccess: false, isOwner: false };
}

/**
 * Get document count for a user
 */
export async function getDocumentCount(ownerEmail: string, includeTrashed = false): Promise<number> {
  if (!isDatabaseAvailable()) return 0;

  const db = getDb();

  let query = db
    .selectFrom('documents')
    .select(db.fn.count<number>('id').as('count'))
    .where('owner_email', '=', ownerEmail);

  if (!includeTrashed) {
    query = query.where('trashed_at', 'is', null);
  }

  const result = await query.executeTakeFirst();

  return Number(result?.count ?? 0);
}
