/**
 * API Client
 * Simple fetch wrapper for API requests.
 */

/**
 * Make an API request
 * @param {string} endpoint - API endpoint (e.g., '/api/items')
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function api(endpoint, options = {}) {
  const { body, timeoutMs, ...rest } = options;

  const fetchOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...rest,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  // Optional client-side timeout. Opt-in per request (via timeoutMs) so
  // long-running calls like LLM enhancement keep their unbounded default.
  let timer = null;
  let timedOut = false;
  if (timeoutMs) {
    const controller = new AbortController();
    fetchOptions.signal = controller.signal;
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(endpoint, fetchOptions);
    let data = null;

    // Try to parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        // Empty or invalid JSON
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch {
    if (timedOut) {
      return {
        ok: false,
        status: 0,
        timedOut: true,
        data: { error: 'Request timed out' },
      };
    }
    // Network error
    return {
      ok: false,
      status: 0,
      data: { error: 'Network error' },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * GET request helper
 * @param {string} endpoint
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export function get(endpoint) {
  return api(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 * @param {string} endpoint
 * @param {any} body
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export function post(endpoint, body, options = {}) {
  return api(endpoint, { method: 'POST', body, ...options });
}

/**
 * PUT request helper
 * @param {string} endpoint
 * @param {any} body
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export function put(endpoint, body) {
  return api(endpoint, { method: 'PUT', body });
}

/**
 * PATCH request helper
 * @param {string} endpoint
 * @param {any} body
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export function patch(endpoint, body) {
  return api(endpoint, { method: 'PATCH', body });
}

/**
 * DELETE request helper
 * @param {string} endpoint
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export function del(endpoint) {
  return api(endpoint, { method: 'DELETE' });
}
