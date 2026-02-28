# Sidebar Chat Clients — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** WhatsApp, Discord, Slack, Telegram, Instagram en X/Twitter als sidebar webview panels naast de browsercontent
> **Volgorde:** Fase 1 → 2 → 3 (elke fase is één sessie)

---

## Waarom deze feature?

Robin gebruikt dagelijks 6 chat-apps en moet nu constant schakelen tussen Tandem en losse apps. Door deze als sidebar panels in te bouwen kan hij chatten terwijl hij browst — zonder context te verliezen. Opera heeft dit als kern-feature; het is de #1 gap in onze gap analyse (zie `docs/research/gap-analysis.md`, sectie "Sidebar Chat Clients — Full Spec").

---

## Architectuur in 30 seconden

```
┌──────┐  ┌──────────────┐  ┌────────────────────┐  ┌──────────┐
│ Icon │  │  Panel       │  │  Browser Content    │  │ Copilot  │
│ Strip│→ │  Container   │  │  (main webview)     │  │ Panel    │
│ 48px │  │  (webview)   │  │                     │  │ (rechts) │
│      │  │  420px       │  │                     │  │          │
└──────┘  └──────────────┘  └────────────────────┘  └──────────┘
    ↕ IPC                        onafhankelijk          bestaand
    ↓
SidebarManager (main process)
  → beheert webview lifecycle
  → tracked notification badges
  → persisted config (~/.tandem/sidebar-config.json)
```

**Elke messenger is een `<webview>` tag met eigen partition:**
- `persist:whatsapp`, `persist:discord`, `persist:slack`, etc.
- Sessie/cookies blijven bewaard tussen herstart
- Gescheiden van Robin's hoofdsessie (`persist:tandem`)

---

## Projectstructuur — relevante bestanden

> ⚠️ Lees ALLEEN de bestanden in de "Te lezen" tabel.
> Ga NIET wandelen door de rest van de codebase.

### Te lezen voor ALLE fases

| Bestand | Wat staat erin | Zoek naar functie |
|---------|---------------|-------------------|
| `AGENTS.md` | Anti-detect regels, code stijl, commit format | — (lees volledig) |
| `src/main.ts` | App startup, manager registratie, will-quit cleanup | `startAPI()`, `app.on('will-quit')` |
| `src/api/server.ts` | TandemAPI class, route registratie | `class TandemAPI`, `setupRoutes()` |
| `src/registry.ts` | ManagerRegistry interface — alle managers | `interface ManagerRegistry` |
| `src/api/context.ts` | RouteContext type definitie | `type RouteContext` |
| `shell/index.html` | Browser UI — zoek naar `<div class="main-layout">` voor de plek waar sidebar HTML moet | `<div class="main-layout">` |
| `shell/css/main.css` | Layout styling — zoek `.main-layout` voor het grid dat aangepast moet worden | `.main-layout` |

### Per fase aanvullend te lezen

_(zie het relevante fase-bestand)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **Sidebar webviews NIET in de webview injecteren** — de sidebar icon strip en panel container zijn shell-level HTML, net als het copilot panel. Ze zitten NAAST de main webview, niet ERIN.

2. **Geen stealth script injection in sidebar webviews** — sidebar panels zijn voor Robin's eigen gebruik (hij logt zelf in, typt zelf). De stealth patches in `createWindow()` die via `app.on('web-contents-created')` worden geïnjecteerd moeten sidebar webviews overslaan. Check de partition naam: als die begint met `persist:whatsapp`, `persist:discord`, etc. → skip stealth injection.

3. **Eigen partitions per messenger** — nooit `persist:tandem` gebruiken voor sidebar panels. Elke messenger krijgt zijn eigen partition zodat sessies volledig geïsoleerd zijn.

4. **Standaard Chrome User-Agent voor sidebar webviews** — sommige messengers (WhatsApp Web) weigeren non-Chrome UA's. Gebruik een standaard Chrome UA, niet de Tandem stealth UA.

5. **Geen nieuwe npm packages** — alles wordt gebouwd met Electron's native `<webview>` tag en bestaande IPC patterns.

6. **Functienamen > regelnummers** — verwijs altijd naar `function setupRoutes()`, nooit naar "regel 287"

7. **Panel state persistence** — configuratie wordt opgeslagen in `~/.tandem/sidebar-config.json`. Gebruik `tandemDir()` uit `src/utils/paths.ts` voor het pad.

---

## Manager Wiring — hoe SidebarManager registreren

Elke nieuwe manager moet op **4 plekken** worden aangesloten:

### 1. `src/registry.ts` — `ManagerRegistry` interface

