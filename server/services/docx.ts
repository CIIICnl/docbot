/**
 * DOCX Parsing Service
 * Converts Word documents to markdown using mammoth.js
 */

import mammoth from 'mammoth';
import { decodeHtmlEntities } from '../utils/html.js';

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
  const markdown = htmlToMarkdown(result.value);

  // Extract title from first heading or first paragraph
  const title = extractTitle(markdown);

  return {
    markdown,
    title,
    images,
    warnings: result.messages.map((m) => m.message),
  };
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

  // Images
  md = md.replace(/<img src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

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

  // Tables
  md = convertTables(md);

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = decodeHtmlEntities(md);

  // Clean up excessive whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

/**
 * Convert HTML tables to markdown
 */
function convertTables(html: string): string {
  // Match table blocks
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;

  return html.replace(tableRegex, (_, tableContent: string) => {
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
    return headingMatch[1].trim();
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
