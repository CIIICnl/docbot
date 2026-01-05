// Document template builder
// Combines theme styles, fonts, and content into a complete HTML document

import {
  getTheme,
  getThemeStyles,
  generateFontFaceRules,
  generateFontFaceUrlRules,
  generateColorVariables,
} from '../services/themes.js';
import { escapeHtml } from '../utils/html.js';

export interface DocumentOptions {
  title: string;
  content: string;
  toc?: string;
  themeId: string;
  showToc: boolean;
  /** Use URL-based fonts instead of base64 embedding (for preview) */
  useUrlFonts?: boolean;
}

/**
 * Build a complete HTML document ready for PDF generation
 */
export async function buildDocument(options: DocumentOptions): Promise<string> {
  const { title, content, toc, themeId, showToc, useUrlFonts } = options;

  // Load theme data
  const theme = await getTheme(themeId);
  const themeStyles = await getThemeStyles(themeId);
  // Use URL-based fonts for preview (much lighter), base64 for PDF export
  const fontFaceRules = useUrlFonts
    ? await generateFontFaceUrlRules(themeId)
    : await generateFontFaceRules(themeId);
  const colorVariables = theme ? generateColorVariables(theme) : '';

  // Build the document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    /* Reset */
    *, *::before, *::after {
      box-sizing: border-box;
    }

    html {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      padding: 0;
    }

    /* Font Face Rules */
    ${fontFaceRules}

    /* Color Variables */
    ${colorVariables}

    /* Theme Styles */
    ${themeStyles}

    /* Highlight.js base styles */
    .hljs {
      display: block;
      overflow-x: auto;
      padding: 1em;
      background: var(--doc-code-bg, #f5f5f5);
    }
  </style>
</head>
<body>
  <article class="document">
    ${showToc && toc ? toc : ''}
    ${content}
  </article>
</body>
</html>`;
}

/**
 * Build a preview document (lighter weight for live preview)
 */
export async function buildPreviewDocument(options: DocumentOptions): Promise<string> {
  // For preview, we use the same full document
  // Could be optimized later to skip some heavy processing
  return buildDocument(options);
}


/**
 * Get page settings from a theme
 */
export async function getPageSettings(themeId: string): Promise<{
  format: 'A4' | 'Letter';
  margins: { top: string; right: string; bottom: string; left: string };
}> {
  const theme = await getTheme(themeId);

  return {
    format: theme?.pageSettings?.format || 'A4',
    margins: theme?.pageSettings?.margins || {
      top: '2.5cm',
      right: '2cm',
      bottom: '2.5cm',
      left: '2cm',
    },
  };
}
