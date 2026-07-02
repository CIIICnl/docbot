/**
 * Server Constants
 * Centralized configuration values for the server.
 */

// Theme configuration
export const THEMES = {
  DIRECTORY: 'themes',
  DEFAULT_ID: 'ciiic',
};

// LLM model identifiers
export const LLM_MODELS = {
  OPENAI: 'gpt-5.2',
  CLAUDE: 'claude-opus-4-7',
  MISTRAL: 'mistral-large-latest',
};

// LLM API endpoints
export const LLM_ENDPOINTS = {
  OPENAI: 'https://api.openai.com/v1/chat/completions',
  MISTRAL: 'https://api.mistral.ai/v1/chat/completions',
};

// Token limits
export const TOKEN_LIMITS = {
  ENHANCE_MAX_TOKENS: 32768,
  DETAILED_CHANGES_MAX_TOKENS: 16384,
  TRANSLATE_MAX_TOKENS: 4096,
  CHUNK_SIZE: 3000,
};

// Request/content size limits
export const LIMITS = {
  // Covers a 50MB client upload (FILES.MAX_UPLOAD_BYTES) after ~33% base64
  // inflation plus JSON overhead.
  MAX_JSON_BODY_BYTES: 80 * 1024 * 1024,
  // Enhancement asks the model to return the ENTIRE rewritten document
  // inside ENHANCE_MAX_TOKENS of output. Beyond roughly this many input
  // characters (base64 images excluded) the output gets truncated
  // mid-JSON, so reject early with a clear message instead.
  ENHANCE_MAX_INPUT_CHARS: 100_000,
};

// Default page settings
export const PAGE_DEFAULTS = {
  FORMAT: 'A4' as const,
  MARGINS: {
    top: '2.5cm',
    right: '2cm',
    bottom: '2.5cm',
    left: '2cm',
  },
};

// Notion API settings
export const NOTION = {
  PAGE_SIZE: 100,
  CALLOUT_EMOJI: '💡',
};

// Markdown patterns
export const MARKDOWN = {
  TABLE_SEPARATOR: '---',
  HORIZONTAL_RULE: '---',
};

// Image handling
export const IMAGES = {
  BASE64_REGEX: /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g,
};
