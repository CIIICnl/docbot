/**
 * Converter View
 * Document conversion interface with component-based architecture.
 */

import { h, empty } from '../../lib/dom.js';
import { createConverterState } from './state.js';
import { createInputBar } from './input-bar.js';
import { createMarkdownPanel } from './markdown-panel.js';
import { createPreviewPanel } from './preview-panel.js';
import { createChangesSidebar } from './changes-sidebar.js';
import { createActionsBar } from './actions-bar.js';

/**
 * Render the converter view
 * @param {HTMLElement} container
 */
export async function renderConverter(container) {
  empty(container);

  // Create shared state store
  const store = createConverterState();

  // Track editor area for sidebar class toggling
  let editorAreaEl = null;

  // Create components
  const inputBar = createInputBar({
    store,
    onContentChange: (content, title) => {
      store.set({ content, contentTitle: title, originalContent: null });
      markdownPanel.setValue(content);
      inputBar.setTitle(title);
      previewPanel.updatePreview();
      changesSidebar.hide();
      if (editorAreaEl) {
        editorAreaEl.classList.remove('has-changes');
      }
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

  const previewPanel = createPreviewPanel({ store });

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
    onEnhanceComplete: ({ enhanced, changes, suggestions, coverPage, willModify }) => {
      if (willModify && enhanced) {
        store.set({ content: enhanced });
        markdownPanel.setValue(enhanced);
        previewPanel.updatePreview();
      }

      // Store cover page metadata if extracted and update input fields
      if (coverPage) {
        inputBar.setSubtitle(coverPage.subtitle || '');
        inputBar.setVersion(coverPage.version || 'v1.0');
        inputBar.setDate(coverPage.date || '');
      }

      if (changes.length > 0 || suggestions.length > 0) {
        changesSidebar.displayChanges(changes, suggestions);
        changesSidebar.show();
        if (editorAreaEl) {
          editorAreaEl.classList.add('has-changes');
        }
      }
    },
  });

  // Build layout
  editorAreaEl = h('div', { class: 'converter-editor-area' }, [
    markdownPanel.element,
    previewPanel.element,
    changesSidebar.element,
  ]);

  const page = h('div', { class: 'converter-page-v2' }, [
    inputBar.element,
    editorAreaEl,
    actionsBar.element,
    inputBar.notionDialog,
    actionsBar.enhanceDialog,
  ]);

  container.appendChild(page);

  return () => {};
}
