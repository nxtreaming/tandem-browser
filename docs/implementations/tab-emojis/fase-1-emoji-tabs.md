# Fase 1 — Emoji Tabs: Volledige implementatie

> **Feature:** Tab Emojis
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw de volledige Tab Emojis feature in één sessie: uitbreiding van het `Tab` data model met een emoji-veld, API endpoints om emoji's te zetten en verwijderen, persistentie in `~/.tandem/tab-emojis.json`, en een emoji picker popup in de shell tab bar.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/tabs/manager.ts` | `class TabManager`, `interface Tab`, `openTab()`, `updateTab()`, `constructor()` | Hier komt het emoji-veld en persistentie-logica bij |
| `src/api/routes/tabs.ts` | `function registerTabRoutes()` | Hier komen de emoji endpoints bij |
| `shell/index.html` | Tab bar HTML (`#tab-bar`), tab creatie JS (`createTab`), tab element structuur (`.tab` div met kinderen) | Hier komt de emoji badge en picker popup bij |
| `shell/css/main.css` | `.tab`, `.tab-favicon`, `.tab-title`, `.tab-source` | Snap de bestaande tab-element layout voor badge positioning |
| `AGENTS.md` | — (lees volledig) | Anti-detect regels en code stijl |

---

## Te bouwen in deze fase

### Stap 1: Tab interface uitbreiden met emoji veld

**Wat:** Voeg een optioneel `emoji` veld toe aan de `Tab` interface.

**Bestand:** `src/tabs/manager.ts`

**Aanpassen in:** `interface Tab`

```typescript
export interface Tab {
  // ... bestaande velden ...
  emoji?: string;  // Optioneel emoji-badge voor visuele identificatie
}
```

### Stap 2: Emoji persistentie — laden en opslaan

**Wat:** Voeg methodes toe aan `TabManager` om emoji's op te slaan in `~/.tandem/tab-emojis.json` en te laden bij initialisatie. Emoji's worden opgeslagen per genormaliseerde URL (hostname + pathname).

**Bestand:** `src/tabs/manager.ts`

**Toevoegen aan:** `class TabManager`

```typescript
import fs from 'fs';
import path from 'path';
import { tandemDir } from '../utils/paths';

// In class TabManager:
private emojiMap: Map<string, string> = new Map(); // normalizedUrl → emoji

constructor(win: BrowserWindow) {
  this.win = win;
  this.loadEmojis();  // ← toevoegen aan bestaande constructor
}

private getEmojiFilePath(): string {
  return path.join(tandemDir(), 'tab-emojis.json');
}

private loadEmojis(): void {
  try {
    const filePath = this.getEmojiFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.emojiMap = new Map(Object.entries(data));
    }
  } catch (e) {
    // Silently ignore — file doesn't exist yet or is corrupt
  }
}

private saveEmojis(): void {
  try {
    const filePath = this.getEmojiFilePath();
    const data = Object.fromEntries(this.emojiMap);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    // Log but don't crash
    console.warn('Failed to save tab emojis:', e);
  }
}

private normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}
```

### Stap 3: setEmoji() en clearEmoji() methodes

**Wat:** Publieke methodes om emoji op een tab te zetten of te verwijderen. Slaat automatisch op en stuurt IPC event naar de shell.

**Bestand:** `src/tabs/manager.ts`

**Toevoegen aan:** `class TabManager`

```typescript
setEmoji(tabId: string, emoji: string): boolean {
  const tab = this.tabs.get(tabId);
  if (!tab) return false;

  tab.emoji = emoji;

  // Persist per URL
  if (tab.url && tab.url !== 'about:blank') {
    const key = this.normalizeUrl(tab.url);
    this.emojiMap.set(key, emoji);
    this.saveEmojis();
  }

  // Notify shell
  this.win.webContents.send('tab-emoji-changed', { tabId, emoji });
  return true;
}

clearEmoji(tabId: string): boolean {
  const tab = this.tabs.get(tabId);
  if (!tab) return false;

  const oldEmoji = tab.emoji;
  tab.emoji = undefined;

  // Remove from persistence
  if (tab.url && tab.url !== 'about:blank') {
    const key = this.normalizeUrl(tab.url);
    this.emojiMap.delete(key);
    this.saveEmojis();
  }

  // Notify shell
  this.win.webContents.send('tab-emoji-changed', { tabId, emoji: null });
  return true;
}

/** Restore emoji from persistence when a tab navigates to a URL */
restoreEmojiForUrl(tabId: string, url: string): void {
  const key = this.normalizeUrl(url);
  const emoji = this.emojiMap.get(key);
  if (emoji) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.emoji = emoji;
      this.win.webContents.send('tab-emoji-changed', { tabId, emoji });
    }
  }
}
```

### Stap 4: Emoji herstellen bij navigatie

**Wat:** Wanneer `updateTab()` wordt aangeroepen met een nieuwe URL, check of er een opgeslagen emoji is voor die URL.

**Bestand:** `src/tabs/manager.ts`

**Aanpassen in:** `updateTab()` methode

