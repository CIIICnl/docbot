/**
 * Feature Detection Service
 * Checks availability of optional features (Notion, LLM, etc.) with caching.
 */

import { get } from './api.js';

// Cached feature states
let notionAvailable = null;
let llmProviders = null;
let notionPromise = null;
let llmPromise = null;

/**
 * Check if Notion integration is available
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass cache
 * @returns {Promise<boolean>}
 */
export async function checkNotionAvailable(options = {}) {
  const { forceRefresh = false } = options;

  // Return cached value if available
  if (!forceRefresh && notionAvailable !== null) {
    return notionAvailable;
  }

  // If already checking, wait for that promise
  if (notionPromise && !forceRefresh) {
    return notionPromise;
  }

  notionPromise = (async () => {
    try {
      const response = await fetch('/api/notion/status');
      const data = await response.json();
      notionAvailable = data.available === true;
    } catch {
      notionAvailable = false;
    }
    return notionAvailable;
  })();

  return notionPromise;
}

/**
 * @typedef {Object} LlmProviders
 * @property {boolean} none - No AI (always available)
 * @property {boolean} openai - OpenAI API available
 * @property {boolean} claude - Claude API available
 * @property {boolean} mistral - Mistral API available
 */

/**
 * Check which LLM providers are available
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass cache
 * @returns {Promise<LlmProviders>}
 */
export async function checkLlmProviders(options = {}) {
  const { forceRefresh = false } = options;

  // Return cached value if available
  if (!forceRefresh && llmProviders !== null) {
    return llmProviders;
  }

  // If already checking, wait for that promise
  if (llmPromise && !forceRefresh) {
    return llmPromise;
  }

  llmPromise = (async () => {
    try {
      const result = await get('/api/llm/status');
      if (result.ok) {
        llmProviders = result.data.providers || { none: true, openai: false, claude: false, mistral: false };
      } else {
        llmProviders = { none: true, openai: false, claude: false, mistral: false };
      }
    } catch {
      llmProviders = { none: true, openai: false, claude: false, mistral: false };
    }
    return llmProviders;
  })();

  return llmPromise;
}

/**
 * Check if any LLM provider is available
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass cache
 * @returns {Promise<boolean>}
 */
export async function checkLlmAvailable(options = {}) {
  const providers = await checkLlmProviders(options);
  return providers.openai || providers.claude || providers.mistral;
}

/**
 * Get cached Notion availability (returns null if not checked yet)
 * @returns {boolean|null}
 */
export function getNotionAvailable() {
  return notionAvailable;
}

/**
 * Get cached LLM providers (returns null if not checked yet)
 * @returns {LlmProviders|null}
 */
export function getLlmProviders() {
  return llmProviders;
}

/**
 * Clear all feature detection caches
 */
export function clearFeatureCache() {
  notionAvailable = null;
  llmProviders = null;
  notionPromise = null;
  llmPromise = null;
}

/**
 * Preload all feature detection (useful on app init)
 * @returns {Promise<void>}
 */
export async function preloadFeatures() {
  await Promise.all([
    checkNotionAvailable(),
    checkLlmProviders(),
  ]);
}
