/**
 * Export Service
 * Unified document export functionality.
 */

import { post } from './api.js';
import { downloadFile, downloadBase64, sanitizeFilename } from './download.js';

/**
 * Export formats configuration
 */
const EXPORT_FORMATS = {
  pdf: {
    label: 'PDF',
    loadingMessage: 'Generating PDF...',
    successMessage: 'PDF exported',
    mimeType: 'application/pdf',
    extension: '.pdf',
    pageNumbers: true,
    download: (data, filename) => downloadBase64(data.pdf, filename, 'application/pdf'),
  },
  html: {
    label: 'HTML',
    loadingMessage: 'Generating HTML...',
    successMessage: 'HTML exported',
    mimeType: 'text/html',
    extension: '.html',
    pageNumbers: false,
    download: (data, filename) => downloadFile(data.html, filename, 'text/html'),
  },
};

/**
 * Export document in the specified format
 * @param {Object} options
 * @param {string} options.format - 'pdf' or 'html'
 * @param {string} options.content - Markdown content
 * @param {string} options.title - Document title
 * @param {string} options.themeId - Theme ID
 * @param {boolean} options.generateToc - Generate table of contents
 * @param {boolean} options.pageNumbers - Include page numbers (PDF only)
 * @param {boolean} options.coverPage - Include cover page (PDF only)
 * @param {Object} options.coverPageOptions - Cover page options (subtitle, version, date)
 * @returns {Promise<Object>} Export result with success flag
 */
export async function exportDocument({ format, content, title, themeId, generateToc, pageNumbers, coverPage, coverPageOptions }) {
  const formatConfig = EXPORT_FORMATS[format];
  if (!formatConfig) {
    throw new Error(`Unknown export format: ${format}`);
  }

  if (!content?.trim()) {
    throw new Error('No content to export');
  }

  const result = await post('/api/convert', {
    source: 'markdown',
    content,
    options: {
      themeId,
      generateToc,
      pageNumbers: format === 'pdf' ? pageNumbers : false,
      coverPage: format === 'pdf' ? coverPage : false,
      coverPageOptions: format === 'pdf' ? coverPageOptions : undefined,
      title,
    },
  });

  if (!result.ok) {
    throw new Error(result.data?.error || 'Export failed');
  }

  const filename = sanitizeFilename(title || 'document') + formatConfig.extension;
  formatConfig.download(result.data, filename);

  return {
    success: true,
    filename,
    format,
    message: formatConfig.successMessage,
  };
}

/**
 * Get export configuration for a format
 */
export function getExportConfig(format) {
  return EXPORT_FORMATS[format];
}
