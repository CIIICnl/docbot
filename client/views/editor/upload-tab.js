/**
 * Upload Tab
 * Drag-and-drop file upload for markdown files.
 */

import { h, empty } from '../../lib/dom.js';
import { createDropZone, readFileAsText, formatFileSize } from '../../lib/file-upload.js';
import { success, error } from '../../lib/toast.js';
import { slIcon, slButton } from '../../lib/shoelace.js';

/**
 * Create the upload tab content
 * @param {Function} onContentChange - Callback when content changes
 */
export function createUploadTab(onContentChange) {
  // File info display
  const fileIcon = slIcon({ name: 'file-text', className: 'upload-file-icon' });
  const fileName = h('span', { class: 'upload-file-name' }, ['']);
  const fileSize = h('span', { class: 'upload-file-size text-muted' }, ['']);

  const clearBtn = slButton({
    variant: 'text',
    size: 'small',
    icon: 'x',
    onClick: () => clearFile(),
  });

  const fileInfo = h('div', { class: 'upload-file-info' }, [
    fileIcon,
    h('div', { class: 'upload-file-details' }, [fileName, fileSize]),
    clearBtn,
  ]);
  fileInfo.hidden = true;

  // Preview container
  const previewContent = h('div', { class: 'upload-preview-content' }, []);
  const previewContainer = h('div', { class: 'upload-preview' }, [
    h('div', { class: 'upload-preview-header' }, [h('span', {}, ['Preview'])]),
    previewContent,
  ]);
  previewContainer.hidden = true;

  // Clear the uploaded file
  function clearFile() {
    fileInfo.hidden = true;
    previewContainer.hidden = true;
    onContentChange('', '', 'markdown');
  }

  // Handle file upload
  async function handleFiles(files) {
    const file = files[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);

      // Update file info
      fileName.textContent = file.name;
      fileSize.textContent = formatFileSize(file.size);
      fileInfo.hidden = false;

      // Extract title from filename
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '');

      // Update preview
      empty(previewContent);
      previewContent.appendChild(
        h('pre', { class: 'upload-preview-text' }, [
          content.slice(0, 500) + (content.length > 500 ? '...' : ''),
        ])
      );
      previewContainer.hidden = false;

      // Notify parent
      onContentChange(content, title, 'markdown');
      success(`Loaded ${file.name}`);
    } catch (err) {
      error(`Failed to read file: ${err.message}`);
    }
  }

  // Create drop zone
  const dropZone = createDropZone({
    accept: ['.md', '.markdown', '.txt'],
    mimeTypes: ['text/markdown', 'text/plain', 'text/x-markdown'],
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    label: 'Drop markdown file here or click to browse',
    icon: 'file-earmark-text',
    onFiles: handleFiles,
    onError: (message) => error(message),
  });

  return h('div', { class: 'upload-tab' }, [dropZone, fileInfo, previewContainer]);
}
