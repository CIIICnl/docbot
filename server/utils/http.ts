/**
 * HTTP Utilities
 * Request/response helpers for API handlers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { LIMITS } from '../config/constants.js';

/**
 * Error with an HTTP status code, so route handlers' generic catch →
 * serverError() path can still produce the right status and message.
 */
export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

/**
 * Parse JSON request body
 */
export async function json<T = unknown>(
  req: IncomingMessage,
  maxBytes: number = LIMITS.MAX_JSON_BODY_BYTES
): Promise<T> {
  const chunks: Buffer[] = [];
  let received = 0;
  let tooLarge = false;

  for await (const chunk of req) {
    received += (chunk as Buffer).length;
    if (received > maxBytes) {
      // Keep draining (without buffering) instead of destroying the socket:
      // a reset mid-upload surfaces as a generic network error in the
      // browser, while a fully-read request lets the 413 JSON reach it.
      tooLarge = true;
      chunks.length = 0;
      // Hard stop for runaway streams well past the limit.
      if (received > maxBytes * 4) {
        req.destroy();
        break;
      }
      continue;
    }
    chunks.push(chunk as Buffer);
  }

  if (tooLarge) {
    throw new HttpError(
      413,
      `Request body exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB limit`
    );
  }

  const body = Buffer.concat(chunks).toString();

  if (!body) {
    return {} as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON');
  }
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
  // HttpErrors are expected client-facing failures (413 too large, 400 bad
  // JSON, 422 doc too long): keep their status + message, log lightly.
  if (error instanceof HttpError) {
    console.warn(`[http] ${error.statusCode}: ${error.message}`);
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }
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
 * Validate required fields in a request body
 * Returns validation result with field name and message on failure
 */
export function validateRequired(
  body: Record<string, unknown>,
  fields: Record<string, string>
): { valid: true } | { valid: false; field: string; message: string } {
  for (const [field, message] of Object.entries(fields)) {
    if (!body[field]) {
      return { valid: false, field, message };
    }
  }
  return { valid: true };
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
