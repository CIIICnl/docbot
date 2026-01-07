/**
 * Modal Utilities
 * Standard modal components with lifecycle management.
 */

import { t } from './i18n.js';

/**
 * Creates a modal with standard structure and lifecycle management.
 *
 * @param {Function} h - DOM element factory function
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title text
 * @param {string} [options.hint] - Optional hint text below title
 * @param {string} [options.modalClass] - Additional CSS class for the modal
 * @param {string} [options.closeLabel] - Custom close button label
 * @param {boolean} [options.closeOnBackdrop=true] - Close when clicking backdrop
 * @param {boolean} [options.closeOnEscape=true] - Close on Escape key
 * @param {boolean} [options.showCloseButton=true] - Show close button in header
 * @param {Function} [options.onClose] - Callback when modal closes
 * @returns {Object} Modal API object
 */
export function createModal(h, options = {}) {
  const {
    title: titleText,
    hint: hintText,
    modalClass,
    closeLabel = t('common.close'),
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true,
    onClose,
  } = options;

  const backdrop = h('div', { class: 'modal-backdrop' });
  const modalClasses = ['modal', modalClass].filter(Boolean).join(' ');
  const modal = h('div', { class: modalClasses });

  // Header with title and optional close button
  const header = h('div', { class: 'modal-header' });
  const title = h('h2', { class: 'modal-title', text: titleText || '' });
  header.append(title);

  let closeBtn = null;
  if (showCloseButton) {
    closeBtn = h('sl-icon-button', {
      name: 'x-lg',
      label: closeLabel,
      class: 'modal-close-btn',
      onclick: () => close(),
    });
    header.append(closeBtn);
  }

  // Optional hint
  let hint = null;
  if (hintText) {
    hint = h('div', { class: 'modal-hint', text: hintText });
  }

  // Content area for custom content
  const content = h('div', { class: 'modal-content' });

  // Footer for action buttons
  const footer = h('div', { class: 'modal-footer' });

  // Track overlay closers for cleanup
  let openOverlayClosers = null;
  let isOpen = false;

  const onKey = (e) => {
    if (closeOnEscape && e.key === 'Escape') close();
  };

  /**
   * Close the modal and clean up
   * @param {Object} [result] - Optional result to pass to onClose
   */
  function close(result) {
    if (!isOpen) return;
    isOpen = false;

    // Animate out
    backdrop.classList.remove('is-visible');
    backdrop.classList.add('is-closing');

    setTimeout(() => {
      try {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
      } finally {
        openOverlayClosers?.delete(close);
        onClose?.(result);
      }
    }, 200);
  }

  if (closeOnBackdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }

  /**
   * Show the modal
   * @param {HTMLElement} root - Element to append modal to
   * @param {Set} [overlayClosers] - Set to register close function for cleanup
   */
  function show(root, overlayClosers) {
    if (isOpen) return;
    isOpen = true;
    openOverlayClosers = overlayClosers || null;

    // Build modal structure
    modal.innerHTML = '';
    modal.append(header);
    if (hint) modal.append(hint);
    modal.append(content);
    modal.append(footer);

    backdrop.innerHTML = '';
    backdrop.append(modal);
    root.append(backdrop);

    openOverlayClosers?.add(close);
    document.addEventListener('keydown', onKey);

    // Animate in
    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible');
    });
  }

  /**
   * Update the title text
   * @param {string} text - New title text
   */
  function setTitle(text) {
    title.textContent = text || '';
  }

  /**
   * Update the hint text
   * @param {string} text - New hint text
   */
  function setHint(text) {
    if (!hint) {
      hint = h('div', { class: 'modal-hint', text: text || '' });
      if (header.nextSibling) {
        header.after(hint);
      }
    } else {
      hint.textContent = text || '';
    }
  }

  /**
   * Set busy state (disables close interactions)
   * @param {boolean} busy
   */
  function setBusy(busy) {
    if (closeBtn) closeBtn.disabled = busy;
    modal.classList.toggle('is-busy', busy);
  }

  return {
    backdrop,
    modal,
    header,
    title,
    closeBtn,
    hint,
    content,
    footer,
    close,
    show,
    setTitle,
    setHint,
    setBusy,
  };
}

/**
 * Creates and immediately shows a simple modal.
 * Shorthand for createModal + show.
 *
 * @param {Function} h - DOM element factory function
 * @param {HTMLElement} root - Element to append modal to
 * @param {Object} options - Modal options (see createModal)
 * @param {Set} [overlayClosers] - Set to register close function for cleanup
 * @returns {Object} Modal API object
 */
export function openModal(h, root, options = {}, overlayClosers) {
  const modalApi = createModal(h, options);
  modalApi.show(root, overlayClosers);
  return modalApi;
}

/**
 * Creates a confirmation modal with Cancel/Confirm buttons.
 *
 * @param {Function} h - DOM element factory function
 * @param {HTMLElement} root - Element to append modal to
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Confirmation message
 * @param {string} [options.confirmLabel] - Confirm button label
 * @param {string} [options.cancelLabel] - Cancel button label
 * @param {boolean} [options.danger=false] - Use danger styling for confirm
 * @param {Set} [overlayClosers] - Set to register close function for cleanup
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
 */
export function confirmModal(h, root, options = {}, overlayClosers) {
  const {
    title: titleText,
    message,
    confirmLabel = t('common.confirm'),
    cancelLabel = t('common.cancel'),
    danger = false,
  } = options;

  return new Promise((resolve) => {
    const modalApi = createModal(h, {
      title: titleText,
      closeOnBackdrop: false,
      showCloseButton: false,
      onClose: (result) => resolve(result?.confirmed === true),
    });

    const messageEl = h('p', { class: 'modal-message', text: message || '' });

    const btnCancel = h('sl-button', {
      variant: 'default',
      text: cancelLabel,
      onclick: () => modalApi.close({ confirmed: false }),
    });
    const btnConfirm = h('sl-button', {
      variant: danger ? 'danger' : 'primary',
      text: confirmLabel,
      onclick: () => modalApi.close({ confirmed: true }),
    });

    modalApi.content.append(messageEl);
    modalApi.footer.append(btnCancel, btnConfirm);
    modalApi.show(root, overlayClosers);
  });
}

/**
 * Creates a modal that returns a Promise, resolving when closed.
 * Useful for modals that need to return data.
 *
 * @param {Function} h - DOM element factory function
 * @param {Object} options - Modal options (see createModal)
 * @returns {Object} Modal API with additional `promise` property
 */
export function createPromiseModal(h, options = {}) {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const originalOnClose = options.onClose;
  const modalApi = createModal(h, {
    ...options,
    onClose: (result) => {
      originalOnClose?.(result);
      resolvePromise(result);
    },
  });

  return {
    ...modalApi,
    promise,
  };
}

/**
 * Create an overlay registry for tracking open modals
 * @returns {Object} Registry with openOverlayClosers Set and closeAll function
 */
export function createOverlayRegistry() {
  const openOverlayClosers = new Set();

  return {
    openOverlayClosers,
    closeAll: () => {
      for (const close of openOverlayClosers) {
        close();
      }
    },
  };
}
