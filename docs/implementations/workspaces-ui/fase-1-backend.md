# Fase 1 — Backend: WorkspaceManager + Tab Mapping + API

> **Feature:** Workspaces UI
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw de `WorkspaceManager` die workspace metadata beheert (naam, kleur, emoji) en tabs aan workspaces koppelt. De manager bouwt bovenop de bestaande `SessionManager` — elke workspace correspondeert 1:1 met een sessie. Registreer API endpoints zodat workspaces via REST aangestuurd kunnen worden. Na deze fase kan je via `curl` workspaces aanmaken, wisselen, en tabs verplaatsen.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/sessions/manager.ts` | `class SessionManager`, `create()`, `setActive()`, `list()` | WorkspaceManager delegeert session operaties hiernaartoe |
| `src/sessions/types.ts` | `interface Session` | Session data model begrijpen |
| `src/tabs/manager.ts` | `class TabManager`, `listTabs()`, `getTab()` | Tab→workspace mapping |
| `src/main.ts` | `startAPI()` | Hier wordt WorkspaceManager aangemaakt en geregistreerd |
| `src/main.ts` | `app.on('will-quit')` | Cleanup toevoegen |
| `src/registry.ts` | `interface ManagerRegistry` | WorkspaceManager toevoegen |
| `src/api/server.ts` | `setupRoutes()` | Route-module registreren |
| `src/api/routes/sessions.ts` | `registerSessionRoutes()` | Referentiepatroon voor route registratie |

---

## Te bouwen in deze fase

### Stap 1: WorkspaceManager class

**Wat:** Manager die workspace metadata en tab-toewijzingen beheert. Elke workspace mapt op een SessionManager sessie. Metadata wordt opgeslagen in `~/.tandem/workspaces.json`.

**Bestand:** `src/workspaces/manager.ts`

```typescript
import { SessionManager } from '../sessions/manager';
import { TabManager } from '../tabs/manager';

export interface WorkspaceMetadata {
  name: string;
  color: string;      // hex kleur, bv. '#4285f4'
  emoji: string;       // bv. '💼' of 'W'
  order: number;       // volgorde in de strip
  isDefault: boolean;
  tabIds: number[];    // tabs die bij deze workspace horen
}

export class WorkspaceManager {
  private workspaces: Map<string, WorkspaceMetadata> = new Map();
  private sessionManager: SessionManager;
  private tabManager: TabManager;

  constructor(sessionManager: SessionManager, tabManager: TabManager) { ... }

  /** Laad workspace metadata van disk */
  private loadFromDisk(): void { ... }

  /** Sla workspace metadata op naar disk */
  private saveToDisk(): void { ... }

  /** Lijst alle workspaces */
  list(): WorkspaceMetadata[] { ... }

  /** Maak nieuwe workspace (= session + metadata) */
  create(opts: { name: string; color?: string; emoji?: string }): WorkspaceMetadata { ... }

  /** Verwijder workspace (tabs gaan naar default) */
  remove(name: string): void { ... }

  /** Activeer workspace (= session switch + notificatie) */
  switch(name: string): WorkspaceMetadata { ... }

  /** Haal actieve workspace op */
  getActive(): WorkspaceMetadata { ... }

  /** Update workspace metadata */
  update(name: string, opts: { color?: string; emoji?: string; newName?: string }): WorkspaceMetadata { ... }

  /** Verplaats tab naar workspace */
  moveTab(tabId: number, workspaceName: string): void { ... }

  /** Haal tabs op voor een workspace */
  getTabs(workspaceName: string): number[] { ... }

  /** Wijs nieuw geopende tab toe aan actieve workspace */
  assignTabToActive(tabId: number): void { ... }

  /** Cleanup */
  destroy(): void { ... }
}
```

**Kernlogica:**
- `create()` roept `sessionManager.create(name)` aan en voegt metadata toe
- `switch()` roept `sessionManager.setActive(name)` aan en stuurt IPC event `workspace-switched` naar de shell
- `moveTab()` verplaatst tabId van de ene workspace's `tabIds` array naar de andere
- `assignTabToActive()` wordt aangeroepen wanneer een nieuwe tab geopend wordt — voegt tabId toe aan actieve workspace
- Default workspace heeft standaard kleur `#4285f4` (blauw) en emoji `🏠`

### Stap 2: Persistence — workspaces.json

**Wat:** Workspace metadata opslaan in `~/.tandem/workspaces.json` zodat het browser restarts overleeft.

