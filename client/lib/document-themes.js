/**
 * Document Themes Service
 * Manages PDF/document styling themes with caching.
 */

import { get } from './api.js';
import { sl } from './shoelace.js';
import { DEFAULTS } from './constants.js';

/**
 * @typedef {Object} DocumentTheme
 * @property {string} id - Theme identifier
 * @property {string} name - Display name
 */

// Cached themes (singleton pattern)
let cachedThemes = null;
let cachedDefaultThemeId = DEFAULTS.THEME;
let loadPromise = null;

/**
 * Load themes from API (with caching)
 * @returns {Promise<{themes: DocumentTheme[], defaultThemeId: string}>}
 */
export async function loadDocumentThemes() {
  // Return cached data if available
  if (cachedThemes !== null) {
    return {
      themes: cachedThemes,
      defaultThemeId: cachedDefaultThemeId,
    };
  }

  // If already loading, wait for that promise
  if (loadPromise) {
    return loadPromise;
  }

  // Start loading
  loadPromise = (async () => {
    try {
      const result = await get('/api/themes');
      if (result.ok) {
        cachedThemes = result.data.themes || [];
        cachedDefaultThemeId = result.data.defaultThemeId || DEFAULTS.THEME;
      } else {
        cachedThemes = [];
      }
    } catch {
      cachedThemes = [];
    }

    return {
      themes: cachedThemes,
      defaultThemeId: cachedDefaultThemeId,
    };
  })();

  return loadPromise;
}

/**
 * Get cached themes (returns empty array if not loaded yet)
 * @returns {DocumentTheme[]}
 */
export function getDocumentThemes() {
  return cachedThemes || [];
}

/**
 * Get default theme ID
 * @returns {string}
 */
export function getDefaultThemeId() {
  return cachedDefaultThemeId;
}

/**
 * Populate a Shoelace select element with theme options
 * @param {HTMLElement} selectElement - The sl-select element
 * @param {Object} [options]
 * @param {boolean} [options.setDefault=true] - Set the default theme as selected
 * @returns {Promise<void>}
 */
export async function populateThemeSelect(selectElement, options = {}) {
  const { setDefault = true } = options;

  const { themes, defaultThemeId } = await loadDocumentThemes();

  for (const theme of themes) {
    selectElement.appendChild(sl('sl-option', { value: theme.id }, [theme.name]));
  }

  if (setDefault) {
    selectElement.value = defaultThemeId;
  }
}

/**
 * Clear the theme cache (useful for testing or forcing refresh)
 */
export function clearThemeCache() {
  cachedThemes = null;
  cachedDefaultThemeId = DEFAULTS.THEME;
  loadPromise = null;
}
