/**
 * API Router
 * Main entry point for all API requests.
 * Uses handler chain pattern.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAuth } from './auth.js';
import { handlePasswordReset } from './password-reset.js';
import { handleMagicLink } from './magic-link.js';
import { handleConvert } from './convert.js';
import { handleThemes } from './themes.js';
import { handleNotion } from './notion.js';
import { handleDocx } from './docx.js';
import { handleDocuments } from './documents.js';
import { handleMedia } from './media.js';
import { handleCollaboration } from './collaboration.js';
import { handleEvents } from './events.js';
import { notFound, unauthorized } from '../../utils/http.js';
import { authEnabled, getUserFromRequestAsync, type User } from '../../auth/auth.js';
import { normalizeEmail } from '../../storage/password-utils.js';

export interface ApiContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  authedUser?: User | null;
}

/**
 * Main API handler
 * Routes requests to appropriate handlers.
 */
export async function handleApi(ctx: ApiContext): Promise<void> {
  // Auth routes (must be accessible without auth)
  if (await handleAuth(ctx)) return;

  // Password reset routes (must be accessible without auth)
  if (await handlePasswordReset(ctx)) return;

  // Magic link routes (must be accessible without auth)
  if (await handleMagicLink(ctx)) return;

  // Service-to-service token for trusted internal callers (e.g. dashboard.ciiic.nl
  // generating PDFs, ciiicbot saving conversation outputs). Accepted on:
  //  - /api/convert*           — stateless render, no on-behalf-of needed
  //  - POST /api/documents      — create a doc on behalf of an existing user
  //                               (requires X-On-Behalf-Of: <email>)
  // Other routes still require a real user session.
  const internalToken = String(process.env.DOCBOT_INTERNAL_TOKEN || '').trim();
  const authHeader = String(ctx.req.headers['authorization'] || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const isConvertPath = ctx.url.pathname.startsWith('/api/convert');
  const isDocumentsCreate =
    ctx.url.pathname === '/api/documents' && ctx.req.method === 'POST';
  const tokenMatches = !!(internalToken && bearer && bearer === internalToken);

  let authedUser: User | null;
  if (tokenMatches && isConvertPath) {
    authedUser = {
      email: 'internal-service',
      role: 'admin',
      name: 'Internal Service',
      isAdmin: true,
    };
  } else if (tokenMatches && isDocumentsCreate) {
    // Trust the X-On-Behalf-Of email: the calling service (ciiicbot)
    // has already verified the user via the shared sb_session cookie
    // before delegating to us. We don't require a row in our `users`
    // table — SSO users are recognized at runtime without a DB record,
    // matching how cookie-authed createDocument calls already work.
    const onBehalfHeader = String(ctx.req.headers['x-on-behalf-of'] || '').trim();
    const onBehalfEmail = normalizeEmail(onBehalfHeader);
    if (!onBehalfEmail) {
      unauthorized(ctx.res, 'X-On-Behalf-Of header is required for /api/documents');
      return;
    }
    authedUser = {
      email: onBehalfEmail,
      role: 'user',
      name: onBehalfEmail,
      isAdmin: false,
    };
  } else {
    authedUser = await getUserFromRequestAsync(ctx.req);
  }
  if (authEnabled() && !authedUser) {
    unauthorized(ctx.res);
    return;
  }

  // Add user to context
  const authedCtx = { ...ctx, authedUser };

  // Conversion routes (main functionality)
  if (await handleConvert(authedCtx)) return;

  // Theme routes
  if (await handleThemes(authedCtx)) return;

  // Notion routes
  if (await handleNotion(authedCtx)) return;

  // DOCX and LLM routes
  if (await handleDocx(authedCtx)) return;

  // Document management routes
  if (await handleDocuments(authedCtx)) return;

  // Media routes
  if (await handleMedia(authedCtx)) return;

  // Collaboration routes (collaborators, locks, comments)
  if (await handleCollaboration(authedCtx)) return;

  // SSE events routes
  if (await handleEvents(authedCtx)) return;

  // No handler matched
  notFound(ctx.res);
}