**Bestand:** `src/workspaces/manager.ts` (in `loadFromDisk()` en `saveToDisk()`)

```typescript
// ~/.tandem/workspaces.json
{
  "workspaces": [
    {
      "name": "default",
      "color": "#4285f4",
      "emoji": "🏠",
      "order": 0,
      "isDefault": true,
      "tabIds": [1, 2, 3]
    },
    {
      "name": "Work",
      "color": "#4ecca3",
      "emoji": "💼",
      "order": 1,
      "isDefault": false,
      "tabIds": [4, 5]
    }
  ]
}
```

### Stap 3: API routes

**Wat:** REST endpoints voor workspace management.

**Bestand:** `src/api/routes/workspaces.ts`

**Functie:** `registerWorkspaceRoutes(router, ctx)`

```typescript
export function registerWorkspaceRoutes(router: Router, ctx: RouteContext): void {
  // ═══════════════════════════════════════════════
  // WORKSPACES — Visual workspace management
  // ═══════════════════════════════════════════════

  router.get('/workspaces', (req, res) => { ... });
  router.post('/workspaces', (req, res) => { ... });
  router.delete('/workspaces/:name', (req, res) => { ... });
  router.post('/workspaces/:name/switch', (req, res) => { ... });
  router.put('/workspaces/:name', (req, res) => { ... });
  router.post('/workspaces/:name/move-tab', (req, res) => { ... });
  router.get('/workspaces/:name/tabs', (req, res) => { ... });
}
```

### Stap 4: Wiring — registreer manager en routes

**Bestand:** `src/registry.ts` — voeg `workspaceManager: WorkspaceManager` toe aan interface

**Bestand:** `src/main.ts` — instantieer in `startAPI()`:
```typescript
import { WorkspaceManager } from './workspaces/manager';
const workspaceManager = new WorkspaceManager(sessionManager!, tabManager!);
```

Voeg toe aan registry object en will-quit cleanup.

**Bestand:** `src/api/server.ts` — registreer routes in `setupRoutes()`:
```typescript
import { registerWorkspaceRoutes } from './routes/workspaces';
registerWorkspaceRoutes(router, ctx);
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Lijst workspaces (alleen default)
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/workspaces
# Verwacht: {"ok":true, "workspaces":[{"name":"default","color":"#4285f4","emoji":"🏠","order":0,"isDefault":true,"tabIds":[...]}]}

# Test 2: Maak nieuwe workspace
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name": "Work", "color": "#4ecca3", "emoji": "💼"}'
# Verwacht: {"ok":true, "workspace":{"name":"Work","color":"#4ecca3","emoji":"💼","order":1,...}}

# Test 3: Switch naar nieuwe workspace
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/workspaces/Work/switch
# Verwacht: {"ok":true, "workspace":{"name":"Work",...}}

# Test 4: Verplaats tab naar workspace
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/workspaces/Work/move-tab \
  -H "Content-Type: application/json" \
  -d '{"tabId": 1}'
# Verwacht: {"ok":true}

# Test 5: Haal tabs op voor workspace
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/workspaces/Work/tabs
# Verwacht: {"ok":true, "tabIds":[1]}

# Test 6: Update workspace metadata
curl -H "Authorization: Bearer $TOKEN" \
  -X PUT http://localhost:8765/workspaces/Work \
  -H "Content-Type: application/json" \
  -d '{"color": "#e94560", "emoji": "🔥"}'
# Verwacht: {"ok":true, "workspace":{"name":"Work","color":"#e94560","emoji":"🔥",...}}

# Test 7: Verwijder workspace
curl -H "Authorization: Bearer $TOKEN" \
  -X DELETE http://localhost:8765/workspaces/Work
# Verwacht: {"ok":true}

# Test 8: Kan default niet verwijderen
curl -H "Authorization: Bearer $TOKEN" \
  -X DELETE http://localhost:8765/workspaces/default
# Verwacht: {"error":"Cannot delete the default workspace"}
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
2. Lees DIT bestand (fase-1-backend.md) volledig
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
6. git commit -m "🏢 feat: workspace manager + API endpoints"
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
- [ ] Vergeet niet `saveToDisk()` aan te roepen na elke mutatie (create, update, remove, moveTab)
- [ ] TypeScript strict mode — geen `any` buiten catch blocks
- [ ] Tab IDs kunnen hergebruikt worden na tab sluiting — clean stale tabIds uit workspace data bij laden
- [ ] SessionManager.create() gooit error als sessie al bestaat — WorkspaceManager moet dit afhandelen
