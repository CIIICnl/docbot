/**
 * Paste Tab
 * Textarea for pasting markdown content.
 */

import { h } from '../../lib/dom.js';
import { slInput, slTextarea, slButton } from '../../lib/shoelace.js';

// Sample markdown for demo
const SAMPLE_MARKDOWN = `# Welcome to DreamDocs

DreamDocs converts your markdown and Notion pages into beautifully styled PDF documents.

## Features

- **Markdown Support**: Full markdown with tables, code blocks, and more
- **Notion Integration**: Import directly from Notion pages
- **Themes**: Choose from multiple professional themes
- **Table of Contents**: Auto-generated navigation

## Getting Started

1. Paste your markdown content here
2. Or upload a \`.md\` file
3. Select your preferred theme
4. Click "Convert" to generate your PDF

## Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
\`\`\`

## Table Example

| Feature | Status |
|---------|--------|
| Markdown | Ready |
| Notion | Ready |
| Themes | Ready |

---

*Created with DreamDocs*
`;

/**
 * Create the paste tab content
 * @param {Function} onContentChange - Callback when content changes
 */
export function createPasteTab(onContentChange) {
  // Title input
  const titleInput = slInput({
    label: 'Document Title (optional)',
    placeholder: 'My Document',
    size: 'medium',
    className: 'paste-title-input',
  });

  // Character count display
  const charCount = h('span', { class: 'paste-char-count text-muted' }, ['0 characters']);

  // Textarea
  const textarea = slTextarea({
    label: 'Markdown Content',
    placeholder: 'Type or paste your markdown here...',
    rows: 16,
    resize: 'vertical',
    className: 'paste-textarea',
  });

  textarea.addEventListener('sl-input', (e) => {
    const value = e.target.value;
    charCount.textContent = `${value.length} characters`;
    onContentChange(value, titleInput.value, 'markdown');
  });

  // Sample button
  const sampleButton = slButton({
    size: 'small',
    variant: 'text',
    icon: 'file-text',
    text: 'Load Sample',
    onClick: () => {
      textarea.value = SAMPLE_MARKDOWN;
      titleInput.value = 'Sample Document';
      charCount.textContent = `${SAMPLE_MARKDOWN.length} characters`;
      onContentChange(SAMPLE_MARKDOWN, 'Sample Document', 'markdown');
    },
  });

  // Clear button
  const clearButton = slButton({
    size: 'small',
    variant: 'text',
    icon: 'x-circle',
    text: 'Clear',
    onClick: () => {
      textarea.value = '';
      titleInput.value = '';
      charCount.textContent = '0 characters';
      onContentChange('', '', 'markdown');
    },
  });

  // Title input change handler
  titleInput.addEventListener('sl-input', () => {
    onContentChange(textarea.value, titleInput.value, 'markdown');
  });

  return h('div', { class: 'paste-tab' }, [
    titleInput,
    h('div', { class: 'paste-toolbar' }, [
      h('div', { class: 'paste-toolbar-left' }, [sampleButton, clearButton]),
      charCount,
    ]),
    textarea,
  ]);
}
