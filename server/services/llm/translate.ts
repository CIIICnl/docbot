/**
 * LLM Translation
 * Markdown translation using LLM providers.
 */

import { TOKEN_LIMITS } from '../../config/constants.js';
import { buildTranslationSystemPrompt } from '../../prompts/index.js';
import { callProvider } from './provider.js';
import { stripBase64Images, restoreBase64Images } from './images.js';
import type { LlmTranslateRequest, LlmTranslateResult, TranslationDirection } from './types.js';

/**
 * Split markdown into chunks for translation
 * Preserves structure by splitting on section boundaries
 */
function splitIntoChunks(markdown: string, maxChunkSize: number = TOKEN_LIMITS.CHUNK_SIZE): string[] {
  const chunks: string[] = [];

  // Split by double newlines (paragraphs/sections)
  const sections = markdown.split(/\n\n+/);
  let currentChunk = '';

  for (const section of sections) {
    // If adding this section would exceed the limit, save current chunk
    if (currentChunk && currentChunk.length + section.length + 2 > maxChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = section;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Translate a single chunk
 */
async function translateChunk(
  chunk: string,
  provider: LlmTranslateRequest['provider'],
  direction: TranslationDirection
): Promise<string> {
  return callProvider({
    provider,
    systemPrompt: buildTranslationSystemPrompt(direction),
    userContent: chunk,
    maxTokens: TOKEN_LIMITS.TRANSLATE_MAX_TOKENS,
  });
}

/**
 * Translate markdown content in chunks
 */
export async function translateMarkdown(request: LlmTranslateRequest): Promise<LlmTranslateResult> {
  // Strip base64 images to reduce token count
  const { cleaned, imageMap } = stripBase64Images(request.markdown);

  // Split into chunks
  const chunks = splitIntoChunks(cleaned);
  const translatedChunks: string[] = [];

  // Translate each chunk
  for (const chunk of chunks) {
    const translated = await translateChunk(chunk, request.provider, request.direction);
    translatedChunks.push(translated);
  }

  // Join chunks back together
  let result = translatedChunks.join('\n\n');

  // Restore base64 images
  if (imageMap.size > 0) {
    result = restoreBase64Images(result, imageMap);
  }

  return {
    translated: result,
    chunksProcessed: chunks.length,
  };
}
