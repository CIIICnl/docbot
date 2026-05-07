/**
 * Editor View
 * Document editing interface with autosave and live preview.
 */

import { h, empty } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import {
  getDraftById,
  findDraftByServerId,
  loadOrCreateDraftForServerId,
  updateDraft,
} from '../../lib/drafts.js';
import { get } from '../../lib/api.js';
import { warning } from '../../lib/toast.js';
import { createConverterState } from './state.js';
import { createEditorBar } from './editor-bar.js';
import { createMarkdownPanel } from './markdown-panel.js';
import { createImagesPanel } from './images-panel.js';
import { createPreviewPanel } from './preview-panel.js';
import { createChangesSidebar } from './changes-sidebar.js';
import { createActionsBar } from './actions-bar.js';
import { createSaveManager } from './save-manager.js';
import { sl, slButton } from '../../lib/shoelace.js';

/**
 * Render the editor view
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string} options.draftId - Draft ID to edit
 * @param {Function} options.navigate - Navigation function
 */
export async function renderEditor(container, { draftId, navigate }) {
  empty(container);

  // Resolve the route id to a localStorage draft. Three cases:
  //   1. `draft_<ts>_…`  → direct match in localStorage (the common path)
  //   2. UUID matching `serverId` of an existing draft → reuse it
  //   3. UUID with no local draft yet → fetch the server doc and seed
  //      a draft. Happens when an external caller (ciiicbot) creates
  //      a document via the internal API and links the user straight
  //      to /edit/<server-uuid> without going through the client's
  //      draft-creation flow.
  let draft = getDraftById(draftId);
  if (!draft) draft = findDraftByServerId(draftId);
  if (!draft) {
    draft = await loadOrCreateDraftForServerId(draftId);
    if (draft) {
      // Bring the URL in line with the local draft id so save/sync
      // (which keys on draftId) and the address bar agree on which
      // draft is open.
      navigate(`/edit/${draft.id}`, { replace: true });
      draftId = draft.id;
    }
  }
  if (!draft) {
    warning(t('editor.draftNotFound'));
    navigate('/');
    return () => {};
  }

  // Create shared state store
  const store = createConverterState();

  // Initialize state from draft
  store.set({
    content: draft.content || '',
    contentTitle: draft.title || '',
    selectedTheme: draft.settings?.themeId || 'default',
    generateToc: draft.settings?.generateToc !== false,
    pageNumbers: draft.settings?.pageNumbers !== false,
    coverPage: draft.settings?.coverPage !== false,
    coverPageSubtitle: draft.settings?.coverPageOptions?.subtitle || '',
    coverPageVersion: draft.settings?.coverPageOptions?.version || '',
    coverPageDate: draft.settings?.coverPageOptions?.date || '',
    pageBreakHeadings: draft.settings?.pageBreakHeadings === true,
  });

  // Create save manager
  const saveManager = createSaveManager({ store, draftId });

  // Track editor area for sidebar class toggling
  let editorAreaEl = null;

  // Mark dirty when state changes (for autosave)
  const unsubscribe = store.subscribe((state, prev) => {
    // Check if any saveable field changed
    const saveableFields = [
      'content',
      'contentTitle',
      'selectedTheme',
      'generateToc',
      'pageNumbers',
      'coverPage',
      'coverPageSubtitle',
      'coverPageVersion',
      'coverPageDate',
      'pageBreakHeadings',
    ];
    const changed = saveableFields.some((key) => state[key] !== prev[key]);
    if (changed) {
      saveManager.markDirty();
    }
  });

  // Create components
  const editorBar = createEditorBar({
    store,
    draftTitle: draft.title,
    onTitleChange: (title) => {
      store.set({ contentTitle: title });
    },
  });

  const markdownPanel = createMarkdownPanel({
    store,
    onContentChange: (content) => {
      // Clear original content when user manually edits
      const state = store.get();
      if (state.originalContent !== null) {
        store.set({ originalContent: null });
        changesSidebar.hide();
        if (editorAreaEl) {
          editorAreaEl.classList.remove('has-changes');
        }
      }
      previewPanel.updatePreview();
    },
  });

  // Set initial content in markdown panel
  markdownPanel.setValue(draft.content || '');

  const previewPanel = createPreviewPanel({ store });

  const imagesPanel = createImagesPanel({
    store,
    setMarkdown: (next) => {
      store.set({ content: next });
      markdownPanel.setValue(next);
      previewPanel.updatePreview();
    },
  });

  const changesSidebar = createChangesSidebar({
    store,
    onUndo: () => {
      const state = store.get();
      if (state.originalContent !== null) {
        store.set({ content: state.originalContent, originalContent: null });
        markdownPanel.setValue(state.originalContent);
        previewPanel.updatePreview();
        changesSidebar.hide();
        if (editorAreaEl) {
          editorAreaEl.classList.remove('has-changes');
        }
      }
    },
  });

  const actionsBar = createActionsBar({
    store,
    onEnhanceComplete: ({ enhanced, changes, detailedChanges, suggestions, overallImpression, coverPage, willModify }) => {
      if (willModify && enhanced) {
        store.set({ content: enhanced });
        markdownPanel.setValue(enhanced);
        previewPanel.updatePreview();
      }

      // Store cover page metadata if extracted
      if (coverPage) {
        store.set({
          coverPageSubtitle: coverPage.subtitle || '',
          coverPageVersion: coverPage.version || 'v1.0',
          coverPageDate: coverPage.date || '',
        });
      }

      if (changes.length > 0 || suggestions.length > 0 || overallImpression) {
        changesSidebar.displayChanges(changes, detailedChanges, suggestions, overallImpression);
        changesSidebar.show();
        if (editorAreaEl) {
          editorAreaEl.classList.add('has-changes');
        }
      }
    },
  });

  // Load themes
  async function loadThemes() {
    try {
      const result = await get('/api/themes');
      if (result.ok) {
        store.set({ themes: result.data.themes });
        editorBar.setThemes(result.data.themes);
      }
    } catch {}
  }

  // Build layout
  editorAreaEl = h('div', { class: 'converter-editor-area has-images' }, [
    markdownPanel.element,
    imagesPanel.element,
    previewPanel.element,
    changesSidebar.element,
  ]);

  const page = h('div', { class: 'editor-page' }, [
    editorBar.element,
    editorAreaEl,
    actionsBar.element,
    actionsBar.enhanceDialog,
  ]);

  container.appendChild(page);

  // Initialize
  loadThemes();
  previewPanel.updatePreview();

  // Check if draft has AI changes to display (from new document creation)
  if (draft.aiChanges) {
    const { changes, detailedChanges, suggestions, overallImpression, originalContent } = draft.aiChanges;

    // Store original content for undo
    if (originalContent) {
      store.set({ originalContent });
    }

    // Display changes in sidebar
    if (changes.length > 0 || suggestions.length > 0 || overallImpression) {
      changesSidebar.displayChanges(changes, detailedChanges || [], suggestions, overallImpression);
      changesSidebar.show();
      editorAreaEl.classList.add('has-changes');
    }

    // Clear AI changes from draft (one-time display)
    updateDraft(draftId, { aiChanges: null });
  }

  // Warn before leaving with unsaved changes
  const handleBeforeUnload = (e) => {
    if (saveManager.isDirty()) {
      e.preventDefault();
      e.returnValue = t('editor.unsavedChanges');
      return e.returnValue;
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Cleanup function
  return () => {
    saveManager.flush();
    saveManager.destroy();
    unsubscribe();
    imagesPanel.destroy();
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
