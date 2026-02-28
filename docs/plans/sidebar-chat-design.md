# Design: Sidebar Chat Clients

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Hard (1-2 weken)
> **Auteur:** Kees

---

## Probleem / Motivatie

Robin wil zijn chat-apps kunnen gebruiken naast zijn browser, zonder constant van venster te hoeven wisselen. WhatsApp, Discord, Slack, Telegram, Instagram en X/Twitter zijn apps die hij dagelijks gebruikt — ze moeten naadloos naast de browsercontent beschikbaar zijn.

**Opera heeft:** Sidebar webview panels voor WhatsApp, Discord, Slack, Telegram, Instagram en X/Twitter. Elke messenger draait als een aparte webview naast de browsercontent. Sidebar icons met notification badges, pin/unpin, mute per panel, panel width instelbaar, onafhankelijke login per service.

**Tandem heeft nu:** Een copilot panel (links of rechts) en geen messenger sidebar. De copilot panel is een apart concept — het is het AI-mens communicatiekanaal. Er is geen plek voor externe chat-apps.

**Gap:** Geen sidebar messenger integratie. Robin moet nu schakelen tussen Tandem en losse apps/tabs voor al zijn communicatie.

---

## Gebruikerservaring — hoe het werkt

> Robin opent Tandem. Aan de linkerkant ziet hij een smalle icon strip met 6 chat-iconen: WhatsApp, Discord, Slack, Telegram, Instagram, X. Elk icoon kan een notification badge tonen (bv. "3" voor 3 ongelezen berichten).
>
> Robin klikt op het WhatsApp-icoon. Een panel schuift open tussen de icon strip en de browser content — ongeveer 420px breed. WhatsApp Web laadt erin. Robin logt eenmalig in via QR-code. Zijn sessie blijft bewaard (persist:whatsapp partition).
>
> Robin klikt op Discord terwijl WhatsApp open is. WhatsApp verbergt zich, Discord verschijnt in hetzelfde panelgebied. De WhatsApp webview blijft in het geheugen (session intact), maar is niet zichtbaar.
>
> Robin klikt nogmaals op het actieve Discord-icoon. Het panel schuift dicht. Meer ruimte voor de browsercontent.
>
> 's Avonds krijgt Robin een WhatsApp-bericht. Het WhatsApp-icoon toont een rood notification badge met "1". Robin klikt erop, leest het bericht, en gaat verder met browsen.

---

## Wat NIET inbegrepen is

- **Facebook Messenger** — niet relevant voor Robin
- **VKontakte (VK)** — niet relevant voor Robin
- **Spotify / Music Player** — apart project, andere architectuur (media vs chat)

---

## Technische Aanpak

### Architectuur

```
┌─────────────────────────────────────────────────────────────────┐
│  Tandem Browser Window                                          │
│                                                                 │
│  ┌──────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ Icon │  │  Sidebar     │  │                              │  │
│  │ Strip│  │  Panel       │  │     Browser Content           │  │
│  │      │  │  (webview)   │  │     (main webview)            │  │
│  │ 💬  │  │              │  │                              │  │
│  │ 🎮  │  │  WhatsApp    │  │                              │  │
│  │ 💼  │  │  Discord     │  │                              │  │
│  │ ✈️  │  │  Slack       │  │                              │  │
│  │ 📷  │  │  etc.        │  │                              │  │
│  │ 𝕏   │  │              │  │                              │  │
│  │      │  │  420px       │  │                              │  │
│  └──────┘  └──────────────┘  └──────────────────────────────┘  │
│    48px      0-600px                  rest                      │
└─────────────────────────────────────────────────────────────────┘
```

**Dataflow:**

