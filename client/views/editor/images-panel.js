/**
 * Images Panel
 * Lists every image referenced in the current markdown and lets the user
 * swap or insert images that live in docbot:// media storage.
 */

import { h, empty } from '../../lib/dom.js';
import { get } from '../../lib/api.js';
import { slIcon, slIconButton, slButton, slSpinner, slInput } from '../../lib/shoelace.js';
import { getBeeldbankPickerUrl } from '../../lib/config.js';
import { success, error, warning } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { formatFileSize } from '../../lib/file-upload.js';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MEDIA_URL_RE = /docbot:\/\/media\/[^\s)"'>]+/g;

// Cache resolved presigned URLs so we don't ping /api/media on every refresh
const previewUrlCache = new Map();

// Markdown image with an optional title (caption) in any of the three
// markdown quote styles: "...", '...', or (...).
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\)/g;

/**
 * Extract every markdown image reference from the source.
 * Returns an array of `{ url, alt, caption, count, markdown }` deduplicated
 * by url. `caption` is the markdown title slot; `markdown` is true when the
 * url appears in `![](...)` syntax (so alt/caption are editable).
 */
function extractImageRefs(markdown) {
  const refs = new Map();

  MD_IMAGE_RE.lastIndex = 0;
  let m;
  while ((m = MD_IMAGE_RE.exec(markdown)) !== null) {
    const url = m[2];
    const alt = m[1] || '';
    const caption = m[3] ?? m[4] ?? m[5] ?? '';
    const existing = refs.get(url);
    if (existing) {
      existing.count++;
      if (!existing.alt && alt) existing.alt = alt;
      if (!existing.caption && caption) existing.caption = caption;
      existing.markdown = true;
    } else {
      refs.set(url, { url, alt, caption, count: 1, markdown: true });
    }
  }

  // Catch raw docbot:// URLs that aren't wrapped in markdown image syntax
  // (e.g. inside an HTML <img src="docbot://...">). Alt/caption editing is
  // not offered for these (no markdown token to rewrite).
  const raw = markdown.match(MEDIA_URL_RE);
  if (raw) {
    for (const url of raw) {
      if (!refs.has(url)) {
        refs.set(url, { url, alt: '', caption: '', count: 1, markdown: false });
      }
    }
  }

  return Array.from(refs.values());
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a markdown image reference. Caption goes into the title slot using a
 * quote style that doesn't collide with its contents.
 */
function buildImageRef(alt, url, caption) {
  const safeAlt = (alt || '').replace(/[\r\n]+/g, ' ').replace(/[[\]]/g, '').trim();
  const cap = (caption || '').replace(/[\r\n]+/g, ' ').trim();
  if (!cap) return `![${safeAlt}](${url})`;
  let quoted;
  if (!cap.includes('"')) quoted = `"${cap}"`;
  else if (!cap.includes("'")) quoted = `'${cap}'`;
  else quoted = `(${cap.replace(/[()]/g, '')})`;
  return `![${safeAlt}](${url} ${quoted})`;
}

/**
 * Rewrite every markdown image reference pointing at `url` with new alt and
 * caption. Returns the updated markdown (or the original if nothing matched).
 */
function rewriteImageRef(markdown, url, { alt, caption }) {
  const re = new RegExp(
    `!\\[[^\\]]*\\]\\(${escapeRegExp(url)}(?:\\s+(?:"[^"]*"|'[^']*'|\\([^)]*\\)))?\\)`,
    'g'
  );
  const replacement = buildImageRef(alt, url, caption);
  return markdown.replace(re, replacement);
}

function isDocbotUrl(url) {
  return typeof url === 'string' && url.startsWith('docbot://media/');
}

function keyFromDocbotUrl(url) {
  return url.substring('docbot://media/'.length);
}

function shortLabel(url) {
  if (isDocbotUrl(url)) {
    const key = keyFromDocbotUrl(url);
    const tail = key.split('/').pop() || key;
    return tail.length > 38 ? '…' + tail.slice(-37) : tail;
  }
  try {
    const u = new URL(url);
    const tail = (u.pathname.split('/').pop() || u.host) || url;
    return tail.length > 38 ? '…' + tail.slice(-37) : tail;
  } catch {
    return url.length > 38 ? url.slice(0, 37) + '…' : url;
  }
}

async function resolvePreviewUrl(url) {
  if (!isDocbotUrl(url)) return url;
  if (previewUrlCache.has(url)) return previewUrlCache.get(url);

  const key = keyFromDocbotUrl(url);
  const result = await get(`/api/media/${encodeURIComponent(key)}`);
  if (result.ok && result.data?.url) {
    previewUrlCache.set(url, result.data.url);
    return result.data.url;
  }
  return null;
}

async function uploadImageFile(file) {
  const response = await fetch(
    `/api/media/upload?filename=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Upload failed (${response.status})`);
  }
  return response.json();
}

