# Fase 2 — UI: Sidebar Panel + Context Menu

> **Feature:** Pinboards
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Fase 1 klaar (PinboardManager + API endpoints werken)

---

## Doel van deze fase

Bouw de gebruikersinterface voor Pinboards: een sidebar-icoon dat een paneel opent met een lijst van borden en hun items, plus rechtermuisknop-integratie om content direct naar een Pinboard te saven. Na deze fase kan Robin via de UI borden bekijken en via de context menu content toevoegen.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/pinboards/manager.ts` | `class PinboardManager` | Fase 1 output — de manager die we aanroepen |
| `src/context-menu/types.ts` | `interface ContextMenuDeps` | Hier `pinboardManager` aan toevoegen |
| `src/context-menu/menu-builder.ts` | `class ContextMenuBuilder`, `build()`, `addTandemItems()` | Hier "Save to Pinboard" items toevoegen |
| `src/context-menu/manager.ts` | `class ContextMenuManager` | Begrijpen hoe deps worden doorgegeven |
| `shell/index.html` | Sidebar sectie, `ocChat` IIFE | UI patroon voor panelen |
| `src/main.ts` | `new ContextMenuManager(...)` | Hier `pinboardManager` meegeven in deps |

---

## Te bouwen in deze fase

### Stap 1: Context Menu — ContextMenuDeps uitbreiden

**Wat:** `PinboardManager` toevoegen aan de context menu dependencies zodat de builder er bij kan.

**Bestand:** `src/context-menu/types.ts`

**Toevoegen aan:** `interface ContextMenuDeps`

```typescript
import type { PinboardManager } from '../pinboards/manager';

export interface ContextMenuDeps {
  // ... bestaande deps ...
  pinboardManager: PinboardManager;
}
```

**Bestand:** `src/main.ts`

**Zoek naar:** het blok waar `ContextMenuManager` wordt geïnstantieerd. Voeg `pinboardManager` toe aan het deps object.

### Stap 2: Context Menu — "Save to Pinboard" items

**Wat:** Drie context menu items afhankelijk van de klik-context: link saven, afbeelding saven, selectie saven. Elke optie toont een submenu met beschikbare borden.

**Bestand:** `src/context-menu/menu-builder.ts`

**Nieuwe methode:** `addPinboardItems()`

```typescript
/**
 * Add "Save to Pinboard" items based on context.
 * Shows submenu with available boards.
 */
private addPinboardItems(menu: Menu, params: ContextMenuParams, wc: WebContents): void {
  const boards = this.deps.pinboardManager.listBoards();
  if (boards.length === 0) return; // Geen borden = geen menu items

  this.addSeparator(menu);

  // Save page to Pinboard (altijd beschikbaar)
  menu.append(new MenuItem({
    label: 'Save Page to Pinboard',
    submenu: boards.map(board => ({
      label: `${board.emoji} ${board.name}`,
      click: () => {
        this.deps.pinboardManager.addItem(board.id, {
          type: 'link',
          url: params.pageURL,
          title: wc.getTitle(),
          sourceUrl: params.pageURL,
        });
      }
    }))
  }));

  // Save link to Pinboard (als er een link is)
  if (params.linkURL && isSafeURL(params.linkURL)) {
    menu.append(new MenuItem({
      label: 'Save Link to Pinboard',
      submenu: boards.map(board => ({
        label: `${board.emoji} ${board.name}`,
        click: () => {
          this.deps.pinboardManager.addItem(board.id, {
            type: 'link',
            url: params.linkURL,
            title: params.linkText || params.linkURL,
            sourceUrl: params.pageURL,
          });
        }
      }))
    }));
  }

  // Save image to Pinboard (als er een afbeelding is)
  if (params.mediaType === 'image' && params.srcURL) {
    menu.append(new MenuItem({
      label: 'Save Image to Pinboard',
      submenu: boards.map(board => ({
        label: `${board.emoji} ${board.name}`,
        click: () => {
          this.deps.pinboardManager.addItem(board.id, {
            type: 'image',
            url: params.srcURL,
            sourceUrl: params.pageURL,
          });
        }
      }))
    }));
  }

  // Save selection to Pinboard (als er tekst geselecteerd is)
  if (params.selectionText) {
    menu.append(new MenuItem({
      label: 'Save Selection to Pinboard',
      submenu: boards.map(board => ({
        label: `${board.emoji} ${board.name}`,
        click: () => {
          this.deps.pinboardManager.addItem(board.id, {
            type: 'quote',
            content: params.selectionText,
            sourceUrl: params.pageURL,
          });
        }
      }))
    }));
  }
}
```

**Aanroepen vanuit `build()`:** Voeg `this.addPinboardItems(menu, params, wc)` toe na `this.addTandemItems()` (aan het einde van de `build()` methode).

### Stap 3: Sidebar Pinboard Icoon

**Wat:** Een pinboard-icoon in de sidebar die het pinboard-paneel opent/sluit. Dit is een toggle — klik opent het paneel, nogmaals klikken sluit het.

**Bestand:** `shell/index.html`

**Zoek naar:** de sidebar icon-strip sectie. Voeg een nieuw icoon toe:

```html
<!-- Pinboard sidebar icon -->
<button class="sidebar-icon" id="pinboard-toggle" title="Pinboards">
  📌
