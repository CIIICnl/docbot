// Markdown parsing service using markdown-it with plugins

import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import hljs from 'highlight.js';
import type { MarkdownResult, TocEntry, AccessibilityWarning } from '../types/index.js';
import { escapeHtml } from '../utils/html.js';
import { resolveMediaUrl } from '../routes/api/media.js';

// Configure markdown-it with plugins
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch {
        // Fall through to default
      }
    }
    return ''; // Use external default escaping
  },
});

// Add anchor plugin for heading IDs
md.use(anchor, {
  permalink: false,
  slugify: (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[\s]+/g, '-')
      .replace(/[^\w-]/g, ''),
});

// Add footnote support
md.use(footnote);

/**
 * Wrap solo-image paragraphs in <figure> with a <figcaption>.
 *
 * Pattern that triggers it: a paragraph whose only meaningful inline
 * child is a single image (whitespace-only siblings are ignored).
 * The image's alt text becomes the caption — bot output uses the form
 * '![beschrijving — Foto: Naam](url)' so the caption already carries
 * the photographer credit; CSS in themes/ciiic/styles.css renders it
 * small/grey/monospace tight under the image.
 *
 * Inline images embedded in a sentence are left alone (still <p><img>).
 */
md.core.ruler.push('image_figures', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length - 2; i++) {
    const open = tokens[i];
    const inline = tokens[i + 1];
    const close = tokens[i + 2];
    if (
      !open ||
      !inline ||
      !close ||
      open.type !== 'paragraph_open' ||
      inline.type !== 'inline' ||
      close.type !== 'paragraph_close'
    ) {
      continue;
    }
    const meaningful = (inline.children ?? []).filter(
      (c) => !(c.type === 'text' && c.content.trim() === '')
    );
    if (meaningful.length !== 1) continue;
    const imgToken = meaningful[0];
    if (!imgToken || imgToken.type !== 'image') continue;

    open.type = 'figure_open';
    open.tag = 'figure';
    close.type = 'figure_close';
    close.tag = 'figure';

    const alt = (imgToken.content || imgToken.attrGet('alt') || '').trim();
    if (!alt) continue;

    // Split "beschrijving — Foto: Naam" so the credit sits on its own
    // line under the description (smaller, lower opacity in CSS).
    const credit = alt.match(/^(.*?)\s+—\s+(Foto:\s+.+)$/);
    const captionOpen = new state.Token('figcaption_open', 'figcaption', 1);
    captionOpen.block = true;
    const captionInline = new state.Token('inline', '', 0);
    captionInline.children = [];
    if (credit) {
      const description = (credit[1] ?? '').trim();
      const photographer = (credit[2] ?? '').trim();
      const descSpanOpen = new state.Token('html_inline', '', 0);
      descSpanOpen.content = '<span class="caption-text">';
      const descText = new state.Token('text', '', 0);
      descText.content = description;
      const descSpanClose = new state.Token('html_inline', '', 0);
      descSpanClose.content = '</span>';
      const creditSpanOpen = new state.Token('html_inline', '', 0);
      creditSpanOpen.content = '<span class="caption-credit">';
      const creditText = new state.Token('text', '', 0);
      creditText.content = photographer;
      const creditSpanClose = new state.Token('html_inline', '', 0);
      creditSpanClose.content = '</span>';
      captionInline.children.push(
        descSpanOpen,
        descText,
        descSpanClose,
        creditSpanOpen,
        creditText,
        creditSpanClose
      );
    } else {
      const text = new state.Token('text', '', 0);
      text.content = alt;
      captionInline.children.push(text);
    }
    captionInline.content = alt;
    const captionClose = new state.Token('figcaption_close', 'figcaption', -1);
    captionClose.block = true;

    tokens.splice(i + 2, 0, captionOpen, captionInline, captionClose);
    i += 3;
  }
});

// Enable tables (built into markdown-it)
md.enable('table');

// Make external links open in new window
const defaultRender =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token) {
    // Add target="_blank" and rel="noopener noreferrer" for security
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return defaultRender(tokens, idx, options, env, self);
};

// Add scope="col" to table header cells for screen reader accessibility
const defaultThRender =
  md.renderer.rules.th_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.th_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token) {
    token.attrSet('scope', 'col');
  }
  return defaultThRender(tokens, idx, options, env, self);
};

/**
 * Extract table of contents entries from markdown tokens
 */
function extractToc(tokens: ReturnType<typeof md.parse>): TocEntry[] {
  const toc: TocEntry[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.slice(1), 10);
      // Only include h2 and h3 in TOC
      if (level >= 2 && level <= 3) {
        const contentToken = tokens[i + 1];
        if (contentToken && contentToken.type === 'inline') {
          const text = contentToken.content;
          const id = text
            .toLowerCase()
            .trim()
            .replace(/[\s]+/g, '-')
            .replace(/[^\w-]/g, '');
          toc.push({ id, text, level });
        }
      }
    }
  }

  return toc;
}

