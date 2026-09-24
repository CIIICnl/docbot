# Uitvoersessie - AUTH_CUTOVER aanzetten op productie

uitvoer

## Stand bij vertrek

2026-09-17, avond. `main` staat op de merge van `brief/auth-cutover-prod` (planning-docs, geen code). Geen open PR's, claimbord leeg. `TODO.md` heeft drie items; item 1 verwijst naar `docs/plans/briefs/auth-cutover-prod.md`, item 3 is nieuw (legacy-code weg ná de familie-brede flip). Productie draait de vlag-code al met `AUTH_CUTOVER` uit (`/api/auth/config` geeft `cutoverEnabled:false`); slides, beeldbank en ai staan ook nog uit. `.claude/settings.local.json` is lokaal gewijzigd en hoort niet in een commit.

## Opdracht

1. Lees `docs/plans/briefs/auth-cutover-prod.md` helemaal, daarna het blok "Extra van Jaap" hieronder. De brief heeft drie keuzes onder § Wacht op Jaap (venster, alleen of samen, rollback-test). Staat er hieronder geen antwoord op alle drie, dan voer je alleen scope-stap 1 (pre-flight) en scope-stap 5 (README-alinea) uit, op een branch `feat/auth-cutover-prod`, en meld je in de PR-body en in je antwoord dat de flip wacht op die antwoorden. Niet flippen zonder antwoord.
2. Zijn de drie keuzes beantwoord: voer de scope van de brief uit in de volgorde die daar staat (pre-flight, vlag zetten, redeploy, verifiëren 3a t/m 3e, alleen bij rood terugdraaien). Stap 3d vraagt Jaap zelf (2FA-login via de kaart); vraag hem daar op dat moment om en ga niet verder zonder die check. Coolify via skill `ciiic-coolify`; het service-token voor stap 3e alleen uit de Coolify-env lezen, nooit in een bestand, log of PR zetten.
3. Eén PR op `feat/auth-cutover-prod` met de README-alinea (scope-stap 5) en, als de flip is gedaan, de write-up in `docs/plans/done/2026-09.md`, item 1 afgevinkt in `TODO.md` en het nummer in `done/register.md`. Zet de meetresultaten van stap 3a t/m 3e letterlijk in de PR-body (statuscodes, de twee `Set-Cookie`-regels zonder de tokenwaarde). Eigen PR nooit mergen.
4. Journal-entry in `JAAP-KB/journal/` met de regel `KB-suggestie: CIIIC-KB applications/docbot.md § Auth - beschrijft sb_session/Domain=.ciiic.nl, na de flip is dat doc_session host-only`.
5. Overschrijf dit bestand (`docs/plans/HANDOFF.md`) met de opdracht voor de volgende sessie: de review-en-merge-sessie voor de PR uit stap 3 (rol `stuur`), met het doorgeefblok hieronder erin, en commit dat mee op de branch.

## Doorgeefblok

- Als Jaap bij keuze 2 "samen" kiest: beeldbank en ciiicbot hebben elk een eigen sessie nodig voor dezelfde flip in hun repo (spaak → briefing of Jaap start daar); slides als laatste. Dat is niet het werk van deze sessie.
- Los van deze opdracht (2026-09-24): PR #17 (Notion-afbeeldingen rehosten) is gemerged en gedeployd (`fd62a0b`), maar de productiecheck uit de _meta-briefing `2026-09-23--from-ciiic-handboek--to-docbot--notion-afbeeldingen-rehosten` is nog niet gedaan: op docs.ciiic.nl een Notion-pagina met geüploade afbeelding importeren, controleren dat de markdown `docbot://media/` bevat en geen `amazonaws`, na >1 uur de PDF exporteren. Daarna de briefing sluiten met bewijs.
- TODO-item 2 (vibekit-aanbevelingen beoordelen) is delegeerbaar en wacht op een eigen uitvoersessie.
- TODO-item 3 (legacy-code verwijderen) wacht op item 1 én de slides-flip; nog geen brief.

## Terugkeer-check

(leeg)

## Extra van Jaap

(leeg)
