/**
 * API routes for password reset functionality.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  authEnabled,
  getUserFromRequestAsync,
  setSessionCookie,
  verifyLoginAsync,
} from '../../auth/auth.js';
import { json, ok, badRequest, unauthorized } from '../../utils/http.js';
import { getClientIp, createRouteContext } from '../../utils/context.js';
import { sendPasswordResetEmail } from '../../integrations/brevo.js';
import { normalizeEmail } from '../../utils/normalize.js';
import {
  createResetToken,
  validateResetToken,
  consumeResetToken,
  isRateLimitedByEmail,
  isRateLimitedByIp,
  logAuthEvent,
} from '../../storage/password-reset.js';
import {
  getDatabaseUser,
  setUserPassword,
  validatePassword,
  verifyUserPassword,
  hasDatabaseCredentials,
} from '../../storage/password-utils.js';

interface PasswordResetContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
}

function buildResetUrl(req: IncomingMessage, token: string): string {
  const host = req.headers?.host || 'localhost:3000';
  const protocol = req.headers?.['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${host}/reset-password?token=${encodeURIComponent(token)}`;
}

async function userExists(email: string): Promise<boolean> {
  const dbUser = await getDatabaseUser(normalizeEmail(email) || '');
  return !!dbUser;
}

export async function handlePasswordReset({
  req,
  res,
  url,
}: PasswordResetContext): Promise<boolean> {
  const ctx = createRouteContext(null);

  // POST /api/auth/forgot-password
  if (url.pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    if (!authEnabled()) {
      badRequest(res, 'Authentication is not enabled');
      return true;
    }

    const body = await json<{ email?: string }>(req);
    const email = normalizeEmail(body?.email);

    if (!email || !email.includes('@')) {
      badRequest(res, 'Valid email is required');
      return true;
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers?.['user-agent'] || '';

    // Rate limiting
    const rateLimitedByEmail = await isRateLimitedByEmail(email);
    const rateLimitedByIp = await isRateLimitedByIp(ipAddress);

    if (rateLimitedByEmail || rateLimitedByIp) {
      await logAuthEvent({
        type: 'password_reset_rate_limited',
        email,
        success: false,
        ipAddress,
        userAgent,
        metadata: { rateLimitedByEmail, rateLimitedByIp },
      });

      // Return success to prevent enumeration
      ok(res, {
        ok: true,
        message: 'If an account exists with this email, a reset link has been sent.',
      });
      return true;
    }

    const exists = await userExists(email);

    await logAuthEvent({
      type: 'password_reset_request',
      email,
      success: exists,
      ipAddress,
      userAgent,
    });

    if (exists) {
      const result = await createResetToken(email, { ipAddress, userAgent });

      if (result.ok && result.token) {
        const resetUrl = buildResetUrl(req, result.token);

        sendPasswordResetEmail({
          recipientEmail: email,
          resetUrl,
          expiresAt: result.expiresAt,
        }).catch((err) => {
          console.error('[password-reset] Failed to send email:', err);
        });
      }
    }

    ok(res, {
      ok: true,
      message: 'If an account exists with this email, a reset link has been sent.',
    });
    return true;
  }

  // GET /api/auth/reset-password/validate?token=xxx
  if (url.pathname === '/api/auth/reset-password/validate' && req.method === 'GET') {
    if (!authEnabled()) {
      badRequest(res, 'Authentication is not enabled');
      return true;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      badRequest(res, 'Token is required');
      return true;
    }

    const result = await validateResetToken(token);

    if (!result.ok) {
      ok(res, { ok: false, reason: result.reason });
      return true;
    }

    ok(res, {
      ok: true,
      maskedEmail: result.maskedEmail,
      expiresAt: result.expiresAt,
    });
    return true;
  }

  // POST /api/auth/reset-password
  if (url.pathname === '/api/auth/reset-password' && req.method === 'POST') {
    if (!authEnabled()) {
      badRequest(res, 'Authentication is not enabled');
      return true;
    }

    const body = await json<{ token?: string; password?: string }>(req);
    const token = String(body?.token || '').trim();
    const password = String(body?.password || '');

    if (!token) {
      badRequest(res, 'Token is required');
      return true;
    }

    const pwValidation = validatePassword(password);
    if (!pwValidation.ok) {
      badRequest(
        res,
        pwValidation.reason === 'too_short'
          ? 'Password is too short (minimum 8 characters)'
          : 'Password is invalid'
      );
      return true;
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers?.['user-agent'] || '';

    const consumeResult = await consumeResetToken(token);

    if (!consumeResult.ok) {
      await logAuthEvent({
        type: 'password_reset_failed',
        email: null,
        success: false,
        ipAddress,
        userAgent,
        metadata: { reason: consumeResult.reason },
      });

      badRequest(
        res,
        consumeResult.reason === 'invalid_or_expired'
          ? 'This reset link is invalid or has expired. Please request a new one.'
          : 'Invalid reset token'
      );
      return true;
    }

    const email = consumeResult.email!;

    const setResult = await setUserPassword(email, password, ctx);

    if (!setResult.ok) {
      await logAuthEvent({
        type: 'password_reset_failed',
        email,
        success: false,
        ipAddress,
        userAgent,
        metadata: { reason: setResult.reason },
      });

      badRequest(res, 'Failed to set password');
      return true;
    }

    await logAuthEvent({
      type: 'password_reset_success',
      email,
      success: true,
      ipAddress,
      userAgent,
    });

    ok(res, {
      ok: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
    return true;
  }

  // POST /api/auth/change-password
  if (url.pathname === '/api/auth/change-password' && req.method === 'POST') {
    if (!authEnabled()) {
      badRequest(res, 'Authentication is not enabled');
      return true;
    }

    const user = await getUserFromRequestAsync(req, ctx);
    if (!user) {
      unauthorized(res, 'You must be logged in to change your password');
      return true;
    }

    const body = await json<{ currentPassword?: string; newPassword?: string }>(req);
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');

    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.ok) {
      badRequest(
        res,
        pwValidation.reason === 'too_short'
          ? 'Password is too short (minimum 8 characters)'
          : 'Password is invalid'
      );
      return true;
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers?.['user-agent'] || '';
    const email = user.email;

    const hasDbCreds = await hasDatabaseCredentials(email, ctx);
    if (!hasDbCreds) {
      badRequest(res, 'Cannot change password - no database credentials found');
      return true;
    }

    const isCurrentValid = await verifyUserPassword(email, currentPassword, ctx);
    if (!isCurrentValid) {
      await logAuthEvent({
        type: 'password_change_failed',
        email,
        success: false,
        ipAddress,
        userAgent,
        metadata: { reason: 'invalid_current_password' },
      });

      badRequest(res, 'Current password is incorrect');
      return true;
    }

    const setResult = await setUserPassword(email, newPassword, ctx);

    if (!setResult.ok) {
      await logAuthEvent({
        type: 'password_change_failed',
        email,
        success: false,
        ipAddress,
        userAgent,
        metadata: { reason: setResult.reason },
      });

      badRequest(res, 'Failed to set new password');
      return true;
    }

    await logAuthEvent({
      type: 'password_change_success',
      email,
      success: true,
      ipAddress,
      userAgent,
    });

    // Get updated user for new session
    const newUser = await verifyLoginAsync(email, newPassword, ctx);

    if (newUser) {
      setSessionCookie(req, res, newUser);
    }

    ok(res, {
      ok: true,
      message: 'Password has been changed successfully.',
    });
    return true;
  }

  return false;
}
