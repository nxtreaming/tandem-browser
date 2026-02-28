# Fase 1 — Auto-Grouping: Opener tracking en island data model

> **Feature:** Tab Islands
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw de backend-logica voor Tab Islands: track welke tab door welke parent geopend is (opener chain), groepeer automatisch tabs met dezelfde parent in een eiland, en stel API endpoints beschikbaar om eilanden te beheren. Na deze fase werkt alles via de API — de visuele UI volgt in fase 2.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/tabs/manager.ts` | `class TabManager`, `interface Tab`, `interface TabGroup`, `openTab()`, `setGroup()`, `listGroups()` | Hier komt de island-logica bij — snap de bestaande group-structuur |
| `src/api/routes/tabs.ts` | `function registerTabRoutes()` | Hier komen nieuwe island-endpoints bij |
| `src/main.ts` | `createWindow()` | Hier moet de `did-create-window` listener komen |
| `src/api/context.ts` | `interface RouteContext` | Snap hoe de route context managers doorgeeft |
| `AGENTS.md` | — (lees volledig) | Anti-detect regels en code stijl |

---

## Te bouwen in deze fase

### Stap 1: Island data model toevoegen aan TabManager

**Wat:** Voeg een `TabIsland` interface toe en een `islands` Map aan `class TabManager`. Voeg `openerTabId` toe aan de `Tab` interface om parent-child relaties vast te leggen.

**Bestand:** `src/tabs/manager.ts`

**Toevoegen aan:** `class TabManager` (boven de class definitie voor de interface, in de class voor de Map)

```typescript
export interface TabIsland {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  tabIds: string[];
  originDomain?: string;
}

// Tab interface uitbreiden met:
//   openerTabId?: string;
//   islandId?: string;

// In class TabManager:
//   private islands: Map<string, TabIsland> = new Map();
//   private islandCounter = 0;
//   private readonly ISLAND_COLORS = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#ff6d01', '#46bdc6', '#9334e6', '#e8710a'];
```

### Stap 2: Opener tracking in openTab()

**Wat:** Breid `openTab()` uit met een optionele `openerTabId` parameter. Wanneer een tab geopend wordt met een opener, zoek of de opener al in een eiland zit — zo ja, voeg de nieuwe tab toe. Zo nee, maak een nieuw eiland als de drempel bereikt is (2 tabs vanuit dezelfde parent).

**Bestand:** `src/tabs/manager.ts`

**Aanpassen in:** `openTab()` methode

```typescript
async openTab(url: string = 'about:blank', groupId?: string, source: TabSource = 'robin', partition: string = 'persist:tandem', focus: boolean = true, openerTabId?: string): Promise<Tab> {
  // ... bestaande logica ...

  // Na tab aanmaken:
  if (openerTabId) {
    tab.openerTabId = openerTabId;
    this.autoGroupIntoIsland(tab, openerTabId);
  }

  // ... rest van bestaande logica ...
}
```

### Stap 3: Auto-group logica

**Wat:** Implementeer `autoGroupIntoIsland()` — de kernlogica die beslist of een tab aan een bestaand eiland wordt toegevoegd of dat een nieuw eiland wordt aangemaakt.

**Bestand:** `src/tabs/manager.ts`

**Toevoegen aan:** `class TabManager`

```typescript
private autoGroupIntoIsland(childTab: Tab, openerTabId: string): void {
  const openerTab = this.tabs.get(openerTabId);
  if (!openerTab) return;

  // Check of opener al in een eiland zit
  if (openerTab.islandId) {
    const island = this.islands.get(openerTab.islandId);
    if (island) {
      island.tabIds.push(childTab.id);
      childTab.islandId = island.id;
      this.win.webContents.send('island-updated', island);
      return;
    }
  }

  // Opener zit niet in een eiland — maak een nieuw eiland met opener + child
  const islandId = `island-${++this.islandCounter}`;
  const domain = this.extractDomain(openerTab.url);
  const color = this.ISLAND_COLORS[this.islandCounter % this.ISLAND_COLORS.length];

  const island: TabIsland = {
    id: islandId,
    name: domain || 'New Island',
    color,
    collapsed: false,
    tabIds: [openerTabId, childTab.id],
    originDomain: domain,
  };

  this.islands.set(islandId, island);
  openerTab.islandId = islandId;
  childTab.islandId = islandId;
  this.win.webContents.send('island-created', island);
}

private extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}
```

### Stap 4: Island management methodes

**Wat:** Voeg publieke methodes toe aan `TabManager` voor het ophalen, hernoemen, collapseren en verwijderen van eilanden.

**Bestand:** `src/tabs/manager.ts`

**Toevoegen aan:** `class TabManager`

```typescript
getIslands(): TabIsland[] {
  return Array.from(this.islands.values());
}

