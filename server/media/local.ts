/**
 * Local Filesystem Media Provider
 * Stores files on the local filesystem with presigned URL simulation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  MediaProvider,
  type UploadOptions,
  type PresignedUploadResult,
  type PresignedGetResult,
  type MediaInfo,
} from './interface.js';
import { getLocalConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Token store for presigned URLs (in-memory, cleared on restart)
const presignedTokens = new Map<string, { key: string; expiresAt: Date; type: 'upload' | 'get' }>();

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of presignedTokens) {
    if (data.expiresAt.getTime() < now) {
      presignedTokens.delete(token);
    }
  }
}, 60000); // Every minute

/**
 * Local filesystem media provider
 */
export class LocalMediaProvider extends MediaProvider {
  readonly name = 'local';
  private uploadsDir: string;

  constructor() {
    super();
    const config = getLocalConfig();
    // Resolve relative to project root
    this.uploadsDir = path.isAbsolute(config.uploadsDir)
      ? config.uploadsDir
      : path.resolve(__dirname, '../../..', config.uploadsDir);
  }

  /**
   * Ensure uploads directory exists
   */
  private async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Get full path for a key
   */
  private getPath(key: string): string {
    // Sanitize key to prevent path traversal
    const sanitized = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.uploadsDir, sanitized);
  }

  /**
   * Generate a presigned token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async getPresignedUpload(
    key: string,
    _options: UploadOptions
  ): Promise<PresignedUploadResult> {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    presignedTokens.set(token, { key, expiresAt, type: 'upload' });

    return {
      url: `/api/media/upload/${token}`,
      key,
      expiresAt,
    };
  }

  async getPresignedGet(
    key: string,
    expiresInSeconds = 3600
  ): Promise<PresignedGetResult> {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    presignedTokens.set(token, { key, expiresAt, type: 'get' });

    return {
      url: `/api/media/get/${token}`,
      expiresAt,
    };
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options: UploadOptions
  ): Promise<void> {
    const filePath = this.getPath(key);
    await this.ensureDir(filePath);
    await fs.writeFile(filePath, data);

    // Store metadata in a sidecar file
    const metaPath = `${filePath}.meta.json`;
    await fs.writeFile(metaPath, JSON.stringify({
      contentType: options.contentType,
      size: data.length,
      uploadedAt: new Date().toISOString(),
      metadata: options.metadata,
    }));
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.getPath(key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getPath(key);
    try {
      await fs.unlink(filePath);
      // Also delete metadata
      await fs.unlink(`${filePath}.meta.json`).catch(() => {});
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getPath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(key: string): Promise<MediaInfo | null> {
    const filePath = this.getPath(key);
    try {
      const stat = await fs.stat(filePath);
      const metaPath = `${filePath}.meta.json`;

      let contentType = this.getContentType(key);
      let metadata: Record<string, string> | undefined;

      try {
        const metaData = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        contentType = metaData.contentType || contentType;
        metadata = metaData.metadata;
      } catch {
        // Metadata file doesn't exist
      }

      return {
        key,
        size: stat.size,
        contentType,
        lastModified: stat.mtime,
        metadata,
      };
    } catch {
      return null;
    }
  }

  async list(prefix: string, limit = 100): Promise<MediaInfo[]> {
    const dirPath = this.getPath(prefix);
    const results: MediaInfo[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
          const key = path.join(prefix, entry.name).replace(/\\/g, '/');
          const info = await this.getInfo(key);
          if (info) {
            results.push(info);
          }
          if (results.length >= limit) break;
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return results;
  }

  /**
   * Validate a presigned upload token and return the key
   */
  static validateUploadToken(token: string): string | null {
    const data = presignedTokens.get(token);
    if (!data) return null;
    if (data.type !== 'upload') return null;
    if (data.expiresAt.getTime() < Date.now()) {
      presignedTokens.delete(token);
      return null;
    }
    return data.key;
  }

  /**
   * Validate a presigned get token and return the key
   */
  static validateGetToken(token: string): string | null {
    const data = presignedTokens.get(token);
    if (!data) return null;
    if (data.type !== 'get') return null;
    if (data.expiresAt.getTime() < Date.now()) {
      presignedTokens.delete(token);
      return null;
    }
    return data.key;
  }

  /**
   * Consume an upload token (use once)
   */
  static consumeUploadToken(token: string): string | null {
    const key = LocalMediaProvider.validateUploadToken(token);
    if (key) {
      presignedTokens.delete(token);
    }
    return key;
  }
}
