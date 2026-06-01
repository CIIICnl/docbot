# CLAUDE.md — DreamDocs / Docbot

Converts Notion pages, Markdown, and DOCX into themed PDF/HTML documents.
Deployed as **Docbot** at `docs.ciiic.nl`.

- **Server:** `51.15.131.87` (CIIIC Coolify box on Scaleway). The old
  shared apps box `51.158.116.31` / `/opt/docbot` is **dead** - that
  container exited and is no longer serving traffic.
- **Runs as:** a Coolify application named `docbot` (project CIIIC, FQDN
  `docs.ciiic.nl`, behind the `coolify-proxy` Traefik). Container is
  named with a Coolify UUID prefix (`ost5ze3ynm0i0swy3q77403c-…`), not
  `docbot` - filter by `COOLIFY_FQDN=docs.ciiic.nl` / `coolify.resourceName=docbot`.
- **Postgres:** `host.docker.internal:5432`, DB `dreamslides` (the app's
  own DB; the `STORAGE_MODE=postgres` env var is about document storage,
  not media - see Media storage below).

## Deploy

Git-push-to-deploy via the Coolify GitHub App. Push to `main` on
`CIIICnl/docbot` and Coolify builds + redeploys automatically:

```bash
git push origin main   # → Coolify rebuilds docs.ciiic.nl
```

To inspect/redeploy by hand: `ssh root@51.15.131.87`, then
`docker ps --filter label=coolify.resourceName=docbot`. Redeploy from
the Coolify UI/API, not `docker compose` (there is no compose file there).

## Media storage (IMPORTANT - ephemeral by default)

Uploaded images (docx figures, beeldbank picks) are stored via the media
provider selected in `server/media/config.ts`. Mode comes from
`MEDIA_STORAGE_MODE` (`auto` | `scaleway` | `local`); `auto` uses Scaleway
only when `SCW_ACCESS_KEY/SECRET_KEY/BUCKET` are set, else falls back to
the **local filesystem** at `/app/server/uploads` inside the container.

On prod (as of 2026-06-01) none of those are set, so docbot logs
`[media] Using local filesystem provider` and writes to
`/app/server/uploads` with **no volume mounted** (`docker inspect … .Mounts`
is empty). Every Coolify redeploy creates a fresh container, so all
previously-uploaded media is lost. Saved markdown keeps its
`docbot://media/<key>` refs; on re-render `resolveMediaUrl` calls
`provider.exists(key)` → false → the ref is left literal → the image
renders blank. This is why images vanish from re-rendered documents.

Fix (pick one): give the app a **persistent volume** mounted at
`/app/server/uploads` (or set `UPLOADS_DIR` to a mounted path) via Coolify
persistent storage; **or** switch to Scaleway by setting
`MEDIA_STORAGE_MODE=scaleway` + `SCW_*` creds (durable, survives server
moves). Note the prod env currently has a typo'd `STORAGE_MODE` that the
media code does not read - the correct key is `MEDIA_STORAGE_MODE`.

## Shared knowledge base

Cross-project CIIIC background lives in the **[CIIIC-KB](../CIIIC-KB/)**
Obsidian vault (`../CIIIC-KB/`, mirrored to `CIIICnl/CIIIC-KB` on GitHub).
Read `../CIIIC-KB/_index.md` for the full map.

| Path | Load when |
|---|---|
| `../CIIIC-KB/applications/docbot.md` | Background briefing on this app — input formats, theme system, auth model |
| `../CIIIC-KB/systems/notion-architecture.md` | The Notion import path — page structure, block types, integration access model |
| `../CIIIC-KB/organization/ciiic-overview.md` | Context on CIIIC if working on CIIIC-themed output (branding, audiences) |

## Notion API (SDK v5 / 2025-09-03)

See Jaap's global `~/.claude/CLAUDE.md` for the database/data_source
split and property-format rules. This app consumes Notion pages, so the
retrieve-database-then-query pattern applies anywhere we list children
or query a database.

If you learn something broader that belongs in the KB (a Notion block
type gotcha, a shared theming convention), update
`../CIIIC-KB/applications/docbot.md` directly instead of duplicating here.
