# Fase 2 — Visual UI: Eilanden in de tab bar

> **Feature:** Tab Islands
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Fase 1 (auto-grouping backend) klaar

---

## Doel van deze fase

Bouw de visuele representatie van Tab Islands in de shell tab bar. Tabs die tot hetzelfde eiland behoren krijgen een visuele groepering: extra gap links/rechts, een kleur-achtergrond, een naamlabel boven de groep, en een collapse/expand knop. Na deze fase is de volledige Tab Islands feature compleet en bruikbaar.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `shell/index.html` | Tab bar HTML structuur (`#tab-bar`), tab creatie JS (`createTab`), `focusTab()` | Hier moet de eiland-UI bij |
| `shell/css/main.css` | `.tab`, `.tab-bar`, `.group-dot` | Bestaande tab styling, hier bouwen we op voort |
| `src/tabs/manager.ts` | `class TabManager`, `interface TabIsland`, `getIslands()` | Snap het island data model uit fase 1 |
| `AGENTS.md` | — (lees volledig) | Anti-detect regels en code stijl |

---

## Te bouwen in deze fase

### Stap 1: IPC listeners voor island events in shell

**Wat:** Luister naar `island-created`, `island-updated`, en `island-dissolved` IPC events in de shell JavaScript. Gebruik deze events om de tab bar real-time bij te werken.

**Bestand:** `shell/index.html` (of `shell/js/main.js` als de JS apart staat)

**Toevoegen aan:** Event listener sectie (zoek naar bestaande `ipcRenderer.on` of `window.electronAPI` patronen)

```javascript
// === TAB ISLANDS UI ===

// Cache eiland data
const islands = new Map(); // islandId → TabIsland

window.electronAPI.on('island-created', (event, island) => {
  islands.set(island.id, island);
  renderIslands();
});

window.electronAPI.on('island-updated', (event, island) => {
  islands.set(island.id, island);
  renderIslands();
});

window.electronAPI.on('island-dissolved', (event, { islandId }) => {
  islands.delete(islandId);
  renderIslands();
});
```

### Stap 2: Tab bar rendering aanpassen voor eilanden

**Wat:** Pas de tab bar rendering aan zodat tabs die bij hetzelfde eiland horen visueel gegroepeerd worden. Voeg een wrapper-element toe rond eiland-tabs met een gap, label, en achtergrondkleur.

**Bestand:** `shell/index.html`

**Aanpassen in:** De tab rendering logica

```javascript
function renderIslands() {
  const tabBar = document.getElementById('tab-bar');

  // Verwijder bestaande island wrappers
  tabBar.querySelectorAll('.tab-island-wrapper').forEach(el => el.remove());

  for (const [islandId, island] of islands) {
    // Vind de tab-elementen die bij dit eiland horen
    const islandTabs = island.tabIds
      .map(id => tabBar.querySelector(`.tab[data-tab-id="${id}"]`))
      .filter(Boolean);

    if (islandTabs.length === 0) continue;

    // Maak wrapper element
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-island-wrapper';
    wrapper.dataset.islandId = islandId;
    wrapper.style.setProperty('--island-color', island.color);

    // Label balk
    const label = document.createElement('div');
    label.className = 'tab-island-label';
    label.innerHTML = `
      <span class="tab-island-name">${island.name}</span>
      <span class="tab-island-count">(${island.tabIds.length})</span>
      <button class="tab-island-collapse" title="Collapse">${island.collapsed ? '▶' : '▼'}</button>
    `;

    // Event handlers
    label.querySelector('.tab-island-name').addEventListener('dblclick', () => {
      // Inline rename
    });
    label.querySelector('.tab-island-collapse').addEventListener('click', () => {
      fetch(`/tabs/islands/${islandId}/collapse`, { method: 'POST' });
    });

    wrapper.appendChild(label);

    // Verplaats eiland-tabs in de wrapper
    if (!island.collapsed) {
      islandTabs.forEach(tab => wrapper.appendChild(tab));
    }

    // Voeg wrapper in op de positie van de eerste tab
    const firstTabRef = islandTabs[0];
    firstTabRef.parentNode.insertBefore(wrapper, firstTabRef);
  }
}
```

### Stap 3: CSS styling voor eilanden

**Wat:** Voeg CSS toe voor het eiland-wrapper element: extra gap (margin), kleur-indicator, label styling, collapse animatie.

**Bestand:** `shell/css/main.css`

**Toevoegen aan:** Na de bestaande `.tab` styling

```css
/* === TAB ISLANDS === */

.tab-island-wrapper {
  display: flex;
  align-items: center;
  flex-direction: column;
  margin: 0 6px;  /* Extra gap rond het eiland */
  position: relative;
  border-radius: 6px 6px 0 0;
  background: color-mix(in srgb, var(--island-color) 8%, transparent);
  border-top: 2px solid var(--island-color);
}

.tab-island-wrapper .tab {
  /* Tabs binnen eiland: geen individuele border-right */
  border-right: 1px solid rgba(255, 255, 255, 0.02);
}

.tab-island-label {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  font-size: 10px;
  color: var(--island-color);
  width: 100%;
  cursor: default;
  -webkit-app-region: no-drag;
}

.tab-island-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
  cursor: text;
}

.tab-island-count {
  opacity: 0.6;
  font-size: 9px;
}

.tab-island-collapse {
  background: none;
  border: none;
  color: var(--island-color);
  font-size: 8px;
  cursor: pointer;
  padding: 0 2px;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.tab-island-collapse:hover {
  opacity: 1;
}

/* Collapsed island: compact weergave */
.tab-island-wrapper.collapsed {
  min-width: 80px;
  max-width: 120px;
}

.tab-island-wrapper.collapsed .tab {
  display: none;
}

.tab-island-wrapper.collapsed .tab-island-label {
  padding: 4px 8px;
}
```

