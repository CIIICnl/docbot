// DreamDocs Type Definitions

// ============================================================================
// Conversion Types
// ============================================================================

export interface ConversionRequest {
  source: 'markdown' | 'notion' | 'docx';
  content: string;
  options: ConversionOptions;
}

export interface ConversionOptions {
  themeId: string;
  generateToc: boolean;
  pageNumbers: boolean;
  title?: string;
  coverPage?: boolean;
  coverPageOptions?: CoverPageOptions;
}

export interface CoverPageOptions {
  subtitle?: string;
  version?: string;
  date?: string;
  locale?: 'en' | 'nl';
}

export interface ConversionResult {
  pdf: string; // Base64 encoded
  html: string;
  metadata: ConversionMetadata;
}

export interface ConversionMetadata {
  title: string;
  pageCount: number;
  generatedAt: string;
  themeId: string;
  tocEntries: number;
  /** Accessibility warnings detected during conversion */
  accessibilityWarnings?: AccessibilityWarning[];
}

// ============================================================================
// Theme Types
// ============================================================================

export interface Theme {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  fonts?: ThemeFonts;
  colors?: Record<string, string>;
  pageSettings?: PageSettings;
}

/**
 * Theme font configuration
 * Structured for clear separation of heading, body, and caption fonts
 */
export interface ThemeFonts {
  /** Heading font - single variant only, no faux-bold/italic */
  heading: HeadingFont;
  /** Body font - supports multiple variants */
  body: BodyFont;
  /** Caption/code font - single variant */
  caption: CaptionFont;
}

/**
 * Heading font - one variant only
 * Same font used regardless of weight/style to prevent faux-bold/italic
 */
export interface HeadingFont {
  family: string;
  /** TTF file for PDF generation */
  ttf?: string;
  /** WOFF2 file for web preview */
  woff2?: string;
}

/**
 * Body font with multiple variants
 */
export interface BodyFont {
  family: string;
  regular?: FontVariant;
  bold?: FontVariant;
  italic?: FontVariant;
  boldItalic?: FontVariant;
}

/**
 * Caption/code font - single variant
 */
export interface CaptionFont {
  family: string;
  /** TTF file for PDF generation */
  ttf?: string;
  /** WOFF2 file for web preview */
  woff2?: string;
}

/**
 * Font variant with optional TTF and WOFF2 paths
 */
export interface FontVariant {
  /** TTF file for PDF generation */
  ttf?: string;
  /** WOFF2 file for web preview */
  woff2?: string;
}

export interface PageSettings {
  format?: 'A4' | 'Letter';
  margins?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
}

// ============================================================================
// Markdown Types
// ============================================================================

export interface MarkdownResult {
  html: string;
  toc: TocEntry[];
  title?: string;
  /** Accessibility warnings (e.g., images missing alt text) */
  accessibilityWarnings?: AccessibilityWarning[];
}

export interface AccessibilityWarning {
  type: 'missing-alt-text' | 'empty-alt-text';
  message: string;
  /** Source reference (e.g., image src) */
  source?: string;
}

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

// ============================================================================
// Notion Types
// ============================================================================

export interface NotionPageResult {
  title: string;
  markdown: string;
  icon?: string;
  cover?: string;
}

// ============================================================================
// PDF Types
// ============================================================================

export interface PdfOptions {
  html: string;
  pageNumbers?: boolean;
  format?: 'A4' | 'Letter';
  margins?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  /** PDF accessibility metadata */
  metadata?: PdfMetadata;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  language?: string;
  creator?: string;
}

// ============================================================================
// DOCX Types
// ============================================================================

export interface DocxImage {
  name: string;
  data: string; // base64
  mimeType: string;
}

export interface DocxParseResult {
  markdown: string;
  title: string;
  images: DocxImage[];
  warnings: string[];
}

export interface LlmChange {
  description: string;
  location?: string;
}

export interface LlmEnhanceResult {
  enhanced: string;
  changes: LlmChange[];
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiContext {
  req: import('http').IncomingMessage;
  res: import('http').ServerResponse;
  url: URL;
}
