/**
 * Document Collaborators Storage Layer
 * Manage document sharing and permissions.
 */

import { getDb, isDatabaseAvailable } from '../db/client.js';
import { getDefaultOrganizationId } from '../config/database.js';

export type Permission = 'view' | 'comment' | 'edit';

export interface Collaborator {
  id: string;
  documentId: string;
  organizationId: string;
  userEmail: string;
  permission: Permission;
  invitedBy: string | null;
  invitedAt: string;
  revokedAt: string | null;
}

// Row type returned from database
interface CollaboratorRow {
  id: string;
  document_id: string;
  organization_id: string;
  user_email: string;
  permission: string;
  invited_by: string | null;
  invited_at: string;
  revoked_at: string | null;
}

export interface AddCollaboratorInput {
  documentId: string;
  userEmail: string;
  permission?: Permission;
  invitedBy: string;
  organizationId?: string;
}

/**
 * Convert database row to Collaborator type
 */
function rowToCollaborator(row: CollaboratorRow): Collaborator {
  return {
    id: row.id,
    documentId: row.document_id,
    organizationId: row.organization_id,
    userEmail: row.user_email,
    permission: row.permission as Permission,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    revokedAt: row.revoked_at,
  };
}

/**
 * Add a collaborator to a document
 */
export async function addCollaborator(input: AddCollaboratorInput): Promise<Collaborator | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  const organizationId = input.organizationId || getDefaultOrganizationId();

  // Check if already exists (including revoked)
  const existing = await db
    .selectFrom('document_collaborators')
    .selectAll()
    .where('document_id', '=', input.documentId)
    .where('user_email', '=', input.userEmail.toLowerCase())
    .executeTakeFirst();

  if (existing) {
    // If revoked, reinstate with new permission
    if (existing.revoked_at) {
      const result = await db
        .updateTable('document_collaborators')
        .set({
          permission: input.permission || 'view',
          invited_by: input.invitedBy,
          invited_at: new Date().toISOString(),
          revoked_at: null,
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirst();

      return result ? rowToCollaborator(result as CollaboratorRow) : null;
    }
    // Already active collaborator
    return rowToCollaborator(existing as CollaboratorRow);
  }

  // Create new collaborator
  const result = await db
    .insertInto('document_collaborators')
    .values({
      document_id: input.documentId,
      organization_id: organizationId,
      user_email: input.userEmail.toLowerCase(),
      permission: input.permission || 'view',
      invited_by: input.invitedBy,
    })
    .returningAll()
    .executeTakeFirst();

  return result ? rowToCollaborator(result as CollaboratorRow) : null;
}

/**
 * Get a collaborator by document and email
 */
export async function getCollaborator(
  documentId: string,
  userEmail: string
): Promise<Collaborator | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .selectFrom('document_collaborators')
    .selectAll()
    .where('document_id', '=', documentId)
    .where('user_email', '=', userEmail.toLowerCase())
    .where('revoked_at', 'is', null)
    .executeTakeFirst();

  return result ? rowToCollaborator(result as CollaboratorRow) : null;
}

/**
 * List collaborators for a document
 */
export async function listCollaborators(
  documentId: string,
  includeRevoked = false
): Promise<Collaborator[]> {
  if (!isDatabaseAvailable()) return [];

  const db = getDb();

  let query = db
    .selectFrom('document_collaborators')
    .selectAll()
    .where('document_id', '=', documentId)
    .orderBy('invited_at', 'desc');

  if (!includeRevoked) {
    query = query.where('revoked_at', 'is', null);
  }

  const results = await query.execute();

  return results.map(row => rowToCollaborator(row as CollaboratorRow));
}

/**
 * Update collaborator permission
 */
export async function updateCollaboratorPermission(
  documentId: string,
  userEmail: string,
  permission: Permission
): Promise<Collaborator | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .updateTable('document_collaborators')
    .set({ permission })
    .where('document_id', '=', documentId)
    .where('user_email', '=', userEmail.toLowerCase())
    .where('revoked_at', 'is', null)
    .returningAll()
    .executeTakeFirst();

  return result ? rowToCollaborator(result as CollaboratorRow) : null;
}

/**
 * Remove (revoke) a collaborator
 */
export async function removeCollaborator(
  documentId: string,
  userEmail: string
): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const db = getDb();

  const result = await db
    .updateTable('document_collaborators')
    .set({ revoked_at: new Date().toISOString() })
    .where('document_id', '=', documentId)
    .where('user_email', '=', userEmail.toLowerCase())
    .where('revoked_at', 'is', null)
    .executeTakeFirst();

  return (result.numUpdatedRows ?? 0) > 0;
}

/**
 * Get documents shared with a user
 */
export async function getSharedDocuments(userEmail: string): Promise<string[]> {
  if (!isDatabaseAvailable()) return [];

  const db = getDb();

  const results = await db
    .selectFrom('document_collaborators')
    .select(['document_id'])
    .where('user_email', '=', userEmail.toLowerCase())
    .where('revoked_at', 'is', null)
    .execute();

  return results.map(r => r.document_id);
}

/**
 * Check if user has access to document (as collaborator)
 */
export async function hasAccess(
  documentId: string,
  userEmail: string
): Promise<{ hasAccess: boolean; permission?: Permission }> {
  const collaborator = await getCollaborator(documentId, userEmail);

  if (!collaborator) {
    return { hasAccess: false };
  }

  return {
    hasAccess: true,
    permission: collaborator.permission,
  };
}

/**
 * Check if user can edit (has 'edit' permission)
 */
export async function canEdit(documentId: string, userEmail: string): Promise<boolean> {
  const access = await hasAccess(documentId, userEmail);
  return access.hasAccess && access.permission === 'edit';
}

/**
 * Check if user can comment (has 'comment' or 'edit' permission)
 */
export async function canComment(documentId: string, userEmail: string): Promise<boolean> {
  const access = await hasAccess(documentId, userEmail);
  return access.hasAccess && (access.permission === 'comment' || access.permission === 'edit');
}
