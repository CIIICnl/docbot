# Uitwerksessie — brief voor de auth-cutover op productie

Fable

## Stand bij vertrek

2026-09-17, avond. `main` staat op `cb26b7a`: een tussensessie heeft alleen de _meta-briefing van ciiic-translation-rules afgehandeld (lockfile naar `ciiic-translation-rules@1.3.0`, gedeployed). De opdracht hieronder is nog ongedaan en blijft ongewijzigd staan. Geen open PR's, claimbord leeg, `TODO.md` heeft nog dezelfde twee items.

## Opdracht

1. Lees TODO-item 1 (`docs/plans/TODO.md`) en de auth-paragraaf van `README.md`. Breng in kaart wat `AUTH_CUTOVER=true` feitelijk verandert: `server/auth/auth.ts:30` en alles wat op `config.cutoverEnabled` hangt in `client/lib/auth.js` en `client/views/login.js`.
2. Verifieer wie er van docbot-auth afhangt en langs welke weg. `DOCBOT_INTERNAL_TOKEN` (ciiicbot, ciiic-dashboard) loopt buiten de cookie om; stel vast of dat na de cutover nog steeds zo is, en of er iets is dat wél op `sb_session` leunt.
3. Schrijf `docs/plans/briefs/auth-cutover-prod.md` volgens de briefvorm uit `werkwijze`: doel, context met `file:regel`, genummerde scope, buiten scope, en een afvinkbare acceptatie. Neem het terugdraaipad op (vlag terug naar OFF: wat is er dan kapot, wat niet) en de volgorde waarin de vlag en een eventuele redeploy aan moeten.
4. Zet TODO-item 1 om naar een verwijzing naar die brief en zet de statusregel bovenaan de brief (`Status: uitvoeringsklaar | wacht op Jaap` + datum + TODO-adres).
5. Overschrijf dit bestand (`docs/plans/HANDOFF.md`) met de opdracht voor de volgende sessie en commit dat mee.

## Doorgeefblok

- TODO-item 2 (vibekit-aanbevelingen beoordelen) wacht; delegeerbaar zodra item 1 een brief heeft.

## Terugkeer-check

(leeg)

## Extra van Jaap

(leeg)
