/**
 * Notion Integration Service
 * Fetches and converts Notion pages to markdown
 */

import { Client } from '@notionhq/client';
import type { NotionPageResult } from '../types/index.js';
import { getMediaProvider, isMediaAvailable, type MediaProvider } from '../media/index.js';
import { getDefaultOrganizationId } from '../config/database.js';

// Notion client instance (lazy initialized)
let notionClient: Client | null = null;

/**
 * Get or create the Notion client
 */
function getClient(): Client | null {
  if (!process.env.NOTION_API_KEY) {
    return null;
  }

  if (!notionClient) {
    notionClient = new Client({
      auth: process.env.NOTION_API_KEY,
    });
  }

  return notionClient;
}

/**
 * Check if Notion integration is available
 */
export function isNotionAvailable(): boolean {
  return !!process.env.NOTION_API_KEY;
}

/**
 * Extract page ID from Notion URL or raw ID
 */
export function extractPageId(urlOrId: string): string | null {
  // Already a clean ID (32 hex characters)
  const cleanId = urlOrId.replace(/-/g, '');
  if (/^[a-f0-9]{32}$/i.test(cleanId)) {
    return cleanId;
  }

  // Extract from URL
  // Format: https://www.notion.so/workspace/Page-Title-abc123def456...
  // or: https://notion.so/abc123def456...
  const urlMatch = urlOrId.match(/([a-f0-9]{32})(?:\?|$)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  // Try extracting from path segment with dashes
  const pathMatch = urlOrId.match(/([a-f0-9-]{36})(?:\?|$)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1].replace(/-/g, '');
  }

  return null;
}

/**
 * Fetch a Notion page and convert to markdown
 */
export async function fetchNotionPage(urlOrId: string): Promise<NotionPageResult> {
  const client = getClient();
  if (!client) {
    throw new Error(
      'Notion integration is not configured. Set NOTION_API_KEY environment variable.'
    );
  }

  const pageId = extractPageId(urlOrId);
  if (!pageId) {
    throw new Error('Invalid Notion page URL or ID');
  }

  // Fetch page metadata
  const page = await client.pages.retrieve({ page_id: pageId });

  // Extract title
  const title = extractPageTitle(page);

  // Fetch all blocks
  const blocks = await fetchAllBlocks(client, pageId);

  // Convert blocks to markdown
  let markdown = blocksToMarkdown(blocks);
  let cover = extractCover(page);

  // Notion hands out uploaded files as signed S3 URLs that expire after an
  // hour. Copy them into our own media storage so a saved document still has
  // its images when it is exported later (same approach as the DOCX import).
  const fileUrls = collectNotionFileUrls(blocks, page);
  if (fileUrls.length > 0) {
    if (isMediaAvailable()) {
      const replacements = await rehostFiles(fileUrls, getMediaProvider());
      for (const [original, mediaUrl] of replacements) {
        markdown = markdown.split(original).join(mediaUrl);
        if (cover === original) cover = mediaUrl;
      }
    } else {
      console.warn(
        `[notion] media storage unavailable; ${fileUrls.length} Notion file URL(s) left as-is (they expire after ~1h)`
      );
    }
  }

  return {
    title,
    markdown,
    icon: extractIcon(page),
    cover,
  };
}

/**
 * Collect the signed (expiring) URLs of Notion-hosted files: image blocks of
 * type `file` and a `file` cover. External URLs don't expire and are skipped.
 */
export function collectNotionFileUrls(blocks: any[], page?: any): string[] {
  const urls = new Set<string>();

  const walk = (list: any[]): void => {
    for (const block of list) {
      if (block.type === 'image' && block.image?.type === 'file' && block.image.file?.url) {
        urls.add(block.image.file.url);
      }
      if (block.children) walk(block.children);
    }
  };
  walk(blocks);

  if (page?.cover?.type === 'file' && page.cover.file?.url) {
    urls.add(page.cover.file.url);
  }

  return [...urls];
}

/**
 * Download each URL and store it via the media provider. Returns a map of
 * original URL -> docbot://media/ URL for the files that were stored and
 * read back; a failed file keeps its original URL (logged, not fatal).
 */
export async function rehostFiles(
  urls: string[],
  provider: MediaProvider,
  fetchFn: typeof fetch = fetch
): Promise<Map<string, string>> {
  const orgId = getDefaultOrganizationId();
  const replacements = new Map<string, string>();

  for (const url of urls) {
    const name = fileNameFromUrl(url);
    try {
      const response = await fetchFn(url);
      if (!response.ok) {
        throw new Error(`download failed: HTTP ${response.status}`);
      }
      const data = Buffer.from(await response.arrayBuffer());
      const headerType = response.headers.get('content-type')?.split(';')[0]?.trim();
      const contentType =
        headerType && headerType !== 'application/octet-stream'
          ? headerType
          : provider.getContentType(name);

      const key = provider.generateKey(orgId, name);
      await provider.upload(key, data, { contentType });
      if (!(await provider.exists(key))) {
        throw new Error('upload reported success but object is not retrievable (read-back failed)');
      }

      replacements.set(url, `docbot://media/${key}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[notion] rehost FAILED for "${name}" (provider=${provider.name}): ${msg}`);
    }
  }

  console.log(
    `[notion] rehosted ${replacements.size}/${urls.length} Notion file(s) (provider=${provider.name})`
  );
  return replacements;
}

/**
 * Original file name from a Notion file URL (last path segment, no query).
 */
function fileNameFromUrl(url: string): string {
  try {
    const segment = new URL(url).pathname.split('/').pop();
    return segment ? decodeURIComponent(segment) : 'image';
  } catch {
    return 'image';
  }
}

/**
 * Extract page title from page object
 */
