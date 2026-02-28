# Fase 1 — Tab Snoozing: Backend + API

> **Feature:** Tab Snoozing
> **Sessies:** 1
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw `SnoozeManager` met volledige snooze/wake logica en registreer REST API endpoints.
Na deze fase: Copilot kan tabs snoozen + waken via API. Nog geen UI.

---

## Bestaande code te lezen — ALLEEN dit

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `AGENTS.md` | — (lees volledig) | Anti-detect regels + code stijl |
| `src/main.ts` | `startAPI()`, `app.on('will-quit')` | Manager registreren + cleanup |
| `src/api/server.ts` | `TandemAPIOptions`, `class TandemAPI` | Nieuwe manager toevoegen |
| `src/api/routes/tabs.ts` | `registerTabRoutes()` | Nieuwe endpoints hier toevoegen |
| `src/tabs/manager.ts` | `TabManager`, `getActiveWebContents()`, `getTabById()` | Bestaande tab access patronen |
| `src/utils/paths.ts` | `tandemDir()`, `ensureDir()` | Storage locatie helpers |

---

## Te bouwen in deze fase

### Stap 1: SnoozeManager class (`src/tabs/snoozing.ts`)

```typescript
import { WebContents } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { tandemDir, ensureDir } from '../utils/paths';
import { TabManager } from './manager';

interface SnoozedTab {
  tabId: string;
  url: string;
  title: string;
  favicon: string;
  snoozedAt: number;
  until?: number; // timestamp ms, optional
}

export class SnoozeManager {
  private snoozed = new Map<string, SnoozedTab>();
  private autoSnoozeTimer?: NodeJS.Timeout;
  private storageFile: string;

  constructor(private tabManager: TabManager) {
    this.storageFile = path.join(tandemDir(), 'snoozed-tabs.json');
    this.load();
  }

  async snooze(tabId: string, until?: number): Promise<void> {
    const wc = this.tabManager.getWebContentsById(tabId);
    if (!wc) throw new Error(`Tab ${tabId} not found`);

    const url = wc.getURL();
    const title = wc.getTitle();
    if (!url || url === 'about:blank') throw new Error('Cannot snooze blank tab');

    this.snoozed.set(tabId, {
      tabId, url, title, favicon: '', snoozedAt: Date.now(), until
    });

    await wc.loadURL('about:blank');
    this.save();
  }

  async wake(tabId: string): Promise<string> {
    const data = this.snoozed.get(tabId);
    if (!data) throw new Error(`Tab ${tabId} is not snoozed`);

    const wc = this.tabManager.getWebContentsById(tabId);
    if (!wc) throw new Error(`Tab ${tabId} not found`);

    await wc.loadURL(data.url);
    this.snoozed.delete(tabId);
    this.save();
    return data.url;
  }

  getSnoozed(): SnoozedTab[] {
    return Array.from(this.snoozed.values());
  }

  isSnoozed(tabId: string): boolean {
    return this.snoozed.has(tabId);
  }

  startAutoSnooze(inactiveMinutes = 30): void {
    this.autoSnoozeTimer = setInterval(() => {
      this.autoSnoozeInactive(inactiveMinutes);
    }, 5 * 60 * 1000); // check every 5 min
  }

  private async autoSnoozeInactive(thresholdMinutes: number): Promise<void> {
    const cutoff = Date.now() - thresholdMinutes * 60 * 1000;
    const tabs = this.tabManager.getAllTabs();
    for (const tab of tabs) {
      if (tab.source === 'copilot') continue; // NEVER auto-snooze copilot tabs
      if (this.isSnoozed(tab.id)) continue;
      if (tab.lastActiveAt && tab.lastActiveAt < cutoff) {
        await this.snooze(tab.id).catch(() => {}); // ignore errors for individual tabs
      }
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        for (const item of data) this.snoozed.set(item.tabId, item);
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    try {
      ensureDir(tandemDir());
      fs.writeFileSync(this.storageFile, JSON.stringify(Array.from(this.snoozed.values()), null, 2));
    } catch { /* ignore */ }
  }

  destroy(): void {
    if (this.autoSnoozeTimer) clearInterval(this.autoSnoozeTimer);
  }
}
```

### Stap 2: API Endpoints (`src/api/routes/tabs.ts`)

Voeg toe aan `function registerTabRoutes()`:

```typescript
// ═══════════════════════════════════════════════
// TAB SNOOZING
// ═══════════════════════════════════════════════

router.post('/tabs/:id/snooze', async (req, res) => {
  try {
    const { until } = req.body; // optional ISO string
    const untilMs = until ? new Date(until).getTime() : undefined;
    await ctx.snoozeManager.snooze(req.params.id, untilMs);
    res.json({ ok: true, tabId: req.params.id, until: until || null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tabs/:id/wake', async (req, res) => {
  try {
    const url = await ctx.snoozeManager.wake(req.params.id);
    res.json({ ok: true, tabId: req.params.id, url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tabs/snoozed', async (_req, res) => {
  try {
    res.json({ ok: true, tabs: ctx.snoozeManager.getSnoozed() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tabs/snooze-inactive', async (req, res) => {
  try {
    const { minutes = 30 } = req.body;
    await ctx.snoozeManager.autoSnoozeInactive(minutes);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

### Stap 3: Manager Wiring

**In `src/api/server.ts`** — voeg toe aan `TandemAPIOptions` interface:
```typescript
snoozeManager: SnoozeManager;
```

**In `src/main.ts`** — in `startAPI()` functie:
```typescript
const snoozeManager = new SnoozeManager(tabManager!);
snoozeManager.startAutoSnooze(30); // auto-snooze na 30 min inactiviteit

// In new TandemAPI({...}):
snoozeManager: snoozeManager!,
```

**In `src/main.ts`** — in `app.on('will-quit')` handler:
```typescript
if (snoozeManager) snoozeManager.destroy();
```

---

## Acceptatiecriteria

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Test 1: Snooze een tab
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/TAB_ID/snooze \
  -H "Content-Type: application/json" \
  -d '{}'
# Verwacht: {"ok":true,"tabId":"...","until":null}

# Test 2: Lijst snoozed tabs
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/snoozed
# Verwacht: {"ok":true,"tabs":[{"tabId":"...","url":"...","title":"..."}]}

# Test 3: Wake een gesnoozede tab
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/TAB_ID/wake
# Verwacht: {"ok":true,"tabId":"...","url":"https://..."}

# Test 4: Snooze met tijdstip
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/TAB_ID/snooze \
  -H "Content-Type: application/json" \
  -d '{"until":"2026-03-01T09:00:00.000Z"}'
# Verwacht: {"ok":true,"until":"2026-03-01T09:00:00.000Z"}
```

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors
2. npm start — app start zonder crashes
3. Alle curl tests uitvoeren en output plakken in rapport
4. npx vitest run — bestaande tests blijven slagen
5. CHANGELOG.md: entry toevoegen
6. git commit -m "💤 feat: tab snoozing backend + REST API"
7. git push
8. Rapport: Gebouwd / Getest / Problemen / Volgende sessie start bij fase-2
```

---

## Bekende valkuilen

- [ ] `tabManager.getWebContentsById()` — check of deze methode bestaat, anders `getActiveWebContents()` gebruiken en ID vergelijken
- [ ] `tab.lastActiveAt` — controleer of TabManager dit bijhoudt, anders implementeren in deze fase
- [ ] NOOIT copilot-tabs automatisch snoozen (check `tab.source === 'copilot'`)
