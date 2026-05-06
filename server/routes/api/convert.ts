/**
 * Conversion API Routes
 * Handles markdown/notion to PDF/HTML conversion
 */

import type { ApiContext } from './index.js';
import { json, ok, badRequest, serverError } from '../../utils/http.js';
import {
  parseMarkdown,
  generateTocHtml,
  resolveMediaUrls,
  optimizeImageKitUrls,
} from '../../services/markdown.js';
import { generatePdf, estimatePageCount } from '../../services/pdf.js';
import { buildDocument, getPageSettings } from '../../templates/document.js';
import { getDefaultThemeId, themeExists } from '../../services/themes.js';
import type { ConversionRequest, ConversionResult, ConversionMetadata } from '../../types/index.js';

/**
 * Remove the first H1 from markdown content (for cover page)
 * This prevents the title from appearing twice when a cover page is used
 */
function stripFirstH1(markdown: string): string {
  // Match first H1 (# at start of line, not ##)
  // Also handles H1 with leading whitespace on the line
  const h1Regex = /^(\s*#\s+[^\n]+\n?)/m;
  return markdown.replace(h1Regex, '');
}

/**
 * Handle conversion routes
 */
export async function handleConvert(ctx: ApiContext): Promise<boolean> {
  const { req, res, url } = ctx;
  const path = url.pathname;

  // POST /api/convert - Full conversion to PDF + HTML
  if (path === '/api/convert' && req.method === 'POST') {
    try {
      const body = await json<ConversionRequest>(req);

      // Validate request
      if (!body.content) {
        badRequest(res, 'Content is required');
        return true;
      }

      const options = body.options || {
        themeId: getDefaultThemeId(),
        generateToc: true,
        pageNumbers: true,
      };

      // Validate theme
      if (options.themeId && !(await themeExists(options.themeId))) {
        options.themeId = getDefaultThemeId();
      }

      // Resolve docbot:// media URLs to base64 for PDF embedding, then
      // cap ImageKit source images so headless Chromium doesn't rasterise
      // multi-megapixel originals into the printed PDF (see comment on
      // optimizeImageKitUrls in services/markdown.ts).
      const resolvedRaw = await resolveMediaUrls(body.content, { asBase64: true });
      const resolvedContent = optimizeImageKitUrls(resolvedRaw);

      // If cover page is enabled, strip the first H1 from content to avoid duplication
      const contentToProcess = options.coverPage ? stripFirstH1(resolvedContent) : resolvedContent;

      // Resolve heading-break flags. Per-level flags win; the legacy
      // `pageBreakHeadings` boolean fills in for both when set, so older
      // callers (dashboard.ciiic.nl) keep working unchanged.
      const breakH1 = options.pageBreakBeforeH1 ?? options.pageBreakHeadings ?? false;
      const breakH2 = options.pageBreakBeforeH2 ?? options.pageBreakHeadings ?? false;
      const tocLevels = options.tocLevels ?? [2, 3];

      // Parse markdown (use original content to extract title, processed content for body)
      const { title: extractedTitle, accessibilityWarnings } = parseMarkdown(resolvedContent, tocLevels);
      const { html: contentHtml, toc } = parseMarkdown(contentToProcess, tocLevels);
      const title = options.title || extractedTitle || 'Document';
      const locale = options.locale || options.coverPageOptions?.locale || 'en';
      const tocHtml = options.generateToc ? generateTocHtml(toc, locale) : '';

      // Build document (includes cover page if requested)
      const documentHtml = await buildDocument({
        title,
        content: contentHtml,
        toc: tocHtml,
        themeId: options.themeId,
        showToc: options.generateToc,
        coverPage: options.coverPage,
        coverPageOptions: options.coverPageOptions,
        locale,
        pageBreakBeforeH1: breakH1,
        pageBreakBeforeH2: breakH2,
      });

      // Get page settings from theme
      const pageSettings = await getPageSettings(options.themeId);

      // Generate PDF (cover page is now part of the HTML, so ToC links work correctly)
      const pdfBuffer = await generatePdf({
        html: documentHtml,
        pageNumbers: options.pageNumbers,
        format: pageSettings.format,
        margins: pageSettings.margins,
        metadata: {
          title,
          language: locale === 'nl' ? 'nl-NL' : 'en-US',
          creator: 'DreamDocs',
        },
      });

      // Build metadata
      const metadata: ConversionMetadata = {
        title,
        pageCount: estimatePageCount(pdfBuffer),
        generatedAt: new Date().toISOString(),
        themeId: options.themeId,
        tocEntries: toc.length,
        accessibilityWarnings: accessibilityWarnings?.length ? accessibilityWarnings : undefined,
      };

      // Return result
      const result: ConversionResult = {
        pdf: pdfBuffer.toString('base64'),
        html: documentHtml,
        metadata,
      };

      ok(res, result);
      return true;
    } catch (error) {
      serverError(res, error as Error);
      return true;
    }
  }

  // POST /api/convert/preview - HTML preview only (faster)
  if (path === '/api/convert/preview' && req.method === 'POST') {
    try {
      const body = await json<ConversionRequest>(req);

      if (!body.content) {
        badRequest(res, 'Content is required');
        return true;
      }

      const options = body.options || {
        themeId: getDefaultThemeId(),
        generateToc: true,
        pageNumbers: false,
      };

      // Validate theme
      if (options.themeId && !(await themeExists(options.themeId))) {
        options.themeId = getDefaultThemeId();
      }

      // Resolve docbot:// media URLs to presigned URLs for preview
      const resolvedContent = await resolveMediaUrls(body.content, { asBase64: false });

      const tocLevels = options.tocLevels ?? [2, 3];

      // Parse markdown
      const { html: contentHtml, toc, title: extractedTitle } = parseMarkdown(resolvedContent, tocLevels);
      const title = options.title || extractedTitle || 'Document';
      const locale = options.locale || options.coverPageOptions?.locale || 'en';
      const tocHtml = options.generateToc ? generateTocHtml(toc, locale) : '';

      // Build document (preview version - uses URL fonts for speed)
      const documentHtml = await buildDocument({
        title,
        content: contentHtml,
        toc: tocHtml,
        themeId: options.themeId,
        showToc: options.generateToc,
        useUrlFonts: true,
        locale,
      });

      ok(res, { html: documentHtml, title });
      return true;
    } catch (error) {
      serverError(res, error as Error);
      return true;
    }
  }

  return false;
}
