/**
 * API routes for magic link (passwordless login) functionality.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { authEnabled, setSessionCookie } from '../../auth/auth.js';
import { json, ok, badRequest } from '../../utils/http.js';
import { getClientIp, createRouteContext } from '../../utils/context.js';
import { sendMagicLinkEmail } from '../../integrations/brevo.js';
import { validateEmail } from '../../utils/secure-tokens.js';
import { normalizeEmail } from '../../utils/normalize.js';
import {
  createMagicToken,
  consumeMagicToken,
  isRateLimitedByEmail,
  isRateLimitedByIp,
  getOrCreateMagicLinkUser,
} from '../../storage/magic-link.js';
import { logAuthEvent } from '../../storage/password-reset.js';
import { getDatabaseUser } from '../../storage/password-utils.js';

interface MagicLinkContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
}

function buildMagicLinkUrl(req: IncomingMessage, token: string): string {
  const host = req.headers?.host || 'localhost:3000';
  const protocol = req.headers?.['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${host}/magic-login?token=${encodeURIComponent(token)}`;
}

async function userExists(email: string): Promise<boolean> {
  const dbUser = await getDatabaseUser(normalizeEmail(email) || '');
  return !!dbUser;
}

export async function handleMagicLink({
  req,
  res,
  url,
}: MagicLinkContext): Promise<boolean> {
  const ctx = createRouteContext(null);

  // POST /api/auth/magic-link
  if (url.pathname === '/api/auth/magic-link' && req.method === 'POST') {
    if (!authEnabled()) {
      badRequest(res, 'Authentication is not enabled');
      return true;
    }

    const body = await json<{ email?: string }>(req);
    const email = normalizeEmail(body?.email);

    const emailValidation = validateEmail(email || '');
    if (!emailValidation.valid) {
      badRequest(res, 'Valid email is required');
      return true;
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers?.['user-agent'] || '';

    // Rate limiting
    const rateLimitedByEmail = await isRateLimitedByEmail(email!);
    const rateLimitedByIp = await isRateLimitedByIp(ipAddress);

    if (rateLimitedByEmail || rateLimitedByIp) {
      await logAuthEvent({
        type: 'magic_link_rate_limited',
        email,
        success: false,
        ipAddress,
        userAgent,
        metadata: { rateLimitedByEmail, rateLimitedByIp },
      });

      // Return success to prevent enumeration
      ok(res, {
        ok: true,
        message: 'If your email is registered, a magic link has been sent. Check your inbox.',
      });
      return true;
    }

    const exists = await userExists(email!);

    await logAuthEvent({
      type: 'magic_link_request',
      email,
      success: true,
      ipAddress,
      userAgent,
      metadata: { userExists: exists },
    });

    // Only send magic link if user exists
    if (exists) {
      const result = await createMagicToken(email!, { ipAddress, userAgent });

      if (result.ok && result.token) {
        const magicLinkUrl = buildMagicLinkUrl(req, result.token);

        sendMagicLinkEmail({
          recipientEmail: email!,
          magicLinkUrl,
          expiresAt: result.expiresAt,
        }).catch((err) => {
          console.error('[magic-link] Failed to send email:', err);
        });
      }
    }

    // Always return success to prevent enumeration
    ok(res, {
      ok: true,
      message: 'If your email is registered, a magic link has been sent. Check your inbox.',
    });
    return true;
  }

  // POST /api/auth/magic-link/verify
  if (url.pathname === '/api/auth/magic-link/verify' && req.method === 'POST') {
    if (!authEnabled()) {
      badRequest(res, 'Authentication is not enabled');
      return true;
    }

    const body = await json<{ token?: string }>(req);
    const token = String(body?.token || '').trim();

    if (!token) {
      badRequest(res, 'Token is required');
      return true;
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers?.['user-agent'] || '';

    // Consume the token
    const consumeResult = await consumeMagicToken(token);

    if (!consumeResult.ok) {
      await logAuthEvent({
        type: 'magic_link_failed',
        email: null,
        success: false,
        ipAddress,
        userAgent,
        metadata: { reason: consumeResult.reason },
      });

      ok(res, {
        ok: false,
        reason: consumeResult.reason === 'invalid_or_expired' ? 'expired' : 'invalid',
      });
      return true;
    }

    const email = consumeResult.email!;

    // Get or create the user
    const userResult = await getOrCreateMagicLinkUser(email, ctx);

    if (!userResult.ok || !userResult.user) {
      await logAuthEvent({
        type: 'magic_link_failed',
        email,
        success: false,
        ipAddress,
        userAgent,
        metadata: { reason: userResult.reason },
      });

      badRequest(res, 'Failed to create session');
      return true;
    }

    await logAuthEvent({
      type: 'magic_link_login',
      email,
      success: true,
      ipAddress,
      userAgent,
    });

    // Set session cookie
    setSessionCookie(req, res, {
      email: userResult.user.email,
      role: userResult.user.role as 'admin' | 'user',
      name: userResult.user.name,
      isAdmin: userResult.user.role === 'admin',
      v: userResult.user.v,
    });

    ok(res, {
      ok: true,
      user: {
        email: userResult.user.email,
        name: userResult.user.name,
        role: userResult.user.role,
      },
    });
    return true;
  }

  return false;
}
