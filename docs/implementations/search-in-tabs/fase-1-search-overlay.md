# Fase 1 — Search Overlay: Zoek in open tabs met Ctrl+Space

> **Feature:** Search in Tabs
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw een zoek-overlay in de shell die verschijnt bij Ctrl+Space. Toont alle open tabs, gefilterd op titel en URL. Bevat ook recent gesloten tabs. Volledig keyboard-navigeerbaar. Gebruikt de bestaande `GET /tabs/list` API en een nieuw `GET /tabs/closed` endpoint.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/tabs/manager.ts` | `class TabManager`, `listTabs()`, `closedTabs` array, `reopenClosedTab()`, `focusTab()` | Snap hoe tabs en gesloten tabs werken |
| `src/api/routes/tabs.ts` | `function registerTabRoutes()`, `GET /tabs/list` endpoint | Hier komt het nieuwe `/tabs/closed` endpoint bij |
| `shell/index.html` | Keyboard event listeners (zoek naar `addEventListener('keydown'`), bestaande overlay/popup patronen | Snap hoe keyboard shortcuts en popups nu werken |
| `shell/css/main.css` | Bestaande popup/overlay styling patronen | Referentie voor consistente styling |
| `AGENTS.md` | — (lees volledig) | Anti-detect regels en code stijl |

---

## Te bouwen in deze fase

### Stap 1: getClosedTabs() methode toevoegen

**Wat:** Maak de `closedTabs` array toegankelijk via een publieke methode op `TabManager`.

**Bestand:** `src/tabs/manager.ts`

**Toevoegen aan:** `class TabManager`

```typescript
/** Get recently closed tabs */
getClosedTabs(): { url: string; title: string }[] {
  return [...this.closedTabs];
}
```

### Stap 2: GET /tabs/closed endpoint

**Wat:** Nieuw endpoint dat de recent gesloten tabs teruggeeft.

**Bestand:** `src/api/routes/tabs.ts`

**Toevoegen aan:** `function registerTabRoutes()`

```typescript
// === CLOSED TABS ===

router.get('/tabs/closed', async (_req: Request, res: Response) => {
  try {
    const closed = ctx.tabManager.getClosedTabs();
    res.json({ ok: true, closed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

### Stap 3: Overlay HTML toevoegen

**Wat:** Voeg een hidden overlay element toe aan de shell HTML met een zoekbalk, resultatenlijst, en recent-gesloten sectie.

**Bestand:** `shell/index.html`

**Toevoegen aan:** Na de tab bar HTML, vóór het webview container element

```html
<!-- Tab Search Overlay -->
<div id="tab-search-overlay" class="tab-search-overlay" style="display:none;">
  <div class="tab-search-container">
    <div class="tab-search-header">
      <input type="text" id="tab-search-input" class="tab-search-input"
             placeholder="Zoek in open tabs..." autocomplete="off" spellcheck="false">
    </div>
    <div id="tab-search-results" class="tab-search-results">
      <!-- Gevuld door JS -->
    </div>
    <div id="tab-search-closed" class="tab-search-closed">
      <div class="tab-search-section-label">Recent gesloten</div>
      <!-- Gevuld door JS -->
    </div>
  </div>
</div>
```

### Stap 4: Zoek-overlay JavaScript logica

**Wat:** De kern-logica: openen/sluiten van overlay, tabs ophalen, filteren, renderen, keyboard navigatie, en tab selectie.

**Bestand:** `shell/index.html`

**Toevoegen aan:** Nieuwe sectie `// === TAB SEARCH ===`

```javascript
// === TAB SEARCH ===

const searchOverlay = document.getElementById('tab-search-overlay');
const searchInput = document.getElementById('tab-search-input');
const searchResults = document.getElementById('tab-search-results');
const searchClosed = document.getElementById('tab-search-closed');
let searchVisible = false;
let searchSelectedIndex = 0;
let searchItems = []; // Array van { tabId, url, title, isClosed }

async function toggleTabSearch() {
  if (searchVisible) {
    hideTabSearch();
  } else {
    await showTabSearch();
  }
}

async function showTabSearch() {
  searchVisible = true;
  searchOverlay.style.display = '';
  searchInput.value = '';
  searchSelectedIndex = 0;

  // Haal open tabs en gesloten tabs op
  try {
    const [tabsResp, closedResp] = await Promise.all([
      fetch('/tabs/list').then(r => r.json()),
      fetch('/tabs/closed').then(r => r.json()),
    ]);

    const openTabs = (tabsResp.tabs || []).map(t => ({
      tabId: t.id,
      url: t.url,
      title: t.title,
      favicon: t.favicon,
      emoji: t.emoji,
      isClosed: false,
      active: t.active,
    }));

    const closedTabs = (closedResp.closed || []).map(t => ({
      tabId: null,
      url: t.url,
      title: t.title,
      favicon: '',
      emoji: null,
      isClosed: true,
      active: false,
    }));

    searchItems = [...openTabs, ...closedTabs];
    renderSearchResults('');
  } catch (e) {
    console.warn('Failed to load tabs for search:', e);
  }

  // Focus de input na rendering
  requestAnimationFrame(() => searchInput.focus());
}

function hideTabSearch() {
  searchVisible = false;
  searchOverlay.style.display = 'none';
  searchInput.value = '';
  searchItems = [];
}

function renderSearchResults(query) {
  const q = query.toLowerCase().trim();

  const filtered = q
    ? searchItems.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q)
      )
    : searchItems;

  const openResults = filtered.filter(i => !i.isClosed);
  const closedResults = filtered.filter(i => i.isClosed);

  // Render open tabs
  searchResults.innerHTML = openResults.map((item, idx) => `
    <div class="tab-search-item ${idx === searchSelectedIndex ? 'selected' : ''} ${item.active ? 'active-tab' : ''}"
         data-index="${idx}">
      ${item.emoji ? `<span class="tab-search-emoji">${item.emoji}</span>` : ''}
      <img class="tab-search-favicon" src="${item.favicon || ''}"
           onerror="this.style.display='none'" ${item.favicon ? '' : 'style="display:none"'}>
      <div class="tab-search-text">
        <div class="tab-search-title">${escapeHtml(item.title)}</div>
        <div class="tab-search-url">${escapeHtml(item.url)}</div>
      </div>
      ${item.active ? '<span class="tab-search-active-badge">actief</span>' : ''}
    </div>
  `).join('');

  // Render gesloten tabs
  if (closedResults.length > 0) {
    searchClosed.style.display = '';
    searchClosed.innerHTML = `
      <div class="tab-search-section-label">Recent gesloten</div>
      ${closedResults.map((item, idx) => `
        <div class="tab-search-item closed ${(idx + openResults.length) === searchSelectedIndex ? 'selected' : ''}"
             data-index="${idx + openResults.length}">
          <span class="tab-search-closed-icon">↩</span>
          <div class="tab-search-text">
            <div class="tab-search-title">${escapeHtml(item.title)}</div>
            <div class="tab-search-url">${escapeHtml(item.url)}</div>
          </div>
        </div>
      `).join('')}
    `;
  } else {
    searchClosed.style.display = 'none';
  }

  // Click handlers
  searchOverlay.querySelectorAll('.tab-search-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      selectSearchItem(idx, filtered);
    });
  });
}

function selectSearchItem(index, filtered) {
  if (!filtered) {
    const q = searchInput.value.toLowerCase().trim();
    filtered = q
      ? searchItems.filter(i => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q))
      : searchItems;
  }

  const item = filtered[index];
  if (!item) return;

  if (item.isClosed) {
    // Heropen gesloten tab
    fetch('/tabs/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: item.url }),
    });
  } else {
    // Focus open tab
    fetch('/tabs/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabId: item.tabId }),
    });
  }

  hideTabSearch();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
```

### Stap 5: Keyboard event handlers

**Wat:** Ctrl+Space om de overlay te openen/sluiten. Pijltjes voor navigatie, Enter voor selectie, Escape om te sluiten. Input event voor real-time filtering.

**Bestand:** `shell/index.html`

**Toevoegen aan:** De `// === TAB SEARCH ===` sectie

```javascript
// Ctrl+Space shortcut (globaal)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    toggleTabSearch();
    return;
  }

  // Alleen als search open is:
  if (!searchVisible) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    hideTabSearch();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    searchSelectedIndex = Math.min(searchSelectedIndex + 1, searchItems.length - 1);
    renderSearchResults(searchInput.value);
    scrollSelectedIntoView();
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchSelectedIndex = Math.max(searchSelectedIndex - 1, 0);
    renderSearchResults(searchInput.value);
    scrollSelectedIntoView();
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    selectSearchItem(searchSelectedIndex);
    return;
  }
});

// Real-time filtering
searchInput.addEventListener('input', () => {
  searchSelectedIndex = 0;
  renderSearchResults(searchInput.value);
});

// Klik op achtergrond sluit overlay
searchOverlay.addEventListener('click', (e) => {
  if (e.target === searchOverlay) {
    hideTabSearch();
  }
});

function scrollSelectedIntoView() {
  const selected = searchOverlay.querySelector('.tab-search-item.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}
```

### Stap 6: CSS styling

**Wat:** Styling voor de overlay, zoekbalk, resultatenlijst, en keyboard-selectie highlight.

**Bestand:** `shell/css/main.css`

**Toevoegen aan:** Nieuwe sectie

```css
/* === TAB SEARCH OVERLAY === */

.tab-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10001;
  display: flex;
  justify-content: center;
  padding-top: 60px;
}

.tab-search-container {
  width: 560px;
  max-height: 480px;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-search-input {
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text, #e0e0e0);
  font-size: 15px;
  outline: none;
  font-family: inherit;
}

.tab-search-input::placeholder {
  color: var(--text-dim, #888);
}

.tab-search-results,
.tab-search-closed {
  overflow-y: auto;
  flex: 1;
}

.tab-search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.1s;
}

.tab-search-item:hover,
.tab-search-item.selected {
  background: rgba(255, 255, 255, 0.06);
}

.tab-search-item.selected {
  background: rgba(66, 133, 244, 0.15);
}

.tab-search-item.active-tab {
  border-left: 2px solid var(--accent, #e94560);
}

.tab-search-emoji {
  font-size: 16px;
  flex-shrink: 0;
}

.tab-search-favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
}

.tab-search-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.tab-search-title {
  font-size: 13px;
  color: var(--text, #e0e0e0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-search-url {
  font-size: 11px;
  color: var(--text-dim, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-search-active-badge {
  font-size: 10px;
  color: var(--accent, #e94560);
  background: rgba(233, 69, 96, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.tab-search-closed-icon {
  font-size: 14px;
  color: var(--text-dim, #888);
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.tab-search-section-label {
  font-size: 11px;
  color: var(--text-dim, #888);
  padding: 8px 16px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Test 1: Nieuw endpoint — recent gesloten tabs
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/closed
# Verwacht: {"ok":true, "closed": [...]}

# Test 2: Open een paar tabs en sluit er één
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
# Noteer tab ID

curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/close \
  -H "Content-Type: application/json" \
  -d '{"tabId": "tab-2"}'

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/closed
# Verwacht: example.com in de gesloten lijst

# Test 3: Bestaande endpoints werken nog
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/list
# Verwacht: {"tabs": [...], "groups": [...]}
```

**UI verificatie:**
- [ ] Ctrl+Space opent de zoek-overlay, gecentreerd bovenaan
- [ ] Typen filtert tabs real-time op titel en URL
- [ ] Pijltjestoetsen navigeren door de lijst, geselecteerd item is gehighlight
- [ ] Enter schakelt naar de geselecteerde tab
- [ ] Escape sluit de overlay
- [ ] Klik op achtergrond (buiten container) sluit de overlay
- [ ] Sectie "Recent gesloten" toont gesloten tabs met ↩ icoon
- [ ] Klik op gesloten tab heropent hem
- [ ] Actieve tab heeft een rode linkerborder en "actief" badge

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-search-overlay.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. Alle curl tests uit "Acceptatiecriteria" uitvoeren
4. Visuele verificatie: neem screenshots van de zoek-overlay
5. npx vitest run — alle bestaande tests blijven slagen
6. CHANGELOG.md bijwerken met korte entry
7. git commit -m "🔍 feat: search in tabs overlay — Ctrl+Space, filter, keyboard nav"
8. git push
9. Rapport:
   ## Gebouwd
   ## Getest (plak curl output + screenshots)
   ## Problemen
   ## Feature compleet ✅
```

---

## Bekende valkuilen

- [ ] Ctrl+Space kan conflicteren met input method switching op Linux — test op macOS eerst, Linux later
- [ ] Focus management: wanneer de overlay opent, moet focus naar de input gaan. Wanneer de overlay sluit, moet focus terug naar de webview.
- [ ] `escapeHtml()` is essentieel — tab titels kunnen HTML bevatten (XSS preventie)
- [ ] De fetch calls naar `/tabs/list` en `/tabs/closed` gebruiken geen auth header vanuit de shell — dit werkt omdat de shell op localhost draait en de API localhost requests doorlaat (zie auth middleware in `class TandemAPI`)
- [ ] `searchItems` bevat zowel open als gesloten tabs — zorg dat de index-mapping correct is bij het filteren
