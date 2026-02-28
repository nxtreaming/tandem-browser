# Fase 1 — Backend: PinboardManager + REST API

> **Feature:** Pinboards
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw de complete backend voor Pinboards: een `PinboardManager` class die borden en items beheert met JSON-opslag, plus alle REST API endpoints. Na deze fase zijn alle CRUD-operaties bruikbaar via `curl`. De UI komt in fase 2.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/bookmarks/manager.ts` | `class BookmarkManager`, `load()`, `save()`, `generateId()` | Exact hetzelfde storage patroon kopiëren |
| `src/api/routes/data.ts` | `registerDataRoutes()` | Route patroon kopiëren (try/catch, handleRouteError, response format) |
| `src/registry.ts` | `interface ManagerRegistry` | Hier `pinboardManager` toevoegen |
| `src/api/server.ts` | `setupRoutes()` | Hier `registerPinboardRoutes()` importeren en aanroepen |
| `src/main.ts` | `startAPI()`, `app.on('will-quit')` | Manager instantiëren en registreren |
| `src/utils/paths.ts` | `tandemDir()`, `ensureDir()` | Voor storage pad (`~/.tandem/pinboards/`) |
| `src/utils/errors.ts` | `handleRouteError()` | Voor error handling in routes |
| `src/api/context.ts` | `type RouteContext` | Begrijpen hoe routes context ontvangen |

---

## Te bouwen in deze fase

### Stap 1: PinboardManager class

**Wat:** Core data manager die borden en items beheert. JSON opslag in `~/.tandem/pinboards/boards.json`. Volg exact het patroon van `BookmarkManager`: constructor laadt data, elke mutatie roept `save()` aan.

**Bestand:** `src/pinboards/manager.ts`

```typescript
import path from 'path';
import fs from 'fs';
import { tandemDir, ensureDir } from '../utils/paths';
import { createLogger } from '../utils/logger';

const log = createLogger('PinboardManager');

export interface Pinboard {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
  updatedAt: string;
  items: PinboardItem[];
}

export interface PinboardItem {
  id: string;
  type: 'link' | 'image' | 'text' | 'quote';
  url?: string;
  title?: string;
  content?: string;
  thumbnail?: string;
  note?: string;
  sourceUrl?: string;
  createdAt: string;
  position: number;
}

interface PinboardStore {
  boards: Pinboard[];
  lastModified: string;
}

export class PinboardManager {
  private storePath: string;
  private store: PinboardStore;

  constructor() {
    const dir = ensureDir(tandemDir('pinboards'));
    this.storePath = path.join(dir, 'boards.json');
    this.store = this.load();
  }

  private load(): PinboardStore {
    // Laad bestaand bestand of maak leeg store object
    // Zie BookmarkManager.load() voor exact patroon
  }

  private save(): void {
    // Update lastModified, schrijf JSON naar disk
    // Zie BookmarkManager.save() voor exact patroon
  }

  private generateId(): string {
    // Zelfde patroon als BookmarkManager:
    // Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
  }

  // --- Board CRUD ---

  listBoards(): Array<{ id: string; name: string; emoji: string; itemCount: number; createdAt: string; updatedAt: string }> {
    // Retourneer alle borden ZONDER items (voor sidebar lijst)
    // Voeg itemCount toe als computed veld
  }

  getBoard(boardId: string): Pinboard | null {
    // Retourneer één bord MET alle items
  }

  createBoard(name: string, emoji?: string): Pinboard {
    // Maak nieuw bord, default emoji "📌"
    // save() aanroepen
  }

  updateBoard(boardId: string, updates: { name?: string; emoji?: string }): Pinboard | null {
    // Update naam en/of emoji, updatedAt bijwerken
    // save() aanroepen
  }

  deleteBoard(boardId: string): boolean {
    // Verwijder bord en alle items
    // save() aanroepen
  }

  // --- Item CRUD ---