```
User klikt sidebar icon
  → shell/index.html JS vangt click
  → IPC naar main process: 'sidebar-panel-toggle'
  → SidebarManager.togglePanel(serviceId)
    → Zoekt of webview al bestaat
      → Ja: toggle visibility (show/hide)
      → Nee: maak nieuwe <webview> met persist:{service} partition
  → IPC terug naar shell: panel state update
  → Shell past layout aan (panel open/dicht, badge updates)
```

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/sidebar/manager.ts` | `SidebarManager` — beheert sidebar panels, state, notification tracking, panel configuratie |
| `src/api/routes/sidebar.ts` | `registerSidebarRoutes()` — REST API endpoints voor sidebar beheer |
| `shell/css/sidebar.css` | Styling voor icon strip + panel container |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/registry.ts` | `sidebarManager` toevoegen aan `ManagerRegistry` | `interface ManagerRegistry` |
| `src/api/server.ts` | Sidebar routes importeren en registreren | `setupRoutes()` |
| `src/api/context.ts` | Type export bevat al `ManagerRegistry & { win }` — geen aanpassing nodig | `type RouteContext` |
| `src/main.ts` | `SidebarManager` instantiëren, registreren in registry, cleanup in will-quit | `startAPI()`, `app.on('will-quit')` |
| `shell/index.html` | Sidebar icon strip HTML + panel container toevoegen | Nieuwe sectie vóór `<div class="main-layout">` |
| `shell/js/main.js` | Sidebar click handlers, IPC listeners, badge updates | Bestaande event handling |
| `shell/css/main.css` | Layout grid aanpassen voor sidebar icon strip + panel | `.main-layout` class |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| GET | `/sidebar/panels` | Lijst van alle geconfigureerde panels met status (visible, muted, notifications) |
| POST | `/sidebar/open` | Open/toon een specifiek panel (`{ service: "whatsapp" }`) |
| POST | `/sidebar/close` | Sluit het actieve panel |
| POST | `/sidebar/toggle` | Toggle een panel open/dicht (`{ service: "discord" }`) |
| GET | `/sidebar/list` | Lijst van beschikbare services met hun URLs en status |
| POST | `/sidebar/mute` | Mute/unmute notifications voor een panel (`{ service: "slack", muted: true }`) |
| GET | `/sidebar/status` | Status van de sidebar (welk panel open, notification counts) |

### Messenger Configuratie

| Service | URL | Partition | Login Methode | Opmerkingen |
|---------|-----|-----------|---------------|-------------|
| WhatsApp | `https://web.whatsapp.com` | `persist:whatsapp` | QR-code scan | Vereist Chrome-achtige User-Agent. localStorage bevat encryption keys — partition moet persistent zijn |
| Discord | `https://discord.com/app` | `persist:discord` | Email + wachtwoord / QR | Kan CAPTCHAs tonen bij eerste login. Minimum breedte ~420px |
| Slack | `https://app.slack.com` | `persist:slack` | Workspace URL + login | Workspace-specifiek: gebruiker moet workspace URL configureren. Standaard: `https://app.slack.com` |
| Telegram | `https://web.telegram.org/a/` | `persist:telegram` | QR-code / telefoonnummer | Telegram Web A (modernste versie) |
| Instagram | `https://www.instagram.com` | `persist:instagram` | Email + wachtwoord | Responsief design, werkt goed in smalle panels |
| X/Twitter | `https://x.com` | `persist:x` | Email + wachtwoord | Volledig responsief web app |

### Notification Badge Detectie

Elke messenger geeft ongelezen berichten anders aan. Strategie per service:

| Service | Detectie Methode |
|---------|-----------------|
| WhatsApp | `page-title-updated` event — titel bevat `(3) WhatsApp` voor 3 ongelezen |
| Discord | `page-title-updated` — titel bevat `(5) Discord` voor 5 mentions |
| Slack | `page-title-updated` — titel bevat `* Slack` of `! Slack` |
| Telegram | `page-title-updated` — titel bevat `Telegram (2)` |
| Instagram | `page-title-updated` — titel bevat `(1) Instagram` |
| X/Twitter | `page-title-updated` — titel bevat `(4) X` |

**Patroon:** Alle grote messengers embedden de unread count in de page title. `webContents.on('page-title-updated')` is de universele detectie-methode. Geen DOM injection nodig.

### Panel State Persistence

Configuratie wordt opgeslagen in `~/.tandem/sidebar-config.json`:

```json
{
  "panels": {
    "whatsapp": { "enabled": true, "muted": false, "width": 420 },
    "discord": { "enabled": true, "muted": false, "width": 420 },
    "slack": { "enabled": true, "muted": false, "width": 420, "workspaceUrl": "https://myteam.slack.com" },
    "telegram": { "enabled": true, "muted": false, "width": 420 },
    "instagram": { "enabled": true, "muted": false, "width": 380 },
    "x": { "enabled": true, "muted": false, "width": 400 }
  },
  "lastActivePanel": "whatsapp",
  "sidebarVisible": true
}
```

### Geen nieuwe npm packages nodig ✅

