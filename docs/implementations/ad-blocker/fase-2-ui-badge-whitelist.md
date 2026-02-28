# Fase 2 — UI: Shield Badge + Blocked Count + Whitelist Toggle

> **Feature:** Ad Blocker
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Fase 1 klaar

---

## Doel van deze fase

Bouw de visuele ad blocker ervaring in de shell: een shield badge in de toolbar die het aantal geblokkeerde requests toont per pagina, een klikbare popup met geblokkeerd-details en een per-site whitelist toggle. Na deze fase ziet Robin visueel hoeveel ads geblokkeerd worden en kan hij per site de ad blocker uitschakelen.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/adblock/manager.ts` | `class AdBlockManager`, `getBlockedCount()`, `getWhitelist()` | Data ophalen voor badge |
| `shell/index.html` | `<div class="toolbar">`, `<div class="status-dot">` | Hier komt de shield badge bij |
| `shell/js/main.js` | Toolbar event handlers, webview navigatie events | Badge update bij pagina wissel |
| `shell/css/main.css` | `.toolbar`, `.status-dot` | Styling voor shield badge |
| `src/ipc/handlers.ts` | `registerIpcHandlers()` | IPC handlers voor badge data |

---

## Te bouwen in deze fase

### Stap 1: Shield badge HTML

**Wat:** Een schildje icoon in de toolbar met een badge counter die het aantal geblokkeerde requests toont.

**Bestand:** `shell/index.html`

**Zoek naar:** `<button id="btn-screenshot"` (in de toolbar)

**Voeg toe vóór de screenshot knop:**

```html
<!-- Ad Blocker shield badge -->
<button class="adblock-shield" id="adblock-shield" title="Ad Blocker">
  🛡️
  <span class="adblock-count" id="adblock-count" style="display:none;">0</span>
</button>
```

### Stap 2: Shield popup HTML

**Wat:** Popup die verschijnt bij klik op het schildje — toont geblokkeerd aantal en whitelist toggle.

**Bestand:** `shell/index.html`

**Voeg toe na de toolbar div:**

```html
<!-- Ad Blocker popup -->
<div class="adblock-popup" id="adblock-popup" style="display:none;">
  <div class="adblock-popup-header">
    <span class="adblock-popup-icon">🛡️</span>
    <span class="adblock-popup-title">Ad Blocker</span>
    <label class="adblock-toggle">
      <input type="checkbox" id="adblock-global-toggle" checked>
      <span class="adblock-toggle-slider"></span>
    </label>
  </div>
  <div class="adblock-popup-stats">
    <div class="adblock-stat">
      <span class="adblock-stat-number" id="adblock-page-blocked">0</span>
      <span class="adblock-stat-label">geblokkeerd op deze pagina</span>
    </div>
    <div class="adblock-stat">
      <span class="adblock-stat-number" id="adblock-total-blocked">0</span>
      <span class="adblock-stat-label">totaal geblokkeerd</span>
    </div>
  </div>
  <div class="adblock-popup-whitelist">
    <label>
      <input type="checkbox" id="adblock-site-whitelist">
      <span>Uitschakelen voor <strong id="adblock-current-domain">deze site</strong></span>
    </label>
  </div>
</div>
```

### Stap 3: CSS voor shield badge en popup

**Wat:** Styling voor het schildje, de badge counter, en de whitelist popup.

**Bestand:** `shell/css/main.css`

**Voeg toe:**

```css
/* Ad Blocker Shield */
.adblock-shield {
  position: relative;
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}

.adblock-shield:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.adblock-shield.active {
  color: var(--accent);
}

.adblock-count {
  position: absolute;
  top: -2px;
  right: -4px;
  background: var(--accent);
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 8px;
  min-width: 14px;
  text-align: center;
  line-height: 1.2;
}

/* Ad Blocker Popup */
.adblock-popup {
  position: absolute;
  top: calc(var(--toolbar-height, 36px) + var(--tab-bar-height, 36px) + 4px);
  right: 80px;
  background: var(--panel-bg, #1e1e2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.adblock-popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.adblock-popup-title {
  font-weight: 600;
  flex: 1;
}

.adblock-popup-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.adblock-stat-number {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
  display: block;
}

.adblock-stat-label {
  font-size: 10px;
  color: var(--text-dim);
}

.adblock-popup-whitelist {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
}

.adblock-toggle {
  position: relative;
  width: 36px;
  height: 20px;
}

.adblock-toggle input {
  display: none;
}

.adblock-toggle-slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.adblock-toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.adblock-toggle input:checked + .adblock-toggle-slider {
  background: var(--accent);
}

.adblock-toggle input:checked + .adblock-toggle-slider::before {
  transform: translateX(16px);
}
```

### Stap 4: Shell JavaScript — badge logica

**Wat:** Update de badge counter bij navigatie, toggle popup, whitelist management.

**Bestand:** `shell/js/main.js`

**Toevoegen aan:** Event handlers sectie

```javascript
// === AD BLOCKER UI ===

// Badge update: poll blocked count na navigatie
async function updateAdBlockBadge() {
  const tabId = getActiveTabId();
  const res = await fetch(`http://localhost:8765/adblock/stats`);
  const data = await res.json();
  const count = data.blockedPerTab?.[tabId] || 0;
  const badge = document.getElementById('adblock-count');
  const shield = document.getElementById('adblock-shield');
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = '';
    shield.classList.add('active');
  } else {
    badge.style.display = 'none';
    shield.classList.remove('active');
  }
}