  getItems(boardId: string): PinboardItem[] | null {
    // Retourneer items gesorteerd op position
    // null als board niet bestaat
  }

  addItem(boardId: string, item: Omit<PinboardItem, 'id' | 'createdAt' | 'position'>): PinboardItem | null {
    // Voeg item toe aan bord, genereer id/createdAt/position
    // position = huidige items.length (toevoegen aan einde)
    // save() aanroepen
    // null als board niet bestaat
  }

  updateItem(boardId: string, itemId: string, updates: { title?: string; note?: string; content?: string }): PinboardItem | null {
    // Update item velden, board updatedAt bijwerken
    // save() aanroepen
  }

  deleteItem(boardId: string, itemId: string): boolean {
    // Verwijder item, herbereken positions van overige items
    // save() aanroepen
  }

  reorderItems(boardId: string, itemIds: string[]): boolean {
    // Zet positions op basis van volgorde in itemIds array
    // save() aanroepen
  }

  destroy(): void {
    // Cleanup (momenteel noop — geen file watchers of timers)
  }
}
```

### Stap 2: API Routes

**Wat:** REST endpoints voor alle CRUD-operaties. Volg exact het patroon van `registerDataRoutes()` in `src/api/routes/data.ts`.

**Bestand:** `src/api/routes/pinboards.ts`

```typescript
import type { Router, Request, Response } from 'express';
import type { RouteContext } from '../context';
import { handleRouteError } from '../../utils/errors';

