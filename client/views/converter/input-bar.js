/**
 * Input Bar Component
 * Top bar with file upload, Notion import, drafts, and settings.
 */

import { h, empty } from '../../lib/dom.js';
import { post, get } from '../../lib/api.js';
import { success, error, warning } from '../../lib/toast.js';
import { showLoading } from '../../lib/loading.js';
import { readFileAsText, readFileAsArrayBuffer } from '../../lib/file-upload.js';
import { slButton, slSelect, slSwitch, slInput, sl } from '../../lib/shoelace.js';
import { PLACEHOLDERS } from '../../lib/constants.js';
import { getDrafts, saveDraft, deleteDraft } from '../../lib/drafts.js';

/**
 * Create the input bar component
 * @param {Object} options
 * @param {Object} options.store - State store
 * @param {Function} options.onContentChange - Called when content is loaded
 */
export function createInputBar({ store, onContentChange }) {
  // File input (hidden)
  const fileInput = h('input', {
    type: 'file',
    accept: '.md,.markdown,.txt,.docx',
    class: 'sr-only',
  });

  const uploadBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'upload',
    text: 'Upload',
    onClick: () => fileInput.click(),
  });

  // Notion dialog
  const notionInput = slInput({
    placeholder: PLACEHOLDERS.NOTION_URL,
    size: 'medium',
    style: 'width: 100%;',
  });

  const notionDialog = sl('sl-dialog', { label: 'Import from Notion' }, [
    h('p', { class: 'text-muted', style: 'margin-bottom: var(--sl-spacing-medium);' }, [
      'Enter the URL of the Notion page you want to import.',
    ]),
    notionInput,
    slButton({
      slot: 'footer',
      variant: 'primary',
      text: 'Import',
      onClick: () => handleNotionFetch(),
    }),
  ]);

  const notionBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'box-arrow-in-right',
    text: 'Notion',
    onClick: () => notionDialog.show(),
  });

  // Draft controls
  const saveDraftBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'save',
    text: 'Save Draft',
    onClick: () => handleSaveDraft(),
  });

  const draftsDropdown = sl('sl-dropdown', { hoist: true }, [
    slButton({
      slot: 'trigger',
      variant: 'default',
      size: 'small',
      icon: 'folder2-open',
      text: 'Load Draft',
      caret: true,
    }),
    sl('sl-menu', { class: 'drafts-menu' }, []),
  ]);
  const draftsMenu = draftsDropdown.querySelector('sl-menu');

  // Title input
  const titleInput = slInput({
    placeholder: PLACEHOLDERS.DOCUMENT_TITLE,
    size: 'small',
    style: 'width: 200px;',
  });

  // Theme selector
  const themeSelect = slSelect({
    value: 'default',
    size: 'small',
    style: 'width: 150px;',
    hoist: true,
  });

  // ToC toggle
  const tocSwitch = slSwitch({ checked: true, size: 'small' });
  const tocLabel = h('label', { class: 'input-toggle-label' }, [tocSwitch, ' ToC']);

  // Page numbers toggle
  const pageNumSwitch = slSwitch({ checked: true, size: 'small' });
  const pageNumLabel = h('label', { class: 'input-toggle-label' }, [pageNumSwitch, ' Page #']);

  // Event handlers
  fileInput.addEventListener('change', () => handleFileUpload(fileInput.files));

  titleInput.addEventListener('sl-input', (e) => {
    store.set({ contentTitle: e.target.value });
  });

  themeSelect.addEventListener('sl-change', (e) => {
    store.set({ selectedTheme: e.target.value });
  });

  tocSwitch.addEventListener('sl-change', (e) => {
    store.set({ generateToc: e.target.checked });
  });

  pageNumSwitch.addEventListener('sl-change', (e) => {
    store.set({ pageNumbers: e.target.checked });
  });

  // File upload handler
  async function handleFileUpload(files) {
    const file = files?.[0];
    if (!file) return;

    const isWord = file.name.toLowerCase().endsWith('.docx');

    if (isWord) {
      const hide = showLoading('Parsing Word document...');

      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const base64 = arrayBufferToBase64(arrayBuffer);

        const result = await post('/api/docx/parse', { file: base64 });

        if (!result.ok) {
          throw new Error(result.data?.error || 'Failed to parse document');
        }

        const title = result.data.title || file.name.replace(/\.docx$/i, '');
        onContentChange(result.data.markdown, title);

        if (result.data.warnings?.length > 0) {
          warning(`Parsed with ${result.data.warnings.length} warning(s)`);
        } else {
          success(`Loaded ${file.name}`);
        }
      } catch (err) {
        error(`Failed to parse document: ${err.message}`);
      } finally {
        hide();
      }
    } else {
      try {
        const text = await readFileAsText(file);
        const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
        onContentChange(text, title);
        success(`Loaded ${file.name}`);
      } catch (err) {
        error(`Failed to read file: ${err.message}`);
      }
    }

    fileInput.value = '';
  }

  // Notion fetch handler
  async function handleNotionFetch() {
    const url = notionInput.value?.trim();
    if (!url) {
      warning('Enter a Notion page URL');
      return;
    }

    notionDialog.hide();
    const hide = showLoading('Fetching Notion page...');

    try {
      const result = await post('/api/notion/fetch', { url });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Failed to fetch page');
      }

      onContentChange(result.data.markdown, result.data.title);
      notionInput.value = '';
      success('Fetched Notion page');
    } catch (err) {
      error(`Failed to fetch: ${err.message}`);
    } finally {
      hide();
    }
  }

  // Draft handlers
  function handleSaveDraft() {
    const state = store.get();
    if (!state.content.trim()) {
      warning('No content to save');
      return;
    }

    const draft = saveDraft({ title: state.contentTitle, content: state.content });
    updateDraftsMenu();
    success(`Draft saved: ${draft.title}`);
  }

  function handleLoadDraft(draft) {
    requestAnimationFrame(() => {
      onContentChange(draft.content, draft.title);
      success(`Loaded: ${draft.title}`);
    });
  }

  function handleDeleteDraft(draftId, e) {
    e.stopPropagation();
    deleteDraft(draftId);
    requestAnimationFrame(() => {
      updateDraftsMenu();
      success('Draft deleted');
    });
  }

  function updateDraftsMenu() {
    const drafts = getDrafts();
    empty(draftsMenu);

    // Hide dropdown if no drafts
    draftsDropdown.hidden = drafts.length === 0;
    if (drafts.length === 0) {
      return;
    }

    for (const draft of drafts) {
      const date = new Date(draft.savedAt);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const deleteBtn = h('sl-icon-button', {
        slot: 'suffix',
        name: 'trash',
        label: 'Delete',
        style: 'font-size: 1rem;',
      });
      deleteBtn.addEventListener('click', (e) => handleDeleteDraft(draft.id, e));

      const item = sl('sl-menu-item', { value: draft.id }, [
        h('div', { class: 'draft-item' }, [
          h('span', { class: 'draft-title' }, [draft.title]),
          h('span', { class: 'draft-date text-muted' }, [dateStr]),
        ]),
        deleteBtn,
      ]);
      item._draft = draft; // Store draft reference on element
      draftsMenu.appendChild(item);
    }
  }

  // Use sl-select event on menu instead of individual click handlers
  draftsMenu.addEventListener('sl-select', (e) => {
    const item = e.detail.item;
    if (item?._draft) {
      handleLoadDraft(item._draft);
    }
  });

  // Initialize themes
  async function loadThemes() {
    try {
      const result = await get('/api/themes');
      if (result.ok) {
        store.set({
          themes: result.data.themes,
          selectedTheme: result.data.defaultThemeId,
        });

        for (const theme of result.data.themes) {
          themeSelect.appendChild(sl('sl-option', { value: theme.id }, [theme.name]));
        }
        themeSelect.value = result.data.defaultThemeId;
      }
    } catch {}
  }

  // Check Notion availability
  async function checkNotionStatus() {
    try {
      const response = await fetch('/api/notion/status');
      const data = await response.json();
      store.set({ notionAvailable: data.available });
      notionBtn.hidden = !data.available;
    } catch {
      notionBtn.hidden = true;
    }
  }

  // Utility
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Build element
  const element = h('div', { class: 'converter-input-bar' }, [
    h('div', { class: 'input-bar-sources' }, [
      uploadBtn, fileInput, notionBtn, draftsDropdown,
    ]),
    h('div', { class: 'input-bar-settings' }, [
      titleInput, themeSelect, tocLabel, pageNumLabel, saveDraftBtn,
    ]),
  ]);

  // Initialize
  loadThemes();
  checkNotionStatus();
  updateDraftsMenu();

  return {
    element,
    notionDialog,
    setTitle(title) {
      titleInput.value = title;
    },
  };
}
