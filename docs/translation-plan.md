# Multilingual document support — implementation plan

Status: planned, not yet implemented. Scope: phases 1–3.

## Problem

Today, translation is destructive:

- The actions bar has `[nl→en ▾] [Translate]`. The dropdown picks a direction; the button runs it.
- Handler in `client/views/editor/actions-bar.js` (lines 269–313) hits `/api/docx/translate` and replaces editor content via `onEnhanceComplete({ enhanced: translated, willModify: true })`.
- Unlike *Enhance*, the translate handler never sets `originalContent` (`actions-bar.js:179` does that only inside `handleEnhance`). No undo path.
- Autosave (`save-manager.js:44-71`) writes the translated content back over the same `draftId` / `serverId`. Version snapshots only happen when callers explicitly pass `createVersion: true` (see `documents.ts:202-227`); autosave PATCH does not. So the source-language original is gone from the document and from version history.
- `documents` table has no `language` column (`db/client.ts:80-93`, migration `db/migrations/001_documents.ts`). One row = one language, undeclared.
- `document_versions.reason` enum has no `'translate'`, and translate never triggers a snapshot.

## Model: linked sibling documents

One row per language, joined by a group id.

```
documents:
  + language          VARCHAR(8)   NOT NULL DEFAULT 'unknown'   -- 'nl' | 'en' | 'unknown'
  + translation_group UUID         NOT NULL                      -- shared across siblings
  + source_language   VARCHAR(8)   NULL                          -- the language this was translated FROM (null = original)
  + source_version_id UUID         NULL                          -- which version of the source this was translated from
```

A BEFORE-INSERT trigger sets `translation_group = id` when null. Translating creates a new sibling row with the same `translation_group`.

**Why this over a `translations` JSON blob on a single row:** versioning, collaboration, locking, comments all work per-language for free. Doc-list grouping is presentation-only. Easy to extend to a third language later.

**Trade-off:** the doc list eventually needs a UI tweak to collapse siblings (deferred to a later phase). Trash semantics need a decision (per-language vs whole group) — also deferred.

## UX redesign

Replace `[nl→en ▾] [Translate]` in the actions bar with a single **language chip** in the editor bar, next to the title:

```
[EN ▾] My Document
   ├─ ✓ English  (current)
   ├─   Dutch    (switch)            ← if sibling exists
   └─   Translate to Dutch…           ← if no sibling yet
```

For documents that exist today (no `language` set) the chip shows `?` and offers "Mark as Dutch / Mark as English" before any translate option — light backfill, no auto-detect.

## Decisions locked in

- **Model**: linked sibling documents.
- **Backfill**: legacy docs default to `language='unknown'`, user marks on first translate. No auto-detect.
- **Scope**: phases 1–3 only (model + API + editor chip). Doc-list grouping deferred.
- **`translation_group` initial value**: BEFORE-INSERT trigger sets `group=id`.
- **Collaborators on translate**: snapshot copy from source onto sibling at creation. No live propagation.

---

## Phase 1 — Schema + storage

### Migration `server/db/migrations/003_translations.ts`

```sql
ALTER TABLE documents
  ADD COLUMN language          VARCHAR(8)  NOT NULL DEFAULT 'unknown',  -- 'nl' | 'en' | 'unknown'
  ADD COLUMN translation_group UUID,
  ADD COLUMN source_language   VARCHAR(8),
  ADD COLUMN source_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL;

UPDATE documents SET translation_group = id WHERE translation_group IS NULL;

ALTER TABLE documents ALTER COLUMN translation_group SET NOT NULL;

CREATE INDEX idx_documents_translation_group ON documents(translation_group);

-- BEFORE-INSERT trigger so translation_group always defaults to id
CREATE OR REPLACE FUNCTION documents_set_translation_group()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.translation_group IS NULL THEN
    NEW.translation_group = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_translation_group_trigger
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION documents_set_translation_group();

-- Concurrency guard: prevent two non-trashed siblings of the same language in one group
CREATE UNIQUE INDEX idx_documents_group_lang
  ON documents(translation_group, language)
  WHERE trashed_at IS NULL AND language <> 'unknown';
```

Down migration: drop the unique index, the trigger, the function, the index, then the columns.

### Type updates

- `server/db/client.ts` `DocumentsTable`: add `language`, `translation_group`, `source_language`, `source_version_id`.
- `server/storage/documents.ts` `Document`: add `language`, `translationGroup`, `sourceLanguage`, `sourceVersionId`.
- `server/storage/document-versions.ts`: extend `VersionReason` with `'translate'`. No DB change — column is varchar.

### New storage helpers