Alles wordt gebouwd met Electron's native `<webview>` tag en bestaande IPC patterns.

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Sidebar infrastructure (icon strip, panel container, SidebarManager) + WhatsApp panel | 1-2 | — |
| 2 | Discord + Slack panels (zelfde patroon, Slack workspace config) | 1 | Fase 1 |
| 3 | Telegram + Instagram + X/Twitter panels | 1 | Fase 2 |

---

## Risico's / Valkuilen

- **WhatsApp Web UA check:** WhatsApp Web controleert de User-Agent en weigert non-Chrome browsers. De sidebar webview moet een standaard Chrome UA gebruiken (niet de Tandem stealth UA). Mitigatie: stel een expliciete Chrome UA in per sidebar webview via `webview.setUserAgent()`.

- **Discord CAPTCHA op eerste login:** Discord toont soms CAPTCHAs bij login vanuit een "nieuw" browser profiel. Mitigatie: persistent partition (`persist:discord`) — na eerste login wordt de sessie onthouden. Optioneel: stuur standaard Chrome UA.

- **Slack workspace URL variatie:** Slack gebruikt workspace-specifieke URLs (`https://myteam.slack.com`). De gebruiker moet dit kunnen configureren. Mitigatie: configuratie-optie per panel met standaard `https://app.slack.com`.

- **Panel breedte vs content:** Sommige web apps (Discord) hebben een minimum breedte. Als het panel te smal is, breekt de layout. Mitigatie: minimum breedte van 360px enforced, standaard 420px.

- **Geheugengebruik:** Elke sidebar webview is een apart Electron renderer process. 6 simultane webviews = significant geheugengebruik. Mitigatie: Lazy loading — alleen aanmaken wanneer voor het eerst geopend. Optioneel: tab snoozing voor niet-zichtbare sidebar panels.

- **Session isolation vs stealth:** Sidebar panels gebruiken eigen partitions (`persist:whatsapp`, etc.), niet de standaard `persist:tandem` partition. Dit is correct — het voorkomt dat messenger cookies interfereren met Robin's hoofdsessie.

---

## Anti-detect overwegingen

Sidebar messenger panels zijn **ANDERS** dan copilot-gestuurde browseactiviteit:

- ✅ **Geen anti-detect nodig voor messenger panels** — dit zijn legitimate websites die Robin ZELF bedient. Robin logt zelf in, Robin typt zelf, Robin scrollt zelf. Er is geen AI-automatie in deze panels.

- ✅ **Eigen partitions** — messenger panels delen geen cookies/storage met de hoofdsessie (`persist:tandem`). Dit is gewenst: Robin's WhatsApp login moet niet lekken naar zijn browsesessie en vice versa.

- ⚠️ **User-Agent:** Sidebar webviews moeten een standaard Chrome User-Agent gebruiken. Sommige messengers (WhatsApp Web) weigeren non-Chrome UA's. De Tandem stealth UA patches zijn hier niet van toepassing — die zijn voor de hoofd-webview.

- ⚠️ **Stealth script injection:** De `web-contents-created` handler in `createWindow()` injecteert stealth scripts in ALLE webviews. Sidebar webviews moeten **NIET** de stealth script krijgen — de stealth patches zijn bedoeld voor sites waar Copilot actief is, niet voor Robin's eigen messenger gebruik. Overweeg een check op partition naam (skip stealth voor `persist:whatsapp`, `persist:discord`, etc.).

- ✅ **Geen localhost API calls vanuit sidebar webviews** — de messengers communiceren alleen met hun eigen servers. Geen cross-origin risico naar onze API.

---

## Beslissingen nodig van Robin

- [x] Welke messengers: WhatsApp, Discord, Slack, Telegram, Instagram, X/Twitter ✅
- [x] NIET: Facebook Messenger, VK ✅
- [ ] Sidebar links of rechts? Voorstel: **links** (copilot panel is rechts, Opera doet het ook links)
- [ ] Moeten sidebar panels stealth script krijgen? Voorstel: **nee** — Robin bedient deze zelf, geen AI-interactie
- [ ] Standaard panel breedte? Voorstel: **420px** (breed genoeg voor alle messengers)
- [ ] Moeten alle 6 iconen altijd zichtbaar zijn, of alleen "enabled" panels? Voorstel: **altijd alle 6 tonen** (consistent, makkelijk te ontdekken)

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________
