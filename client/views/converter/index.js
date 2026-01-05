/**
 * Converter View
 * Document conversion interface with input controls at top,
 * editable markdown + preview side-by-side, and export actions.
 */

import { h, empty } from '../../lib/dom.js';
import { post, get } from '../../lib/api.js';
import { success, error, warning } from '../../lib/toast.js';
import { showLoading, hideLoading } from '../../lib/loading.js';
import { downloadFile, downloadBase64 } from '../../lib/download.js';
import { readFileAsText, readFileAsArrayBuffer } from '../../lib/file-upload.js';
import { slButton, slSelect, slSwitch, slTextarea, slInput, sl, slIcon } from '../../lib/shoelace.js';

/**
 * Render the converter view
 */
export async function renderConverter(container) {
  empty(container);

  // State
  let content = '';
  let contentTitle = '';
  let selectedTheme = 'default';
  let generateToc = true;
  let pageNumbers = true;
  let themes = [];
  let llmProviders = { claude: false, mistral: false };

  // Draft storage key
  const DRAFTS_KEY = 'dreamdocs_drafts';

  // Check available integrations
  let notionAvailable = false;
  try {
    const response = await fetch('/api/notion/status');
    const data = await response.json();
    notionAvailable = data.available;
  } catch {}

  try {
    const result = await get('/api/llm/status');
    if (result.ok) {
      llmProviders = result.data.providers;
    }
  } catch {}

  // Get provider from settings
  function getProvider() {
    return localStorage.getItem('dreamdocs_default_provider') || 'claude';
  }

  // ============================================
  // INPUT CONTROLS (top bar)
  // ============================================

  // Combined file upload (MD + Word)
  const fileInput = h('input', {
    type: 'file',
    accept: '.md,.markdown,.txt,.docx',
    class: 'sr-only',
  });
  fileInput.addEventListener('change', () => handleFileUpload(fileInput.files));

  const uploadBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'upload',
    text: 'Upload',
    onClick: () => fileInput.click(),
  });

  // Notion dialog
  const notionInput = slInput({
    placeholder: 'https://notion.so/...',
    size: 'medium',
    style: 'width: 100%;',
  });

  const notionDialog = sl('sl-dialog', { label: 'Import from Notion' }, [
    h('p', { class: 'text-muted', style: 'margin-bottom: var(--sl-spacing-medium);' }, [
      'Enter the URL of the Notion page you want to import.',
    ]),
    notionInput,
    slButton({
      slot: 'footer',
      variant: 'primary',
      text: 'Import',
      onClick: () => handleNotionFetch(),
    }),
  ]);

  const notionBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'box-arrow-in-right',
    text: 'Notion',
    onClick: () => notionDialog.show(),
  });
  if (!notionAvailable) notionBtn.hidden = true;

  // Draft buttons
  const saveDraftBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'save',
    text: 'Save Draft',
    onClick: () => handleSaveDraft(),
  });

  const draftsDropdown = sl('sl-dropdown', { hoist: true }, [
    slButton({
      slot: 'trigger',
      variant: 'default',
      size: 'small',
      icon: 'folder2-open',
      text: 'Load Draft',
      caret: true,
    }),
    sl('sl-menu', { class: 'drafts-menu' }, []),
  ]);
  const draftsMenu = draftsDropdown.querySelector('sl-menu');
  updateDraftsMenu();

  // Title input
  const titleInput = slInput({
    placeholder: 'Document title...',
    size: 'small',
    style: 'width: 200px;',
  });
  titleInput.addEventListener('sl-input', (e) => {
    contentTitle = e.target.value;
  });

  // Theme selector
  const themeSelect = slSelect({
    value: 'default',
    size: 'small',
    style: 'width: 150px;',
    hoist: true,
  });
  themeSelect.addEventListener('sl-change', (e) => {
    selectedTheme = e.target.value;
  });

  // Load themes
  try {
    const result = await get('/api/themes');
    if (result.ok) {
      themes = result.data.themes;
      selectedTheme = result.data.defaultThemeId;
      for (const theme of themes) {
        themeSelect.appendChild(sl('sl-option', { value: theme.id }, [theme.name]));
      }
      themeSelect.value = selectedTheme;
    }
  } catch {}

  // ToC toggle
  const tocSwitch = slSwitch({ checked: true, size: 'small' });
  tocSwitch.addEventListener('sl-change', (e) => {
    generateToc = e.target.checked;
  });
  const tocLabel = h('label', { class: 'input-toggle-label' }, [tocSwitch, ' ToC']);

  // Page numbers toggle
  const pageNumSwitch = slSwitch({ checked: true, size: 'small' });
  pageNumSwitch.addEventListener('sl-change', (e) => {
    pageNumbers = e.target.checked;
  });
  const pageNumLabel = h('label', { class: 'input-toggle-label' }, [pageNumSwitch, ' Page #']);

  const inputBar = h('div', { class: 'converter-input-bar' }, [
    h('div', { class: 'input-bar-sources' }, [
      uploadBtn, fileInput, notionBtn, draftsDropdown,
    ]),
    h('div', { class: 'input-bar-settings' }, [
      titleInput, themeSelect, tocLabel, pageNumLabel, saveDraftBtn,
    ]),
  ]);

  // ============================================
  // MARKDOWN EDITOR (left)
  // ============================================
  const markdownTextarea = slTextarea({
    placeholder: 'Paste or type your markdown here...\n\nOr use Upload to load a .md or .docx file.',
    rows: 20,
    resize: 'vertical',
    className: 'markdown-editor-textarea',
  });
  markdownTextarea.addEventListener('sl-input', (e) => {
    content = e.target.value;
  });

  const markdownPanel = h('div', { class: 'markdown-editor-panel' }, [
    h('div', { class: 'panel-header' }, [
      slIcon({ name: 'markdown', className: 'panel-icon' }),
      h('span', { class: 'panel-title' }, ['Markdown']),
      h('span', { class: 'panel-subtitle text-muted' }, ['Editable']),
    ]),
    markdownTextarea,
  ]);

  // ============================================
  // HTML PREVIEW (right)
  // ============================================
  const previewIframe = h('iframe', {
    class: 'preview-iframe',
    sandbox: 'allow-same-origin',
    title: 'Document Preview',
  });
  const previewEmpty = h('div', { class: 'preview-empty' }, [
    slIcon({ name: 'eye', className: 'preview-empty-icon' }),
    h('p', {}, ['Preview will appear here']),
  ]);
  const previewLoading = h('div', { class: 'preview-loading' }, [
    h('sl-spinner', { style: 'font-size: 1.5rem;' }),
  ]);
  previewLoading.hidden = true;
  previewIframe.hidden = true;

  // Change log
  const changeLogList = h('ul', { class: 'change-log-list' }, []);
  const changeLogSection = h('div', { class: 'change-log' }, [
    h('div', { class: 'change-log-header' }, [
      slIcon({ name: 'magic', className: 'change-log-icon' }),
      h('span', {}, ['AI Changes']),
    ]),
    changeLogList,
  ]);
  changeLogSection.hidden = true;

  // Refresh button in preview header
  const refreshBtn = h('sl-icon-button', {
    name: 'arrow-clockwise',
    label: 'Refresh Preview',
    class: 'preview-refresh-btn',
  });
  refreshBtn.addEventListener('click', () => updatePreview());

  const previewPanel = h('div', { class: 'preview-panel' }, [
    h('div', { class: 'panel-header' }, [
      slIcon({ name: 'eye', className: 'panel-icon' }),
      h('span', { class: 'panel-title' }, ['Preview']),
      h('div', { class: 'panel-header-spacer' }),
      refreshBtn,
    ]),
    h('div', { class: 'preview-content' }, [previewEmpty, previewLoading, previewIframe]),
    changeLogSection,
  ]);

  // ============================================
  // ACTIONS BAR (bottom)
  // ============================================

  // Fix typos checkbox
  const fixTyposCheckbox = slSwitch({ checked: false, size: 'small' });
  const fixTyposLabel = h('label', {
    class: 'input-toggle-label',
    title: 'Also fix double spaces and obvious spelling errors',
  }, [fixTyposCheckbox, ' Fix typos']);

  const enhanceBtn = slButton({
    variant: 'default',
    icon: 'magic',
    text: 'Enhance with AI',
    onClick: () => handleEnhance(),
  });

  // Enhance group with clear association
  const enhanceGroup = h('div', { class: 'action-group action-group-connected' }, [
    fixTyposLabel,
    enhanceBtn,
  ]);

  // Translation direction selector
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

  // Translate group with clear association
  const translateGroup = h('div', { class: 'action-group action-group-connected' }, [
    translateDirectionSelect,
    translateBtn,
  ]);

  // Hide AI groups if no providers available
  if (!llmProviders.claude && !llmProviders.mistral) {
    enhanceGroup.hidden = true;
    translateGroup.hidden = true;
  }

  const exportPdfBtn = slButton({
    variant: 'primary',
    icon: 'file-pdf',
    text: 'Export PDF',
    onClick: () => handleExportPdf(),
  });

  const exportHtmlBtn = slButton({
    variant: 'default',
    icon: 'file-code',
    text: 'Export HTML',
    onClick: () => handleExportHtml(),
  });

  const actionsBar = h('div', { class: 'converter-actions-bar' }, [
    enhanceGroup,
    translateGroup,
    h('div', { class: 'actions-spacer' }),
    h('div', { class: 'action-group' }, [exportPdfBtn, exportHtmlBtn]),
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  function setContent(md, title = '') {
    content = md;
    contentTitle = title;
    markdownTextarea.value = md;
    titleInput.value = title;
    updatePreview();
  }

  // ============================================
  // DRAFT HANDLERS
  // ============================================

  function getDrafts() {
    try {
      const stored = localStorage.getItem(DRAFTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveDrafts(drafts) {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  }

  function handleSaveDraft() {
    if (!content.trim()) {
      warning('No content to save');
      return;
    }

    const drafts = getDrafts();
    const title = contentTitle.trim() || 'Untitled';
    const now = new Date();
    const id = `draft_${Date.now()}`;

    // Check if a draft with same title exists
    const existingIndex = drafts.findIndex(d => d.title === title);
    const draft = {
      id,
      title,
      content,
      savedAt: now.toISOString(),
    };

    if (existingIndex >= 0) {
      drafts[existingIndex] = draft;
    } else {
      drafts.unshift(draft);
    }

    // Keep only last 20 drafts
    if (drafts.length > 20) {
      drafts.length = 20;
    }

    saveDrafts(drafts);
    updateDraftsMenu();
    success(`Draft saved: ${title}`);
  }

  function handleLoadDraft(draft) {
    setContent(draft.content, draft.title);
    success(`Loaded: ${draft.title}`);
  }

  function handleDeleteDraft(draftId, e) {
    e.stopPropagation();
    const drafts = getDrafts().filter(d => d.id !== draftId);
    saveDrafts(drafts);
    updateDraftsMenu();
    success('Draft deleted');
  }

  function updateDraftsMenu() {
    const drafts = getDrafts();
    empty(draftsMenu);

    if (drafts.length === 0) {
      const emptyItem = sl('sl-menu-item', { disabled: true }, [
        'No saved drafts',
      ]);
      draftsMenu.appendChild(emptyItem);
      return;
    }

    for (const draft of drafts) {
      const date = new Date(draft.savedAt);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const deleteBtn = h('sl-icon-button', {
        slot: 'suffix',
        name: 'trash',
        label: 'Delete',
        style: 'font-size: 1rem;',
      });
      deleteBtn.addEventListener('click', (e) => handleDeleteDraft(draft.id, e));

      const item = sl('sl-menu-item', {}, [
        h('div', { class: 'draft-item' }, [
          h('span', { class: 'draft-title' }, [draft.title]),
          h('span', { class: 'draft-date text-muted' }, [dateStr]),
        ]),
        deleteBtn,
      ]);
      item.addEventListener('click', () => handleLoadDraft(draft));
      draftsMenu.appendChild(item);
    }
  }

  async function handleFileUpload(files) {
    const file = files?.[0];
    if (!file) return;

    const isWord = file.name.toLowerCase().endsWith('.docx');

    if (isWord) {
      const hide = showLoading('Parsing Word document...');

      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const base64 = arrayBufferToBase64(arrayBuffer);

        const result = await post('/api/docx/parse', { file: base64 });

        if (!result.ok) {
          throw new Error(result.data?.error || 'Failed to parse document');
        }

        const title = result.data.title || file.name.replace(/\.docx$/i, '');
        setContent(result.data.markdown, title);

        if (result.data.warnings?.length > 0) {
          warning(`Parsed with ${result.data.warnings.length} warning(s)`);
        } else {
          success(`Loaded ${file.name}`);
        }
      } catch (err) {
        error(`Failed to parse document: ${err.message}`);
      } finally {
        hide();
      }
    } else {
      // Markdown/text file
      try {
        const text = await readFileAsText(file);
        const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
        setContent(text, title);
        success(`Loaded ${file.name}`);
      } catch (err) {
        error(`Failed to read file: ${err.message}`);
      }
    }

    // Reset input so same file can be uploaded again
    fileInput.value = '';
  }

  async function handleNotionFetch() {
    const url = notionInput.value?.trim();
    if (!url) {
      warning('Enter a Notion page URL');
      return;
    }

    notionDialog.hide();
    const hide = showLoading('Fetching Notion page...');

    try {
      const result = await post('/api/notion/fetch', { url });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Failed to fetch page');
      }

      setContent(result.data.markdown, result.data.title);
      notionInput.value = '';
      success('Fetched Notion page');
    } catch (err) {
      error(`Failed to fetch: ${err.message}`);
    } finally {
      hide();
    }
  }

  async function handleEnhance() {
    if (!content.trim()) {
      warning('No content to enhance');
      return;
    }

    const hide = showLoading('Enhancing with AI...');

    try {
      const globalContext = localStorage.getItem('dreamdocs_global_context') || '';
      const fixTypos = fixTyposCheckbox.checked;

      const result = await post('/api/docx/enhance', {
        markdown: content,
        provider: getProvider(),
        globalContext,
        fixTypos,
      });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Enhancement failed');
      }

      content = result.data.enhanced;
      markdownTextarea.value = content;

      // Show change log
      if (result.data.changes?.length > 0) {
        empty(changeLogList);
        for (const change of result.data.changes) {
          changeLogList.appendChild(h('li', {}, [change.description]));
        }
        changeLogSection.hidden = false;
      }

      updatePreview();
      success('Enhanced with AI');
    } catch (err) {
      error(`Enhancement failed: ${err.message}`);
    } finally {
      hide();
    }
  }

  async function handleTranslate() {
    if (!content.trim()) {
      warning('No content to translate');
      return;
    }

    const direction = translateDirectionSelect.value;
    const directionLabel = direction === 'nl-to-en' ? 'Dutch → English' : 'English → Dutch';
    const hide = showLoading(`Translating (${directionLabel})...`);

    try {
      const result = await post('/api/docx/translate', {
        markdown: content,
        provider: getProvider(),
        direction,
      });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Translation failed');
      }

      content = result.data.translated;
      markdownTextarea.value = content;

      updatePreview();
      success(`Translated (${result.data.chunksProcessed} chunk${result.data.chunksProcessed !== 1 ? 's' : ''})`);
    } catch (err) {
      error(`Translation failed: ${err.message}`);
    } finally {
      hide();
    }
  }

  async function updatePreview() {
    if (!content.trim()) {
      previewIframe.hidden = true;
      previewLoading.hidden = true;
      previewEmpty.hidden = false;
      return;
    }

    previewEmpty.hidden = true;
    previewLoading.hidden = false;

    try {
      const result = await post('/api/convert/preview', {
        source: 'markdown',
        content,
        options: {
          themeId: selectedTheme,
          generateToc,
          pageNumbers: false,
          title: contentTitle,
        },
      });

      if (result.ok && result.data.html) {
        previewLoading.hidden = true;
        previewIframe.hidden = false;
        previewIframe.srcdoc = result.data.html;
      }
    } catch (err) {
      previewLoading.hidden = true;
      previewEmpty.hidden = false;
    }
  }

  async function handleExportPdf() {
    if (!content.trim()) {
      warning('No content to export');
      return;
    }

    const hide = showLoading('Generating PDF...');

    try {
      const result = await post('/api/convert', {
        source: 'markdown',
        content,
        options: {
          themeId: selectedTheme,
          generateToc,
          pageNumbers,
          title: contentTitle,
        },
      });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Export failed');
      }

      const filename = sanitizeFilename(contentTitle || 'document') + '.pdf';
      downloadBase64(result.data.pdf, filename, 'application/pdf');
      success('PDF exported');
    } catch (err) {
      error(`Export failed: ${err.message}`);
    } finally {
      hide();
    }
  }

  async function handleExportHtml() {
    if (!content.trim()) {
      warning('No content to export');
      return;
    }

    const hide = showLoading('Generating HTML...');

    try {
      const result = await post('/api/convert', {
        source: 'markdown',
        content,
        options: {
          themeId: selectedTheme,
          generateToc,
          pageNumbers: false,
          title: contentTitle,
        },
      });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Export failed');
      }

      const filename = sanitizeFilename(contentTitle || 'document') + '.html';
      downloadFile(result.data.html, filename, 'text/html');
      success('HTML exported');
    } catch (err) {
      error(`Export failed: ${err.message}`);
    } finally {
      hide();
    }
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50) || 'document';
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // ============================================
  // LAYOUT
  // ============================================
  const page = h('div', { class: 'converter-page-v2' }, [
    inputBar,
    h('div', { class: 'converter-editor-area' }, [
      markdownPanel,
      previewPanel,
    ]),
    actionsBar,
    notionDialog,
  ]);

  container.appendChild(page);

  return () => {};
}
