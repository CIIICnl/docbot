/**
 * Beeldbank picker — embeds the external image library
 * (beeldbank.ciiic.nl/picker by default) as an iframe and listens for a
 * postMessage handshake. The selected image's ImageKit URL, alt text and
 * caption are handed back via onPick; the URL is referenced directly (no
 * re-upload), like Notion external images.
 *
 * postMessage protocol (beeldbank.ciiic.nl/picker):
 *   { type: 'imagekit-picker-select', payload: {
 *       url, fileId, name, width, height, tags,
 *       altText, caption, project, projectMaker, usagePolicy, notionEventId, thumbnail
 *   } }
 *   { type: 'imagekit-picker-cancel' }
 *
 * The picker posts its result to a parentOrigin; we pass our own origin as a
 * query param so beeldbank knows where to send it (it validates against its
 * own allowlist).
 */

import { h } from '../../lib/dom.js';
import { openModal } from '../../lib/modal.js';
import { t } from '../../lib/i18n.js';

export function openBeeldbankPicker({ pickerUrl, title, onPick } = {}) {
  if (!pickerUrl || typeof pickerUrl !== 'string') {
    throw new Error('openBeeldbankPicker: pickerUrl is required');
  }

  const modalTitle = title || t('images.beeldbankTitle');

  // Only accept messages from the picker's own origin.
  let allowedOrigin = null;
  try {
    allowedOrigin = new URL(pickerUrl, window.location.href).origin;
  } catch {
    allowedOrigin = null;
  }

  // Tell the picker which parent origin to post results back to.
  let src = pickerUrl;
  try {
    const u = new URL(pickerUrl, window.location.href);
    u.searchParams.set('parentOrigin', window.location.origin);
    src = u.toString();
  } catch {
    /* keep pickerUrl unchanged */
  }

  let closed = false;

  const handleSelect = (payload) => {
    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    if (url) {
      onPick?.({
        url,
        fileId: typeof payload?.fileId === 'string' ? payload.fileId : '',
        altText: typeof payload?.altText === 'string' ? payload.altText : '',
        caption: typeof payload?.caption === 'string' ? payload.caption : '',
        tags: Array.isArray(payload?.tags) ? payload.tags : [],
      });
    }
    modal.close();
  };

  const onMessage = (event) => {
    if (closed) return;
    if (allowedOrigin && event.origin !== allowedOrigin) return;
    const data = event?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'imagekit-picker-cancel') {
      modal.close();
      return;
    }
    if (data.type === 'imagekit-picker-select') {
      handleSelect(data.payload || {});
    }
  };

  const modal = openModal(h, document.body, {
    title: modalTitle,
    modalClass: 'beeldbank-modal',
    onClose: () => {
      closed = true;
      window.removeEventListener('message', onMessage);
    },
  });

  const iframe = h('iframe', {
    class: 'beeldbank-iframe',
    src,
    title: modalTitle,
    allow: 'clipboard-read; clipboard-write',
  });
  modal.content.append(iframe);

  window.addEventListener('message', onMessage);

  return modal;
}