```typescript
import type { SidebarManager } from './sidebar/manager';

export interface ManagerRegistry {
  // ... bestaande managers ...
  sidebarManager: SidebarManager;  // ← toevoegen
}
```

### 2. `src/main.ts` — `startAPI()` functie

```typescript
import { SidebarManager } from './sidebar/manager';

// Na aanmaken van aanverwante managers:
const sidebarManager = new SidebarManager(win);

// In de registry object:
const registry: ManagerRegistry = {
  // ... bestaande managers ...
  sidebarManager: sidebarManager!,
};
```

### 3. `src/main.ts` — `app.on('will-quit')` handler

```typescript
if (sidebarManager) sidebarManager.destroy();
```

### 4. `src/main.ts` — `createWindow()` stealth skip

In de `app.on('web-contents-created')` handler, waar stealth scripts geïnjecteerd worden in webviews, voeg een check toe om sidebar partitions over te slaan:

```typescript
contents.on('dom-ready', () => {
  const url = contents.getURL();
  // Skip stealth voor Google auth
  if (url.includes('accounts.google.com') || url.includes('consent.google.com')) {
    return;
  }
  // Skip stealth voor sidebar messenger panels
  const session = contents.session;
  const partitionId = /* partition check logic */;
  if (partitionId && partitionId.startsWith('persist:') &&
      ['whatsapp', 'discord', 'slack', 'telegram', 'instagram', 'x'].some(s => partitionId.includes(s))) {
    return;
  }
  contents.executeJavaScript(stealthScript).catch(/* ... */);
});
```

**Let op:** Electron's `webContents.session` is beschikbaar maar de partition naam is niet direct uitleesbaar. Alternatief: laat `SidebarManager` een Set bijhouden van sidebar webContents IDs en check daar tegen.

---

## API Endpoint Patroon — kopieer exact

```typescript
// In src/api/routes/sidebar.ts:
import type { Router } from 'express';
import type { RouteContext } from '../context';

export function registerSidebarRoutes(router: Router, ctx: RouteContext): void {
  // ═══════════════════════════════════════════════
  // SIDEBAR — Messenger panel management
  // ═══════════════════════════════════════════════

  router.get('/sidebar/panels', async (req, res) => {
    try {
      const panels = ctx.sidebarManager.listPanels();
      res.json({ ok: true, panels });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
```

**Regels:**
- `try/catch` rond ALLES, catch als `(e: any)`
- 400 voor ontbrekende verplichte velden
- 404 voor niet-gevonden resources
- Success: altijd `{ ok: true, ...data }`

---

## Notification Badge Detectie

Alle grote messengers embedden unread count in de page title. Universele detectie:

```typescript
webview.addEventListener('page-title-updated', (event) => {
  const title = event.title;
  const match = title.match(/\((\d+)\)/);
  const unreadCount = match ? parseInt(match[1], 10) : 0;
  // Update badge in shell UI
});
```

| Service | Title patroon | Voorbeeld |
|---------|--------------|-----------|
| WhatsApp | `(N) WhatsApp` | `(3) WhatsApp` |
| Discord | `(N) Discord \| #channel` | `(5) Discord \| #general` |
| Slack | `* Slack` of `(N) Slack` | `* Slack - myteam` |
| Telegram | `Telegram (N)` | `Telegram (2)` |
| Instagram | `(N) Instagram` | `(1) Instagram` |
| X/Twitter | `(N) X` | `(4) X` |

---

## Documenten in deze map

| Bestand | Wat | Status |
|---------|-----|--------|
| `LEES-MIJ-EERST.md` | ← dit bestand | — |
| `fase-1-infrastructure-whatsapp.md` | Sidebar framework + WhatsApp panel | 📋 Klaar om te starten |
| `fase-2-discord-slack.md` | Discord + Slack panels | ⏳ Wacht op fase 1 |
| `fase-3-telegram-instagram-x.md` | Telegram + Instagram + X panels | ⏳ Wacht op fase 2 |

---

## Quick Status Check (altijd eerst uitvoeren)

```bash
# App draait?
curl http://localhost:8765/status

# TypeScript clean?
npx tsc

# Git status clean?
git status

# Tests slagen?
npx vitest run
```

---

## 📊 Fase Status — BIJWERKEN NA ELKE FASE

| Fase | Titel | Status | Commit |
|------|-------|--------|--------|
| 1 | Sidebar infrastructuur + WhatsApp | ⏳ niet gestart | — |
| 2 | Discord + Slack | ⏳ niet gestart | — |
| 3 | Telegram + Instagram + X | ⏳ niet gestart | — |

> Claude Code: markeer fase als ✅ + voeg commit hash toe na afronden.
