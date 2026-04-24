/**
 * Media Provider Interface
 * Abstract base class for media storage providers.
 */

export interface UploadOptions {
  contentType: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface PresignedUploadResult {
  url: string;
  key: string;
  fields?: Record<string, string>; // For multipart form uploads
  expiresAt: Date;
}

export interface PresignedGetResult {
  url: string;
  expiresAt: Date;
}

export interface MediaInfo {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}

/**
 * Abstract media provider interface
 */
export abstract class MediaProvider {
  abstract readonly name: string;

  /**
   * Generate a presigned URL for uploading a file
   */
  abstract getPresignedUpload(
    key: string,
    options: UploadOptions
  ): Promise<PresignedUploadResult>;

  /**
   * Generate a presigned URL for downloading/viewing a file
   */
  abstract getPresignedGet(
    key: string,
    expiresInSeconds?: number
  ): Promise<PresignedGetResult>;

  /**
   * Upload a file directly (for server-side uploads)
   */
  abstract upload(
    key: string,
    data: Buffer | Uint8Array,
    options: UploadOptions
  ): Promise<void>;

  /**
   * Download a file as a buffer
   */
  abstract download(key: string): Promise<Buffer>;

  /**
   * Delete a file
   */
  abstract delete(key: string): Promise<void>;

  /**
   * Check if a file exists
   */
  abstract exists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  abstract getInfo(key: string): Promise<MediaInfo | null>;

  /**
   * List files with a prefix
   */
  abstract list(prefix: string, limit?: number): Promise<MediaInfo[]>;

  /**
   * Generate a unique key for a new file
   */
  generateKey(organizationId: string, originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalName.includes('.')
      ? originalName.substring(originalName.lastIndexOf('.'))
      : '';
    return `${organizationId}/${timestamp}-${random}${ext}`;
  }

  /**
   * Get the content type for a file based on extension
   */
  getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() || '';
    const types: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
    };
    return types[ext] || 'application/octet-stream';
  }
}
