/**
 * Dutch Translations (Nederlands)
 */
export default {
  // Common UI elements
  common: {
    appName: 'DreamDocs',
    confirm: 'Bevestigen',
    cancel: 'Annuleren',
    delete: 'Verwijderen',
    save: 'Opslaan',
    ok: 'OK',
    loading: 'Laden...',
    actions: 'Acties',
  },

  // Navigation
  nav: {
    convert: 'Converteren',
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
        'AI-verbetering vereist API-sleutels. Voeg ANTHROPIC_API_KEY of MISTRAL_API_KEY toe aan je .env bestand.',
      providerLabel: 'Standaard provider',
      providerDescription: 'Kies welke AI-provider standaard wordt gebruikt.',
      providerClaude: 'Claude (Aanbevolen)',
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

  // Converter input bar
  input: {
    upload: 'Uploaden',
    notion: 'Notion',
    saveDraft: 'Concept opslaan',
    loadDraft: 'Concept laden',
    toc: 'Inhoud',
    pageNumbers: 'Pagina #',
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
    undoAll: 'Alle wijzigingen ongedaan maken',
    reverted: 'Wijzigingen ongedaan gemaakt',
    noChanges: 'Geen wijzigingen of suggesties',
    changesMade: 'Aangebrachte wijzigingen',
    suggestions: 'Suggesties en vragen',
    categoryStructure: 'Structuur',
    categoryTypos: 'Typfouten',
    categoryReadability: 'Leesbaarheid',
    categoryOther: 'Overig',
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

  // Placeholders
  placeholders: {
    markdownEditor:
      'Plak of typ hier je markdown...\n\nOf gebruik Uploaden om een .md of .docx bestand te laden.',
    notionUrl: 'https://notion.so/...',
    documentTitle: 'Documenttitel...',
    globalContext: `Voer organisatie stijlvoorkeuren en algemene instructies voor AI-verbetering in...

Voorbeelden:
- Gebruik zinslettergebruik voor koppen
- Houd alinea's beknopt
- Gebruik opsommingstekens voor lijsten van 3+ items`,
  },
};
