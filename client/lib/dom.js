/**
 * DOM Utilities
 * Helpers for DOM manipulation.
 */

/**
 * Query selector shorthand
 * @param {string} selector
 * @param {Element|Document} context
 * @returns {Element|null}
 */
export const $ = (selector, context = document) => context.querySelector(selector);

/**
 * Query selector all shorthand
 * @param {string} selector
 * @param {Element|Document} context
 * @returns {NodeListOf<Element>}
 */
export const $$ = (selector, context = document) => context.querySelectorAll(selector);

/**
 * Create element with attributes and children (hyperscript-style)
 * @param {string} tag - Element tag name
 * @param {Object} attrs - Attributes and properties
 * @param {Array} children - Child elements or text
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) {
      continue;
    }

    // Event handlers
    if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      el.addEventListener(event, value);
      continue;
    }

    // Data attributes
    if (key.startsWith('data-') || key === 'dataset') {
      if (key === 'dataset' && typeof value === 'object') {
        Object.assign(el.dataset, value);
      } else {
        el.setAttribute(key, value);
      }
      continue;
    }

    // Class handling
    if (key === 'class' || key === 'className') {
      if (Array.isArray(value)) {
        el.className = value.filter(Boolean).join(' ');
      } else {
        el.className = value;
      }
      continue;
    }

    // Style object
    if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
      continue;
    }

    // HTML content
    if (key === 'html' || key === 'innerHTML') {
      el.innerHTML = value;
      continue;
    }

    // Text content
    if (key === 'text' || key === 'textContent') {
      el.textContent = value;
      continue;
    }

    // Boolean attributes
    if (value === true) {
      el.setAttribute(key, '');
      continue;
    }

    // Regular attributes
    el.setAttribute(key, String(value));
  }

  // Append children
  const childArray = Array.isArray(children) ? children : [children];
  for (const child of childArray) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Remove all children from an element
 * @param {Element} el
 */
export function empty(el) {
  // Use replaceChildren if available (better for web components)
  if (el.replaceChildren) {
    el.replaceChildren();
  } else {
    while (el.firstChild) {
      try {
        el.removeChild(el.firstChild);
      } catch {
        // Ignore errors from web components that manage their own children
        break;
      }
    }
  }
}

/**
 * Replace all children of an element
 * @param {Element} parent
 * @param  {...Node|string} children
 */
export function replaceChildren(parent, ...children) {
  empty(parent);
  for (const child of children) {
    if (typeof child === 'string') {
      parent.appendChild(document.createTextNode(child));
    } else if (child) {
      parent.appendChild(child);
    }
  }
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector
 * @param {number} timeout
 * @returns {Promise<Element>}
 */
export function waitFor(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = $(selector);
    if (el) {
      resolve(el);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = $(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

/**
 * Announce a message to screen readers
 * @param {string} message
 */
export function announce(message) {
  const announcer = $('#announcer');
  if (announcer) {
    announcer.textContent = message;
    // Clear after announcement to allow repeated messages
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

/**
 * Create a debounced function with .flush() method
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function & { flush: () => void, cancel: () => void }}
 */
export function debounce(fn, ms) {
  let timeoutId = null;
  let lastArgs = null;

  function debounced(...args) {
    lastArgs = args;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...lastArgs);
      lastArgs = null;
    }, ms);
  }

  /**
   * Execute immediately if there's a pending call
   */
  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      timeoutId = null;
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  /**
   * Cancel pending execution
   */
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return debounced;
}

/**
 * Focus an element by data-focus-key attribute
 * Used with validation to jump to problematic fields
 * @param {string} focusKey
 * @returns {boolean} Whether element was found and focused
 */
export function focusByKey(focusKey) {
  const el = $(`[data-focus-key="${focusKey}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof el.focus === 'function') {
      el.focus();
    }
    return true;
  }
  return false;
}

/**
 * Parse URL query parameters
 * @param {string} [url] - URL to parse (defaults to current location)
 * @returns {Record<string, string>}
 */
export function getQueryParams(url = window.location.href) {
  const params = new URL(url).searchParams;
  return Object.fromEntries(params);
}
