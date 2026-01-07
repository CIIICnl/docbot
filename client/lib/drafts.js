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
 * Get a draft by ID
 * @param {string} draftId - Draft ID
 * @returns {Object|null} The draft or null if not found
 */
export function getDraftById(draftId) {
  const drafts = getDrafts();
  return drafts.find((d) => d.id === draftId) || null;
}

/**
 * Create a new draft with default settings
 * @param {Object} options
 * @param {string} options.title - Draft title
 * @param {string} options.content - Draft content
 * @param {Object} [options.settings] - Optional settings
 * @param {Object} [options.aiChanges] - AI enhancement changes/suggestions to show
 * @returns {Object} The created draft
 */
export function createDraft({ title, content, settings = {}, aiChanges = null }) {
  const drafts = getDrafts();
  const now = new Date().toISOString();
  const id = `draft_${Date.now()}`;

  const draft = {
    id,
    title: title.trim() || 'Untitled',
    content: content || '',
    createdAt: now,
    modifiedAt: now,
    settings: {
      themeId: settings.themeId || DEFAULTS.THEME,
      generateToc: settings.generateToc !== false,
      pageNumbers: settings.pageNumbers !== false,
      coverPage: settings.coverPage !== false,
      coverPageOptions: settings.coverPageOptions || {
        subtitle: '',
        version: '',
        date: '',
      },
    },
    // Store AI changes to display in editor (one-time, cleared after viewing)
    aiChanges: aiChanges || null,
  };

  drafts.unshift(draft);

  // Keep only last N drafts
  if (drafts.length > DEFAULTS.MAX_DRAFTS) {
    drafts.length = DEFAULTS.MAX_DRAFTS;
  }

  saveDrafts(drafts);
  return draft;
}

/**
 * Save a new draft or update existing one with same title
 * @param {Object} options
 * @param {string} options.title - Draft title
 * @param {string} options.content - Draft content
 * @returns {Object} The saved draft
 * @deprecated Use createDraft or updateDraft instead
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
    modifiedAt: now.toISOString(),
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
 * Update an existing draft by ID
 * @param {string} draftId - Draft ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} The updated draft or null if not found
 */
export function updateDraft(draftId, updates) {
  const drafts = getDrafts();
  const index = drafts.findIndex((d) => d.id === draftId);

  if (index === -1) return null;

  const draft = drafts[index];
  const now = new Date().toISOString();

  // Update fields
  if (updates.title !== undefined) draft.title = updates.title;
  if (updates.content !== undefined) draft.content = updates.content;
  if (updates.settings !== undefined) {
    draft.settings = { ...draft.settings, ...updates.settings };
  }
  if ('aiChanges' in updates) draft.aiChanges = updates.aiChanges;
  draft.modifiedAt = now;

  drafts[index] = draft;
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

/**
 * Get a preview of draft content
 * @param {Object} draft - Draft object
 * @param {number} maxLength - Maximum length of preview
 * @returns {string} Preview text
 */
export function getDraftPreview(draft, maxLength = 150) {
  if (!draft?.content) return '';

  // Remove markdown syntax for cleaner preview
  let preview = draft.content
    .replace(/^#{1,6}\s+/gm, '') // Remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\n+/g, ' ') // Collapse newlines
    .trim();

  if (preview.length > maxLength) {
    preview = preview.slice(0, maxLength).trim() + '...';
  }

  return preview;
}
