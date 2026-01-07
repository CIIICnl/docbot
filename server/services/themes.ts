// Theme management service

import * as fs from 'fs';
import * as path from 'path';
import { getRoot } from '../config/env.js';
import type { Theme, ThemeFonts, FontVariant } from '../types/index.js';

const THEMES_DIR = 'themes';
const DEFAULT_THEME_ID = 'ciiic';

/**
 * Get the themes directory path
 */
function getThemesDir(): string {
  return path.join(getRoot(), THEMES_DIR);
}

/**
 * Get a specific theme directory path
 */
function getThemeDir(themeId: string): string {
  return path.join(getThemesDir(), themeId);
}

/**
 * List all available themes
 */
export async function listThemes(): Promise<Theme[]> {
  const themesDir = getThemesDir();

  if (!fs.existsSync(themesDir)) {
    return [];
  }

  const entries = fs.readdirSync(themesDir, { withFileTypes: true });
  const themes: Theme[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const theme = await getTheme(entry.name);
      if (theme) {
        themes.push(theme);
      }
    }
  }

  return themes;
}

/**
 * Get a theme by ID
 */
export async function getTheme(themeId: string): Promise<Theme | null> {
  const themeDir = getThemeDir(themeId);
  const configPath = path.join(themeDir, 'theme.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    return {
      id: themeId,
      name: config.name || themeId,
      description: config.description,
      version: config.version,
      author: config.author,
      fonts: config.fonts,
      colors: config.colors,
      pageSettings: config.pageSettings,
    };
  } catch {
    console.error(`Failed to load theme ${themeId}`);
    return null;
  }
}

/**
 * Get theme CSS styles
 */
export async function getThemeStyles(themeId: string): Promise<string> {
  const themeDir = getThemeDir(themeId);
  const stylesPath = path.join(themeDir, 'styles.css');

  if (!fs.existsSync(stylesPath)) {
    return '';
  }

  return fs.readFileSync(stylesPath, 'utf-8');
}

/**
 * Helper to generate a single @font-face rule with base64 data
 */
function generateBase64FontFace(
  themeDir: string,
  family: string,
  filePath: string,
  weight: number | string = 400,
  style: string = 'normal'
): string | null {
  const fullPath = path.join(themeDir, filePath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`Font file not found: ${fullPath}`);
    return null;
  }

  const fontData = fs.readFileSync(fullPath);
  const base64 = fontData.toString('base64');
  const mimeType = filePath.endsWith('.woff2')
    ? 'font/woff2'
    : filePath.endsWith('.woff')
      ? 'font/woff'
      : 'font/ttf';
  const format = mimeType === 'font/woff2' ? 'woff2' : mimeType === 'font/woff' ? 'woff' : 'truetype';

  return `
    @font-face {
      font-family: '${family}';
      font-weight: ${weight};
      font-style: ${style};
      src: url(data:${mimeType};base64,${base64}) format('${format}');
    }
  `;
}

/**
 * Helper to generate a single @font-face rule with URL reference
 */
function generateUrlFontFace(
  themeId: string,
  family: string,
  filePath: string,
  weight: number | string = 400,
  style: string = 'normal'
): string {
  const format = filePath.endsWith('.woff2')
    ? 'woff2'
    : filePath.endsWith('.woff')
      ? 'woff'
      : 'truetype';

  return `
    @font-face {
      font-family: '${family}';
      font-weight: ${weight};
      font-style: ${style};
      src: url(/api/themes/${themeId}/fonts/${encodeURIComponent(filePath)}) format('${format}');
    }
  `;
}

/**
 * Generate @font-face rules for a theme's fonts
 * Embeds fonts as base64 data URLs for PDF generation
 * Uses TTF when available (better for PDF), falls back to WOFF2
 */
export async function generateFontFaceRules(themeId: string): Promise<string> {
  const theme = await getTheme(themeId);
  if (!theme?.fonts) {
    return '';
  }

  const themeDir = getThemeDir(themeId);
  const fonts = theme.fonts;
  const rules: string[] = [];

  // Heading font - single variant, used for all heading weights/styles
  if (fonts.heading) {
    const file = fonts.heading.ttf || fonts.heading.woff2;
    if (file) {
      // Register for multiple weights to prevent faux-bold
      const rule = generateBase64FontFace(themeDir, fonts.heading.family, file, 400, 'normal');
      if (rule) rules.push(rule);
      // Also register as bold to prevent browser from synthesizing
      const boldRule = generateBase64FontFace(themeDir, fonts.heading.family, file, 700, 'normal');
      if (boldRule) rules.push(boldRule);
    }
  }

  // Body font - multiple variants
  if (fonts.body) {
    const family = fonts.body.family;

    // Regular
    if (fonts.body.regular) {
      const file = fonts.body.regular.ttf || fonts.body.regular.woff2;
      if (file) {
        const rule = generateBase64FontFace(themeDir, family, file, 400, 'normal');
        if (rule) rules.push(rule);
      }
    }

    // Bold
    if (fonts.body.bold) {
      const file = fonts.body.bold.ttf || fonts.body.bold.woff2;
      if (file) {
        const rule = generateBase64FontFace(themeDir, family, file, 700, 'normal');
        if (rule) rules.push(rule);
      }
    }

    // Italic
    if (fonts.body.italic) {
      const file = fonts.body.italic.ttf || fonts.body.italic.woff2;
      if (file) {
        const rule = generateBase64FontFace(themeDir, family, file, 400, 'italic');
        if (rule) rules.push(rule);
      }
    }

    // Bold Italic
    if (fonts.body.boldItalic) {
      const file = fonts.body.boldItalic.ttf || fonts.body.boldItalic.woff2;
      if (file) {
        const rule = generateBase64FontFace(themeDir, family, file, 700, 'italic');
        if (rule) rules.push(rule);
      }
    }
  }

  // Caption/code font
  if (fonts.caption) {
    const file = fonts.caption.ttf || fonts.caption.woff2;
    if (file) {
      const rule = generateBase64FontFace(themeDir, fonts.caption.family, file, 400, 'normal');
      if (rule) rules.push(rule);
    }
  }

  return rules.join('\n');
}

