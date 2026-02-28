# Fase 1 — Private Window: Ephemeer venster met in-memory sessie

> **Feature:** Private Browsing Window
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw de volledige Private Browsing feature: Cmd+Shift+N opent een nieuw Electron `BrowserWindow` met een in-memory partition (geen `persist:` prefix). Alle sessiedata wordt automatisch gewist bij sluiten. Visuele indicator: donkerpaarse header in de shell. API endpoint `POST /window/private` als alternatief.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/main.ts` | `createWindow()`, `app.on('ready')`, keyboard shortcut registratie (zoek naar `globalShortcut` of `Menu`/`accelerator`) | Snap hoe het hoofdvenster wordt aangemaakt — het privé-venster is een variant hiervan |
| `src/api/routes/browser.ts` | `function registerBrowserRoutes()` | Hier komt het `POST /window/private` endpoint |
| `shell/index.html` | Shell initialisatie, hoe het de partition/URL parameters leest | Snap hoe de shell weet of het een privé-venster is |
| `shell/css/main.css` | CSS variabelen (`:root`, `--tab-bg`, `--accent`, etc.) | Snap de huidige kleuren voor de paarse variant |
| `AGENTS.md` | — (lees volledig) | Anti-detect regels en code stijl |

---

## Te bouwen in deze fase

### Stap 1: createPrivateWindow() functie

**Wat:** Maak een nieuwe functie in `main.ts` die een `BrowserWindow` aanmaakt met een ephemere (in-memory) partition. Dit is vergelijkbaar met `createWindow()` maar met een paar cruciale verschillen: geen `persist:` prefix op de partition, cleanup bij sluiten, en een query parameter zodat de shell weet dat het privé is.

**Bestand:** `src/main.ts`

**Toevoegen aan:** Na de bestaande `createWindow()` functie

```typescript
import { v4 as uuidv4 } from 'crypto'; // Of gebruik crypto.randomUUID()

function createPrivateWindow(): BrowserWindow {
  const partitionName = `private-${crypto.randomUUID()}`;

  const privateWin = new BrowserWindow({
    width: 1280,
    height: 800,
    // Kopieer relevante opties van createWindow()
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      partition: partitionName,  // GEEN 'persist:' prefix = in-memory
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    // Eventueel andere opties van createWindow() kopiëren
  });

  // Laad de shell met private indicator
  const shellPath = path.join(__dirname, '..', 'shell', 'index.html');
  privateWin.loadFile(shellPath, {
    query: { private: 'true', partition: partitionName },
  });

  // Cleanup bij sluiten — extra zekerheid naast in-memory verdwijning
  privateWin.on('closed', () => {
    try {
      const { session } = require('electron');
      const ses = session.fromPartition(partitionName);
      ses.clearStorageData();
      ses.clearCache();
    } catch (e) {
      // Session may already be gone — that's fine
    }
  });

  return privateWin;
}
```

**Let op:** Bekijk de bestaande `createWindow()` functie goed en kopieer de relevante `BrowserWindow` opties (bv. `titleBarStyle`, `vibrancy`, `backgroundColor`, etc.). Het privé-venster moet er hetzelfde uitzien, behalve de paarse kleur.

### Stap 2: Keyboard shortcut registreren

**Wat:** Registreer Cmd+Shift+N (macOS) / Ctrl+Shift+N (Linux/Windows) om `createPrivateWindow()` aan te roepen.

**Bestand:** `src/main.ts`

**Aanpassen in:** De plek waar keyboard shortcuts/menu items geregistreerd worden (zoek naar bestaande `accelerator` of `globalShortcut` patronen)

```typescript
// Optie A: Via Electron Menu (als er al een menu is)
// Voeg toe aan het bestaande menu template:
{
  label: 'New Private Window',
  accelerator: 'CmdOrCtrl+Shift+N',
  click: () => createPrivateWindow(),
}