/**
 * Extract first H1 as document title
 */
function extractTitle(tokens: ReturnType<typeof md.parse>): string | undefined {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    if (token.type === 'heading_open' && token.tag === 'h1') {
      const contentToken = tokens[i + 1];
      if (contentToken && contentToken.type === 'inline') {
        return contentToken.content;
      }
    }
  }
  return undefined;
}

/**
 * Check images for accessibility issues (missing or empty alt text)
 */
function checkImageAccessibility(tokens: ReturnType<typeof md.parse>): AccessibilityWarning[] {
  const warnings: AccessibilityWarning[] = [];

  function processTokens(tokenList: ReturnType<typeof md.parse>) {
    for (const token of tokenList) {
      if (!token) continue;

      // Check inline tokens for images
      if (token.type === 'inline' && token.children) {
        for (const child of token.children) {
          if (child.type === 'image') {
            const src = child.attrGet('src') || '';
            const alt = child.attrGet('alt') || child.content || '';

            // Get filename for better error messages
            const filename = src.split('/').pop() || src;

            if (!alt) {
              warnings.push({
                type: 'missing-alt-text',
                message: `Image "${filename}" is missing alt text`,
                source: src,
              });
            } else if (alt.trim() === '') {
              warnings.push({
                type: 'empty-alt-text',
                message: `Image "${filename}" has empty alt text`,
                source: src,
              });
            }
          }
        }
      }

      // Recursively check children
      if (token.children) {
        processTokens(token.children);
      }
    }
  }

  processTokens(tokens);
  return warnings;
}

/**
 * Parse markdown content to HTML with TOC extraction
 */
export function parseMarkdown(content: string): MarkdownResult {
  // Parse to tokens first (for TOC extraction)
  const tokens = md.parse(content, {});

  // Extract metadata
  const toc = extractToc(tokens);
  const title = extractTitle(tokens);

  // Check for accessibility issues
  const accessibilityWarnings = checkImageAccessibility(tokens);

  // Render to HTML
  const html = md.render(content);

  return { html, toc, title, accessibilityWarnings };
}

/**
 * Generate HTML for table of contents
 */
export function generateTocHtml(toc: TocEntry[], locale: 'en' | 'nl' = 'en'): string {
  if (toc.length === 0) return '';

  const tocTitle = locale === 'nl' ? 'Inhoudsopgave' : 'Table of Contents';

  const items = toc
    .map((entry) => {
      const indent = entry.level === 3 ? 'toc-indent' : '';
      return `<li class="toc-item ${indent}"><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`;
    })
    .join('\n');

  return `
    <nav class="document-toc" aria-label="${tocTitle}">
      <h2 class="toc-title">${tocTitle}</h2>
      <ul class="toc-list">
        ${items}
      </ul>
    </nav>
  `;
}


/**
 * Simple word count for statistics
 */
export function countWords(content: string): number {
  return content
    .replace(/[#*`\[\]()]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Resolve docbot:// media URLs in markdown content
 * Converts them to base64 data URLs for PDF embedding or presigned URLs for preview
 */
export async function resolveMediaUrls(
  content: string,
  options: { asBase64?: boolean } = {}
): Promise<string> {
  // Find all docbot://media/ URLs in the content
  const mediaUrlPattern = /docbot:\/\/media\/[^\s)"']+/g;
  const matches = content.match(mediaUrlPattern);

  if (!matches || matches.length === 0) {
    return content;
  }

  // Resolve each URL (deduplicate first)
  const uniqueUrls = [...new Set(matches)];
  const urlMap = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const resolved = await resolveMediaUrl(url, { asBase64: options.asBase64 });
        if (resolved) {
          urlMap.set(url, resolved);
        }
      } catch (err) {
        console.warn(`[markdown] Failed to resolve media URL: ${url}`, err);
      }
    })
  );

  // Replace all URLs in content
  let result = content;
  for (const [original, resolved] of urlMap) {
    result = result.split(original).join(resolved);
  }

  return result;
}

/**
 * Parse markdown with media URL resolution for PDF/print
 * Resolves docbot:// URLs to base64 for embedding in PDFs
 */
export async function parseMarkdownForPdf(content: string): Promise<MarkdownResult> {
  // First resolve media URLs to base64
  const resolvedContent = await resolveMediaUrls(content, { asBase64: true });

  // Then parse as normal
  return parseMarkdown(resolvedContent);
}
