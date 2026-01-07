# DreamDocs

Convert Notion pages and markdown to beautifully styled PDF documents with configurable themes.

## Features

- **Notion Integration** - Import directly from Notion pages
- **Markdown Support** - Paste or upload markdown files
- **Professional Themes** - Choose from multiple document styles
- **Table of Contents** - Auto-generated navigation
- **Code Highlighting** - Syntax highlighting for code blocks
- **Dual Export** - Download as PDF or HTML

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

Visit `http://localhost:3000` to use DreamDocs.

## Production

do ssh root@51...

cd /opt/docbot
git pull origin main
docker compose up -d --build

## Notion Integration

To enable Notion import:

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the API key to your `.env` file:
   ```
   NOTION_API_KEY=secret_xxx
   ```
4. Share pages with your integration (from the page menu, click "Add connections")

## Project Structure

```
dreamdocs/
├── client/                 # Browser code
│   ├── views/converter/   # Conversion UI
│   ├── lib/               # Utilities
│   └── styles/            # CSS
│
├── server/                # Node.js server
│   ├── services/          # Business logic
│   │   ├── pdf.ts        # PDF generation (Playwright)
│   │   ├── markdown.ts   # Markdown parsing
│   │   ├── notion.ts     # Notion API client
│   │   └── themes.ts     # Theme management
│   ├── routes/api/        # API endpoints
│   └── templates/         # Document templates
│
└── themes/                # Document themes
    └── default/          # Default theme
        ├── theme.json    # Theme config
        ├── styles.css    # Document styles
        └── fonts/        # Font files
```

## Themes

DreamDocs uses a powerful theme system for document styling. Themes control typography, colors, and page layout.

### Theme Directory Structure

```
themes/
└── my-theme/
    ├── theme.json       # Theme configuration (required)
    ├── styles.css       # Document styles (required)
    ├── README.md        # Theme documentation (optional)
    └── fonts/           # Font files
        ├── heading/     # Heading fonts (optional subfolder)
        ├── body/        # Body text fonts (optional subfolder)
        └── captions/    # Code/caption fonts (optional subfolder)
```

### Creating a Custom Theme

#### 1. Create the theme directory

```bash
mkdir -p themes/my-theme/fonts
```

#### 2. Add `theme.json` configuration

```json
{
  "name": "My Theme",
  "description": "A custom document theme",
  "version": "1.0.0",
  "author": "Your Name",
  "fonts": {
    "heading": {
      "family": "Inter",
      "woff2": "fonts/Inter-SemiBold.woff2",
      "ttf": "fonts/Inter-SemiBold.ttf"
    },
    "body": {
      "family": "Inter",
      "regular": {
        "woff2": "fonts/Inter-Regular.woff2"
      },
      "bold": {
        "woff2": "fonts/Inter-Bold.woff2"
      },
      "italic": {
        "woff2": "fonts/Inter-Italic.woff2"
      },
      "boldItalic": {
        "woff2": "fonts/Inter-BoldItalic.woff2"
      }
    },
    "caption": {
      "family": "JetBrains Mono",
      "woff2": "fonts/JetBrainsMono-Regular.woff2"
    }
  },
  "colors": {
    "text": "#1a1a1a",
    "heading": "#000000",
    "link": "#0066cc",
    "link-hover": "#0052a3",
    "code-bg": "#f5f5f5",
    "code-text": "#d6336c",
    "border": "#e0e0e0",
    "muted": "#666666",
    "toc-bg": "#fafafa"
  },
  "pageSettings": {
    "format": "A4",
    "margins": {
      "top": "2.5cm",
      "right": "2cm",
      "bottom": "2.5cm",
      "left": "2cm"
    }
  }
}
```

#### 3. Add `styles.css` with document styles

Use CSS custom properties (generated from your `colors` config) for styling:

| Variable | Purpose |
|----------|---------|
| `--doc-text` | Body text color |
| `--doc-heading` | Heading color |
| `--doc-link` | Link color |
| `--doc-link-hover` | Link hover color |
| `--doc-code-bg` | Code block background |
| `--doc-code-text` | Inline code text color |
| `--doc-border` | Border color |
| `--doc-muted` | Muted/secondary text |
| `--doc-toc-bg` | Table of contents background |

Example styles.css structure:

```css
.document {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: var(--doc-text, #1a1a1a);
}

.document h1 {
  font-size: 28pt;
  font-weight: 600;
  color: var(--doc-heading, #000000);
  border-bottom: 2px solid var(--doc-border, #e0e0e0);
}

/* ... additional styles */
```

### Font Configuration

Fonts are organized by role:

| Role | Purpose | Variants |
|------|---------|----------|
| `heading` | H1-H4 headings | Single file (used for all weights) |
| `body` | Paragraph text | `regular`, `bold`, `italic`, `boldItalic` |
| `caption` | Code blocks, page numbers | Single file |

**Supported formats:**
- `.woff2` - Recommended for web (smaller file size)
- `.ttf` - Better PDF rendering compatibility

If both formats are provided, TTF is used for PDF generation and WOFF2 for web preview.

### Default Theme

The default theme (`themes/default/`) provides a clean, minimal design using:
- **Inter** - Modern sans-serif for body and headings
- **JetBrains Mono** - Monospace font for code blocks

### Private Themes

Add `"private": true` to theme.json to exclude a theme from public distribution:

```json
{
  "name": "Corporate Theme",
  "private": true,
  ...
}
```

### Setting the Default Theme

Edit `server/services/themes.ts` to change the default theme:

```typescript
const DEFAULT_THEME_ID = 'my-theme';
```

## Tech Stack

| Layer          | Technology                                   |
| -------------- | -------------------------------------------- |
| Server         | Node.js with native HTTP (TypeScript)        |
| Client         | Vanilla JavaScript + Shoelace web components |
| PDF Generation | Playwright (headless Chrome)                 |
| Markdown       | markdown-it with plugins                     |
| Notion         | Official @notionhq/client SDK                |

## Scripts

```bash
npm run dev        # Start development server with hot reload
npm run start      # Start production server
npm run build      # Type check and build
npm run test       # Run unit tests
npm run test:e2e   # Run E2E tests
npm run lint       # Lint code
npm run format     # Format code
```

## API Endpoints

| Endpoint               | Method | Description                     |
| ---------------------- | ------ | ------------------------------- |
| `/api/convert`         | POST   | Convert markdown to PDF/HTML    |
| `/api/convert/preview` | POST   | Generate HTML preview only      |
| `/api/themes`          | GET    | List available themes           |
| `/api/themes/:id`      | GET    | Get theme details               |
| `/api/notion/fetch`    | POST   | Fetch Notion page as markdown   |
| `/api/notion/status`   | GET    | Check Notion integration status |

### Convert Request

```json
{
  "source": "markdown",
  "content": "# Hello World\n\nThis is markdown.",
  "options": {
    "themeId": "default",
    "generateToc": true,
    "pageNumbers": true,
    "title": "My Document"
  }
}
```

### Convert Response

```json
{
  "pdf": "<base64 encoded PDF>",
  "html": "<complete HTML document>",
  "metadata": {
    "title": "My Document",
    "pageCount": 3,
    "generatedAt": "2024-01-15T10:30:00Z",
    "themeId": "default",
    "tocEntries": 5
  }
}
```

## License

MIT