function extractPageTitle(page: any): string {
  // Try different title property locations
  if (page.properties?.title?.title?.[0]?.plain_text) {
    return page.properties.title.title[0].plain_text;
  }

  if (page.properties?.Name?.title?.[0]?.plain_text) {
    return page.properties.Name.title[0].plain_text;
  }

  // Search for any title property
  for (const prop of Object.values(page.properties || {})) {
    if ((prop as any)?.type === 'title' && (prop as any)?.title?.[0]?.plain_text) {
      return (prop as any).title[0].plain_text;
    }
  }

  return 'Untitled';
}

/**
 * Extract page icon
 */
function extractIcon(page: any): string | undefined {
  if (page.icon?.type === 'emoji') {
    return page.icon.emoji;
  }
  if (page.icon?.type === 'external') {
    return page.icon.external.url;
  }
  return undefined;
}

/**
 * Extract page cover
 */
function extractCover(page: any): string | undefined {
  if (page.cover?.type === 'external') {
    return page.cover.external.url;
  }
  if (page.cover?.type === 'file') {
    return page.cover.file.url;
  }
  return undefined;
}

/**
 * Fetch all blocks from a page (handles pagination)
 */
async function fetchAllBlocks(client: Client, blockId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    blocks.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // Fetch children for blocks that have them
  for (const block of blocks) {
    if (block.has_children) {
      block.children = await fetchAllBlocks(client, block.id);
    }
  }

  return blocks;
}

/**
 * Convert Notion blocks to markdown
 */
function blocksToMarkdown(blocks: any[], depth = 0): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const md = blockToMarkdown(block, depth);
    if (md) {
      lines.push(md);
    }
  }

  return lines.join('\n\n');
}

/**
 * Convert a single block to markdown
 */
function blockToMarkdown(block: any, depth: number): string {
  const type = block.type;
  const data = block[type];

  switch (type) {
    case 'paragraph':
      return richTextToMarkdown(data?.rich_text);

    case 'heading_1':
      return `# ${richTextToMarkdown(data?.rich_text)}`;

    case 'heading_2':
      return `## ${richTextToMarkdown(data?.rich_text)}`;

    case 'heading_3':
      return `### ${richTextToMarkdown(data?.rich_text)}`;

    case 'bulleted_list_item': {
      const indent = '  '.repeat(depth);
      const content = richTextToMarkdown(data?.rich_text);
      const children = block.children ? blocksToMarkdown(block.children, depth + 1) : '';
      return `${indent}- ${content}${children ? '\n' + children : ''}`;
    }

    case 'numbered_list_item': {
      const indent = '  '.repeat(depth);
      const content = richTextToMarkdown(data?.rich_text);
      const children = block.children ? blocksToMarkdown(block.children, depth + 1) : '';
      return `${indent}1. ${content}${children ? '\n' + children : ''}`;
    }

    case 'to_do': {
      const checked = data?.checked ? 'x' : ' ';
      return `- [${checked}] ${richTextToMarkdown(data?.rich_text)}`;
    }

    case 'toggle': {
      const summary = richTextToMarkdown(data?.rich_text);
      const children = block.children ? blocksToMarkdown(block.children, depth) : '';
      return `<details>\n<summary>${summary}</summary>\n\n${children}\n</details>`;
    }

    case 'code': {
      const language = data?.language || '';
      const code = richTextToMarkdown(data?.rich_text);
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }

    case 'quote':
      return `> ${richTextToMarkdown(data?.rich_text)}`;

    case 'callout': {
      const icon = data?.icon?.emoji || '💡';
      const content = richTextToMarkdown(data?.rich_text);
      return `> ${icon} ${content}`;
    }

    case 'divider':
      return '---';

    case 'image': {
      const url = data?.type === 'external' ? data.external?.url : data?.file?.url;
      const caption = data?.caption ? richTextToMarkdown(data.caption) : '';
      if (url) {
        return caption ? `![${caption}](${url})\n*${caption}*` : `![Image](${url})`;
      }
      return '';
    }

    case 'bookmark':
    case 'link_preview':
      return data?.url ? `[${data.url}](${data.url})` : '';

    case 'table': {
      if (!block.children) return '';
      return tableToMarkdown(block.children);
    }

    case 'table_row':
      // Handled by parent table
      return '';

    case 'column_list':
      // Render columns as sequential content
      return block.children ? blocksToMarkdown(block.children, depth) : '';

    case 'column':
      return block.children ? blocksToMarkdown(block.children, depth) : '';

    default:
      // Unknown block type, try to extract text
      if (data?.rich_text) {
        return richTextToMarkdown(data.rich_text);
      }
      return '';
  }
}

/**
 * Convert a table to markdown
 */
function tableToMarkdown(rows: any[]): string {
  if (rows.length === 0) return '';

  const lines: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.table_row?.cells || [];
    const cellTexts = cells.map((cell: any) => richTextToMarkdown(cell));
    lines.push(`| ${cellTexts.join(' | ')} |`);

    // Add separator after header row
    if (i === 0) {
      lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
    }
  }

  return lines.join('\n');
}

/**
 * Convert Notion rich text to markdown
 */
function richTextToMarkdown(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) {
    return '';
  }

  return richText
    .map((text) => {
      let content = text.plain_text || '';

      // Apply formatting
      if (text.annotations?.bold) {
        content = `**${content}**`;
      }
      if (text.annotations?.italic) {
        content = `*${content}*`;
      }
      if (text.annotations?.strikethrough) {
        content = `~~${content}~~`;
      }
      if (text.annotations?.code) {
        content = `\`${content}\``;
      }

      // Handle links
      if (text.href) {
        content = `[${content}](${text.href})`;
      }

      return content;
    })
    .join('');
}
