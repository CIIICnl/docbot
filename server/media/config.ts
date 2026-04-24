/**
 * Media Storage Configuration
 * Environment-based configuration for media providers.
 */

export type MediaStorageMode = 'auto' | 'scaleway' | 'local';

export interface ScalewayConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  endpoint: string;
  keyPrefix: string;
}

export interface LocalConfig {
  uploadsDir: string;
}

export interface MediaConfig {
  mode: MediaStorageMode;
  scaleway?: ScalewayConfig;
  local: LocalConfig;
}

/**
 * Get the configured storage mode
 */
export function getStorageMode(): MediaStorageMode {
  const mode = (process.env.MEDIA_STORAGE_MODE || 'auto').toLowerCase().trim();
  if (mode === 'scaleway' || mode === 's3') {
    return 'scaleway';
  }
  if (mode === 'local') {
    return 'local';
  }
  return 'auto';
}

/**
 * Check if Scaleway/S3 credentials are configured
 */
export function isScalewayConfigured(): boolean {
  return !!(
    process.env.SCW_ACCESS_KEY &&
    process.env.SCW_SECRET_KEY &&
    process.env.SCW_BUCKET
  );
}

/**
 * Get Scaleway configuration
 */
export function getScalewayConfig(): ScalewayConfig | null {
  if (!isScalewayConfigured()) {
    return null;
  }

  const region = process.env.SCW_REGION || 'nl-ams';

  return {
    accessKey: process.env.SCW_ACCESS_KEY!,
    secretKey: process.env.SCW_SECRET_KEY!,
    bucket: process.env.SCW_BUCKET!,
    region,
    endpoint: process.env.SCW_ENDPOINT || `https://s3.${region}.scw.cloud`,
    keyPrefix: process.env.SCW_KEY_PREFIX || 'docbot/',
  };
}

/**
 * Get local storage configuration
 */
export function getLocalConfig(): LocalConfig {
  return {
    uploadsDir: process.env.UPLOADS_DIR || 'server/uploads',
  };
}

/**
 * Get the complete media configuration
 */
export function getMediaConfig(): MediaConfig {
  return {
    mode: getStorageMode(),
    scaleway: getScalewayConfig() || undefined,
    local: getLocalConfig(),
  };
}

/**
 * Determine which provider to use based on config and mode
 */
export function resolveProvider(): 'scaleway' | 'local' {
  const mode = getStorageMode();

  if (mode === 'scaleway') {
    if (!isScalewayConfigured()) {
      console.warn('[media] Scaleway mode requested but not configured, falling back to local');
      return 'local';
    }
    return 'scaleway';
  }

  if (mode === 'local') {
    return 'local';
  }

  // Auto mode: prefer Scaleway if configured
  if (isScalewayConfigured()) {
    return 'scaleway';
  }

  return 'local';
}
