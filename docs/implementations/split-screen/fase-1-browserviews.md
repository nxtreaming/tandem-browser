# Fase 1 — BrowserViews: SplitScreenManager backend + API

> **Feature:** Split Screen
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw de `SplitScreenManager` die de split screen state beheert: welke tabs in welk paneel, welke layout (vertical/horizontal), en de divider positie. Registreer API endpoints zodat de split screen via REST aangestuurd kan worden. Na deze fase kan je via `curl` een split screen openen en sluiten — de shell UI volgt in fase 2.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/main.ts` | `startAPI()` | Hier wordt SplitScreenManager aangemaakt en geregistreerd |
| `src/main.ts` | `app.on('will-quit')` | Cleanup toevoegen |
| `src/registry.ts` | `interface ManagerRegistry` | SplitScreenManager toevoegen |
| `src/api/server.ts` | `setupRoutes()` | Hier worden route-modules geregistreerd |
| `src/api/routes/tabs.ts` | `registerTabRoutes()` | Referentiepatroon voor route registratie |
| `src/api/context.ts` | `interface RouteContext` | Context type voor route handlers (als dit bestaat, anders skip) |
| `src/tabs/manager.ts` | `class TabManager`, `getTab()`, `listTabs()` | TabManager API die SplitScreenManager nodig heeft |
| `shell/index.html` | `<div class="browser-content">`, `id="webview-container"` | Begrijp de huidige webview layout |

---

## Te bouwen in deze fase

### Stap 1: SplitScreenManager class

**Wat:** Core manager die split screen state beheert. Houdt bij of split actief is, welke tabIds in welk paneel zitten, layout mode, en divider ratio.

**Bestand:** `src/split-screen/manager.ts`

```typescript
export interface SplitLayout {
  mode: 'vertical' | 'horizontal';
  panes: SplitPane[];
  dividerRatio: number; // 0.0-1.0, default 0.5
}

export interface SplitPane {
  tabId: number;
  index: number; // 0 = links/boven, 1 = rechts/onder
}

export class SplitScreenManager {
  private active = false;
  private layout: SplitLayout | null = null;
  private win: BrowserWindow;
  private tabManager: TabManager;

  constructor(win: BrowserWindow, tabManager: TabManager) { ... }

  /** Start split screen met twee tabs */
  async open(opts: { tabId1: number; tabId2: number; layout?: 'vertical' | 'horizontal' }): Promise<SplitLayout> { ... }

  /** Sluit split screen */
  async close(): Promise<void> { ... }

  /** Haal huidige status op */
  getStatus(): { active: boolean; layout: SplitLayout | null } { ... }

  /** Wissel layout (vertical ↔ horizontal) */
  async setLayout(mode: 'vertical' | 'horizontal'): Promise<SplitLayout> { ... }

  /** Verplaats divider */
  async resize(ratio: number): Promise<void> { ... }

  /** Focus een specifiek paneel */
  async focusPane(paneIndex: number): Promise<void> { ... }

  /** Cleanup */
  destroy(): void { ... }
}
```

**Logica:**
- `open()` valideert dat beide tabIds bestaan via `tabManager.getTab()`, slaat de layout op, en stuurt een IPC event naar de shell (`split-screen-open`) met de tab info
- `close()` reset de state en stuurt IPC event `split-screen-close`
- `focusPane()` stuurt IPC event `split-screen-focus` met de pane index
- De shell ontvangt deze IPC events en past de DOM layout aan (fase 2)

### Stap 2: API routes

**Wat:** REST endpoints voor split screen.

**Bestand:** `src/api/routes/split.ts`

**Functie:** `registerSplitRoutes(router, ctx)`

```typescript
import type { Router } from 'express';
import type { RouteContext } from '../context';

