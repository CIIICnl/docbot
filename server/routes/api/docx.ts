/**
 * DOCX API Routes
 * Handles Word document parsing and LLM enhancement
 */

import type { ApiContext } from './index.js';
import { json, ok, badRequest, serverError } from '../../utils/http.js';
import { parseDocx } from '../../services/docx.js';
import {
  enhanceMarkdown,
  translateMarkdown,
  getLlmStatus,
  type LlmProvider,
  type TranslationDirection,
} from '../../services/llm.js';

interface ParseDocxRequest {
  file: string; // base64 encoded
}

interface EnhanceRequest {
  markdown: string;
  provider: LlmProvider;
  globalContext?: string;
  documentContext?: string;
  fixTypos?: boolean;
}

interface TranslateRequest {
  markdown: string;
  provider: LlmProvider;
  direction: TranslationDirection;
}

/**
 * Handle DOCX-related routes
 */
export async function handleDocx(ctx: ApiContext): Promise<boolean> {
  const { req, res, url } = ctx;
  const path = url.pathname;

  // GET /api/llm/status - Check available LLM providers
  if (path === '/api/llm/status' && req.method === 'GET') {
    const status = getLlmStatus();
    ok(res, status);
    return true;
  }

  // POST /api/docx/parse - Parse a Word document
  if (path === '/api/docx/parse' && req.method === 'POST') {
    try {
      const body = await json<ParseDocxRequest>(req);

      if (!body.file) {
        badRequest(res, 'File data is required');
        return true;
      }

      // Decode base64 to buffer
      const buffer = Buffer.from(body.file, 'base64');

      // Parse the document
      const result = await parseDocx(buffer);

      ok(res, {
        markdown: result.markdown,
        title: result.title,
        images: result.images,
        warnings: result.warnings,
      });

      return true;
    } catch (error) {
      serverError(res, error as Error);
      return true;
    }
  }

  // POST /api/docx/enhance - Enhance markdown with LLM
  if (path === '/api/docx/enhance' && req.method === 'POST') {
    try {
      const body = await json<EnhanceRequest>(req);

      if (!body.markdown) {
        badRequest(res, 'Markdown content is required');
        return true;
      }

      if (!body.provider) {
        badRequest(res, 'LLM provider is required');
        return true;
      }

      // Check if provider is available
      const status = getLlmStatus();
      if (body.provider === 'claude' && !status.providers.claude) {
        badRequest(res, 'Claude API key is not configured');
        return true;
      }
      if (body.provider === 'mistral' && !status.providers.mistral) {
        badRequest(res, 'Mistral API key is not configured');
        return true;
      }

      // Enhance the markdown
      const result = await enhanceMarkdown({
        markdown: body.markdown,
        provider: body.provider,
        globalContext: body.globalContext,
        documentContext: body.documentContext,
        fixTypos: body.fixTypos,
      });

      ok(res, {
        enhanced: result.enhanced,
        changes: result.changes,
      });

      return true;
    } catch (error) {
      serverError(res, error as Error);
      return true;
    }
  }

  // POST /api/docx/translate - Translate markdown with LLM
  if (path === '/api/docx/translate' && req.method === 'POST') {
    try {
      const body = await json<TranslateRequest>(req);

      if (!body.markdown) {
        badRequest(res, 'Markdown content is required');
        return true;
      }

      if (!body.provider) {
        badRequest(res, 'LLM provider is required');
        return true;
      }

      if (!body.direction || !['nl-to-en', 'en-to-nl'].includes(body.direction)) {
        badRequest(res, 'Valid translation direction is required (nl-to-en or en-to-nl)');
        return true;
      }

      // Check if provider is available
      const status = getLlmStatus();
      if (body.provider === 'claude' && !status.providers.claude) {
        badRequest(res, 'Claude API key is not configured');
        return true;
      }
      if (body.provider === 'mistral' && !status.providers.mistral) {
        badRequest(res, 'Mistral API key is not configured');
        return true;
      }

      // Translate the markdown
      const result = await translateMarkdown({
        markdown: body.markdown,
        provider: body.provider,
        direction: body.direction,
      });

      ok(res, {
        translated: result.translated,
        chunksProcessed: result.chunksProcessed,
      });

      return true;
    } catch (error) {
      serverError(res, error as Error);
      return true;
    }
  }

  return false;
}
