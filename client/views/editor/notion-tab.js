/**
 * Notion Tab
 * Import content from Notion pages.
 */

import { h, empty } from '../../lib/dom.js';
import { post } from '../../lib/api.js';
import { success, error } from '../../lib/toast.js';
import { slInput, slButton, slSpinner } from '../../lib/shoelace.js';

/**
 * Create the Notion tab content
 * @param {Function} onContentChange - Callback when content changes
 */
export function createNotionTab(onContentChange) {
  // State
  let isLoading = false;

  // URL input
  const urlInput = slInput({
    label: 'Notion Page URL',
    placeholder: 'https://www.notion.so/your-page-id',
    size: 'medium',
    className: 'notion-url-input',
  });

  // Fetch button
  const fetchButton = slButton({
    variant: 'primary',
    icon: 'download',
    text: 'Fetch Page',
  });

  // Loading spinner
  const loadingSpinner = slSpinner({ className: 'notion-loading' });
  loadingSpinner.hidden = true;

  // Preview elements
  const previewTitle = h('span', { class: 'notion-preview-title' }, ['']);

  const clearPreviewBtn = slButton({
    variant: 'text',
    size: 'small',
    icon: 'x',
    onClick: () => clearContent(),
  });

  const previewContent = h('div', { class: 'notion-preview-content' }, []);

  const preview = h('div', { class: 'notion-preview' }, [
    h('div', { class: 'notion-preview-header' }, [previewTitle, clearPreviewBtn]),
    previewContent,
  ]);
  preview.hidden = true;

  // Help text
  const helpText = h('div', { class: 'notion-help text-muted' }, [
    h('p', {}, [h('strong', {}, ['How to use:'])]),
    h('ol', {}, [
      h('li', {}, ['Copy the Notion page URL from your browser']),
      h('li', {}, ['Make sure the page is shared with your integration']),
      h('li', {}, ['Paste the URL above and click "Fetch Page"']),
    ]),
  ]);

  // Clear content
  function clearContent() {
    urlInput.value = '';
    preview.hidden = true;
    helpText.hidden = false;
    onContentChange('', '', 'markdown');
  }

  // Set loading state
  function setLoading(loading) {
    isLoading = loading;
    fetchButton.loading = loading;
    loadingSpinner.hidden = !loading;
    urlInput.disabled = loading;
  }

  // Fetch Notion page
  async function fetchPage() {
    const url = urlInput.value.trim();

    if (!url) {
      error('Please enter a Notion page URL');
      return;
    }

    setLoading(true);

    try {
      const result = await post('/api/notion/fetch', { url });

      if (!result.ok) {
        throw new Error(result.data?.error || 'Failed to fetch page');
      }

      const { title, markdown } = result.data;

      // Update preview
      previewTitle.textContent = title || 'Untitled';
      empty(previewContent);
      previewContent.appendChild(
        h('pre', { class: 'notion-preview-text' }, [
          markdown.slice(0, 500) + (markdown.length > 500 ? '...' : ''),
        ])
      );
      preview.hidden = false;
      helpText.hidden = true;

      // Notify parent
      onContentChange(markdown, title, 'notion');
      success(`Fetched: ${title}`);
    } catch (err) {
      error(err.message || 'Failed to fetch Notion page');
    } finally {
      setLoading(false);
    }
  }

  // Event handlers
  fetchButton.addEventListener('click', fetchPage);

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isLoading) {
      fetchPage();
    }
  });

  return h('div', { class: 'notion-tab' }, [
    h('div', { class: 'notion-input-row' }, [urlInput, fetchButton, loadingSpinner]),
    preview,
    helpText,
  ]);
}
