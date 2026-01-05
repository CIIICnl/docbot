// Theme management service

import * as fs from 'fs';
import * as path from 'path';
import { getRoot } from '../config/env.js';
import type { Theme } from '../types/index.js';

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
 * Generate @font-face rules for a theme's fonts
 * Embeds fonts as base64 data URLs for PDF generation
 */
export async function generateFontFaceRules(themeId: string): Promise<string> {
  const theme = await getTheme(themeId);
  if (!theme?.fonts || theme.fonts.length === 0) {
    return '';
  }

  const themeDir = getThemeDir(themeId);
  const rules: string[] = [];

  for (const font of theme.fonts) {
    const fontPath = path.join(themeDir, font.src);

    if (!fs.existsSync(fontPath)) {
      console.warn(`Font file not found: ${fontPath}`);
      continue;
    }

    const fontData = fs.readFileSync(fontPath);
    const base64 = fontData.toString('base64');
    const mimeType = font.src.endsWith('.woff2')
      ? 'font/woff2'
      : font.src.endsWith('.woff')
        ? 'font/woff'
        : 'font/ttf';

    rules.push(`
      @font-face {
        font-family: '${font.family}';
        font-weight: ${font.weight || 400};
        font-style: ${font.style || 'normal'};
        src: url(data:${mimeType};base64,${base64}) format('${mimeType === 'font/woff2' ? 'woff2' : mimeType === 'font/woff' ? 'woff' : 'truetype'}');
      }
    `);
  }

  return rules.join('\n');
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
