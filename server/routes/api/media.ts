/**
 * Media API Routes
 * Handles file uploads, downloads, and management.
 */

import type { ApiContext } from './index.js';
import { ok, badRequest, notFound, forbidden, serverError, matchPath, json } from '../../utils/http.js';
import { getMediaProvider, isMediaAvailable, LocalMediaProvider } from '../../media/index.js';
import { getDefaultOrganizationId } from '../../config/database.js';

/**
 * Handle media routes
 */
export async function handleMedia(ctx: ApiContext): Promise<boolean> {
  const { req, res, url, authedUser } = ctx;
  const path = url.pathname;

  // Check if media is available
  if (!isMediaAvailable()) {
    if (path.startsWith('/api/media')) {
      badRequest(res, 'Media storage not available');
      return true;
    }
    return false;
  }

  const userEmail = authedUser?.email;

  try {
    // POST /api/media/presign - Get presigned upload URL
    if (path === '/api/media/presign' && req.method === 'POST') {
      if (!userEmail) {
        forbidden(res, 'Authentication required');
        return true;
      }

      const body = await json<{
        filename: string;
        contentType?: string;
        size?: number;
      }>(req);

      if (!body.filename) {
        badRequest(res, 'filename is required');
        return true;
      }

      const provider = getMediaProvider();
      const orgId = getDefaultOrganizationId();
      const key = provider.generateKey(orgId, body.filename);
      const contentType = body.contentType || provider.getContentType(body.filename);

      const result = await provider.getPresignedUpload(key, {
        contentType,
        contentLength: body.size,
      });

      ok(res, {
        uploadUrl: result.url,
        key: result.key,
        expiresAt: result.expiresAt.toISOString(),
        // Return the docbot:// URL for markdown reference
        mediaUrl: `docbot://media/${result.key}`,
      });
      return true;
    }

    // POST /api/media/confirm/:key - Confirm upload completed
    const confirmMatch = matchPath('/api/media/confirm/:key', path);
    if (confirmMatch?.key && req.method === 'POST') {
      if (!userEmail) {
        forbidden(res, 'Authentication required');
        return true;
      }

      const key = decodeURIComponent(confirmMatch.key);
      const provider = getMediaProvider();

      // Verify file exists
      const exists = await provider.exists(key);
      if (!exists) {
        notFound(res, 'File not found');
        return true;
      }

      const info = await provider.getInfo(key);

      ok(res, {
        key,
        size: info?.size,
        contentType: info?.contentType,
        mediaUrl: `docbot://media/${key}`,
      });
      return true;
    }

    // POST /api/media/upload - Server-side upload (for DOCX import)
    if (path === '/api/media/upload' && req.method === 'POST') {
      if (!userEmail) {
        forbidden(res, 'Authentication required');
        return true;
      }

      // Read raw body as buffer
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const data = Buffer.concat(chunks);

      if (data.length === 0) {
        badRequest(res, 'No file data provided');
        return true;
      }

      // Get filename from header or query
      const filename = url.searchParams.get('filename') ||
        req.headers['x-filename'] as string ||
        `upload-${Date.now()}`;
      const contentType = req.headers['content-type'] || 'application/octet-stream';

      const provider = getMediaProvider();
      const orgId = getDefaultOrganizationId();
      const key = provider.generateKey(orgId, filename);

      await provider.upload(key, data, { contentType });

      ok(res, {
        key,
        size: data.length,
        contentType,
        mediaUrl: `docbot://media/${key}`,
      });
      return true;
    }

    // GET /api/media/:key - Get presigned download URL
    const getMatch = matchPath('/api/media/:key', path);
    if (getMatch?.key && req.method === 'GET') {
      if (!userEmail) {
        forbidden(res, 'Authentication required');
        return true;
      }

      const key = decodeURIComponent(getMatch.key);
      const provider = getMediaProvider();

      // Check if file exists
      const exists = await provider.exists(key);
      if (!exists) {
        notFound(res, 'File not found');
        return true;
      }

      const expiresIn = parseInt(url.searchParams.get('expires') || '3600', 10);
      const result = await provider.getPresignedGet(key, expiresIn);

      ok(res, {
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
      });
      return true;
    }

    // DELETE /api/media/:key - Delete file
    const deleteMatch = matchPath('/api/media/:key', path);
    if (deleteMatch?.key && req.method === 'DELETE') {
      if (!userEmail) {
        forbidden(res, 'Authentication required');
        return true;
      }

      const key = decodeURIComponent(deleteMatch.key);
      const provider = getMediaProvider();

      await provider.delete(key);

      ok(res);
      return true;
    }

    // GET /api/media/get/:token - Local provider: serve file via presigned token
    const tokenGetMatch = matchPath('/api/media/get/:token', path);
    if (tokenGetMatch?.token && req.method === 'GET') {
      const key = LocalMediaProvider.validateGetToken(tokenGetMatch.token);
      if (!key) {
        forbidden(res, 'Invalid or expired token');
        return true;
      }

      const provider = getMediaProvider();
      const data = await provider.download(key);
      const info = await provider.getInfo(key);

      res.writeHead(200, {
        'Content-Type': info?.contentType || 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': 'private, max-age=3600',
      });
      res.end(data);
      return true;
    }

    // PUT /api/media/upload/:token - Local provider: upload via presigned token
    const tokenUploadMatch = matchPath('/api/media/upload/:token', path);
    if (tokenUploadMatch?.token && req.method === 'PUT') {
      const key = LocalMediaProvider.consumeUploadToken(tokenUploadMatch.token);
      if (!key) {
        forbidden(res, 'Invalid or expired token');
        return true;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const data = Buffer.concat(chunks);

      const contentType = req.headers['content-type'] || 'application/octet-stream';
      const provider = getMediaProvider();

      await provider.upload(key, data, { contentType });

      ok(res, { key });
      return true;
    }

    return false;
  } catch (err) {
    serverError(res, err instanceof Error ? err : new Error(String(err)));
    return true;
  }
}

/**
 * Resolve a docbot:// media URL to an actual URL or base64 data
 * Used for PDF generation and preview
 */
export async function resolveMediaUrl(
  mediaUrl: string,
  options: { asBase64?: boolean; expiresIn?: number } = {}
): Promise<string | null> {
  if (!mediaUrl.startsWith('docbot://media/')) {
    return null;
  }

  const key = mediaUrl.substring('docbot://media/'.length);

  if (!isMediaAvailable()) {
    return null;
  }

  const provider = getMediaProvider();

  // Check if file exists
  const exists = await provider.exists(key);
  if (!exists) {
    return null;
  }

  if (options.asBase64) {
    // Return as base64 data URL (for PDF embedding)
    const data = await provider.download(key);
    const info = await provider.getInfo(key);
    const contentType = info?.contentType || 'application/octet-stream';
    return `data:${contentType};base64,${data.toString('base64')}`;
  } else {
    // Return presigned URL
    const result = await provider.getPresignedGet(key, options.expiresIn || 3600);
    return result.url;
  }
}
