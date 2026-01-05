/**
 * Actions Bar Component
 * Bottom bar with AI enhancement, translation, and export actions.
 */

import { h } from '../../lib/dom.js';
import { post } from '../../lib/api.js';
import { success, error, warning } from '../../lib/toast.js';
import { showLoading, updateLoadingMessage } from '../../lib/loading.js';
import { slButton, slSelect, slSwitch, sl } from '../../lib/shoelace.js';
import { ENHANCE_MESSAGES, SUGGESTION_MESSAGES, pickRandom } from '../../lib/messages.js';
import { exportDocument, getExportConfig } from '../../lib/export-service.js';
import { getProvider, getGlobalContext } from './state.js';

/**
 * Create the actions bar
 * @param {Object} options
 * @param {Object} options.store - State store
 * @param {Function} options.onEnhanceComplete - Called after enhancement
 */
export function createActionsBar({ store, onEnhanceComplete }) {
  // Enhancement options
  const enhanceStructureCheck = slSwitch({ checked: true, size: 'small' });
  const enhanceTyposCheck = slSwitch({ checked: false, size: 'small' });
  const enhanceReadabilityCheck = slSwitch({ checked: false, size: 'small' });
  const enhanceSuggestionsCheck = slSwitch({ checked: false, size: 'small' });

  // Enhancement dialog
  const enhanceDialog = sl('sl-dialog', { label: 'Enhance with AI' }, [
    h('div', { class: 'enhance-options' }, [
      h('label', { class: 'enhance-option' }, [
        enhanceStructureCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, ['Document Structure']),
          h('span', { class: 'enhance-option-desc' }, [
            'Fix headings, lists, tables, and whitespace formatting',
          ]),
        ]),
      ]),
      h('label', { class: 'enhance-option' }, [
        enhanceTyposCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, ['Fix Typos']),
          h('span', { class: 'enhance-option-desc' }, [
            'Correct spelling errors, double spaces, and punctuation',
          ]),
        ]),
      ]),
      h('label', { class: 'enhance-option' }, [
        enhanceReadabilityCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, ['Improve Readability']),
          h('span', { class: 'enhance-option-desc' }, [
            'Reorder words and sentences for clarity without changing meaning',
          ]),
        ]),
      ]),
      h('label', { class: 'enhance-option' }, [
        enhanceSuggestionsCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, ['Get Suggestions']),
          h('span', { class: 'enhance-option-desc' }, [
            'Receive feedback and questions without modifying the document',
          ]),
        ]),
      ]),
    ]),
    h('div', { slot: 'footer', class: 'enhance-dialog-footer' }, [
      slButton({
        variant: 'default',
        text: 'Cancel',
        onClick: () => enhanceDialog.hide(),
      }),
      slButton({
        variant: 'primary',
        icon: 'magic',
        text: 'Enhance',
        onClick: () => {
          enhanceDialog.hide();
          handleEnhance();
        },
      }),
    ]),
  ]);

  const enhanceBtn = slButton({
    variant: 'default',
    icon: 'magic',
    text: 'Enhance with AI',
    onClick: () => enhanceDialog.show(),
  });

  const enhanceGroup = h('div', { class: 'action-group' }, [enhanceBtn]);

  // Translation controls
  const translateDirectionSelect = slSelect({
    value: 'nl-to-en',
    size: 'small',
    style: 'width: 110px;',
    hoist: true,
  });
  translateDirectionSelect.appendChild(sl('sl-option', { value: 'nl-to-en' }, ['NL → EN']));
  translateDirectionSelect.appendChild(sl('sl-option', { value: 'en-to-nl' }, ['EN → NL']));

  const translateBtn = slButton({
    variant: 'default',
    icon: 'translate',
    text: 'Translate',
    onClick: () => handleTranslate(),
  });

  const translateGroup = h('div', { class: 'action-group action-group-connected' }, [
    translateDirectionSelect,
    translateBtn,
  ]);

  // Export buttons
  const exportPdfBtn = slButton({
    variant: 'primary',
    icon: 'file-pdf',
    text: 'Export PDF',
    onClick: () => handleExport('pdf'),
  });

  const exportHtmlBtn = slButton({
    variant: 'default',
    icon: 'file-code',
    text: 'Export HTML',
    onClick: () => handleExport('html'),
  });

  // Check LLM availability and hide groups if unavailable
  async function checkLlmStatus() {
    try {
      const result = await fetch('/api/llm/status');
      const data = await result.json();
      const available = data.providers?.claude || data.providers?.mistral;
      store.set({ llmProviders: data.providers || { claude: false, mistral: false } });

      if (!available) {
        enhanceGroup.hidden = true;
        translateGroup.hidden = true;
      }
    } catch {
      enhanceGroup.hidden = true;
      translateGroup.hidden = true;
    }
  }

  // Enhancement handler
  async function handleEnhance() {
    const state = store.get();

    if (!state.content.trim()) {
      warning('No content to enhance');
      return;
    }

    const options = {
      fixStructure: enhanceStructureCheck.checked,
      fixTypos: enhanceTyposCheck.checked,
      improveReadability: enhanceReadabilityCheck.checked,
      getSuggestions: enhanceSuggestionsCheck.checked,
    };

    if (!options.fixStructure && !options.fixTypos && !options.improveReadability && !options.getSuggestions) {
      warning('Please select at least one enhancement option');
      return;
    }

    const willModify = options.fixStructure || options.fixTypos || options.improveReadability;
    if (willModify) {
      store.set({ originalContent: state.content });
    }

    const isSuggestionsOnly = options.getSuggestions && !willModify;
    const messages = isSuggestionsOnly ? SUGGESTION_MESSAGES : ENHANCE_MESSAGES;
    const stage2Key = isSuggestionsOnly ? 'thinking' : 'improving';

    // Shuffle stage 2 messages so we don't repeat
    const stage2Messages = [...messages[stage2Key]].sort(() => Math.random() - 0.5);
    let stage2Index = 0;

    const hide = showLoading(pickRandom(messages.analyzing));

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex++;
      if (messageIndex <= 4) {
        // Cycle through multiple stage 2 messages
        updateLoadingMessage(stage2Messages[stage2Index % stage2Messages.length]);
        stage2Index++;
      } else if (messageIndex === 5) {
        updateLoadingMessage(pickRandom(messages.wrapping));
      }
    }, 3000);

    try {
      const globalContext = getGlobalContext();

      const result = await post('/api/docx/enhance', {
        markdown: state.content,
        provider: getProvider(),
        globalContext,
        ...options,
      });

      clearInterval(messageInterval);

      if (!result.ok) {
        throw new Error(result.data?.error || 'Enhancement failed');
      }

      onEnhanceComplete({
        enhanced: willModify ? result.data.enhanced : null,
        changes: result.data.changes || [],
        suggestions: result.data.suggestions || [],
        willModify,
      });

      const successText = isSuggestionsOnly ? 'Suggestions ready' : 'Enhanced with AI';
      success(successText);
    } catch (err) {
      clearInterval(messageInterval);
      if (willModify) {
        store.set({ originalContent: null });
      }
      error(`Enhancement failed: ${err.message}`);
    } finally {
      hide();
    }
  }

  // Translation handler
  async function handleTranslate() {
    const state = store.get();

    if (!state.content.trim()) {
      warning('No content to translate');
      return;
    }

    const direction = translateDirectionSelect.value;
    const directionLabel = direction === 'nl-to-en' ? 'Dutch → English' : 'English → Dutch';
    const hide = showLoading(`Translating (${directionLabel})...`);

    try {
      const result = await post('/api/docx/translate', {
        markdown: state.content,
        provider: getProvider(),
        direction,
      });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Translation failed');
      }

      onEnhanceComplete({
        enhanced: result.data.translated,
        changes: [],
        suggestions: [],
        willModify: true,
      });

      success(`Translated (${result.data.chunksProcessed} chunk${result.data.chunksProcessed !== 1 ? 's' : ''})`);
    } catch (err) {
      error(`Translation failed: ${err.message}`);
    } finally {
      hide();
    }
  }

  // Unified export handler
  async function handleExport(format) {
    const state = store.get();

    if (!state.content.trim()) {
      warning('No content to export');
      return;
    }

    const config = getExportConfig(format);
    const hide = showLoading(config.loadingMessage);

    try {
      const result = await exportDocument({
        format,
        content: state.content,
        title: state.contentTitle,
        themeId: state.selectedTheme,
        generateToc: state.generateToc,
        pageNumbers: state.pageNumbers,
      });

      success(result.message);
    } catch (err) {
      error(`Export failed: ${err.message}`);
    } finally {
      hide();
    }
  }

  // Build element
  const element = h('div', { class: 'converter-actions-bar' }, [
    enhanceGroup,
    translateGroup,
    h('div', { class: 'actions-spacer' }),
    h('div', { class: 'action-group' }, [exportPdfBtn, exportHtmlBtn]),
  ]);

  // Initialize
  checkLlmStatus();

  return {
    element,
    enhanceDialog,
  };
}
