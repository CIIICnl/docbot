/**
 * DOCX Parsing Service
 * Converts Word documents to markdown using mammoth.js
 */

import mammoth from 'mammoth';
import { decodeHtmlEntities } from '../utils/html.js';
import { extractHeadingNumbers, applyHeadingNumbers } from './docx-numbering.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MammothOptions = any;

export interface DocxImage {
  name: string;
  data: string; // base64
  mimeType: string;
}

export interface DocxResult {
  markdown: string;
  title: string;
  images: DocxImage[];
  warnings: string[];
  /** Heuristic document language, so the UI can offer to switch on import. */
  detectedLanguage: 'nl' | 'en' | null;
}

/**
 * Parse a .docx file buffer to markdown
 */
export async function parseDocx(buffer: Buffer): Promise<DocxResult> {
  const images: DocxImage[] = [];
  let imageCounter = 0;

  // Configure mammoth to extract images as base64 data URLs
  const options: MammothOptions = {
    convertImage: mammoth.images.imgElement((image) => {
      return image.read('base64').then((imageBuffer) => {
        imageCounter++;
        const contentType = image.contentType || 'image/png';
        const ext = getExtensionFromContentType(contentType);
        const name = `docx-image-${imageCounter}${ext}`;

        images.push({
          name,
          data: imageBuffer,
          mimeType: contentType,
        });

        // Return base64 data URL so images work everywhere
        return { src: `data:${contentType};base64,${imageBuffer}` };
      });
    }),
  };

  // Convert to HTML first (mammoth's primary output)
  const result = await mammoth.convertToHtml({ buffer }, options);

  // Convert HTML to markdown
  let markdown = htmlToMarkdown(result.value);

  // Reconstruct Word's heading auto-numbering (mammoth drops it, breaking
  // in-text references like "see section 2.5"). Must never break the import,
  // so on any failure we fall back to the unnumbered markdown.
  try {
    const headingNumbers = await extractHeadingNumbers(buffer);
    markdown = applyHeadingNumbers(markdown, headingNumbers);
  } catch (err) {
    console.warn('[docx] Heading numbering reconstruction failed, continuing without:', err);
  }

  // Extract title from first heading or first paragraph
  const title = extractTitle(markdown);

  return {
    markdown,
    title,
    images,
    warnings: result.messages.map((m) => m.message),
    detectedLanguage: detectLanguage(markdown),
  };
}

// Distinctive function words per language (kept non-overlapping so the counts
// actually discriminate). Used only for an import-time "switch language?" hint.
const NL_WORDS = new Set(
  'de het een en van voor met niet zijn wordt dat ook maar deze naar door bij worden zoals omdat onze je'.split(' ')
);
const EN_WORDS = new Set(
  'the and of to for with not are that this as be you our because which their have between into from'.split(' ')
);

/**
 * Cheap language guess from word frequencies. Returns null when the text is
 * too short or the signal is ambiguous (so the UI stays quiet rather than
 * guessing wrong).
 */
