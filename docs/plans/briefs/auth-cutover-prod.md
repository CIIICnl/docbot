# AUTH_CUTOVER aanzetten op productie (docs.ciiic.nl)

Status: uitvoeringsklaar, wacht op Jaap voor het venster en drie keuzes (§ Wacht op Jaap) - 2026-09-17 - TODO #1 - hangt samen met `jaap-work/docs/roadmap/04-cutover-runbook.md` (flip-dag, familie-brede volgorde), `monitor/docs/plans/TODO.md` #4 (zelfde vlag daar), en CIIIC-KB `applications/docbot.md` § Auth (beschrijft het oude cookie-model).

## Doel

Docbot draait op productie nog in het oude auth-model: het gedeelde `sb_session`-cookie op `Domain=.ciiic.nl` plus wachtwoord- en magic-link-login. Het eindbeeld van traject 04 zit sinds PR #16 (`83aa76e`) in de code achter de vlag `AUTH_CUTOVER`, default OFF. Deze brief zet die vlag op productie om: docbot krijgt een eigen host-only cookie `doc_session`, de oude login-routes gaan dicht (410) en de inlogpagina toont alleen nog de CIIIC-kaart (ZITADEL, 2FA). Er verandert geen regel code; het is een env-var op de Coolify-resource `docbot` plus een redeploy, met een terugdraaipad van dezelfde vorm.

## Context

### Wat de vlag feitelijk doet

Alle verwijzingen zijn gecontroleerd op `main` `e283a3a` (2026-09-17).

- **Uitlezen.** `authCutoverEnabled()` leest `process.env.AUTH_CUTOVER` bij elke aanroep (`server/auth/auth.ts:29-34`; `1`, `true` of `yes` telt als aan). Er is geen boot-time cache, maar de omgeving van een draaiende container verandert alleen bij een herstart: een env-wijziging in Coolify heeft dus **een redeploy nodig** om te landen. Geen build-argument, geen code-wijziging.
- **Cookie-naam en -domein.** `sessionCookieName()` geeft `doc_session` in plaats van `sb_session` (`server/auth/auth.ts:37-39`). Bij het minten valt het `Domain`-attribuut weg zodat het cookie host-only is (`server/auth/auth.ts:363-374`), en gaat er een tweede `Set-Cookie` mee die het oude `sb_session` op `Domain=.ciiic.nl` laat verlopen (`buildLegacyClearCookie`, `server/auth/auth.ts:46-58`, aangeroepen op `:380` en bij uitloggen op `:402`). Het HMAC-formaat en `AUTH_SECRET` blijven gelijk.
- **Verifiëren.** `getUserFromRequest` en `getUserFromRequestAsync` lezen uitsluitend het cookie met de huidige naam (`server/auth/auth.ts:280` en `:534`). Met de vlag aan is een bestaand `sb_session` dus onzichtbaar voor docbot: **iedereen is op het moment van de flip uitgelogd op docs.ciiic.nl** en logt opnieuw in via de kaart.
- **Oude routes dicht.** `handleApi` geeft 410 op acht paden vóór welke handler dan ook: `/api/auth/login`, `/api/auth/dev-login`, `/api/auth/magic-link`, `/api/auth/magic-link/verify`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/reset-password/validate`, `/api/auth/change-password` (`server/routes/api/index.ts:37-55`). `/api/auth/me`, `/logout` en `/config` blijven werken (`server/routes/api/auth.ts:63-89`).
- **Client.** `/api/auth/config` geeft `cutoverEnabled` door (`server/routes/api/auth.ts:81-89`); de client haalt dat één keer per pagina-load op (`getAuthConfig`, `client/lib/auth.js:102-114`). Met de vlag aan rendert `renderLogin` alleen `<ciiic-login app="Docs" next=returnTo>` met het script van `tools.ciiic.nl/ciiic-login.js` en stopt (`client/views/login.js:11`, `:41-52`); het wachtwoordformulier, de magic-link-sectie en de dev-bypass-knop daaronder worden niet meer gebouwd. Een tab die al open stond houdt het oude formulier tot een reload; een submit daar geeft 410 met de Nederlandse melding uit `index.ts:52`, die de client toont (`login.js:277`).
- **De ZITADEL-route zelf verandert niet.** `/auth/login` en `/auth/callback` (`server/routes/oidc.ts:77-149`) draaien al op productie. De callback roept `createSessionUserForEmail` aan, dat een rij in de gedeelde `users`-tabel met `auth_source = 'database'` eist en nooit een account aanmaakt (`server/auth/auth.ts:500-520`), en mint dan via `setSessionCookie` het cookie van de huidige stand: na de flip dus `doc_session`.
- **Onaangeraakt door de vlag.** De service-token-bypass in `server/routes/api/index.ts:75-113`: een geldige `Authorization: Bearer <DOCBOT_INTERNAL_TOKEN>` op `/api/convert*` of `POST /api/documents` (met `X-On-Behalf-Of`) komt nooit bij het cookie. `assertAuthConfigured` (`server/server.ts:58`) kijkt niet naar de vlag.

### Stand op productie (gemeten 2026-09-17)

- `GET https://docs.ciiic.nl/api/auth/config` → `{"authEnabled":true,"databaseEnabled":true,"devBypassEnabled":false,"cutoverEnabled":false}`. De vlag-code draait dus al (de sleutel `cutoverEnabled` bestaat), de vlag staat uit.
- Coolify-resource `docbot` (uuid `ost5ze3ynm0i0swy3q77403c`): `AUTH_CUTOVER` ontbreekt, `COOKIE_DOMAIN=.ciiic.nl`, `SECURE_COOKIES` en `OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`/`OIDC_ISSUER` staan; **geen** `AUTH_USERS_JSON`/`AUTH_USERS_B64`. Gebruikers komen dus uitsluitend uit de `users`-tabel, precies wat de ZITADEL-callback eist.
- De rest van de `sb_session`-familie staat óók nog uit: `beeldbank.ciiic.nl` en `slides.ciiic.nl` geven `cutoverEnabled:false`, en de Coolify-env van `ciiicbot` heeft geen `AUTH_CUTOVER`. Dat bepaalt de hinder hieronder.

