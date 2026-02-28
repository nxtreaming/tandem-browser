# Fase 1 — Infrastructure: Sidebar Framework + WhatsApp Panel

> **Feature:** Sidebar Chat Clients
> **Sessies:** 1-2 sessies
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw het complete sidebar framework: icon strip, panel container, SidebarManager, API endpoints, en het eerste werkende panel (WhatsApp). Na deze fase kan Robin WhatsApp openen in een sidebar panel naast zijn browsercontent, met persistent sessie en notification badges.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `LEES-MIJ-EERST.md` (deze map) | — (lees volledig) | Context, regels, wiring instructies |
| `src/main.ts` | `startAPI()`, `createWindow()`, `app.on('will-quit')`, `app.on('web-contents-created')` | Manager registratie, stealth skip logic |
| `src/api/server.ts` | `class TandemAPI`, `setupRoutes()` | Route registratie patroon |
| `src/registry.ts` | `interface ManagerRegistry` | Manager registry — hier moet SidebarManager bij |
| `src/api/context.ts` | `type RouteContext` | Automatisch afgeleid van ManagerRegistry |
| `shell/index.html` | `<div class="main-layout">`, `<div class="copilot-panel">` | Waar sidebar HTML moet komen |
| `shell/css/main.css` | `.main-layout`, `.browser-content`, `.copilot-panel` | Layout grid dat aangepast moet worden |
| `src/api/routes/browser.ts` | `registerBrowserRoutes()` | Voorbeeld van hoe een route-bestand eruitziet |
| `src/panel/manager.ts` | `class PanelManager` | Referentie voor panel-achtig management patroon |

---

## Te bouwen in deze fase

### Stap 1: SidebarManager class

**Wat:** Core manager die sidebar panels beheert — state, configuratie, notification tracking.

**Bestand:** `src/sidebar/manager.ts`

```typescript
import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { tandemDir } from '../utils/paths';
import { createLogger } from '../utils/logger';

const log = createLogger('SidebarManager');

export interface SidebarService {
  id: string;
  name: string;
  url: string;
  partition: string;
  icon: string;         // emoji of SVG pad
  enabled: boolean;
  muted: boolean;
  width: number;
  unreadCount: number;
}

export interface SidebarConfig {
  panels: Record<string, {
    enabled: boolean;
    muted: boolean;
    width: number;
    customUrl?: string;  // voor Slack workspace URL
  }>;
  lastActivePanel: string | null;
  sidebarVisible: boolean;
}

// Standaard services definitie
const DEFAULT_SERVICES: Omit<SidebarService, 'enabled' | 'muted' | 'width' | 'unreadCount'>[] = [
  { id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com', partition: 'persist:whatsapp', icon: '💬' },
  { id: 'discord', name: 'Discord', url: 'https://discord.com/app', partition: 'persist:discord', icon: '🎮' },
  { id: 'slack', name: 'Slack', url: 'https://app.slack.com', partition: 'persist:slack', icon: '💼' },
  { id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org/a/', partition: 'persist:telegram', icon: '✈️' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com', partition: 'persist:instagram', icon: '📷' },
  { id: 'x', name: 'X', url: 'https://x.com', partition: 'persist:x', icon: '𝕏' },
];

export class SidebarManager extends EventEmitter {
  private win: BrowserWindow;
  private config: SidebarConfig;
  private configPath: string;
  private activePanel: string | null = null;
  private sidebarWebContentsIds: Set<number> = new Set();

  constructor(win: BrowserWindow) { /* ... */ }

  // Panel lifecycle
  getServices(): SidebarService[] { /* ... */ }
  getActivePanel(): string | null { /* ... */ }
  togglePanel(serviceId: string): { visible: boolean; service: SidebarService } { /* ... */ }
  openPanel(serviceId: string): SidebarService { /* ... */ }
  closePanel(): void { /* ... */ }

  // Notifications
  updateUnreadCount(serviceId: string, count: number): void { /* ... */ }
  mutePanel(serviceId: string, muted: boolean): void { /* ... */ }

  // Sidebar webContents tracking (voor stealth skip)
  registerWebContentsId(id: number): void { /* ... */ }
  isSidebarWebContents(id: number): boolean { /* ... */ }

  // Config persistence
  private loadConfig(): SidebarConfig { /* ... */ }
  private saveConfig(): void { /* ... */ }

  // Cleanup
  destroy(): void { /* ... */ }
}
```

