/**
 * Draft Management
 * LocalStorage-based draft saving with server API sync when online.
 */

import { STORAGE_KEYS, DEFAULTS } from './constants.js';

// API sync state
let syncEnabled = false;
let syncInProgress = false;
let pendingSyncs = new Map(); // draftId -> pending update

/**
 * Check if server API is available
 * @returns {Promise<boolean>}
 */
async function checkApiAvailable() {
  try {
    const resp = await fetch('/api/documents?limit=1', { method: 'GET' });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Enable server sync (called when database mode is detected)
 */
export function enableSync() {
  syncEnabled = true;
}

/**
 * Disable server sync
 */
export function disableSync() {
  syncEnabled = false;
}

/**
 * Check if sync is enabled
 * @returns {boolean}
 */
export function isSyncEnabled() {
  return syncEnabled;
}

/**
 * Sync a draft to the server
 * @param {Object} draft - Draft to sync
 * @returns {Promise<Object|null>} Synced document or null
 */
async function syncDraftToServer(draft) {
  if (!syncEnabled || !draft.serverId) return null;

  try {
    const resp = await fetch(`/api/documents/${draft.serverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: draft.title,
        content: draft.content,
        settings: draft.settings,
        aiChanges: draft.aiChanges,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.document;
    }
  } catch (err) {
    console.warn('[drafts] Failed to sync to server:', err);
  }
  return null;
}

/**
 * Create a draft on the server
 * @param {Object} draft - Draft to create
 * @returns {Promise<string|null>} Server document ID or null
 */
async function createDraftOnServer(draft) {
  if (!syncEnabled) return null;

  try {
    const resp = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: draft.title,
        content: draft.content,
        settings: draft.settings,
        aiChanges: draft.aiChanges,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.document?.id || null;
    }
  } catch (err) {
    console.warn('[drafts] Failed to create on server:', err);
  }
  return null;
}

/**
 * Delete a draft from the server
 * @param {string} serverId - Server document ID
 * @returns {Promise<boolean>}
 */
async function deleteDraftFromServer(serverId) {
  if (!syncEnabled || !serverId) return false;

  try {
    const resp = await fetch(`/api/documents/${serverId}`, {
      method: 'DELETE',
    });
    return resp.ok;
  } catch (err) {
    console.warn('[drafts] Failed to delete from server:', err);
    return false;
  }
}

/**
 * Fetch documents from server and merge with local drafts
 * @returns {Promise<Array>} Merged draft list
 */
export async function syncFromServer() {
  if (!syncEnabled) return getDrafts();

  try {
    const resp = await fetch('/api/documents');
    if (!resp.ok) return getDrafts();

    const data = await resp.json();
    const serverDocs = data.documents || [];
    const localDrafts = getDrafts();

    // Create a map of server docs by ID
    const serverMap = new Map(serverDocs.map((d) => [d.id, d]));

    // Update local drafts with server data
    const mergedDrafts = [];
    const seenServerIds = new Set();

    // First, update existing local drafts with server versions
    for (const local of localDrafts) {
      if (local.serverId && serverMap.has(local.serverId)) {
        const server = serverMap.get(local.serverId);
        seenServerIds.add(local.serverId);

        // Compare timestamps, use newer version
        const localTime = new Date(local.modifiedAt || local.savedAt || 0).getTime();
        const serverTime = new Date(server.updatedAt).getTime();

        if (serverTime > localTime) {
          // Server is newer, update local
          mergedDrafts.push({
            ...local,
            title: server.title,
            content: server.content,
            settings: server.settings,
            aiChanges: server.aiChanges,
            modifiedAt: server.updatedAt,
          });
        } else if (localTime > serverTime) {
          // Local is newer, sync to server
          mergedDrafts.push(local);
          syncDraftToServer(local);
        } else {
          mergedDrafts.push(local);
        }
      } else if (!local.serverId) {
        // Local-only draft, try to create on server
        const serverId = await createDraftOnServer(local);
        mergedDrafts.push({
          ...local,
          serverId,
        });
      } else {
        // Draft has serverId but not on server (deleted remotely)
        // Keep locally for safety, but mark as local-only
        mergedDrafts.push({
          ...local,
          serverId: null,
        });
      }
    }

    // Add server docs that don't exist locally
    for (const server of serverDocs) {
      if (!seenServerIds.has(server.id)) {
        mergedDrafts.push({
          id: `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          serverId: server.id,
          title: server.title,
          content: server.content,
          settings: server.settings,
          aiChanges: server.aiChanges,
          createdAt: server.createdAt,
          modifiedAt: server.updatedAt,
        });
      }
    }

    // Sort by modified date
    mergedDrafts.sort((a, b) => {
      const aTime = new Date(a.modifiedAt || a.savedAt || 0).getTime();
      const bTime = new Date(b.modifiedAt || b.savedAt || 0).getTime();
      return bTime - aTime;
    });

    // Save merged list to localStorage
    saveDrafts(mergedDrafts);

    return mergedDrafts;
  } catch (err) {
    console.warn('[drafts] Failed to sync from server:', err);
    return getDrafts();
  }
}

