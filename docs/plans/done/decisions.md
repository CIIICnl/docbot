# Beslissingen

Genomen beslissingen, nieuwste bovenaan. Eén regel per beslissing, met datum en waar het bewijs staat.

- **2026-01 (bij benadering) - client-build via esbuild in plaats van vendored Shoelace.** De vibekit-basis serveerde client-code als rauwe ES modules met gekopieerde Shoelace-bestanden; die bevatten bare imports die de browser niet kan resolven. Docbot bundelt sindsdien met `scripts/build-client.js` (esbuild). Achtergrond: `../briefs/vibekit-aanbevelingen.md`.
- **2026-07-15 - de auth-cutover landt achter een vlag, niet als big bang.** `AUTH_CUTOVER` (default OFF) schakelt tussen het oude gedeelde `sb_session`-model en het schone eindbeeld met host-only `doc_session`. Zelfde patroon als beeldbank #39. Commit `83aa76e`.
