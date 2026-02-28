# Fase 2 — Shell UI: Workspace Strip + Tab Filtering

> **Feature:** Workspaces UI
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Fase 1 klaar

---

## Doel van deze fase

Bouw de visuele workspace ervaring in de shell: een verticale icon strip links van het main content area met gekleurde vierkantjes per workspace, tab bar filtering bij workspace switch, en een "Verplaats naar workspace" optie in het tab context menu. Na deze fase kan Robin visueel tussen workspaces wisselen met één klik.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/workspaces/manager.ts` | `class WorkspaceManager` | Begrijp IPC events en data model |
| `shell/index.html` | `<div class="main-layout">`, `<div class="tab-bar">` | Layout waar workspace strip bij komt |
| `shell/js/main.js` | Tab rendering logica, tab context menu | Uitbreiden met workspace filtering |
| `shell/css/main.css` | `.main-layout`, `.tab-bar` | CSS voor workspace strip |
| `src/context-menu/manager.ts` | `class ContextMenuManager` | "Verplaats naar workspace" item |

---

## Te bouwen in deze fase

### Stap 1: Workspace strip HTML

**Wat:** Verticale strip met workspace iconen links van de main content, of bovenaan de tab bar.

**Bestand:** `shell/index.html`

**Zoek naar:** `<div class="main-layout">`

**Voeg toe als eerste child van main-layout:**

```html
<!-- Workspace strip -->
<div class="workspace-strip" id="workspace-strip">
  <!-- Workspace iconen worden dynamisch gegenereerd via JS -->
  <button class="workspace-add-btn" id="workspace-add-btn" title="Nieuwe workspace">+</button>
</div>
```

### Stap 2: CSS voor workspace strip

**Wat:** Verticale strip styling: smalle kolom, gekleurde vierkantjes, active indicator.

**Bestand:** `shell/css/main.css`

**Voeg toe:**

```css
/* Workspace Strip */
.workspace-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  width: 44px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.15);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  overflow-y: auto;
}

.workspace-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
  border: 2px solid transparent;
  position: relative;
}

.workspace-icon:hover {
  transform: scale(1.1);
}

.workspace-icon.active {
  border-color: white;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
}

/* Active indicator bar */
.workspace-icon.active::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 25%;
  height: 50%;
  width: 3px;
  background: white;
  border-radius: 2px;
}

.workspace-add-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  color: var(--text-dim);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s;
}

.workspace-add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}
```

### Stap 3: Shell JavaScript — workspace logica

**Wat:** Workspace strip renderen, klik handlers, tab bar filtering bij workspace switch.

**Bestand:** `shell/js/main.js`

**Toevoegen aan:** Event handlers sectie

```javascript
// === WORKSPACES ===

let activeWorkspace = 'default';
let workspaces = [];

// Laad workspaces bij startup
async function loadWorkspaces() {
  const res = await fetch('http://localhost:8765/workspaces');
  const data = await res.json();
  workspaces = data.workspaces;
  renderWorkspaceStrip();
}

function renderWorkspaceStrip() {
  const strip = document.getElementById('workspace-strip');
  // Clear bestaande icons (behalve de + knop)
  // Render een .workspace-icon per workspace met kleur en emoji
  // Actieve workspace krijgt .active class
}

async function switchWorkspace(name) {
  await fetch(`http://localhost:8765/workspaces/${name}/switch`, { method: 'POST' });
  activeWorkspace = name;
  renderWorkspaceStrip();
  filterTabBar();
}

function filterTabBar() {
  // Haal tabIds op voor actieve workspace
  // Verberg tab elements die niet in de lijst zitten
  // Toon tab elements die wel in de lijst zitten
}

// Luister naar IPC events
window.electronAPI.on('workspace-switched', (event, data) => {
  activeWorkspace = data.name;
  renderWorkspaceStrip();
  filterTabBar();
});

// + knop handler
document.getElementById('workspace-add-btn').addEventListener('click', () => {
  // Toon prompt/dialog voor workspace naam
  // POST /workspaces met naam, standaard kleur, standaard emoji
  // Herlaad strip
});
```

### Stap 4: Tab bar filtering

**Wat:** Wanneer de workspace wisselt, moeten alleen de tabs van die workspace zichtbaar zijn in de tab bar. Andere tabs worden verborgen via CSS `display:none`.

**Bestand:** `shell/js/main.js`

**Aanpassen:** De tab rendering functie (zoek naar waar tabs in de tab bar worden gerenderd)

```javascript
// Bij het renderen van tabs: check of tab.id in activeWorkspace.tabIds zit
// Zo niet: tab element krijgt style.display = 'none'
// Zo ja: tab element is zichtbaar
```

### Stap 5: Tab context menu — "Verplaats naar workspace"

**Wat:** Rechtermuisklik op tab → submenu "Verplaats naar workspace" met lijst van beschikbare workspaces.

**Bestand:** `src/context-menu/manager.ts`

**Toevoegen aan:** Tab context menu (zoek naar bestaande tab menu items)

```typescript
{
  label: 'Verplaats naar workspace',
  submenu: workspaces.map(ws => ({
    label: `${ws.emoji} ${ws.name}`,
    click: () => {
      // POST /workspaces/:name/move-tab met tabId
    }
  }))
}
```

### Stap 6: Nieuwe tab toewijzen aan actieve workspace

**Wat:** Wanneer een nieuwe tab geopend wordt, moet deze automatisch bij de actieve workspace horen.

**Bestand:** `shell/js/main.js` of `src/tabs/manager.ts`

**Aanpassen:** De new-tab handler — na tab aanmaak, roep `workspaceManager.assignTabToActive(tabId)` aan.

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Workspaces laden
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/workspaces
# Verwacht: {"ok":true, "workspaces":[...]}
```

**UI verificatie:**
- [ ] Workspace strip zichtbaar links van het browser content area
- [ ] Default workspace icon (blauw, 🏠) is actief (witte rand)
- [ ] "+" knop maakt nieuwe workspace aan (prompt voor naam)
- [ ] Klik op workspace icon → tab bar filtert, alleen die workspace's tabs zichtbaar
- [ ] Nieuwe tabs worden automatisch aan actieve workspace toegewezen
- [ ] Rechtermuisklik tab → "Verplaats naar workspace" → submenu met workspaces
- [ ] Tab verplaatsen naar andere workspace → tab verdwijnt uit huidige tab bar
- [ ] Workspace wisselen → tab bar update → juiste tabs zichtbaar
- [ ] Na browser restart: workspaces en hun kleuren/emoji's zijn behouden

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
6. git commit -m "🏢 feat: workspace strip UI + tab bar filtering"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende: Workspaces UI feature compleet ✅
```

---

## Bekende valkuilen

- [ ] Tab bar rendering race condition: na workspace switch moet filterTabBar() wachten tot de workspace data geladen is
- [ ] Workspace strip moet responsive zijn: bij veel workspaces moet het scrollbaar zijn (overflow-y: auto)
- [ ] De "+" knop dialoog: gebruik een simpele `prompt()` voor V1, fancy dialog kan later
- [ ] TypeScript strict mode — geen `any` buiten catch blocks
- [ ] Main layout CSS: voeg `display: flex` toe aan `.main-layout` als dat er nog niet is, zodat de workspace strip links naast de content verschijnt
- [ ] Tab context menu: WorkspaceManager heeft workspace data nodig in het context menu proces — stuur workspace lijst via IPC
