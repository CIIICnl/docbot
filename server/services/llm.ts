/**
 * LLM Service
 * Unified interface for Claude and Mistral API calls
 */

import Anthropic from '@anthropic-ai/sdk';

export type LlmProvider = 'claude' | 'mistral';

export interface LlmChange {
  description: string;
  location?: string;
}

export interface LlmEnhanceRequest {
  markdown: string;
  provider: LlmProvider;
  globalContext?: string;
  documentContext?: string;
  fixTypos?: boolean;
}

export interface LlmEnhanceResult {
  enhanced: string;
  changes: LlmChange[];
}

export interface LlmStatus {
  providers: {
    claude: boolean;
    mistral: boolean;
  };
}

export type TranslationDirection = 'nl-to-en' | 'en-to-nl';

export interface LlmTranslateRequest {
  markdown: string;
  provider: LlmProvider;
  direction: TranslationDirection;
}

export interface LlmTranslateResult {
  translated: string;
  chunksProcessed: number;
}

/**
 * Check which LLM providers are available
 */
export function getLlmStatus(): LlmStatus {
  return {
    providers: {
      claude: !!process.env.ANTHROPIC_API_KEY,
      mistral: !!process.env.MISTRAL_API_KEY,
    },
  };
}

/**
 * Build the system prompt for markdown enhancement
 */
function buildSystemPrompt(globalContext?: string, fixTypos?: boolean): string {
  let prompt = `You are a document formatting expert. Your task is to improve the markdown formatting of a document that was automatically converted from a Word document.

Common issues to fix:
- Bold text that should be headings (e.g., a bold line that acts as a section title should be converted to ## or ###)
- Inconsistent heading levels (ensure proper hierarchy: H1 > H2 > H3)
- Manual numbering that should be ordered lists (e.g., "1. item" typed manually instead of using list syntax)
- Improper list formatting (tabs or spaces used instead of proper markdown list syntax)
- Missing blank lines between sections
- Tables formatted with spaces/tabs instead of proper markdown table syntax
- Excessive whitespace or line breaks`;

  if (fixTypos) {
    prompt += `

Also fix small text corrections:
- Double spaces (replace with single space)
- Obvious spelling errors (only if you are confident it's an error, not a proper noun or technical term)
- Missing spaces after punctuation
- Repeated words (e.g., "the the")
Do NOT change words if you're unsure - only fix clear typos.`;
  }

  prompt += `

Preserve:
- All content and meaning
- Links and their destinations
- Image references (![...](...)) - especially any with __IMAGE_PLACEHOLDER_N__ URLs, keep these exactly as-is
- Code blocks
- Actual intentional bold/italic formatting

Output format:
Return a JSON object with two fields:
1. "markdown": The improved markdown content
2. "changes": An array of objects describing each change made, each with:
   - "description": What was changed
   - "location": Optional hint about where in the document (e.g., "near the beginning", "in the Introduction section")

Only include substantive formatting changes in the changes array, not minor whitespace adjustments.`;

  if (globalContext) {
    prompt += `\n\nAdditional context about the organization's style preferences:\n${globalContext}`;
  }

  return prompt;
}

/**
 * Strip base64 images from markdown and replace with placeholders
 * Returns the cleaned markdown and a map to restore images later
 */
function stripBase64Images(markdown: string): { cleaned: string; imageMap: Map<string, string> } {
  const imageMap = new Map<string, string>();
  let counter = 0;

  // Match markdown images with base64 data URLs
  // Pattern: ![alt](data:image/...;base64,...)
  const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g;

  const cleaned = markdown.replace(base64ImageRegex, (_match, alt, dataUrl) => {
    const placeholder = `__IMAGE_PLACEHOLDER_${counter}__`;
    imageMap.set(placeholder, dataUrl);
    counter++;
    return `![${alt}](${placeholder})`;
  });

  return { cleaned, imageMap };
}

/**
 * Restore base64 images in markdown from placeholders
 */
