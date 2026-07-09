/**
 * Application Constants
 * Centralized storage keys, defaults, and configuration values.
 */

// LocalStorage keys
export const STORAGE_KEYS = {
  DRAFTS: 'dreamdocs_drafts',
  DEFAULT_PROVIDER: 'dreamdocs_default_provider',
  GLOBAL_CONTEXT: 'dreamdocs_global_context',
  LANGUAGE: 'dreamdocs_language',
};

// Default values
export const DEFAULTS = {
  PROVIDER: 'claude',
  THEME: 'default',
  MAX_DRAFTS: 20,
};

// UI placeholders
export const PLACEHOLDERS = {
  MARKDOWN_EDITOR: 'Paste or type your markdown here...\n\nOr use Upload to load a .md or .docx file.',
  NOTION_URL: 'https://notion.so/...',
  DOCUMENT_TITLE: 'Document title...',
  GLOBAL_CONTEXT: `Enter organization style preferences and general instructions for AI enhancement...

Examples:
- Use sentence case for headings
- Keep paragraphs concise
- Use bullet points for lists of 3+ items`,
};

// Search configuration
export const SEARCH = {
  MIN_LENGTH: 2,
  DEFAULT_LINE_HEIGHT: 20,
};

// File handling
export const FILES = {
  SUPPORTED_TEXT_FORMATS: ['.md', '.markdown', '.txt'],
  SUPPORTED_BINARY_FORMATS: ['.docx'],
  // Keep in sync with MAX_JSON_BODY_BYTES on the server (base64 adds ~33%).
  MAX_UPLOAD_BYTES: 50 * 1024 * 1024,
  // Upper bound on a docx upload+parse round-trip. Without this the fetch has
  // no timeout, so a slow parse or a stalled proxy connection leaves the UI
  // spinning forever with no error (the "bleef hangen" report).
  UPLOAD_TIMEOUT_MS: 120 * 1000,
};