**Key methods:**
- `getServices()` — retourneert alle 6 services met hun huidige status
- `togglePanel(serviceId)` — toggle panel open/dicht, emit `'panel-toggled'` event
- `openPanel(serviceId)` — open specifiek panel, sluit ander actief panel
- `closePanel()` — sluit actief panel
- `updateUnreadCount(serviceId, count)` — update badge count, emit `'badge-updated'` event
- `isSidebarWebContents(id)` — check of een webContents ID bij een sidebar panel hoort (voor stealth skip)

### Stap 2: API Route bestand

**Wat:** REST endpoints voor sidebar panel management.

**Bestand:** `src/api/routes/sidebar.ts`

**Patroon kopiëren van:** `registerBrowserRoutes()` in `src/api/routes/browser.ts`

```typescript
import type { Router, Request, Response } from 'express';
import type { RouteContext } from '../context';

export function registerSidebarRoutes(router: Router, ctx: RouteContext): void {
  // ═══════════════════════════════════════════════
  // SIDEBAR — Messenger panel management
  // ═══════════════════════════════════════════════

  // GET /sidebar/list — lijst van beschikbare services
  router.get('/sidebar/list', async (req: Request, res: Response) => {
    try {
      const services = ctx.sidebarManager.getServices();
      res.json({ ok: true, services });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /sidebar/panels — alias voor /sidebar/list (backward compat)
  router.get('/sidebar/panels', async (req: Request, res: Response) => {
    try {
      const services = ctx.sidebarManager.getServices();
      res.json({ ok: true, panels: services });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /sidebar/open — open een specifiek panel
  router.post('/sidebar/open', async (req: Request, res: Response) => {
    try {
      const { service } = req.body;
      if (!service) return res.status(400).json({ error: 'Missing required field: service' });
      const result = ctx.sidebarManager.openPanel(service);
      res.json({ ok: true, panel: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /sidebar/close — sluit het actieve panel
  router.post('/sidebar/close', async (req: Request, res: Response) => {
    try {
      ctx.sidebarManager.closePanel();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /sidebar/toggle — toggle panel open/dicht
  router.post('/sidebar/toggle', async (req: Request, res: Response) => {
    try {
      const { service } = req.body;
      if (!service) return res.status(400).json({ error: 'Missing required field: service' });
      const result = ctx.sidebarManager.togglePanel(service);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /sidebar/mute — mute/unmute notifications
  router.post('/sidebar/mute', async (req: Request, res: Response) => {
    try {
      const { service, muted } = req.body;
      if (!service) return res.status(400).json({ error: 'Missing required field: service' });
      ctx.sidebarManager.mutePanel(service, muted !== false);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /sidebar/status — sidebar status overzicht
  router.get('/sidebar/status', async (req: Request, res: Response) => {
    try {
      const activePanel = ctx.sidebarManager.getActivePanel();
      const services = ctx.sidebarManager.getServices();
      const totalUnread = services.reduce((sum, s) => sum + s.unreadCount, 0);
      res.json({ ok: true, activePanel, totalUnread, services });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
```

### Stap 3: Registry + Server wiring

**Wat:** SidebarManager registreren in de ManagerRegistry en route registration.

**Bestand:** `src/registry.ts`

**Toevoegen aan:** `interface ManagerRegistry`

```typescript
import type { SidebarManager } from './sidebar/manager';

// In de interface:
sidebarManager: SidebarManager;
```

**Bestand:** `src/api/server.ts`

**Toevoegen aan:** imports + `setupRoutes()`

```typescript
import { registerSidebarRoutes } from './routes/sidebar';

// In setupRoutes():
registerSidebarRoutes(router, ctx);
```

**Bestand:** `src/main.ts`

**Toevoegen aan:** `startAPI()` functie + registry object + will-quit handler

```typescript
import { SidebarManager } from './sidebar/manager';

// Variabele bovenaan:
let sidebarManager: SidebarManager | null = null;

// In startAPI():
sidebarManager = new SidebarManager(win);

// In registry object:
sidebarManager: sidebarManager!,

// In will-quit:
if (sidebarManager) sidebarManager.destroy();
```

### Stap 4: Stealth skip voor sidebar webviews

**Wat:** Voorkom dat stealth scripts geïnjecteerd worden in sidebar messenger panels.

**Bestand:** `src/main.ts`

**Toevoegen aan:** `app.on('web-contents-created')` handler, in de `dom-ready` callback

De `SidebarManager` houdt een `Set<number>` bij van sidebar webContents IDs. Bij stealth injection checken:

```typescript
contents.on('dom-ready', () => {
  const url = contents.getURL();
  // Bestaande Google auth skip...
  if (url.includes('accounts.google.com') || url.includes('consent.google.com')) {
    return;
  }
  // Skip stealth voor sidebar messenger panels
  if (sidebarManager && sidebarManager.isSidebarWebContents(contents.id)) {
    log.info('📱 Skipping stealth for sidebar panel:', url.substring(0, 60));
    return;
  }
  contents.executeJavaScript(stealthScript).catch(/* ... */);
});
```

### Stap 5: Shell HTML — Sidebar icon strip + panel container

**Wat:** HTML structuur voor de sidebar, ingevoegd in `shell/index.html`.

**Bestand:** `shell/index.html`

**Zoek naar:** `<div class="main-layout">`

**Voeg toe BINNEN de main-layout div, als eerste child (vóór `<div class="browser-content">`):**

```html
<!-- === SIDEBAR CHAT === -->
<div class="sidebar-chat" id="sidebar-chat">
  <!-- Icon strip -->
  <div class="sidebar-icons" id="sidebar-icons">
    <button class="sidebar-icon" data-service="whatsapp" title="WhatsApp">
      <span class="sidebar-icon-emoji">💬</span>
      <span class="sidebar-badge" id="badge-whatsapp" style="display:none;">0</span>
    </button>
    <button class="sidebar-icon" data-service="discord" title="Discord">
      <span class="sidebar-icon-emoji">🎮</span>
      <span class="sidebar-badge" id="badge-discord" style="display:none;">0</span>
    </button>
    <button class="sidebar-icon" data-service="slack" title="Slack">
      <span class="sidebar-icon-emoji">💼</span>
      <span class="sidebar-badge" id="badge-slack" style="display:none;">0</span>
    </button>
    <button class="sidebar-icon" data-service="telegram" title="Telegram">
      <span class="sidebar-icon-emoji">✈️</span>
      <span class="sidebar-badge" id="badge-telegram" style="display:none;">0</span>
    </button>
    <button class="sidebar-icon" data-service="instagram" title="Instagram">
      <span class="sidebar-icon-emoji">📷</span>
      <span class="sidebar-badge" id="badge-instagram" style="display:none;">0</span>
    </button>
    <button class="sidebar-icon" data-service="x" title="X / Twitter">
      <span class="sidebar-icon-emoji">𝕏</span>
      <span class="sidebar-badge" id="badge-x" style="display:none;">0</span>
    </button>
  </div>

  <!-- Panel container (webviews worden hier dynamisch aangemaakt) -->
  <div class="sidebar-panel-container" id="sidebar-panel-container" style="display:none;">
    <div class="sidebar-panel-header" id="sidebar-panel-header">
      <span class="sidebar-panel-title" id="sidebar-panel-title">WhatsApp</span>
      <button class="sidebar-panel-close" id="sidebar-panel-close" title="Sluiten">✕</button>
    </div>
    <div class="sidebar-panel-content" id="sidebar-panel-content">
      <!-- <webview> tags worden hier dynamisch ingevoegd -->
    </div>
  </div>
</div>
<!-- === END SIDEBAR CHAT === -->
```

### Stap 6: Shell CSS — Sidebar styling

**Wat:** CSS voor de sidebar icon strip en panel container.

**Bestand:** `shell/css/sidebar.css` (nieuw bestand)

**Toevoegen aan `shell/index.html`:** `<link rel="stylesheet" href="css/sidebar.css">` (bij de andere CSS imports)

Key styling:
- `.sidebar-chat` — flex container, hoogte 100%
- `.sidebar-icons` — verticale strip, 48px breed, centered icons
- `.sidebar-icon` — 40x40px knoppen met hover effect
- `.sidebar-badge` — rode cirkel met getal, absolute positioned
- `.sidebar-panel-container` — 420px breed, flex column
- `.sidebar-panel-content` — flex: 1, bevat de webview
- `.main-layout` grid aanpassen: voeg sidebar-chat kolom toe

**Belangrijk:** `.main-layout` in `shell/css/main.css` moet worden aangepast van:
```css
.main-layout { display: flex; /* of grid */ }
```
naar een layout die de sidebar icon strip + panel meeneemt als linker kolommen.

### Stap 7: Shell JS — Sidebar interactie

**Wat:** JavaScript voor sidebar click handlers, webview management, IPC communicatie, badge updates.

**Bestand:** `shell/js/main.js` (bestaand bestand uitbreiden)

**Of nieuw bestand:** `shell/js/sidebar.js` (toevoegen als `<script>` in index.html)