- `listSiblings(translationGroup)` → `{ id, language, title, updatedAt }[]`, excluding trashed.
- `createSibling(source, { language, content, sourceVersionId, ownerEmail })` — inserts a new doc with the same `translation_group`. **Copies `document_collaborators` rows from the source** (snapshot at creation time).
- `setDocumentLanguage(id, ownerEmail, language)` — used for the "mark as" flow. Allow re-marking even if already known (owner's doc).
- `createDocument` defaults `language='unknown'`. The trigger handles `translation_group`.

### `UpdateDocumentInput`

Add optional `language` field. Validate `∈ {'nl','en','unknown'}` in the route.

---

## Phase 2 — Translate + sibling API

### `POST /api/documents/:id/translate`

Body: `{ targetLanguage: 'en' | 'nl', provider }`.

1. Verify owner. (Collaborator-with-editor-permission: out of scope for v1; require owner.)
2. Reject with `400 { code: 'language_unknown' }` if `document.language === 'unknown'`.
3. Reject with `400 { code: 'same_language' }` if `targetLanguage === document.language`.
4. If a sibling already exists in the group with `language === targetLanguage`, return `200 { sibling, alreadyExisted: true }` — no re-translate.
5. Snapshot the source as a `'translate'` version (so we can pin `source_version_id`).
6. Run existing `translateMarkdown`. Direction derived from source/target — `nl→en` or `en→nl`. Other pairs: error for v1.
7. `createSibling(...)` with `source_language = source.language`, `source_version_id = <snapshot id>`, content = LLM output, title = source title (user can edit later).
8. Return `201 { sibling }`.

Concurrency: the unique index `(translation_group, language)` causes a duplicate insert under race to fail. Catch the constraint error, fetch the existing sibling, return it as `alreadyExisted: true`.

### `GET /api/documents/:id/siblings`

Returns `{ siblings: [{ id, language, title, updatedAt }] }`. Includes self for simplicity; UI filters.

### `PATCH /api/documents/:id`

Extend `UpdateDocumentInput` with `language`. Same auth as today.

### Existing `/api/docx/translate` (stateless)

Stays put for ciiicbot. Add a code comment that the endpoint is non-persistent and that the editor uses the new path.

---

## Phase 3 — Editor language switcher

### New component `client/views/editor/language-switcher.js`

- Mounted in `editor-bar.js`, next to the title.
- Reads `document.language` + siblings list (one fetch on mount, refresh after translate).
- Renders a Shoelace `sl-dropdown` with the trigger showing current language as a chip:
  - `Set language ▾` if `unknown` (neutral grey)
  - `EN ▾` / `NL ▾` if known (themed accent)

### Menu states

| Doc state | Menu items |
|---|---|
| `language='unknown'` | "Mark as Dutch", "Mark as English" |
| Known, no sibling for the other language | ✓ Current language (disabled), "Translate to <other>…" |
| Known, sibling exists | ✓ Current (disabled), "Switch to <other>" → navigates to sibling. "Translate to <other>…" hidden in this case. |

### Translate flow from the chip

1. Confirmation dialog: "Translate <Title> from English to Dutch? This creates a linked document; the original stays as-is. [Cancel] [Translate]".
2. `saveManager.flush()` (so the source captures any pending edits before the snapshot).
3. `POST /api/documents/<serverId>/translate`. Show loading toasts (reuse existing `loading.translatingNlEn` / `EnNl` strings).
4. On success, `navigate('/edit/<sibling.id>')`. Existing `loadOrCreateDraftForServerId` (`drafts.js:322`) seeds the local draft cleanly.
5. On `alreadyExisted`, navigate + show "Already translated — opening it".

### Sibling switch

`navigate('/edit/<sibling.id>')`. Editor unmounts (saves), remounts on the sibling.

### Mark-as flow

`PATCH /api/documents/<serverId> { language: 'nl' }` → on success, refresh chip + sibling list.

### Removals from `actions-bar.js`

- `translateDirectionSelect`, `translateBtn`, `translateGroup`, `handleTranslate`. Bar becomes: Enhance | spacer | Export PDF/HTML.

### Local-only drafts (no `serverId`)

Chip is disabled with tooltip "Save to enable translation" — translate requires server-side persistence to create siblings. Drafts auto-create on the server when sync is enabled, so this is rare.

### i18n strings to add

`client/locales/en.js` and `nl.js`:

- `language.set`, `language.markDutch`, `language.markEnglish`
- `language.translateTo` (`{lang}` interpolated), `language.switchTo`
- `language.translateConfirmTitle`, `language.translateConfirmBody`
- `language.alreadyExists`, `language.unknownBlocked`, `language.savePrompt`

---

## Edge cases

| Case | Decision |
|---|---|
| LLM fails mid-translate after version snapshot | Source keeps the orphan snapshot. Acceptable. User can retry. |
| Two clients translate the same doc concurrently | Unique index on `(translation_group, language)` causes the second insert to fail; API catches it and returns the existing sibling. |
| Sibling exists but user clicks "Translate" anyway | Server returns existing one, UI navigates with toast — no second LLM call. |
| Collaborators on the source | Sibling copies `document_collaborators` rows from source at create time. Future changes don't propagate (out of scope). |
| Trashing one sibling | No special logic. Group stays valid with one fewer member. |
| Re-marking `language` after it's set | Allowed — owner's doc. Lockable in a later phase if it causes confusion. |
| DOCX/Notion/Markdown imports | Created as `language='unknown'`, prompted by chip. |
| `language` enum | Loose varchar for now (no CHECK constraint). Tighten later if a third language enters. |

---

## Files touched (preview)

**New**

- `server/db/migrations/003_translations.ts`
- `client/views/editor/language-switcher.js`

**Edited (server)**

- `server/db/client.ts` — extend `DocumentsTable`
- `server/storage/documents.ts` — extend `Document`, `createDocument`, add `listSiblings`, `createSibling`, `setDocumentLanguage`, accept `language` in `UpdateDocumentInput`
- `server/storage/document-versions.ts` — add `'translate'` to `VersionReason`
- `server/routes/api/documents.ts` — `POST /:id/translate`, `GET /:id/siblings`, accept `language` in PATCH

**Edited (client)**

- `client/views/editor/editor-bar.js` — slot for the switcher
- `client/views/editor/index.js` — wire up switcher, handle sibling navigation, expose serverId
- `client/views/editor/actions-bar.js` — remove translate group + handler
- `client/locales/en.js`, `client/locales/nl.js` — new strings

---

## Out of scope (deferred)

- Doc-list grouping (siblings shown as one card with language chips).
- Sibling-aware trash UX ("delete this language only" vs whole group).
- Auto-detect language, third-language support.
- "Source updated since translation" stale indicator.
- Granting collaborator access to translate (currently owner-only).
