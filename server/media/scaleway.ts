/**
 * Scaleway S3 Media Provider
 * S3-compatible storage using Scaleway Object Storage.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  MediaProvider,
  type UploadOptions,
  type PresignedUploadResult,
  type PresignedGetResult,
  type MediaInfo,
} from './interface.js';
import { getScalewayConfig, type ScalewayConfig } from './config.js';

/**
 * Scaleway/S3 media provider
 */
export class ScalewayMediaProvider extends MediaProvider {
  readonly name = 'scaleway';
  private client: S3Client;
  private config: ScalewayConfig;

  constructor() {
    super();
    const config = getScalewayConfig();
    if (!config) {
      throw new Error('Scaleway configuration is not available');
    }
    this.config = config;

    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true, // Required for Scaleway
    });
  }

  /**
   * Get the full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  async getPresignedUpload(
    key: string,
    options: UploadOptions
  ): Promise<PresignedUploadResult> {
    const fullKey = this.getFullKey(key);
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
      Metadata: options.metadata,
      ACL: 'private', // Private by default
    });

    const expiresIn = 3600; // 1 hour
    const url = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      url,
      key,
      expiresAt,
    };
  }

  async getPresignedGet(
    key: string,
    expiresInSeconds = 3600
  ): Promise<PresignedGetResult> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      url,
      expiresAt,
    };
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options: UploadOptions
  ): Promise<void> {
    const fullKey = this.getFullKey(key);
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
      Body: data,
      ContentType: options.contentType,
      ContentLength: options.contentLength || data.length,
      Metadata: options.metadata,
      ACL: 'private',
    });

    await this.client.send(command);
  }

  async download(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
    });

    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const command = new HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
    });

    try {
      await this.client.send(command);
      return true;
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw err;
    }
  }

  async getInfo(key: string): Promise<MediaInfo | null> {
    const fullKey = this.getFullKey(key);
    const command = new HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
    });

    try {
      const response = await this.client.send(command);
      return {
        key,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata,
      };
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw err;
    }
  }

  async list(prefix: string, limit = 100): Promise<MediaInfo[]> {
    const fullPrefix = this.getFullKey(prefix);
    const command = new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: fullPrefix,
      MaxKeys: limit,
    });

    const response = await this.client.send(command);
    const results: MediaInfo[] = [];

    for (const obj of response.Contents || []) {
      if (obj.Key) {
        // Remove the prefix to get the relative key
        const relativeKey = obj.Key.substring(this.config.keyPrefix.length);
        results.push({
          key: relativeKey,
          size: obj.Size || 0,
          contentType: 'application/octet-stream', // ListObjects doesn't return content type
          lastModified: obj.LastModified || new Date(),
        });
      }
    }

    return results;
  }
}
