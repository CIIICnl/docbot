/**
 * SSE Events API Routes
 * Server-Sent Events endpoint for real-time document updates.
 */

import type { ApiContext } from './index.js';
import { notFound, forbidden, badRequest, matchPath } from '../../utils/http.js';
import { isDatabaseAvailable } from '../../db/client.js';
import { canAccessDocument } from '../../storage/documents.js';
import { addConnection } from '../../services/document-events.js';

/**
 * Handle SSE event routes
 */
export async function handleEvents(ctx: ApiContext): Promise<boolean> {
  const { req, res, url, authedUser } = ctx;
  const path = url.pathname;

  // GET /api/documents/:id/events - SSE endpoint
  const eventsMatch = matchPath('/api/documents/:id/events', path);
  if (eventsMatch?.id && req.method === 'GET') {
    const docId = eventsMatch.id;

    if (!isDatabaseAvailable()) {
      badRequest(res, 'Database not available');
      return true;
    }

    const userEmail = authedUser?.email;
    if (!userEmail) {
      forbidden(res, 'Authentication required');
      return true;
    }

    // Check access
    const access = await canAccessDocument(docId, userEmail);
    if (!access.canAccess) {
      notFound(res, 'Document not found');
      return true;
    }

    // Set up SSE connection
    const cleanup = addConnection(docId, userEmail, res);

    // Handle client disconnect
    req.on('close', () => {
      cleanup();
    });

    req.on('error', () => {
      cleanup();
    });

    // Keep connection open (return true to indicate we handled it)
    return true;
  }

  return false;
}