```typescript
updateTab(tabId: string, updates: Partial<Pick<Tab, 'title' | 'url' | 'favicon'>>): void {
  const tab = this.tabs.get(tabId);
  if (!tab) return;
  if (updates.title !== undefined) tab.title = updates.title;
  if (updates.url !== undefined) {
    tab.url = updates.url;
    // Restore emoji for new URL if one was saved
    this.restoreEmojiForUrl(tabId, updates.url);
  }
  if (updates.favicon !== undefined) tab.favicon = updates.favicon;
}
```

### Stap 5: API endpoints

**Wat:** Twee nieuwe endpoints: POST om emoji te zetten, DELETE om te verwijderen.

**Bestand:** `src/api/routes/tabs.ts`

**Toevoegen aan:** `function registerTabRoutes()`

```typescript
// === TAB EMOJIS ===

router.post('/tabs/:id/emoji', async (req: Request, res: Response) => {
  const { emoji } = req.body;
  if (!emoji) { res.status(400).json({ error: 'emoji required' }); return; }
  try {
    const ok = ctx.tabManager.setEmoji(req.params.id, emoji);
    if (!ok) { res.status(404).json({ error: 'Tab not found' }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tabs/:id/emoji', async (req: Request, res: Response) => {
  try {
    const ok = ctx.tabManager.clearEmoji(req.params.id);
    if (!ok) { res.status(404).json({ error: 'Tab not found' }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

### Stap 6: Shell — emoji badge in tab element

**Wat:** Voeg een emoji-badge `<span>` toe aan elk tab element, vóór de favicon. Luister naar het `tab-emoji-changed` IPC event om de badge te updaten.

**Bestand:** `shell/index.html`

**Aanpassen in:** Tab creatie functie (zoek naar waar `.tab` div wordt opgebouwd met `tab-source`, `group-dot`, `tab-favicon`, etc.)

```javascript
// In de tab creatie functie, na tab-source span:
const emojiEl = document.createElement('span');
emojiEl.className = 'tab-emoji';
emojiEl.style.display = 'none';
tabEl.insertBefore(emojiEl, tabEl.querySelector('.tab-favicon'));

// IPC listener voor emoji updates:
window.electronAPI.on('tab-emoji-changed', (event, { tabId, emoji }) => {
  const entry = tabs.get(tabId);
  if (!entry) return;
  const emojiEl = entry.tabEl.querySelector('.tab-emoji');
  if (emoji) {
    emojiEl.textContent = emoji;
    emojiEl.style.display = '';
  } else {
    emojiEl.textContent = '';
    emojiEl.style.display = 'none';
  }
});
```

### Stap 7: Shell — emoji picker popup

**Wat:** Voeg een emoji picker toe die verschijnt wanneer de gebruiker op een "+" knop hoverd/klikt op een tab. De picker is een simpel grid van populaire emoji's.

**Bestand:** `shell/index.html`

**Toevoegen aan:** Na de tab bar HTML, een hidden popup element + JS logica

```html
<!-- Emoji Picker Popup -->
<div id="emoji-picker" class="emoji-picker" style="display:none;">
  <div class="emoji-picker-grid">
    <!-- Populaire emoji's — wordt gevuld door JS -->
  </div>
  <button class="emoji-picker-remove" title="Verwijder emoji">✕ Verwijder</button>
</div>
```

```javascript
// === EMOJI PICKER ===
const POPULAR_EMOJIS = [
  '🔥', '⭐', '💡', '🎯', '🚀', '💻', '📚', '🧪',
  '🎨', '🔧', '📝', '🎵', '🌍', '💬', '📊', '🔒',
  '❤️', '✅', '⚡', '🏠', '🎮', '📸', '🛒', '💰',
  '🤖', '🧠', '🔍', '📱', '🎬', '🍕', '☕', '🌟',
];

const pickerEl = document.getElementById('emoji-picker');
const pickerGrid = pickerEl.querySelector('.emoji-picker-grid');
let pickerTargetTabId = null;

