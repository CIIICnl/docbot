/**
 * Options Panel
 * Conversion options and export actions.
 */

import { h, empty } from '../../lib/dom.js';
import { get, post } from '../../lib/api.js';
import { success, error, warning } from '../../lib/toast.js';
import { showLoading } from '../../lib/loading.js';
import { downloadFile, downloadBase64, sanitizeFilename } from '../../lib/download.js';
import { slSelect, slSwitch, slButton, sl } from '../../lib/shoelace.js';
import { STORAGE_KEYS } from '../../lib/constants.js';
import { t } from '../../lib/i18n.js';

/**
 * Create the options panel
 * @param {Object} callbacks
 * @param {Function} callbacks.getContent - Get current markdown content
 * @param {Function} callbacks.getTitle - Get current title
 * @param {Function} callbacks.getSource - Get content source
 * @param {Function} callbacks.onOptionsChange - Called when options change
 * @param {Function} callbacks.onEnhanceRequest - Called when AI enhancement is requested
 */
export function createOptionsPanel(callbacks) {
  const { getContent, getTitle, getSource, onOptionsChange, onEnhanceRequest } = callbacks;

  // State
  let themes = [];
  let selectedTheme = 'default';
  let generateToc = true;
  let pageNumbers = true;
  let coverPage = false;
  let llmAvailable = false;
  let selectedProvider = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROVIDER) || 'claude';

  // Theme selector
  const themeSelect = slSelect({
    label: 'Theme',
    value: 'default',
    className: 'options-theme-select',
  });

  // ToC toggle
  const tocSwitch = slSwitch({
    checked: true,
    text: 'Table of Contents',
  });
  tocSwitch.addEventListener('sl-change', (e) => {
    generateToc = e.target.checked;
    if (onOptionsChange) {
      onOptionsChange({ generateToc });
    }
  });

  // Page numbers toggle
  const pageNumSwitch = slSwitch({
    checked: true,
    text: 'Page Numbers',
  });
  pageNumSwitch.addEventListener('sl-change', (e) => {
    pageNumbers = e.target.checked;
  });

  // Cover page toggle
  const coverPageSwitch = slSwitch({
    checked: false,
    text: t('input.coverPage'),
  });
  coverPageSwitch.addEventListener('sl-change', (e) => {
    coverPage = e.target.checked;
  });

  // AI Enhancement section
  const providerSelect = slSelect({
    value: selectedProvider,
    size: 'small',
    className: 'options-provider-select',
  });
  providerSelect.appendChild(sl('sl-option', { value: 'claude' }, ['Claude']));
  providerSelect.appendChild(sl('sl-option', { value: 'mistral' }, ['Mistral']));
  providerSelect.addEventListener('sl-change', (e) => {
    selectedProvider = e.target.value;
    localStorage.setItem(STORAGE_KEYS.DEFAULT_PROVIDER, selectedProvider);
  });

  const enhanceButton = slButton({
    variant: 'default',
    size: 'medium',
    icon: 'magic',
    text: 'Enhance with AI',
    onClick: () => requestEnhancement(),
  });

  // Info tooltip for AI enhancement
  const enhanceInfo = h('sl-tooltip', {
    content: `AI Enhancement improves your document by:

• Fixing heading hierarchy (H1 → H2 → H3) for proper structure
• Ensuring correct nesting for table of contents generation
• Cleaning up inconsistent formatting from Word
• Applying style guidelines from your global context

This is especially important for Word documents, which often have inconsistent heading levels.`,
    placement: 'bottom',
    hoist: true,
  }, [
    h('sl-icon-button', {
      name: 'info-circle',
      label: 'What does AI enhancement do?',
      class: 'enhance-info-btn',
    }),
  ]);

  const enhanceSection = h('div', { class: 'options-enhance-section' }, [
    providerSelect,
    h('div', { class: 'options-enhance-action' }, [
      enhanceButton,
      enhanceInfo,
    ]),
  ]);
  enhanceSection.hidden = true;

  // Export buttons
  const exportPdfBtn = slButton({
    variant: 'primary',
    size: 'medium',
    icon: 'file-pdf',
    text: 'Export PDF',
    onClick: () => exportPdf(),
  });

  const exportHtmlBtn = slButton({
    variant: 'default',
    size: 'medium',
    icon: 'file-code',
    text: 'Export HTML',
    onClick: () => exportHtml(),
  });

  const exportSection = h('div', { class: 'options-export-section' }, [
    exportPdfBtn,
    exportHtmlBtn,
  ]);

  // Metadata display
  const pagesValue = h('span', { class: 'options-metadata-value pages' }, ['-']);
  const tocValue = h('span', { class: 'options-metadata-value toc' }, ['-']);

  const metadataSection = h('div', { class: 'options-metadata' }, [
    h('div', { class: 'options-metadata-item' }, [
      h('span', { class: 'options-metadata-label' }, ['Pages:']),
      pagesValue,
    ]),
    h('div', { class: 'options-metadata-item' }, [
      h('span', { class: 'options-metadata-label' }, ['TOC Entries:']),
      tocValue,
    ]),
  ]);
  metadataSection.hidden = true;

  // Load themes
  async function loadThemes() {
    try {
      const result = await get('/api/themes');
      if (result.ok) {
        themes = result.data.themes;
        selectedTheme = result.data.defaultThemeId;

        // Populate theme selector
        empty(themeSelect);
        for (const theme of themes) {
          const option = sl('sl-option', { value: theme.id }, [theme.name]);
          themeSelect.appendChild(option);
        }
        themeSelect.value = selectedTheme;
      }
    } catch {
      // Use default theme
    }
  }

  // Check LLM availability
  async function checkLlmStatus() {
    try {
      const result = await get('/api/llm/status');
      if (result.ok) {
        const providers = result.data.providers;
        llmAvailable = providers.claude || providers.mistral;

        if (llmAvailable) {
          enhanceSection.hidden = false;

          // Disable unavailable providers
          const claudeOption = providerSelect.querySelector('[value="claude"]');
          const mistralOption = providerSelect.querySelector('[value="mistral"]');
          if (claudeOption && !providers.claude) claudeOption.disabled = true;
          if (mistralOption && !providers.mistral) mistralOption.disabled = true;

          // Set default to first available
          if (!providers.claude && providers.mistral) {
            selectedProvider = 'mistral';
            providerSelect.value = 'mistral';
          }
        }
      }
    } catch {
      // LLM not available
    }
  }

  // Theme change handler
  themeSelect.addEventListener('sl-change', (e) => {
    selectedTheme = e.target.value;
    if (onOptionsChange) {
      onOptionsChange({ themeId: selectedTheme });
    }
  });

  // Request AI enhancement
  async function requestEnhancement() {
    const content = getContent();
    if (!content || content.trim().length === 0) {
      warning('No content to enhance');
      return;
    }

    if (onEnhanceRequest) {
      onEnhanceRequest(selectedProvider);
    }
  }

  // Export to PDF
  async function exportPdf() {
    const content = getContent();

    if (!content || content.trim().length === 0) {
      warning('No content to export');
      return;
    }

    const hide = showLoading('Generating PDF...');

    try {
      const result = await post('/api/convert', {
        source: getSource(),
        content,
        options: {
          themeId: selectedTheme,
          generateToc,
          pageNumbers,
          coverPage,
          title: getTitle(),
        },
      });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Export failed');
      }

      // Update metadata
      metadataSection.hidden = false;
      pagesValue.textContent = result.data.metadata.pageCount;
      tocValue.textContent = result.data.metadata.tocEntries;

      // Download PDF
      const filename = sanitizeFilename(result.data.metadata.title) + '.pdf';
      downloadBase64(result.data.pdf, filename, 'application/pdf');
      success('PDF exported');
    } catch (err) {
      error(err.message || 'Export failed');
    } finally {
      hide();
    }
  }

  // Export to HTML
  async function exportHtml() {
    const content = getContent();

    if (!content || content.trim().length === 0) {
      warning('No content to export');
      return;
    }

    const hide = showLoading('Generating HTML...');

    try {
      const result = await post('/api/convert', {
        source: getSource(),
        content,
        options: {
          themeId: selectedTheme,
          generateToc,
          pageNumbers: false,
          title: getTitle(),
        },
      });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Export failed');
      }

      // Download HTML
      const filename = sanitizeFilename(result.data.metadata.title) + '.html';
      downloadFile(result.data.html, filename, 'text/html');
      success('HTML exported');
    } catch (err) {
      error(err.message || 'Export failed');
    } finally {
      hide();
    }
  }

  // Initialize
  loadThemes();
  checkLlmStatus();

  return h('div', { class: 'options-panel' }, [
    h('div', { class: 'options-section' }, [
      themeSelect,
      h('div', { class: 'options-toggles' }, [tocSwitch, pageNumSwitch, coverPageSwitch]),
    ]),
    enhanceSection,
    exportSection,
    metadataSection,
  ]);
}
