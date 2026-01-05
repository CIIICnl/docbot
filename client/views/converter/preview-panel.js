/**
 * Preview Panel
 * Live HTML preview of markdown content with change log display.
 */

import { h, empty } from '../../lib/dom.js';
import { post } from '../../lib/api.js';
import { slIcon } from '../../lib/shoelace.js';

/**
 * Create the preview panel
 * @param {Object} options
 * @param {Function} options.getContent - Get current markdown content
 * @param {Function} options.getTitle - Get current title
 * @param {Function} options.getThemeId - Get selected theme ID
 * @param {Function} options.getGenerateToc - Get TOC toggle state
 */
export function createPreviewPanel(options) {
  const { getContent, getTitle, getThemeId, getGenerateToc } = options;

  // State
  let currentChanges = [];
  let debounceTimer = null;

  // Preview iframe
  const iframe = h('iframe', {
    class: 'preview-iframe',
    sandbox: 'allow-same-origin',
    title: 'Document Preview',
  });

  // Empty state
  const emptyState = h('div', { class: 'preview-empty' }, [
    slIcon({ name: 'file-earmark-text', className: 'preview-empty-icon' }),
    h('p', { class: 'preview-empty-text' }, ['Enter content to see preview']),
  ]);

  // Loading state
  const loadingState = h('div', { class: 'preview-loading' }, [
    h('sl-spinner', { style: 'font-size: 2rem;' }),
    h('p', { class: 'preview-loading-text' }, ['Generating preview...']),
  ]);
  loadingState.hidden = true;

  // Preview content container
  const previewContent = h('div', { class: 'preview-content' }, [
    emptyState,
    loadingState,
    iframe,
  ]);
  iframe.hidden = true;

  // Change log section
  const changeLogList = h('ul', { class: 'change-log-list' }, []);
  const changeLogSection = h('div', { class: 'change-log' }, [
    h('div', { class: 'change-log-header' }, [
      slIcon({ name: 'magic', className: 'change-log-icon' }),
      h('span', { class: 'change-log-title' }, ['AI Changes']),
    ]),
    changeLogList,
  ]);
  changeLogSection.hidden = true;

  /**
   * Update the preview with new content
   */
  async function updatePreview() {
    const content = getContent();

    if (!content || content.trim().length === 0) {
      iframe.hidden = true;
      loadingState.hidden = true;
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    loadingState.hidden = false;

    try {
      const result = await post('/api/convert/preview', {
        source: 'markdown',
        content,
        options: {
          themeId: getThemeId(),
          generateToc: getGenerateToc(),
          pageNumbers: false,
          title: getTitle(),
        },
      });

      if (result.ok && result.data.html) {
        loadingState.hidden = true;
        iframe.hidden = false;
        iframe.srcdoc = result.data.html;
      }
    } catch (err) {
      console.error('Preview failed:', err);
      loadingState.hidden = true;
      emptyState.hidden = false;
    }
  }

  /**
   * Debounced preview update
   */
  function schedulePreviewUpdate() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(updatePreview, 500);
  }

  /**
   * Update the change log display
   * @param {Array} changes - Array of change objects
   */
  function updateChangeLog(changes) {
    currentChanges = changes || [];
    empty(changeLogList);

    if (currentChanges.length === 0) {
      changeLogSection.hidden = true;
      return;
    }

    changeLogSection.hidden = false;

    for (const change of currentChanges) {
      const item = h('li', { class: 'change-log-item' }, [
        h('span', { class: 'change-log-description' }, [change.description]),
        change.location &&
          h('span', { class: 'change-log-location' }, [change.location]),
      ]);
      changeLogList.appendChild(item);
    }
  }

  /**
   * Clear the change log
   */
  function clearChangeLog() {
    updateChangeLog([]);
  }

  // Expose methods
  const panel = h('div', { class: 'preview-panel' }, [
    h('div', { class: 'preview-panel-header' }, [
      slIcon({ name: 'eye', className: 'preview-panel-icon' }),
      h('span', { class: 'preview-panel-title' }, ['Preview']),
    ]),
    previewContent,
    changeLogSection,
  ]);

  // Attach methods to panel element for external access
  panel.updatePreview = schedulePreviewUpdate;
  panel.updateChangeLog = updateChangeLog;
  panel.clearChangeLog = clearChangeLog;
  panel.forceUpdate = updatePreview;

  return panel;
}
