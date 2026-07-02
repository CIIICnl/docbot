/**
 * Word Tab
 * Upload and convert Word documents.
 */

import { h, empty } from '../../lib/dom.js';
import { createDropZone, readFileAsBase64, formatFileSize } from '../../lib/file-upload.js';
import { post } from '../../lib/api.js';
import { success, error, warning } from '../../lib/toast.js';
import { slIcon, slButton } from '../../lib/shoelace.js';
import { maybeOfferLanguageSwitch } from '../../lib/i18n.js';
import { FILES } from '../../lib/constants.js';

/**
 * Create the Word tab content
 * @param {Function} onContentChange - Callback when content changes
 * @param {Function} onImagesChange - Callback when images are extracted
 */
export function createWordTab(onContentChange, onImagesChange) {
  // State
  let extractedImages = [];

  // File info display
  const fileIcon = slIcon({ name: 'file-word', className: 'upload-file-icon word-icon' });
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

  // Processing status
  const statusText = h('span', { class: 'word-status-text' }, ['']);
  const statusSpinner = h('sl-spinner', { style: 'font-size: 1rem;' });
  const statusContainer = h('div', { class: 'word-status' }, [statusSpinner, statusText]);
  statusContainer.hidden = true;

  // Image gallery
  const imageGallery = h('div', { class: 'word-image-gallery' }, []);
  const imageSection = h('div', { class: 'word-images' }, [
    h('div', { class: 'word-images-header' }, [
      slIcon({ name: 'images', className: 'word-images-icon' }),
      h('span', { class: 'word-images-title' }, ['Extracted Images']),
    ]),
    imageGallery,
  ]);
  imageSection.hidden = true;

  // Clear the uploaded file
  function clearFile() {
    extractedImages = [];

    fileInfo.hidden = true;
    statusContainer.hidden = true;
    imageSection.hidden = true;

    empty(imageGallery);
    onContentChange('', '', 'markdown');
    if (onImagesChange) onImagesChange([]);
  }

  // Update image gallery
  function updateImageGallery() {
    empty(imageGallery);

    if (extractedImages.length === 0) {
      imageSection.hidden = true;
      return;
    }

    imageSection.hidden = false;

    for (const img of extractedImages) {
      const imgEl = h('div', { class: 'word-image-item' }, [
        h('img', {
          src: `data:${img.mimeType};base64,${img.data}`,
          alt: img.name,
          class: 'word-image-thumb',
        }),
        h('div', { class: 'word-image-info' }, [
          h('span', { class: 'word-image-name' }, [img.name]),
          slButton({
            variant: 'text',
            size: 'small',
            icon: 'clipboard',
            onClick: () => {
              navigator.clipboard.writeText(`![${img.name}](extracted/${img.name})`);
              success('Copied markdown reference');
            },
          }),
        ]),
      ]);
      imageGallery.appendChild(imgEl);
    }

    if (onImagesChange) onImagesChange(extractedImages);
  }

  // Handle file upload
  async function handleFiles(files) {
    const file = files[0];
    if (!file) return;

    // Update file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.hidden = false;

    // Show processing status
    statusContainer.hidden = false;
    statusText.textContent = 'Parsing document...';

    try {
      const base64 = await readFileAsBase64(file);

      // Parse the document
      const parseResult = await post('/api/docx/parse', { file: base64 });

      if (!parseResult.ok) {
        throw new Error(parseResult.data?.error || 'Failed to parse document');
      }

      const markdown = parseResult.data.markdown;
      extractedImages = parseResult.data.images || [];

      // Show warnings if any
      if (parseResult.data.warnings && parseResult.data.warnings.length > 0) {
        warning(`Document parsed with ${parseResult.data.warnings.length} warning(s)`);
      }

      // Update image gallery
      updateImageGallery();

      // Send content to parent
      const title = parseResult.data.title || file.name.replace(/\.docx$/i, '');
      onContentChange(markdown, title, 'docx');

      statusContainer.hidden = true;
      success(`Loaded ${file.name}`);

      // Offer to switch the UI language if the document looks like another one
      // (e.g. importing an already-translated EN doc while the app is in NL).
      await maybeOfferLanguageSwitch(parseResult.data.detectedLanguage);
    } catch (err) {
      error(`Failed to process document: ${err.message}`);
      statusContainer.hidden = true;
      clearFile();
    }
  }

  // Create drop zone
  const dropZone = createDropZone({
    accept: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: FILES.MAX_UPLOAD_BYTES,
    multiple: false,
    label: 'Drop Word document here or click to browse',
    icon: 'file-earmark-word',
    onFiles: handleFiles,
    onError: (messages) => {
      for (const msg of messages) {
        error(msg);
      }
    },
  });

  return h('div', { class: 'word-tab' }, [
    dropZone,
    fileInfo,
    statusContainer,
    imageSection,
  ]);
}
