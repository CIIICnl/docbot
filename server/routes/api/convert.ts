/**
 * Conversion API Routes
 * Handles markdown/notion to PDF/HTML conversion
 */

import type { ApiContext } from './index.js';
import { json, ok, badRequest, serverError } from '../../utils/http.js';
import { parseMarkdown, generateTocHtml } from '../../services/markdown.js';
import { generatePdf, estimatePageCount } from '../../services/pdf.js';
import { buildDocument, getPageSettings } from '../../templates/document.js';
import { getDefaultThemeId, themeExists } from '../../services/themes.js';
import type { ConversionRequest, ConversionResult, ConversionMetadata } from '../../types/index.js';

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

      // Parse markdown
      const { html: contentHtml, toc, title: extractedTitle } = parseMarkdown(body.content);
      const title = options.title || extractedTitle || 'Document';
      const tocHtml = options.generateToc ? generateTocHtml(toc) : '';

      // Build document
      const documentHtml = await buildDocument({
        title,
        content: contentHtml,
        toc: tocHtml,
        themeId: options.themeId,
        showToc: options.generateToc,
      });

      // Get page settings from theme
      const pageSettings = await getPageSettings(options.themeId);

      // Generate PDF
      const pdfBuffer = await generatePdf({
        html: documentHtml,
        pageNumbers: options.pageNumbers,
        format: pageSettings.format,
        margins: pageSettings.margins,
      });

      // Build metadata
      const metadata: ConversionMetadata = {
        title,
        pageCount: estimatePageCount(pdfBuffer),
        generatedAt: new Date().toISOString(),
        themeId: options.themeId,
        tocEntries: toc.length,
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

      // Parse markdown
      const { html: contentHtml, toc, title: extractedTitle } = parseMarkdown(body.content);
      const title = options.title || extractedTitle || 'Document';
      const tocHtml = options.generateToc ? generateTocHtml(toc) : '';

      // Build document (preview version - uses URL fonts for speed)
      const documentHtml = await buildDocument({
        title,
        content: contentHtml,
        toc: tocHtml,
        themeId: options.themeId,
        showToc: options.generateToc,
        useUrlFonts: true,
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
