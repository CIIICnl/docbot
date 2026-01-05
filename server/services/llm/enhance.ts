/**
 * LLM Enhancement
 * Markdown enhancement using LLM providers.
 */

import { TOKEN_LIMITS } from '../../config/constants.js';
import { buildEnhanceSystemPrompt, buildEnhanceUserPrompt } from '../../prompts/index.js';
import { callProvider } from './provider.js';
import { stripBase64Images, restoreBase64Images } from './images.js';
import type { LlmEnhanceRequest, LlmEnhanceResult } from './types.js';

/**
 * Parse the LLM response to extract markdown and changes
 */
function parseResponse(response: string): LlmEnhanceResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        enhanced: parsed.markdown || response,
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    }
  } catch {
    // If JSON parsing fails, return the response as-is
  }

  return {
    enhanced: response,
    changes: [{ description: 'Document was processed but change log could not be parsed' }],
    suggestions: [],
  };
}

/**
 * Enhance markdown using the specified LLM provider
 */
export async function enhanceMarkdown(request: LlmEnhanceRequest): Promise<LlmEnhanceResult> {
  // Strip base64 images to reduce token count
  const { cleaned, imageMap } = stripBase64Images(request.markdown);

  const systemPrompt = buildEnhanceSystemPrompt({
    fixStructure: request.fixStructure,
    fixTypos: request.fixTypos,
    improveReadability: request.improveReadability,
    getSuggestions: request.getSuggestions,
    globalContext: request.globalContext,
  });

  const userContent = buildEnhanceUserPrompt(cleaned, request.documentContext);

  const response = await callProvider({
    provider: request.provider,
    systemPrompt,
    userContent,
    maxTokens: TOKEN_LIMITS.ENHANCE_MAX_TOKENS,
  });

  const result = parseResponse(response);

  // Restore base64 images in the enhanced markdown
  if (imageMap.size > 0) {
    result.enhanced = restoreBase64Images(result.enhanced, imageMap);
  }

  return result;
}
