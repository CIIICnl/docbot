/**
 * Auth Client Library
 * Handles authentication state and API calls.
 */

let cachedUser = null;
let cachedAt = 0;

/**
 * Get current user info
 * Returns null if not authenticated
 */
export async function me() {
  const res = await fetch('/api/auth/me', {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
  const body = await res.json();
  return body?.user || null;
}

/**
 * Get current user with caching
 * Avoids spamming /me on every rerender
 */
export async function getMeCached(maxAge = 10_000) {
  const now = Date.now();
  if (cachedUser && now - cachedAt < maxAge) {
    return cachedUser;
  }
  cachedUser = await me();
  cachedAt = now;
  return cachedUser;
}

/**
 * Clear the cached user
 */
export function clearUserCache() {
  cachedUser = null;
  cachedAt = 0;
}

/**
 * Login with email and password
 */
export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = 'Login failed';
    try {
      const json = JSON.parse(text);
      message = json.error || message;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }
  const body = await res.json();
  // Clear cache so next getMeCached fetches fresh data
  clearUserCache();
  return body?.user || null;
}

/**
 * Logout current user
 */
export async function logout() {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error((await res.text()) || `Logout failed (${res.status})`);
  clearUserCache();
  return true;
}

/**
 * Dev bypass login (only works if AUTH_DEV_BYPASS is enabled)
 */
export async function devLogin() {
  const res = await fetch('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error((await res.text()) || `Dev login failed (${res.status})`);
  clearUserCache();
  const body = await res.json();
  return body?.user || null;
}

/**
 * Fetch public auth config (authEnabled, devBypassEnabled, cutoverEnabled).
 */
let cachedConfig = null;
export async function getAuthConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch('/api/auth/config', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) cachedConfig = await res.json();
  } catch {
    // ignore
  }
  return cachedConfig || { authEnabled: false, devBypassEnabled: false, cutoverEnabled: false };
}

/**
 * Check if dev bypass is available
 */
export async function isDevBypassAvailable() {
  try {
    const res = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
