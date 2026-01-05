/**
 * Themes API Routes
 * List and get theme information
 */

import type { ApiContext } from './index.js';
import { ok, notFound, matchPath } from '../../utils/http.js';
import { listThemes, getTheme, getThemeStyles, getThemeFont, getDefaultThemeId } from '../../services/themes.js';

/**
 * Handle theme routes
 */
export async function handleThemes(ctx: ApiContext): Promise<boolean> {
  const { req, res, url } = ctx;
  const path = url.pathname;

  // GET /api/themes - List all themes
  if (path === '/api/themes' && req.method === 'GET') {
    const themes = await listThemes();
    const defaultId = getDefaultThemeId();

    ok(res, {
      themes,
      defaultThemeId: defaultId,
    });
    return true;
  }

  // GET /api/themes/:id - Get theme details
  const themeMatch = matchPath('/api/themes/:id', path);
  if (themeMatch?.id && req.method === 'GET') {
    const theme = await getTheme(themeMatch.id);

    if (!theme) {
      notFound(res, 'Theme not found');
      return true;
    }

    ok(res, theme);
    return true;
  }

  // GET /api/themes/:id/styles - Get theme CSS
  const stylesMatch = matchPath('/api/themes/:id/styles', path);
  if (stylesMatch?.id && req.method === 'GET') {
    const styles = await getThemeStyles(stylesMatch.id);

    if (!styles) {
      notFound(res, 'Theme not found');
      return true;
    }

    // Return CSS directly
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(styles);
    return true;
  }

  // GET /api/themes/:id/fonts/:filename - Serve theme font files
  const fontsMatch = matchPath('/api/themes/:id/fonts/:filename', path);
  if (fontsMatch?.id && fontsMatch?.filename && req.method === 'GET') {
    const fontFile = decodeURIComponent(fontsMatch.filename);
    const fontBuffer = await getThemeFont(fontsMatch.id, fontFile);

    if (!fontBuffer) {
      notFound(res, 'Font not found');
      return true;
    }

    // Determine MIME type
    const mimeType = fontFile.endsWith('.woff2')
      ? 'font/woff2'
      : fontFile.endsWith('.woff')
        ? 'font/woff'
        : fontFile.endsWith('.otf')
          ? 'font/otf'
          : 'font/ttf';

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': fontBuffer.length,
      'Cache-Control': 'max-age=31536000', // Cache fonts for 1 year
    });
    res.end(fontBuffer);
    return true;
  }

  return false;
}
