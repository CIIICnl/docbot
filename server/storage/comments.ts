/**
 * Document Comments Storage Layer
 * Inline comments and discussions.
 */

import { getDb, isDatabaseAvailable } from '../db/client.js';
import { getDefaultOrganizationId } from '../config/database.js';

export type CommentStatus = 'open' | 'resolved';

export interface Comment {
  id: string;
  documentId: string;
  parentId: string | null;
  organizationId: string;
  authorEmail: string;
  authorName: string | null;
  body: string;
  anchorText: string | null;
  anchorStart: number | null;
  anchorEnd: number | null;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated when fetching with replies
  replies?: Comment[];
}

// Row type
interface CommentRow {
  id: string;
  document_id: string;
  parent_id: string | null;
  organization_id: string;
  author_email: string;
  author_name: string | null;
  body: string;
  anchor_text: string | null;
  anchor_start: number | null;
  anchor_end: number | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentInput {
  documentId: string;
  parentId?: string | null;
  authorEmail: string;
  authorName?: string;
  body: string;
  anchorText?: string;
  anchorStart?: number;
  anchorEnd?: number;
  organizationId?: string;
}

function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    documentId: row.document_id,
    parentId: row.parent_id,
    organizationId: row.organization_id,
    authorEmail: row.author_email,
    authorName: row.author_name,
    body: row.body,
    anchorText: row.anchor_text,
    anchorStart: row.anchor_start,
    anchorEnd: row.anchor_end,
    status: row.status as CommentStatus,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new comment
 */
export async function createComment(input: CreateCommentInput): Promise<Comment | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();
  const organizationId = input.organizationId || getDefaultOrganizationId();

  const result = await db
    .insertInto('document_comments')
    .values({
      document_id: input.documentId,
      parent_id: input.parentId || null,
      organization_id: organizationId,
      author_email: input.authorEmail,
      author_name: input.authorName || null,
      body: input.body,
      anchor_text: input.anchorText || null,
      anchor_start: input.anchorStart ?? null,
      anchor_end: input.anchorEnd ?? null,
    })
    .returningAll()
    .executeTakeFirst();

  return result ? rowToComment(result as CommentRow) : null;
}

/**
 * Get a comment by ID
 */
export async function getComment(id: string): Promise<Comment | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .selectFrom('document_comments')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  return result ? rowToComment(result as CommentRow) : null;
}

/**
 * Update a comment's body
 */
export async function updateComment(
  id: string,
  authorEmail: string,
  body: string
): Promise<Comment | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .updateTable('document_comments')
    .set({ body })
    .where('id', '=', id)
    .where('author_email', '=', authorEmail)
    .returningAll()
    .executeTakeFirst();

  return result ? rowToComment(result as CommentRow) : null;
}

/**
 * Delete a comment (only author can delete)
 */
export async function deleteComment(id: string, authorEmail: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const db = getDb();

  const result = await db
    .deleteFrom('document_comments')
    .where('id', '=', id)
    .where('author_email', '=', authorEmail)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0) > 0;
}

/**
 * List comments for a document (top-level only)
 */
export async function listComments(
  documentId: string,
  options: { includeResolved?: boolean; withReplies?: boolean } = {}
): Promise<Comment[]> {
  if (!isDatabaseAvailable()) return [];

  const db = getDb();

  let query = db
    .selectFrom('document_comments')
    .selectAll()
    .where('document_id', '=', documentId)
    .where('parent_id', 'is', null)
    .orderBy('created_at', 'asc');

  if (!options.includeResolved) {
    query = query.where('status', '=', 'open');
  }

  const results = await query.execute();
  const comments = results.map(row => rowToComment(row as CommentRow));

  // Fetch replies if requested
  if (options.withReplies && comments.length > 0) {
    const commentIds = comments.map(c => c.id);

    const replies = await db
      .selectFrom('document_comments')
      .selectAll()
      .where('parent_id', 'in', commentIds)
      .orderBy('created_at', 'asc')
      .execute();

    // Group replies by parent
    const repliesByParent = new Map<string, Comment[]>();
    for (const row of replies) {
      const reply = rowToComment(row as CommentRow);
      const parentId = reply.parentId!;
      if (!repliesByParent.has(parentId)) {
        repliesByParent.set(parentId, []);
      }
      repliesByParent.get(parentId)!.push(reply);
    }

    // Attach replies to comments
    for (const comment of comments) {
      comment.replies = repliesByParent.get(comment.id) || [];
    }
  }

  return comments;
}

/**
 * Get replies to a comment
 */
export async function getReplies(parentId: string): Promise<Comment[]> {
  if (!isDatabaseAvailable()) return [];

  const db = getDb();

  const results = await db
    .selectFrom('document_comments')
    .selectAll()
    .where('parent_id', '=', parentId)
    .orderBy('created_at', 'asc')
    .execute();

  return results.map(row => rowToComment(row as CommentRow));
}

/**
 * Resolve a comment thread
 */
export async function resolveComment(id: string, resolvedBy: string): Promise<Comment | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .updateTable('document_comments')
    .set({
      status: 'resolved',
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .where('parent_id', 'is', null) // Only resolve top-level comments
    .returningAll()
    .executeTakeFirst();

  return result ? rowToComment(result as CommentRow) : null;
}

/**
 * Reopen a resolved comment
 */
export async function reopenComment(id: string): Promise<Comment | null> {
  if (!isDatabaseAvailable()) return null;

  const db = getDb();

  const result = await db
    .updateTable('document_comments')
    .set({
      status: 'open',
      resolved_by: null,
      resolved_at: null,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return result ? rowToComment(result as CommentRow) : null;
}

/**
 * Get comment count for a document
 */
export async function getCommentCount(
  documentId: string,
  includeResolved = false
): Promise<number> {
  if (!isDatabaseAvailable()) return 0;

  const db = getDb();

  let query = db
    .selectFrom('document_comments')
    .select(db.fn.count<number>('id').as('count'))
    .where('document_id', '=', documentId)
    .where('parent_id', 'is', null);

  if (!includeResolved) {
    query = query.where('status', '=', 'open');
  }

  const result = await query.executeTakeFirst();

  return Number(result?.count ?? 0);
}

/**
 * Get open comment count for multiple documents
 */
export async function getOpenCommentCounts(
  documentIds: string[]
): Promise<Map<string, number>> {
  if (!isDatabaseAvailable() || documentIds.length === 0) {
    return new Map();
  }

  const db = getDb();

  const results = await db
    .selectFrom('document_comments')
    .select(['document_id', db.fn.count<number>('id').as('count')])
    .where('document_id', 'in', documentIds)
    .where('parent_id', 'is', null)
    .where('status', '=', 'open')
    .groupBy('document_id')
    .execute();

  const counts = new Map<string, number>();
  for (const row of results) {
    counts.set(row.document_id, Number(row.count));
  }

  return counts;
}
