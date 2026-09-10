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

## Media storage (Scaleway S3 on prod)

Uploaded images (docx figures, beeldbank picks) are stored via the media
provider selected in `server/media/config.ts`. Mode comes from
`MEDIA_STORAGE_MODE` (`auto` | `scaleway` | `local`); `auto` uses Scaleway
only when `SCW_ACCESS_KEY/SECRET_KEY/BUCKET` are set, else falls back to
the **local filesystem** at `/app/server/uploads` inside the container
(ephemeral - no volume mounted, wiped on every redeploy).

**Prod runs Scaleway since 2026-06-01** and media survives redeploys:
`MEDIA_STORAGE_MODE=scaleway`, bucket `dreamslides-media` (region
`fr-par`, shared with slidecreator/beeldbank), `SCW_KEY_PREFIX=docbot/`,
creds via `SCW_*` env vars on the Coolify resource. Verified 2026-07-09
with a list+put from inside the prod container (75 objects, uploads from
that same day present). The `[media] Using Scaleway S3 provider` log line
only appears on first media use (lazy singleton), so its absence at
startup means nothing.

Unrelated lookalike: the prod env also has `STORAGE_MODE=postgres` -
that's **document** storage (drafts in Postgres), not media; the media
code doesn't read it.

## Werkwijze

Deze repo volgt de universele werkwijze (skill `werkwijze` in `~/.claude`):

- **Nu**: `docs/plans/TODO.md` — claimbord + open werk, budget < 300 regels.
- **Briefs**: `docs/plans/briefs/<slug>.md`; uitgevoerd → `docs/plans/done/`.
- **Handoff**: `/handoff` leest `docs/plans/HANDOFF.md`; elke werk-afrondende sessie overschrijft 'm en sluit af met de sluitregel.
- **Rollen**: Fable brieft en beslist; Opus voert één brief per sessie uit en merget nooit de eigen PR. Welk model een review-en-merge-sessie krijgt volgt uit `werkwijze` § Modelkeuze per sessie — niet hier vastleggen.
- **Ritmes**: `merge-housekeeping` per gedelegeerde merge; `reorg-audit` bij de drift-drempel; `tighten-scan` op aanvraag.
- **Reference** (hoe het werkt, niet wat verandert): `docs/reference/`.

Afwijkingen van de universele werkwijze: één. Dit is een **publieke** repo (`CIIICnl/docbot`, `isPrivate: false`), maar `docs/plans/` staat gewoon in-repo en getrackt in plaats van in een private planning-sibling. Reden: gekozen tijdens de headless uitrol op 2026-09-10, waar niemand de vraag kon beantwoorden; in-repo is de variant die niets kan verliezen. Wil je het deckyard-model (symlink naar een private sibling + gitignore), dan is dat een losse ingreep - kijk dan eerst of er in de plans niets staat dat niet publiek mag.

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
