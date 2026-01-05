/**
 * Search Controller
 * Base class for search functionality with common UI and navigation.
 */

import { h } from './dom.js';
import { slInput } from './shoelace.js';
import { SEARCH } from './constants.js';

/**
 * Base search controller class
 * Handles common UI creation, state management, and navigation.
 * Subclasses implement findMatches(), clearHighlights(), and scrollToMatch().
 */
export class SearchController {
  constructor() {
    this.matches = [];
    this.currentIndex = -1;
    this._createUI();
    this._setupEventListeners();
  }

  _createUI() {
    this.input = slInput({
      placeholder: 'Search...',
      size: 'small',
      clearable: true,
      className: 'panel-search-input',
    });

    this.count = h('span', { class: 'search-count' }, []);

    this.prevBtn = h('sl-icon-button', {
      name: 'chevron-up',
      label: 'Previous',
      disabled: true,
    });

    this.nextBtn = h('sl-icon-button', {
      name: 'chevron-down',
      label: 'Next',
      disabled: true,
    });

    this.searchBar = h('div', { class: 'panel-search-bar' }, [
      this.input,
      this.prevBtn,
      this.nextBtn,
      this.count,
    ]);
    this.searchBar.hidden = true;

    this.toggle = h('sl-icon-button', {
      name: 'search',
      label: 'Search',
      class: 'panel-search-toggle',
    });
  }

  _setupEventListeners() {
    this.input.addEventListener('sl-input', () => this.search(this.input.value));
    this.input.addEventListener('sl-clear', () => this.clear());
    this.prevBtn.addEventListener('click', () => this.navigate(-1));
    this.nextBtn.addEventListener('click', () => this.navigate(1));

    this.toggle.addEventListener('click', () => {
      this.searchBar.hidden = !this.searchBar.hidden;
      if (!this.searchBar.hidden) {
        this.input.focus();
      } else {
        this.clear();
      }
    });
  }

  search(query) {
    if (!query || query.length < SEARCH.MIN_LENGTH) {
      this.clear();
      return;
    }

    this.matches = this.findMatches(query);
    this._updateUI();

    if (this.matches.length > 0) {
      this.currentIndex = 0;
      this.scrollToMatch();
    }
  }

  clear() {
    this.clearHighlights();
    this.matches = [];
    this.currentIndex = -1;
    this.count.textContent = '';
    this.prevBtn.disabled = true;
    this.nextBtn.disabled = true;
    this.input.value = '';
  }

  _updateUI() {
    const matchCount = this.matches.length;
    if (matchCount === 0) {
      this.count.textContent = 'No matches';
      this.prevBtn.disabled = true;
      this.nextBtn.disabled = true;
    } else {
      this.count.textContent = `${this.currentIndex + 1} of ${matchCount}`;
      this.prevBtn.disabled = matchCount <= 1;
      this.nextBtn.disabled = matchCount <= 1;
    }
  }

  navigate(direction) {
    if (this.matches.length === 0) return;

    this.onBeforeNavigate?.();
    this.currentIndex =
      (this.currentIndex + direction + this.matches.length) % this.matches.length;
    this._updateUI();
    this.scrollToMatch();
  }

  hasActiveSearch() {
    return this.input.value.length > 0;
  }

  // Abstract methods - must be implemented by subclasses
  findMatches(query) {
    throw new Error('findMatches() must be implemented');
  }

  clearHighlights() {
    // Default: no-op (override if highlights need cleanup)
  }

  scrollToMatch() {
    throw new Error('scrollToMatch() must be implemented');
  }
}

/**
 * Text search controller for textarea elements
 */
export class TextSearchController extends SearchController {
  constructor(textarea) {
    super();
    this.textarea = textarea;
  }

  findMatches(query) {
    const text = this.textarea.value;
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    const matches = [];

    let pos = 0;
    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
      matches.push(pos);
      pos += 1;
    }

    return matches;
  }

  scrollToMatch() {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) return;

    const innerTextarea = this.textarea.shadowRoot?.querySelector('textarea');
    if (!innerTextarea) return;

    const pos = this.matches[this.currentIndex];
    const query = this.input.value;

    // Select the match
    innerTextarea.focus();
    innerTextarea.setSelectionRange(pos, pos + query.length);

    // Scroll to selection
    const text = innerTextarea.value.substring(0, pos);
    const lines = text.split('\n');
    const lineHeight = parseInt(getComputedStyle(innerTextarea).lineHeight) || SEARCH.DEFAULT_LINE_HEIGHT;
    const scrollTop = (lines.length - 1) * lineHeight - innerTextarea.clientHeight / 2;
    innerTextarea.scrollTop = Math.max(0, scrollTop);
  }
}

/**
 * DOM search controller for iframe elements
 */
export class DOMSearchController extends SearchController {
  constructor(iframe) {
    super();
    this.iframe = iframe;
  }

  findMatches(query) {
    const doc = this.iframe.contentDocument;
    if (!doc?.body) return [];

    // Clear previous highlights first
    this.clearHighlights();

    const matches = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    const nodesToHighlight = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent;
      const lowerText = text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let pos = 0;

      while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        nodesToHighlight.push({ node, pos, length: query.length });
        pos += 1;
      }
    }

    // Apply highlights (in reverse to preserve positions)
    for (let i = nodesToHighlight.length - 1; i >= 0; i--) {
      const { node, pos, length } = nodesToHighlight[i];
      const range = doc.createRange();
      range.setStart(node, pos);
      range.setEnd(node, pos + length);

      const highlight = doc.createElement('mark');
      highlight.className = 'search-highlight';
      highlight.dataset.index = String(matches.length);
      range.surroundContents(highlight);

      matches.unshift(highlight);
    }

    return matches;
  }

  clearHighlights() {
    const doc = this.iframe.contentDocument;
    if (!doc) return;

    const highlights = doc.querySelectorAll('mark.search-highlight');
    highlights.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      if (mark.parentNode) {
        mark.parentNode.removeChild(mark);
      }
    });
    doc.body?.normalize();
  }

  onBeforeNavigate() {
    // Remove current highlight class before navigating
    if (this.currentIndex >= 0 && this.matches[this.currentIndex]) {
      this.matches[this.currentIndex].classList.remove('search-highlight-current');
    }
  }

  scrollToMatch() {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) return;

    // Remove previous current highlight
    this.matches.forEach((m) => m?.classList?.remove('search-highlight-current'));

    const match = this.matches[this.currentIndex];
    if (match) {
      match.classList.add('search-highlight-current');
      match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// CSS for search highlights in preview iframe
export const SEARCH_HIGHLIGHT_CSS = `
  mark.search-highlight {
    background-color: #fef08a;
    color: inherit;
    padding: 0;
    border-radius: 2px;
  }
  mark.search-highlight-current {
    background-color: #fb923c;
    color: inherit;
  }
`;
