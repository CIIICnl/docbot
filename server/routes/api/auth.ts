/**
 * Auth API Routes
 * Handles login, logout, and user info endpoints.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, ok, unauthorized } from '../../utils/http.js';
import {
  authEnabled,
  clearSessionCookie,
  devAuthBypassEnabled,
  devBypassUser,
  getUserFromRequest,
  setSessionCookie,
  verifyLogin,
  type UserWithVersion,
} from '../../auth/auth.js';

interface AuthContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
}

export async function handleAuth({ req, res, url }: AuthContext): Promise<boolean> {
  // Dev login bypass
  if (url.pathname === '/api/auth/dev-login' && req.method === 'POST') {
    if (!devAuthBypassEnabled()) {
      unauthorized(res, 'Dev bypass disabled');
      return true;
    }
    const devUser: UserWithVersion = { ...devBypassUser(), v: 'dev' };
    if (authEnabled()) setSessionCookie(req, res, devUser);
    ok(res, { user: devBypassUser() });
    return true;
  }

  // Login
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await json<{ email?: string; password?: string }>(req);
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const user = verifyLogin(email, password);
    if (!user) {
      unauthorized(res, 'Invalid email/password');
      return true;
    }
    setSessionCookie(req, res, user);
    ok(res, {
      user: {
        email: user.email,
        role: user.role,
        name: user.name || '',
        isAdmin: user.isAdmin,
      },
    });
    return true;
  }

  // Logout
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    clearSessionCookie(req, res);
    ok(res, { ok: true });
    return true;
  }

  // Get current user
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    const user = getUserFromRequest(req);
    if (!user && authEnabled()) {
      unauthorized(res);
      return true;
    }
    ok(res, { user });
    return true;
  }

  return false;
}
