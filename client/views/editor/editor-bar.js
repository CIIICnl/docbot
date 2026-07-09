/**
 * Editor Bar Component
 * Top bar for the editor with title, theme, and document settings.
 */

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { slSelect, slSwitch, slInput, sl } from '../../lib/shoelace.js';

/**
 * Create the editor bar component
 * @param {Object} options
 * @param {Object} options.store - State store
 * @param {string} options.draftTitle - Initial draft title
 * @param {Function} options.onTitleChange - Called when title changes
 */
export function createEditorBar({ store, draftTitle, onTitleChange }) {
  // Title input
  const titleInput = slInput({
    placeholder: t('placeholders.documentTitle'),
    size: 'small',
    value: draftTitle || '',
    style: 'width: 250px;',
  });

  titleInput.addEventListener('sl-input', (e) => {
    onTitleChange?.(e.target.value);
  });

  // Theme selector
  const themeSelect = slSelect({
    value: store.get('selectedTheme') || 'default',
    size: 'small',
    style: 'width: 150px;',
    hoist: true,
  });

  themeSelect.addEventListener('sl-change', (e) => {
    store.set({ selectedTheme: e.target.value });
  });

  // ToC toggle
  const tocSwitch = slSwitch({ checked: store.get('generateToc'), size: 'small' });
  const tocLabel = h('label', { class: 'input-toggle-label' }, [tocSwitch, ' ' + t('input.toc')]);

  tocSwitch.addEventListener('sl-change', (e) => {
    store.set({ generateToc: e.target.checked });
  });

  // Page numbers toggle
  const pageNumSwitch = slSwitch({ checked: store.get('pageNumbers'), size: 'small' });
  const pageNumLabel = h('label', { class: 'input-toggle-label' }, [pageNumSwitch, ' ' + t('input.pageNumbers')]);

  pageNumSwitch.addEventListener('sl-change', (e) => {
    store.set({ pageNumbers: e.target.checked });
  });

  // Cover page toggle
  const coverPageSwitch = slSwitch({ checked: store.get('coverPage'), size: 'small' });
  const coverPageLabel = h('label', { class: 'input-toggle-label' }, [coverPageSwitch, ' ' + t('input.coverPage')]);

  coverPageSwitch.addEventListener('sl-change', (e) => {
    store.set({ coverPage: e.target.checked });
    updateCoverMetadataVisibility();
  });

  // Page break toggles - independent per heading level, so you can start each
  // H1 on a new page without also breaking before every H2.
  const pageBreakH1Switch = slSwitch({ checked: store.get('pageBreakBeforeH1'), size: 'small' });
  const pageBreakH1Label = h('label', { class: 'input-toggle-label' }, [pageBreakH1Switch, ' ' + t('input.pageBreakBeforeH1')]);

  pageBreakH1Switch.addEventListener('sl-change', (e) => {
    store.set({ pageBreakBeforeH1: e.target.checked });
  });

  const pageBreakH2Switch = slSwitch({ checked: store.get('pageBreakBeforeH2'), size: 'small' });
  const pageBreakH2Label = h('label', { class: 'input-toggle-label' }, [pageBreakH2Switch, ' ' + t('input.pageBreakBeforeH2')]);

  pageBreakH2Switch.addEventListener('sl-change', (e) => {
    store.set({ pageBreakBeforeH2: e.target.checked });
  });

  // Cover page metadata fields
  const subtitleInput = slInput({
    placeholder: t('placeholders.subtitle'),
    size: 'small',
    value: store.get('coverPageSubtitle') || '',
    style: 'width: 250px;',
  });

  const versionInput = slInput({
    placeholder: t('placeholders.version'),
    size: 'small',
    value: store.get('coverPageVersion') || '',
    style: 'width: 80px;',
  });

  const dateInput = slInput({
    placeholder: t('placeholders.date'),
    size: 'small',
    value: store.get('coverPageDate') || '',
    style: 'width: 140px;',
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

  // Cover page metadata row (shown/hidden based on coverPage toggle)
  const coverMetadataRow = h('div', { class: 'input-bar-cover-metadata' }, [
    subtitleInput,
    versionInput,
    dateInput,
  ]);

  function updateCoverMetadataVisibility() {
    coverMetadataRow.hidden = !coverPageSwitch.checked;
  }
  updateCoverMetadataVisibility();

  // Sync inputs when the store changes externally (e.g. after AI enhance).
  // Guarded against echoing user input back into a flicker loop.
  const unsubscribe = store.subscribe((state) => {
    if (state.contentTitle !== titleInput.value) {
      titleInput.value = state.contentTitle || '';
    }
    if ((state.coverPageSubtitle || '') !== subtitleInput.value) {
      subtitleInput.value = state.coverPageSubtitle || '';
    }
    if ((state.coverPageVersion || '') !== versionInput.value) {
      versionInput.value = state.coverPageVersion || '';
    }
    if ((state.coverPageDate || '') !== dateInput.value) {
      dateInput.value = state.coverPageDate || '';
    }
  });

  // Build element
  const element = h('div', { class: 'editor-bar' }, [
    h('div', { class: 'editor-bar-row' }, [
      h('div', { class: 'editor-bar-left' }, [
        titleInput,
        themeSelect,
      ]),
      h('div', { class: 'editor-bar-right' }, [
        tocLabel,
        pageNumLabel,
        coverPageLabel,
        pageBreakH1Label,
        pageBreakH2Label,
      ]),
    ]),
    coverMetadataRow,
  ]);

  return {
    element,
    setTitle(title) {
      titleInput.value = title;
    },
    destroy() {
      unsubscribe();
    },
    setThemes(themes) {
      // Clear existing options
      while (themeSelect.firstChild) {
        themeSelect.removeChild(themeSelect.firstChild);
      }
      // Add new options
      for (const theme of themes) {
        themeSelect.appendChild(sl('sl-option', { value: theme.id }, [theme.name]));
      }
      // Set current value
      themeSelect.value = store.get('selectedTheme') || 'default';
    },
  };
}