// Vul grid
for (const emoji of POPULAR_EMOJIS) {
  const btn = document.createElement('button');
  btn.className = 'emoji-picker-btn';
  btn.textContent = emoji;
  btn.addEventListener('click', () => {
    if (pickerTargetTabId) {
      fetch(`/tabs/${pickerTargetTabId}/emoji`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    }
    hideEmojiPicker();
  });
  pickerGrid.appendChild(btn);
}

// Verwijder-knop
pickerEl.querySelector('.emoji-picker-remove').addEventListener('click', () => {
  if (pickerTargetTabId) {
    fetch(`/tabs/${pickerTargetTabId}/emoji`, { method: 'DELETE' });
  }
  hideEmojiPicker();
});

function showEmojiPicker(tabEl, tabId) {
  pickerTargetTabId = tabId;
  const rect = tabEl.getBoundingClientRect();
  pickerEl.style.left = rect.left + 'px';
  pickerEl.style.top = (rect.bottom + 4) + 'px';
  pickerEl.style.display = '';
}

function hideEmojiPicker() {
  pickerEl.style.display = 'none';
  pickerTargetTabId = null;
}

// Sluit picker bij klik buiten
document.addEventListener('click', (e) => {
  if (!pickerEl.contains(e.target) && !e.target.closest('.tab-emoji-trigger')) {
    hideEmojiPicker();
  }
});
```

### Stap 8: Emoji trigger knop op tab hover

**Wat:** Voeg een kleine "+" knop toe aan elk tab element die verschijnt op hover. Klikken opent de emoji picker.

**Bestand:** `shell/index.html`

**Aanpassen in:** Tab creatie functie

```javascript
// In de tab creatie functie:
const emojiTrigger = document.createElement('button');
emojiTrigger.className = 'tab-emoji-trigger';
emojiTrigger.textContent = '+';
emojiTrigger.title = 'Emoji toewijzen';
emojiTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  showEmojiPicker(tabEl, tabId);
});
tabEl.insertBefore(emojiTrigger, tabEl.querySelector('.tab-close'));
```

### Stap 9: CSS styling

**Wat:** Styling voor de emoji badge, trigger knop, en picker popup.

**Bestand:** `shell/css/main.css`

**Toevoegen aan:** Na de bestaande `.tab` styling

```css
/* === TAB EMOJIS === */

.tab-emoji {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.tab-emoji-trigger {
  opacity: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: var(--text-dim);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s;
  margin-left: auto;
}

.tab:hover .tab-emoji-trigger {
  opacity: 0.6;
}

.tab-emoji-trigger:hover {
  opacity: 1 !important;
  background: rgba(255, 255, 255, 0.2);
}

/* Emoji Picker Popup */
.emoji-picker {
  position: fixed;
  z-index: 10000;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.emoji-picker-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}

.emoji-picker-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
}

.emoji-picker-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.emoji-picker-remove {
  width: 100%;
  margin-top: 4px;
  padding: 4px;
  border: none;
  background: rgba(233, 69, 96, 0.1);
  color: var(--accent, #e94560);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}

.emoji-picker-remove:hover {
  background: rgba(233, 69, 96, 0.2);
}
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
TOKEN=$(cat ~/.tandem/api-token)

# Test 1: Open een tab
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com"}'
# Verwacht: {"ok":true, "tab": {"id": "tab-2", ...}}

# Test 2: Zet emoji op tab
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/tab-2/emoji \
  -H "Content-Type: application/json" \
  -d '{"emoji": "🔥"}'
# Verwacht: {"ok":true}

# Test 3: Verifieer emoji in tab list
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/tabs/list
# Verwacht: tab-2 heeft "emoji": "🔥"

# Test 4: Verwijder emoji
curl -H "Authorization: Bearer $TOKEN" \
  -X DELETE http://localhost:8765/tabs/tab-2/emoji
# Verwacht: {"ok":true}

# Test 5: Emoji op niet-bestaande tab
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/tabs/fake-id/emoji \
  -H "Content-Type: application/json" \
  -d '{"emoji": "⭐"}'
# Verwacht: 404 {"error": "Tab not found"}

# Test 6: Persistentie check
cat ~/.tandem/tab-emojis.json
# Verwacht: JSON object met URL → emoji mappings
```

**UI verificatie:**
- [ ] Emoji badge zichtbaar vóór de favicon in de tab
- [ ] Hover op tab → "+" knop verschijnt
- [ ] Klik op "+" → emoji picker popup opent onder de tab
- [ ] Klik op emoji → badge verschijnt, picker sluit
- [ ] "Verwijder" knop in picker → emoji verdwijnt
- [ ] Na app herstart → emoji's zijn terug (persistentie werkt)

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-emoji-tabs.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. Alle curl tests uit "Acceptatiecriteria" uitvoeren
4. Visuele verificatie: neem screenshots van emoji badges op tabs
5. npx vitest run — alle bestaande tests blijven slagen
6. CHANGELOG.md bijwerken met korte entry
7. git commit -m "😀 feat: tab emojis — badge, picker, persistence"
8. git push
9. Rapport:
   ## Gebouwd
   ## Getest (plak curl output + screenshots)
   ## Problemen
   ## Feature compleet ✅
```

---

## Bekende valkuilen

- [ ] TypeScript: `fs` en `path` imports moeten bovenaan `manager.ts` staan — check of ze al geïmporteerd zijn (waarschijnlijk niet, want de huidige manager gebruikt geen filesystem)
- [ ] `tandemDir()` functie importeren uit `../utils/paths` — check dat dit pad klopt vanuit `src/tabs/manager.ts`
- [ ] Emoji picker positionering: als de tab helemaal rechts staat, kan de picker buiten het scherm vallen — voeg bounds-checking toe
- [ ] `Tab` interface wijzigt (nieuw veld `emoji?`) — bestaande code die `Tab` objecten aanmaakt (bv. `registerInitialTab()`) moet geen errors krijgen (het veld is optional, dus dit is veilig)
- [ ] `saveEmojis()` bij elk setEmoji/clearEmoji kan veel disk I/O zijn bij snel klikken — overweeg debouncing, maar voor v1 is sync write acceptabel