export function registerSplitRoutes(router: Router, ctx: RouteContext): void {
  // ═══════════════════════════════════════════════
  // SPLIT SCREEN — Multi-pane browsing
  // ═══════════════════════════════════════════════

  router.post('/split/open', async (req, res) => {
    try {
      const { tabId1, tabId2, layout } = req.body;
      if (tabId1 === undefined || tabId2 === undefined) {
        return res.status(400).json({ error: 'tabId1 and tabId2 required' });
      }
      const result = await ctx.splitScreenManager.open({ tabId1, tabId2, layout });
      res.json({ ok: true, layout: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/split/close', async (req, res) => {
    try {
      await ctx.splitScreenManager.close();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/split/status', (req, res) => {
    try {
      const status = ctx.splitScreenManager.getStatus();
      res.json({ ok: true, ...status });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/split/layout', async (req, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['vertical', 'horizontal'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be "vertical" or "horizontal"' });
      }
      const result = await ctx.splitScreenManager.setLayout(mode);
      res.json({ ok: true, layout: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/split/focus/:paneIndex', async (req, res) => {
    try {
      const paneIndex = parseInt(req.params.paneIndex, 10);
      await ctx.splitScreenManager.focusPane(paneIndex);
      res.json({ ok: true, focusedPane: paneIndex });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/split/resize', async (req, res) => {
    try {
      const { ratio } = req.body;
      if (ratio === undefined || ratio < 0 || ratio > 1) {
        return res.status(400).json({ error: 'ratio must be between 0.0 and 1.0' });
      }
      await ctx.splitScreenManager.resize(ratio);
      res.json({ ok: true, ratio });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
```

### Stap 3: Wiring — registreer manager en routes

**Wat:** SplitScreenManager aansluiten op het systeem.

**Bestand:** `src/registry.ts`
**Toevoegen aan:** `interface ManagerRegistry`

```typescript
splitScreenManager: SplitScreenManager;
```

**Bestand:** `src/main.ts`
**Toevoegen aan:** `startAPI()`

```typescript
import { SplitScreenManager } from './split-screen/manager';

// Na tabManager aanmaak:
const splitScreenManager = new SplitScreenManager(win, tabManager!);

// In registry object:
splitScreenManager: splitScreenManager!,
```

**Toevoegen aan:** `app.on('will-quit')`

```typescript
if (splitScreenManager) splitScreenManager.destroy();
```

**Bestand:** `src/api/server.ts`
**Toevoegen aan:** `setupRoutes()`

```typescript
import { registerSplitRoutes } from './routes/split';

// In setupRoutes():
registerSplitRoutes(router, ctx);
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Open split screen (vertical)
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/split/open \
  -H "Content-Type: application/json" \
  -d '{"tabId1": 1, "tabId2": 2, "layout": "vertical"}'
# Verwacht: {"ok":true, "layout":{"mode":"vertical","panes":[...],"dividerRatio":0.5}}

# Test 2: Haal status op
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/split/status
# Verwacht: {"ok":true, "active":true, "layout":{...}}

# Test 3: Wissel layout
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/split/layout \
  -H "Content-Type: application/json" \
  -d '{"mode": "horizontal"}'
# Verwacht: {"ok":true, "layout":{"mode":"horizontal",...}}

# Test 4: Focus pane
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/split/focus/1
# Verwacht: {"ok":true, "focusedPane":1}

# Test 5: Resize divider
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/split/resize \
  -H "Content-Type: application/json" \
  -d '{"ratio": 0.7}'
# Verwacht: {"ok":true, "ratio":0.7}

# Test 6: Sluit split screen
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/split/close
# Verwacht: {"ok":true}

# Test 7: Status na sluiten
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/split/status
# Verwacht: {"ok":true, "active":false, "layout":null}
```

**Compilatie verificatie:**
- [ ] `npx tsc` — zero errors
- [ ] `npx vitest run` — alle bestaande tests slagen
- [ ] `npm start` — app start zonder crashes

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-browserviews.md) volledig
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
6. git commit -m "🖥️ feat: split screen manager + API endpoints"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende sessie start bij fase-2-shell-ui.md
```

---

## Bekende valkuilen

- [ ] Vergeet niet `destroy()` toe te voegen aan will-quit handler
- [ ] TypeScript strict mode — geen `any` buiten catch blocks
- [ ] Valideer tabIds via `tabManager.getTab()` — gooi error als tab niet bestaat
- [ ] IPC events sturen met `win.webContents.send()` — de shell luistert hier pas naar in fase 2, maar de events moeten al wel verstuurd worden
