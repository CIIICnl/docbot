/**
 * Draft List View
 * Main view showing all saved drafts with creation options.
 */

import { h, empty } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { getDrafts, deleteDraft } from '../lib/drafts.js';
import { confirmModal, createOverlayRegistry } from '../lib/modal.js';
import { createDraftCardRenderer } from './list/draft-card.js';
import { openNewDocumentModal } from './list/modals/new-document.js';

/**
 * Render the draft list view
 * @param {HTMLElement} container - Container element
 * @param {Object} options
 * @param {Function} options.navigate - Navigation function
 * @param {Object} options.api - API client
 * @returns {Function} Cleanup function
 */
export async function renderList(container, { navigate, api }) {
  const detachers = [];
  const { openOverlayClosers, closeAll } = createOverlayRegistry();

  // Track drafts and highlighted items
  let drafts = getDrafts();
  let highlightedId = null;

  // Create card renderer
  const { renderCard } = createDraftCardRenderer({
    onOpen: (draft) => {
      navigate(`/edit/${draft.id}`);
    },
    onDelete: async (draft) => {
      const confirmed = await confirmModal(h, document.body, {
        title: t('list.deleteTitle'),
        message: t('list.deleteConfirm', { title: draft.title }),
        confirmLabel: t('list.delete'),
        cancelLabel: t('common.cancel'),
        danger: true,
      }, openOverlayClosers);

      if (confirmed) {
        deleteDraft(draft.id);
        drafts = getDrafts();
        renderDraftGrid();
      }
    },
    detachers,
  });

  // Header with title and new document button
  const header = h('header', { class: 'list-header' }, [
    h('h1', { class: 'list-title', text: t('list.title') }),
    h('sl-button', {
      variant: 'primary',
      onclick: () => handleNewDocument(),
    }, [
      h('sl-icon', { slot: 'prefix', name: 'plus-lg' }),
      t('list.newDocument'),
    ]),
  ]);

  // Draft grid
  const grid = h('div', { class: 'draft-grid' });

  // Empty state
  const emptyState = h('div', { class: 'list-empty-state' }, [
    h('sl-icon', { name: 'file-earmark-text', class: 'list-empty-icon' }),
    h('h2', { text: t('list.empty') }),
    h('p', { text: t('list.emptyHint') }),
    h('sl-button', {
      variant: 'primary',
      size: 'large',
      onclick: () => handleNewDocument(),
    }, [
      h('sl-icon', { slot: 'prefix', name: 'plus-lg' }),
      t('list.newDocument'),
    ]),
  ]);

  /**
   * Render the draft grid
   */
  function renderDraftGrid() {
    empty(grid);

    if (drafts.length === 0) {
      grid.classList.add('is-hidden');
      emptyState.classList.remove('is-hidden');
      return;
    }

    grid.classList.remove('is-hidden');
    emptyState.classList.add('is-hidden');

    for (const draft of drafts) {
      const highlight = draft.id === highlightedId;
      const card = renderCard(draft, { highlight });
      grid.appendChild(card);
    }

    // Clear highlight after rendering
    highlightedId = null;
  }

  /**
   * Handle new document creation
   */
  function handleNewDocument() {
    openNewDocumentModal({
      h,
      root: document.body,
      navigate,
      api,
      openOverlayClosers,
      onCreated: (draft) => {
        // Refresh drafts and highlight the new one
        drafts = getDrafts();
        highlightedId = draft.id;
        renderDraftGrid();
      },
    });
  }

  // Build layout
  const layout = h('div', { class: 'list-layout' }, [
    header,
    grid,
    emptyState,
  ]);

  container.appendChild(layout);

  // Initial render
  renderDraftGrid();

  // Cleanup function
  return () => {
    closeAll();
    for (const d of detachers) d();
  };
}
