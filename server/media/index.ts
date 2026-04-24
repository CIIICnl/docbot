/**
 * Media Provider Factory
 * Singleton access to the configured media provider.
 */

import { type MediaProvider } from './interface.js';
import { resolveProvider } from './config.js';
import { LocalMediaProvider } from './local.js';
import { ScalewayMediaProvider } from './scaleway.js';

let provider: MediaProvider | null = null;

/**
 * Get the media provider instance
 */
export function getMediaProvider(): MediaProvider {
  if (provider) {
    return provider;
  }

  const type = resolveProvider();

  if (type === 'scaleway') {
    provider = new ScalewayMediaProvider();
    console.log('[media] Using Scaleway S3 provider');
  } else {
    provider = new LocalMediaProvider();
    console.log('[media] Using local filesystem provider');
  }

  return provider;
}

/**
 * Check if media storage is available
 */
export function isMediaAvailable(): boolean {
  try {
    getMediaProvider();
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset the provider (for testing)
 */
export function resetProvider(): void {
  provider = null;
}

// Re-export types
export type { MediaProvider, UploadOptions, PresignedUploadResult, PresignedGetResult, MediaInfo } from './interface.js';
export { LocalMediaProvider } from './local.js';
export { ScalewayMediaProvider } from './scaleway.js';
