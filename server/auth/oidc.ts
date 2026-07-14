/**
 * OIDC (ZITADEL) login — additive alongside the existing password/magic-link
 * login. After a successful ZITADEL round-trip the verified email is looked up
 * in the shared `users` table and the normal sb_session cookie is minted (see
 * auth.ts#setSessionCookie). Auth-code flow with PKCE (S256); confidential
 * client (client_secret_basic).
 *
 * NB: during the staging phase this mints the shared sb_session; the clean-cut
 * (own host-only cookie per app) happens at the coordinated auth cutover.
 */
import crypto from 'node:crypto';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export function oidcConfigured(): boolean {
  return Boolean(
    String(process.env.OIDC_CLIENT_ID || '').trim() &&
      String(process.env.OIDC_CLIENT_SECRET || '').trim()
  );
}

export function getOidcConfig(): OidcConfig {
  const issuer = String(process.env.OIDC_ISSUER || 'https://auth.ciiic.nl')
    .trim()
    .replace(/\/$/, '');
  const clientId = String(process.env.OIDC_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.OIDC_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are required for OIDC login');
  }
  return { issuer, clientId, clientSecret };
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint?: string;
}

let discoveryCache: { issuer: string; doc: Discovery } | null = null;

async function discover(issuer: string): Promise<Discovery> {
  if (discoveryCache && discoveryCache.issuer === issuer) return discoveryCache.doc;
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const doc = (await res.json()) as Discovery;
  discoveryCache = { issuer, doc };
  return doc;
}

export function randomUrlSafe(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function buildAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): Promise<string> {
  const cfg = getOidcConfig();
  const disc = await discover(cfg.issuer);
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: opts.redirectUri,
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${disc.authorization_endpoint}?${p.toString()}`;
}

export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ access_token: string; id_token?: string }> {
  const cfg = getOidcConfig();
  const disc = await discover(cfg.issuer);
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(disc.token_endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OIDC token exchange failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { access_token: string; id_token?: string };
}

export async function fetchUserinfo(
  accessToken: string
): Promise<{ email?: string; email_verified?: boolean; name?: string }> {
  const cfg = getOidcConfig();
  const disc = await discover(cfg.issuer);
  const res = await fetch(disc.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`OIDC userinfo failed: ${res.status}`);
  return (await res.json()) as { email?: string; email_verified?: boolean; name?: string };
}
