/**
 * LLM Enhancement
 * Markdown enhancement using LLM providers.
 */

import { TOKEN_LIMITS } from '../../config/constants.js';
import { buildEnhanceSystemPrompt, buildEnhanceUserPrompt, buildDetailedChangesPrompt } from '../../prompts/index.js';
import { callProvider } from './provider.js';
import { stripBase64Images, restoreBase64Images } from './images.js';
import type { LlmEnhanceRequest, LlmEnhanceResult, LlmChange, LlmProvider, UILanguage } from './types.js';

/**
 * Parse the LLM response to extract markdown and changes
 */
function parseResponse(response: string): LlmEnhanceResult {
  // Strip markdown code fences if present (LLMs often wrap JSON in ```json blocks)
  let cleanedResponse = response.trim();
  const codeBlockMatch = cleanedResponse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlockMatch?.[1]) {
    cleanedResponse = codeBlockMatch[1].trim();
  }

  try {
    // Try to extract JSON from the response
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const changes = Array.isArray(parsed.changes) ? parsed.changes : [];
      const detailedChanges = Array.isArray(parsed.detailedChanges) ? parsed.detailedChanges : [];
      return {
        enhanced: parsed.markdown || cleanedResponse,
        changes,
        // Fall back to changes if detailedChanges not provided
        detailedChanges: detailedChanges.length > 0 ? detailedChanges : changes,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        overallImpression: parsed.overallImpression || undefined,
        coverPage: parsed.coverPage || undefined,
      };
    }
  } catch {
    // If JSON parsing fails, return the response as-is (without code fences)
  }

  return {
    enhanced: cleanedResponse,
    changes: [{ description: 'Document was processed but change log could not be parsed' }],
    detailedChanges: [],
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
    language: request.language,
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

/**
 * Request for getting detailed changes
 */
export interface GetDetailedChangesRequest {
  markdown: string;
  changes: LlmChange[];
  provider: LlmProvider;
  language?: UILanguage;
}

/**
 * Get detailed (itemized) changes from summarized changes
 * Used when the initial enhance response didn't include detailedChanges
 */
export async function getDetailedChanges(request: GetDetailedChangesRequest): Promise<LlmChange[]> {
  const { systemPrompt, userPrompt } = buildDetailedChangesPrompt(
    request.markdown,
    request.changes,
    request.language
  );

  const response = await callProvider({
    provider: request.provider,
    systemPrompt,
    userContent: userPrompt,
    maxTokens: TOKEN_LIMITS.DETAILED_CHANGES_MAX_TOKENS,
  });

  // Parse the response
  let cleanedResponse = response.trim();
  const codeBlockMatch = cleanedResponse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlockMatch?.[1]) {
    cleanedResponse = codeBlockMatch[1].trim();
  }

  try {
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.detailedChanges)) {
        return parsed.detailedChanges;
      }
    }
  } catch {
    // If parsing fails, return original changes
  }

  return request.changes;
}
