/**
 * Preview Panel Component
 * Live HTML preview with search functionality.
 */

import { h } from '../../lib/dom.js';
import { post } from '../../lib/api.js';
import { slIcon } from '../../lib/shoelace.js';
import { DOMSearchController, SEARCH_HIGHLIGHT_CSS } from '../../lib/search-controller.js';
import { t, getLocale } from '../../lib/i18n.js';

/**
 * Create the preview panel
 * @param {Object} options
 * @param {Object} options.store - State store
 */
export function createPreviewPanel({ store }) {
  // Preview iframe
  const iframe = h('iframe', {
    class: 'preview-iframe',
    sandbox: 'allow-same-origin allow-scripts',
    title: t('preview.title'),
  });
  iframe.hidden = true;

  // Empty state
  const emptyState = h('div', { class: 'preview-empty' }, [
    slIcon({ name: 'eye', className: 'preview-empty-icon' }),
    h('p', {}, [t('preview.empty')]),
  ]);

  // Loading state
  const loadingState = h('div', { class: 'preview-loading' }, [
    h('sl-spinner', { style: 'font-size: 1.5rem;' }),
  ]);
  loadingState.hidden = true;

  // Search controller
  const search = new DOMSearchController(iframe);

  // Refresh button
  const refreshBtn = h('sl-icon-button', {
    name: 'arrow-clockwise',
    label: t('preview.refresh'),
    class: 'preview-refresh-btn',
  });

  // Preview update function
  async function updatePreview() {
    const state = store.get();

    if (!state.content.trim()) {
      iframe.hidden = true;
      loadingState.hidden = true;
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    loadingState.hidden = false;

    if (search.hasActiveSearch()) {
      search.clear();
    }

    try {
      const result = await post('/api/convert/preview', {
        source: 'markdown',
        content: state.content,
        options: {
          themeId: state.selectedTheme,
          generateToc: state.generateToc,
          pageNumbers: false,
          title: state.contentTitle,
          locale: getLocale(),
        },
      });

      if (result.ok && result.data.html) {
        loadingState.hidden = true;
        iframe.hidden = false;
        const htmlWithCSS = result.data.html.replace(
          '</head>',
          `<style>${SEARCH_HIGHLIGHT_CSS}</style></head>`
        );
        iframe.srcdoc = htmlWithCSS;
      }
    } catch {
      loadingState.hidden = true;
      emptyState.hidden = false;
    }
  }

  refreshBtn.addEventListener('click', updatePreview);

  // Build element
  const element = h('div', { class: 'preview-panel' }, [
    h('div', { class: 'panel-header' }, [
      slIcon({ name: 'eye', className: 'panel-icon' }),
      h('span', { class: 'panel-title' }, [t('preview.panelTitle')]),
      h('div', { class: 'panel-header-spacer' }),
      search.toggle,
      refreshBtn,
    ]),
    search.searchBar,
    h('div', { class: 'preview-content' }, [emptyState, loadingState, iframe]),
  ]);

  return {
    element,
    updatePreview,
    clearSearch: () => search.clear(),
  };
}
