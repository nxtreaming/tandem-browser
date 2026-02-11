# Tandem Browser — TODO & Roadmap

> Twee trappen, één fiets. 🚲

---

## Phase 1: Core ✅ DONE
> Fundament staat. Browser werkt, API draait, stealth is actief.

- [x] Electron browser met Chromium webview
- [x] HTTP API op localhost:8765
- [x] 13 endpoints: navigate, click, type, screenshot, page-content, page-html, execute-js, cookies, scroll, wait, links, forms, copilot-alert, status
- [x] Anti-detect stealth layer (UA, headers, navigator patches)
- [x] Persistent sessions (`persist:tandem` — cookies overleven restart)
- [x] Copilot alert systeem (macOS notification + in-browser overlay)
- [x] URL bar met smart input (zoeken of navigeren)
- [x] Donker thema UI

---

## Phase 2: Tandem Experience 🔄 ACTIEF
> Dit is wat Tandem Tandem maakt. Zonder dit is het gewoon weer een browser.

### 2.1 Tabs & Tab Groups ✅ DONE
- [x] Meerdere tabs openen/sluiten/wisselen
- [x] Tab bar met favicon + titel
- [x] Tab groups met kleuren (bijv. 🔵 Werk, 🟢 Research)
- [x] API: `POST /tabs/open`, `POST /tabs/close`, `GET /tabs/list`
- [x] API: `POST /tabs/group` — tabs groeperen
- [x] API: `POST /tabs/focus` — tab activeren
- [x] Keyboard shortcuts: Cmd+T (nieuw), Cmd+W (sluit), Cmd+1-9 (wissel)
- [x] Click/type herschreven naar sendInputEvent (Event.isTrusted = true)
- [x] Humanized delays: gaussian random timing (80-300ms click, 30-120ms typing)

### 2.2 Split Window + Kees Paneel ✅ DONE
- [x] Rechter paneel: Kees control panel (resizable)
- [x] Activity log — real-time feed van Robin's acties (navigatie, clicks, scrolls)
- [x] Chat interface — Robin typt/praat, Kees antwoordt
- [x] Screenshot preview — laatste snapshots met annotaties
- [x] Toggle: Cmd+K paneel open/dicht
- [x] API: `GET /activity-log` — stream van user events
- [x] API: `POST /panel/toggle`, `GET/POST /chat`

### 2.3 Draw/Annotatie Tool 🖍️ ✅ DONE
- [x] Transparante canvas overlay bovenop webview
- [x] Tools: pijlen, cirkels, rechthoeken, vrije lijn, tekst labels
- [x] Kleuren: rood (default), geel, groen, blauw
- [x] Toggle: Cmd+D draw mode aan/uit
- [x] "📸 Snap voor Kees" knop — screenshot MET annotaties
- [x] Annotaties verdwijnen na snap (of handmatig wissen)
- [x] API: `GET /screenshot/annotated` — laatste geannoteerde screenshot
- [x] API: `POST /screenshot/annotated`, `POST /draw/toggle`, `GET /screenshots`
- [x] Opslag: app userData/screenshots/ met timestamp

### 2.4 Voice Input 🎙️
- [ ] Web Speech API integratie (nl-BE)
- [ ] Hotkey: Cmd+M → start/stop luisteren
- [ ] Live transcriptie in Kees paneel
- [ ] Auto-send na stilte (of handmatig met Enter)
- [ ] Visuele indicator: 🔴 pulserende dot wanneer actief
- [ ] Combi: voice + annotated screenshot = één bericht naar Kees
- [ ] API: `POST /voice/message` — ontvang voice transcriptie
- [ ] Later: Whisper lokaal als offline fallback

### 2.5 Live Co-Pilot Feed 👁️
- [ ] Event tracking: elke navigatie, click, scroll, form input → log
- [ ] DOM change detection — meld wat er veranderd is
- [ ] Auto-snapshot bij belangrijke events (navigatie, form submit)
- [ ] API: `GET /watch` — polling endpoint voor Kees
- [ ] API: `WS /watch/live` — WebSocket stream (later)

### 2.6 Kees Chat Koppeling 💬
- [ ] Chat paneel berichten doorsturen naar OpenClaw (via webhook of polling)
- [ ] Kees kan antwoorden terugsturen via `POST /chat` → verschijnt in paneel
- [ ] Chat history persistent (overleven restart)
- [ ] Combi: annotated screenshot + voice/tekst = één bericht naar Kees
- [ ] Notificatie als Kees antwoordt terwijl paneel dicht is

