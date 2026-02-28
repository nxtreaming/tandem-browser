# Fase 2 — Tab Snoozing: Shell UI + Right-click Menu

> **Feature:** Tab Snoozing
> **Sessies:** 1
> **Afhankelijk van:** Fase 1 klaar (SnoozeManager + API werkt)

---

## Doel van deze fase

Voeg UI toe: 💤 visueel badge op slapende tabs, right-click context menu met snooze opties, en een snooze-manager paneel om alle gesnoozede tabs te zien.

---

## Bestaande code te lezen — ALLEEN dit

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `shell/index.html` | `// === TAB BAR ===`, tab render functies, `// === CONTEXT MENU ===` | Tab badge toevoegen + context menu uitbreiden |
| `src/api/routes/tabs.ts` | `registerTabRoutes()` | Fase 1 endpoints ter referentie |

---

## Te bouwen in deze fase

### Stap 1: 💤 Badge op snoozed tabs (shell/index.html)

Zoek de tab-render functie (functie die een tab HTML-element aanmaakt) en voeg toe:

```javascript
// In de tab-render functie, na de favicon:
if (tab.snoozed) {
  tabEl.classList.add('tab--snoozed');
  tabEl.querySelector('.tab-favicon').textContent = '💤';
  tabEl.title = `Snoozed: ${tab.title} (klik om te laden)`;
}
```

CSS toevoegen:
```css
.tab--snoozed {
  opacity: 0.5;
  font-style: italic;
}
.tab--snoozed .tab-favicon {
  filter: grayscale(1);
}
```

### Stap 2: Right-click context menu snooze opties

Zoek de tab-context-menu builder en voeg toe:

```javascript
// In het tab right-click context menu:
{ label: '💤 Snooze for 1 hour', click: () => snoozeTab(tab.id, 60) },
{ label: '💤 Snooze until tomorrow', click: () => snoozeTabUntilTomorrow(tab.id) },
{ label: '💤 Snooze indefinitely', click: () => snoozeTab(tab.id) },
// Als tab al gesnoozed:
{ label: '▶️ Wake tab', click: () => wakeTab(tab.id) },

async function snoozeTab(tabId, minutes) {
  const until = minutes
    ? new Date(Date.now() + minutes * 60000).toISOString()
    : undefined;
  await fetch(`http://localhost:8765/tabs/${tabId}/snooze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ until })
  });
  refreshTabBar(); // herlaad tab bar
}

async function wakeTab(tabId) {
  await fetch(`http://localhost:8765/tabs/${tabId}/wake`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  refreshTabBar();
}
```

### Stap 3: Klik op snoozed tab wekt hem op

In de tab-click handler:
```javascript
if (tab.snoozed) {
  await wakeTab(tab.id);
  return; // niet switchen, wake doet dat
}
```

### Stap 4: Snooze Manager mini-paneel (optioneel — als tijd over is)

Klein paneel in de copilot panel "Tabs" sectie dat gesnoozede tabs toont:
```javascript
async function loadSnoozedTabs() {
  const { tabs } = await fetch('/tabs/snoozed', { headers: { Authorization: ... } }).then(r => r.json());
  return tabs.map(t => `
    <div class="snoozed-tab">
      <span>💤 ${t.title}</span>
      <small>${t.url}</small>
      <button onclick="wakeTab('${t.tabId}')">Wake</button>
    </div>
  `).join('');
}
```

---

## Acceptatiecriteria

- [ ] Gesnoozede tab toont 💤 icoon in tab bar en is visueel gedimmed
- [ ] Right-click op tab toont snooze opties
- [ ] Right-click op snoozed tab toont "Wake tab"
- [ ] Klikken op snoozed tab wekt hem op en navigeert terug naar de URL
- [ ] Snooze "1 hour" stelt correcte tijdstempel in
- [ ] "Snooze until tomorrow" wekt op om 09:00 volgende ochtend

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand volledig
3. Verifieer fase 1: curl http://localhost:8765/tabs/snoozed — moet werken
4. npx tsc && git status
```

### Bij einde:
```
1. npm start — visueel testen: tab snoozen, badge zien, waken
2. npx tsc — ZERO errors
3. npx vitest run — bestaande tests slagen
4. CHANGELOG.md bijwerken
5. git commit -m "💤 feat: tab snoozing UI — badge, context menu, wake on click"
6. git push
7. Rapport: Gebouwd / Getest / Problemen
```