export function registerPinboardRoutes(router: Router, ctx: RouteContext): void {
  // ═══════════════════════════════════════════════
  // PINBOARDS — Content Curation Boards
  // ═══════════════════════════════════════════════

  // GET /pinboards — lijst van alle borden (zonder items)
  router.get('/pinboards', (req: Request, res: Response) => {
    try {
      const boards = ctx.pinboardManager.listBoards();
      res.json({ ok: true, boards });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // POST /pinboards — nieuw bord aanmaken
  router.post('/pinboards', (req: Request, res: Response) => {
    try {
      const { name, emoji } = req.body;
      if (!name) { res.status(400).json({ error: 'name required' }); return; }
      const board = ctx.pinboardManager.createBoard(name, emoji);
      res.json({ ok: true, board });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // GET /pinboards/:id — bord ophalen met items
  router.get('/pinboards/:id', (req: Request, res: Response) => {
    try {
      const board = ctx.pinboardManager.getBoard(req.params.id);
      if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
      res.json({ ok: true, board });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // PUT /pinboards/:id — bord bijwerken
  router.put('/pinboards/:id', (req: Request, res: Response) => {
    try {
      const { name, emoji } = req.body;
      const board = ctx.pinboardManager.updateBoard(req.params.id, { name, emoji });
      if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
      res.json({ ok: true, board });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // DELETE /pinboards/:id — bord verwijderen
  router.delete('/pinboards/:id', (req: Request, res: Response) => {
    try {
      const deleted = ctx.pinboardManager.deleteBoard(req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Board not found' }); return; }
      res.json({ ok: true });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // GET /pinboards/:id/items — items van een bord
  router.get('/pinboards/:id/items', (req: Request, res: Response) => {
    try {
      const items = ctx.pinboardManager.getItems(req.params.id);
      if (items === null) { res.status(404).json({ error: 'Board not found' }); return; }
      res.json({ ok: true, items });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // POST /pinboards/:id/items — item toevoegen
  router.post('/pinboards/:id/items', (req: Request, res: Response) => {
    try {
      const { type, url, title, content, thumbnail, note, sourceUrl } = req.body;
      if (!type) { res.status(400).json({ error: 'type required' }); return; }
      if (!['link', 'image', 'text', 'quote'].includes(type)) {
        res.status(400).json({ error: 'type must be link, image, text, or quote' }); return;
      }
      const item = ctx.pinboardManager.addItem(req.params.id, {
        type, url, title, content, thumbnail, note, sourceUrl
      });
      if (!item) { res.status(404).json({ error: 'Board not found' }); return; }
      res.json({ ok: true, item });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // PUT /pinboards/:id/items/:itemId — item bijwerken
  router.put('/pinboards/:id/items/:itemId', (req: Request, res: Response) => {
    try {
      const { title, note, content } = req.body;
      const item = ctx.pinboardManager.updateItem(req.params.id, req.params.itemId, {
        title, note, content
      });
      if (!item) { res.status(404).json({ error: 'Board or item not found' }); return; }
      res.json({ ok: true, item });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // DELETE /pinboards/:id/items/:itemId — item verwijderen
  router.delete('/pinboards/:id/items/:itemId', (req: Request, res: Response) => {
    try {
      const deleted = ctx.pinboardManager.deleteItem(req.params.id, req.params.itemId);
      if (!deleted) { res.status(404).json({ error: 'Board or item not found' }); return; }
      res.json({ ok: true });
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  // POST /pinboards/:id/items/reorder — items herordenen
  router.post('/pinboards/:id/items/reorder', (req: Request, res: Response) => {
    try {
      const { itemIds } = req.body;
      if (!itemIds || !Array.isArray(itemIds)) {
        res.status(400).json({ error: 'itemIds array required' }); return;
      }
      const reordered = ctx.pinboardManager.reorderItems(req.params.id, itemIds);
      if (!reordered) { res.status(404).json({ error: 'Board not found' }); return; }
      res.json({ ok: true });
    } catch (e) {
      handleRouteError(res, e);
    }
  });
}
```

### Stap 3: Registry Wiring

**Wat:** `PinboardManager` registreren in de centrale registry zodat routes en context menu er bij kunnen.

**Bestand: `src/registry.ts`**

Voeg toe aan de imports:
```typescript
import type { PinboardManager } from './pinboards/manager';
```

Voeg toe aan `interface ManagerRegistry`:
```typescript
pinboardManager: PinboardManager;
```

**Bestand: `src/api/server.ts`**

Voeg toe aan de imports:
```typescript
import { registerPinboardRoutes } from './routes/pinboards';
```

Voeg toe in `setupRoutes()`:
```typescript
registerPinboardRoutes(router, ctx);
```

**Bestand: `src/main.ts`**

Zoek naar het blok waar managers worden geïnstantieerd (bij `startAPI()` of in het registry-object). Voeg toe:
```typescript
import { PinboardManager } from './pinboards/manager';

const pinboardManager = new PinboardManager();

// In het registry object:
pinboardManager,
```

In `app.on('will-quit')`:
```typescript
pinboardManager.destroy();
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Test 1: Lijst borden (leeg)
curl -s http://localhost:8765/pinboards | jq .
# Verwacht: {"ok":true,"boards":[]}

# Test 2: Bord aanmaken
curl -s -X POST http://localhost:8765/pinboards \
  -H "Content-Type: application/json" \
  -d '{"name": "Research Project", "emoji": "🔬"}' | jq .
# Verwacht: {"ok":true,"board":{"id":"...","name":"Research Project","emoji":"🔬",...}}
# ⬆️ Sla het board ID op voor volgende tests:
BOARD_ID=$(curl -s -X POST http://localhost:8765/pinboards \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Board", "emoji": "🧪"}' | jq -r '.board.id')

# Test 3: Lijst borden (niet leeg)
curl -s http://localhost:8765/pinboards | jq .
# Verwacht: {"ok":true,"boards":[{"id":"...","name":"...","emoji":"...","itemCount":0,...}]}

# Test 4: Bord ophalen
curl -s http://localhost:8765/pinboards/$BOARD_ID | jq .
# Verwacht: {"ok":true,"board":{"id":"...","items":[],...}}

# Test 5: Bord bijwerken
curl -s -X PUT http://localhost:8765/pinboards/$BOARD_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Board", "emoji": "✅"}' | jq .
# Verwacht: {"ok":true,"board":{"name":"Updated Board","emoji":"✅",...}}

# Test 6: Link item toevoegen
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "link", "url": "https://example.com", "title": "Example Site"}' | jq .
# Verwacht: {"ok":true,"item":{"id":"...","type":"link","url":"https://example.com",...}}

# Test 7: Quote item toevoegen
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "quote", "content": "Dit is een interessant citaat", "sourceUrl": "https://article.com"}' | jq .
# Verwacht: {"ok":true,"item":{"id":"...","type":"quote","content":"Dit is een interessant citaat",...}}

# Test 8: Image item toevoegen
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "image", "url": "https://example.com/photo.jpg", "title": "Mooie foto"}' | jq .
# Verwacht: {"ok":true,"item":{"id":"...","type":"image",...}}

# Test 9: Items ophalen
curl -s http://localhost:8765/pinboards/$BOARD_ID/items | jq .
# Verwacht: {"ok":true,"items":[...3 items gesorteerd op position...]}

# Test 10: Item bijwerken (notitie toevoegen)
ITEM_ID=$(curl -s http://localhost:8765/pinboards/$BOARD_ID/items | jq -r '.items[0].id')
curl -s -X PUT http://localhost:8765/pinboards/$BOARD_ID/items/$ITEM_ID \
  -H "Content-Type: application/json" \
  -d '{"note": "Hier later naar kijken"}' | jq .
# Verwacht: {"ok":true,"item":{"note":"Hier later naar kijken",...}}

# Test 11: Items herordenen
ITEM_IDS=$(curl -s http://localhost:8765/pinboards/$BOARD_ID/items | jq '[.items[].id]')
# Draai de volgorde om:
REVERSED=$(echo $ITEM_IDS | jq 'reverse')
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items/reorder \
  -H "Content-Type: application/json" \
  -d "{\"itemIds\": $REVERSED}" | jq .
# Verwacht: {"ok":true}

# Test 12: Item verwijderen
curl -s -X DELETE http://localhost:8765/pinboards/$BOARD_ID/items/$ITEM_ID | jq .
# Verwacht: {"ok":true}

# Test 13: Bord verwijderen
curl -s -X DELETE http://localhost:8765/pinboards/$BOARD_ID | jq .
# Verwacht: {"ok":true}

# Test 14: Niet-bestaand bord
curl -s http://localhost:8765/pinboards/nonexistent | jq .
# Verwacht: {"error":"Board not found"} met status 404

# Test 15: Validatie — ontbrekend veld
curl -s -X POST http://localhost:8765/pinboards \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Verwacht: {"error":"name required"} met status 400

# Test 16: Validatie — ongeldig type
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "video"}' | jq .
# Verwacht: {"error":"type must be link, image, text, or quote"} met status 400

# Test 17: Storage check — bestand bestaat
ls -la ~/.tandem/pinboards/boards.json
# Verwacht: bestand bestaat met JSON inhoud
```

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-backend-api.md) volledig
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
6. git commit -m "📌 feat: PinboardManager + REST API endpoints"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende sessie start bij fase-2-ui-panel.md
```

---

## Bekende valkuilen

- [ ] **Vergeet niet `ensureDir()`** — de `~/.tandem/pinboards/` directory moet bestaan voor eerste schrijf
- [ ] **Vergeet niet registry wiring** — 3 plekken: `registry.ts`, `main.ts` (instantiëren + will-quit), `server.ts` (routes)
- [ ] **Position herberekenen bij delete** — als item met position 1 wordt verwijderd, moeten items met position 2+ naar beneden schuiven
- [ ] **TypeScript strict mode** — geen `any` buiten catch blocks. Gebruik `handleRouteError()` in plaats van `(e: any) => res.status(500).json()`
- [ ] **Lege emoji default** — als geen emoji wordt meegegeven, gebruik "📌" als default
- [ ] **JSON encoding** — `JSON.stringify(store, null, 2)` voor leesbare opslag (zelfde als BookmarkManager)
