/**
 * English Translations
 */
export default {
  // Common UI elements
  common: {
    appName: 'DreamDocs',
    confirm: 'Confirm',
    cancel: 'Cancel',
    delete: 'Delete',
    save: 'Save',
    ok: 'OK',
    loading: 'Loading...',
    actions: 'Actions',
  },

  // Navigation
  nav: {
    convert: 'Convert',
    settings: 'Settings',
    signOut: 'Sign out',
  },

  // Login page
  login: {
    title: 'Sign in to DreamDocs',
    emailLabel: 'Email',
    emailPlaceholder: 'your@email.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    submit: 'Sign in',
    devBypass: 'Continue without signing in (dev)',
    signingIn: 'Signing in...',
    devLogin: 'Dev login...',
    errorRequired: 'Please enter email and password',
    errorFailed: 'Login failed',
    devLoginFailed: 'Dev login failed',
  },

  // Settings page
  settings: {
    title: 'Settings',
    subtitle: 'Manage your preferences',

    appearance: {
      title: 'Appearance',
      description: 'Customize how the application looks.',
      themeLabel: 'Theme',
      themeDescription: 'Choose between light and dark mode.',
      themeLight: 'Light',
      themeDark: 'Dark',
      languageLabel: 'Language',
      languageDescription: 'Choose your preferred language.',
    },

    ai: {
      title: 'AI Enhancement',
      descriptionAvailable: 'Configure AI-powered document enhancement for Word imports.',
      descriptionUnavailable: 'AI enhancement requires API keys. Add ANTHROPIC_API_KEY or MISTRAL_API_KEY to your .env file.',
      providerLabel: 'Default Provider',
      providerDescription: 'Choose which AI provider to use by default.',
      providerClaude: 'Claude (Recommended)',
      providerMistral: 'Mistral (EU)',
      contextLabel: 'Global Context',
      contextDescription: 'Instructions that apply to all document conversions.',
    },

    danger: {
      title: 'Danger Zone',
      description: 'Irreversible actions that affect your account.',
      deleteAllTitle: 'Delete All Items',
      deleteAllDescription: 'Permanently delete all items. This cannot be undone.',
      deleteAllButton: 'Delete All',
    },
  },

  // Converter input bar
  input: {
    upload: 'Upload',
    notion: 'Notion',
    saveDraft: 'Save Draft',
    loadDraft: 'Load Draft',
    toc: 'ToC',
    pageNumbers: 'Page #',
    deleteLabel: 'Delete',
  },

  // Notion dialog
  notion: {
    dialogTitle: 'Import from Notion',
    dialogDescription: 'Enter the URL of the Notion page you want to import.',
    import: 'Import',
    errorUrl: 'Enter a Notion page URL',
  },

  // Converter actions
  actions: {
    enhance: 'Enhance with AI',
    translate: 'Translate',
    exportPdf: 'Export PDF',
    exportHtml: 'Export HTML',
    translateNlEn: 'NL \u2192 EN',
    translateEnNl: 'EN \u2192 NL',
  },

  // Enhance dialog
  enhance: {
    dialogTitle: 'Enhance with AI',
    structureTitle: 'Document Structure',
    structureDesc: 'Fix headings, lists, tables, and whitespace formatting',
    typosTitle: 'Fix Typos',
    typosDesc: 'Correct spelling errors, double spaces, and punctuation',
    readabilityTitle: 'Improve Readability',
    readabilityDesc: 'Reorder words and sentences for clarity without changing meaning',
    suggestionsTitle: 'Get Suggestions',
    suggestionsDesc: 'Receive feedback and questions without modifying the document',
    cancel: 'Cancel',
    enhance: 'Enhance',
  },

  // Changes sidebar
  changes: {
    title: 'AI Changes',
    undoAll: 'Undo All Changes',
    reverted: 'Changes reverted',
    noChanges: 'No changes or suggestions',
    changesMade: 'Changes Made',
    suggestions: 'Suggestions & Questions',
    categoryStructure: 'Structure',
    categoryTypos: 'Typos',
    categoryReadability: 'Readability',
    categoryOther: 'Other',
  },

  // Markdown panel
  markdown: {
    title: 'Markdown',
    subtitle: 'Editable',
  },

  // Preview panel
  preview: {
    panelTitle: 'Preview',
    title: 'Document Preview',
    empty: 'Preview will appear here',
    refresh: 'Refresh Preview',
  },

  // 404 page
  notFound: {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    goHome: 'Go Home',
  },

  // Toast messages
  toast: {
    themeChanged: 'Theme changed to {theme}',
    languageChanged: 'Language changed',
    providerChanged: 'Default provider set to {provider}',
    contextSaved: 'AI context saved',
    loadedFile: 'Loaded {filename}',
    parsedWarnings: 'Parsed with {count} warning(s)',
    draftSaved: 'Draft saved: {title}',
    draftLoaded: 'Loaded: {title}',
    draftDeleted: 'Draft deleted',
    fetchedNotion: 'Fetched Notion page',
    enhanced: 'Enhanced with AI',
    suggestionsReady: 'Suggestions ready',
    translated: 'Translated ({count} chunk{plural})',
    pdfExported: 'PDF exported',
    htmlExported: 'HTML exported',
    noContent: 'No content to {action}',
    noContentEnhance: 'No content to enhance',
    noContentTranslate: 'No content to translate',
    noContentExport: 'No content to export',
    noContentSave: 'No content to save',
    selectOption: 'Please select at least one enhancement option',
    enhancementFailed: 'Enhancement failed: {error}',
    translationFailed: 'Translation failed: {error}',
    exportFailed: 'Export failed: {error}',
    fetchFailed: 'Failed to fetch: {error}',
    parseFailed: 'Failed to parse document: {error}',
    readFailed: 'Failed to read file: {error}',
  },

  // Loading messages
  loading: {
    parsingWord: 'Parsing Word document...',
    fetchingNotion: 'Fetching Notion page...',
    generatingPdf: 'Generating PDF...',
    generatingHtml: 'Generating HTML...',
    translatingNlEn: 'Translating (Dutch \u2192 English)...',
    translatingEnNl: 'Translating (English \u2192 Dutch)...',
  },

  // AI enhancement loading messages (arrays for random selection)
  aiLoading: {
    enhance: {
      analyzing: [
        'Analyzing your document...',
        'Dissecting your doc for detailed analysis...',
        'Reading between the lines...',
      ],
      improving: [
        'Making improvements...',
        'Polishing your prose...',
        'Working some magic...',
        'Refining the details...',
        'Smoothing out the rough edges...',
        'Fine-tuning your content...',
        'Sprucing things up...',
        'Giving it a fresh coat of paint...',
        'Tightening up the language...',
        'Adding some polish...',
        'Perfecting the structure...',
        'Cleaning up the formatting...',
        'Making it shine...',
      ],
      wrapping: [
        'Finalizing changes...',
        'Almost done...',
        'Wrapping things up...',
      ],
    },
    suggestions: {
      analyzing: [
        'Reading through your document...',
        'Examining the content...',
        'Taking a close look...',
      ],
      thinking: [
        'Thinking about improvements...',
        'Pondering your prose...',
        'Formulating feedback...',
        'Considering your content...',
        'Weighing the options...',
        'Mulling over the details...',
        'Crafting suggestions...',
        'Reviewing the structure...',
        'Analyzing the flow...',
        'Looking for opportunities...',
        'Gathering insights...',
        'Evaluating the language...',
        'Spotting potential improvements...',
      ],
      wrapping: [
        'Preparing suggestions...',
        'Almost ready...',
        'Gathering thoughts...',
      ],
    },
  },

  // Export
  export: {
    pdf: 'PDF',
    html: 'HTML',
    generatingPdf: 'Generating PDF...',
    generatingHtml: 'Generating HTML...',
    pdfExported: 'PDF exported',
    htmlExported: 'HTML exported',
    noContent: 'No content to export',
    failed: 'Export failed',
  },

  // Search
  search: {
    placeholder: 'Search...',
    previous: 'Previous',
    next: 'Next',
    toggle: 'Search',
    noMatches: 'No matches',
    count: '{current} of {total}',
  },

  // Placeholders
  placeholders: {
    markdownEditor: 'Paste or type your markdown here...\n\nOr use Upload to load a .md or .docx file.',
    notionUrl: 'https://notion.so/...',
    documentTitle: 'Document title...',
    globalContext: `Enter organization style preferences and general instructions for AI enhancement...

Examples:
- Use sentence case for headings
- Keep paragraphs concise
- Use bullet points for lists of 3+ items`,
  },
};
