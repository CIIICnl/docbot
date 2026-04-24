/**
 * LLM Service
 * Re-exports from modular LLM implementation.
 */

export {
  // Types
  type LlmProvider,
  type ChangeCategory,
  type LlmChange,
  type LlmSuggestion,
  type LlmEnhanceRequest,
  type LlmEnhanceResult,
  type LlmStatus,
  type TranslationDirection,
  type LlmTranslateRequest,
  type LlmTranslateResult,
  // Functions
  getLlmStatus,
  validateProvider,
  enhanceMarkdown,
  getDetailedChanges,
  translateMarkdown,
  // Request types
  type GetDetailedChangesRequest,
} from './llm/index.js';
