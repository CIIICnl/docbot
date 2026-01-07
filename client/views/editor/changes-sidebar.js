/**
 * Changes Sidebar Component
 * Displays AI-made changes and suggestions with undo functionality.
 */

import { h, empty } from '../../lib/dom.js';
import { success } from '../../lib/toast.js';
import { slButton, slIcon } from '../../lib/shoelace.js';
import { t } from '../../lib/i18n.js';

/**
 * Create the changes sidebar
 * @param {Object} options
 * @param {Object} options.store - State store
 * @param {Function} options.onUndo - Called when undo is clicked
 */
export function createChangesSidebar({ store, onUndo }) {
  const changesCount = h('span', { class: 'changes-count' }, ['0']);
  const changesList = h('div', { class: 'changes-list' }, []);

  const undoAllBtn = slButton({
    variant: 'default',
    size: 'small',
    outline: true,
    icon: 'arrow-counterclockwise',
    text: t('changes.undoAll'),
  });

  undoAllBtn.addEventListener('click', () => {
    onUndo();
    success(t('changes.reverted'));
  });

  const header = h('div', { class: 'changes-sidebar-header' }, [
    slIcon({ name: 'magic', className: 'changes-sidebar-icon' }),
    h('span', { class: 'changes-sidebar-title' }, [t('changes.title')]),
    changesCount,
  ]);

  const element = h('div', { class: 'changes-sidebar is-collapsed' }, [
    header,
    changesList,
    h('div', { class: 'changes-sidebar-footer' }, [undoAllBtn]),
  ]);
  element.hidden = true;

  // Toggle collapse on header click (for smaller screens)
  header.addEventListener('click', () => {
    element.classList.toggle('is-collapsed');
  });

  // Close when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (!element.hidden && !element.classList.contains('is-collapsed')) {
      if (!element.contains(e.target)) {
        element.classList.add('is-collapsed');
      }
    }
  });

  /**
   * Group similar changes together for display
   */
  function groupSimilarChanges(changes) {
    const groups = [];
    const used = new Set();

    const patterns = [
      // Structure patterns
      {
        name: 'bold-to-heading',
        match: (desc) => /from bold text to a proper (section )?heading/i.test(desc),
        summary: (items) => {
          const first = items[0].description.match(/['']([^'']+)['']/)?.[1] || 'text';
          return `Turned '${first}' from bold text into a proper heading`;
        },
        category: 'structure',
      },
      {
        name: 'list-formatting',
        match: (desc) => /list format|proper list|ordered list|unordered list/i.test(desc),
        summary: () => `Fixed list formatting`,
        category: 'structure',
      },
      {
        name: 'heading-hierarchy',
        match: (desc) => /heading (level|hierarchy)|adjusted.*heading/i.test(desc),
        summary: () => `Fixed heading hierarchy`,
        category: 'structure',
      },
      // Typo patterns
      {
        name: 'double-spaces',
        match: (desc) => /double space|extra space|multiple space/i.test(desc),
        summary: () => `Fixed double spaces`,
        category: 'typo',
      },
      {
        name: 'spelling',
        match: (desc) => /spelling|typo|misspell/i.test(desc),
        summary: (items) => {
          const first = items[0].description.match(/['']([^'']+)['']/)?.[1];
          return first ? `Fixed spelling of '${first}'` : `Fixed spelling errors`;
        },
        category: 'typo',
      },
      {
        name: 'punctuation',
        match: (desc) => /punctuation|missing space after|period|comma/i.test(desc),
        summary: () => `Fixed punctuation`,
        category: 'typo',
      },
      // Readability patterns
      {
        name: 'sentence-clarity',
        match: (desc) => /rewor|clarif|clearer|simplif|sentence/i.test(desc),
        summary: () => `Improved sentence clarity`,
        category: 'readability',
      },
    ];

    for (const pattern of patterns) {
      const matching = changes.filter((c, i) => !used.has(i) && pattern.match(c.description));
      if (matching.length > 0) {
        const indices = changes.map((c, i) => (!used.has(i) && pattern.match(c.description)) ? i : -1).filter(i => i >= 0);
        indices.forEach(i => used.add(i));
        groups.push({
          pattern: pattern.name,
          items: matching,
          summary: pattern.summary(matching),
          category: pattern.category || matching[0].category || 'other',
        });
      }
    }

    changes.forEach((change, i) => {
      if (!used.has(i)) {
        groups.push({
          pattern: 'single',
          items: [change],
          summary: change.description,
          category: change.category || 'other',
        });
      }
    });

    // Sort by category priority: structure, typo, readability, other
    const categoryOrder = { structure: 0, typo: 1, readability: 2, other: 3 };
    groups.sort((a, b) => (categoryOrder[a.category] ?? 3) - (categoryOrder[b.category] ?? 3));

    return groups;
  }

  const CATEGORY_LABELS = {
    structure: t('changes.categoryStructure'),
    typo: t('changes.categoryTypos'),
    readability: t('changes.categoryReadability'),
    other: t('changes.categoryOther'),
  };

  /**
   * Display changes and suggestions
   */
  function displayChanges(changes = [], suggestions = []) {
    empty(changesList);

    const totalCount = changes.length + suggestions.length;

    if (totalCount === 0) {
      changesList.appendChild(
        h('div', { class: 'changes-empty' }, [t('changes.noChanges')])
      );
      changesCount.textContent = '0';
      return;
    }

    changesCount.textContent = String(totalCount);

    if (changes.length > 0) {
      changesList.appendChild(
        h('div', { class: 'changes-section-header' }, [t('changes.changesMade')])
      );

      const groups = groupSimilarChanges(changes);
      let currentCategory = null;

      for (const group of groups) {
        const categoryClass = `change-category-${group.category || 'other'}`;

        // Add category sub-header when category changes
        if (group.category !== currentCategory && groups.length > 2) {
          currentCategory = group.category;
          changesList.appendChild(
            h('div', { class: `change-category-header ${categoryClass}` }, [
              CATEGORY_LABELS[group.category] || 'Other'
            ])
          );
        }

        if (group.items.length === 1) {
          const change = group.items[0];
          const item = h('div', { class: `change-item ${categoryClass}` }, [
            h('div', { class: 'change-description' }, [change.description]),
          ]);
          if (change.location) {
            item.appendChild(
              h('div', { class: 'change-location' }, [change.location])
            );
          }
          changesList.appendChild(item);
        } else {
          const othersCount = group.items.length - 1;
          const summaryText = `${group.summary}, and ${othersCount} other${othersCount > 1 ? 's' : ''}`;

          const details = h('details', { class: `change-group ${categoryClass}` }, [
            h('summary', { class: 'change-group-summary' }, [
              h('span', { class: 'change-group-text' }, [summaryText]),
              h('span', { class: 'change-group-count' }, [String(group.items.length)]),
            ]),
            h('div', { class: 'change-group-items' },
              group.items.map(change =>
                h('div', { class: 'change-group-item' }, [
                  h('div', { class: 'change-description' }, [change.description]),
                  change.location ? h('div', { class: 'change-location' }, [change.location]) : null,
                ].filter(Boolean))
              )
            ),
          ]);
          changesList.appendChild(details);
        }
      }
    }

    if (suggestions.length > 0) {
      changesList.appendChild(
        h('div', { class: 'changes-section-header suggestions-header' }, [t('changes.suggestions')])
      );
      for (const suggestion of suggestions) {
        const item = h('div', { class: 'change-item suggestion-item' }, [
          h('div', { class: 'suggestion-text' }, [suggestion.text]),
        ]);
        if (suggestion.location) {
          item.appendChild(
            h('div', { class: 'change-location' }, [suggestion.location])
          );
        }
        changesList.appendChild(item);
      }
    }
  }

  function show() {
    element.hidden = false;
    // Auto-expand on larger screens
    if (window.innerWidth > 1400) {
      element.classList.remove('is-collapsed');
    }
  }

  function hide() {
    element.hidden = true;
    element.classList.add('is-collapsed');
  }

  return {
    element,
    displayChanges,
    show,
    hide,
  };
}