function restoreBase64Images(markdown: string, imageMap: Map<string, string>): string {
  let result = markdown;

  for (const [placeholder, dataUrl] of imageMap) {
    // Escape special regex characters in placeholder
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedPlaceholder}\\)`, 'g');
    result = result.replace(regex, `![$1](${dataUrl})`);
  }

  return result;
}

/**
 * Build the user prompt for a specific document
 */
function buildUserPrompt(markdown: string, documentContext?: string): string {
  let prompt = '';

  if (documentContext) {
    prompt += `Document-specific instructions:\n${documentContext}\n\n`;
  }

  prompt += `Please improve the formatting of this markdown document:\n\n${markdown}`;

  return prompt;
}

/**
 * Parse the LLM response to extract markdown and changes
 */
function parseResponse(response: string): LlmEnhanceResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        enhanced: parsed.markdown || response,
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      };
    }
  } catch {
    // If JSON parsing fails, return the response as-is
  }

  return {
    enhanced: response,
    changes: [{ description: 'Document was processed but change log could not be parsed' }],
  };
}

/**
 * Enhance markdown using Claude
 */
async function enhanceWithClaude(request: LlmEnhanceRequest): Promise<LlmEnhanceResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(request.markdown, request.documentContext),
      },
    ],
    system: buildSystemPrompt(request.globalContext, request.fixTypos),
  });

  // Extract text from response
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseResponse(textContent.text);
}

/**
 * Enhance markdown using Mistral
 */
async function enhanceWithMistral(request: LlmEnhanceRequest): Promise<LlmEnhanceResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured');
  }

  // Use Mistral's API directly via fetch
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(request.globalContext, request.fixTypos),
        },
        {
          role: 'user',
          content: buildUserPrompt(request.markdown, request.documentContext),
        },
      ],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from Mistral');
  }

  return parseResponse(content);
}

/**
 * Enhance markdown using the specified LLM provider
 */
export async function enhanceMarkdown(request: LlmEnhanceRequest): Promise<LlmEnhanceResult> {
  // Strip base64 images to reduce token count
  const { cleaned, imageMap } = stripBase64Images(request.markdown);

  // Create a modified request with cleaned markdown
  const cleanedRequest = {
    ...request,
    markdown: cleaned,
  };

  let result: LlmEnhanceResult;

  switch (request.provider) {
    case 'claude':
      result = await enhanceWithClaude(cleanedRequest);
      break;
    case 'mistral':
      result = await enhanceWithMistral(cleanedRequest);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${request.provider}`);
  }

  // Restore base64 images in the enhanced markdown
  if (imageMap.size > 0) {
    result.enhanced = restoreBase64Images(result.enhanced, imageMap);
  }

  return result;
}

/**
 * Split markdown into chunks for translation
 * Preserves structure by splitting on section boundaries
 */
function splitIntoChunks(markdown: string, maxChunkSize: number = 3000): string[] {
  const chunks: string[] = [];

  // Split by double newlines (paragraphs/sections)
  const sections = markdown.split(/\n\n+/);
  let currentChunk = '';

  for (const section of sections) {
    // If adding this section would exceed the limit, save current chunk
    if (currentChunk && (currentChunk.length + section.length + 2) > maxChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = section;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Build the system prompt for translation
 */
function buildTranslationSystemPrompt(direction: TranslationDirection): string {
  const [sourceLang, targetLang] = direction === 'nl-to-en'
    ? ['Dutch', 'English']
    : ['English', 'Dutch'];

  return `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.

Rules:
- Preserve ALL markdown formatting exactly (headings, lists, links, bold, italic, code blocks, etc.)
- Preserve image references ![...](...) exactly as-is
- Preserve code blocks and inline code exactly as-is (do not translate code)
- Maintain the same paragraph structure
- Translate naturally, not word-for-word
- Keep proper nouns and brand names unchanged unless they have standard translations
- Output ONLY the translated text, no explanations or comments`;
}

/**
 * Translate a single chunk using Claude
 */
async function translateChunkWithClaude(
  chunk: string,
  direction: TranslationDirection
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: chunk,
      },
    ],
    system: buildTranslationSystemPrompt(direction),
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textContent.text;
}

/**
 * Translate a single chunk using Mistral
 */
async function translateChunkWithMistral(
  chunk: string,
  direction: TranslationDirection
): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured');
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'system',
          content: buildTranslationSystemPrompt(direction),
        },
        {
          role: 'user',
          content: chunk,
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from Mistral');
  }

  return content;
}

/**
 * Translate markdown content in chunks
 */
export async function translateMarkdown(request: LlmTranslateRequest): Promise<LlmTranslateResult> {
  // Strip base64 images to reduce token count
  const { cleaned, imageMap } = stripBase64Images(request.markdown);

  // Split into chunks
  const chunks = splitIntoChunks(cleaned);
  const translatedChunks: string[] = [];

  // Translate each chunk
  for (const chunk of chunks) {
    let translated: string;

    switch (request.provider) {
      case 'claude':
        translated = await translateChunkWithClaude(chunk, request.direction);
        break;
      case 'mistral':
        translated = await translateChunkWithMistral(chunk, request.direction);
        break;
      default:
        throw new Error(`Unknown LLM provider: ${request.provider}`);
    }

    translatedChunks.push(translated);
  }

  // Join chunks back together
  let result = translatedChunks.join('\n\n');

  // Restore base64 images
  if (imageMap.size > 0) {
    result = restoreBase64Images(result, imageMap);
  }

  return {
    translated: result,
    chunksProcessed: chunks.length,
  };
}
