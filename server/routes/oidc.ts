/**
 * OIDC (ZITADEL) login routes for beeldbank — additive.
 *
 *   GET /auth/login    → PKCE kickoff, redirect to ZITADEL authorize
 *   GET /auth/callback → code exchange, userinfo, users-lookup, mint sb_session
 *
 * The existing /api/auth/* (password + magic-link) paths are untouched.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseCookies } from '../utils/cookies.js';
import {
  setSessionCookie,
  createSessionUserForEmail,
  isHttpsRequest,
} from '../auth/auth.js';
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchUserinfo,
  oidcConfigured,
  pkceChallenge,
  randomUrlSafe,
} from '../auth/oidc.js';

const TX_COOKIES = ['oidc_verifier', 'oidc_state', 'oidc_nonce', 'oidc_next'];

function safeNext(candidate: string | null | undefined, fallback = '/'): string {
  if (!candidate) return fallback;
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return fallback;
  }
  if (parsed.protocol !== 'https:') return fallback;
  const host = parsed.hostname;
  if (host === 'ciiic.nl' || host.endsWith('.ciiic.nl')) return parsed.toString();
  return fallback;
}

function redirect(res: ServerResponse, location: string, setCookies: string[] | null = null): boolean {
  if (setCookies) res.setHeader('Set-Cookie', setCookies);
  res.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
  return true;
}

function txCookie(name: string, value: string, req: IncomingMessage, maxAge: number): string {
  const parts = [`${name}=${value}`, 'Path=/auth', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isHttpsRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

function clearTxCookies(req: IncomingMessage): string[] {
  return TX_COOKIES.map((n) => txCookie(n, '', req, 0));
}

export async function handleOidc({
  req,
  res,
  url,
}: {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
}): Promise<boolean> {
  // Behind Coolify's Traefik proxy the internal request is http (TLS ends at
  // the proxy), so url.protocol is "http". Trust X-Forwarded-Proto/Host so the
  // redirect_uri matches the https URI registered on the ZITADEL client.
  const fwdProto = (String(req.headers['x-forwarded-proto'] ?? '').split(',')[0] ?? '').trim();
  const fwdHost = (String(req.headers['x-forwarded-host'] ?? '').split(',')[0] ?? '').trim();
  const proto = fwdProto || url.protocol.replace(/:$/, '');
  const host = fwdHost || url.host;
  const origin = `${proto}://${host}`;

  if (url.pathname === '/auth/login' && req.method === 'GET') {
    if (!oidcConfigured()) return redirect(res, '/login?oidc=unconfigured');

    const verifier = randomUrlSafe();
    const state = randomUrlSafe(16);
    const nonce = randomUrlSafe(16);
    const next = safeNext(url.searchParams.get('next'));

    const setCookies = [
      txCookie('oidc_verifier', verifier, req, 600),
      txCookie('oidc_state', state, req, 600),
      txCookie('oidc_nonce', nonce, req, 600),
      txCookie('oidc_next', encodeURIComponent(next), req, 600),
    ];

    const authorizeUrl = await buildAuthorizeUrl({
      redirectUri: `${origin}/auth/callback`,
      state,
      nonce,
      codeChallenge: pkceChallenge(verifier),
    });
    return redirect(res, authorizeUrl, setCookies);
  }

  if (url.pathname === '/auth/callback' && req.method === 'GET') {
    const cookies = parseCookies(req.headers?.cookie);
    const clears = clearTxCookies(req);

    const err = url.searchParams.get('error');
    if (err) return redirect(res, `/login?oidc=${encodeURIComponent(err)}`, clears);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expectedState = cookies.oidc_state;
    const verifier = cookies.oidc_verifier;
    const next = safeNext(cookies.oidc_next ? decodeURIComponent(cookies.oidc_next) : null);

    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      return redirect(res, '/login?oidc=state', clears);
    }

    let email: string | undefined;
    try {
      const tokens = await exchangeCode({
        code,
        codeVerifier: verifier,
        redirectUri: `${origin}/auth/callback`,
      });
      const info = await fetchUserinfo(tokens.access_token);
      email = info?.email;
    } catch {
      return redirect(res, '/login?oidc=exchange', clears);
    }

    if (!email) return redirect(res, '/login?oidc=noemail', clears);

    let user;
    try {
      user = await createSessionUserForEmail(email);
    } catch {
      return redirect(res, '/login?oidc=error', clears);
    }

    if (!user) return redirect(res, '/login?oidc=nouser', clears);

    setSessionCookie(req, res, user);
    const existing = res.getHeader('Set-Cookie');
    const existingArr = Array.isArray(existing) ? existing : existing != null ? [String(existing)] : [];
    res.setHeader('Set-Cookie', [...existingArr, ...clears]);
    res.writeHead(303, { Location: next, 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }

  return false;
}