### Stap 4: Collapse/expand gedrag

**Wat:** Wanneer een eiland collapsed is, verberg de individuele tabs en toon alleen het label met count badge. Klikken op het label of collapse-knop expandt het eiland weer.

**Bestand:** `shell/index.html`

**Aanpassen in:** De `renderIslands()` functie

```javascript
// In renderIslands(), na wrapper creatie:
if (island.collapsed) {
  wrapper.classList.add('collapsed');
  // Verberg tabs maar verplaats ze niet uit de DOM
  islandTabs.forEach(tab => {
    tab.style.display = 'none';
  });
} else {
  wrapper.classList.remove('collapsed');
  islandTabs.forEach(tab => {
    tab.style.display = '';
  });
}
```

### Stap 5: Inline rename via dubbelklik

**Wat:** Dubbelklikken op de eilandnaam maakt het een editable tekstveld. Enter of blur bevestigt de naam via de API.

**Bestand:** `shell/index.html`

**Toevoegen aan:** Event handlers in `renderIslands()`

```javascript
nameEl.addEventListener('dblclick', () => {
  nameEl.contentEditable = true;
  nameEl.focus();

  const selectAll = () => {
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  selectAll();

  const commit = () => {
    nameEl.contentEditable = false;
    const newName = nameEl.textContent.trim();
    if (newName && newName !== island.name) {
      fetch(`/tabs/islands/${islandId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
    }
  };

  nameEl.addEventListener('blur', commit, { once: true });
  nameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    if (e.key === 'Escape') { nameEl.textContent = island.name; nameEl.blur(); }
  });
});
```

### Stap 6: Eiland-data laden bij startup

**Wat:** Wanneer de shell opstart, haal de huidige eilanden op via `GET /tabs/islands` en render ze.

**Bestand:** `shell/index.html`

**Toevoegen aan:** Startup/init logica

```javascript
// Bij shell init (na tabs geladen):
async function loadIslands() {
  try {
    const resp = await fetch('/tabs/islands');
    const data = await resp.json();
    if (data.ok && data.islands) {
      for (const island of data.islands) {
        islands.set(island.id, island);
      }
      renderIslands();
    }
  } catch (e) {
    console.warn('Failed to load islands:', e);
  }
}
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Test 1: Maak een eiland via API en verifieer visueel
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'

curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "openerTabId": "tab-2"}'

curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.org", "openerTabId": "tab-2"}'

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/islands
# Verwacht: eiland met 3 tabs

# Test 2: Collapse via API
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/islands/island-1/collapse
# Verwacht: {"ok":true}

# Test 3: Rename via API
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/islands/island-1/rename \
  -H "Content-Type: application/json" \
  -d '{"name": "Research"}'
# Verwacht: {"ok":true}
```

**UI verificatie:**
- [ ] Eiland-tabs hebben extra gap (margin) links en rechts ten opzichte van losse tabs
- [ ] Boven de gegroepeerde tabs staat een label met eilandnaam en kleur
- [ ] Collapse-knop (▼) is zichtbaar — klikken verbergt de tabs, toont alleen label met count
- [ ] Expand (▶) herstelt de tabs
- [ ] Dubbelklik op naam → inline editing → Enter bevestigt
- [ ] Eiland-kleur is zichtbaar als subtiele bovenrand en label-kleur

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-2-visual-ui.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Verifieer dat fase 1 klaar is: curl http://localhost:8765/tabs/islands moet werken
5. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. Alle curl tests uit "Acceptatiecriteria" uitvoeren
4. Visuele verificatie: neem screenshots van eilanden in de tab bar
5. npx vitest run — alle bestaande tests blijven slagen
6. CHANGELOG.md bijwerken met korte entry
7. git commit -m "🏝️ feat: tab islands visual UI — gap, label, collapse, inline rename"
8. git push
9. Rapport:
   ## Gebouwd
   ## Getest (plak curl output + screenshots)
   ## Problemen
   ## Feature compleet ✅
```

---

## Bekende valkuilen

- [ ] DOM-volgorde: tabs verplaatsen naar een wrapper kan event listeners breken — test dat tab click/close/context menu nog werken
- [ ] Drag-and-drop: als Tandem tab DnD heeft, moeten tabs ook tussen eilanden gesleept kunnen worden — kan complex zijn, eventueel naar een volgende iteratie
- [ ] Performance: `renderIslands()` wordt bij elk event aangeroepen — bij veel eilanden kan dit traag worden. Overweeg debouncing.
- [ ] CSS `color-mix()` is modern CSS — controleer dat Electron's Chromium versie dit ondersteunt (Electron 40 = Chromium 134+, dus dit is prima)
- [ ] `-webkit-app-region: drag` op de tab bar kan interfereren met eiland-label interactie — zorg dat eiland-elementen `no-drag` hebben