### Wie van docbot-auth afhangt en langs welke weg

| Afnemer | Pad | Weg | Hinder na de flip |
|---|---|---|---|
| ciiicbot → mcp-docbot | `ciiicbot/ciiic-mcp/packages/docbot/src/docbot/client.ts:23` en `:86` (Bearer), `:116` (`X-On-Behalf-Of`); token uit `config.ts:20` | `POST /api/convert` en `POST /api/documents` met `DOCBOT_INTERNAL_TOKEN`; ciiicbot controleert de gebruiker vooraf met zijn éigen sessie (`ciiicbot/src/routes/api/canvas/save-document/+server.ts:19`) | **Geen.** Loopt buiten het cookie om, `index.ts:75-113`. Enige bijeffect: de `/edit/<id>`-URL die `save_document` teruggeeft opent op docs.ciiic.nl; na de flip bounct die eerste keer naar `/login?returnTo=…` (`client/app.js:135-141`) en kost één ZITADEL-login per 30 dagen (`Max-Age`, `auth.ts:348`). |
| ciiic-dashboard, survey-PDF | `ciiic-dashboard/src/routes/campaigns/[slug]/survey/export/+server.ts:26-35` | `POST /api/convert` met Bearer | **Geen.** |
| ciiic-mcp (`packages/docbot`, de losse kopie voor Claude Desktop/Code) | `ciiic-mcp/packages/docbot/src/docbot/client.ts:23`, `:86` | Bearer, identiek aan ciiicbot | **Geen.** |
| beeldbank-picker in de editor van docbot | `client/views/editor/beeldbank-picker.js:88` (iframe), URL uit `server/routes/api/config.ts:9` | iframe naar `beeldbank.ciiic.nl/picker`; de leesroutes daar zijn publiek (`beeldbank/server/routes/api/index.ts:174-179`) | **Geen.** |
| tools.ciiic.nl-portaal | `ciiic-tools/src/data/apps.json:59-64` | alleen een tegel met een link | **Geen.** |
| Browsergebruikers van slides, beeldbank en ai | `server/auth/auth.ts:46-58` en `:380` | Elke login op docs.ciiic.nl laat het gedeelde `sb_session` verlopen. Zolang die drie apps nog op `sb_session` draaien (gemeten: ja), is de gebruiker daarna ook dáár uitgelogd en logt hij daar opnieuw in. | **Ja, zolang docbot als enige geflipt is**: één extra login op de andere apps na elke docs-login. Geen lock-out, wel gedoe. Dit is de reden dat het runbook de leaf-apps in één venster doet, slides als laatste. Zie § Wacht op Jaap, keuze 2. |
| Gebruikers zonder ZITADEL-activatie | `server/auth/auth.ts:508` (rij vereist), runbook § Later | Na de flip is de kaart de enige deur; wie zijn ZITADEL-wachtwoord en TOTP nog niet heeft gezet, komt niet meer binnen. | **Ja, per persoon.** Voorwaarde uit het runbook: `jaap-work/scripts/zitadel-migration/status.sh` toont 0 PENDING. Op deze Mac niet te draaien (`~/.ssh/id_rsa` ontbreekt); Jaap of de dev-server doet dat. |
| Magic-link-mails die vlak vóór de flip zijn verstuurd | `server/routes/api/index.ts:41` | `/api/auth/magic-link/verify` geeft 410 | Verwaarloosbaar; de melding zegt wat te doen. |