// Optie B: Via globalShortcut (als er geen menu gebruikt wordt)
import { globalShortcut } from 'electron';
globalShortcut.register('CmdOrCtrl+Shift+N', () => {
  createPrivateWindow();
});
```

**Aanbeveling:** Gebruik de Menu-aanpak als Tandem al een applicatie-menu heeft. Dit is betrouwbaarder dan `globalShortcut` (die kan conflicteren met systeemshortcuts).

### Stap 3: API endpoint POST /window/private

**Wat:** Endpoint om programmatisch een privé-venster te openen (voor Copilot/agents).

**Bestand:** `src/api/routes/browser.ts`

**Toevoegen aan:** `function registerBrowserRoutes()`

```typescript
// === PRIVATE BROWSING ===

router.post('/window/private', async (_req: Request, res: Response) => {
  try {
    // createPrivateWindow() moet beschikbaar zijn via ctx of een geëxporteerde functie
    // Optie: voeg createPrivateWindow toe aan RouteContext, of gebruik IPC
    const { ipcMain } = require('electron');

    // Stuur IPC event naar main process om privé-venster te openen
    // (De API server draait in het main process, dus directe aanroep is ook mogelijk)
    const win = createPrivateWindow();
    res.json({ ok: true, windowId: win.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

**Let op:** De `createPrivateWindow()` functie moet toegankelijk zijn vanuit de routes. Mogelijke aanpak: exporteer de functie vanuit `main.ts` en maak hem beschikbaar via de `RouteContext`, of via een callback in de `ManagerRegistry`.

### Stap 4: Shell detectie — privé-modus styling

**Wat:** De shell detecteert via query parameters of het in een privé-venster draait. Zo ja: activeer paarse styling en toon een indicator.

**Bestand:** `shell/index.html`

**Toevoegen aan:** Shell initialisatie (begin van de JS)

```javascript
// === PRIVATE MODE DETECTION ===
const urlParams = new URLSearchParams(window.location.search);
const isPrivateMode = urlParams.get('private') === 'true';

if (isPrivateMode) {
  document.documentElement.classList.add('private-mode');
}
```

### Stap 5: Privé-indicator in tab bar

**Wat:** Wanneer de shell in privé-modus draait, toon een "🔒 Private" badge links in de tab bar.

**Bestand:** `shell/index.html`

**Aanpassen in:** Tab bar HTML sectie

```html
<!-- Voeg toe als eerste kind van #tab-bar, na menu-btn: -->
<span class="private-badge" id="private-badge" style="display:none;">🔒 Private</span>
```

```javascript
// In de private mode detection:
if (isPrivateMode) {
  document.getElementById('private-badge').style.display = '';
}
```

### Stap 6: CSS variabelen voor privé-modus

**Wat:** Wanneer `.private-mode` class actief is, overschrijf de tab bar kleuren met een donkerpaarse variant.

**Bestand:** `shell/css/main.css`

**Toevoegen aan:** Na de `:root` variabelen

```css
/* === PRIVATE MODE STYLING === */

.private-mode {
  --tab-bg: #1a0a2e;
  --tab-hover: rgba(128, 0, 255, 0.15);
  --tab-active: rgba(128, 0, 255, 0.25);
  --accent: #9b59b6;
}

/* macOS specifiek: paarse achtergrond voor titelbalk */
.private-mode .tab-bar {
  background: rgba(26, 10, 46, 0.85);
}

.private-badge {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  font-size: 11px;
  color: #9b59b6;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.8;
}
```

### Stap 7: Webview partition in privé-modus

**Wat:** Wanneer de shell in privé-modus draait, moeten alle webviews die aangemaakt worden dezelfde ephemere partition gebruiken (niet `persist:tandem`).

**Bestand:** `shell/index.html`

**Aanpassen in:** Tab/webview creatie functie (zoek naar waar `partition` wordt gezet op webview elementen)

```javascript
// In de tab creatie functie, waar partition wordt gezet:
const partition = isPrivateMode
  ? urlParams.get('partition')  // De ephemere partition van dit venster
  : 'persist:tandem';           // Normale persistente partition

// Bij het aanmaken van de webview:
webview.setAttribute('partition', partition);
```

### Stap 8: Beperkingen in privé-modus

**Wat:** In privé-modus: geen history opslaan, geen form memory, geen site memory. Dit wordt afgehandeld doordat de in-memory partition geen data naar disk schrijft. Maar we moeten ook expliciet voorkomen dat Tandem's eigen systemen data loggen.

**Bestand:** `src/main.ts`

**Toevoegen aan:** `createPrivateWindow()` functie

```typescript
// Markeer het venster als privé zodat managers het kunnen checken
(privateWin as any).__isPrivate = true;

// Optioneel: voeg een methode toe aan het venster
// zodat managers kunnen checken: if (win.__isPrivate) skip logging;
```

**Let op:** Managers zoals SiteMemory, FormMemory, en History moeten checken of het actieve venster privé is. Dit is een nice-to-have voor v1 — de in-memory partition vangt het meeste al op.

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Test 1: Open privé-venster via API
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/window/private
# Verwacht: {"ok":true, "windowId": [nummer]}
# Verwacht: een nieuw venster opent met paarse titelbalk

# Test 2: Verifieer dat Cmd+Shift+N werkt
# (handmatige test — druk Cmd+Shift+N in Tandem)
# Verwacht: nieuw venster met paarse header en "🔒 Private" badge

# Test 3: Browse in privé-venster
# (handmatig: open een website, log in ergens)
# Sluit het privé-venster
# Open een nieuw privé-venster
# Verwacht: geen cookies/logins bewaard — je bent uitgelogd

# Test 4: Hoofdvenster onveranderd
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/list
# Verwacht: tabs van het hoofdvenster zijn intact

# Test 5: Bestaande endpoints werken nog
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/status
# Verwacht: {"ok":true, ...}
```

**UI verificatie:**
- [ ] Privé-venster heeft donkerpaarse titelbalk/header
- [ ] "🔒 Private" badge zichtbaar links in tab bar
- [ ] Tabs in privé-venster werken normaal (navigatie, nieuwe tabs, sluiten)
- [ ] Na sluiten privé-venster: geen sessiedata bewaard
- [ ] Hoofdvenster is volledig onafhankelijk en onveranderd
- [ ] Meerdere privé-vensters tegelijk mogelijk (elk met eigen partition)

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-private-window.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Lees de bestanden in de "Te lezen" tabel hierboven
5. BELANGRIJK: bestudeer createWindow() goed — kopieer relevante opties
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. Alle curl tests uit "Acceptatiecriteria" uitvoeren
4. Handmatige test: Cmd+Shift+N → browse → sluit → verifieer geen data bewaard
5. npx vitest run — alle bestaande tests blijven slagen
6. CHANGELOG.md bijwerken met korte entry
7. git commit -m "🔒 feat: private browsing window — Cmd+Shift+N, ephemeral partition, auto-cleanup"
8. git push
9. Rapport:
   ## Gebouwd
   ## Getest (plak curl output + screenshots)
   ## Problemen
   ## Feature compleet ✅
```

---

## Bekende valkuilen

- [ ] `createWindow()` bevat waarschijnlijk veel initialisatie-logica (stealth patches, event listeners, manager registratie) — het privé-venster heeft niet alles hiervan nodig. Kopieer selectief, niet blindelings.
- [ ] De API server (`localhost:8765`) draait in het main process en is gedeeld. Het privé-venster kan dezelfde API gebruiken, maar pas op: API calls vanuit het privé-venster mogen geen tabs in het hoofdvenster beïnvloeden. Overweeg een `windowId` parameter toe te voegen aan tab-gerelateerde endpoints.
- [ ] `crypto.randomUUID()` is beschikbaar in Node.js 19+ en Electron 40 — verifieer beschikbaarheid.
- [ ] Stealth patches: als Tandem stealth patches toepast via `session.defaultSession`, moeten dezelfde patches ook op de privé-session worden toegepast. Check `webRequest` handlers, User-Agent overrides, etc.
- [ ] macOS `titleBarStyle: 'hiddenInset'` moet in beide vensters hetzelfde zijn voor consistent gedrag van de traffic lights.
- [ ] Bij het sluiten van het privé-venster moet `session.clearStorageData()` worden aangeroepen — maar de `'closed'` event kan te laat komen. Overweeg `'close'` (vóór sluiten) in plaats van `'closed'` (na sluiten).
