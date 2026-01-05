/**
 * File Upload Utilities
 * Drag-and-drop file upload with validation.
 */

import { h } from './dom.js';

/**
 * @typedef {Object} FileUploadOptions
 * @property {string[]} [accept] - Accepted file extensions (e.g., ['.md', '.txt'])
 * @property {string[]} [mimeTypes] - Accepted MIME types (e.g., ['text/markdown'])
 * @property {number} [maxSize] - Max file size in bytes
 * @property {boolean} [multiple=false] - Allow multiple files
 * @property {string} [label='Drop file here or click to browse']
 * @property {string} [icon='upload']
 * @property {Function} [onFiles] - Callback with FileList
 * @property {Function} [onError] - Callback for validation errors
 */

/**
 * Create a file upload drop zone
 * @param {FileUploadOptions} options
 * @returns {HTMLElement}
 */
export function createDropZone(options = {}) {
  const {
    accept = [],
    mimeTypes = [],
    maxSize,
    multiple = false,
    label = 'Drop file here or click to browse',
    icon = 'upload',
    onFiles,
    onError,
  } = options;

  // Hidden file input
  const input = h('input', {
    type: 'file',
    class: 'sr-only',
    accept: [...accept, ...mimeTypes].join(',') || undefined,
    multiple: multiple || undefined,
  });

  // Drop zone UI
  const zone = h('div', {
    class: 'vk-drop-zone',
    tabindex: '0',
    role: 'button',
    'aria-label': label,
  }, [
    h('sl-icon', { name: icon, class: 'vk-drop-zone-icon' }),
    h('p', { class: 'vk-drop-zone-label' }, [label]),
    accept.length > 0 && h('p', { class: 'vk-drop-zone-hint' }, [
      `Accepted: ${accept.join(', ')}`,
    ]),
    input,
  ]);

  // Validate files
  function validateFiles(files) {
    const errors = [];
    const validFiles = [];

    for (const file of files) {
      // Check extension
      if (accept.length > 0) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!accept.includes(ext)) {
          errors.push(`"${file.name}" has invalid extension. Accepted: ${accept.join(', ')}`);
          continue;
        }
      }

      // Check MIME type
      if (mimeTypes.length > 0 && !mimeTypes.includes(file.type)) {
        errors.push(`"${file.name}" has invalid type.`);
        continue;
      }

      // Check size
      if (maxSize && file.size > maxSize) {
        const maxMB = (maxSize / 1024 / 1024).toFixed(1);
        errors.push(`"${file.name}" exceeds ${maxMB}MB limit.`);
        continue;
      }

      validFiles.push(file);
    }

    return { validFiles, errors };
  }

  // Handle file selection
  function handleFiles(files) {
    if (!files || files.length === 0) return;

    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0 && onError) {
      onError(errors);
    }

    if (validFiles.length > 0 && onFiles) {
      onFiles(validFiles);
    }
  }

  // Click to browse
  zone.addEventListener('click', () => {
    input.click();
  });

  // Keyboard activation
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // File input change
  input.addEventListener('change', () => {
    handleFiles(input.files);
    input.value = ''; // Reset to allow same file again
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('is-drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    zone.classList.remove('is-drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-drag-over');
    handleFiles(e.dataTransfer.files);
  });

  return zone;
}

/**
 * Read file contents as text
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Read file contents as data URL
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Read file contents as ArrayBuffer
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Format file size for display
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
