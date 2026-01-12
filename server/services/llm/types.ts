/**
 * LLM Types
 * Type definitions for LLM service interfaces.
 */

export type LlmProvider = 'none' | 'openai' | 'claude' | 'mistral';

export type ChangeCategory = 'structure' | 'typo' | 'readability' | 'other';

export interface LlmChange {
  description: string;
  location?: string;
  category?: ChangeCategory;
}

export interface LlmSuggestion {
  text: string;
  location?: string;
}

export type UILanguage = 'en' | 'nl';

export interface LlmEnhanceRequest {
  markdown: string;
  provider: LlmProvider;
  globalContext?: string;
  documentContext?: string;
  fixStructure?: boolean;
  fixTypos?: boolean;
  improveReadability?: boolean;
  getSuggestions?: boolean;
  language?: UILanguage;
}

export interface CoverPageMetadata {
  subtitle?: string;
  version?: string;
  date?: string;
}

export interface LlmEnhanceResult {
  enhanced: string;
  changes: LlmChange[];
  suggestions: LlmSuggestion[];
  coverPage?: CoverPageMetadata;
}

export interface LlmStatus {
  providers: {
    none: boolean;
    openai: boolean;
    claude: boolean;
    mistral: boolean;
  };
}

export type TranslationDirection = 'nl-to-en' | 'en-to-nl';

export interface LlmTranslateRequest {
  markdown: string;
  provider: LlmProvider;
  direction: TranslationDirection;
}

export interface LlmTranslateResult {
  translated: string;
  chunksProcessed: number;
}

export interface ProviderMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ProviderRequest {
  provider: LlmProvider;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
}
