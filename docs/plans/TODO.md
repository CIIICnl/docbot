# TODO — docbot

Regels (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; de nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als"; meer nodig → `briefs/<slug>.md`. Budget: < 300 regels. Geshipt verdwijnt: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

(leeg)

## Open werk

### 1. AUTH_CUTOVER aanzetten op productie

De harde auth-cutover zit sinds #16 in de code achter `AUTH_CUTOVER` (default OFF, `server/auth/auth.ts:30`). Vlag ON schakelt docbot naar host-only `doc_session`, zet de oude login-routes op 410 en laat alleen de `<ciiic-login app=Docs>`-kaart staan. Prod draait nog OFF, dus het eindbeeld van traject 04 is nog niet bereikt. Vraagt een brief: volgorde, wie er hinder van heeft (ciiicbot en ciiic-dashboard gebruiken `DOCBOT_INTERNAL_TOKEN`, niet de cookie, maar dat moet geverifieerd) en het terugdraaipad.

Klaar als: `AUTH_CUTOVER=true` staat op de Coolify-resource `docbot`, inloggen op docs.ciiic.nl gaat via de CIIIC-kaart, de oude login-routes geven 410, en niemand is buitengesloten.

### 2. Beoordelen wat er van de vibekit-aanbevelingen nog geldt **[delegeerbaar]**

`briefs/vibekit-aanbevelingen.md` is het herkomst-document van de vibekit-basis waarop docbot is gebouwd. Het kritieke punt (Shoelace bare imports) is opgelost met de esbuild-bundelstap in `scripts/build-client.js`. De rest is nooit beslist: dode demo-code, form-helpers, dubbele path-matching, client zonder TypeScript.

Klaar als: per aanbeveling in de brief staat "geldt nog / opgelost / niet doen (reden)"; wat blijft staan is een eigen TODO-item geworden, en de brief is naar `done/` verplaatst.

## Recently done

- 2026-09-17 - `ciiic-translation-rules` van 1.0.0 naar 1.3.0 in de lockfile (`cb26b7a`), na _meta-briefing van ciiic-translation-rules. Alleen de lockfile hing vast; de range `^1.0.0` dekte 1.3.0 al.