function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_TYPES.join(',');
    input.addEventListener('change', () => {
      resolve(input.files?.[0] || null);
    });
    input.click();
  });
}

/**
 * Create the images panel.
 *
 * @param {Object} options
 * @param {Object} options.store - Editor state store
 * @param {Function} options.setMarkdown - Replace editor content
 *   (signature: (newContent) => void; expected to also refresh the preview)
 */
export function createImagesPanel({ store, setMarkdown }) {
  let lastSignature = '';

  // Add-image hidden file input lives at the panel level
  const addInput = h('input', {
    type: 'file',
    class: 'sr-only',
    accept: ACCEPTED_TYPES.join(','),
  });

  const addBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'plus-lg',
    text: t('images.addBtn'),
    onClick: () => addInput.click(),
  });

  const beeldbankBtn = slButton({
    variant: 'default',
    size: 'small',
    icon: 'images',
    text: t('images.beeldbankBtn'),
    onClick: () => handleBeeldbank(),
  });

  async function handleBeeldbank() {
    const pickerUrl = await getBeeldbankPickerUrl();
    if (!pickerUrl) {
      error(t('images.beeldbankUnavailable'));
      return;
    }
    let mod;
    try {
      mod = await import('./beeldbank-picker.js');
    } catch {
      error(t('images.beeldbankUnavailable'));
      return;
    }
    mod.openBeeldbankPicker({
      pickerUrl,
      title: t('images.beeldbankTitle'),
      onPick: ({ url, altText, caption }) => {
        if (!url) return;
        const ref = buildImageRef(altText || '', url, caption || '');
        const state = store.get();
        const next = (state.content || '').replace(/\s*$/, '\n\n') + ref + '\n';
        setMarkdown(next);
        success(t('images.beeldbankInserted'));
      },
    });
  }

  addInput.addEventListener('change', async () => {
    const file = addInput.files?.[0];
    addInput.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      error(t('images.tooLarge', { max: formatFileSize(MAX_IMAGE_BYTES) }));
      return;
    }
    try {
      const data = await uploadImageFile(file);
      const ref = `![${file.name}](${data.mediaUrl})`;
      try {
        await navigator.clipboard.writeText(ref);
        success(t('images.addCopied'));
      } catch {
        // Fallback: append at the end if clipboard write was denied
        const state = store.get();
        const next = (state.content || '').replace(/\s*$/, '\n\n') + ref + '\n';
        setMarkdown(next);
        warning(t('images.addAppended'));
      }
    } catch (err) {
      error(t('images.uploadFailed', { reason: err.message }));
    }
  });

  const emptyState = h('div', { class: 'images-panel-empty' }, [
    slIcon({ name: 'images', className: 'images-panel-empty-icon' }),
    h('p', {}, [t('images.empty')]),
  ]);

  const list = h('div', { class: 'images-panel-list' }, []);

  const element = h('div', { class: 'images-panel' }, [
    h('div', { class: 'panel-header' }, [
      slIcon({ name: 'images', className: 'panel-icon' }),
      h('span', { class: 'panel-title' }, [t('images.title')]),
      h('span', { class: 'panel-subtitle text-muted images-panel-count' }, ['']),
      h('div', { class: 'panel-header-spacer' }),
      beeldbankBtn,
      addBtn,
      addInput,
    ]),
    h('div', { class: 'images-panel-body' }, [emptyState, list]),
  ]);

  const countEl = element.querySelector('.images-panel-count');

  function renderList(refs) {
    empty(list);

    if (refs.length === 0) {
      emptyState.hidden = false;
      list.hidden = true;
      countEl.textContent = '';
      return;
    }

    emptyState.hidden = true;
    list.hidden = false;
    countEl.textContent = refs.length === 1
      ? t('images.countOne')
      : t('images.countMany', { count: refs.length });

    refs.forEach((ref, index) => {
      const card = renderCard(ref, index + 1);
      list.appendChild(card);
    });
  }

  function renderCard(ref, position) {
    const swappable = isDocbotUrl(ref.url);

    const thumbWrap = h('div', { class: 'images-panel-thumb' }, [
      slSpinner({ style: 'font-size: 1rem;' }),
    ]);

    resolvePreviewUrl(ref.url).then((url) => {
      empty(thumbWrap);
      if (!url) {
        thumbWrap.appendChild(slIcon({ name: 'image-alt', className: 'images-panel-thumb-fallback' }));
        return;
      }
      thumbWrap.appendChild(
        h('img', { src: url, alt: ref.alt || '', class: 'images-panel-thumb-img', loading: 'lazy' })
      );
    });

    const replaceBtn = slButton({
      variant: 'primary',
      size: 'small',
      icon: 'arrow-repeat',
      text: t('images.replaceBtn'),
      disabled: !swappable || undefined,
      onClick: () => handleReplace(ref),
    });

    const copyBtn = slIconButton({
      name: 'clipboard',
      label: t('images.copyMarkdown'),
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(buildImageRef(ref.alt, ref.url, ref.caption));
          success(t('images.copied'));
        } catch {
          error(t('images.copyFailed'));
        }
      },
    });

    const meta = h('div', { class: 'images-panel-meta' }, [
      h('div', { class: 'images-panel-name' }, [shortLabel(ref.url)]),
      ref.count > 1 &&
        h('div', { class: 'images-panel-tag text-muted' }, [
          t('images.usedTimes', { count: ref.count }),
        ]),
      !swappable &&
        h('div', { class: 'images-panel-tag text-muted' }, [t('images.externalImage')]),
    ]);

    let fields;
    if (ref.markdown) {
      const altInput = slInput({
        size: 'small',
        value: ref.alt || '',
        label: t('images.altLabel'),
        placeholder: t('images.altPlaceholder'),
        class: 'images-panel-field',
      });
      const captionInput = slInput({
        size: 'small',
        value: ref.caption || '',
        label: t('images.captionLabel'),
        placeholder: t('images.captionPlaceholder'),
        class: 'images-panel-field',
      });
      const onChange = () => handleMetaChange(ref, altInput, captionInput);
      altInput.addEventListener('sl-change', onChange);
      captionInput.addEventListener('sl-change', onChange);
      fields = h('div', { class: 'images-panel-fields' }, [altInput, captionInput]);
    } else {
      fields = h('div', { class: 'images-panel-tag text-muted' }, [t('images.fieldsDisabled')]);
    }

    const actions = h('div', { class: 'images-panel-actions' }, [replaceBtn, copyBtn]);

    return h('div', { class: 'images-panel-card', dataset: { position: String(position) } }, [
      h('div', { class: 'images-panel-card-position' }, [`#${position}`]),
      thumbWrap,
      h('div', { class: 'images-panel-card-body' }, [meta, fields, actions]),
    ]);
  }

  function handleMetaChange(ref, altInput, captionInput) {
    const alt = altInput.value || '';
    const caption = captionInput.value || '';
    const state = store.get();
    const before = state.content || '';
    const after = rewriteImageRef(before, ref.url, { alt, caption });
    if (after === before) return;
    ref.alt = alt;
    ref.caption = caption;
    setMarkdown(after);
    success(t('images.metaUpdated'));
  }

  async function handleReplace(ref) {
    const file = await pickImageFile();
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      error(t('images.tooLarge', { max: formatFileSize(MAX_IMAGE_BYTES) }));
      return;
    }

    try {
      const data = await uploadImageFile(file);
      const newUrl = data.mediaUrl;
      const state = store.get();
      const before = state.content || '';

      if (!before.includes(ref.url)) {
        warning(t('images.refMissing'));
        return;
      }

      const after = before.split(ref.url).join(newUrl);
      setMarkdown(after);

      // Bust any cached presigned URL for the freshly uploaded key
      previewUrlCache.delete(newUrl);
      success(t('images.replaced'));
    } catch (err) {
      error(t('images.uploadFailed', { reason: err.message }));
    }
  }

  function refresh() {
    const state = store.get();
    const refs = extractImageRefs(state.content || '');
    const signature = refs.map((r) => r.url + ':' + r.count).join('|');
    if (signature === lastSignature) return;
    lastSignature = signature;
    renderList(refs);
  }

  // Re-render whenever content changes
  const unsubscribe = store.subscribe((next, prev) => {
    if (next.content !== prev.content) {
      refresh();
    }
  });

  // Initial render
  refresh();

  return {
    element,
    refresh,
    destroy: () => unsubscribe(),
  };
}