// Popup toggle
document.getElementById('adblock-shield').addEventListener('click', () => {
  const popup = document.getElementById('adblock-popup');
  popup.style.display = popup.style.display === 'none' ? '' : 'none';
  if (popup.style.display !== 'none') {
    updateAdBlockPopup();
  }
});

// Whitelist toggle
document.getElementById('adblock-site-whitelist').addEventListener('change', async (e) => {
  const domain = getCurrentDomain();
  if (e.target.checked) {
    await fetch('http://localhost:8765/adblock/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain })
    });
  } else {
    await fetch(`http://localhost:8765/adblock/whitelist/${domain}`, { method: 'DELETE' });
  }
  // Herlaad pagina zodat whitelist effect heeft
  getActiveWebview().reload();
});

// Update badge na elke navigatie
// Voeg toe aan bestaande webview 'did-navigate' handler:
// updateAdBlockBadge();
```

### Stap 5: IPC voor real-time badge updates

**Wat:** AdBlockManager stuurt IPC event `adblock-count-updated` naar shell wanneer een request geblokkeerd wordt, zodat de badge real-time updatet zonder polling.

**Bestand:** `src/adblock/manager.ts`

**Toevoegen aan:** `incrementBlockedCount()` methode

```typescript
// Na count update:
if (this.win) {
  this.win.webContents.send('adblock-count-updated', {
    webContentsId,
    count: this.blockedCounts.get(webContentsId) || 0,
    totalBlocked: this.totalBlocked,
  });
}
```

**Bestand:** `shell/js/main.js` — IPC listener:

```javascript
window.electronAPI.on('adblock-count-updated', (event, data) => {
  // Update badge als het voor de actieve tab is
  if (data.webContentsId === getActiveWebContentsId()) {
    updateBadgeDisplay(data.count);
  }
});
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Status na pagina laden
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/adblock/stats
# Verwacht: {"ok":true, "totalBlocked":N, "blockedPerTab":{...}}
```

**UI verificatie:**
- [ ] Shield badge zichtbaar in toolbar (🛡️)
- [ ] Badge toont getal na het laden van een ad-heavy site (bv. een nieuwssite)
- [ ] Klik op shield → popup verschijnt met geblokkeerd-statistieken
- [ ] Popup toont "geblokkeerd op deze pagina" en "totaal geblokkeerd"
- [ ] Whitelist toggle werkt: uitvinken → pagina herlaadt → ads verschijnen
- [ ] Whitelist toggle aanvinken → ads worden weer geblokkeerd
- [ ] Globale toggle: ad blocker uit → geen requests meer geblokkeerd
- [ ] Badge update is real-time (niet alleen bij navigatie)
- [ ] Popup sluit bij klik erbuiten

**Compilatie verificatie:**
- [ ] `npx tsc` — zero errors
- [ ] `npx vitest run` — alle bestaande tests slagen
- [ ] `npm start` — app start zonder crashes

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-2-ui-badge-whitelist.md) volledig
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
6. git commit -m "🛡️ feat: ad blocker shield badge + whitelist UI"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende: Ad Blocker feature compleet ✅
```

---

## Bekende valkuilen

- [ ] Popup positioning: de popup moet correct gepositioneerd zijn onder de shield knop. Gebruik `getBoundingClientRect()` van het shield element.
- [ ] Popup dismiss: klik erbuiten moet de popup sluiten — gebruik document-level click handler
- [ ] Real-time badge: AdBlockManager heeft een referentie naar `win` nodig voor IPC — voeg dit toe aan constructor
- [ ] Current domain extractie: gebruik `new URL(webview.getURL()).hostname` — niet `location.hostname` (dat is de shell, niet de pagina)
- [ ] TypeScript strict mode — geen `any` buiten catch blocks
- [ ] Whitelist state in popup: bij openen, check of huidige site gewhitelist is en zet checkbox correct