/**
 * Import all localStorage drafts to server
 * @returns {Promise<{imported: Array, failed: Array}>}
 */
export async function importLocalDraftsToServer() {
  const localDrafts = getDrafts().filter((d) => !d.serverId);

  if (localDrafts.length === 0) {
    return { imported: [], failed: [] };
  }

  try {
    const resp = await fetch('/api/documents/import-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafts: localDrafts }),
    });

    if (!resp.ok) {
      return { imported: [], failed: localDrafts.map((d) => ({ localId: d.id, error: 'API error' })) };
    }

    const result = await resp.json();

    // Update local drafts with server IDs
    const drafts = getDrafts();
    for (const item of result.imported || []) {
      const idx = drafts.findIndex((d) => d.id === item.localId);
      if (idx !== -1) {
        drafts[idx].serverId = item.id;
      }
    }
    saveDrafts(drafts);

    return result;
  } catch (err) {
    console.warn('[drafts] Failed to import to server:', err);
    return { imported: [], failed: localDrafts.map((d) => ({ localId: d.id, error: String(err) })) };
  }
}

/**
 * Get all saved drafts
 * @returns {Array} Array of draft objects
 */
export function getDrafts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save drafts to localStorage
 * @param {Array} drafts - Array of draft objects
 */
export function saveDrafts(drafts) {
  localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
}

/**
 * Get a draft by ID
 * @param {string} draftId - Draft ID
 * @returns {Object|null} The draft or null if not found
 */
export function getDraftById(draftId) {
  const drafts = getDrafts();
  return drafts.find((d) => d.id === draftId) || null;
}

/**
 * Find a draft whose serverId matches the given UUID. Used when an
 * incoming /edit/:id route carries a server document UUID rather than
 * a local draft id (e.g. when ciiicbot saves a doc via the internal
 * API and links the user straight to the editor).
 * @param {string} serverId - Server document UUID
 * @returns {Object|null}
 */
export function findDraftByServerId(serverId) {
  const drafts = getDrafts();
  return drafts.find((d) => d.serverId === serverId) || null;
}

/**
 * Hydrate a localStorage draft from a server document. Used when a
 * server UUID is opened directly (no matching local draft exists yet)
 * — typically after an external save (ciiicbot) lands the user on
 * /edit/<uuid>. Idempotent: if a matching draft already exists by
 * serverId it's returned as-is. Otherwise fetches /api/documents/:id,
 * builds a draft with `serverId` set, persists it, and returns it.
 * Returns null when sync is disabled or the server doc isn't found.
 * @param {string} serverId
 * @returns {Promise<Object|null>}
 */