### 2.7 Screenshot Pipeline 📸
- [ ] Fix: Snap voor Kees knop moet daadwerkelijk composiet screenshot maken
- [ ] Screenshot → clipboard (Cmd+V in elke app)
- [ ] Screenshot → bestand opslaan (instelbare folder, default ~/Pictures/Tandem/)
- [ ] Screenshot → Apple Photos library (via `osascript` / Photos framework)
- [ ] Screenshot → Google Photos (via API, instelbaar)
- [ ] Configuratiescherm: aan/uit per bestemming
  - [ ] ☑️ Clipboard (altijd aan)
  - [ ] ☑️ Lokale folder: [pad kiezen]
  - [ ] ☑️ Apple Photos
  - [ ] ☑️ Google Photos
- [ ] Preview in Kees paneel (Screenshots tab)
- [ ] Bestandsnaam: `tandem-{url-slug}-{timestamp}.png`

### 2.8 Settings/Config Scherm ⚙️
- [ ] Instellingen pagina (tandem://settings)
- [ ] Screenshot bestemmingen configureren
- [ ] Startpagina kiezen
- [ ] Stealth level (low/medium/high)
- [ ] Kees paneel positie (links/rechts)
- [ ] Voice input taal (nl-BE, en-US, etc.)
- [ ] Behavioral learning aan/uit
- [ ] Data export/import
- [ ] Opslag in ~/.tandem/config.json

### 2.9 Custom New Tab — Kees.ai 🧀
- [ ] Custom new-tab page in plaats van DuckDuckGo
- [ ] Kees chat direct in new-tab (geen externe AI nodig)
- [ ] Snelle acties: "zoek...", "open...", "wat staat er op mijn agenda?"
- [ ] Recente tabs / bookmarks overzicht
- [ ] Weerwidget (Herent)
- [ ] Tandem branding + Robin's voorkeuren

### 2.8 Behavioral Learning 🧬
- [ ] Observation layer: track mouse, clicks, scroll, keypress via Electron events
- [ ] Raw data opslag: `~/.tandem/behavior/raw/`
- [ ] Profiel compiler: statistische analyse na ~1 week data
- [ ] Typing bigram timing model (per toets-paar interval)
- [ ] Mouse path Bézier curve templates
- [ ] Scroll pattern model (snelheid + pauze distributie)
- [ ] Click hesitatie model (hover → click delay)
- [ ] Dagritme variatie (correlatie tijd ↔ snelheid)
- [ ] Per-site gedragsclusters
- [ ] Replay engine: sample uit profiel bij automated acties
- [ ] Profiel: `~/.tandem/behavior/robin-profile.json`
- [ ] Fallback: gaussian defaults als profiel nog leeg

---

## Phase 3: Kees' Brein 🧠
> Dit maakt Kees slim. Niet alleen meekijken maar onthouden, begrijpen, en zelfstandig handelen.

### 3.1 Site Memory — Geheugen per website
- [ ] `~/.tandem/site-memory/{domain}.json` — structured data per site
- [ ] Auto-extract bij bezoek: titel, meta, key content, forms, accounts
- [ ] Diff detectie: wat is veranderd sinds vorige keer?
- [ ] API: `GET /memory/{domain}`, `GET /memory/diff/{domain}`
- [ ] Doorzoekbaar: `GET /memory/search?q=...`

### 3.2 Scheduled Watches — Ogen die altijd aan staan
- [ ] Watch list: URLs + check interval + change detection
- [ ] Background tabs (headless, Robin ziet ze niet)
- [ ] Notificatie als er iets veranderd is
- [ ] Cron integratie: "check LinkedIn elke ochtend om 9:00"
- [ ] API: `POST /watch/add`, `GET /watch/list`, `DELETE /watch/remove`
- [ ] Configureerbaar: wat telt als "veranderd"? (text diff, element, screenshot diff)

### 3.3 Headless Mode — Kees browst solo
- [ ] Tweede webview (verborgen) voor background browsing
- [ ] Kees kan zelfstandig pagina's openen, lezen, navigeren
- [ ] Resultaten verschijnen in Kees paneel
- [ ] Robin kan headless tab "zichtbaar" maken als hij wil meekijken
- [ ] API: `POST /headless/open`, `GET /headless/content`

### 3.4 Form Memory — Alle formulieren onthouden
- [ ] Track elke form submit: welke velden, welke waarden
- [ ] `~/.tandem/forms/{domain}.json`
- [ ] Auto-suggest bij volgende bezoek
- [ ] "Kees, vul dit in" → formulier invullen met opgeslagen data
- [ ] Gaat verder dan passwords: adressen, telefoonnummers, voorkeuren
- [ ] API: `GET /forms/memory/{domain}`, `POST /forms/fill`

### 3.5 Context Bridge — Tandem ↔ OpenClaw
- [ ] Alles wat Kees leest in Tandem → beschikbaar in OpenClaw chats
- [ ] Web geheugen persistent: niet opnieuw fetchen wat we al gezien hebben
- [ ] Tandem als OpenClaw skill: `tandem.read("linkedin.com/in/robinwaslander")`
- [ ] Bi-directioneel: OpenClaw chat → Tandem actie, Tandem observatie → OpenClaw kennis
- [ ] Shared context store: `~/.tandem/context/`

### 3.6 Bidirectioneel Stuur — Kees navigeert, Robin ziet
- [ ] Kees opent een pagina → verschijnt live in Robin's browser
- [ ] "Kijk, dit vond ik" → tab opent met highlight
- [ ] Robin kan overnemen, Kees kan terugnemen
- [ ] Visuele indicator: 🧀 icoontje als Kees een tab bestuurt, 👤 als Robin bestuurt
- [ ] Smooth handoff: geen flicker, geen reload

### 3.7 PiP Mode — Always-on-top mini-venster
- [ ] Klein floating venster (Electron BrowserWindow, alwaysOnTop)
- [ ] Laatste activiteit + quick command + status
- [ ] Drag anywhere op scherm
- [ ] Toggle: Cmd+P of via menu
- [ ] Minimaal: 300x200px

### 3.8 Network Inspector — Kees begrijpt het verkeer
- [ ] Request logging via Electron webRequest API (NIET in webview)
- [ ] Per pagina: welke APIs, welke endpoints, welke responses
- [ ] Automatische API discovery: "deze site gebruikt api.example.com/v2/"
- [ ] Export: HAR format of JSON
- [ ] API: `GET /network/log`, `GET /network/apis`

---

## Phase 4: Echte Browser Features 📦
> Van "tool" naar "dagelijkse browser".

### 3.1 Data Import
- [ ] Chrome bookmarks import (JSON parse van `~/Library/Application Support/Google/Chrome/Default/Bookmarks`)
- [ ] Chrome cookies import
- [ ] Chrome geschiedenis import
- [ ] Firefox import (optioneel)

### 3.2 Wachtwoorden & Autofill
- [ ] Lokale password database (SQLite + AES-256-GCM)
- [ ] Master password bij eerste keer
- [ ] Autofill login formulieren
- [ ] Password generator
- [ ] API: `GET /passwords/suggest` — credentials voor huidige site
- [ ] Nooit cloud sync — alles lokaal

### 3.3 Browser Basics
- [ ] Download manager
- [ ] Geschiedenis met zoekfunctie
- [ ] Bookmarks bar + manager
- [ ] Find in page (Cmd+F)
- [ ] Zoom in/out (Cmd+/-)
- [ ] Print / PDF export

---

## Phase 4: Advanced Stealth 🔒
> Onzichtbaar voor elke detectie.

- [ ] Canvas fingerprint randomisatie
- [ ] WebGL renderer/vendor spoofing
- [ ] Font enumeration masking
- [ ] AudioContext fingerprint spoofing
- [ ] Proxy support (SOCKS5/HTTP, per-tab of globaal)
- [ ] Request interception (headers wijzigen/blokkeren)
- [ ] TLS/JA3 fingerprint matching
- [ ] Timing humanisatie (random delays 50-200ms bij automated actions)
- [ ] Screen resolution spoofing
- [ ] Battery API masking
- [ ] Geolocation spoofing (optioneel)

---

## Phase 5: OpenClaw Integratie 🤖
> Tandem als native tool voor Kees.

- [ ] OpenClaw Skill package (`tandem-browser` skill)
- [ ] Smart content extraction (artikel, profiel, product → structured JSON)
- [ ] Turndown integration (HTML → clean markdown)
- [ ] Multi-step workflow engine (keten van acties)
- [ ] Login state manager (per-site sessies)
- [ ] Session recording & replay
- [ ] Scheduled browsing (cron: check elke ochtend of X veranderd is)

---

## Phase 6: Polish & Distribution 🚀
> Van project naar product.

- [ ] Multi-profile support (gescheiden browse contexten)
- [ ] Keyboard shortcuts overzicht (Cmd+?)
- [ ] Themes (donker/licht/custom)
- [ ] Auto-updater (electron-updater)
- [ ] DMG build (macOS)
- [ ] AppImage build (Linux)
- [ ] Documentatie site
- [ ] Onboarding flow (eerste keer openen)

---

## Architectuur Notities

```
~/Documents/dev/tandem-browser/
├── src/
│   ├── main.ts              # Electron main process
│   ├── preload.ts            # Context bridge
│   ├── api/server.ts         # Express API (localhost:8765)
│   └── stealth/manager.ts    # Anti-detect patches
├── shell/
│   └── index.html            # Browser UI
├── PROJECT.md                # Visie & architectuur
├── TODO.md                   # ← dit bestand
├── README.md                 # Quick start & API docs
└── package.json
```

**GitHub:** `hydro13/tandem-browser` (privé)
**Stack:** Electron + TypeScript + Express
**Filosofie:** Robin = ogen & handen, Kees = brein & motor

---

*Laatst bijgewerkt: 11 februari 2026*
