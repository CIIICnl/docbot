/**
 * Collaboration API Routes
 * Handles collaborators, locks, and comments.
 */

import type { ApiContext } from './index.js';
import { ok, created, badRequest, notFound, forbidden, conflict, serverError, matchPath, json } from '../../utils/http.js';
import { isDatabaseAvailable } from '../../db/client.js';
import { canAccessDocument, getDocument } from '../../storage/documents.js';
import {
  addCollaborator,
  listCollaborators,
  updateCollaboratorPermission,
  removeCollaborator,
  getSharedDocuments,
  type Permission,
} from '../../storage/collaborators.js';
import {
  getLock,
  acquireLock,
  releaseLock,
  createLockRequest,
  getPendingRequests,
  respondToRequest,
  holdsLock,
} from '../../storage/document-locks.js';
import {
  createComment,
  updateComment,
  deleteComment,
  listComments,
  resolveComment,
  reopenComment,
} from '../../storage/comments.js';
import {
  notifyCollaboratorAdded,
  notifyCollaboratorRemoved,
  notifyDocumentLocked,
  notifyDocumentUnlocked,
  notifyLockRequested,
  notifyCommentCreated,
  notifyCommentResolved,
} from '../../services/document-events.js';

/**
 * Handle collaboration routes
 */
export async function handleCollaboration(ctx: ApiContext): Promise<boolean> {
  const { req, res, url, authedUser } = ctx;
  const path = url.pathname;

  if (!isDatabaseAvailable()) {
    if (path.includes('/collaborator') || path.includes('/lock') || path.includes('/comment')) {
      badRequest(res, 'Database not available');
      return true;
    }
    return false;
  }

  const userEmail = authedUser?.email;
  if (!userEmail) {
    if (path.includes('/collaborator') || path.includes('/lock') || path.includes('/comment')) {
      forbidden(res, 'Authentication required');
      return true;
    }
    return false;
  }

  try {
    // ========== Collaborator Routes ==========

    // GET /api/documents/shared-with-me - Get documents shared with user
    if (path === '/api/documents/shared-with-me' && req.method === 'GET') {
      const documentIds = await getSharedDocuments(userEmail);
      const documents = [];

      for (const docId of documentIds) {
        const doc = await getDocument(docId);
        if (doc && !doc.trashedAt) {
          documents.push(doc);
        }
      }

      ok(res, { documents });
      return true;
    }

    // POST /api/documents/:id/collaborators - Add collaborator
    const addCollabMatch = matchPath('/api/documents/:id/collaborators', path);
    if (addCollabMatch?.id && req.method === 'POST') {
      const docId = addCollabMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.isOwner) {
        forbidden(res, 'Only the document owner can add collaborators');
        return true;
      }

      const body = await json<{
        email: string;
        permission?: Permission;
      }>(req);

      if (!body.email) {
        badRequest(res, 'email is required');
        return true;
      }

      // Can't add yourself
      if (body.email.toLowerCase() === userEmail.toLowerCase()) {
        badRequest(res, 'Cannot add yourself as a collaborator');
        return true;
      }

      const collaborator = await addCollaborator({
        documentId: docId,
        userEmail: body.email,
        permission: body.permission,
        invitedBy: userEmail,
      });

      if (!collaborator) {
        serverError(res, new Error('Failed to add collaborator'));
        return true;
      }

      // Notify via SSE
      notifyCollaboratorAdded(docId, body.email.toLowerCase(), collaborator.permission);

      created(res, { collaborator });
      return true;
    }

    // GET /api/documents/:id/collaborators - List collaborators
    const listCollabMatch = matchPath('/api/documents/:id/collaborators', path);
    if (listCollabMatch?.id && req.method === 'GET') {
      const docId = listCollabMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const collaborators = await listCollaborators(docId);

      ok(res, { collaborators });
      return true;
    }

    // PATCH /api/documents/:id/collaborators/:email - Update permission
    const updateCollabMatch = matchPath('/api/documents/:id/collaborators/:email', path);
    if (updateCollabMatch?.id && updateCollabMatch?.email && req.method === 'PATCH') {
      const docId = updateCollabMatch.id;
      const email = decodeURIComponent(updateCollabMatch.email);

      const access = await canAccessDocument(docId, userEmail);
      if (!access.isOwner) {
        forbidden(res, 'Only the document owner can update permissions');
        return true;
      }

      const body = await json<{ permission: Permission }>(req);

      if (!body.permission || !['view', 'comment', 'edit'].includes(body.permission)) {
        badRequest(res, 'Valid permission is required (view, comment, edit)');
        return true;
      }

      const collaborator = await updateCollaboratorPermission(docId, email, body.permission);

      if (!collaborator) {
        notFound(res, 'Collaborator not found');
        return true;
      }

      ok(res, { collaborator });
      return true;
    }

    // DELETE /api/documents/:id/collaborators/:email - Remove collaborator
    const removeCollabMatch = matchPath('/api/documents/:id/collaborators/:email', path);
    if (removeCollabMatch?.id && removeCollabMatch?.email && req.method === 'DELETE') {
      const docId = removeCollabMatch.id;
      const email = decodeURIComponent(removeCollabMatch.email);

      const access = await canAccessDocument(docId, userEmail);
      if (!access.isOwner) {
        forbidden(res, 'Only the document owner can remove collaborators');
        return true;
      }

      const removed = await removeCollaborator(docId, email);

      if (!removed) {
        notFound(res, 'Collaborator not found');
        return true;
      }

      // Notify via SSE
      notifyCollaboratorRemoved(docId, email.toLowerCase());

      ok(res);
      return true;
    }

    // ========== Lock Routes ==========

    // GET /api/documents/:id/lock - Get current lock
    const getLockMatch = matchPath('/api/documents/:id/lock', path);
    if (getLockMatch?.id && req.method === 'GET') {
      const docId = getLockMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const lock = await getLock(docId);

      ok(res, { lock });
      return true;
    }

    // POST /api/documents/:id/lock - Acquire lock
    const acquireLockMatch = matchPath('/api/documents/:id/lock', path);
    if (acquireLockMatch?.id && req.method === 'POST') {
      const docId = acquireLockMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      // Only owner or edit permission can acquire lock
      if (!access.isOwner && access.permission !== 'edit') {
        forbidden(res, 'Edit permission required to acquire lock');
        return true;
      }

      const body = await json<{ name?: string; durationMs?: number }>(req);

      const lock = await acquireLock(
        docId,
        userEmail,
        body.name || authedUser?.name,
        body.durationMs
      );

      if (!lock) {
        // Locked by someone else
        conflict(res, 'Document is locked by another user');
        return true;
      }

      // Notify via SSE
      notifyDocumentLocked(docId, lock.holderEmail, lock.holderName, lock.expiresAt);

      ok(res, { lock });
      return true;
    }

    // DELETE /api/documents/:id/lock - Release lock
    const releaseLockMatch = matchPath('/api/documents/:id/lock', path);
    if (releaseLockMatch?.id && req.method === 'DELETE') {
      const docId = releaseLockMatch.id;

      const released = await releaseLock(docId, userEmail);

      if (!released) {
        badRequest(res, 'You do not hold the lock');
        return true;
      }

      // Notify via SSE
      notifyDocumentUnlocked(docId);

      ok(res);
      return true;
    }

    // POST /api/documents/:id/lock-requests - Request lock access
    const requestLockMatch = matchPath('/api/documents/:id/lock-requests', path);
    if (requestLockMatch?.id && req.method === 'POST') {
      const docId = requestLockMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const body = await json<{ message?: string }>(req);

      const request = await createLockRequest(docId, userEmail, body.message);

      if (!request) {
        serverError(res, new Error('Failed to create lock request'));
        return true;
      }

      // Notify lock holder via SSE
      notifyLockRequested(docId, userEmail, body.message || null);

      created(res, { request });
      return true;
    }

    // GET /api/documents/:id/lock-requests - Get pending requests
    const getPendingMatch = matchPath('/api/documents/:id/lock-requests', path);
    if (getPendingMatch?.id && req.method === 'GET') {
      const docId = getPendingMatch.id;

      // Only lock holder can see requests
      const holds = await holdsLock(docId, userEmail);
      if (!holds) {
        forbidden(res, 'Only the lock holder can view requests');
        return true;
      }

      const requests = await getPendingRequests(docId);

      ok(res, { requests });
      return true;
    }

    // POST /api/documents/:id/lock-requests/:requestId/respond - Respond to request
    const respondMatch = matchPath('/api/documents/:id/lock-requests/:requestId/respond', path);
    if (respondMatch?.id && respondMatch?.requestId && req.method === 'POST') {
      const docId = respondMatch.id;
      const requestId = respondMatch.requestId;

      // Only lock holder can respond
      const holds = await holdsLock(docId, userEmail);
      if (!holds) {
        forbidden(res, 'Only the lock holder can respond to requests');
        return true;
      }

      const body = await json<{ status: 'approved' | 'denied' }>(req);

      if (!body.status || !['approved', 'denied'].includes(body.status)) {
        badRequest(res, 'Valid status is required (approved, denied)');
        return true;
      }

      const request = await respondToRequest(requestId, body.status, userEmail);

      if (!request) {
        notFound(res, 'Request not found');
        return true;
      }

      // If approved, release lock so requester can acquire it
      if (body.status === 'approved') {
        await releaseLock(docId, userEmail);
        notifyDocumentUnlocked(docId);
      }

      ok(res, { request });
      return true;
    }

    // ========== Comment Routes ==========

    // GET /api/documents/:id/comments - List comments
    const listCommentsMatch = matchPath('/api/documents/:id/comments', path);
    if (listCommentsMatch?.id && req.method === 'GET') {
      const docId = listCommentsMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const includeResolved = url.searchParams.get('resolved') === 'true';
      const withReplies = url.searchParams.get('replies') !== 'false';

      const comments = await listComments(docId, { includeResolved, withReplies });

      ok(res, { comments });
      return true;
    }

    // POST /api/documents/:id/comments - Create comment
    const createCommentMatch = matchPath('/api/documents/:id/comments', path);
    if (createCommentMatch?.id && req.method === 'POST') {
      const docId = createCommentMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      // Need at least comment permission
      if (!access.isOwner && access.permission !== 'comment' && access.permission !== 'edit') {
        forbidden(res, 'Comment permission required');
        return true;
      }

      const body = await json<{
        body: string;
        parentId?: string;
        anchorText?: string;
        anchorStart?: number;
        anchorEnd?: number;
      }>(req);

      if (!body.body) {
        badRequest(res, 'body is required');
        return true;
      }

      const comment = await createComment({
        documentId: docId,
        parentId: body.parentId,
        authorEmail: userEmail,
        authorName: authedUser?.name,
        body: body.body,
        anchorText: body.anchorText,
        anchorStart: body.anchorStart,
        anchorEnd: body.anchorEnd,
      });

      if (!comment) {
        serverError(res, new Error('Failed to create comment'));
        return true;
      }

      // Notify via SSE
      notifyCommentCreated(docId, {
        id: comment.id,
        authorEmail: comment.authorEmail,
        body: comment.body,
        parentId: comment.parentId,
      });

      created(res, { comment });
      return true;
    }

    // PATCH /api/documents/:id/comments/:commentId - Update comment
    const updateCommentMatch = matchPath('/api/documents/:id/comments/:commentId', path);
    if (updateCommentMatch?.id && updateCommentMatch?.commentId && req.method === 'PATCH') {
      const docId = updateCommentMatch.id;
      const commentId = updateCommentMatch.commentId;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const body = await json<{ body: string }>(req);

      if (!body.body) {
        badRequest(res, 'body is required');
        return true;
      }

      const comment = await updateComment(commentId, userEmail, body.body);

      if (!comment) {
        notFound(res, 'Comment not found or not authorized');
        return true;
      }

      ok(res, { comment });
      return true;
    }

    // DELETE /api/documents/:id/comments/:commentId - Delete comment
    const deleteCommentMatch = matchPath('/api/documents/:id/comments/:commentId', path);
    if (deleteCommentMatch?.id && deleteCommentMatch?.commentId && req.method === 'DELETE') {
      const docId = deleteCommentMatch.id;
      const commentId = deleteCommentMatch.commentId;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const deleted = await deleteComment(commentId, userEmail);

      if (!deleted) {
        notFound(res, 'Comment not found or not authorized');
        return true;
      }

      ok(res);
      return true;
    }

    // POST /api/documents/:id/comments/:commentId/resolve - Resolve comment
    const resolveCommentMatch = matchPath('/api/documents/:id/comments/:commentId/resolve', path);
    if (resolveCommentMatch?.id && resolveCommentMatch?.commentId && req.method === 'POST') {
      const docId = resolveCommentMatch.id;
      const commentId = resolveCommentMatch.commentId;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const comment = await resolveComment(commentId, userEmail);

      if (!comment) {
        notFound(res, 'Comment not found');
        return true;
      }

      // Notify via SSE
      notifyCommentResolved(docId, commentId, userEmail);

      ok(res, { comment });
      return true;
    }

    // POST /api/documents/:id/comments/:commentId/reopen - Reopen comment
    const reopenCommentMatch = matchPath('/api/documents/:id/comments/:commentId/reopen', path);
    if (reopenCommentMatch?.id && reopenCommentMatch?.commentId && req.method === 'POST') {
      const docId = reopenCommentMatch.id;
      const commentId = reopenCommentMatch.commentId;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const comment = await reopenComment(commentId);

      if (!comment) {
        notFound(res, 'Comment not found');
        return true;
      }

      ok(res, { comment });
      return true;
    }

    return false;
  } catch (err) {
    serverError(res, err instanceof Error ? err : new Error(String(err)));
    return true;
  }
}
