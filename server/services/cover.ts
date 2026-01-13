/**
 * Cover Page Service
 * Creates full-bleed cover pages using pdf-lib
 */

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { getTheme } from './themes.js';
import type { CoverPageOptions, Theme } from '../types/index.js';

// A4 dimensions in points (72 points per inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Letter dimensions in points
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

// Layout constants - reduced padding
const PADDING = 40; // Horizontal padding
const TOP_PADDING = 40;
const BOTTOM_PADDING = 40;

interface CreateCoverPageOptions {
  title: string;
  themeId: string;
  format?: 'A4' | 'Letter';
  coverPageOptions?: CoverPageOptions;
}

/**
 * Parse hex color to RGB values (0-1 range)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Format date for display with locale support
 * If a date string is provided, it's returned as-is (preserving user's format)
 * If no date is provided, returns undefined (nothing should be shown)
 */
function formatDate(dateStr?: string): string | undefined {
  // If user provided a date string, use it exactly as-is
  // Otherwise return undefined to indicate nothing should be shown
  return dateStr || undefined;
}

/**
 * Word wrap text to fit within maxWidth
 */
function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Load fonts from the new theme font structure
 * Uses TTF files for PDF embedding (required by pdf-lib)
 */
async function loadFonts(pdfDoc: PDFDocument, theme: Theme | null, themeId: string) {
  const themePath = path.join(process.cwd(), 'themes', themeId);
  const fonts = theme?.fonts;

  let headingFont;
  let bodyFont;

  // Load heading font (TTF required for PDF)
  if (fonts?.heading?.ttf) {
    try {
      const fontPath = path.join(themePath, fonts.heading.ttf);
      const fontBytes = await fs.readFile(fontPath);
      headingFont = await pdfDoc.embedFont(fontBytes);
    } catch (err) {
      console.error('Failed to load heading font:', err);
    }
  }

  // Load body font - only use regular variant, fall back to standard font
  // Don't use bold/italic as fallbacks to preserve intended styling
  if (fonts?.body?.regular?.ttf) {
    try {
      const fontPath = path.join(themePath, fonts.body.regular.ttf);
      const fontBytes = await fs.readFile(fontPath);
      bodyFont = await pdfDoc.embedFont(fontBytes);
    } catch (err) {
      console.error('Failed to load body font:', err);
    }
  }

  // Fallbacks to standard fonts
  if (!headingFont) {
    headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  if (!bodyFont) {
    bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  return { headingFont, bodyFont };
}

/**
 * Load logo for theme if available (SVG or PNG)
 */
async function loadLogoBuffer(themeId: string): Promise<Buffer | null> {
  const themePath = path.join(process.cwd(), 'themes', themeId, 'images');

  // Try SVG first
  try {
    const svgPath = path.join(themePath, 'logo.svg');
    return await fs.readFile(svgPath);
  } catch {
    // Try PNG
    try {
      const pngPath = path.join(themePath, 'logo.png');
      return await fs.readFile(pngPath);
    } catch {
      return null;
    }
  }
}

/**
 * Create a cover page with the new design
 */
export async function createCoverPage(options: CreateCoverPageOptions): Promise<Buffer> {
  const { title, themeId, format = 'A4', coverPageOptions } = options;

  // Get page dimensions
  const width = format === 'A4' ? A4_WIDTH : LETTER_WIDTH;
  const height = format === 'A4' ? A4_HEIGHT : LETTER_HEIGHT;

  // Create PDF document and register fontkit for custom font embedding
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([width, height]);

  // Get theme
  const theme = await getTheme(themeId);
  const bgColor = theme?.colors?.accent || '#dbff00';
  const textColor = theme?.colors?.heading || '#141414';

  const bgRgb = hexToRgb(bgColor);
  const textRgb = hexToRgb(textColor);

  // Draw full-bleed background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
  });

  // Load fonts from theme
  const { headingFont, bodyFont } = await loadFonts(pdfDoc, theme, themeId);

  // Calculate available width for text
  const contentWidth = width - PADDING * 2;

  // --- Draw Title (top left) - smaller size ---
  const titleFontSize = 32; // Reduced from 42
  const titleLines = wrapText(title, headingFont, titleFontSize, contentWidth - 50); // Leave room for rotated text
  const titleLineHeight = titleFontSize * 1.15;
  let currentY = height - TOP_PADDING - titleFontSize;

  for (const line of titleLines) {
    page.drawText(line, {
      x: PADDING,
      y: currentY,
      size: titleFontSize,
      font: headingFont,
      color: rgb(textRgb.r, textRgb.g, textRgb.b),
    });
    currentY -= titleLineHeight;
  }

  // --- Draw Subtitle (below title) ---
  const subtitle = coverPageOptions?.subtitle;
  if (subtitle) {
    const subtitleFontSize = 16;
    currentY -= 4; // Small gap between title and subtitle
    const subtitleLines = wrapText(subtitle, bodyFont, subtitleFontSize, contentWidth - 50);
    const subtitleLineHeight = subtitleFontSize * 1.4;

    for (const line of subtitleLines) {
      page.drawText(line, {
        x: PADDING,
        y: currentY,
        size: subtitleFontSize,
        font: bodyFont,
        color: rgb(textRgb.r, textRgb.g, textRgb.b),
      });
      currentY -= subtitleLineHeight;
    }
  }

  // --- Draw Version/Date (top right, rotated 90° clockwise) ---
  // Only show if user provided values
  const version = coverPageOptions?.version;
  const dateStr = formatDate(coverPageOptions?.date);

  // Build the text only with provided values
  const metaParts: string[] = [];
  if (version) metaParts.push(version);
  if (dateStr) metaParts.push(dateStr);

  if (metaParts.length > 0) {
    const versionDateText = metaParts.join('  |  ');
    const metaFontSize = 13;

    // Position rotated text in top right corner
    // -90 degrees (or 270) for clockwise rotation
    // The text origin is at bottom-left of the text, so we need to position accordingly
    const metaX = width - PADDING + 5;
    const metaY = height - TOP_PADDING; // Start from top

    page.drawText(versionDateText, {
      x: metaX,
      y: metaY,
      size: metaFontSize,
      font: bodyFont,
      color: rgb(textRgb.r, textRgb.g, textRgb.b),
      rotate: degrees(-90), // Clockwise rotation
    });
  }

  // --- Draw Logo (bottom, full width with padding) ---
  const logoBuffer = await loadLogoBuffer(themeId);
  if (logoBuffer) {
    try {
      // Convert SVG to PNG using sharp (works for both SVG and PNG input)
      const pngBuffer = await sharp(logoBuffer)
        .resize({ width: Math.round(contentWidth * 2) }) // 2x for quality
        .png()
        .toBuffer();

      const logoImage = await pdfDoc.embedPng(pngBuffer);

      // Calculate logo dimensions (full width with padding)
      const logoWidth = contentWidth;
      const logoAspectRatio = logoImage.width / logoImage.height;
      const logoHeight = logoWidth / logoAspectRatio;

      // Position at bottom with padding
      const logoX = PADDING;
      const logoY = BOTTOM_PADDING;

      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (err) {
      console.error('Failed to load logo:', err);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Merge cover page with main document
 */
export async function mergePdfs(coverBuffer: Buffer, mainBuffer: Buffer): Promise<Buffer> {
  const coverDoc = await PDFDocument.load(coverBuffer);
  const mainDoc = await PDFDocument.load(mainBuffer);

  // Create new document
  const mergedDoc = await PDFDocument.create();

  // Copy cover page
  const [coverPage] = await mergedDoc.copyPages(coverDoc, [0]);
  mergedDoc.addPage(coverPage);

  // Copy all pages from main document
  const mainPageIndices = mainDoc.getPageIndices();
  const mainPages = await mergedDoc.copyPages(mainDoc, mainPageIndices);
  for (const page of mainPages) {
    mergedDoc.addPage(page);
  }

  const mergedBytes = await mergedDoc.save();
  return Buffer.from(mergedBytes);
}
