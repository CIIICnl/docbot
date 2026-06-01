/**
 * New Document Modal
 * Modal for creating new documents with multiple input modes.
 */

import { h } from '../../../lib/dom.js';
import { t, maybeOfferLanguageSwitch } from '../../../lib/i18n.js';
import { post } from '../../../lib/api.js';
import { populateThemeSelect } from '../../../lib/document-themes.js';
import { checkNotionAvailable } from '../../../lib/feature-detection.js';
import { error, warning } from '../../../lib/toast.js';
import { createModal } from '../../../lib/modal.js';
import { showLoadingModal } from '../../../lib/loading-modal.js';
import { createDraft } from '../../../lib/drafts.js';
import { parseDocumentFile } from '../../../lib/file-processing.js';
import { sl, slInput, slTextarea, slSelect, slSwitch, slButton } from '../../../lib/shoelace.js';
import { STORAGE_KEYS, DEFAULTS } from '../../../lib/constants.js';

/**
 * Open the new document modal
 * @param {Object} options
 * @param {Function} options.h - DOM helper
 * @param {HTMLElement} options.root - Root element
 * @param {Function} options.navigate - Navigation function
 * @param {Object} options.api - API client
 * @param {Set} options.openOverlayClosers - Overlay registry
 * @param {Function} options.onCreated - Called when document is created
 */
