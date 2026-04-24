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
import { notFound, unauthorized } from '../../utils/http.js';
import { authEnabled, getUserFromRequestAsync, type User } from '../../auth/auth.js';

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

  // Check authentication for all other routes
  const authedUser = await getUserFromRequestAsync(ctx.req);
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

  // No handler matched
  notFound(ctx.res);
}
