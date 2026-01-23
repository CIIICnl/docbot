/**
 * Markdown Toolbar Component
 * Provides formatting buttons and keyboard shortcuts for markdown editing.
 */

import { h } from './dom.js';
import { prompt } from './dialogs.js';
import { t } from './i18n.js';

/**
 * @typedef {Object} MarkdownToolbarOptions
 * @property {Function} onChange - Called when content changes
 */

/**
 * Create a markdown toolbar for a textarea
 */
export class MarkdownToolbar {
  /**
   * @param {HTMLElement} textarea - The sl-textarea element
   * @param {MarkdownToolbarOptions} options
   */
  constructor(textarea, options = {}) {
    this.textarea = textarea;
    this.onChange = options.onChange || (() => {});
    this.element = this.createToolbar();
    this.setupKeyboardShortcuts();
  }

  /**
   * Get the inner textarea element from sl-textarea shadow DOM
   * @returns {HTMLTextAreaElement|null}
   */
  getInnerTextarea() {
    // Wait for custom element to be defined
    if (!this.textarea.shadowRoot) {
      return null;
    }
    return this.textarea.shadowRoot.querySelector('textarea');
  }

  /**
   * Create a toolbar button
   * @param {string} icon
   * @param {string} labelKey
   * @param {Function} action
   * @param {string} [shortcut]
   * @returns {HTMLElement}
   */
  createButton(icon, labelKey, action, shortcut) {
    const tooltip = t(`toolbar.${labelKey}`) + (shortcut ? ` (${shortcut})` : '');
    const btn = h('button', {
      type: 'button',
      class: 'markdown-toolbar-btn',
      title: tooltip,
      'aria-label': tooltip,
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        action();
      },
    }, [
      h('sl-icon', { name: icon }),
    ]);
    return btn;
  }

  /**
   * Create the toolbar DOM element
   * @returns {HTMLElement}
   */
  createToolbar() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? '\u2318' : 'Ctrl';

    const groups = [
      // History group
      [
        { icon: 'arrow-counterclockwise', label: 'undo', action: () => this.undo(), shortcut: `${mod}+Z` },
        { icon: 'arrow-clockwise', label: 'redo', action: () => this.redo(), shortcut: `${mod}+Shift+Z` },
      ],
      // Formatting group
      [
        { icon: 'type-bold', label: 'bold', action: () => this.wrapSelection('**', '**'), shortcut: `${mod}+B` },
        { icon: 'type-italic', label: 'italic', action: () => this.wrapSelection('_', '_'), shortcut: `${mod}+I` },
        { icon: 'type-strikethrough', label: 'strikethrough', action: () => this.wrapSelection('~~', '~~'), shortcut: `${mod}+Shift+S` },
      ],
      // Headings group
      [
        { icon: 'type-h1', label: 'heading1', action: () => this.applyLinePrefix('# ') },
        { icon: 'type-h2', label: 'heading2', action: () => this.applyLinePrefix('## ') },
        { icon: 'type-h3', label: 'heading3', action: () => this.applyLinePrefix('### ') },
      ],
      // Lists group
      [
        { icon: 'list-ul', label: 'bulletList', action: () => this.applyLinePrefix('- ') },
        { icon: 'list-ol', label: 'numberedList', action: () => this.applyNumberedList() },
        { icon: 'list-check', label: 'checklist', action: () => this.applyLinePrefix('- [ ] ') },
      ],
      // Media group
      [
        { icon: 'link-45deg', label: 'link', action: () => this.insertLink(), shortcut: `${mod}+K` },
        { icon: 'image', label: 'image', action: () => this.insertImage() },
      ],
      // Code group
      [
        { icon: 'code', label: 'inlineCode', action: () => this.wrapSelection('`', '`'), shortcut: `${mod}+\`` },
        { icon: 'code-square', label: 'codeBlock', action: () => this.insertCodeBlock() },
      ],
      // Misc group
      [
        { icon: 'quote', label: 'quote', action: () => this.applyLinePrefix('> ') },
        { icon: 'dash-lg', label: 'horizontalRule', action: () => this.insertAtCursor('\n---\n') },
        { icon: 'table', label: 'table', action: () => this.insertTable() },
      ],
    ];

    const toolbar = h('div', { class: 'markdown-toolbar' },
      groups.map((group) =>
        h('div', { class: 'markdown-toolbar-group' },
          group.map((btn) => this.createButton(btn.icon, btn.label, btn.action, btn.shortcut))
        )
      )
    );

    return toolbar;
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    this.textarea.addEventListener('keydown', (e) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (!isMod) return;

      let handled = false;

      if (e.key === 'b' && !e.shiftKey) {
        this.wrapSelection('**', '**');
        handled = true;
      } else if (e.key === 'i' && !e.shiftKey) {
        this.wrapSelection('_', '_');
        handled = true;
      } else if (e.key === 'k' && !e.shiftKey) {
        this.insertLink();
        handled = true;
      } else if (e.key === '`' && !e.shiftKey) {
        this.wrapSelection('`', '`');
        handled = true;
      } else if (e.key === 's' && e.shiftKey) {
        this.wrapSelection('~~', '~~');
        handled = true;
      }

      if (handled) {
        e.preventDefault();
      }
    });
  }

  /**
   * Sync inner textarea value back to sl-textarea and notify
   */
  syncAndNotify() {
    const inner = this.getInnerTextarea();
    if (inner) {
      // Sync the value back to the sl-textarea element
      this.textarea.value = inner.value;
    }
    // Call the onChange callback
    this.onChange(this.textarea.value);
  }

  /**
   * Trigger native undo
   */
  undo() {
    const inner = this.getInnerTextarea();
    if (inner) {
      inner.focus();
      document.execCommand('undo', false, null);
      this.syncAndNotify();
    }
  }

  /**
   * Trigger native redo
   */
  redo() {
    const inner = this.getInnerTextarea();
    if (inner) {
      inner.focus();
      document.execCommand('redo', false, null);
      this.syncAndNotify();
    }
  }

  /**
   * Wrap selected text with before/after strings
   * @param {string} before
   * @param {string} after
   */
  wrapSelection(before, after) {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    const start = inner.selectionStart;
    const end = inner.selectionEnd;
    const selected = inner.value.substring(start, end);
    const replacement = before + selected + after;

    inner.focus();
    inner.setRangeText(replacement, start, end, 'select');

    // Adjust selection to be inside the markers
    if (selected.length === 0) {
      const newPos = start + before.length;
      inner.setSelectionRange(newPos, newPos);
    } else {
      inner.setSelectionRange(start + before.length, start + before.length + selected.length);
    }

    this.syncAndNotify();
  }

  /**
   * Add/toggle prefix on current line(s)
   * @param {string} prefix
   */
  applyLinePrefix(prefix) {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    const value = inner.value;
    const start = inner.selectionStart;
    const end = inner.selectionEnd;

    // Find line boundaries
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

    // Get selected lines
    const selectedText = value.substring(lineStart, actualLineEnd);
    const lines = selectedText.split('\n');

    // Check if all lines already have the prefix (for toggle)
    const headingPrefixMatch = prefix.match(/^(#{1,6})\s$/);
    const allHavePrefix = lines.every((line) => {
      if (headingPrefixMatch) {
        // For headings, check if line starts with any heading
        return /^#{1,6}\s/.test(line);
      }
      return line.startsWith(prefix) || line.trim() === '';
    });

    // Transform lines
    const transformed = lines
      .map((line) => {
        if (line.trim() === '') return line;

        if (allHavePrefix) {
          // Remove prefix (toggle off)
          if (headingPrefixMatch) {
            return line.replace(/^#{1,6}\s/, '');
          }
          return line.startsWith(prefix) ? line.substring(prefix.length) : line;
        } else {
          // Add prefix
          if (headingPrefixMatch) {
            // Remove existing heading prefix first
            const cleanLine = line.replace(/^#{1,6}\s/, '');
            return prefix + cleanLine;
          }
          // For lists, don't add if already has a list prefix
          if ((prefix === '- ' || prefix === '- [ ] ') && /^[-*+]\s/.test(line)) {
            return line;
          }
          if (/^\d+\.\s/.test(line)) {
            return line;
          }
          return prefix + line;
        }
      })
      .join('\n');

    inner.focus();
    inner.setRangeText(transformed, lineStart, actualLineEnd, 'end');

    this.syncAndNotify();
  }

  /**
   * Apply numbered list to selected lines
   */
  applyNumberedList() {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    const value = inner.value;
    const start = inner.selectionStart;
    const end = inner.selectionEnd;

    // Find line boundaries
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

    // Get selected lines
    const selectedText = value.substring(lineStart, actualLineEnd);
    const lines = selectedText.split('\n');

    // Check if all lines already numbered
    const allNumbered = lines.every((line) => /^\d+\.\s/.test(line) || line.trim() === '');

    // Transform lines
    let num = 1;
    const transformed = lines
      .map((line) => {
        if (line.trim() === '') return line;

        if (allNumbered) {
          // Remove numbering
          return line.replace(/^\d+\.\s/, '');
        } else {
          // Add numbering, remove existing list markers
          const cleanLine = line.replace(/^[-*+]\s|^\d+\.\s/, '');
          return `${num++}. ${cleanLine}`;
        }
      })
      .join('\n');

    inner.focus();
    inner.setRangeText(transformed, lineStart, actualLineEnd, 'end');

    this.syncAndNotify();
  }

  /**
   * Insert text at cursor position
   * @param {string} text
   */
  insertAtCursor(text) {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    const start = inner.selectionStart;
    const end = inner.selectionEnd;

    inner.focus();
    inner.setRangeText(text, start, end, 'end');

    this.syncAndNotify();
  }

  /**
   * Insert a link with dialog
   */
  async insertLink() {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    // Store selection before dialog
    const start = inner.selectionStart;
    const end = inner.selectionEnd;
    const selectedText = inner.value.substring(start, end);

    const url = await prompt({
      title: t('toolbar.link'),
      label: t('toolbar.urlLabel'),
      placeholder: 'https://',
    });

    if (!url) return;

    const linkText = selectedText || 'link';
    const markdown = `[${linkText}](${url})`;

    inner.focus();
    inner.setRangeText(markdown, start, end, 'end');

    this.syncAndNotify();
  }

  /**
   * Insert an image with dialog
   */
  async insertImage() {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    // Store selection before dialog
    const start = inner.selectionStart;
    const end = inner.selectionEnd;
    const selectedText = inner.value.substring(start, end);

    const url = await prompt({
      title: t('toolbar.image'),
      label: t('toolbar.imageUrlLabel'),
      placeholder: 'https://',
    });

    if (!url) return;

    const altText = selectedText || await prompt({
      title: t('toolbar.image'),
      label: t('toolbar.altTextLabel'),
      value: 'image',
    }) || 'image';

    const markdown = `![${altText}](${url})`;

    inner.focus();
    inner.setRangeText(markdown, start, end, 'end');

    this.syncAndNotify();
  }

  /**
   * Insert a fenced code block
   */
  insertCodeBlock() {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    const start = inner.selectionStart;
    const end = inner.selectionEnd;
    const selected = inner.value.substring(start, end);

    const codeBlock = '```\n' + (selected || '') + '\n```';

    inner.focus();
    inner.setRangeText(codeBlock, start, end, 'end');

    // Position cursor after opening fence
    if (!selected) {
      const newPos = start + 4; // After "```\n"
      inner.setSelectionRange(newPos, newPos);
    }

    this.syncAndNotify();
  }

  /**
   * Insert a 3x3 table skeleton
   */
  insertTable() {
    const inner = this.getInnerTextarea();
    if (!inner) return;

    const start = inner.selectionStart;
    const end = inner.selectionEnd;

    const table = `
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`.trim();

    inner.focus();
    inner.setRangeText('\n' + table + '\n', start, end, 'end');

    this.syncAndNotify();
  }
}
