# Fase 2 — Shell UI: Divider, Context Menu, Keyboard Shortcuts

> **Feature:** Split Screen
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Fase 1 klaar

---

## Doel van deze fase

Bouw de visuele split screen ervaring in de shell: een tweede `<webview>` die verschijnt naast de bestaande, een draggable divider ertussen, tab context menu item "Split Screen", active pane indicator, en keyboard shortcuts. Na deze fase kan Robin visueel twee pagina's naast elkaar gebruiken met een sleepbare scheidslijn.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/split-screen/manager.ts` | `class SplitScreenManager` | Begrijp de IPC events die verstuurd worden |
| `shell/index.html` | `id="webview-container"`, `<div class="browser-content">` | Hier komt de split layout |
| `shell/js/main.js` | Tab context menu logica, webview event handlers | Uitbreiden met split screen opties |
| `shell/css/main.css` | `.browser-content`, `.main-layout` | CSS voor split layout |
| `src/ipc/handlers.ts` | `registerIpcHandlers()` | IPC handlers die de shell aanroept |
| `src/context-menu/manager.ts` | `class ContextMenuManager` | Tab context menu — "Split Screen" item toevoegen |

---

## Te bouwen in deze fase

### Stap 1: Split screen HTML structuur

**Wat:** Tweede webview element en divider toevoegen aan de shell HTML.

**Bestand:** `shell/index.html`

**Zoek naar:** `<div class="browser-content" id="webview-container">`

**Voeg toe binnen webview-container:**

```html
<!-- Split screen divider (hidden by default) -->
<div class="split-divider" id="split-divider" style="display:none;"></div>
<!-- Second webview for split screen (hidden by default) -->
<div class="split-pane split-pane-secondary" id="split-pane-secondary" style="display:none;">
  <!-- Secondary webview wordt dynamisch aangemaakt via JS -->
</div>
```

### Stap 2: CSS voor split layout

**Wat:** Styling voor split screen: flexbox layout, divider styling, active pane indicator.

**Bestand:** `shell/css/main.css`

**Voeg toe:**

```css
/* Split Screen */
.browser-content.split-active {
  display: flex;
  flex-direction: row; /* vertical split = side by side */
}

.browser-content.split-active.split-horizontal {
  flex-direction: column; /* horizontal split = stacked */
}

.split-divider {
  width: 6px;
  background: rgba(255, 255, 255, 0.08);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.15s;
  z-index: 10;
}

.split-divider:hover,
.split-divider.dragging {
  background: var(--accent);
}

.split-horizontal .split-divider {
  width: auto;
  height: 6px;
  cursor: row-resize;
}

.split-pane-secondary webview {
  width: 100%;
  height: 100%;
}

/* Active pane indicator */
.split-pane-active {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
```

### Stap 3: Shell JavaScript — split screen logica

**Wat:** IPC listeners voor split-screen events, divider drag handler, active pane switching, context menu integratie.

**Bestand:** `shell/js/main.js`

**Toevoegen aan:** Event handlers sectie

```javascript
// === SPLIT SCREEN ===

let splitActive = false;
let activePaneIndex = 0;

// Luister naar IPC events van SplitScreenManager
window.electronAPI.on('split-screen-open', (event, data) => {
  // data: { layout, panes: [{tabId, index}] }
  activateSplitScreen(data);
});

window.electronAPI.on('split-screen-close', () => {
  deactivateSplitScreen();
});

window.electronAPI.on('split-screen-focus', (event, data) => {
  setActiveSplitPane(data.paneIndex);
});

function activateSplitScreen(data) {
  // Toon divider en secondary pane
  // Maak secondary webview aan
  // Navigeer secondary webview naar tab URL
  // Pas flexbox layout toe op browser-content
}

function deactivateSplitScreen() {
  // Verberg divider en secondary pane
  // Verwijder secondary webview
  // Reset layout
}

function setActiveSplitPane(paneIndex) {
  // Update activePaneIndex
  // Toggle .split-pane-active class
  // URL bar toont URL van actieve pane
}

// Divider drag handler
function initDividerDrag() {
  const divider = document.getElementById('split-divider');
  // mousedown → track → mousemove → update flex-basis → mouseup
}
```

### Stap 4: Tab context menu — "Split Screen" optie

**Wat:** Rechtermuisklik op tab → "Split Screen" optie die de huidige tab en geselecteerde tab splitst.

**Bestand:** `src/context-menu/manager.ts`

**Toevoegen aan:** Tab context menu items (zoek naar bestaande tab menu items)

```typescript
{
  label: 'Split Screen',
  click: () => {
    // Stuur IPC of API call om split screen te openen
    // met de geklikte tab en de actief-zichtbare tab
  }
}
```

### Stap 5: Toolbar aanpassing voor active pane

**Wat:** De URL bar, back/forward knoppen moeten de actieve split pane aansturen, niet altijd pane 0.

**Bestand:** `shell/js/main.js`

**Aanpassen:** Alle plekken waar `getActiveWebview()` of vergelijkbaar wordt aangeroepen — deze functie moet de actieve pane's webview retourneren als split screen actief is.

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Open split screen via API
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/split/open \
  -H "Content-Type: application/json" \
  -d '{"tabId1": 1, "tabId2": 2, "layout": "vertical"}'
# Verwacht: {"ok":true, "layout":{...}}
```

**UI verificatie:**
- [ ] Twee webviews zichtbaar naast elkaar (verticaal)
- [ ] Divider is zichtbaar tussen de twee panelen
- [ ] Divider is sleepbaar — panelen resizen mee
- [ ] Klikken op een paneel maakt het "actief" (blauwe rand)
- [ ] URL bar toont de URL van het actieve paneel
- [ ] Back/forward knoppen werken op het actieve paneel
- [ ] Navigeren in één paneel beïnvloedt het andere niet
- [ ] "Split Screen" optie in tab context menu werkt
- [ ] `POST /split/close` → terug naar single webview
- [ ] Divider verdwijnt, secondary webview wordt verwijderd

**Compilatie verificatie:**
- [ ] `npx tsc` — zero errors
- [ ] `npx vitest run` — alle bestaande tests slagen
- [ ] `npm start` — app start zonder crashes

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-2-shell-ui.md) volledig
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
6. git commit -m "🖥️ feat: split screen shell UI with divider + context menu"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende: Split Screen feature compleet ✅
```

---

## Bekende valkuilen

- [ ] De bestaande webview in `shell/index.html` heeft allerlei event handlers (navigatie, title update, favicon). De secondary webview moet dezelfde handlers krijgen — maak een herbruikbare functie.
- [ ] Focus management: als je op de secondary webview klikt, moet `activePaneIndex` updaten. Gebruik `focus` event op de webview.
- [ ] Divider drag op macOS: `mousemove` events stoppen soms als de cursor over de webview gaat. Oplossing: gebruik een transparante overlay div tijdens het slepen.
- [ ] TypeScript strict mode — geen `any` buiten catch blocks
- [ ] Tab sluiten terwijl split actief: als een van de twee split tabs gesloten wordt, moet split screen automatisch sluiten.