/**
 * Generate @font-face rules using URL references (for preview)
 * Uses WOFF2 for web performance
 */
export async function generateFontFaceUrlRules(themeId: string): Promise<string> {
  const theme = await getTheme(themeId);
  if (!theme?.fonts) {
    return '';
  }

  const fonts = theme.fonts;
  const rules: string[] = [];

  // Heading font - single variant, used for all heading weights/styles
  if (fonts.heading) {
    const file = fonts.heading.woff2 || fonts.heading.ttf;
    if (file) {
      // Register for multiple weights to prevent faux-bold
      rules.push(generateUrlFontFace(themeId, fonts.heading.family, file, 400, 'normal'));
      rules.push(generateUrlFontFace(themeId, fonts.heading.family, file, 700, 'normal'));
    }
  }

  // Body font - multiple variants
  if (fonts.body) {
    const family = fonts.body.family;

    // Regular
    if (fonts.body.regular) {
      const file = fonts.body.regular.woff2 || fonts.body.regular.ttf;
      if (file) {
        rules.push(generateUrlFontFace(themeId, family, file, 400, 'normal'));
      }
    }

    // Bold
    if (fonts.body.bold) {
      const file = fonts.body.bold.woff2 || fonts.body.bold.ttf;
      if (file) {
        rules.push(generateUrlFontFace(themeId, family, file, 700, 'normal'));
      }
    }

    // Italic
    if (fonts.body.italic) {
      const file = fonts.body.italic.woff2 || fonts.body.italic.ttf;
      if (file) {
        rules.push(generateUrlFontFace(themeId, family, file, 400, 'italic'));
      }
    }

    // Bold Italic
    if (fonts.body.boldItalic) {
      const file = fonts.body.boldItalic.woff2 || fonts.body.boldItalic.ttf;
      if (file) {
        rules.push(generateUrlFontFace(themeId, family, file, 700, 'italic'));
      }
    }
  }

  // Caption/code font
  if (fonts.caption) {
    const file = fonts.caption.woff2 || fonts.caption.ttf;
    if (file) {
      rules.push(generateUrlFontFace(themeId, fonts.caption.family, file, 400, 'normal'));
    }
  }

  return rules.join('\n');
}

/**
 * Get all font file paths from theme config (for validation)
 */
function getAllFontPaths(fonts: ThemeFonts): string[] {
  const paths: string[] = [];

  // Heading
  if (fonts.heading?.ttf) paths.push(fonts.heading.ttf);
  if (fonts.heading?.woff2) paths.push(fonts.heading.woff2);

  // Body variants
  if (fonts.body) {
    const variants: (FontVariant | undefined)[] = [
      fonts.body.regular,
      fonts.body.bold,
      fonts.body.italic,
      fonts.body.boldItalic,
    ];
    for (const variant of variants) {
      if (variant?.ttf) paths.push(variant.ttf);
      if (variant?.woff2) paths.push(variant.woff2);
    }
  }

  // Caption
  if (fonts.caption?.ttf) paths.push(fonts.caption.ttf);
  if (fonts.caption?.woff2) paths.push(fonts.caption.woff2);

  return paths;
}

/**
 * Get a font file from a theme
 */
export async function getThemeFont(themeId: string, fontFile: string): Promise<Buffer | null> {
  const theme = await getTheme(themeId);
  if (!theme?.fonts) {
    return null;
  }

  // Verify the font file is in the theme's fonts list (security check)
  const validPaths = getAllFontPaths(theme.fonts);
  if (!validPaths.includes(fontFile)) {
    return null;
  }

  const fontPath = path.join(getThemeDir(themeId), fontFile);
  if (!fs.existsSync(fontPath)) {
    return null;
  }

  return fs.readFileSync(fontPath);
}

/**
 * Generate CSS custom properties from theme colors
 */
export function generateColorVariables(theme: Theme): string {
  if (!theme.colors) {
    return '';
  }

  const variables = Object.entries(theme.colors)
    .map(([key, value]) => `  --doc-${key}: ${value};`)
    .join('\n');

  return `:root {\n${variables}\n}`;
}

/**
 * Get the default theme ID
 */
export function getDefaultThemeId(): string {
  return DEFAULT_THEME_ID;
}

/**
 * Check if a theme exists
 */
export async function themeExists(themeId: string): Promise<boolean> {
  const theme = await getTheme(themeId);
  return theme !== null;
}