</button>
```

**Stijl:** Volg exact het patroon van bestaande sidebar-iconen (dezelfde class, dezelfde hover/active states).

### Stap 4: Pinboard Paneel UI

**Wat:** Een paneel dat opent als het sidebar-icoon wordt geklikt. Toont een lijst van borden en de items van het geselecteerde bord. Haalt data op via `fetch()` naar de `/pinboards` API.

**Bestand:** `shell/index.html`

**Structuur:**

```html
<!-- Pinboard Panel -->
<div id="pinboard-panel" class="panel" style="display:none;">
  <div class="pinboard-header">
    <h3>Pinboards</h3>
    <button id="pinboard-new-btn" title="New board">+</button>
  </div>

  <!-- Board list -->
  <div id="pinboard-board-list" class="pinboard-boards">
    <!-- Dynamisch gevuld via JS -->
  </div>

  <!-- Items van geselecteerd board -->
  <div id="pinboard-items" class="pinboard-items" style="display:none;">
    <div class="pinboard-items-header">
      <button id="pinboard-back-btn">← Boards</button>
      <span id="pinboard-board-name"></span>
    </div>
    <div id="pinboard-item-list">
      <!-- Dynamisch gevuld via JS -->
    </div>
  </div>
</div>
```

### Stap 5: Pinboard JavaScript (IIFE)

**Wat:** Alle client-side logica voor het Pinboard paneel. Laadt borden via API, toont ze als lijst, handelt klikken af, toont items per bord.

**Bestand:** `shell/index.html`

**Patroon:** Maak een IIFE sectie, vergelijkbaar met `ocChat`:

```javascript
// === Pinboard Panel ===
const pinboardPanel = (() => {
  const API = 'http://localhost:8765';
  let currentBoardId = null;

  async function loadBoards() {
    const res = await fetch(`${API}/pinboards`);
    const data = await res.json();
    renderBoardList(data.boards);
  }

  function renderBoardList(boards) {
    const container = document.getElementById('pinboard-board-list');
    container.innerHTML = '';
    if (boards.length === 0) {
      container.innerHTML = '<p class="empty-state">Nog geen boards. Klik + om er een te maken.</p>';
      return;
    }
    boards.forEach(board => {
      const el = document.createElement('div');
      el.className = 'pinboard-board-item';
      el.innerHTML = `
        <span class="board-emoji">${board.emoji}</span>
        <span class="board-name">${board.name}</span>
        <span class="board-count">${board.itemCount}</span>
      `;
      el.addEventListener('click', () => openBoard(board.id, board.name, board.emoji));
      container.appendChild(el);
    });
  }

  async function openBoard(boardId, name, emoji) {
    currentBoardId = boardId;
    document.getElementById('pinboard-board-list').style.display = 'none';
    document.getElementById('pinboard-items').style.display = 'block';
    document.getElementById('pinboard-board-name').textContent = `${emoji} ${name}`;

    const res = await fetch(`${API}/pinboards/${boardId}/items`);
    const data = await res.json();
    renderItems(data.items);
  }

  function renderItems(items) {
    const container = document.getElementById('pinboard-item-list');
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-state">Geen items. Klik rechts op een pagina → "Save to Pinboard".</p>';
      return;
    }
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = `pinboard-item pinboard-item-${item.type}`;
      el.innerHTML = buildItemHTML(item);
      container.appendChild(el);
    });
  }

  function buildItemHTML(item) {
    const typeIcons = { link: '🔗', image: '🖼️', text: '📝', quote: '💬' };
    const icon = typeIcons[item.type] || '📄';
    const title = item.title || item.url || item.content?.substring(0, 50) || 'Untitled';
    const date = new Date(item.createdAt).toLocaleDateString('nl-NL');

    let html = `
      <span class="item-icon">${icon}</span>
      <div class="item-content">
        <div class="item-title">${escapeHtml(title)}</div>
    `;

    if (item.note) {
      html += `<div class="item-note">${escapeHtml(item.note)}</div>`;
    }
    if (item.type === 'quote' && item.content) {
      html += `<div class="item-quote">"${escapeHtml(item.content.substring(0, 100))}"</div>`;
    }

    html += `<div class="item-date">${date}</div></div>`;

    // Delete knop
    html += `<button class="item-delete" data-item-id="${item.id}" title="Delete">×</button>`;

    return html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Klik op link items opent URL in nieuwe tab
  // Klik op delete knop verwijdert item
  // New board knop opent prompt voor naam
  // Back knop gaat terug naar board lijst

  async function createBoard() {
    const name = prompt('Board naam:');
    if (!name) return;
    const emoji = prompt('Emoji (optioneel):', '📌') || '📌';
    await fetch(`${API}/pinboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, emoji })
    });
    loadBoards();
  }

  async function deleteItem(itemId) {
    if (!currentBoardId) return;
    await fetch(`${API}/pinboards/${currentBoardId}/items/${itemId}`, {
      method: 'DELETE'
    });
    // Herlaad items
    openBoard(currentBoardId,
      document.getElementById('pinboard-board-name').textContent.slice(2), // naam zonder emoji
      document.getElementById('pinboard-board-name').textContent.charAt(0) // emoji
    );
  }

  // Event listeners
  document.getElementById('pinboard-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('pinboard-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) loadBoards();
  });

  document.getElementById('pinboard-new-btn')?.addEventListener('click', createBoard);

  document.getElementById('pinboard-back-btn')?.addEventListener('click', () => {
    currentBoardId = null;
    document.getElementById('pinboard-items').style.display = 'none';
    document.getElementById('pinboard-board-list').style.display = 'block';
    loadBoards();
  });

  // Event delegation voor delete knoppen
  document.getElementById('pinboard-item-list')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('item-delete')) {
      const itemId = e.target.dataset.itemId;
      if (itemId) deleteItem(itemId);
    }
  });

  return { loadBoards, createBoard };
})();
```

### Stap 6: CSS voor Pinboard Paneel

**Wat:** Styling voor het paneel, boardlijst, items. Volg de bestaande kleurpatronen en font-sizes van de shell.

**Bestand:** `shell/index.html` (in de `<style>` sectie)

```css
/* Pinboard Panel */
#pinboard-panel {
  position: absolute;
  /* Positioneer naast sidebar, vergelijkbaar met copilot panel */
  width: 320px;
  height: 100%;
  background: var(--bg-panel, #1e1e1e);
  border-right: 1px solid var(--border-color, #333);
  overflow-y: auto;
  z-index: 100;
}

.pinboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.pinboard-board-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
}
.pinboard-board-item:hover {
  background: var(--hover-bg, #2a2a2a);
}

.board-emoji { font-size: 18px; }
.board-name { flex: 1; }
.board-count {
  color: var(--text-muted, #888);
  font-size: 12px;
}

.pinboard-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.item-icon { font-size: 16px; margin-top: 2px; }
.item-content { flex: 1; min-width: 0; }
.item-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-note {
  font-size: 11px;
  color: var(--text-muted, #888);
  margin-top: 2px;
}
.item-quote {
  font-size: 12px;
  font-style: italic;
  color: var(--text-muted, #aaa);
  margin-top: 4px;
}
.item-date {
  font-size: 10px;
  color: var(--text-muted, #666);
  margin-top: 4px;
}
.item-delete {
  background: none;
  border: none;
  color: var(--text-muted, #666);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
}
.item-delete:hover { color: #f44; }

.empty-state {
  text-align: center;
  color: var(--text-muted, #888);
  padding: 24px 16px;
  font-size: 13px;
}
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Prerequisite: zorg dat er minstens 1 board bestaat
curl -s -X POST http://localhost:8765/pinboards \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Board", "emoji": "🧪"}' | jq .
```

**UI verificatie:**
- [ ] Pinboard icoon (📌) is zichtbaar in de sidebar
- [ ] Klikken op het icoon opent het Pinboard paneel
- [ ] Paneel toont lijst van borden met emoji, naam, en item count
- [ ] Klikken op een bord toont de items van dat bord
- [ ] "← Boards" knop gaat terug naar de boardlijst
- [ ] "+" knop opent prompt om nieuw bord aan te maken
- [ ] Nieuw aangemaakt bord verschijnt in de lijst

**Context menu verificatie:**
- [ ] Rechtsklik op een pagina toont "Save Page to Pinboard" met submenu van borden
- [ ] Rechtsklik op een link toont "Save Link to Pinboard"
- [ ] Rechtsklik op een afbeelding toont "Save Image to Pinboard"
- [ ] Tekst selecteren + rechtsklikken toont "Save Selection to Pinboard"
- [ ] Klikken op een bord in het submenu voegt het item toe (verifieer via API: `curl http://localhost:8765/pinboards/:id/items`)
- [ ] Delete knop (×) verwijdert een item

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-2-ui-panel.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Verifieer dat fase 1 werkt: curl http://localhost:8765/pinboards
5. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. UI visueel testen (sidebar + context menu)
4. npx vitest run — alle bestaande tests blijven slagen
5. CHANGELOG.md bijwerken met korte entry
6. git commit -m "📌 feat: Pinboard sidebar panel + context menu integration"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (screenshots + curl output)
   ## Problemen
   ## Volgende sessie start bij fase-3-visual-board.md
```

---

## Bekende valkuilen

- [ ] **ContextMenuDeps vergeten** — als `pinboardManager` niet in deps zit, crasht de builder bij `this.deps.pinboardManager`
- [ ] **isSafeURL check** — gebruik de bestaande `isSafeURL()` helper in menu-builder.ts voor linkURL
- [ ] **Submenu leeg** — als er geen boards zijn, toon geen "Save to Pinboard" items (check `boards.length === 0`)
- [ ] **Shell CSS variabelen** — gebruik bestaande CSS custom properties (`--bg-panel`, `--border-color`, etc.) in plaats van hardcoded kleuren
- [ ] **Panel positionering** — het pinboard paneel mag niet overlappen met het copilot paneel. Gebruik dezelfde positioneringslogica
- [ ] **XSS in item content** — `escapeHtml()` gebruiken voor alle user-generated content (titels, quotes, notities)
- [ ] **API port hardcoded** — gebruik dezelfde port constante als de rest van de shell (kijk hoe `ocChat` het doet)
