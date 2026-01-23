/**
 * Context utilities for request handling.
 */

import type { IncomingMessage } from 'node:http';
import { getDefaultOrganizationId } from '../config/database.js';

export interface RouteContext {
  organizationId: string;
  actorEmail?: string;
}

/**
 * Get the organization ID from context, falling back to default.
 */
export function getOrgId(ctx?: { organizationId?: string }): string {
  return ctx?.organizationId || getDefaultOrganizationId();
}

/**
 * Create a route context object from an authenticated user.
 */
export function createRouteContext(authedUser?: { email?: string } | null): RouteContext {
  return {
    organizationId: getDefaultOrganizationId(),
    actorEmail: authedUser?.email,
  };
}

/**
 * Get the client IP address from a request.
 */
export function getClientIp(req: IncomingMessage): string | null {
  const xff = req.headers?.['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0]?.trim();
    if (first) return first;
  }

  const xri = req.headers?.['x-real-ip'];
  if (xri) return String(xri).trim();

  const remoteAddr = req.socket?.remoteAddress;
  if (remoteAddr) return remoteAddr;

  return null;
}