getIsland(islandId: string): TabIsland | null {
  return this.islands.get(islandId) || null;
}

renameIsland(islandId: string, name: string): boolean {
  const island = this.islands.get(islandId);
  if (!island) return false;
  island.name = name;
  this.win.webContents.send('island-updated', island);
  return true;
}

toggleIslandCollapse(islandId: string): boolean {
  const island = this.islands.get(islandId);
  if (!island) return false;
  island.collapsed = !island.collapsed;
  this.win.webContents.send('island-updated', island);
  return true;
}

setIslandColor(islandId: string, color: string): boolean {
  const island = this.islands.get(islandId);
  if (!island) return false;
  island.color = color;
  this.win.webContents.send('island-updated', island);
  return true;
}

dissolveIsland(islandId: string): boolean {
  const island = this.islands.get(islandId);
  if (!island) return false;
  for (const tabId of island.tabIds) {
    const tab = this.tabs.get(tabId);
    if (tab) tab.islandId = undefined;
  }
  this.islands.delete(islandId);
  this.win.webContents.send('island-dissolved', { islandId });
  return true;
}

createIslandFromTabs(tabIds: string[], name?: string): TabIsland | null {
  const validTabs = tabIds.filter(id => this.tabs.has(id));
  if (validTabs.length < 2) return null;

  const islandId = `island-${++this.islandCounter}`;
  const firstTab = this.tabs.get(validTabs[0])!;
  const domain = this.extractDomain(firstTab.url);
  const color = this.ISLAND_COLORS[this.islandCounter % this.ISLAND_COLORS.length];

  const island: TabIsland = {
    id: islandId,
    name: name || domain || 'New Island',
    color,
    collapsed: false,
    tabIds: validTabs,
    originDomain: domain,
  };

  this.islands.set(islandId, island);
  for (const tabId of validTabs) {
    const tab = this.tabs.get(tabId)!;
    // Verwijder uit oud eiland indien nodig
    if (tab.islandId) {
      const oldIsland = this.islands.get(tab.islandId);
      if (oldIsland) {
        oldIsland.tabIds = oldIsland.tabIds.filter(id => id !== tabId);
        if (oldIsland.tabIds.length < 2) this.islands.delete(oldIsland.id);
      }
    }
    tab.islandId = islandId;
  }

  this.win.webContents.send('island-created', island);
  return island;
}
```

### Stap 5: closeTab() uitbreiden voor island cleanup

**Wat:** Wanneer een tab gesloten wordt die in een eiland zit, verwijder de tab uit het eiland. Als het eiland minder dan 2 tabs overhoudt, los het eiland op.

**Bestand:** `src/tabs/manager.ts`

**Aanpassen in:** `closeTab()` methode

```typescript
// Na de bestaande group-cleanup logica, vóór removeTab:
if (tab.islandId) {
  const island = this.islands.get(tab.islandId);
  if (island) {
    island.tabIds = island.tabIds.filter(id => id !== tabId);
    if (island.tabIds.length < 2) {
      // Eiland opheffen — resterende tab wordt los
      for (const remainingId of island.tabIds) {
        const remaining = this.tabs.get(remainingId);
        if (remaining) remaining.islandId = undefined;
      }
      this.islands.delete(tab.islandId);
      this.win.webContents.send('island-dissolved', { islandId: tab.islandId });
    } else {
      this.win.webContents.send('island-updated', island);
    }
  }
}
```

### Stap 6: did-create-window listener in main.ts

**Wat:** Luister naar het `did-create-window` event op webContents om te detecteren wanneer een tab een nieuw venster/tab opent. Gebruik de opener webContentsId om de parent tab te identificeren en `openerTabId` door te geven aan `openTab()`.

**Bestand:** `src/main.ts`

**Toevoegen aan:** `createWindow()` functie, na de webview-attach event listener

```typescript
// In createWindow(), na bestaande webContents event listeners:
// Let op: dit moet op de juiste plek komen waar webContents beschikbaar zijn
// Het 'did-create-window' event op de parent webContents
// geeft de child webContents mee — gebruik die om opener te tracken.
```

### Stap 7: API endpoints voor islands

**Wat:** Voeg REST endpoints toe voor eiland-management.

**Bestand:** `src/api/routes/tabs.ts`

**Toevoegen aan:** `function registerTabRoutes()`

```typescript
router.get('/tabs/islands', async (_req: Request, res: Response) => {
  try {
    const islands = ctx.tabManager.getIslands();
    res.json({ ok: true, islands });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tabs/islands/create', async (req: Request, res: Response) => {
  const { tabIds, name } = req.body;
  if (!tabIds || !Array.isArray(tabIds)) {
    res.status(400).json({ error: 'tabIds array required' });
    return;
  }
  try {
    const island = ctx.tabManager.createIslandFromTabs(tabIds, name);
    if (!island) { res.status(400).json({ error: 'Need at least 2 valid tab IDs' }); return; }
    res.json({ ok: true, island });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tabs/islands/:id/rename', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  try {
    const ok = ctx.tabManager.renameIsland(req.params.id, name);
    if (!ok) { res.status(404).json({ error: 'Island not found' }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tabs/islands/:id/collapse', async (req: Request, res: Response) => {
  try {
    const ok = ctx.tabManager.toggleIslandCollapse(req.params.id);
    if (!ok) { res.status(404).json({ error: 'Island not found' }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tabs/islands/:id/color', async (req: Request, res: Response) => {
  const { color } = req.body;
  if (!color) { res.status(400).json({ error: 'color required' }); return; }
  try {
    const ok = ctx.tabManager.setIslandColor(req.params.id, color);
    if (!ok) { res.status(404).json({ error: 'Island not found' }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tabs/islands/:id', async (req: Request, res: Response) => {
  try {
    const ok = ctx.tabManager.dissolveIsland(req.params.id);
    if (!ok) { res.status(404).json({ error: 'Island not found' }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

### Stap 8: openTab API uitbreiden met openerTabId

**Wat:** Breid het bestaande `POST /tabs/open` endpoint uit zodat het een optionele `openerTabId` accepteert en doorgeeft aan `TabManager.openTab()`.

**Bestand:** `src/api/routes/tabs.ts`

**Aanpassen in:** `function registerTabRoutes()` → het bestaande `router.post('/tabs/open', ...)` blok

```typescript
// Bestaande destructuring uitbreiden:
const { url = 'about:blank', groupId, source = 'robin', focus = true, openerTabId } = req.body;

// Doorgeven aan openTab:
const tab = await ctx.tabManager.openTab(url, groupId, tabSource, 'persist:tandem', focus, openerTabId);
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Test 1: Open 2 tabs met dezelfde opener → auto-island
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'
# Verwacht: {"ok":true, "tab": {"id": "tab-2", ...}}
# Noteer het tab ID als PARENT_ID

curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/page1", "openerTabId": "tab-2"}'
# Verwacht: {"ok":true, "tab": {"id": "tab-3", "islandId": "island-1", ...}}

curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/page2", "openerTabId": "tab-2"}'
# Verwacht: tab-4 met islandId "island-1"

# Test 2: Lijst alle eilanden
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/islands
# Verwacht: {"ok":true, "islands": [{"id":"island-1", "name":"google.com", "tabIds":["tab-2","tab-3","tab-4"], ...}]}

# Test 3: Hernoem eiland
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/islands/island-1/rename \
  -H "Content-Type: application/json" \
  -d '{"name": "Headphone Research"}'
# Verwacht: {"ok":true}

# Test 4: Toggle collapse
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/islands/island-1/collapse
# Verwacht: {"ok":true}

# Test 5: Handmatig eiland maken
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/islands/create \
  -H "Content-Type: application/json" \
  -d '{"tabIds": ["tab-3", "tab-4"], "name": "My Island"}'
# Verwacht: {"ok":true, "island": {...}}

# Test 6: Eiland opheffen
curl -H "Authorization: Bearer $TOKEN" \
  -X DELETE http://localhost:8765/tabs/islands/island-1
# Verwacht: {"ok":true}
```

**UI verificatie:**
- [ ] Nog geen visuele verificatie nodig — fase 2 bouwt de UI

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-auto-grouping.md) volledig
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
6. git commit -m "🏝️ feat: tab islands auto-grouping backend + API endpoints"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende sessie start bij fase-2-visual-ui.md
```

---

## Bekende valkuilen

- [ ] `openTab()` signature wijzigt — controleer dat alle bestaande callers (API routes, context menu, etc.) nog werken met de nieuwe optionele parameter
- [ ] `did-create-window` event is niet altijd beschikbaar voor alle soorten tab-openingen — test met `window.open()` vanuit een webview
- [ ] TypeScript strict mode: `islandId` op `Tab` moet optional zijn (`islandId?: string`) zodat bestaande tabs niet breken
- [ ] Vergeet niet de `will-quit` cleanup — islands hoeven niet expliciet opgeruimd te worden (ze zijn in-memory), maar verifieer dat er geen memory leaks zijn
- [ ] `listTabs()` response bevat nu `islandId` en `openerTabId` — controleer dat dit geen bestaande consumers breekt
