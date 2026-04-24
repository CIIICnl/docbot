/**
 * Changes Sidebar Component
 * Displays AI-made changes and suggestions with undo functionality.
 */

import { h, empty } from '../../lib/dom.js';
import { success, error } from '../../lib/toast.js';
import { slButton, slIcon } from '../../lib/shoelace.js';
import { t, getLocale } from '../../lib/i18n.js';
import { post } from '../../lib/api.js';
import { showLoading } from '../../lib/loading.js';
import { getProvider } from './state.js';

/**
 * Create the changes sidebar
 * @param {Object} options
 * @param {Object} options.store - State store
 * @param {Function} options.onUndo - Called when undo is clicked
 */
export function createChangesSidebar({ store, onUndo }) {
  const changesCount = h('span', { class: 'changes-count' }, ['0']);
  const changesList = h('div', { class: 'changes-list' }, []);

  // Store current changes, suggestions, and overall impression for export
  let currentChanges = [];
  let currentDetailedChanges = [];
  let currentSuggestions = [];
  let currentOverallImpression = null;

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

  const exportJsonBtn = slButton({
    variant: 'default',
    size: 'small',
    outline: true,
    icon: 'download',
    text: t('changes.exportJson'),
  });

  exportJsonBtn.addEventListener('click', () => {
    exportChangesAsJson();
  });

  const exportReportBtn = slButton({
    variant: 'default',
    size: 'small',
    outline: true,
    icon: 'file-text',
    text: t('changes.exportReport'),
  });

  exportReportBtn.addEventListener('click', () => {
    exportFeedbackReport();
  });

  /**
   * Export changes and suggestions as JSON file
   */
  function exportChangesAsJson() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      overallImpression: currentOverallImpression || null,
      changesSummary: currentChanges.map((change) => ({
        description: change.description,
        location: change.location || null,
        category: change.category || 'other',
      })),
      detailedChanges: currentDetailedChanges.map((change) => ({
        description: change.description,
        location: change.location || null,
        category: change.category || 'other',
      })),
      suggestions: currentSuggestions.map((suggestion) => ({
        text: suggestion.text,
        location: suggestion.location || null,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-changes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    success(t('changes.exported'));
  }

  /**
   * Generate and export a human-readable feedback report with editing instructions
   */
  async function exportFeedbackReport() {
    const state = store.get();
    const documentTitle = state.contentTitle || t('changes.untitledDocument');

    // If we don't have detailed changes and we have summarized changes, fetch them
    let changesForReport = currentDetailedChanges.length > 0 ? currentDetailedChanges : currentChanges;

    if (currentDetailedChanges.length === 0 && currentChanges.length > 0) {
      const provider = getProvider();
      if (provider !== 'none') {
        const hide = showLoading(t('changes.fetchingDetails'));
        try {
          const result = await post('/api/docx/detailed-changes', {
            markdown: state.content,
            changes: currentChanges,
            provider,
            language: getLocale(),
          });

          if (result.ok && result.data.detailedChanges) {
            currentDetailedChanges = result.data.detailedChanges;
            changesForReport = currentDetailedChanges;
          }
        } catch (err) {
          // Continue with summarized changes if detailed fetch fails
          console.warn('Failed to fetch detailed changes:', err);
        } finally {
          hide();
        }
      }
    }

    const date = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let report = `# ${t('changes.reportTitle')}\n\n`;
    report += `**${t('changes.reportDocument')}:** ${documentTitle}\n`;
    report += `**${t('changes.reportDate')}:** ${date}\n\n`;
    report += `${t('changes.reportIntro')}\n\n`;
    report += `---\n\n`;

    // Overall Impression section
    if (currentOverallImpression) {
      report += `## ${t('changes.overallImpression')}\n\n`;
      report += `${currentOverallImpression}\n\n`;
    }

    // Suggestions section (content/strategic suggestions)
    if (currentSuggestions.length > 0) {
      report += `## ${t('changes.reportSuggestionsTitle')}\n\n`;
      report += `${t('changes.reportSuggestionsIntro')}\n\n`;
      for (const suggestion of currentSuggestions) {
        if (suggestion.location) {
          report += `- **${t('changes.reportLocation')} ${suggestion.location}:** ${suggestion.text}\n`;
        } else {
          report += `- ${suggestion.text}\n`;
        }
      }
      report += `\n`;
    }

    // Changes as recommended edits, grouped by category
    if (changesForReport.length > 0) {
      report += `## ${t('changes.reportEditsTitle')}\n\n`;
      report += `${t('changes.reportEditsIntro')}\n\n`;

      // Group changes by category
      const changesByCategory = {
        structure: [],
        typo: [],
        readability: [],
        other: [],
      };

      for (const change of changesForReport) {
        const category = change.category || 'other';
        if (changesByCategory[category]) {
          changesByCategory[category].push(change);
        } else {
          changesByCategory.other.push(change);
        }
      }

      const categoryLabels = {
        structure: t('changes.reportCategoryStructure'),
        typo: t('changes.reportCategoryTypos'),
        readability: t('changes.reportCategoryReadability'),
        other: t('changes.reportCategoryOther'),
      };

      for (const [category, changes] of Object.entries(changesByCategory)) {
        if (changes.length > 0) {
          report += `### ${categoryLabels[category]}\n\n`;
          for (const change of changes) {
            if (change.location) {
              report += `- **${t('changes.reportLocation')} ${change.location}:** ${change.description}\n`;
            } else {
              report += `- ${change.description}\n`;
            }
          }
          report += `\n`;
        }
      }
    }

    // Footer
    report += `---\n\n`;
    report += `*${t('changes.reportGenerated')}*\n`;

    // Download as markdown file
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `editing-instructions-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    success(t('changes.reportExported'));
  }

  const header = h('div', { class: 'changes-sidebar-header' }, [
    slIcon({ name: 'magic', className: 'changes-sidebar-icon' }),
    h('span', { class: 'changes-sidebar-title' }, [t('changes.title')]),
    changesCount,
  ]);

  const element = h('div', { class: 'changes-sidebar is-collapsed' }, [
    header,
    changesList,
    h('div', { class: 'changes-sidebar-footer' }, [exportReportBtn, exportJsonBtn, undoAllBtn]),
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
   * @param {Array} changes - Summarized changes for sidebar display
   * @param {Array} detailedChanges - Itemized changes for report export
   * @param {Array} suggestions - Suggestions from AI
   * @param {string|null} overallImpression - Overall document assessment
   */
  function displayChanges(changes = [], detailedChanges = [], suggestions = [], overallImpression = null) {
    empty(changesList);

    // Store for export
    currentChanges = changes;
    currentDetailedChanges = detailedChanges;
    currentSuggestions = suggestions;
    currentOverallImpression = overallImpression;

    const totalCount = changes.length + suggestions.length;

    if (totalCount === 0 && !overallImpression) {
      changesList.appendChild(
        h('div', { class: 'changes-empty' }, [t('changes.noChanges')])
      );
      changesCount.textContent = '0';
      return;
    }

    changesCount.textContent = String(totalCount);

    // Display overall impression at the top
    if (overallImpression) {
      changesList.appendChild(
        h('div', { class: 'changes-section-header impression-header' }, [t('changes.overallImpression')])
      );
      changesList.appendChild(
        h('div', { class: 'overall-impression' }, [
          h('p', { class: 'impression-text' }, [overallImpression]),
        ])
      );
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
