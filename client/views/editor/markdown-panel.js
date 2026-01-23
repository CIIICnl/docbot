/**
 * Markdown Panel Component
 * Editable markdown textarea with search functionality and formatting toolbar.
 */

import { h } from '../../lib/dom.js';
import { slTextarea, slIcon } from '../../lib/shoelace.js';
import { TextSearchController } from '../../lib/search-controller.js';
import { MarkdownToolbar } from '../../lib/markdown-toolbar.js';
import { t } from '../../lib/i18n.js';

/**
 * Create the markdown editor panel
 * @param {Object} options
 * @param {Object} options.store - State store
 * @param {Function} options.onContentChange - Called when content changes
 */
export function createMarkdownPanel({ store, onContentChange }) {
  // Textarea
  const textarea = slTextarea({
    placeholder: t('placeholders.markdownEditor'),
    rows: 20,
    resize: 'vertical',
    className: 'markdown-editor-textarea',
  });

  textarea.addEventListener('sl-input', (e) => {
    const content = e.target.value;
    store.set({ content });
    onContentChange(content);
  });

  // Search controller
  const search = new TextSearchController(textarea);

  // Formatting toolbar
  const toolbar = new MarkdownToolbar(textarea, {
    onChange: (content) => {
      store.set({ content });
      onContentChange(content);
    },
  });

  // Build element
  const element = h('div', { class: 'markdown-editor-panel' }, [
    h('div', { class: 'panel-header' }, [
      slIcon({ name: 'markdown', className: 'panel-icon' }),
      h('span', { class: 'panel-title' }, [t('markdown.title')]),
      h('span', { class: 'panel-subtitle text-muted' }, [t('markdown.subtitle')]),
      h('div', { class: 'panel-header-spacer' }),
      search.toggle,
    ]),
    toolbar.element,
    search.searchBar,
    textarea,
  ]);

  return {
    element,
    setValue(content) {
      textarea.value = content;
    },
    getValue() {
      return textarea.value;
    },
    clearSearch: () => search.clear(),
  };
}
