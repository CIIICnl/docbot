# TODO — docbot

Regels (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; de nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als"; meer nodig → `briefs/<slug>.md`. Budget: < 300 regels. Geshipt verdwijnt: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

(leeg)

## Open werk

### 1. AUTH_CUTOVER aanzetten op productie

Brief: `briefs/auth-cutover-prod.md` (uitvoeringsklaar 2026-09-17; wacht op Jaap voor het venster en drie keuzes, zie § Wacht op Jaap daar). Geen code: env-var op de Coolify-resource `docbot` plus redeploy. Afnemers via `DOCBOT_INTERNAL_TOKEN` (ciiicbot, ciiic-dashboard, ciiic-mcp) zijn geverifieerd en hebben geen hinder; de enige hinder is dat een docs-login het gedeelde `sb_session` laat verlopen zolang slides, beeldbank en ai nog niet om zijn.

Klaar als: `AUTH_CUTOVER=true` staat op de Coolify-resource `docbot` en is gedeployed, `/api/auth/config` geeft `cutoverEnabled:true`, de oude login-routes geven 410, inloggen gaat via de CIIIC-kaart met een host-only `doc_session`, de bearer-paden werken nog, en niemand van het kernteam is buitengesloten.

### 2. Beoordelen wat er van de vibekit-aanbevelingen nog geldt **[delegeerbaar]**

`briefs/vibekit-aanbevelingen.md` is het herkomst-document van de vibekit-basis waarop docbot is gebouwd. Het kritieke punt (Shoelace bare imports) is opgelost met de esbuild-bundelstap in `scripts/build-client.js`. De rest is nooit beslist: dode demo-code, form-helpers, dubbele path-matching, client zonder TypeScript.

Klaar als: per aanbeveling in de brief staat "geldt nog / opgelost / niet doen (reden)"; wat blijft staan is een eigen TODO-item geworden, en de brief is naar `done/` verplaatst.

### 3. Legacy login-code verwijderen na de familie-brede cutover

Wacht op item 1 én op de flip van slides (de laatste van de familie, `../jaap-work/docs/roadmap/04-cutover-runbook.md`). Daarna is de vlag dood gewicht: het `sb_session`-pad in `server/auth/auth.ts`, de wachtwoord-, magic-link- en reset-routes (`server/routes/api/auth.ts`, `magic-link.ts`, `password-reset.ts`) en het oude formulier in `client/views/login.js`. Nog geen brief; pas schrijven als item 1 geland is.

Klaar als: `AUTH_CUTOVER` en `sb_session` komen niet meer voor in `server/` en `client/`, de acht 410-routes bestaan niet meer, `README.md` § Auth en `.env.example` beschrijven alleen de ZITADEL-login, en de build en de checks zijn groen.

## Recently done

- 2026-09-24 - Notion-import rehost `file`-afbeeldingen en cover naar media-storage (PR #17, `fd62a0b`, gedeployd), na _meta-briefing van ciiic-handboek. Op productie geverifieerd met een Notion-import (`docbot://media/`-URL); briefing gesloten.
- 2026-09-17 - `ciiic-translation-rules` van 1.0.0 naar 1.3.0 in de lockfile (`cb26b7a`), na _meta-briefing van ciiic-translation-rules. Alleen de lockfile hing vast; de range `^1.0.0` dekte 1.3.0 al.
