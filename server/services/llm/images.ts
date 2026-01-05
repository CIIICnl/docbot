/**
 * LLM Image Handling
 * Strip and restore base64 images to reduce token count.
 */

const BASE64_IMAGE_REGEX = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g;

export interface ImageStrippingResult {
  cleaned: string;
  imageMap: Map<string, string>;
}

/**
 * Strip base64 images from markdown and replace with placeholders
 * Returns the cleaned markdown and a map to restore images later
 */
export function stripBase64Images(markdown: string): ImageStrippingResult {
  const imageMap = new Map<string, string>();
  let counter = 0;

  const cleaned = markdown.replace(BASE64_IMAGE_REGEX, (_match, alt, dataUrl) => {
    const placeholder = `__IMAGE_PLACEHOLDER_${counter}__`;
    imageMap.set(placeholder, dataUrl);
    counter++;
    return `![${alt}](${placeholder})`;
  });

  return { cleaned, imageMap };
}

/**
 * Restore base64 images in markdown from placeholders
 */
export function restoreBase64Images(markdown: string, imageMap: Map<string, string>): string {
  let result = markdown;

  for (const [placeholder, dataUrl] of imageMap) {
    // Escape special regex characters in placeholder
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedPlaceholder}\\)`, 'g');
    result = result.replace(regex, `![$1](${dataUrl})`);
  }

  return result;
}
