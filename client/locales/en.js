/**
 * English Translations
 */
export default {
  // Common UI elements
  common: {
    appName: 'DreamDocs',
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    save: 'Save',
    ok: 'OK',
    loading: 'Loading...',
    actions: 'Actions',
    fileTooLarge: 'File is {size}, the maximum is {max}. Try compressing the images in the document.',
    unsupportedFormat: 'Unsupported file format: {name}',
    uploadTimeout: 'The upload took too long and was aborted. Please try again; if it keeps hanging, the document may be too heavy.',
  },

  // Navigation
  nav: {
    documents: 'Documents',
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
    forgotPassword: 'Forgot password?',
    orMagicLink: 'Or sign in with a magic link',
    sendMagicLink: 'Send magic link',
    sendingMagicLink: 'Sending...',
    magicLinkSent: 'Check your inbox for the magic link!',
    magicLinkError: 'Failed to send magic link',
    errorInvalidEmail: 'Please enter a valid email address',
  },

  // Forgot password page
  forgotPassword: {
    title: 'Reset Password',
    help: 'Enter your email and we\'ll send you a reset link.',
    emailLabel: 'Email',
    emailPlaceholder: 'your@email.com',
    submit: 'Send Reset Link',
    sending: 'Sending...',
    success: 'If an account exists with this email, a reset link has been sent.',
    error: 'Something went wrong. Please try again.',
    errorInvalidEmail: 'Please enter a valid email address',
    backToLogin: 'Back to login',
  },

  // Reset password page
  resetPassword: {
    title: 'Reset Password',
    validating: 'Validating reset link...',
    invalidToken: 'This reset link is invalid.',
    expiredToken: 'This reset link has expired.',
    resetFor: 'Set a new password for {email}',
    passwordLabel: 'New Password',
    passwordPlaceholder: 'Enter new password',
    confirmLabel: 'Confirm Password',
    confirmPlaceholder: 'Confirm new password',
    submit: 'Reset Password',
    resetting: 'Resetting password...',
    success: 'Your password has been reset successfully!',
    error: 'Something went wrong. Please try again.',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    goToLogin: 'Go to login',
    requestNew: 'Request new reset link',
  },

  // Magic login page
  magicLogin: {
    title: 'Magic Link Login',
    verifying: 'Verifying your magic link...',
    success: 'Login successful! Redirecting...',
    invalidLink: 'This magic link is invalid.',
    expiredLink: 'This magic link has expired.',
    error: 'Something went wrong. Please try again.',
    goToLogin: 'Go to login',
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
      descriptionUnavailable: 'AI enhancement requires API keys. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, or MISTRAL_API_KEY to your .env file.',
      providerLabel: 'Default Provider',
      providerDescription: 'Choose which AI provider to use by default.',
      providerNone: 'None (No AI)',
      providerOpenAI: 'OpenAI (Recommended)',
      providerClaude: 'Claude',
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

  // List view
  list: {
    title: 'Your Documents',
    empty: 'No documents yet',
    emptyHint: 'Create your first document to get started.',
    emptyDraft: 'Empty document',
    newDocument: 'New Document',
    localStorageNotice: 'Drafts are saved to your account and available on any device.',
    delete: 'Delete',
    deleteTitle: 'Delete Document',
    deleteConfirm: 'Delete "{title}"? This cannot be undone.',
    openDraft: 'Open {title}',
    timeJustNow: 'Just now',
    timeMinutes: '{count}m ago',
    timeHours: '{count}h ago',
    timeYesterday: 'Yesterday',
    timeDays: '{count}d ago',
  },

  // New document modal
  newDocument: {
    title: 'New Document',
    untitled: 'Untitled',
    mode: {
      empty: 'Empty',
      paste: 'Paste',
      upload: 'Upload',
      notion: 'Notion',
    },
    titleLabel: 'Title',
    titlePlaceholder: 'Document title...',
    titleHintNotion: 'Leave empty to use the Notion page title',
    contentLabel: 'Content',
    contentPlaceholder: 'Paste your content here...',
    notionUrlLabel: 'Notion Page URL',
    notionUrlPlaceholder: 'https://notion.so/...',
    selectFile: 'Select File',
    noFileSelected: 'No file selected',
    options: {
      theme: 'Theme',
      aiEnhance: 'Enhance with AI',
      aiEnhanceHint: 'Automatically improve structure, fix typos, and enhance readability',
      coverPage: 'Cover page',
      pageNumbers: 'Page numbers',
      toc: 'Table of contents',
    },
    create: 'Create',
    import: 'Import',
    importing: 'Importing...',
    fetchingNotion: 'Fetching Notion page...',
    enhancing: 'Enhancing Document',
    enhancingStructure: 'Optimizing document structure...',
    enhancingTypos: 'Fixing typos and spelling...',
    enhancingReadability: 'Improving readability...',
    enhancingSuggestions: 'Analyzing for suggestions...',
    enhancingMultiple: 'Enhancing your document...',
    enhanceDone: 'Enhancement complete',
    errorNoFile: 'Please select a file',
    errorNoUrl: 'Please enter a Notion page URL',
    errorReadFile: 'Failed to read file: {error}',
    errorNotion: 'Failed to import from Notion: {error}',
    errorEnhance: 'Enhancement failed: {error}',
  },

  // Editor
  editor: {
    backToList: 'Documents',
    saved: 'Saved',
    saving: 'Saving...',
    unsavedChanges: 'You have unsaved changes. Leave anyway?',
    draftNotFound: 'Document not found',
  },

  // Converter input bar
  input: {
    upload: 'Upload',
    notion: 'Notion',
    saveDraft: 'Save Draft',
    loadDraft: 'Load Draft',
    toc: 'ToC',
    pageNumbers: 'Page #',
    coverPage: 'Cover Page',
    pageBreakBeforeH1: 'Break before H1',
    pageBreakBeforeH2: 'Break before H2',
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
    undoAll: 'Undo All',
    exportJson: 'JSON',
    exportReport: 'Report',
    exported: 'Changes exported as JSON',
    reportExported: 'Editing instructions exported',
    reverted: 'Changes reverted',
    noChanges: 'No changes or suggestions',
    changesMade: 'Changes Made',
    suggestions: 'Suggestions & Questions',
    overallImpression: 'Overall Impression',
    improvementsApplied: 'Improvements Applied',
    categoryStructure: 'Structure',
    categoryTypos: 'Typos',
    categoryReadability: 'Readability',
    categoryOther: 'Other',
    // Report generation
    reportTitle: 'Document Editing Instructions',
    reportDocument: 'Document',
    reportDate: 'Date',
    reportIntro: 'This document contains suggested edits and improvements. Please review each item and apply the changes where appropriate.',
    reportSuggestionsTitle: 'Content Suggestions',
    reportSuggestionsIntro: 'The following suggestions may improve the document. Consider whether these changes align with your goals:',
    reportEditsTitle: 'Recommended Edits',
    reportEditsIntro: 'The following specific edits are recommended. Each item indicates what should be changed and where to find it:',
    reportLocation: 'Location:',
    reportCategoryStructure: 'Structure & Formatting',
    reportCategoryTypos: 'Spelling & Punctuation',
    reportCategoryReadability: 'Clarity & Readability',
    reportCategoryOther: 'Other Improvements',
    reportGenerated: 'These instructions were generated by AI document analysis.',
    untitledDocument: 'Untitled Document',
    fetchingDetails: 'Fetching detailed changes...',
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

  // Images panel
  images: {
    title: 'Images',
    empty: 'No images in this document yet. Use Add to upload one.',
    countOne: '1 image',
    countMany: '{count} images',
    addBtn: 'Add',
    replaceBtn: 'Replace',
    copyMarkdown: 'Copy markdown reference',
    copied: 'Markdown reference copied',
    copyFailed: 'Could not copy to clipboard',
    replaced: 'Image replaced',
    refMissing: 'Image reference no longer in document',
    externalImage: 'External — cannot replace',
    usedTimes: 'used {count}×',
    addCopied: 'Uploaded — markdown reference copied to clipboard',
    addAppended: 'Uploaded — appended to end of document',
    tooLarge: 'Image is larger than {max}',
    uploadFailed: 'Upload failed: {reason}',
    altLabel: 'Alt text',
    altPlaceholder: 'Description for screen readers (accessibility)',
    captionLabel: 'Caption',
    captionPlaceholder: 'Shown below the image (optional)',
    fieldsDisabled: 'Alt and caption editable for markdown images',
    metaUpdated: 'Alt text and caption updated',
    beeldbankBtn: 'Beeldbank',
    beeldbankTitle: 'Choose from Beeldbank',
    beeldbankInserted: 'Image added from Beeldbank',
    beeldbankUnavailable: 'Beeldbank picker unavailable',
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
    aiDisabled: 'AI is disabled. Enable an AI provider in Settings to use this feature.',
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
      // Option-specific messages
      improvingStructure: [
        'Optimizing document structure...',
        'Perfecting the headings...',
        'Fine-tuning the layout...',
        'Restructuring for clarity...',
        'Organizing your content...',
      ],
      improvingTypos: [
        'Hunting down typos...',
        'Correcting spelling...',
        'Fixing small errors...',
        'Polishing the details...',
        'Catching those sneaky mistakes...',
      ],
      improvingReadability: [
        'Enhancing readability...',
        'Smoothing out sentences...',
        'Improving the flow...',
        'Making it easier to read...',
        'Refining the prose...',
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

  // Toolbar
  toolbar: {
    undo: 'Undo',
    redo: 'Redo',
    bold: 'Bold',
    italic: 'Italic',
    strikethrough: 'Strikethrough',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bulletList: 'Bullet List',
    numberedList: 'Numbered List',
    checklist: 'Checklist',
    link: 'Insert Link',
    image: 'Insert Image',
    inlineCode: 'Inline Code',
    codeBlock: 'Code Block',
    quote: 'Quote',
    horizontalRule: 'Horizontal Rule',
    table: 'Insert Table',
    urlLabel: 'URL',
    imageUrlLabel: 'Image URL',
    altTextLabel: 'Alt Text',
    imageUpload: 'Upload from computer',
    imageOr: 'or',
    imageInsert: 'Insert',
    imageCancel: 'Cancel',
    imageUploading: 'Uploading image…',
    imageUploadFailed: 'Upload failed: {reason}',
    imageTooLarge: 'Image is larger than {max}',
  },

  // Placeholders
  placeholders: {
    markdownEditor: 'Paste or type your markdown here...\n\nOr use Upload to load a .md or .docx file.',
    notionUrl: 'https://notion.so/...',
    documentTitle: 'Document title...',
    subtitle: 'Subtitle...',
    version: 'v1.0',
    date: 'Date...',
    globalContext: `Enter organization style preferences and general instructions for AI enhancement...

Examples:
- Use sentence case for headings
- Keep paragraphs concise
- Use bullet points for lists of 3+ items`,
  },
};
