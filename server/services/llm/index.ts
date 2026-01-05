/**
 * LLM Service
 * Unified interface for LLM operations.
 */

// Re-export types
export type {
  LlmProvider,
  ChangeCategory,
  LlmChange,
  LlmSuggestion,
  LlmEnhanceRequest,
  LlmEnhanceResult,
  LlmStatus,
  TranslationDirection,
  LlmTranslateRequest,
  LlmTranslateResult,
} from './types.js';

// Re-export provider utilities
export { getAvailableProviders, isProviderAvailable, validateProvider } from './provider.js';

// Re-export enhancement
export { enhanceMarkdown } from './enhance.js';

// Re-export translation
export { translateMarkdown } from './translate.js';

// Convenience function for status check
import { getAvailableProviders } from './provider.js';
import type { LlmStatus } from './types.js';

export function getLlmStatus(): LlmStatus {
  return {
    providers: getAvailableProviders(),
  };
}
