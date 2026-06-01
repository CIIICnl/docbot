/**
 * Input Bar Component
 * Top bar with file upload, Notion import, drafts, and settings.
 */

import { h, empty } from '../../lib/dom.js';
import { post } from '../../lib/api.js';
import { populateThemeSelect, getDefaultThemeId } from '../../lib/document-themes.js';
import { checkNotionAvailable } from '../../lib/feature-detection.js';
import { success, error, warning } from '../../lib/toast.js';
import { showLoading } from '../../lib/loading.js';
import { parseDocumentFile, isWordDocument } from '../../lib/file-processing.js';
import { slButton, slSelect, slSwitch, slInput, sl } from '../../lib/shoelace.js';
import { getDrafts, saveDraft, deleteDraft } from '../../lib/drafts.js';
import { t, maybeOfferLanguageSwitch } from '../../lib/i18n.js';

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
    text: t('input.upload'),
    onClick: () => fileInput.click(),
  });

  // Notion dialog
  const notionInput = slInput({
    placeholder: t('placeholders.notionUrl'),
    size: 'medium',
    style: 'width: 100%;',
  });

  const notionDialog = sl('sl-dialog', { label: t('notion.dialogTitle') }, [
    h('p', { class: 'text-muted', style: 'margin-bottom: var(--sl-spacing-medium);' }, [
      t('notion.dialogDescription'),
    ]),
    notionInput,
    slButton({
      slot: 'footer',
      variant: 'primary',
      text: t('notion.import'),
      onClick: () => handleNotionFetch(),
    }),
  ]);

  const notionBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'box-arrow-in-right',
    text: t('input.notion'),
    onClick: () => notionDialog.show(),
  });

  // Draft controls
  const saveDraftBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'save',
    text: t('input.saveDraft'),
    onClick: () => handleSaveDraft(),
  });

  const draftsDropdown = sl('sl-dropdown', { hoist: true }, [
    slButton({
      slot: 'trigger',
      variant: 'default',
      size: 'small',
      icon: 'folder2-open',
      text: t('input.loadDraft'),
      caret: true,
    }),
    sl('sl-menu', { class: 'drafts-menu' }, []),
  ]);
  const draftsMenu = draftsDropdown.querySelector('sl-menu');

  // Title input
  const titleInput = slInput({
    placeholder: t('placeholders.documentTitle'),
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
  const tocLabel = h('label', { class: 'input-toggle-label' }, [tocSwitch, ' ' + t('input.toc')]);

  // Page numbers toggle
  const pageNumSwitch = slSwitch({ checked: true, size: 'small' });
  const pageNumLabel = h('label', { class: 'input-toggle-label' }, [pageNumSwitch, ' ' + t('input.pageNumbers')]);

  // Cover page toggle
  const coverPageSwitch = slSwitch({ checked: true, size: 'small' });
  const coverPageLabel = h('label', { class: 'input-toggle-label' }, [coverPageSwitch, ' ' + t('input.coverPage')]);

  // Cover page metadata fields
  const subtitleInput = slInput({
    placeholder: t('placeholders.subtitle'),
    size: 'small',
    style: 'width: 250px;',
  });

  const versionInput = slInput({
    placeholder: t('placeholders.version'),
    size: 'small',
    style: 'width: 80px;',
  });

  const dateInput = slInput({
    placeholder: t('placeholders.date'),
    size: 'small',
    style: 'width: 140px;',
  });

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

  coverPageSwitch.addEventListener('sl-change', (e) => {
    store.set({ coverPage: e.target.checked });
  });

  subtitleInput.addEventListener('sl-input', (e) => {
    store.set({ coverPageSubtitle: e.target.value });
  });

  versionInput.addEventListener('sl-input', (e) => {
    store.set({ coverPageVersion: e.target.value });
  });

  dateInput.addEventListener('sl-input', (e) => {
    store.set({ coverPageDate: e.target.value });
  });

  // File upload handler
  async function handleFileUpload(files) {
    const file = files?.[0];
    if (!file) return;

    const showLoadingIndicator = isWordDocument(file);
    const hide = showLoadingIndicator ? showLoading(t('loading.parsingWord')) : null;

    try {
      const result = await parseDocumentFile(file);
      onContentChange(result.markdown, result.title);

      if (result.warnings?.length > 0) {
        warning(t('toast.parsedWarnings', { count: result.warnings.length }));
      } else {
        success(t('toast.loadedFile', { filename: file.name }));
      }

      await maybeOfferLanguageSwitch(result.detectedLanguage);
    } catch (err) {
      error(t('toast.parseFailed', { error: err.message }));
    } finally {
      hide?.();
    }

    fileInput.value = '';
  }

  // Notion fetch handler
  async function handleNotionFetch() {
    const url = notionInput.value?.trim();
    if (!url) {
      warning(t('notion.errorUrl'));
      return;
    }

    notionDialog.hide();
    const hide = showLoading(t('loading.fetchingNotion'));

    try {
      const result = await post('/api/notion/fetch', { url });

      if (!result.ok) {
        throw new Error(result.data?.error || t('toast.fetchFailed', { error: '' }));
      }

      onContentChange(result.data.markdown, result.data.title);
      notionInput.value = '';
      success(t('toast.fetchedNotion'));
    } catch (err) {
      error(t('toast.fetchFailed', { error: err.message }));
    } finally {
      hide();
    }
  }

  // Draft handlers
  function handleSaveDraft() {
    const state = store.get();
    if (!state.content.trim()) {
      warning(t('toast.noContentSave'));
      return;
    }

    const draft = saveDraft({ title: state.contentTitle, content: state.content });
    updateDraftsMenu();
    success(t('toast.draftSaved', { title: draft.title }));
  }

  function handleLoadDraft(draft) {
    requestAnimationFrame(() => {
      onContentChange(draft.content, draft.title);
      success(t('toast.draftLoaded', { title: draft.title }));
    });
  }

  function handleDeleteDraft(draftId, e) {
    e.stopPropagation();
    deleteDraft(draftId);
    requestAnimationFrame(() => {
      updateDraftsMenu();
      success(t('toast.draftDeleted'));
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
        label: t('input.deleteLabel'),
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
    await populateThemeSelect(themeSelect);
    store.set({ selectedTheme: getDefaultThemeId() });
  }

  // Check Notion availability
  async function checkNotionStatus() {
    const available = await checkNotionAvailable();
    store.set({ notionAvailable: available });
    notionBtn.hidden = !available;
  }

  // Cover page metadata row (shown/hidden based on coverPage toggle)
  const coverMetadataRow = h('div', { class: 'input-bar-cover-metadata' }, [
    subtitleInput,
    versionInput,
    dateInput,
  ]);

  // Show/hide cover metadata based on toggle
  function updateCoverMetadataVisibility() {
    coverMetadataRow.hidden = !coverPageSwitch.checked;
  }
  coverPageSwitch.addEventListener('sl-change', updateCoverMetadataVisibility);
  updateCoverMetadataVisibility();

  // Build element
  const element = h('div', { class: 'converter-input-bar' }, [
    h('div', { class: 'input-bar-row' }, [
      h('div', { class: 'input-bar-sources' }, [
        uploadBtn, fileInput, notionBtn, draftsDropdown,
      ]),
      h('div', { class: 'input-bar-settings' }, [
        titleInput, themeSelect, tocLabel, pageNumLabel, coverPageLabel, saveDraftBtn,
      ]),
    ]),
    coverMetadataRow,
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
    setSubtitle(subtitle) {
      subtitleInput.value = subtitle || '';
      store.set({ coverPageSubtitle: subtitle || '' });
    },
    setVersion(version) {
      versionInput.value = version || '';
      store.set({ coverPageVersion: version || '' });
    },
    setDate(date) {
      dateInput.value = date || '';
      store.set({ coverPageDate: date || '' });
    },
  };
}
