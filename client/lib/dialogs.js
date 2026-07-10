/**
 * Dialog Utilities
 * Helpers for common dialog patterns.
 */

import { h } from './dom.js';

/**
 * Show a confirmation dialog
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText='Confirm']
 * @param {string} [options.cancelText='Cancel']
 * @param {'primary'|'danger'} [options.variant='primary']
 * @returns {Promise<boolean>}
 */
export function confirm({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('sl-dialog');
    dialog.label = title;

    // Message
    const messageEl = h('p', {}, [message]);
    dialog.appendChild(messageEl);

    // Footer buttons
    const footer = h('div', { slot: 'footer', class: 'flex gap-3 justify-end' }, [
      h('sl-button', {
        variant: 'default',
        onclick: () => {
          dialog.hide();
          resolve(false);
        },
      }, [cancelText]),
      h('sl-button', {
        variant: variant === 'danger' ? 'danger' : 'primary',
        onclick: () => {
          dialog.hide();
          resolve(true);
        },
      }, [confirmText]),
    ]);
    dialog.appendChild(footer);

    // Cleanup on close
    dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.show();

    // Focus the confirm button
    requestAnimationFrame(() => {
      const confirmBtn = dialog.querySelector('sl-button[variant="primary"], sl-button[variant="danger"]');
      if (confirmBtn) {
        confirmBtn.focus();
      }
    });
  });
}

/**
 * Show a delete confirmation dialog
 * @param {string} itemName - Name of the item being deleted
 * @returns {Promise<boolean>}
 */
export function confirmDelete(itemName) {
  return confirm({
    title: 'Delete Item',
    message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    variant: 'danger',
  });
}

/**
 * Show an alert dialog (just OK button)
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.okText='OK']
 * @returns {Promise<void>}
 */
export function alert({ title, message, okText = 'OK' }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('sl-dialog');
    dialog.label = title;

    const messageEl = h('p', {}, [message]);
    dialog.appendChild(messageEl);

    const footer = h('div', { slot: 'footer', class: 'flex justify-end' }, [
      h('sl-button', {
        variant: 'primary',
        onclick: () => {
          dialog.hide();
          resolve();
        },
      }, [okText]),
    ]);
    dialog.appendChild(footer);

    dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.show();
  });
}

/**
 * Show a prompt dialog
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.label]
 * @param {string} [options.value='']
 * @param {string} [options.placeholder='']
 * @param {string} [options.confirmText='OK']
 * @param {string} [options.cancelText='Cancel']
 * @returns {Promise<string|null>}
 */
export function prompt({
  title,
  message,
  label,
  value = '',
  placeholder = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('sl-dialog');
    dialog.label = title;

    // Message
    if (message) {
      const messageEl = h('p', { class: 'mb-4' }, [message]);
      dialog.appendChild(messageEl);
    }

    // Input
    const input = document.createElement('sl-input');
    input.label = label || '';
    input.value = value;
    input.placeholder = placeholder;
    dialog.appendChild(input);

    // Footer buttons
    const footer = h('div', { slot: 'footer', class: 'flex gap-3 justify-end' }, [
      h('sl-button', {
        variant: 'default',
        onclick: () => {
          dialog.hide();
          resolve(null);
        },
      }, [cancelText]),
      h('sl-button', {
        variant: 'primary',
        onclick: () => {
          dialog.hide();
          resolve(input.value);
        },
      }, [confirmText]),
    ]);
    dialog.appendChild(footer);

    // Submit on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        dialog.hide();
        resolve(input.value);
      }
    });

    dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.show();

    // Focus input
    requestAnimationFrame(() => {
      input.focus();
    });
  });
}

/**
 * Show an "insert image" dialog offering either a local file upload or a URL.
 * Resolves to `{ file }` when the user picks a file, `{ url }` when they submit
 * a URL, or `null` on cancel. The caller does the actual upload/insertion.
 *
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.uploadText   Label for the "upload from computer" button
 * @param {string} options.orText       Divider label between upload and URL
 * @param {string} options.urlLabel
 * @param {string} [options.urlPlaceholder='https://']
 * @param {string} [options.confirmText='Insert']
 * @param {string} [options.cancelText='Cancel']
 * @param {string} [options.accept='image/*']  File input accept list
 * @returns {Promise<{file: File}|{url: string}|null>}
 */
export function imagePrompt({
  title,
  uploadText,
  orText,
  urlLabel,
  urlPlaceholder = 'https://',
  confirmText = 'Insert',
  cancelText = 'Cancel',
  accept = 'image/*',
}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('sl-dialog');
    dialog.label = title;

    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      dialog.hide();
    };

    // Hidden native file input, triggered by the upload button.
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = accept;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0] || null;
      if (file) settle({ file });
    });

    const uploadBtn = h('sl-button', {
      variant: 'primary',
      style: { width: '100%' },
      onclick: () => fileInput.click(),
    }, [
      h('sl-icon', { slot: 'prefix', name: 'upload' }),
      uploadText,
    ]);

    const divider = h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        margin: '1rem 0',
        color: 'var(--vk-color-text-muted)',
        fontSize: 'var(--vk-text-sm)',
      },
    }, [
      h('span', { style: { flex: '1', height: '1px', background: 'var(--vk-color-border)' } }),
      orText,
      h('span', { style: { flex: '1', height: '1px', background: 'var(--vk-color-border)' } }),
    ]);

    const input = document.createElement('sl-input');
    input.label = urlLabel;
    input.placeholder = urlPlaceholder;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) settle({ url: input.value.trim() });
    });

    dialog.appendChild(uploadBtn);
    dialog.appendChild(fileInput);
    dialog.appendChild(divider);
    dialog.appendChild(input);

    const footer = h('div', { slot: 'footer', class: 'flex gap-3 justify-end' }, [
      h('sl-button', {
        variant: 'default',
        onclick: () => settle(null),
      }, [cancelText]),
      h('sl-button', {
        variant: 'primary',
        onclick: () => {
          const v = input.value.trim();
          if (v) settle({ url: v });
        },
      }, [confirmText]),
    ]);
    dialog.appendChild(footer);

    dialog.addEventListener('sl-after-hide', () => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.show();

    requestAnimationFrame(() => uploadBtn.focus());
  });
}