Nergens in de CIIIC-groepsmap (`..`) leunt code op docbots `sb_session` als bron: de treffers buiten docbot zijn de eigen cookie-implementaties van ciiicbot, slides en beeldbank en documentatie.

### Terugdraaipad

Terugdraaien is dezelfde handeling in omgekeerde richting: `AUTH_CUTOVER` weg of op `false` op de Coolify-resource, redeploy. Dan:

- Docbot leest weer `sb_session` (`auth.ts:38`) en mint weer op `Domain=.ciiic.nl`; de acht routes zijn weer open; de inlogpagina toont weer het oude formulier plús de "Inloggen met CIIIC"-knop (`login.js:54-151`).
- **Kapot na terugdraaien:** de `doc_session`-cookies die tijdens de cutover zijn uitgegeven. Niets leest ze meer (geen enkel pad kijkt naar `doc_session` als de vlag uit staat), dus wie in het venster heeft ingelogd is op docs uitgelogd en logt één keer opnieuw in, of is al binnen via een `sb_session` van slides. Het achtergebleven `doc_session`-cookie is host-only en heeft een andere naam dan `sb_session`, dus het botst nergens mee en verloopt vanzelf (30 dagen).
- **Niet kapot:** documenten, rechten, de `users`-tabel, `AUTH_SECRET`, de OIDC-client en de service-token-koppelingen. De vlag raakt geen opslag; er is niets te migreren, dus ook niets terug te migreren.
- De `sb_session`-cookies die docs-logins tijdens het venster hebben laten verlopen, komen niet terug; die gebruikers hebben inmiddels via slides of beeldbank een nieuwe.

### Volgorde vlag en redeploy

1. Code is al op `main` en draait (zie stand hierboven); er wordt niets gebouwd of gemerged.
2. Env-var zetten op de Coolify-resource `docbot` (UI, of `PATCH`/env-endpoint via de API, skill `ciiic-coolify`).
3. **Daarna** redeploy van diezelfde resource (`GET /deploy?uuid=ost5ze3ynm0i0swy3q77403c` of de knop in de UI). Zonder redeploy gebeurt er niets, want de draaiende container ziet de nieuwe env niet (`auth.ts:30` leest `process.env`, en dat wordt eenmalig bij de start gevuld).
4. Pas ná de redeploy de checks uit de acceptatie draaien. Andersom (eerst deployen, dan de vlag) is een redeploy voor niets.

## Scope

1. **Pre-flight, zonder iets te veranderen.** Bevestig dat `GET https://docs.ciiic.nl/api/auth/config` de sleutel `cutoverEnabled` bevat en `false` geeft, dat de Coolify-env van `docbot` geen `AUTH_USERS_*` heeft en wél `OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`, en dat de drie keuzes uit § Wacht op Jaap beantwoord zijn in de handoff (blok "Extra van Jaap"). Ontbreekt een antwoord: stoppen en melden, niet flippen.
2. **Vlag zetten.** `AUTH_CUTOVER=true` op de Coolify-resource `docbot` (uuid `ost5ze3ynm0i0swy3q77403c`), daarna redeploy van die resource, en wachten tot de deployment `finished` is.
3. **Verifiëren, in deze volgorde.** (a) `/api/auth/config` geeft `cutoverEnabled:true`; (b) `POST /api/auth/login` met een leeg JSON-body geeft 410, evenals `POST /api/auth/magic-link` en `POST /api/auth/forgot-password`; (c) `https://docs.ciiic.nl/login` toont alleen de CIIIC-kaart; (d) Jaap logt in via de kaart met 2FA: de respons van `/auth/callback` bevat een `Set-Cookie: doc_session=…` zónder `Domain` en een `Set-Cookie: sb_session=; …Max-Age=0; Domain=.ciiic.nl`; `/api/auth/me` geeft daarna 200 en de documentenlijst toont zijn bestaande documenten; (e) de bearer-paden werken nog: één `POST /api/convert` met het token (uit de Coolify-env, nooit in een bestand of log) geeft 200, en in ciiicbot werkt "Naar docs.ciiic.nl" in het canvas.
4. **Terugdraaien alleen bij rood.** Faalt (c), (d) of (e): `AUTH_CUTOVER` weer weg, redeploy, opnieuw `/api/auth/config` controleren, en de bevinding in de PR-body zetten. Niet eerst gaan fixen met de vlag aan.
5. **Documentatie in deze repo.** `README.md` § Auth krijgt één alinea over de twee standen van `AUTH_CUTOVER` (cookie-naam en -domein per stand, welke routes 410 geven) en de zin op regel 82 over ciiicbot en `sb_session` wordt "zijn eigen sessie". `CLAUDE.md` hoeft niets. Deze brief gaat naar `docs/plans/done/2026-09.md` als write-up, TODO #1 naar `done/register.md`.
6. **Doorgeven.** Eén regel `KB-suggestie: CIIIC-KB applications/docbot.md § Auth - beschrijft sb_session/Domain=.ciiic.nl, na de flip is dat doc_session host-only` in de journal-entry; CIIIC-KB wordt niet vanuit hier bewerkt.