function detectLanguage(markdown: string): 'nl' | 'en' | null {
  const words = markdown
    .toLowerCase()
    .replace(/[^a-zà-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 30) return null;
  let nl = 0;
  let en = 0;
  for (const w of words) {
    if (NL_WORDS.has(w)) nl++;
    if (EN_WORDS.has(w)) en++;
  }
  const total = nl + en;
  if (total < 10) return null;
  if (Math.max(nl, en) / total < 0.6) return null; // ambiguous
  return nl > en ? 'nl' : 'en';
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromContentType(contentType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
  };
  return mimeToExt[contentType] || '.png';
}

/**
 * Convert HTML to Markdown
 * Simple conversion for mammoth output (already semantic HTML)
 */
function htmlToMarkdown(html: string): string {
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

  // Bold and italic - move any leading/trailing whitespace outside the markers
  // (Word users often select trailing spaces when formatting)
  md = md.replace(/<strong>(.*?)<\/strong>/gi, (_, content) => {
    const match = content.match(/^(\s*)(.*?)(\s*)$/s);
    if (!match) return `**${content}**`;
    const [, leading, text, trailing] = match;
    if (!text) return leading + trailing; // empty content, just return whitespace
    return `${leading}**${text}**${trailing}`;
  });
  md = md.replace(/<b>(.*?)<\/b>/gi, (_, content) => {
    const match = content.match(/^(\s*)(.*?)(\s*)$/s);
    if (!match) return `**${content}**`;
    const [, leading, text, trailing] = match;
    if (!text) return leading + trailing;
    return `${leading}**${text}**${trailing}`;
  });
  md = md.replace(/<em>(.*?)<\/em>/gi, (_, content) => {
    const match = content.match(/^(\s*)(.*?)(\s*)$/s);
    if (!match) return `*${content}*`;
    const [, leading, text, trailing] = match;
    if (!text) return leading + trailing;
    return `${leading}*${text}*${trailing}`;
  });
  md = md.replace(/<i>(.*?)<\/i>/gi, (_, content) => {
    const match = content.match(/^(\s*)(.*?)(\s*)$/s);
    if (!match) return `*${content}*`;
    const [, leading, text, trailing] = match;
    if (!text) return leading + trailing;
    return `${leading}*${text}*${trailing}`;
  });

  // Links
  md = md.replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images - handle src attribute in any position, preserve alt text (clean up newlines)
  md = md.replace(/<img\s+(?:[^>]*?\s)?alt="([^"]*)"[^>]*?\ssrc="([^"]*)"[^>]*\/?>/gi, (_, alt, src) => {
    const cleanAlt = alt.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    return `![${cleanAlt}](${src})`;
  });
  md = md.replace(/<img\s+(?:[^>]*?\s)?src="([^"]*)"[^>]*?\salt="([^"]*)"[^>]*\/?>/gi, (_, src, alt) => {
    const cleanAlt = alt.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    return `![${cleanAlt}](${src})`;
  });
  md = md.replace(/<img\s+(?:[^>]*?\s)?src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Lists - unordered
  md = md.replace(/<ul>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<li>(.*?)<\/li>/gi, '- $1\n');

  // Lists - ordered (simplified)
  md = md.replace(/<ol>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');

  // Paragraphs
  md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Tables - preserve complex tables as HTML, convert simple ones to markdown
  const preservedTables: string[] = [];
  md = convertTables(md, preservedTables);

  // Remove remaining HTML tags (but not our table placeholders)
  md = md.replace(/<[^>]+>/g, '');

  // Restore preserved HTML tables
  preservedTables.forEach((table, index) => {
    md = md.replace(`__PRESERVED_TABLE_${index}__`, table);
  });

  // Decode HTML entities
  md = decodeHtmlEntities(md);

  // Clean up excessive whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

/**
 * Check if a table has merged cells (colspan or rowspan)
 */
function hasTableMergedCells(tableContent: string): boolean {
  return /colspan\s*=\s*["']?\d+["']?/i.test(tableContent) ||
         /rowspan\s*=\s*["']?\d+["']?/i.test(tableContent);
}

/**
 * Clean up HTML table for embedding (remove unnecessary attributes, preserve structure)
 */
function cleanHtmlTable(tableHtml: string): string {
  let cleaned = tableHtml;

  // Remove class attributes
  cleaned = cleaned.replace(/\s+class\s*=\s*["'][^"']*["']/gi, '');

  // Remove style attributes (but preserve width styles on col elements)
  cleaned = cleaned.replace(/<col([^>]*)style\s*=\s*["']([^"']*)["']([^>]*)>/gi, (_match, before, style, after) => {
    // Extract width from style if present
    const widthMatch = style.match(/width:\s*([^;]+)/i);
    if (widthMatch) {
      return `<col${before}style="width: ${widthMatch[1].trim()}"${after}>`;
    }
    return `<col${before}${after}>`;
  });

  // Remove style attributes from other elements
  cleaned = cleaned.replace(/<((?!col\b)[a-z]+)([^>]*)style\s*=\s*["'][^"']*["']([^>]*)>/gi, '<$1$2$3>');

  // Clean up empty attribute lists
  cleaned = cleaned.replace(/<([a-z]+)\s+>/gi, '<$1>');

  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Ensure proper line breaks for readability
  cleaned = cleaned.replace(/>\s*</g, '>\n<');

  // Format the table nicely with indentation
  let indentLevel = 0;
  const lines = cleaned.split('\n');
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    // Decrease indent for closing tags
    if (/^<\/(table|thead|tbody|tr|colgroup)>/i.test(trimmed)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    const indented = '  '.repeat(indentLevel) + trimmed;

    // Increase indent for opening tags
    if (/^<(table|thead|tbody|tr|colgroup)>/i.test(trimmed) ||
        /^<(table|thead|tbody|tr|colgroup)\s/i.test(trimmed)) {
      indentLevel++;
    }

    return indented;
  }).filter(line => line.trim());

  return '\n' + formattedLines.join('\n') + '\n';
}

/**
 * Convert HTML tables to markdown, or preserve as HTML if they have merged cells
 * Complex tables are stored in preservedTables array and replaced with placeholders
 */
function convertTables(html: string, preservedTables: string[]): string {
  // Match table blocks
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;

  return html.replace(tableRegex, (fullMatch, tableContent: string) => {
    // If table has merged cells, preserve as HTML using a placeholder
    if (hasTableMergedCells(tableContent)) {
      const index = preservedTables.length;
      preservedTables.push(cleanHtmlTable(fullMatch));
      return `__PRESERVED_TABLE_${index}__`;
    }

    // Otherwise convert to markdown
    const rows: string[][] = [];

    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      const rowContent = rowMatch[1] || '';

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        // Clean cell content
        const cellContent = (cellMatch[1] || '')
          .replace(/<[^>]+>/g, '')
          .replace(/\n/g, ' ')
          .trim();
        cells.push(cellContent);
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return '';

    // Build markdown table
    let mdTable = '\n';
    const colCount = Math.max(...rows.map((r) => r.length));

    rows.forEach((row, idx) => {
      // Pad row to match column count
      while (row.length < colCount) row.push('');

      mdTable += '| ' + row.join(' | ') + ' |\n';

      // Add header separator after first row
      if (idx === 0) {
        mdTable += '| ' + row.map(() => '---').join(' | ') + ' |\n';
      }
    });

    return mdTable + '\n';
  });
}


/**
 * Extract title from markdown content
 */
function extractTitle(markdown: string): string {
  // Try to find first heading
  const headingMatch = markdown.match(/^#+ (.+)$/m);
  if (headingMatch && headingMatch[1]) {
    // Drop any reconstructed heading number ("1." / "2.5") from the title.
    return headingMatch[1].replace(/^\d+(?:\.\d+)*\.?\s+/, '').trim();
  }

  // Fallback to first non-empty line
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('!')) {
      return trimmed.slice(0, 100);
    }
  }

  return 'Untitled Document';
}