export async function loadOrCreateDraftForServerId(serverId) {
  const existing = findDraftByServerId(serverId);
  if (existing) return existing;
  if (!syncEnabled) return null;

  try {
    const resp = await fetch(`/api/documents/${serverId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const doc = data.document;
    if (!doc) return null;

    const drafts = getDrafts();
    const now = new Date().toISOString();
    const draft = {
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: doc.title || 'Untitled',
      content: doc.content || '',
      createdAt: doc.createdAt || now,
      modifiedAt: doc.updatedAt || now,
      settings: doc.settings || {
        themeId: DEFAULTS.THEME,
        generateToc: true,
        pageNumbers: true,
        coverPage: false,
        coverPageOptions: { subtitle: '', version: '', date: '' },
      },
      aiChanges: doc.aiChanges || null,
      serverId,
    };
    drafts.unshift(draft);
    saveDrafts(drafts);
    return draft;
  } catch (err) {
    console.warn('[drafts] Failed to hydrate from server:', err);
    return null;
  }
}

/**
 * Create a new draft with default settings
 * @param {Object} options
 * @param {string} options.title - Draft title
 * @param {string} options.content - Draft content
 * @param {Object} [options.settings] - Optional settings
 * @param {Object} [options.aiChanges] - AI enhancement changes/suggestions to show
 * @returns {Promise<Object>} The created draft
 */
export async function createDraft({ title, content, settings = {}, aiChanges = null }) {
  const drafts = getDrafts();
  const now = new Date().toISOString();
  const id = `draft_${Date.now()}`;

  const draft = {
    id,
    title: title.trim() || 'Untitled',
    content: content || '',
    createdAt: now,
    modifiedAt: now,
    settings: {
      themeId: settings.themeId || DEFAULTS.THEME,
      generateToc: settings.generateToc !== false,
      pageNumbers: settings.pageNumbers !== false,
      coverPage: settings.coverPage !== false,
      coverPageOptions: settings.coverPageOptions || {
        subtitle: '',
        version: '',
        date: '',
      },
      pageBreakBeforeH1:
        settings.pageBreakBeforeH1 ?? settings.pageBreakHeadings === true,
      pageBreakBeforeH2:
        settings.pageBreakBeforeH2 ?? settings.pageBreakHeadings === true,
    },
    // Store AI changes to display in editor (one-time, cleared after viewing)
    aiChanges: aiChanges || null,
    // Server document ID (if synced)
    serverId: null,
  };

  // Try to create on server first
  if (syncEnabled) {
    const serverId = await createDraftOnServer(draft);
    if (serverId) {
      draft.serverId = serverId;
    }
  }

  drafts.unshift(draft);

  // Keep only last N drafts
  if (drafts.length > DEFAULTS.MAX_DRAFTS) {
    drafts.length = DEFAULTS.MAX_DRAFTS;
  }

  saveDrafts(drafts);
  return draft;
}

/**
 * Save a new draft or update existing one with same title
 * @param {Object} options
 * @param {string} options.title - Draft title
 * @param {string} options.content - Draft content
 * @returns {Object} The saved draft
 * @deprecated Use createDraft or updateDraft instead
 */
export function saveDraft({ title, content }) {
  const drafts = getDrafts();
  const draftTitle = title.trim() || 'Untitled';
  const now = new Date();
  const id = `draft_${Date.now()}`;

  // Check if a draft with same title exists
  const existingIndex = drafts.findIndex((d) => d.title === draftTitle);
  const draft = {
    id,
    title: draftTitle,
    content,
    savedAt: now.toISOString(),
    modifiedAt: now.toISOString(),
  };

  if (existingIndex >= 0) {
    drafts[existingIndex] = draft;
  } else {
    drafts.unshift(draft);
  }

  // Keep only last N drafts
  if (drafts.length > DEFAULTS.MAX_DRAFTS) {
    drafts.length = DEFAULTS.MAX_DRAFTS;
  }

  saveDrafts(drafts);
  return draft;
}

/**
 * Update an existing draft by ID
 * @param {string} draftId - Draft ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} The updated draft or null if not found
 */
export function updateDraft(draftId, updates) {
  const drafts = getDrafts();
  const index = drafts.findIndex((d) => d.id === draftId);

  if (index === -1) return null;

  const draft = drafts[index];
  const now = new Date().toISOString();

  // Update fields
  if (updates.title !== undefined) draft.title = updates.title;
  if (updates.content !== undefined) draft.content = updates.content;
  if (updates.settings !== undefined) {
    draft.settings = { ...draft.settings, ...updates.settings };
  }
  if ('aiChanges' in updates) draft.aiChanges = updates.aiChanges;
  draft.modifiedAt = now;

  drafts[index] = draft;
  saveDrafts(drafts);

  // Sync to server in background (don't await)
  if (syncEnabled && draft.serverId) {
    syncDraftToServer(draft).catch((err) => {
      console.warn('[drafts] Background sync failed:', err);
    });
  }

  return draft;
}

/**
 * Delete a draft by ID
 * @param {string} draftId - Draft ID to delete
 */
export function deleteDraft(draftId) {
  const drafts = getDrafts();
  const draft = drafts.find((d) => d.id === draftId);

  // Delete from server in background if synced
  if (syncEnabled && draft?.serverId) {
    deleteDraftFromServer(draft.serverId).catch((err) => {
      console.warn('[drafts] Failed to delete from server:', err);
    });
  }

  const filtered = drafts.filter((d) => d.id !== draftId);
  saveDrafts(filtered);
}

/**
 * Check if there are any saved drafts
 * @returns {boolean}
 */
export function hasDrafts() {
  return getDrafts().length > 0;
}

/**
 * Get a preview of draft content
 * @param {Object} draft - Draft object
 * @param {number} maxLength - Maximum length of preview
 * @returns {string} Preview text
 */
export function getDraftPreview(draft, maxLength = 150) {
  if (!draft?.content) return '';

  // Remove markdown syntax for cleaner preview
  let preview = draft.content
    .replace(/^#{1,6}\s+/gm, '') // Remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\n+/g, ' ') // Collapse newlines
    .trim();

  if (preview.length > maxLength) {
    preview = preview.slice(0, maxLength).trim() + '...';
  }

  return preview;
}
