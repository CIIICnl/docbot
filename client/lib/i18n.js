/**
 * Internationalization (i18n) Module
 * Lightweight translation system for the application.
 */

import { STORAGE_KEYS } from './constants.js';

// Default and supported locales
const DEFAULT_LOCALE = 'nl';
const SUPPORTED_LOCALES = ['en', 'nl'];

// Loaded translations cache
let translations = {};
let currentLocale = DEFAULT_LOCALE;

/**
 * Initialize the i18n system
 * Loads the stored locale preference and translation file
 */
export async function initI18n() {
  const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
  const locale = stored && SUPPORTED_LOCALES.includes(stored) ? stored : DEFAULT_LOCALE;
  await setLocale(locale, false); // Don't dispatch event on init
}

/**
 * Set the current locale and load translations
 * @param {string} locale - Locale code (e.g., 'en', 'nl')
 * @param {boolean} dispatchEvent - Whether to dispatch localechange event
 */
export async function setLocale(locale, dispatchEvent = true) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    console.warn(`Unsupported locale: ${locale}, falling back to ${DEFAULT_LOCALE}`);
    locale = DEFAULT_LOCALE;
  }

  try {
    const module = await import(`../locales/${locale}.js`);
    translations = module.default;
    currentLocale = locale;
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, locale);

    if (dispatchEvent) {
      window.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
    }
  } catch (err) {
    console.error(`Failed to load locale ${locale}:`, err);
    if (locale !== DEFAULT_LOCALE) {
      await setLocale(DEFAULT_LOCALE, dispatchEvent);
    }
  }
}

/**
 * Get the current locale
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Get supported locales for UI display
 * @returns {Array<{code: string, name: string}>}
 */
export function getSupportedLocales() {
  return [
    { code: 'en', name: 'English' },
    { code: 'nl', name: 'Nederlands' },
  ];
}

// Self-contained copy (in the target language) so the prompt reads naturally
// without needing extra keys in every locale file.
const LANGUAGE_SWITCH_COPY = {
  nl: {
    title: 'Taal aanpassen?',
    body: 'Dit document lijkt Nederlandstalig, maar de app staat op Engels. Wil je de taal op Nederlands zetten? Dat zorgt o.a. voor een Nederlandse inhoudsopgave.',
    confirm: 'Op Nederlands zetten',
    cancel: 'Laten staan',
  },
  en: {
    title: 'Switch language?',
    body: 'This document looks English, but the app is set to Dutch. Switch the language to English? This also gives you an English table of contents.',
    confirm: 'Switch to English',
    cancel: 'Keep current',
  },
};

/**
 * If an imported document's detected language differs from the active UI
 * language, offer to switch (so the table of contents and PDF metadata match
 * the document). Returns true if the locale was changed.
 * @param {'nl'|'en'|null|undefined} detectedLanguage
 * @returns {Promise<boolean>}
 */
export async function maybeOfferLanguageSwitch(detectedLanguage) {
  if (!detectedLanguage || !SUPPORTED_LOCALES.includes(detectedLanguage)) return false;
  if (detectedLanguage === getLocale()) return false;
  const copy = LANGUAGE_SWITCH_COPY[detectedLanguage];
  if (!copy) return false;
  // Lazy import to avoid pulling the dialog layer into i18n init.
  const { confirm } = await import('./dialogs.js');
  const ok = await confirm({
    title: copy.title,
    message: copy.body,
    confirmText: copy.confirm,
    cancelText: copy.cancel,
  });
  if (ok) {
    await setLocale(detectedLanguage);
    return true;
  }
  return false;
}

/**
 * Navigate nested object using dot notation
 * @param {Object} obj - Object to navigate
 * @param {string} path - Dot-separated path
 * @returns {*}
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Translate a key with optional parameter interpolation
 * @param {string} key - Dot-notation key (e.g., 'settings.title')
 * @param {Object} params - Interpolation parameters
 * @returns {string}
 */
export function t(key, params = {}) {
  const value = getNestedValue(translations, key);

  if (value === undefined) {
    console.warn(`Missing translation: ${key}`);
    return key; // Return key as fallback
  }

  if (typeof value !== 'string') {
    // Allow non-strings (e.g., arrays) to be returned as-is for special cases
    return value;
  }

  // Interpolate {param} placeholders
  return value.replace(/\{(\w+)\}/g, (match, param) => {
    return params[param] !== undefined ? String(params[param]) : match;
  });
}

/**
 * Get a random item from a translation array
 * Useful for loading messages
 * @param {string} key - Key pointing to an array
 * @returns {string}
 */
export function tRandom(key) {
  const arr = t(key);
  if (Array.isArray(arr)) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  return arr;
}
