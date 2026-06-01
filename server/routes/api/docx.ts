/**
 * DOCX API Routes
 * Handles Word document parsing and LLM enhancement
 */

import type { ApiContext } from './index.js';
import { json, ok, badRequest, serverError, validateRequired } from '../../utils/http.js';
import { parseDocx } from '../../services/docx.js';
import { getMediaProvider, isMediaAvailable } from '../../media/index.js';
import { getDefaultOrganizationId } from '../../config/database.js';
import {
  enhanceMarkdown,
  getDetailedChanges,
  translateMarkdown,
  getLlmStatus,
  validateProvider,
  type LlmProvider,
  type LlmChange,
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
  fixStructure?: boolean;
  fixTypos?: boolean;
  improveReadability?: boolean;
  getSuggestions?: boolean;
  language?: 'en' | 'nl';
}

interface TranslateRequest {
  markdown: string;
  provider: LlmProvider;
  direction: TranslationDirection;
}

interface DetailedChangesRequest {
  markdown: string;
  changes: LlmChange[];
  provider: LlmProvider;
  language?: 'en' | 'nl';
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

      // Upload images to media storage and replace base64 URLs
      let markdown = result.markdown;
      const uploadedImages: Array<{ name: string; mediaUrl: string }> = [];
      // Surfaced back to the caller (and logged) so a silently-failing media
      // backend doesn't masquerade as a clean import. See the read-back note
      // below.
      const mediaWarnings: string[] = [];

      if (isMediaAvailable() && result.images.length > 0) {
        const provider = getMediaProvider();
        const orgId = getDefaultOrganizationId();

        for (const image of result.images) {
          const imageBuffer = Buffer.from(image.data, 'base64');
          const key = provider.generateKey(orgId, image.name);
          try {
            await provider.upload(key, imageBuffer, {
              contentType: image.mimeType,
            });

            // Read-back check: confirm the object is actually retrievable
            // before we rewrite the markdown to a docbot:// ref. An upload
            // that "succeeds" but doesn't persist (ephemeral container path
            // wiped on redeploy, or an S3 write that never landed) would
            // otherwise leave a dangling ref that renders as a blank image -
            // exactly the prod failure that prompted this hardening.
            const stored = await provider.exists(key);
            if (!stored) {
              throw new Error('upload reported success but object is not retrievable (read-back failed)');
            }

            const mediaUrl = `docbot://media/${key}`;
            uploadedImages.push({ name: image.name, mediaUrl });

            // Replace base64 data URL with media URL in markdown
            const base64Url = `data:${image.mimeType};base64,${image.data}`;
            markdown = markdown.split(base64Url).join(mediaUrl);
          } catch (uploadError) {
            const msg = uploadError instanceof Error ? uploadError.message : String(uploadError);
            // Loud, with the context needed to diagnose prod: which provider,
            // which key. Quiet console.warn was how this went unnoticed.
            console.error(
              `[docx] Media upload FAILED for "${image.name}" (provider=${provider.name}, key=${key}): ${msg}`
            );
            mediaWarnings.push(
              `Afbeelding "${image.name}" kon niet worden opgeslagen (provider: ${provider.name}): ${msg}. Ze is nu inline (base64) opgenomen.`
            );
            // Keep the base64 URL in the markdown so the image still renders.
          }
        }
      }

      ok(res, {
        markdown,
        title: result.title,
        images: uploadedImages.length > 0 ? uploadedImages : result.images,
        warnings: [...result.warnings, ...mediaWarnings],
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

      // Validate required fields
      const validation = validateRequired(body as unknown as Record<string, unknown>, {
        markdown: 'Markdown content is required',
        provider: 'LLM provider is required',
      });
      if (!validation.valid) {
        badRequest(res, validation.message);
        return true;
      }

      // Check if AI is disabled
      if (body.provider === 'none') {
        badRequest(res, 'AI enhancement is disabled. Select an AI provider in settings.');
        return true;
      }

      // Check if provider is available
      const providerError = validateProvider(body.provider);
      if (providerError) {
        badRequest(res, providerError);
        return true;
      }

      // Enhance the markdown
      const result = await enhanceMarkdown({
        markdown: body.markdown,
        provider: body.provider,
        globalContext: body.globalContext,
        documentContext: body.documentContext,
        fixStructure: body.fixStructure,
        fixTypos: body.fixTypos,
        improveReadability: body.improveReadability,
        getSuggestions: body.getSuggestions,
        language: body.language,
      });

      ok(res, {
        enhanced: result.enhanced,
        changes: result.changes,
        detailedChanges: result.detailedChanges,
        suggestions: result.suggestions,
        overallImpression: result.overallImpression,
        coverPage: result.coverPage,
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

      // Validate required fields
      const validation = validateRequired(body as unknown as Record<string, unknown>, {
        markdown: 'Markdown content is required',
        provider: 'LLM provider is required',
      });
      if (!validation.valid) {
        badRequest(res, validation.message);
        return true;
      }

      if (!body.direction || !['nl-to-en', 'en-to-nl'].includes(body.direction)) {
        badRequest(res, 'Valid translation direction is required (nl-to-en or en-to-nl)');
        return true;
      }

      // Check if AI is disabled
      if (body.provider === 'none') {
        badRequest(res, 'AI translation is disabled. Select an AI provider in settings.');
        return true;
      }

      // Check if provider is available
      const providerError = validateProvider(body.provider);
      if (providerError) {
        badRequest(res, providerError);
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

  // POST /api/docx/detailed-changes - Get itemized changes for export
  if (path === '/api/docx/detailed-changes' && req.method === 'POST') {
    try {
      const body = await json<DetailedChangesRequest>(req);

      // Validate required fields
      const validation = validateRequired(body as unknown as Record<string, unknown>, {
        markdown: 'Markdown content is required',
        changes: 'Changes array is required',
        provider: 'LLM provider is required',
      });
      if (!validation.valid) {
        badRequest(res, validation.message);
        return true;
      }

      // Check if AI is disabled
      if (body.provider === 'none') {
        badRequest(res, 'AI is disabled. Select an AI provider in settings.');
        return true;
      }

      // Check if provider is available
      const providerError = validateProvider(body.provider);
      if (providerError) {
        badRequest(res, providerError);
        return true;
      }

      // Get detailed changes
      const detailedChanges = await getDetailedChanges({
        markdown: body.markdown,
        changes: body.changes,
        provider: body.provider,
        language: body.language,
      });

      ok(res, { detailedChanges });

      return true;
    } catch (error) {
      serverError(res, error as Error);
      return true;
    }
  }

  return false;
}
