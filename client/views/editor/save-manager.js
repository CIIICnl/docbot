/**
 * Save Manager
 * Handles autosave functionality for drafts with server sync.
 */

import { updateDraft } from '../../lib/drafts.js';
import { success } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';

/**
 * Create a save manager for autosaving drafts
 * @param {Object} options
 * @param {Object} options.store - State store
 * @param {string} options.draftId - Draft ID
 * @param {number} [options.autosaveDelay=1500] - Autosave delay in ms
 * @returns {Object} Save manager API
 */
export function createSaveManager({ store, draftId, autosaveDelay = 1500 }) {
  let dirty = false;
  let autosaveTimer = null;
  let lastSavedAt = null;

  /**
   * Schedule an autosave
   */
  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (dirty) requestSave();
    }, autosaveDelay);
  }

  /**
   * Mark the draft as dirty (unsaved changes)
   */
  function markDirty() {
    dirty = true;
    scheduleAutosave();
  }

  /**
   * Save the draft immediately
   */
  function requestSave() {
    if (!dirty) return;

    const state = store.get();

    const updated = updateDraft(draftId, {
      title: state.contentTitle,
      content: state.content,
      settings: {
        themeId: state.selectedTheme,
        generateToc: state.generateToc,
        pageNumbers: state.pageNumbers,
        coverPage: state.coverPage,
        coverPageOptions: {
          subtitle: state.coverPageSubtitle,
          version: state.coverPageVersion,
          date: state.coverPageDate,
        },
        pageBreakHeadings: state.pageBreakHeadings,
      },
    });

    if (updated) {
      dirty = false;
      lastSavedAt = new Date();
      success(t('editor.saved'), { id: 'save-status', duration: 1500 });
    }
  }

  /**
   * Cancel pending autosave
   */
  function cancelAutosave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  }

  /**
   * Flush any pending save (save immediately)
   */
  function flush() {
    cancelAutosave();
    if (dirty) requestSave();
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean}
   */
  function isDirty() {
    return dirty;
  }

  /**
   * Get the last saved timestamp
   * @returns {Date|null}
   */
  function getLastSavedAt() {
    return lastSavedAt;
  }

  /**
   * Cleanup
   */
  function destroy() {
    cancelAutosave();
  }

  return {
    markDirty,
    requestSave,
    cancelAutosave,
    flush,
    isDirty,
    getLastSavedAt,
    destroy,
  };
}
