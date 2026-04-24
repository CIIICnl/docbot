# CLAUDE.md — DreamDocs / Docbot

Converts Notion pages, Markdown, and DOCX into themed PDF/HTML documents.
Deployed as **Docbot** at `docs.ciiic.nl`.

- **Server:** `51.158.116.31` (shared CIIIC apps box)
- **Path on server:** `/opt/docbot`
- **Runs as:** Docker container behind Caddy

## Deploy

```bash
ssh root@51.158.116.31 "cd /opt/docbot && git pull origin main && docker compose up -d --build"
```

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