export async function openNewDocumentModal({
  h,
  root,
  navigate,
  api,
  openOverlayClosers,
  onCreated,
}) {
  let mode = 'paste'; // 'paste' | 'upload' | 'notion' | 'empty'
  let busy = false;
  let notionAvailable = false;

  // Modal
  const modalApi = createModal(h, {
    title: t('newDocument.title'),
    modalClass: 'modal-new-document',
    closeOnBackdrop: false,
    onClose: () => {},
  });

  // Mode buttons
  const btnModeEmpty = slButton({
    variant: 'default',
    size: 'small',
    icon: 'file-earmark',
    text: t('newDocument.mode.empty'),
    onClick: () => setMode('empty'),
  });

  const btnModePaste = slButton({
    variant: 'default',
    size: 'small',
    icon: 'clipboard',
    text: t('newDocument.mode.paste'),
    onClick: () => setMode('paste'),
  });

  const btnModeUpload = slButton({
    variant: 'default',
    size: 'small',
    icon: 'upload',
    text: t('newDocument.mode.upload'),
    onClick: () => setMode('upload'),
  });

  const btnModeNotion = slButton({
    variant: 'default',
    size: 'small',
    icon: 'box-arrow-in-right',
    text: t('newDocument.mode.notion'),
    onClick: () => setMode('notion'),
  });

  const modeButtons = h('div', { class: 'new-doc-mode-buttons' }, [
    btnModePaste,
    btnModeUpload,
    btnModeNotion,
    btnModeEmpty,
  ]);

  // ========== Mode-specific content ==========

  // Empty mode: just title
  const titleInputEmpty = slInput({
    placeholder: t('newDocument.titlePlaceholder'),
    size: 'medium',
  });
  const contentEmpty = h('div', { class: 'new-doc-content' }, [
    h('label', { class: 'new-doc-label', text: t('newDocument.titleLabel') }),
    titleInputEmpty,
  ]);

  // Paste mode: title + textarea
  const titleInputPaste = slInput({
    placeholder: t('newDocument.titlePlaceholder'),
    size: 'medium',
  });
  const pasteTextarea = slTextarea({
    placeholder: t('newDocument.contentPlaceholder'),
    rows: 8,
    resize: 'auto',
  });
  const contentPaste = h('div', { class: 'new-doc-content is-hidden' }, [
    h('label', { class: 'new-doc-label', text: t('newDocument.titleLabel') }),
    titleInputPaste,
    h('label', { class: 'new-doc-label', text: t('newDocument.contentLabel'), style: 'margin-top: var(--sl-spacing-medium);' }),
    pasteTextarea,
  ]);

  // Upload mode: file input + title
  const titleInputUpload = slInput({
    placeholder: t('newDocument.titlePlaceholder'),
    size: 'medium',
  });
  const fileInput = h('input', {
    type: 'file',
    accept: '.md,.markdown,.txt,.docx',
    class: 'sr-only',
  });
  const fileNameDisplay = h('span', { class: 'new-doc-filename', text: t('newDocument.noFileSelected') });
  const uploadBtn = slButton({
    variant: 'default',
    size: 'medium',
    icon: 'folder2-open',
    text: t('newDocument.selectFile'),
    onClick: () => fileInput.click(),
  });
  let selectedFile = null;

  fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files?.[0] || null;
    if (selectedFile) {
      fileNameDisplay.textContent = selectedFile.name;
      // Auto-fill title from filename
      const baseName = selectedFile.name.replace(/\.(md|markdown|txt|docx)$/i, '');
      if (!titleInputUpload.value) {
        titleInputUpload.value = baseName;
      }
    } else {
      fileNameDisplay.textContent = t('newDocument.noFileSelected');
    }
  });

  const contentUpload = h('div', { class: 'new-doc-content is-hidden' }, [
    h('div', { class: 'new-doc-file-row' }, [uploadBtn, fileNameDisplay, fileInput]),
    h('label', { class: 'new-doc-label', text: t('newDocument.titleLabel'), style: 'margin-top: var(--sl-spacing-medium);' }),
    titleInputUpload,
  ]);

  // Notion mode: URL input
  const titleInputNotion = slInput({
    placeholder: t('newDocument.titlePlaceholder'),
    size: 'medium',
  });
  const notionInput = slInput({
    placeholder: t('newDocument.notionUrlPlaceholder'),
    size: 'medium',
    type: 'url',
  });
  const contentNotion = h('div', { class: 'new-doc-content is-hidden' }, [
    h('label', { class: 'new-doc-label', text: t('newDocument.notionUrlLabel') }),
    notionInput,
    h('label', { class: 'new-doc-label', text: t('newDocument.titleLabel'), style: 'margin-top: var(--sl-spacing-medium);' }),
    h('p', { class: 'new-doc-hint', text: t('newDocument.titleHintNotion') }),
    titleInputNotion,
  ]);

  // ========== Shared options ==========

  // Theme selector
  const themeSelect = slSelect({
    value: DEFAULTS.THEME,
    size: 'small',
    hoist: true,
  });

  // AI enhancement option toggles (all ON by default except suggestions)
  const aiStructureSwitch = slSwitch({ checked: true, size: 'small' });
  const aiTyposSwitch = slSwitch({ checked: true, size: 'small' });
  const aiReadabilitySwitch = slSwitch({ checked: true, size: 'small' });
  const aiSuggestionsSwitch = slSwitch({ checked: false, size: 'small' });

  // Cover page toggle (ON by default)
  const coverPageSwitch = slSwitch({ checked: true, size: 'small' });

  // Page numbers toggle (ON by default)
  const pageNumbersSwitch = slSwitch({ checked: true, size: 'small' });

  // ToC toggle (ON by default)
  const tocSwitch = slSwitch({ checked: true, size: 'small' });

  // AI enhancement options (hidden when mode is 'empty')
  const aiEnhanceSection = h('div', { class: 'new-doc-ai-section' }, [
    h('div', { class: 'new-doc-section-header' }, [
      h('span', { text: t('newDocument.options.aiEnhance') }),
    ]),
    h('div', { class: 'new-doc-ai-options' }, [
      h('div', { class: 'new-doc-ai-option' }, [
        h('label', { class: 'new-doc-option-label' }, [
          aiStructureSwitch,
          h('span', { text: t('enhance.structureTitle') }),
        ]),
        h('p', { class: 'new-doc-option-hint', text: t('enhance.structureDesc') }),
      ]),
      h('div', { class: 'new-doc-ai-option' }, [
        h('label', { class: 'new-doc-option-label' }, [
          aiTyposSwitch,
          h('span', { text: t('enhance.typosTitle') }),
        ]),
        h('p', { class: 'new-doc-option-hint', text: t('enhance.typosDesc') }),
      ]),
      h('div', { class: 'new-doc-ai-option' }, [
        h('label', { class: 'new-doc-option-label' }, [
          aiReadabilitySwitch,
          h('span', { text: t('enhance.readabilityTitle') }),
        ]),
        h('p', { class: 'new-doc-option-hint', text: t('enhance.readabilityDesc') }),
      ]),
      h('div', { class: 'new-doc-ai-option' }, [
        h('label', { class: 'new-doc-option-label' }, [
          aiSuggestionsSwitch,
          h('span', { text: t('enhance.suggestionsTitle') }),
        ]),
        h('p', { class: 'new-doc-option-hint', text: t('enhance.suggestionsDesc') }),
      ]),
    ]),
  ]);

  const optionsGrid = h('div', { class: 'new-doc-options' }, [
    h('div', { class: 'new-doc-option' }, [
      h('label', { class: 'new-doc-option-label' }, [
        coverPageSwitch,
        h('span', { text: t('newDocument.options.coverPage') }),
      ]),
    ]),
    h('div', { class: 'new-doc-option' }, [
      h('label', { class: 'new-doc-option-label' }, [
        pageNumbersSwitch,
        h('span', { text: t('newDocument.options.pageNumbers') }),
      ]),
    ]),
    h('div', { class: 'new-doc-option' }, [
      h('label', { class: 'new-doc-option-label' }, [
        tocSwitch,
        h('span', { text: t('newDocument.options.toc') }),
      ]),
    ]),
  ]);

  const themeRow = h('div', { class: 'new-doc-theme-row' }, [
    h('label', { class: 'new-doc-label', text: t('newDocument.options.theme') }),
    themeSelect,
  ]);

  // ========== Footer actions ==========

  const btnCancel = slButton({
    variant: 'default',
    text: t('common.cancel'),
    onClick: () => {
      if (!busy) modalApi.close();
    },
  });

  const btnCreate = slButton({
    variant: 'primary',
    text: t('newDocument.create'),
    onClick: () => handleCreate(),
  });

  // ========== Mode switching ==========

  function setMode(newMode) {
    if (busy) return;
    mode = newMode;
    syncModeUi();
  }

  function syncModeUi() {
    // Update button active states
    btnModeEmpty.setAttribute('variant', mode === 'empty' ? 'primary' : 'default');
    btnModePaste.setAttribute('variant', mode === 'paste' ? 'primary' : 'default');
    btnModeUpload.setAttribute('variant', mode === 'upload' ? 'primary' : 'default');
    btnModeNotion.setAttribute('variant', mode === 'notion' ? 'primary' : 'default');

    // Show/hide content areas
    contentEmpty.classList.toggle('is-hidden', mode !== 'empty');
    contentPaste.classList.toggle('is-hidden', mode !== 'paste');
    contentUpload.classList.toggle('is-hidden', mode !== 'upload');
    contentNotion.classList.toggle('is-hidden', mode !== 'notion');

    // Hide AI enhancement section when in empty mode (no content to enhance)
    aiEnhanceSection.classList.toggle('is-hidden', mode === 'empty');

    // Update create button text
    if (mode === 'notion') {
      btnCreate.textContent = t('newDocument.import');
    } else if (mode === 'upload') {
      btnCreate.textContent = t('newDocument.import');
    } else {
      btnCreate.textContent = t('newDocument.create');
    }
  }

  function setBusy(isBusy) {
    busy = isBusy;
    modalApi.setBusy(isBusy);
    btnCancel.disabled = isBusy;
    btnCreate.disabled = isBusy;
    btnCreate.loading = isBusy;
  }

  // ========== Create handler ==========

  async function handleCreate() {
    if (busy) return;

    let title = '';
    let content = '';

    // Gather input based on mode
    if (mode === 'empty') {
      title = titleInputEmpty.value?.trim() || t('newDocument.untitled');
      content = '';
    } else if (mode === 'paste') {
      title = titleInputPaste.value?.trim() || t('newDocument.untitled');
      content = pasteTextarea.value || '';
    } else if (mode === 'upload') {
      if (!selectedFile) {
        warning(t('newDocument.errorNoFile'));
        return;
      }
      title = titleInputUpload.value?.trim() || selectedFile.name.replace(/\.(md|markdown|txt|docx)$/i, '');

      setBusy(true);
      try {
        content = await readFileContent(selectedFile);
      } catch (err) {
        error(t('newDocument.errorReadFile', { error: err.message }));
        setBusy(false);
        return;
      }
      setBusy(false);
    } else if (mode === 'notion') {
      const url = notionInput.value?.trim();
      if (!url) {
        warning(t('newDocument.errorNoUrl'));
        return;
      }
      title = titleInputNotion.value?.trim();

      modalApi.close();

      const loadingModal = showLoadingModal({
        h,
        root,
        title: t('newDocument.importing'),
        initialMessage: t('newDocument.fetchingNotion'),
      });

      try {
        const result = await post('/api/notion/fetch', { url });
        if (!result.ok) {
          throw new Error(result.data?.error || 'Notion fetch failed');
        }
        content = result.data.markdown;
        title = title || result.data.title || t('newDocument.untitled');
        loadingModal.close();
      } catch (err) {
        loadingModal.close();
        error(t('newDocument.errorNotion', { error: err.message }));
        return;
      }
    }

    // Get options
    const settings = {
      themeId: themeSelect.value || DEFAULTS.THEME,
      generateToc: tocSwitch.checked,
      pageNumbers: pageNumbersSwitch.checked,
      coverPage: coverPageSwitch.checked,
    };

    // Check if any AI enhancement option is selected
    const aiOptions = {
      fixStructure: aiStructureSwitch.checked,
      fixTypos: aiTyposSwitch.checked,
      improveReadability: aiReadabilitySwitch.checked,
      getSuggestions: aiSuggestionsSwitch.checked,
    };
    const shouldEnhance = content.trim() && (aiOptions.fixStructure || aiOptions.fixTypos || aiOptions.improveReadability || aiOptions.getSuggestions);

    // Close modal if not already closed (Notion closes it early)
    if (mode !== 'notion') {
      modalApi.close();
    }

    // Store AI changes to pass to editor
    let aiChanges = null;

    // If AI enhance is enabled and there's content, run enhancement
    if (shouldEnhance) {
      // Pick rotating-message arrays based on which options are selected,
      // mirroring the editor's actions-bar.js. Modifying-vs-suggestions-only
      // splits the source pool; if exactly one modify-option is on, use the
      // option-specific array so messages match what the user picked.
      const willModify = aiOptions.fixStructure || aiOptions.fixTypos || aiOptions.improveReadability;
      const isSuggestionsOnly = aiOptions.getSuggestions && !willModify;
      const messagesKey = isSuggestionsOnly ? 'aiLoading.suggestions' : 'aiLoading.enhance';

      let stage2Key;
      if (isSuggestionsOnly) {
        stage2Key = 'thinking';
      } else {
        const modifyCount = [aiOptions.fixStructure, aiOptions.fixTypos, aiOptions.improveReadability].filter(Boolean).length;
        if (modifyCount === 1) {
          if (aiOptions.fixStructure) stage2Key = 'improvingStructure';
          else if (aiOptions.fixTypos) stage2Key = 'improvingTypos';
          else stage2Key = 'improvingReadability';
        } else {
          stage2Key = 'improving';
        }
      }

      const analyzingMessages = t(`${messagesKey}.analyzing`);
      const stage2Messages = [...t(`${messagesKey}.${stage2Key}`)].sort(() => Math.random() - 0.5);
      const wrappingMessages = t(`${messagesKey}.wrapping`);
      const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

      // Truncate long titles so the modal line doesn't wrap awkwardly.
      const titlePrefix = title && title.length > 50 ? `${title.slice(0, 47)}…` : title;
      const personalize = (msg, includeTitle) =>
        includeTitle && titlePrefix ? `${titlePrefix} — ${msg}` : msg;

      const loadingModal = showLoadingModal({
        h,
        root,
        title: t('newDocument.enhancing'),
        initialMessage: personalize(pickRandom(analyzingMessages), false),
      });

      // Eased progress curve: 5% → ~92% asymptotically over ~90s. The LLM call
      // is non-streaming so we have no real signal — this just guarantees the
      // bar always moves forward instead of sitting at 20%.
      const PROGRESS_INITIAL = 5;
      const PROGRESS_TARGET = 92;
      const PROGRESS_TAU_MS = 30000;
      const startTime = Date.now();
      loadingModal.setProgress(PROGRESS_INITIAL);
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = PROGRESS_INITIAL + (PROGRESS_TARGET - PROGRESS_INITIAL) * (1 - Math.exp(-elapsed / PROGRESS_TAU_MS));
        loadingModal.setProgress(pct);
      }, 500);

      // Rotate messages every 3s. Stage2 keeps cycling for long calls so the
      // user doesn't stare at a single "Almost done..." for a minute.
      let messageIndex = 0;
      let stage2Index = 0;
      const messageInterval = setInterval(() => {
        messageIndex++;
        const includeTitle = messageIndex % 3 !== 0;
        const useWrapping = messageIndex >= 4 && messageIndex % 5 === 0;
        const msg = useWrapping
          ? pickRandom(wrappingMessages)
          : stage2Messages[stage2Index++ % stage2Messages.length];
        loadingModal.update(personalize(msg, includeTitle));
      }, 3000);

      try {
        const provider = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROVIDER) || DEFAULTS.PROVIDER;
        const globalContext = localStorage.getItem(STORAGE_KEYS.GLOBAL_CONTEXT) || '';

        const result = await post('/api/docx/enhance', {
          markdown: content,
          provider,
          globalContext,
          language: document.documentElement.lang || 'en',
          ...aiOptions,
        });

        clearInterval(messageInterval);
        clearInterval(progressInterval);

        if (!result.ok) {
          throw new Error(result.data?.error || 'Enhancement failed');
        }

        content = result.data.enhanced || content;

        // Store AI changes and suggestions to show in editor
        if ((result.data.changes && result.data.changes.length > 0) ||
            (result.data.suggestions && result.data.suggestions.length > 0) ||
            result.data.overallImpression) {
          aiChanges = {
            changes: result.data.changes || [],
            detailedChanges: result.data.detailedChanges || [],
            suggestions: result.data.suggestions || [],
            overallImpression: result.data.overallImpression || null,
            originalContent: result.data.enhanced ? content : null,
          };
        }

        // Use cover page metadata from AI if available
        if (result.data.coverPage) {
          settings.coverPageOptions = {
            subtitle: result.data.coverPage.subtitle || '',
            version: result.data.coverPage.version || '',
            date: result.data.coverPage.date || '',
          };
          // If the AI extracted a title from the body's leading H1, prefer it
          // over the user-supplied placeholder (but only when one was found).
          if (result.data.coverPage.title) {
            title = result.data.coverPage.title;
          }
        }

        loadingModal.setProgress(100);
        loadingModal.update(t('newDocument.enhanceDone'));
        await new Promise((r) => setTimeout(r, 500));
        loadingModal.close();
      } catch (err) {
        clearInterval(messageInterval);
        clearInterval(progressInterval);
        loadingModal.close();
        error(t('newDocument.errorEnhance', { error: err.message }));
        // Continue without enhancement
      }
    }

    // Create the draft
    const draft = await createDraft({ title, content, settings, aiChanges });

    // Notify and navigate
    onCreated?.(draft);
    navigate(`/edit/${draft.id}`);
  }

  /**
   * Read file content (handles both text and docx)
   */
  async function readFileContent(file) {
    const result = await parseDocumentFile(file);
    await maybeOfferLanguageSwitch(result.detectedLanguage);
    return result.markdown;
  }

  // ========== Load themes and check Notion ==========

  async function loadThemes() {
    await populateThemeSelect(themeSelect);
  }

  async function checkNotionStatus() {
    notionAvailable = await checkNotionAvailable();
    btnModeNotion.hidden = !notionAvailable;
  }

  // ========== Assemble modal ==========

  modalApi.content.append(
    modeButtons,
    contentEmpty,
    contentPaste,
    contentUpload,
    contentNotion,
    h('hr', { class: 'new-doc-divider' }),
    optionsGrid,
    themeRow,
    aiEnhanceSection
  );

  modalApi.footer.append(btnCancel, btnCreate);

  // Initialize
  syncModeUi();
  loadThemes();
  checkNotionStatus();

  // Show modal
  modalApi.show(root, openOverlayClosers);

  // Focus first input based on mode
  requestAnimationFrame(() => {
    if (mode === 'paste') {
      pasteTextarea.focus();
    } else if (mode === 'empty') {
      titleInputEmpty.focus();
    }
  });
}
