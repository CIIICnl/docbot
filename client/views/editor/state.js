/**
 * Converter State Management
 * Centralized reactive state for the converter view.
 */

import { STORAGE_KEYS, DEFAULTS } from '../../lib/constants.js';

/**
 * Create a reactive state store with subscribers
 * @returns {Object} State store with get, set, and subscribe methods
 */
export function createStore(initialState) {
  let state = { ...initialState };
  const subscribers = new Set();

  return {
    get(key) {
      return key ? state[key] : { ...state };
    },

    set(updates) {
      const prev = { ...state };
      state = { ...state, ...updates };
      subscribers.forEach((fn) => fn(state, prev));
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

/**
 * Create the converter state store
 */
export function createConverterState() {
  return createStore({
    // Document content
    content: '',
    contentTitle: '',
    originalContent: null, // For undo after AI enhancement

    // Settings
    selectedTheme: 'default',
    generateToc: true,
    pageNumbers: true,
    coverPage: true,

    // Cover page options (populated by AI enhancement)
    coverPageSubtitle: '',
    coverPageVersion: '',
    coverPageDate: '',

    // Available options
    themes: [],
    llmProviders: { openai: false, claude: false, mistral: false },
    notionAvailable: false,

    // AI changes
    changes: [],
    suggestions: [],
    showChangesSidebar: false,
  });
}

/**
 * Get the current LLM provider from settings
 */
export function getProvider() {
  return localStorage.getItem(STORAGE_KEYS.DEFAULT_PROVIDER) || DEFAULTS.PROVIDER;
}

/**
 * Get the global AI context from settings
 */
export function getGlobalContext() {
  return localStorage.getItem(STORAGE_KEYS.GLOBAL_CONTEXT) || '';
}
