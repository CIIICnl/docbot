/**
 * Draft Card Component
 * Renders a draft as a clickable card in the list view.
 */

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { getDraftPreview } from '../../lib/drafts.js';

/**
 * Format a date as relative time
 * @param {string} isoDate - ISO date string
 * @returns {string} Relative time string
 */
export function formatRelativeTime(isoDate) {
  if (!isoDate) return '';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('list.timeJustNow');
  if (diffMin < 60) return t('list.timeMinutes', { count: diffMin });
  if (diffHour < 24) return t('list.timeHours', { count: diffHour });
  if (diffDay === 1) return t('list.timeYesterday');
  if (diffDay < 7) return t('list.timeDays', { count: diffDay });

  // Format as date for older items
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Create a draft card renderer
 * @param {Object} options
 * @param {Function} options.onOpen - Called when card is clicked to open
 * @param {Function} options.onDelete - Called when delete is clicked
 * @param {Array} options.detachers - Array to push cleanup functions
 * @returns {Object} Card renderer
 */
export function createDraftCardRenderer({ onOpen, onDelete, detachers = [] }) {
  /**
   * Render a single draft card
   * @param {Object} draft - Draft object
   * @param {Object} options - Render options
   * @param {boolean} options.highlight - Whether to highlight (new item)
   * @returns {HTMLElement}
   */
  function renderCard(draft, { highlight = false } = {}) {
    const preview = getDraftPreview(draft);
    const modifiedTime = formatRelativeTime(draft.modifiedAt || draft.savedAt);

    // Preview area
    const previewEl = h('div', { class: 'draft-card-preview' }, [
      preview
        ? h('p', { class: 'draft-card-preview-text', text: preview })
        : h('p', { class: 'draft-card-preview-empty', text: t('list.emptyDraft') }),
    ]);

    // Title
    const titleEl = h('h3', { class: 'draft-card-title', text: draft.title });

    // Meta info
    const metaEl = h('div', { class: 'draft-card-meta' }, [
      h('span', { class: 'draft-card-time', text: modifiedTime }),
    ]);

    // Action buttons
    const deleteBtn = h('sl-icon-button', {
      name: 'trash',
      label: t('list.delete'),
      class: 'draft-card-action draft-card-delete',
      onclick: (e) => {
        e.stopPropagation();
        onDelete?.(draft);
      },
    });

    const actionsEl = h('div', { class: 'draft-card-actions' }, [deleteBtn]);

    // Card container
    const card = h(
      'article',
      {
        class: ['draft-card', highlight && 'is-highlight'].filter(Boolean).join(' '),
        tabindex: '0',
        role: 'button',
        'aria-label': t('list.openDraft', { title: draft.title }),
        dataset: { draftId: draft.id },
        onclick: (e) => {
          // Don't trigger if clicking action buttons
          if (e.target.closest('.draft-card-action')) return;
          onOpen?.(draft);
        },
        onkeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen?.(draft);
          }
        },
      },
      [previewEl, titleEl, metaEl, actionsEl]
    );

    // Remove highlight after animation
    if (highlight) {
      const timer = setTimeout(() => {
        card.classList.remove('is-highlight');
      }, 2200);
      detachers.push(() => clearTimeout(timer));
    }

    return card;
  }

  return { renderCard };
}
