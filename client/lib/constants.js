/**
 * Application Constants
 * Centralized storage keys, defaults, and configuration values.
 */

// LocalStorage keys
export const STORAGE_KEYS = {
  DRAFTS: 'dreamdocs_drafts',
  DEFAULT_PROVIDER: 'dreamdocs_default_provider',
  GLOBAL_CONTEXT: 'dreamdocs_global_context',
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
};
