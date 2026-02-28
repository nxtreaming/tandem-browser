# Fase 3 — Visual: Card Grid View

> **Feature:** Pinboards
> **Sessies:** 1 sessie
> **Prioriteit:** MIDDEL
> **Afhankelijk van:** Fase 2 klaar (sidebar panel + context menu werken)

---

## Doel van deze fase

Upgrade de Pinboard item-weergave van een simpele lijst naar een visueel kaart-grid. Items worden als cards weergegeven met thumbnails, titels en notities. Drag-to-reorder, visuele feedback, board-switcher, en polish. Na deze fase ziet het Pinboard paneel eruit als een echt moodboard.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `shell/index.html` | `pinboardPanel` IIFE, `renderItems()`, CSS sectie | Fase 2 output — hier wordt het visuele geüpgraded |
| `src/pinboards/manager.ts` | `reorderItems()` | API voor drag-to-reorder |
| `src/api/routes/pinboards.ts` | `POST /pinboards/:id/items/reorder` | Endpoint voor reorder |

---

## Te bouwen in deze fase

### Stap 1: Card Grid Layout

**Wat:** Vervang de lijst-weergave door een CSS grid van kaarten. Elke kaart toont het type-specifieke beeld (thumbnail voor links, afbeelding voor images, tekst voor quotes) met titel en meta-info eronder.

**Bestand:** `shell/index.html` — CSS + JavaScript aanpassen

**Grid CSS:**

```css
/* Card Grid */
.pinboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 12px;
}

.pinboard-card {
  background: var(--bg-card, #252525);
  border-radius: 8px;
  overflow: hidden;
  cursor: grab;
  transition: transform 0.15s, box-shadow 0.15s;
  position: relative;
}
.pinboard-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.pinboard-card.dragging {
  opacity: 0.5;
  cursor: grabbing;
}
.pinboard-card.drag-over {
  border: 2px solid var(--accent-color, #4a9eff);
}

/* Card thumbnail/preview area */
.card-preview {
  width: 100%;
  height: 100px;
  overflow: hidden;
  background: var(--bg-preview, #1a1a1a);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-preview .card-text-preview {
  padding: 8px;
  font-size: 11px;
  color: var(--text-muted, #aaa);
  font-style: italic;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}
.card-preview .card-type-icon {
  font-size: 32px;
  opacity: 0.3;
}

/* Card info area */
.card-info {
  padding: 8px;
}
.card-title {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-note {
  font-size: 10px;
  color: var(--text-muted, #888);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}
.card-type {
  font-size: 10px;
  color: var(--text-muted, #666);
  text-transform: uppercase;
}
.card-date {
  font-size: 10px;
  color: var(--text-muted, #666);
}

/* Delete button overlay */
.card-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0,0,0,0.7);
  border: none;
  color: #fff;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: none;
  align-items: center;
  justify-content: center;
}
.pinboard-card:hover .card-delete {
  display: flex;
}
.card-delete:hover {
  background: #f44;
}
```

### Stap 2: Card Render Functie

**Wat:** Vervang `renderItems()` in de `pinboardPanel` IIFE met een card-gebaseerde render functie.

**Bestand:** `shell/index.html` — in de `pinboardPanel` IIFE

```javascript
function renderItems(items) {
  const container = document.getElementById('pinboard-item-list');
  container.innerHTML = '';
  container.className = 'pinboard-grid'; // Switch naar grid layout

  if (items.length === 0) {
    container.className = 'pinboard-items-empty';
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 48px; margin-bottom: 12px;">📌</div>
        <p>Nog geen items op dit board.</p>
        <p>Klik rechts op een pagina, link, afbeelding of tekstselectie → "Save to Pinboard".</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'pinboard-card';
    card.draggable = true;
    card.dataset.itemId = item.id;
    card.innerHTML = buildCardHTML(item);

    // Klik op link/image kaart opent de URL
    if (item.url) {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-delete')) return;
        // Open in nieuwe tab via API of window.open
        window.tandem?.openTab?.(item.url) ||
          fetch(`http://localhost:8765/tabs/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url })
          });
      });
      card.style.cursor = 'pointer';
    }

    container.appendChild(card);
  });

  setupDragAndDrop(container);
}

