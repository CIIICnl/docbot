/**
 * HTTP Utilities
 * Request/response helpers for API handlers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Parse JSON request body
 */
export async function json<T = unknown>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  const body = Buffer.concat(chunks).toString();

  if (!body) {
    return {} as T;
  }

  return JSON.parse(body) as T;
}

/**
 * Send a JSON response
 */
export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Send a 200 OK response
 */
export function ok(res: ServerResponse, data?: unknown): void {
  if (data === undefined) {
    res.writeHead(204);
    res.end();
  } else {
    sendJson(res, 200, data);
  }
}

/**
 * Send a 201 Created response
 */
export function created(res: ServerResponse, data: unknown): void {
  sendJson(res, 201, data);
}

/**
 * Send a 400 Bad Request response
 */
export function badRequest(res: ServerResponse, message = 'Bad request'): void {
  sendJson(res, 400, { error: message });
}

/**
 * Send a 401 Unauthorized response
 */
export function unauthorized(res: ServerResponse, message = 'Unauthorized'): void {
  sendJson(res, 401, { error: message });
}

/**
 * Send a 403 Forbidden response
 */
export function forbidden(res: ServerResponse, message = 'Forbidden'): void {
  sendJson(res, 403, { error: message });
}

/**
 * Send a 404 Not Found response
 */
export function notFound(res: ServerResponse, message = 'Not found'): void {
  sendJson(res, 404, { error: message });
}

/**
 * Send a 409 Conflict response
 */
export function conflict(res: ServerResponse, message = 'Conflict'): void {
  sendJson(res, 409, { error: message });
}

/**
 * Send a 500 Internal Server Error response
 */
export function serverError(res: ServerResponse, error: Error): void {
  console.error('Server error:', error);
  const message = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';
  sendJson(res, 500, { error: message });
}

/**
 * Parse query string from URL
 */
export function parseQuery(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams);
}

/**
 * Extract path parameter from pattern match
 */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (!patternPart || !pathPart) {
      return null;
    }

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}
