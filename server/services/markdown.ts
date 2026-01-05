// Markdown parsing service using markdown-it with plugins

import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import hljs from 'highlight.js';
import type { MarkdownResult, TocEntry } from '../types/index.js';

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

// Enable tables (built into markdown-it)
md.enable('table');

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
 * Parse markdown content to HTML with TOC extraction
 */
export function parseMarkdown(content: string): MarkdownResult {
  // Parse to tokens first (for TOC extraction)
  const tokens = md.parse(content, {});

  // Extract metadata
  const toc = extractToc(tokens);
  const title = extractTitle(tokens);

  // Render to HTML
  const html = md.render(content);

  return { html, toc, title };
}

/**
 * Generate HTML for table of contents
 */
export function generateTocHtml(toc: TocEntry[]): string {
  if (toc.length === 0) return '';

  const items = toc
    .map((entry) => {
      const indent = entry.level === 3 ? 'toc-indent' : '';
      return `<li class="toc-item ${indent}"><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`;
    })
    .join('\n');

  return `
    <nav class="document-toc" aria-label="Table of Contents">
      <h2 class="toc-title">Contents</h2>
      <ul class="toc-list">
        ${items}
      </ul>
    </nav>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => escapeMap[char] ?? char);
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
