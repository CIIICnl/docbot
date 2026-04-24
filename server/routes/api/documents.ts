/**
 * Documents API Routes
 * CRUD operations for document management.
 */

import type { ApiContext } from './index.js';
import { ok, created, badRequest, notFound, forbidden, serverError, matchPath, json } from '../../utils/http.js';
import { isDatabaseAvailable } from '../../db/client.js';
import {
  createDocument,
  getDocument,
  updateDocument,
  listDocuments,
  trashDocument,
  restoreDocument,
  deleteDocument,
  canAccessDocument,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from '../../storage/documents.js';
import {
  createVersion,
  listVersions,
  getVersion,
  updateVersionLabel,
  type VersionReason,
} from '../../storage/document-versions.js';
import { getDefaultOrganizationId } from '../../config/database.js';

/**
 * Handle document routes
 */
export async function handleDocuments(ctx: ApiContext): Promise<boolean> {
  const { req, res, url, authedUser } = ctx;
  const path = url.pathname;

  // All document routes require database
  if (!isDatabaseAvailable()) {
    badRequest(res, 'Database not available');
    return true;
  }

  const userEmail = authedUser?.email;
  if (!userEmail) {
    forbidden(res, 'Authentication required');
    return true;
  }

  try {
    // GET /api/documents - List user's documents
    if (path === '/api/documents' && req.method === 'GET') {
      const includeTrashed = url.searchParams.get('trashed') === 'true';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const documents = await listDocuments({
        ownerEmail: userEmail,
        includeTrashed,
        limit,
        offset,
      });

      ok(res, { documents });
      return true;
    }

    // POST /api/documents - Create document
    if (path === '/api/documents' && req.method === 'POST') {
      const body = await json<Partial<CreateDocumentInput>>(req);

      if (!body.title) {
        badRequest(res, 'Title is required');
        return true;
      }

      const doc = await createDocument({
        title: body.title,
        content: body.content || '',
        settings: body.settings,
        aiChanges: body.aiChanges,
        ownerEmail: userEmail,
        organizationId: getDefaultOrganizationId(),
      });

      if (!doc) {
        serverError(res, new Error('Failed to create document'));
        return true;
      }

      // Create initial version
      await createVersion({
        documentId: doc.id,
        createdBy: userEmail,
        reason: 'manual',
        label: 'Initial version',
        title: doc.title,
        content: doc.content,
        settings: doc.settings,
        organizationId: doc.organizationId,
      });

      created(res, { document: doc });
      return true;
    }

    // POST /api/documents/import-local - Import from localStorage
    if (path === '/api/documents/import-local' && req.method === 'POST') {
      const body = await json<{ drafts: Array<{
        id: string;
        title: string;
        content: string;
        settings?: Record<string, unknown>;
        aiChanges?: Record<string, unknown>;
        createdAt?: string;
        modifiedAt?: string;
      }> }>(req);

      if (!body.drafts || !Array.isArray(body.drafts)) {
        badRequest(res, 'drafts array is required');
        return true;
      }

      const imported: Array<{ localId: string; id: string; title: string }> = [];
      const failed: Array<{ localId: string; error: string }> = [];

      for (const draft of body.drafts) {
        try {
          const doc = await createDocument({
            title: draft.title || 'Untitled',
            content: draft.content || '',
            settings: draft.settings as CreateDocumentInput['settings'],
            aiChanges: draft.aiChanges,
            ownerEmail: userEmail,
            organizationId: getDefaultOrganizationId(),
          });

          if (doc) {
            // Create initial version
            await createVersion({
              documentId: doc.id,
              createdBy: userEmail,
              reason: 'import',
              label: 'Imported from local storage',
              title: doc.title,
              content: doc.content,
              settings: doc.settings,
              organizationId: doc.organizationId,
            });

            imported.push({
              localId: draft.id,
              id: doc.id,
              title: doc.title,
            });
          } else {
            failed.push({ localId: draft.id, error: 'Failed to create document' });
          }
        } catch (err) {
          failed.push({
            localId: draft.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      ok(res, { imported, failed });
      return true;
    }

    // GET /api/documents/:id - Get document
    const getMatch = matchPath('/api/documents/:id', path);
    if (getMatch?.id && req.method === 'GET') {
      const docId = getMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const doc = await getDocument(docId);
      if (!doc) {
        notFound(res, 'Document not found');
        return true;
      }

      ok(res, { document: doc, permission: access.permission });
      return true;
    }

    // PATCH /api/documents/:id - Update document
    const patchMatch = matchPath('/api/documents/:id', path);
    if (patchMatch?.id && req.method === 'PATCH') {
      const docId = patchMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess || !access.isOwner) {
        notFound(res, 'Document not found');
        return true;
      }

      const body = await json<UpdateDocumentInput & { createVersion?: boolean; versionReason?: VersionReason }>(req);

      const doc = await updateDocument(docId, userEmail, {
        title: body.title,
        content: body.content,
        settings: body.settings,
        aiChanges: body.aiChanges,
      });

      if (!doc) {
        notFound(res, 'Document not found');
        return true;
      }

      // Optionally create a version
      if (body.createVersion) {
        await createVersion({
          documentId: doc.id,
          createdBy: userEmail,
          reason: body.versionReason || 'autosave',
          title: doc.title,
          content: doc.content,
          settings: doc.settings,
          organizationId: doc.organizationId,
        });
      }

      ok(res, { document: doc });
      return true;
    }

    // DELETE /api/documents/:id - Trash document
    const deleteMatch = matchPath('/api/documents/:id', path);
    if (deleteMatch?.id && req.method === 'DELETE') {
      const docId = deleteMatch.id;
      const permanent = url.searchParams.get('permanent') === 'true';

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess || !access.isOwner) {
        notFound(res, 'Document not found');
        return true;
      }

      if (permanent) {
        // Permanent delete
        const deleted = await deleteDocument(docId, userEmail);
        if (!deleted) {
          notFound(res, 'Document not found');
          return true;
        }
      } else {
        // Soft delete (trash)
        const trashed = await trashDocument(docId, userEmail);
        if (!trashed) {
          notFound(res, 'Document not found');
          return true;
        }
      }

      ok(res);
      return true;
    }

    // POST /api/documents/:id/restore - Restore from trash
    const restoreMatch = matchPath('/api/documents/:id/restore', path);
    if (restoreMatch?.id && req.method === 'POST') {
      const docId = restoreMatch.id;

      // Check ownership (need to check trashed documents too)
      const doc = await getDocument(docId);
      if (!doc || doc.ownerEmail !== userEmail) {
        notFound(res, 'Document not found');
        return true;
      }

      const restored = await restoreDocument(docId, userEmail);
      if (!restored) {
        badRequest(res, 'Document is not in trash');
        return true;
      }

      ok(res, { document: restored });
      return true;
    }

    // GET /api/documents/:id/versions - List versions
    const versionsMatch = matchPath('/api/documents/:id/versions', path);
    if (versionsMatch?.id && req.method === 'GET') {
      const docId = versionsMatch.id;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const versions = await listVersions({ documentId: docId, limit, offset });

      ok(res, { versions });
      return true;
    }

    // GET /api/documents/:id/versions/:versionId - Get specific version
    const versionMatch = matchPath('/api/documents/:id/versions/:versionId', path);
    if (versionMatch?.id && versionMatch?.versionId && req.method === 'GET') {
      const docId = versionMatch.id;
      const versionId = versionMatch.versionId;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess) {
        notFound(res, 'Document not found');
        return true;
      }

      const version = await getVersion(versionId);
      if (!version || version.documentId !== docId) {
        notFound(res, 'Version not found');
        return true;
      }

      ok(res, { version });
      return true;
    }

    // PATCH /api/documents/:id/versions/:versionId - Update version label
    const versionPatchMatch = matchPath('/api/documents/:id/versions/:versionId', path);
    if (versionPatchMatch?.id && versionPatchMatch?.versionId && req.method === 'PATCH') {
      const docId = versionPatchMatch.id;
      const versionId = versionPatchMatch.versionId;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess || !access.isOwner) {
        notFound(res, 'Document not found');
        return true;
      }

      const body = await json<{ label?: string | null }>(req);

      const version = await updateVersionLabel(versionId, body.label ?? null);
      if (!version || version.documentId !== docId) {
        notFound(res, 'Version not found');
        return true;
      }

      ok(res, { version });
      return true;
    }

    // POST /api/documents/:id/versions/:versionId/restore - Restore from version
    const restoreVersionMatch = matchPath('/api/documents/:id/versions/:versionId/restore', path);
    if (restoreVersionMatch?.id && restoreVersionMatch?.versionId && req.method === 'POST') {
      const docId = restoreVersionMatch.id;
      const versionId = restoreVersionMatch.versionId;

      const access = await canAccessDocument(docId, userEmail);
      if (!access.canAccess || !access.isOwner) {
        notFound(res, 'Document not found');
        return true;
      }

      const version = await getVersion(versionId);
      if (!version || version.documentId !== docId) {
        notFound(res, 'Version not found');
        return true;
      }

      // Update document with version content
      const doc = await updateDocument(docId, userEmail, {
        title: version.title || undefined,
        content: version.content,
        settings: version.settings || undefined,
      });

      if (!doc) {
        serverError(res, new Error('Failed to restore version'));
        return true;
      }

      // Create a new version to record the restore
      await createVersion({
        documentId: doc.id,
        createdBy: userEmail,
        reason: 'restore',
        label: `Restored from revision ${version.revision || 'unknown'}`,
        title: doc.title,
        content: doc.content,
        settings: doc.settings,
        organizationId: doc.organizationId,
      });

      ok(res, { document: doc });
      return true;
    }

    return false;
  } catch (err) {
    serverError(res, err instanceof Error ? err : new Error(String(err)));
    return true;
  }
}
