# Tandem Browser — Roadmap & TODO

> Internal planning document. This file is maintained for local development and
> release planning, not as the primary public roadmap artifact.

> Twee trappen, één fiets. 🚲
> Laatst bijgewerkt: 8 maart 2026

---

## Wat er gebouwd is

| Versie | Subsysteem | Regels |
|--------|-----------|--------|
| 0.1.0 | Core browser, stealth layer, API (:8765), wingman panel | ~3,000 |
| 0.2.0 | Tabs, bookmarks, history, downloads, find, draw, voice, settings, new tab, ClaroNote, behavioral observer, stealth (canvas/WebGL/font/audio/timing), workflows, audio capture, help page | ~8,000 |
| 0.3.0 | MCP server (15 tools, 4 resources), EventStream (SSE), ContextManager, ChatRouter, DualMode, Agent Autonomie (TaskManager, approval, noodrem), TabLockManager, X-Scout | ~3,500 |
| 0.4.0 | CDP DevTools Bridge (9 endpoints), Context Menu (6 phases), Chat Bridge, Wingman Vision | ~2,500 |
| 0.5.0 | Security Shield — 5-layer defense (811K+ blocklist, Guardian, OutboundGuard, ScriptGuard, Gatekeeper AI, EvolutionEngine) | ~3,500 |
| 0.6.0 | Agent Tools (script injection, semantic locators, device emulation), Electron v28→v40, security fixes | ~2,500 |
| 0.7.0 | Linux support, Liquid Glass Lite, UI vertaling NL→EN | ~700 |
| 0.8.0 | macOS vibrancy, Smart Scroll | ~300 |
| 0.9.0 | Security Upgrade — Shannon entropy, 25 YARA-rules, AST fingerprinting, CyberChef patterns, confidence pipeline, plugin architecture, 51 tests | ~4,800 |
| 0.10.0 | Browser Extensions — CRX downloader, gallery (30 ext), toolbar, native messaging, OAuth polyfill, auto-updates, conflict detection, 73 tests | ~3,000+ |
| — | Agent-Browser Gap features — /snapshot, /network/mock, /sessions, tandem CLI | ~2,000 |

**Totaal (huidige codebase-scan): ~49,923 regels TypeScript in `src/` | 153 TS bestanden in `src/` | 247 API route handlers | 1,021 tests (vitest run output)**

---

### Status-check (TODO vs echte codebase)

- De roadmap bovenaan (0.1.0 t/m 0.10.0) is historisch en niet meer volledig: `CHANGELOG.md` staat inmiddels op `v0.45.0`.
- Feature-scope in code is groter dan deze TODO-samenvatting (o.a. `src/sidebar/`, `src/workspaces/`, `src/pinboards/`, `src/sync/`, `src/headless/`, `src/sessions/`).
- "Scheduled browsing" bestaat al in basisvorm via `WatchManager` + `/watch/*` API; openstaand blijft vooral live updates, cron-expressies, rijkere diffing en UX-polish.
- "Multi-profile" is deels al aanwezig als sessie-isolatie via `SessionManager` + `/sessions/*`; openstaand blijft vooral volwaardige profiel-UX in de shell.
- Huidige quick codebase-check: `package.json` staat op `0.45.0` en `src/` telt ~50,349 TypeScript-regels in 153 TS-bestanden.
- Deze TODO blijft de backlog, maar moet periodiek worden gesynchroniseerd met `CHANGELOG.md` en de actuele `src/` modules.


## Openstaande items

### 🔴 Hoge prioriteit

- [x] **Password Manager** — lokale SQLite + AES-256-GCM database, master password, autofill, generator, `GET /passwords/suggest`, nooit cloud sync
- [x] **Behavioral Learning modellen** — profiel compiler, typing bigram model, mouse Bézier curves, scroll/click/dagritme modellen, replay engine, fallback gaussians
- [x] **SPA Rendering bug** — `/page-content` retourneert lege content op dynamische pagina's (zie `docs/archive/plans/spa-rendering-bug.md`)

### 🟡 Medium prioriteit — Features

- [ ] WebSocket /watch/live — live stream
- [ ] Notificatie bij gesloten paneel — als Wingman antwoordt
- [ ] Google Photos upload — config UI bestaat, upload code niet
- [ ] Configureerbare quick links — nu hardcoded in newtab.html
- [ ] Configureerbare diff modes — meer dan SHA-256 hash
- [ ] HAR export — network inspector
- [ ] Full browsing session recording & replay — huidige code heeft behavior replay + audio recording, maar geen end-to-end sessie-recorder
- [x] Scheduled browsing (basis) — aanwezig via WatchManager + /watch/add|list|remove|check


### 🧭 Codebase sweep — voorgestelde onderhoudstaken

- [ ] **Typfout herstellen (docs/research/opera-browser-research.md)**
  - Probleem: in de sectie over tab snoozing staat "Snoze" i.p.v. "Snooze".
  - Taak: corrigeer de term en doe een korte spell-check op dezelfde sectie.

- [ ] **Bugfix: robuustere versievergelijking in extension updates (src/extensions/update-checker.ts)**
  - Probleem: `isNewerVersion()` gebruikt `split('.')` + `Number`, wat fragiel is bij versies met suffixes zoals `1.2.3-beta` (kan `NaN` opleveren en foutieve vergelijkingen geven).
  - Taak: normalizeer versie-onderdelen (pre-release/build metadata strippen of expliciet semver-parsergedrag implementeren) vóór numerieke vergelijking.

- [ ] **Documentatie-discrepantie oplossen (README.md)**
  - Probleem: README verwijst naar absolute lokale paden voor `AGENTS.md` en `TODO.md` (`/Users/...`), waardoor links in GitHub-context niet werken.
  - Taak: vervang door repo-relatieve links en verifieer dat beide links renderen op GitHub.

- [ ] **Testverbetering: versievergelijking afdekken (src/extensions/tests/)**
  - Probleem: er ontbreekt gerichte coverage voor randgevallen in `isNewerVersion()`.
  - Taak: voeg unit-tests toe voor o.a. ongelijke lengtes (`1.2` vs `1.2.0`), grotere segmenten (`1.10.0` vs `1.9.9`), en pre-release/suffix invoer.

### 🟢 Lage prioriteit — Polish & Distributie

- [ ] Full multi-profile UX (bovenop bestaande `SessionManager`-isolatie)
- [ ] Auto-updater (electron-updater) — release/ heeft oud 0.1.0 manifest
- [ ] Productie DMG build (macOS) — up-to-date, correct genaamd
- [ ] AppImage build (Linux)
- [ ] Documentatie site
- [ ] Firefox import

### 🔵 Stealth — Nice-to-have

- [ ] Proxy support (SOCKS5/HTTP, per-tab of globaal)
- [ ] User-facing request interception / header rewrite rules
- [ ] TLS/JA3 fingerprint matching
- [ ] Screen resolution spoofing
- [ ] Battery API masking
- [ ] Geolocation spoofing

### ❓ Open vragen

- [ ] Agent Tools Phase 4 — wat zou dit zijn? (docs/agent-tools/STATUS.md vermeldt "next to implement")
- [ ] Security Fixes Phase 2 — wat zou dit zijn? (docs/security-fixes/STATUS.md)
- [ ] Audit-rapport: memory leak uit `docs/archive/AUDIT-REPORT.md` opnieuw valideren tegen huidige `app.on('web-contents-created')` lifecycle
- [ ] Audit-rapport: tab registration race expliciet sluiten/documenteren? Huidige code heeft `pendingTabRegister` + renderer rename flow, maar TODO markeert dit nog niet als afgerond

---

## Projectstructuur
