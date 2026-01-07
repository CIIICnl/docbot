/**
 * Search Module
 * Markdown and preview search functionality.
 */

import {
  TextSearchController,
  DOMSearchController,
  SEARCH_HIGHLIGHT_CSS,
} from '../../lib/search-controller.js';

/**
 * Create markdown search functionality
 * @param {Object} options
 * @param {HTMLElement} options.textarea - Shoelace textarea element
 * @returns {Object} Search controller
 */
export function createMarkdownSearch({ textarea }) {
  const controller = new TextSearchController(textarea);

  return {
    searchBar: controller.searchBar,
    toggle: controller.toggle,
    clear: () => controller.clear(),
  };
}

/**
 * Create preview search functionality
 * @param {Object} options
 * @param {HTMLIFrameElement} options.iframe - Preview iframe element
 * @returns {Object} Search controller
 */
export function createPreviewSearch({ iframe }) {
  const controller = new DOMSearchController(iframe);

  return {
    searchBar: controller.searchBar,
    toggle: controller.toggle,
    clear: () => controller.clear(),
    hasActiveSearch: () => controller.hasActiveSearch(),
  };
}

// Re-export CSS for convenience
export { SEARCH_HIGHLIGHT_CSS };
