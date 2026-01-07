/**
 * Actions Bar Component
 * Bottom bar with AI enhancement, translation, and export actions.
 */

import { h } from '../../lib/dom.js';
import { post } from '../../lib/api.js';
import { success, error, warning } from '../../lib/toast.js';
import { showLoading, updateLoadingMessage } from '../../lib/loading.js';
import { slButton, slSelect, slSwitch, sl } from '../../lib/shoelace.js';
import { exportDocument, getExportConfig } from '../../lib/export-service.js';
import { getProvider, getGlobalContext } from './state.js';
import { t, tRandom, getLocale } from '../../lib/i18n.js';

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
  const enhanceDialog = sl('sl-dialog', { label: t('enhance.dialogTitle') }, [
    h('div', { class: 'enhance-options' }, [
      h('label', { class: 'enhance-option' }, [
        enhanceStructureCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, [t('enhance.structureTitle')]),
          h('span', { class: 'enhance-option-desc' }, [
            t('enhance.structureDesc'),
          ]),
        ]),
      ]),
      h('label', { class: 'enhance-option' }, [
        enhanceTyposCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, [t('enhance.typosTitle')]),
          h('span', { class: 'enhance-option-desc' }, [
            t('enhance.typosDesc'),
          ]),
        ]),
      ]),
      h('label', { class: 'enhance-option' }, [
        enhanceReadabilityCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, [t('enhance.readabilityTitle')]),
          h('span', { class: 'enhance-option-desc' }, [
            t('enhance.readabilityDesc'),
          ]),
        ]),
      ]),
      h('label', { class: 'enhance-option' }, [
        enhanceSuggestionsCheck,
        h('div', { class: 'enhance-option-content' }, [
          h('span', { class: 'enhance-option-title' }, [t('enhance.suggestionsTitle')]),
          h('span', { class: 'enhance-option-desc' }, [
            t('enhance.suggestionsDesc'),
          ]),
        ]),
      ]),
    ]),
    h('div', { slot: 'footer', class: 'enhance-dialog-footer' }, [
      slButton({
        variant: 'default',
        text: t('enhance.cancel'),
        onClick: () => enhanceDialog.hide(),
      }),
      slButton({
        variant: 'primary',
        icon: 'magic',
        text: t('enhance.enhance'),
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
    text: t('actions.enhance'),
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
  translateDirectionSelect.appendChild(sl('sl-option', { value: 'nl-to-en' }, [t('actions.translateNlEn')]));
  translateDirectionSelect.appendChild(sl('sl-option', { value: 'en-to-nl' }, [t('actions.translateEnNl')]));

  const translateBtn = slButton({
    variant: 'default',
    icon: 'translate',
    text: t('actions.translate'),
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
    text: t('actions.exportPdf'),
    onClick: () => handleExport('pdf'),
  });

  const exportHtmlBtn = slButton({
    variant: 'default',
    icon: 'file-code',
    text: t('actions.exportHtml'),
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
      warning(t('toast.noContentEnhance'));
      return;
    }

    const options = {
      fixStructure: enhanceStructureCheck.checked,
      fixTypos: enhanceTyposCheck.checked,
      improveReadability: enhanceReadabilityCheck.checked,
      getSuggestions: enhanceSuggestionsCheck.checked,
    };

    if (!options.fixStructure && !options.fixTypos && !options.improveReadability && !options.getSuggestions) {
      warning(t('toast.selectOption'));
      return;
    }

    const willModify = options.fixStructure || options.fixTypos || options.improveReadability;
    if (willModify) {
      store.set({ originalContent: state.content });
    }

    const isSuggestionsOnly = options.getSuggestions && !willModify;
    const messagesKey = isSuggestionsOnly ? 'aiLoading.suggestions' : 'aiLoading.enhance';
    const stage2Key = isSuggestionsOnly ? 'thinking' : 'improving';

    // Get messages from translations
    const analyzingMessages = t(`${messagesKey}.analyzing`);
    const stage2Messages = [...t(`${messagesKey}.${stage2Key}`)].sort(() => Math.random() - 0.5);
    const wrappingMessages = t(`${messagesKey}.wrapping`);

    let stage2Index = 0;
    const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const hide = showLoading(pickRandom(analyzingMessages));

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex++;
      if (messageIndex <= 4) {
        // Cycle through multiple stage 2 messages
        updateLoadingMessage(stage2Messages[stage2Index % stage2Messages.length]);
        stage2Index++;
      } else if (messageIndex === 5) {
        updateLoadingMessage(pickRandom(wrappingMessages));
      }
    }, 3000);

    try {
      const globalContext = getGlobalContext();

      const result = await post('/api/docx/enhance', {
        markdown: state.content,
        provider: getProvider(),
        globalContext,
        language: getLocale(),
        ...options,
      });

      clearInterval(messageInterval);

      if (!result.ok) {
        throw new Error(result.data?.error || t('toast.enhancementFailed', { error: '' }));
      }

      onEnhanceComplete({
        enhanced: willModify ? result.data.enhanced : null,
        changes: result.data.changes || [],
        suggestions: result.data.suggestions || [],
        coverPage: result.data.coverPage,
        willModify,
      });

      const successText = isSuggestionsOnly ? t('toast.suggestionsReady') : t('toast.enhanced');
      success(successText);
    } catch (err) {
      clearInterval(messageInterval);
      if (willModify) {
        store.set({ originalContent: null });
      }
      error(t('toast.enhancementFailed', { error: err.message }));
    } finally {
      hide();
    }
  }

  // Translation handler
  async function handleTranslate() {
    const state = store.get();

    if (!state.content.trim()) {
      warning(t('toast.noContentTranslate'));
      return;
    }

    const direction = translateDirectionSelect.value;
    const loadingKey = direction === 'nl-to-en' ? 'loading.translatingNlEn' : 'loading.translatingEnNl';
    const hide = showLoading(t(loadingKey));

    try {
      const result = await post('/api/docx/translate', {
        markdown: state.content,
        provider: getProvider(),
        direction,
      });

      if (!result.ok) {
        throw new Error(result.data?.error || t('toast.translationFailed', { error: '' }));
      }

      onEnhanceComplete({
        enhanced: result.data.translated,
        changes: [],
        suggestions: [],
        willModify: true,
      });

      const count = result.data.chunksProcessed;
      success(t('toast.translated', { count, plural: count !== 1 ? 's' : '' }));
    } catch (err) {
      error(t('toast.translationFailed', { error: err.message }));
    } finally {
      hide();
    }
  }

  // Unified export handler
  async function handleExport(format) {
    const state = store.get();

    if (!state.content.trim()) {
      warning(t('toast.noContentExport'));
      return;
    }

    const loadingKey = format === 'pdf' ? 'loading.generatingPdf' : 'loading.generatingHtml';
    const hide = showLoading(t(loadingKey));

    try {
      const result = await exportDocument({
        format,
        content: state.content,
        title: state.contentTitle,
        themeId: state.selectedTheme,
        generateToc: state.generateToc,
        pageNumbers: state.pageNumbers,
        coverPage: state.coverPage,
        coverPageOptions: {
          subtitle: state.coverPageSubtitle,
          version: state.coverPageVersion,
          date: state.coverPageDate,
          locale: getLocale(),
        },
      });

      const successKey = format === 'pdf' ? 'toast.pdfExported' : 'toast.htmlExported';
      success(t(successKey));
    } catch (err) {
      error(t('toast.exportFailed', { error: err.message }));
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
