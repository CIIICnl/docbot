/**
 * Media Upload
 * Shared helper for pushing a local image into docbot media storage
 * (Scaleway S3 in prod, local filesystem in dev) and getting back a
 * docbot://media/<key> reference. Used by both the editor's images panel and
 * the markdown toolbar's image button so loose uploads behave identically.
 */

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/**
 * Upload one image file to media storage.
 * @param {File} file
 * @returns {Promise<{mediaUrl: string, key?: string}>} media ref for markdown
 */
export async function uploadImageFile(file) {
  const response = await fetch(
    `/api/media/upload?filename=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Upload failed (${response.status})`);
  }
  return response.json();
}
