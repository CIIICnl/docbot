/**
 * Draft Management
 * LocalStorage-based draft saving and loading.
 */

import { STORAGE_KEYS, DEFAULTS } from './constants.js';

/**
 * Get all saved drafts
 * @returns {Array} Array of draft objects
 */
export function getDrafts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save drafts to localStorage
 * @param {Array} drafts - Array of draft objects
 */
export function saveDrafts(drafts) {
  localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
}

/**
 * Save a new draft or update existing one with same title
 * @param {Object} options
 * @param {string} options.title - Draft title
 * @param {string} options.content - Draft content
 * @returns {Object} The saved draft
 */
export function saveDraft({ title, content }) {
  const drafts = getDrafts();
  const draftTitle = title.trim() || 'Untitled';
  const now = new Date();
  const id = `draft_${Date.now()}`;

  // Check if a draft with same title exists
  const existingIndex = drafts.findIndex((d) => d.title === draftTitle);
  const draft = {
    id,
    title: draftTitle,
    content,
    savedAt: now.toISOString(),
  };

  if (existingIndex >= 0) {
    drafts[existingIndex] = draft;
  } else {
    drafts.unshift(draft);
  }

  // Keep only last N drafts
  if (drafts.length > DEFAULTS.MAX_DRAFTS) {
    drafts.length = DEFAULTS.MAX_DRAFTS;
  }

  saveDrafts(drafts);
  return draft;
}

/**
 * Delete a draft by ID
 * @param {string} draftId - Draft ID to delete
 */
export function deleteDraft(draftId) {
  const drafts = getDrafts().filter((d) => d.id !== draftId);
  saveDrafts(drafts);
}

/**
 * Check if there are any saved drafts
 * @returns {boolean}
 */
export function hasDrafts() {
  return getDrafts().length > 0;
}
