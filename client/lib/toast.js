/**
 * Toast Notifications
 * Uses Shoelace sl-alert for consistent styling.
 * Supports ID-based deduplication to replace existing toasts.
 */

import { announce } from './dom.js';

/**
 * @typedef {'primary'|'success'|'warning'|'danger'|'neutral'} ToastVariant
 */

/**
 * @typedef {Object} ToastOptions
 * @property {ToastVariant} [variant='primary']
 * @property {string} [icon]
 * @property {number} [duration=4000]
 * @property {boolean} [closable=true]
 * @property {string} [id] - Unique ID for deduplication. Same ID replaces existing toast.
 */

/**
 * Default icons for each variant
 */
const defaultIcons = {
  primary: 'info-circle',
  success: 'check-circle',
  warning: 'exclamation-triangle',
  danger: 'x-circle',
  neutral: 'info-circle',
};

/**
 * Track active toasts by ID for deduplication
 * @type {Map<string, HTMLElement>}
 */
const activeToasts = new Map();

/**
 * Maximum concurrent toasts
 */
const MAX_TOASTS = 6;

/**
 * Show a toast notification
 * @param {string} message
 * @param {ToastOptions} options
 * @returns {HTMLElement}
 */
export async function toast(message, options = {}) {
  const {
    variant = 'primary',
    icon = defaultIcons[variant],
    duration = 4000,
    closable = true,
    id,
  } = options;

  // Ensure sl-alert is defined before using it
  await customElements.whenDefined('sl-alert');

  // If ID provided and toast with same ID exists, remove it first
  if (id && activeToasts.has(id)) {
    const existing = activeToasts.get(id);
    try {
      existing.hide();
    } catch {
      // Toast may already be hidden
    }
    activeToasts.delete(id);
  }

  // Limit concurrent toasts (remove oldest if at max)
  if (activeToasts.size >= MAX_TOASTS) {
    const oldest = activeToasts.entries().next().value;
    if (oldest) {
      try {
        oldest[1].hide();
      } catch {
        // Ignore
      }
      activeToasts.delete(oldest[0]);
    }
  }

  const alert = document.createElement('sl-alert');
  alert.variant = variant;
  alert.closable = closable;
  alert.duration = duration;

  // Store ID for tracking
  const toastId = id || `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  alert.dataset.toastId = toastId;

  // Add icon
  if (icon) {
    const iconEl = document.createElement('sl-icon');
    iconEl.name = icon;
    iconEl.slot = 'icon';
    alert.appendChild(iconEl);
  }

  // Add message
  const textNode = document.createTextNode(message);
  alert.appendChild(textNode);

  // Track this toast
  activeToasts.set(toastId, alert);

  // Cleanup when hidden
  alert.addEventListener('sl-after-hide', () => {
    activeToasts.delete(toastId);
    try {
      alert.remove();
    } catch {
      // Already removed
    }
  });

  // Announce to screen readers
  announce(message);

  // Show toast
  document.body.appendChild(alert);
  alert.toast();

  return alert;
}

/**
 * Show a success toast
 * @param {string} message
 * @param {Omit<ToastOptions, 'variant'>} options
 */
export function success(message, options = {}) {
  return toast(message, { ...options, variant: 'success' });
}

/**
 * Show a warning toast
 * Stays a bit longer than the 4s default so it survives a glance away.
 * @param {string} message
 * @param {Omit<ToastOptions, 'variant'>} options
 */
export function warning(message, options = {}) {
  return toast(message, { duration: 8000, ...options, variant: 'warning' });
}

/**
 * Show an error toast
 * Errors don't auto-hide: a missed transient toast reads as "the app did
 * nothing". The user dismisses it via the close button.
 * @param {string} message
 * @param {Omit<ToastOptions, 'variant'>} options
 */
export function error(message, options = {}) {
  return toast(message, { duration: Infinity, ...options, variant: 'danger' });
}

/**
 * Show an info toast
 * @param {string} message
 * @param {Omit<ToastOptions, 'variant'>} options
 */
export function info(message, options = {}) {
  return toast(message, { ...options, variant: 'primary' });
}

/**
 * Dismiss a toast by ID
 * @param {string} id
 */
export function dismiss(id) {
  const toast = activeToasts.get(id);
  if (toast) {
    try {
      toast.hide();
    } catch {
      // Already hidden
    }
    activeToasts.delete(id);
  }
}

/**
 * Dismiss all toasts
 */
export function dismissAll() {
  for (const toast of activeToasts.values()) {
    try {
      toast.hide();
    } catch {
      // Ignore
    }
  }
  activeToasts.clear();
}
