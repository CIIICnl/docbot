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
import type { CoverPageOptions, Theme } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DocumentOptions {
  title: string;
  content: string;
  toc?: string;
  themeId: string;
  showToc: boolean;
  /** Use URL-based fonts instead of base64 embedding (for preview) */
  useUrlFonts?: boolean;
  /** Include a cover page */
  coverPage?: boolean;
  /** Cover page options */
  coverPageOptions?: CoverPageOptions;
}

/**
 * Format date for display with locale support
 * If a date string is provided, it's returned as-is (preserving user's format)
 * If no date is provided, generates today's date in the specified locale
 */
function formatDate(dateStr?: string, locale: 'en' | 'nl' = 'en'): string {
  // If user provided a date string, use it exactly as-is
  if (dateStr) {
    return dateStr;
  }

  // Generate today's date in the appropriate locale format
  const date = new Date();

  if (locale === 'nl') {
    const day = date.getDate();
    const month = date.toLocaleDateString('nl-NL', { month: 'long' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Load logo as base64 data URL for embedding in HTML
 */
async function loadLogoDataUrl(themeId: string): Promise<string | null> {
  const themePath = path.join(process.cwd(), 'themes', themeId, 'images');

  // Try SVG first
  try {
    const svgPath = path.join(themePath, 'logo.svg');
    const svgContent = await fs.readFile(svgPath, 'utf-8');
    const base64 = Buffer.from(svgContent).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    // Try PNG
    try {
      const pngPath = path.join(themePath, 'logo.png');
      const pngContent = await fs.readFile(pngPath);
      return `data:image/png;base64,${pngContent.toString('base64')}`;
    } catch {
      return null;
    }
  }
}

/**
 * Generate HTML for the cover page
 */
async function generateCoverPageHtml(
  title: string,
  theme: Theme | null,
  themeId: string,
  coverPageOptions?: CoverPageOptions
): Promise<string> {
  const bgColor = theme?.colors?.accent || '#dbff00';
  const textColor = theme?.colors?.heading || '#141414';
  const headingFont = theme?.fonts?.heading?.family || 'Inter, sans-serif';
  const bodyFont = theme?.fonts?.body?.family || 'Inter, sans-serif';

  const version = coverPageOptions?.version || 'v1.0';
  const locale = coverPageOptions?.locale || 'en';
  const dateStr = formatDate(coverPageOptions?.date, locale);
  const subtitle = coverPageOptions?.subtitle || '';

  const logoDataUrl = await loadLogoDataUrl(themeId);

  return `
    <div class="cover-page" style="
      page-break-after: always;
      width: 100%;
      height: 100vh;
      background: ${bgColor};
      color: ${textColor};
      position: relative;
      padding: 60px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    ">
      <!-- Title and subtitle -->
      <div style="flex: 1;">
        <h1 style="
          font-family: ${headingFont};
          font-size: 32pt;
          font-weight: 500;
          margin: 0 0 8px 0;
          line-height: 1.15;
          max-width: calc(100% - 40px);
        ">${escapeHtml(title)}</h1>
        ${subtitle ? `
          <p style="
            font-family: ${bodyFont};
            font-size: 16pt;
            font-weight: 400;
            margin: 0;
            line-height: 1.4;
          ">${escapeHtml(subtitle)}</p>
        ` : ''}
      </div>

      <!-- Version and date (vertical text, top right) -->
      <div style="
        position: absolute;
        top: 60px;
        right: 40px;
        font-family: ${bodyFont};
        font-size: 16pt;
        font-weight: 400;
        writing-mode: vertical-rl;
        white-space: nowrap;
      ">${escapeHtml(version)}  |  ${escapeHtml(dateStr)}</div>

      <!-- Logo (bottom) -->
      ${logoDataUrl ? `
        <div style="margin-top: auto;">
          <img src="${logoDataUrl}" alt="" style="
            width: 100%;
            height: auto;
            display: block;
          " />
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Build a complete HTML document ready for PDF generation
 */
export async function buildDocument(options: DocumentOptions): Promise<string> {
  const { title, content, toc, themeId, showToc, useUrlFonts, coverPage, coverPageOptions } = options;

  // Load theme data
  const theme = await getTheme(themeId);
  const themeStyles = await getThemeStyles(themeId);
  // Use URL-based fonts for preview (much lighter), base64 for PDF export
  const fontFaceRules = useUrlFonts
    ? await generateFontFaceUrlRules(themeId)
    : await generateFontFaceRules(themeId);
  const colorVariables = theme ? generateColorVariables(theme) : '';

  // Generate cover page HTML if requested
  const coverPageHtml = coverPage
    ? await generateCoverPageHtml(title, theme, themeId, coverPageOptions)
    : '';

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

    /* Cover page styles */
    .cover-page {
      page: cover;
    }

    @page cover {
      margin: 0;
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
  ${coverPageHtml}
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
