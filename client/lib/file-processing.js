/**
 * File Processing Service
 * Handles parsing of various document formats into markdown.
 */

import { post } from './api.js';
import { readFileAsText, readFileAsBase64, formatFileSize } from './file-upload.js';
import { FILES } from './constants.js';
import { t } from './i18n.js';

/**
 * @typedef {Object} ParseResult
 * @property {string} markdown - The parsed markdown content
 * @property {string} [title] - Extracted document title (if available)
 * @property {string[]} [warnings] - Any warnings during parsing
 */

/**
 * Check if a file is a Word document
 * @param {File} file
 * @returns {boolean}
 */
export function isWordDocument(file) {
  return file.name.toLowerCase().endsWith('.docx');
}

/**
 * Check if a file is a text-based document (markdown, txt)
 * @param {File} file
 * @returns {boolean}
 */
export function isTextDocument(file) {
  const name = file.name.toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
}

/**
 * Parse a Word document (.docx) to markdown
 * @param {File} file - The .docx file to parse
 * @returns {Promise<ParseResult>}
 */
export async function parseWordDocument(file) {
  if (file.size > FILES.MAX_UPLOAD_BYTES) {
    throw new Error(t('common.fileTooLarge', {
      size: formatFileSize(file.size),
      max: formatFileSize(FILES.MAX_UPLOAD_BYTES),
    }));
  }

  const base64 = await readFileAsBase64(file);

  // filename is sent purely so the server can log which document a given
  // parse (or failure) belonged to - the payload is otherwise just base64.
  const result = await post(
    '/api/docx/parse',
    { file: base64, filename: file.name },
    { timeoutMs: FILES.UPLOAD_TIMEOUT_MS }
  );

  if (!result.ok) {
    if (result.timedOut) {
      throw new Error(t('common.uploadTimeout'));
    }
    throw new Error(result.data?.error || 'Failed to parse Word document');
  }

  return {
    markdown: result.data.markdown,
    title: result.data.title || file.name.replace(/\.docx$/i, ''),
    warnings: result.data.warnings || [],
    detectedLanguage: result.data.detectedLanguage ?? null,
  };
}

/**
 * Parse a text document (markdown, txt) to markdown
 * @param {File} file - The text file to parse
 * @returns {Promise<ParseResult>}
 */
export async function parseTextDocument(file) {
  const markdown = await readFileAsText(file);
  const title = file.name.replace(/\.(md|markdown|txt)$/i, '');

  return {
    markdown,
    title,
    warnings: [],
  };
}

/**
 * Parse any supported document file to markdown
 * Automatically detects file type and uses appropriate parser.
 * @param {File} file - The file to parse
 * @returns {Promise<ParseResult>}
 */
export async function parseDocumentFile(file) {
  if (isWordDocument(file)) {
    return parseWordDocument(file);
  }

  if (isTextDocument(file)) {
    return parseTextDocument(file);
  }

  throw new Error(t('common.unsupportedFormat', { name: file.name }));
}

/**
 * Get a clean title from a filename (strips extension)
 * @param {string} filename
 * @returns {string}
 */
export function getTitleFromFilename(filename) {
  return filename.replace(/\.(md|markdown|txt|docx)$/i, '');
}
