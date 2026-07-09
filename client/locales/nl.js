/**
 * Dutch Translations (Nederlands)
 */
export default {
  // Common UI elements
  common: {
    appName: 'DreamDocs',
    confirm: 'Bevestigen',
    cancel: 'Annuleren',
    close: 'Sluiten',
    delete: 'Verwijderen',
    save: 'Opslaan',
    ok: 'OK',
    loading: 'Laden...',
    actions: 'Acties',
    fileTooLarge: 'Bestand is {size}, het maximum is {max}. Tip: comprimeer de afbeeldingen in het document.',
    unsupportedFormat: 'Niet-ondersteund bestandsformaat: {name}',
    uploadTimeout: 'Het uploaden duurde te lang en is afgebroken. Probeer het opnieuw; blijft het hangen, dan is het document mogelijk te zwaar.',
  },

  // Navigation
  nav: {
    documents: 'Documenten',
    settings: 'Instellingen',
    signOut: 'Uitloggen',
  },

  // Login page
  login: {
    title: 'Inloggen bij DreamDocs',
    emailLabel: 'E-mail',
    emailPlaceholder: 'jouw@email.nl',
    passwordLabel: 'Wachtwoord',
    passwordPlaceholder: 'Wachtwoord',
    submit: 'Inloggen',
    devBypass: 'Doorgaan zonder inloggen (dev)',
    signingIn: 'Bezig met inloggen...',
    devLogin: 'Dev login...',
    errorRequired: 'Vul e-mail en wachtwoord in',
    errorFailed: 'Inloggen mislukt',
    devLoginFailed: 'Dev login mislukt',
    forgotPassword: 'Wachtwoord vergeten?',
    orMagicLink: 'Of log in met een magic link',
    sendMagicLink: 'Stuur magic link',
    sendingMagicLink: 'Verzenden...',
    magicLinkSent: 'Check je inbox voor de magic link!',
    magicLinkError: 'Magic link verzenden mislukt',
    errorInvalidEmail: 'Voer een geldig e-mailadres in',
  },

  // Forgot password page
  forgotPassword: {
    title: 'Wachtwoord resetten',
    help: 'Voer je e-mail in en we sturen je een reset link.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'jouw@email.nl',
    submit: 'Stuur reset link',
    sending: 'Verzenden...',
    success: 'Als er een account bestaat met dit e-mailadres, is er een reset link verzonden.',
    error: 'Er ging iets mis. Probeer het opnieuw.',
    errorInvalidEmail: 'Voer een geldig e-mailadres in',
    backToLogin: 'Terug naar inloggen',
  },

  // Reset password page
  resetPassword: {
    title: 'Wachtwoord resetten',
    validating: 'Reset link valideren...',
    invalidToken: 'Deze reset link is ongeldig.',
    expiredToken: 'Deze reset link is verlopen.',
    resetFor: 'Stel een nieuw wachtwoord in voor {email}',
    passwordLabel: 'Nieuw wachtwoord',
    passwordPlaceholder: 'Voer nieuw wachtwoord in',
    confirmLabel: 'Bevestig wachtwoord',
    confirmPlaceholder: 'Bevestig nieuw wachtwoord',
    submit: 'Wachtwoord resetten',
    resetting: 'Wachtwoord resetten...',
    success: 'Je wachtwoord is succesvol gereset!',
    error: 'Er ging iets mis. Probeer het opnieuw.',
    passwordTooShort: 'Wachtwoord moet minimaal 8 tekens zijn',
    passwordMismatch: 'Wachtwoorden komen niet overeen',
    goToLogin: 'Naar inloggen',
    requestNew: 'Nieuwe reset link aanvragen',
  },

  // Magic login page
  magicLogin: {
    title: 'Magic Link Login',
    verifying: 'Je magic link wordt geverifieerd...',
    success: 'Inloggen gelukt! Je wordt doorgestuurd...',
    invalidLink: 'Deze magic link is ongeldig.',
    expiredLink: 'Deze magic link is verlopen.',
    error: 'Er ging iets mis. Probeer het opnieuw.',
    goToLogin: 'Naar inloggen',
  },

  // Settings page
  settings: {
    title: 'Instellingen',
    subtitle: 'Beheer je voorkeuren',

    appearance: {
      title: 'Weergave',
      description: 'Pas het uiterlijk van de applicatie aan.',
      themeLabel: 'Thema',
      themeDescription: 'Kies tussen lichte en donkere modus.',
      themeLight: 'Licht',
      themeDark: 'Donker',
      languageLabel: 'Taal',
      languageDescription: 'Kies je voorkeurstaal.',
    },

    ai: {
      title: 'AI-verbetering',
      descriptionAvailable: 'Configureer AI-gestuurde documentverbetering voor Word-imports.',
      descriptionUnavailable:
        'AI-verbetering vereist API-sleutels. Voeg OPENAI_API_KEY, ANTHROPIC_API_KEY of MISTRAL_API_KEY toe aan je .env bestand.',
      providerLabel: 'Standaard provider',
      providerDescription: 'Kies welke AI-provider standaard wordt gebruikt.',
      providerNone: 'Geen (Geen AI)',
      providerOpenAI: 'OpenAI (Aanbevolen)',
      providerClaude: 'Claude',
      providerMistral: 'Mistral (EU)',
      contextLabel: 'Globale context',
      contextDescription: 'Instructies die van toepassing zijn op alle documentconversies.',
    },

    danger: {
      title: 'Gevarenzone',
      description: 'Onomkeerbare acties die je account beïnvloeden.',
      deleteAllTitle: 'Alles verwijderen',
      deleteAllDescription: 'Verwijder permanent alle items. Dit kan niet ongedaan worden gemaakt.',
      deleteAllButton: 'Alles verwijderen',
    },
  },

  // List view
  list: {
    title: 'Je Documenten',
    empty: 'Nog geen documenten',
    emptyHint: 'Maak je eerste document om te beginnen.',
    emptyDraft: 'Leeg document',
    newDocument: 'Nieuw Document',
    localStorageNotice: 'Concepten worden opgeslagen in je account en zijn beschikbaar op elk apparaat.',
    delete: 'Verwijderen',
    deleteTitle: 'Document Verwijderen',
    deleteConfirm: '"{title}" verwijderen? Dit kan niet ongedaan worden gemaakt.',
    openDraft: '{title} openen',
    timeJustNow: 'Zojuist',
    timeMinutes: '{count}m geleden',
    timeHours: '{count}u geleden',
    timeYesterday: 'Gisteren',
    timeDays: '{count}d geleden',
  },

  // New document modal
  newDocument: {
    title: 'Nieuw Document',
    untitled: 'Naamloos',
    mode: {
      empty: 'Leeg',
      paste: 'Plakken',
      upload: 'Uploaden',
      notion: 'Notion',
    },
    titleLabel: 'Titel',
    titlePlaceholder: 'Documenttitel...',
    titleHintNotion: 'Laat leeg om de Notion-paginatitel te gebruiken',
    contentLabel: 'Inhoud',
    contentPlaceholder: 'Plak hier je content...',
    notionUrlLabel: 'Notion Pagina URL',
    notionUrlPlaceholder: 'https://notion.so/...',
    selectFile: 'Bestand Kiezen',
    noFileSelected: 'Geen bestand geselecteerd',
    options: {
      theme: 'Thema',
      aiEnhance: 'Verbeteren met AI',
      aiEnhanceHint: 'Verbeter automatisch de structuur, corrigeer typfouten en verbeter de leesbaarheid',
      coverPage: 'Voorblad',
      pageNumbers: 'Paginanummers',
      toc: 'Inhoudsopgave',
    },
    create: 'Aanmaken',
    import: 'Importeren',
    importing: 'Importeren...',
    fetchingNotion: 'Notion-pagina ophalen...',
    enhancing: 'Document Verbeteren',
    enhancingStructure: 'Documentstructuur optimaliseren...',
    enhancingTypos: 'Typfouten en spelling corrigeren...',
    enhancingReadability: 'Leesbaarheid verbeteren...',
    enhancingSuggestions: 'Analyseren voor suggesties...',
    enhancingMultiple: 'Je document verbeteren...',
    enhanceDone: 'Verbetering voltooid',
    errorNoFile: 'Selecteer een bestand',
    errorNoUrl: 'Voer een Notion-pagina URL in',
    errorReadFile: 'Bestand lezen mislukt: {error}',
    errorNotion: 'Importeren van Notion mislukt: {error}',
    errorEnhance: 'Verbetering mislukt: {error}',
  },

  // Editor
  editor: {
    backToList: 'Documenten',
    saved: 'Opgeslagen',
    saving: 'Opslaan...',
    unsavedChanges: 'Je hebt niet-opgeslagen wijzigingen. Toch verlaten?',
    draftNotFound: 'Document niet gevonden',
  },

  // Converter input bar
  input: {
    upload: 'Uploaden',
    notion: 'Notion',
    saveDraft: 'Concept opslaan',
    loadDraft: 'Concept laden',
    toc: 'Inhoudsopgave',
    pageNumbers: 'Pagina #',
    coverPage: 'Voorblad',
    pageBreakBeforeH1: 'H1 nieuwe pagina',
    pageBreakBeforeH2: 'H2 nieuwe pagina',
    deleteLabel: 'Verwijderen',
  },

  // Notion dialog
  notion: {
    dialogTitle: 'Importeren van Notion',
    dialogDescription: 'Voer de URL in van de Notion-pagina die je wilt importeren.',
    import: 'Importeren',
    errorUrl: 'Voer een Notion-pagina URL in',
  },

  // Converter actions
  actions: {
    enhance: 'Verbeteren met AI',
    translate: 'Vertalen',
    exportPdf: 'Exporteer PDF',
    exportHtml: 'Exporteer HTML',
    translateNlEn: 'NL \u2192 EN',
    translateEnNl: 'EN \u2192 NL',
  },

  // Enhance dialog
  enhance: {
    dialogTitle: 'Verbeteren met AI',
    structureTitle: 'Documentstructuur',
    structureDesc: 'Herstel koppen, lijsten, tabellen en witruimte-opmaak',
    typosTitle: 'Typfouten corrigeren',
    typosDesc: 'Corrigeer spelfouten, dubbele spaties en interpunctie',
    readabilityTitle: 'Leesbaarheid verbeteren',
    readabilityDesc:
      'Herorden woorden en zinnen voor meer duidelijkheid zonder de betekenis te veranderen',
    suggestionsTitle: 'Suggesties krijgen',
    suggestionsDesc: 'Ontvang feedback en vragen zonder het document te wijzigen',
    cancel: 'Annuleren',
    enhance: 'Verbeteren',
  },

  // Changes sidebar
  changes: {
    title: 'AI-wijzigingen',
    undoAll: 'Ongedaan',
    exportJson: 'JSON',
    exportReport: 'Rapport',
    exported: 'Wijzigingen geexporteerd als JSON',
    reportExported: 'Bewerkingsinstructies geexporteerd',
    reverted: 'Wijzigingen ongedaan gemaakt',
    noChanges: 'Geen wijzigingen of suggesties',
    changesMade: 'Aangebrachte wijzigingen',
    suggestions: 'Suggesties en vragen',
    overallImpression: 'Algemene indruk',
    improvementsApplied: 'Toegepaste verbeteringen',
    categoryStructure: 'Structuur',
    categoryTypos: 'Typfouten',
    categoryReadability: 'Leesbaarheid',
    categoryOther: 'Overig',
    // Report generation
    reportTitle: 'Bewerkingsinstructies voor Document',
    reportDocument: 'Document',
    reportDate: 'Datum',
    reportIntro: 'Dit document bevat voorgestelde bewerkingen en verbeteringen. Bekijk elk item en pas de wijzigingen toe waar van toepassing.',
    reportSuggestionsTitle: 'Inhoudelijke Suggesties',
    reportSuggestionsIntro: 'De volgende suggesties kunnen het document verbeteren. Overweeg of deze wijzigingen aansluiten bij je doelen:',
    reportEditsTitle: 'Aanbevolen Bewerkingen',
    reportEditsIntro: 'De volgende specifieke bewerkingen worden aanbevolen. Elk item geeft aan wat er moet worden gewijzigd en waar je het kunt vinden:',
    reportLocation: 'Locatie:',
    reportCategoryStructure: 'Structuur & Opmaak',
    reportCategoryTypos: 'Spelling & Interpunctie',
    reportCategoryReadability: 'Duidelijkheid & Leesbaarheid',
    reportCategoryOther: 'Overige Verbeteringen',
    reportGenerated: 'Deze instructies zijn gegenereerd door AI-documentanalyse.',
    untitledDocument: 'Naamloos document',
    fetchingDetails: 'Gedetailleerde wijzigingen ophalen...',
  },

  // Markdown panel
  markdown: {
    title: 'Markdown',
    subtitle: 'Bewerkbaar',
  },

  // Preview panel
  preview: {
    panelTitle: 'Voorbeeld',
    title: 'Documentvoorbeeld',
    empty: 'Voorbeeld verschijnt hier',
    refresh: 'Voorbeeld vernieuwen',
  },

  // Images panel
  images: {
    title: 'Afbeeldingen',
    empty: 'Nog geen afbeeldingen in dit document. Gebruik Toevoegen om er een te uploaden.',
    countOne: '1 afbeelding',
    countMany: '{count} afbeeldingen',
    addBtn: 'Toevoegen',
    replaceBtn: 'Vervangen',
    copyMarkdown: 'Markdown-verwijzing kopiëren',
    copied: 'Markdown-verwijzing gekopieerd',
    copyFailed: 'Kopiëren naar klembord mislukt',
    replaced: 'Afbeelding vervangen',
    refMissing: 'Afbeeldingsverwijzing niet meer in document',
    externalImage: 'Externe afbeelding — niet vervangbaar',
    usedTimes: '{count}× gebruikt',
    addCopied: 'Geüpload — markdown-verwijzing op klembord',
    addAppended: 'Geüpload — onderaan document toegevoegd',
    tooLarge: 'Afbeelding is groter dan {max}',
    uploadFailed: 'Uploaden mislukt: {reason}',
    altLabel: 'Alt-tekst',
    altPlaceholder: 'Beschrijving voor schermlezers (toegankelijkheid)',
    captionLabel: 'Bijschrift',
    captionPlaceholder: 'Zichtbaar onder de afbeelding (optioneel)',
    fieldsDisabled: 'Alt en bijschrift instelbaar bij markdown-afbeeldingen',
    metaUpdated: 'Alt-tekst en bijschrift bijgewerkt',
    beeldbankBtn: 'Beeldbank',
    beeldbankTitle: 'Kies uit Beeldbank',
    beeldbankInserted: 'Afbeelding uit Beeldbank toegevoegd',
    beeldbankUnavailable: 'Beeldbank-picker niet beschikbaar',
  },

  // 404 page
  notFound: {
    title: 'Pagina niet gevonden',
    message: 'De pagina die je zoekt bestaat niet.',
    goHome: 'Naar Home',
  },

  // Toast messages
  toast: {
    themeChanged: 'Thema gewijzigd naar {theme}',
    languageChanged: 'Taal gewijzigd',
    providerChanged: 'Standaard provider ingesteld op {provider}',
    contextSaved: 'AI-context opgeslagen',
    loadedFile: '{filename} geladen',
    parsedWarnings: 'Geparsed met {count} waarschuwing(en)',
    draftSaved: 'Concept opgeslagen: {title}',
    draftLoaded: 'Geladen: {title}',
    draftDeleted: 'Concept verwijderd',
    fetchedNotion: 'Notion-pagina opgehaald',
    enhanced: 'Verbeterd met AI',
    suggestionsReady: 'Suggesties klaar',
    translated: 'Vertaald ({count} deel{plural})',
    pdfExported: 'PDF geexporteerd',
    htmlExported: 'HTML geexporteerd',
    noContent: 'Geen inhoud om te {action}',
    noContentEnhance: 'Geen inhoud om te verbeteren',
    noContentTranslate: 'Geen inhoud om te vertalen',
    aiDisabled: 'AI is uitgeschakeld. Schakel een AI-provider in via Instellingen om deze functie te gebruiken.',
    noContentExport: 'Geen inhoud om te exporteren',
    noContentSave: 'Geen inhoud om op te slaan',
    selectOption: 'Selecteer minimaal een verbeteroptie',
    enhancementFailed: 'Verbetering mislukt: {error}',
    translationFailed: 'Vertaling mislukt: {error}',
    exportFailed: 'Export mislukt: {error}',
    fetchFailed: 'Ophalen mislukt: {error}',
    parseFailed: 'Document parseren mislukt: {error}',
    readFailed: 'Bestand lezen mislukt: {error}',
  },

  // Loading messages
  loading: {
    parsingWord: 'Word-document wordt geparsed...',
    fetchingNotion: 'Notion-pagina wordt opgehaald...',
    generatingPdf: 'PDF wordt gegenereerd...',
    generatingHtml: 'HTML wordt gegenereerd...',
    translatingNlEn: 'Vertalen (Nederlands \u2192 Engels)...',
    translatingEnNl: 'Vertalen (Engels \u2192 Nederlands)...',
  },

  // AI enhancement loading messages (arrays for random selection)
  aiLoading: {
    enhance: {
      analyzing: [
        'Je document wordt geanalyseerd...',
        'Je document wordt onder de loep genomen...',
        'Tussen de regels door aan het lezen...',
      ],
      improving: [
        'Verbeteringen worden aangebracht...',
        'Je tekst wordt opgepoetst...',
        'Er wordt wat magie toegepast...',
        'Details worden verfijnd...',
        'Ruwe kantjes worden gladgestreken...',
        'Je content wordt afgesteld...',
        'Alles wordt opgefrist...',
        'Een nieuw laagje verf wordt aangebracht...',
        'Het taalgebruik wordt aangescherpt...',
        'Er wordt wat glans toegevoegd...',
        'De structuur wordt geperfectioneerd...',
        'De opmaak wordt opgeschoond...',
        'Het gaat glanzen...',
      ],
      // Option-specific messages
      improvingStructure: [
        'Documentstructuur optimaliseren...',
        'Koppen perfectioneren...',
        'De indeling verfijnen...',
        'Herstructureren voor duidelijkheid...',
        'Je content organiseren...',
      ],
      improvingTypos: [
        'Op jacht naar typfouten...',
        'Spelling corrigeren...',
        'Kleine foutjes oplossen...',
        'Details oppoetsen...',
        'Die stiekeme foutjes opsporen...',
      ],
      improvingReadability: [
        'Leesbaarheid verbeteren...',
        'Zinnen vloeiender maken...',
        'De flow verbeteren...',
        'Makkelijker leesbaar maken...',
        'De tekst verfijnen...',
      ],
      wrapping: ['Wijzigingen worden afgerond...', 'Bijna klaar...', 'De puntjes op de i...'],
    },
    suggestions: {
      analyzing: [
        'Je document wordt doorgelezen...',
        'De inhoud wordt bekeken...',
        'Er wordt goed gekeken...',
      ],
      thinking: [
        'Nadenken over verbeteringen...',
        'Je tekst wordt overwogen...',
        'Feedback wordt geformuleerd...',
        'Je content wordt bekeken...',
        'De opties worden afgewogen...',
        'De details worden overwogen...',
        'Suggesties worden opgesteld...',
        'De structuur wordt bekeken...',
        'De flow wordt geanalyseerd...',
        'Naar mogelijkheden wordt gezocht...',
        'Inzichten worden verzameld...',
        'Het taalgebruik wordt beoordeeld...',
        'Verbetermogelijkheden worden gespot...',
      ],
      wrapping: [
        'Suggesties worden voorbereid...',
        'Bijna klaar...',
        'Gedachten worden verzameld...',
      ],
    },
  },

  // Export
  export: {
    pdf: 'PDF',
    html: 'HTML',
    generatingPdf: 'PDF wordt gegenereerd...',
    generatingHtml: 'HTML wordt gegenereerd...',
    pdfExported: 'PDF geexporteerd',
    htmlExported: 'HTML geexporteerd',
    noContent: 'Geen inhoud om te exporteren',
    failed: 'Export mislukt',
  },

  // Search
  search: {
    placeholder: 'Zoeken...',
    previous: 'Vorige',
    next: 'Volgende',
    toggle: 'Zoeken',
    noMatches: 'Geen resultaten',
    count: '{current} van {total}',
  },

  // Toolbar
  toolbar: {
    undo: 'Ongedaan maken',
    redo: 'Opnieuw',
    bold: 'Vet',
    italic: 'Cursief',
    strikethrough: 'Doorhalen',
    heading1: 'Kop 1',
    heading2: 'Kop 2',
    heading3: 'Kop 3',
    bulletList: 'Opsomming',
    numberedList: 'Genummerde lijst',
    checklist: 'Checklist',
    link: 'Link invoegen',
    image: 'Afbeelding invoegen',
    inlineCode: 'Code',
    codeBlock: 'Codeblok',
    quote: 'Citaat',
    horizontalRule: 'Horizontale lijn',
    table: 'Tabel invoegen',
    urlLabel: 'URL',
    imageUrlLabel: 'Afbeelding URL',
    altTextLabel: 'Alt tekst',
  },

  // Placeholders
  placeholders: {
    markdownEditor:
      'Plak of typ hier je markdown...\n\nOf gebruik Uploaden om een .md of .docx bestand te laden.',
    notionUrl: 'https://notion.so/...',
    documentTitle: 'Documenttitel...',
    subtitle: 'Ondertitel...',
    version: 'v1.0',
    date: 'Datum...',
    globalContext: `Voer organisatie stijlvoorkeuren en algemene instructies voor AI-verbetering in...

Voorbeelden:
- Gebruik zinslettergebruik voor koppen
- Houd alinea's beknopt
- Gebruik opsommingstekens voor lijsten van 3+ items`,
  },
};
