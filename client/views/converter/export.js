/**
 * Export Module
 * PDF and HTML export functionality.
 */

import { post } from '../../lib/api.js';
import { success, error, warning } from '../../lib/toast.js';
import { showLoading } from '../../lib/loading.js';
import { downloadFile, downloadBase64, sanitizeFilename } from '../../lib/download.js';

/**
 * Export content to PDF
 * @param {Object} options
 * @param {string} options.content - Markdown content
 * @param {string} options.title - Document title
 * @param {string} options.themeId - Theme ID
 * @param {boolean} options.generateToc - Generate table of contents
 * @param {boolean} options.pageNumbers - Include page numbers
 */
export async function exportToPdf({ content, title, themeId, generateToc, pageNumbers }) {
  if (!content.trim()) {
    warning('No content to export');
    return;
  }

  const hide = showLoading('Generating PDF...');

  try {
    const result = await post('/api/convert', {
      source: 'markdown',
      content,
      options: {
        themeId,
        generateToc,
        pageNumbers,
        title,
      },
    });

    if (!result.ok) {
      throw new Error(result.data?.error || 'Export failed');
    }

    const filename = sanitizeFilename(title || 'document') + '.pdf';
    downloadBase64(result.data.pdf, filename, 'application/pdf');
    success('PDF exported');
  } catch (err) {
    error(`Export failed: ${err.message}`);
  } finally {
    hide();
  }
}

/**
 * Export content to HTML
 * @param {Object} options
 * @param {string} options.content - Markdown content
 * @param {string} options.title - Document title
 * @param {string} options.themeId - Theme ID
 * @param {boolean} options.generateToc - Generate table of contents
 */
export async function exportToHtml({ content, title, themeId, generateToc }) {
  if (!content.trim()) {
    warning('No content to export');
    return;
  }

  const hide = showLoading('Generating HTML...');

  try {
    const result = await post('/api/convert', {
      source: 'markdown',
      content,
      options: {
        themeId,
        generateToc,
        pageNumbers: false,
        title,
      },
    });

    if (!result.ok) {
      throw new Error(result.data?.error || 'Export failed');
    }

    const filename = sanitizeFilename(title || 'document') + '.html';
    downloadFile(result.data.html, filename, 'text/html');
    success('HTML exported');
  } catch (err) {
    error(`Export failed: ${err.message}`);
  } finally {
    hide();
}
}

/**
 * Generate a preview of the content
 * @param {Object} options
 * @param {string} options.content - Markdown content
 * @param {string} options.title - Document title
 * @param {string} options.themeId - Theme ID
 * @param {boolean} options.generateToc - Generate table of contents
 * @returns {Promise<string|null>} HTML content or null on failure
 */
export async function generatePreview({ content, title, themeId, generateToc }) {
  if (!content.trim()) {
    return null;
  }

  try {
    const result = await post('/api/convert/preview', {
      source: 'markdown',
      content,
      options: {
        themeId,
        generateToc,
        pageNumbers: false,
        title,
      },
    });

    if (result.ok && result.data.html) {
      return result.data.html;
    }
    return null;
  } catch {
    return null;
  }
}
