/**
 * Shoelace Component Helpers
 * Factory functions for creating Shoelace components with common patterns.
 */

// Import all Shoelace components
import '@shoelace-style/shoelace/dist/shoelace.js';

// Set base path for Shoelace assets (icons, etc.)
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
setBasePath('/dist/shoelace');

/**
 * Create a Shoelace element with properties
 * @param {string} tag - Element tag (e.g., 'sl-button')
 * @param {Object} props - Properties to set on the element
 * @param {(string|Node)[]} children - Child content
 * @returns {HTMLElement}
 */
export function sl(tag, props = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (key === 'class' || key === 'className') {
      el.className = value;
    } else if (key.startsWith('on')) {
      const event = key.slice(2).toLowerCase();
      el.addEventListener(event, value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (value === true) {
      // Boolean attributes
      el.setAttribute(key, '');
    } else {
      // Set as attribute for custom elements to ensure they work before upgrade
      el.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Create an sl-input
 */
export function slInput(props = {}) {
  return sl('sl-input', props);
}

/**
 * Create an sl-textarea
 */
export function slTextarea(props = {}) {
  return sl('sl-textarea', props);
}

/**
 * Create an sl-button with optional icon
 * @param {Object} props - Button properties
 * @param {string} props.icon - Icon name (added as prefix)
 * @param {string} props.text - Button text
 */
export function slButton({ icon, text, ...props } = {}) {
  const children = [];

  if (icon) {
    const iconEl = sl('sl-icon', { name: icon, slot: 'prefix' });
    children.push(iconEl);
  }

  if (text) {
    children.push(text);
  }

  return sl('sl-button', props, children);
}

/**
 * Create an sl-select with options
 * @param {Object} props - Select properties
 * @param {Array<{value: string, label: string}>} props.options - Options to add
 */
export function slSelect({ options = [], ...props } = {}) {
  const select = sl('sl-select', props);

  for (const opt of options) {
    const option = sl('sl-option', { value: opt.value }, [opt.label]);
    select.appendChild(option);
  }

  return select;
}

/**
 * Create an sl-switch
 */
export function slSwitch({ text, ...props } = {}) {
  const sw = sl('sl-switch', props);
  if (text) {
    sw.textContent = text;
  }
  return sw;
}

/**
 * Create an sl-icon
 */
export function slIcon(props = {}) {
  return sl('sl-icon', props);
}

/**
 * Create an sl-spinner
 */
export function slSpinner(props = {}) {
  return sl('sl-spinner', props);
}

/**
 * Create an sl-icon-button
 */
export function slIconButton(props = {}) {
  return sl('sl-icon-button', props);
}