## Buiten scope

- De vlag op de andere apps van de familie (beeldbank, ai, dashboard, monitor, slides). Elke app heeft een eigen repo en eigen TODO (bijvoorbeeld `monitor/docs/plans/TODO.md` #4); slides gaat per runbook als laatste. Wel: als Jaap bij keuze 2 "samen" zegt, vermeldt de handoff van die sessies dat docbot al om is.
- De legacy-code verwijderen (wachtwoord-login, magic-link, reset-flow, het `sb_session`-pad). Dat is TODO #3 en wacht tot de hele familie om is.
- De cutover-mail aan collega's en de ZITADEL-activatie van wie nog PENDING is (`status.sh`, `remind.sh`): dat is Jaaps traject in `jaap-work`.
- Rotatie van `DOCBOT_INTERNAL_TOKEN` of `AUTH_SECRET`; geen van beide verandert bij de flip.
- Een rollback-test op productie vóór de flip (zie keuze 3).

## Wacht op Jaap

1. **Het venster.** Voorwaarde uit het runbook: `status.sh` toont 0 PENDING, of Jaap accepteert dat wie nog PENDING is tijdelijk niet in docs kan. Advies: een rustig moment waarop Jaap zelf kan inloggen voor stap 3d; de agent kan die 2FA-login niet doen.
2. **Alleen docbot, of samen met beeldbank en ai in hetzelfde venster (slides daarna als laatste)?** Advies: samen. Alleen docbot betekent dat elke docs-login de gebruiker op slides, beeldbank en ai uitlogt, tot die ook om zijn. Samen is drie keer dezelfde handeling in drie repo-sessies; deze brief dekt alleen de docbot-stap.
3. **Rollback-test op productie vooraf?** Het runbook noemt hem, maar hij kost twee extra redeploys en twee keer een familie-brede uitlog. Advies: overslaan. De OFF-stand is bewezen door productie zelf, en de schakeling is deterministisch (één env-var, `auth.ts:29-34`); het terugdraaipad hierboven is de test als het nodig is.

## Acceptatie

Klaar als:

- [ ] `AUTH_CUTOVER=true` staat op de Coolify-resource `docbot` en de redeploy daarna is `finished`.
- [ ] `GET https://docs.ciiic.nl/api/auth/config` geeft `cutoverEnabled:true`.
- [ ] `POST /api/auth/login`, `POST /api/auth/magic-link` en `POST /api/auth/forgot-password` geven 410 met de melding "Deze inlogmethode is uitgeschakeld. Log in via CIIIC."
- [ ] `/login` toont alleen de `<ciiic-login app="Docs">`-kaart, geen wachtwoordveld.
- [ ] Jaap is via de kaart ingelogd: `Set-Cookie: doc_session` zonder `Domain`, `sb_session` op `Max-Age=0`, `/api/auth/me` 200, eigen documenten zichtbaar.
- [ ] `POST /api/convert` met het service-token geeft 200, en "Naar docs.ciiic.nl" in ciiicbot levert een werkende `/edit/<id>`-link.
- [ ] Niemand van het kernteam is buitengesloten: elke gebruiker die in het venster meldt niet binnen te komen, heeft binnen het venster een ZITADEL-activatie of het terugdraaipad is gebruikt.
- [ ] `README.md` § Auth beschrijft beide standen; de PR is gemerged; TODO #1 staat in `done/register.md` met de write-up in `done/2026-09.md`; de KB-suggestie staat in de journal-entry.