Key functionaliteit:
- Click handlers op `.sidebar-icon` knoppen
- Dynamisch aanmaken van `<webview>` tags met juiste partition en URL
- `page-title-updated` event listener op elke sidebar webview voor badge detectie
- Standaard Chrome User-Agent instellen via `webview.setUserAgent()`
- IPC communicatie met main process voor SidebarManager state sync
- Panel resize handle (optioneel in fase 1, kan later)

```javascript
// Sidebar icon click handler
document.querySelectorAll('.sidebar-icon').forEach(btn => {
  btn.addEventListener('click', () => {
    const serviceId = btn.dataset.service;
    toggleSidebarPanel(serviceId);
  });
});

function toggleSidebarPanel(serviceId) {
  // Check of webview al bestaat
  let webview = document.getElementById(`sidebar-wv-${serviceId}`);
  const container = document.getElementById('sidebar-panel-container');
  const content = document.getElementById('sidebar-panel-content');

  if (!webview) {
    // Maak nieuwe webview aan
    webview = document.createElement('webview');
    webview.id = `sidebar-wv-${serviceId}`;
    webview.setAttribute('partition', `persist:${serviceId}`);
    webview.setAttribute('src', SIDEBAR_SERVICES[serviceId].url);
    webview.setAttribute('useragent', CHROME_UA);
    webview.style.cssText = 'width:100%;height:100%;';
    content.appendChild(webview);

    // Badge detectie via page title
    webview.addEventListener('page-title-updated', (e) => {
      const match = e.title.match(/\((\d+)\)/);
      updateBadge(serviceId, match ? parseInt(match[1], 10) : 0);
    });
  }

  // Toggle visibility
  // ...verberg alle andere webviews, toon deze
}
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Lijst van sidebar services
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/sidebar/list
# Verwacht: {"ok":true,"services":[{"id":"whatsapp","name":"WhatsApp",...},{"id":"discord",...},...]}

# Test 2: Open WhatsApp panel
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/open \
  -H "Content-Type: application/json" \
  -d '{"service": "whatsapp"}'
# Verwacht: {"ok":true,"panel":{"id":"whatsapp","name":"WhatsApp","url":"https://web.whatsapp.com",...}}

# Test 3: Sluit panel
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/close
# Verwacht: {"ok":true}

# Test 4: Toggle panel
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/toggle \
  -H "Content-Type: application/json" \
  -d '{"service": "whatsapp"}'
# Verwacht: {"ok":true,"visible":true,"service":{...}}

# Test 5: Status overzicht
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/sidebar/status
# Verwacht: {"ok":true,"activePanel":"whatsapp","totalUnread":0,"services":[...]}

# Test 6: Mute notifications
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/mute \
  -H "Content-Type: application/json" \
  -d '{"service": "whatsapp", "muted": true}'
# Verwacht: {"ok":true}
```

**UI verificatie:**
- [ ] Sidebar icon strip zichtbaar aan de linkerkant van het browservenster (6 emoji iconen verticaal)
- [ ] Klikken op WhatsApp icoon opent een panel (~420px) naast de browsercontent
- [ ] WhatsApp Web laadt in het panel (QR-code login scherm zichtbaar)
- [ ] Nogmaals klikken op WhatsApp icoon sluit het panel
- [ ] Na QR-code login: sessie blijft bewaard na browser herstart
- [ ] Notification badge verschijnt op icoon wanneer ongelezen berichten binnenkomen

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-infrastructure-whatsapp.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. Alle curl tests uit "Acceptatiecriteria" uitvoeren
4. npx vitest run — alle bestaande tests blijven slagen
5. CHANGELOG.md bijwerken met korte entry
6. git commit -m "🗨️ feat: sidebar chat infrastructure + WhatsApp panel"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende sessie start bij fase-2-discord-slack.md
```

---

## Bekende valkuilen

- [ ] Vergeet niet `sidebarManager.destroy()` in de will-quit handler
- [ ] Vergeet niet de `registerSidebarRoutes()` call in `setupRoutes()`
- [ ] WhatsApp Web weigert non-Chrome UA — stel UA in via `webview.setUserAgent()`
- [ ] TypeScript strict mode — geen `any` buiten catch
- [ ] Test in `persist:tandem` sessie (niet in guest) — de sidebar panels gebruiken eigen partitions maar de hoofd-app moet op `persist:tandem` draaien
- [ ] `createWindow()` stealth skip — zorg dat sidebar webContents IDs geregistreerd worden VOORDAT stealth injection plaatsvindt (timing!)
- [ ] `.main-layout` CSS grid/flex aanpassen zodat sidebar er LINKS van de browsercontent bij komt (niet de bestaande layout breken!)