function buildCardHTML(item) {
  const typeIcons = { link: '🔗', image: '🖼️', text: '📝', quote: '💬' };
  const title = escapeHtml(item.title || item.url || item.content?.substring(0, 50) || 'Untitled');
  const date = new Date(item.createdAt).toLocaleDateString('nl-NL');

  // Preview area — verschilt per type
  let preview = '';
  switch (item.type) {
    case 'image':
      preview = `<img src="${escapeHtml(item.url || item.thumbnail || '')}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=card-type-icon>🖼️</span>'">`;
      break;
    case 'link':
      if (item.thumbnail) {
        preview = `<img src="${escapeHtml(item.thumbnail)}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=card-type-icon>🔗</span>'">`;
      } else {
        // Favicon als fallback
        const domain = item.url ? new URL(item.url).hostname : '';
        preview = domain
          ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" style="width:32px;height:32px;object-fit:contain;">`
          : `<span class="card-type-icon">🔗</span>`;
      }
      break;
    case 'quote':
      preview = `<div class="card-text-preview">"${escapeHtml(item.content?.substring(0, 150) || '')}"</div>`;
      break;
    case 'text':
      preview = `<div class="card-text-preview">${escapeHtml(item.content?.substring(0, 150) || '')}</div>`;
      break;
    default:
      preview = `<span class="card-type-icon">${typeIcons[item.type] || '📄'}</span>`;
  }

  let html = `
    <button class="card-delete" data-item-id="${item.id}" title="Delete">×</button>
    <div class="card-preview">${preview}</div>
    <div class="card-info">
      <div class="card-title">${title}</div>
  `;

  if (item.note) {
    html += `<div class="card-note">${escapeHtml(item.note)}</div>`;
  }

  html += `
      <div class="card-meta">
        <span class="card-type">${typeIcons[item.type] || ''} ${item.type}</span>
        <span class="card-date">${date}</span>
      </div>
    </div>
  `;

  return html;
}
```

### Stap 3: Drag-to-Reorder

**Wat:** Drag-and-drop om kaarten te herordenen. Bij loslaten wordt de nieuwe volgorde naar de API gestuurd via `POST /pinboards/:id/items/reorder`.

**Bestand:** `shell/index.html` — in de `pinboardPanel` IIFE

```javascript
function setupDragAndDrop(container) {
  let draggedCard = null;

  container.addEventListener('dragstart', (e) => {
    draggedCard = e.target.closest('.pinboard-card');
    if (!draggedCard) return;
    draggedCard.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCard.dataset.itemId);
  });

  container.addEventListener('dragend', (e) => {
    if (draggedCard) {
      draggedCard.classList.remove('dragging');
      draggedCard = null;
    }
    // Remove all drag-over indicators
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.pinboard-card');
    if (target && target !== draggedCard) {
      // Remove previous indicators
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      target.classList.add('drag-over');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    const target = e.target.closest('.pinboard-card');
    if (!target || !draggedCard || target === draggedCard) return;

    // Reorder in DOM
    const cards = [...container.querySelectorAll('.pinboard-card')];
    const draggedIdx = cards.indexOf(draggedCard);
    const targetIdx = cards.indexOf(target);

    if (draggedIdx < targetIdx) {
      target.after(draggedCard);
    } else {
      target.before(draggedCard);
    }

    // Stuur nieuwe volgorde naar API
    const newOrder = [...container.querySelectorAll('.pinboard-card')].map(c => c.dataset.itemId);
    await fetch(`${API}/pinboards/${currentBoardId}/items/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: newOrder })
    });

    // Remove indicators
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
}
```

### Stap 4: Board Switcher Dropdown

**Wat:** Een dropdown boven de item grid waarmee Robin snel tussen borden kan wisselen zonder terug te gaan naar de boardlijst.

**Bestand:** `shell/index.html`

**HTML toevoeging aan de items-header:**

```html
<div class="pinboard-items-header">
  <button id="pinboard-back-btn">←</button>
  <select id="pinboard-board-switcher" class="board-switcher">
    <!-- Dynamisch gevuld met board opties -->
  </select>
</div>
```

**JavaScript:**

```javascript
async function updateBoardSwitcher(currentId) {
  const res = await fetch(`${API}/pinboards`);
  const data = await res.json();
  const select = document.getElementById('pinboard-board-switcher');
  select.innerHTML = '';
  data.boards.forEach(board => {
    const option = document.createElement('option');
    option.value = board.id;
    option.textContent = `${board.emoji} ${board.name} (${board.itemCount})`;
    if (board.id === currentId) option.selected = true;
    select.appendChild(option);
  });
}

// Event listener voor board switch
document.getElementById('pinboard-board-switcher')?.addEventListener('change', (e) => {
  const selectedId = e.target.value;
  const selectedOption = e.target.selectedOptions[0];
  const text = selectedOption.textContent;
  // Parse emoji en naam uit de optie tekst
  openBoard(selectedId, text.slice(2), text.charAt(0));
});
```

### Stap 5: Delete Item via Card

**Wat:** De delete knop op elke kaart verwijdert het item met een bevestiging en visuele fade-out.

**Bestand:** `shell/index.html` — in de `pinboardPanel` IIFE

```javascript
// Update de event delegation voor deletes
document.getElementById('pinboard-item-list')?.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.card-delete');
  if (!deleteBtn) return;

  e.stopPropagation(); // Voorkom dat de kaart-klik ook wordt getriggerd

  const itemId = deleteBtn.dataset.itemId;
  if (!itemId || !currentBoardId) return;

  // Optioneel: bevestiging
  // if (!confirm('Item verwijderen?')) return;

  // Visuele fade-out
  const card = deleteBtn.closest('.pinboard-card');
  if (card) {
    card.style.transition = 'opacity 0.2s, transform 0.2s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
  }

  await fetch(`${API}/pinboards/${currentBoardId}/items/${itemId}`, {
    method: 'DELETE'
  });

  // Na fade-out, element verwijderen
  setTimeout(() => {
    if (card) card.remove();
    // Check of grid nu leeg is
    const container = document.getElementById('pinboard-item-list');
    if (container && container.querySelectorAll('.pinboard-card').length === 0) {
      container.className = 'pinboard-items-empty';
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 48px; margin-bottom: 12px;">📌</div>
          <p>Alle items verwijderd.</p>
        </div>
      `;
    }
  }, 250);
});
```

### Stap 6: Visuele Polish

**Wat:** Lege states, hover-effecten, type-iconen, loading states, en consistente styling.

**Bestand:** `shell/index.html`

**Te implementeren:**
- **Loading state:** Toon een spinner of "Laden..." tekst terwijl API calls lopen
- **Lege board state:** Aantrekkelijke lege state met hint hoe items toe te voegen
- **Link hover:** Subtiele highlight als een kaart met URL hoverable is (cursor: pointer)
- **Quote styling:** Quotes tonen met aanhalingstekens en cursief lettertype
- **Board delete:** Optioneel: lang indrukken of rechtermuisknuk op een board in de lijst → "Board verwijderen"
- **Responsive grid:** Grid past zich aan aan paneel-breedte (al via `auto-fill`)

**CSS voor extra polish:**

```css
/* Loading state */
.pinboard-loading {
  text-align: center;
  padding: 24px;
  color: var(--text-muted, #888);
}

/* Card met link — visuele hint dat het klikbaar is */
.pinboard-card[data-has-url="true"] .card-info {
  cursor: pointer;
}
.pinboard-card[data-has-url="true"]:hover .card-title {
  color: var(--accent-color, #4a9eff);
  text-decoration: underline;
}

/* Board delete knop in de boardlijst */
.board-delete {
  opacity: 0;
  transition: opacity 0.15s;
  background: none;
  border: none;
  color: var(--text-muted, #666);
  cursor: pointer;
}
.pinboard-board-item:hover .board-delete {
  opacity: 1;
}
.board-delete:hover {
  color: #f44;
}

/* Board switcher dropdown */
.board-switcher {
  flex: 1;
  background: var(--bg-card, #252525);
  color: var(--text-primary, #eee);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  margin: 0 8px;
}
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Setup: maak board met diverse items
BOARD_ID=$(curl -s -X POST http://localhost:8765/pinboards \
  -H "Content-Type: application/json" \
  -d '{"name": "Visual Test", "emoji": "🎨"}' | jq -r '.board.id')

# Voeg items toe
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "link", "url": "https://github.com", "title": "GitHub"}'
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "image", "url": "https://picsum.photos/200/300", "title": "Random Photo"}'
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "quote", "content": "De beste manier om de toekomst te voorspellen is hem te creëren.", "sourceUrl": "https://example.com"}'
curl -s -X POST http://localhost:8765/pinboards/$BOARD_ID/items \
  -H "Content-Type: application/json" \
  -d '{"type": "text", "title": "Notitie", "content": "Dit is een losse notitie met wat ideeën."}'
```

**UI verificatie:**
- [ ] Items worden als kaarten weergegeven in een grid (niet als lijst)
- [ ] Link-kaarten tonen een favicon of thumbnail
- [ ] Image-kaarten tonen de afbeelding als preview
- [ ] Quote-kaarten tonen de tekst in de preview area
- [ ] Text-kaarten tonen de inhoud in de preview area
- [ ] Hover op een kaart geeft een subtiel lift-effect (translateY + shadow)
- [ ] Hover toont de delete knop (×) rechtsboven de kaart
- [ ] Klikken op een link-kaart opent de URL in een nieuwe tab
- [ ] Delete knop verwijdert de kaart met fade-out animatie
- [ ] Drag-and-drop werkt: sleep een kaart naar een andere positie
- [ ] Na drag-drop is de volgorde opgeslagen (herlaad het board → zelfde volgorde)
- [ ] Board-switcher dropdown wisselt tussen borden zonder terug te gaan
- [ ] Lege board toont een aantrekkelijke empty state met hint
- [ ] Grid past zich aan bij smaller/breder paneel

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-3-visual-board.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Verifieer dat fase 2 werkt: open sidebar, klik op Pinboard icoon
5. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. UI visueel testen (card grid, drag, delete, board switch)
4. npx vitest run — alle bestaande tests blijven slagen
5. CHANGELOG.md bijwerken met korte entry
6. git commit -m "📌 feat: visual card grid view for Pinboards"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (screenshots)
   ## Problemen
   ## Feature compleet! 🎉
```

---

## Bekende valkuilen

- [ ] **Drag-and-drop event propagation** — `e.stopPropagation()` bij delete click, anders triggert ook de kaart-klik
- [ ] **Image loading errors** — `onerror` handler op `<img>` tags voor kapotte URLs, fallback naar type-icoon
- [ ] **XSS via URL** — `escapeHtml()` op alle user-gegenereerde content, inclusief URLs in `src` attributen
- [ ] **Google Favicons API** — `https://www.google.com/s2/favicons?domain=X&sz=64` werkt zonder API key maar kan geblokkeerd worden. Gebruik als fallback het type-icoon
- [ ] **Reorder API call timing** — niet bij elke dragover, alleen bij drop (al correct in de code hierboven)
- [ ] **CSS grid responsiveness** — `auto-fill` + `minmax(140px, 1fr)` schaalt automatisch, maar test bij smalle paneelbreedtes
- [ ] **Data URL thumbnails** — als toekomstige versies data URIs voor thumbnails opslaan, worden kaarten traag. V3 houdt het simpel met externe URLs
