# Design: Tab Snoozing

> **Datum:** 2026-02-28
> **Status:** Ter review
> **Effort:** Medium (3-5 dagen)
> **Auteur:** Kees

---

## Probleem / Motivatie

Bij intensief browsen stapelen tabs op die niet actief gebruikt worden maar wel geheugen innemen. Elke open tab met webcontents gebruikt 50-200MB RAM. Bij 20+ tabs loopt dit snel op.

**Opera heeft:** automatische tab-suspending na X minuten inactiviteit + manuele snooze via right-click. Sluimerende tabs bewaren hun URL maar geven RAM vrij.
**Tandem heeft nu:** resource monitoring via `GET /security/monitor/resources` maar geen tab-suspending.
**Gap:** geen geheugenoptimalisatie voor inactieve tabs.

---

## Gebruikerservaring

> Robin heeft 25 tabs open na een research sessie. Tandem gebruikt 3GB RAM.
> Hij right-clickt op een groep oudere tabs → "Snooze all" → ze krijgen een 💤 icoon.
> RAM daalt naar 1.2GB. Later klikt hij op een slapende tab → die laadt opnieuw.
> Of: hij snoozt een tab "tot morgen" → het herinnert hem er de volgende dag aan.

---

## Technische Aanpak

### Architectuur

```
TabSnoozingManager
  ├── snooze(tabId, until?: Date)
  │     └── webContents.setAudioMuted(true)
  │     └── webContents.stop()  
  │     └── webContents.loadURL('about:blank') — vrijgeven geheugen
  │     └── snoozedTabs.set(tabId, { url, title, favicon, until })
  │     └── save to ~/.tandem/snoozed-tabs.json
  ├── wake(tabId)
  │     └── webContents.loadURL(savedUrl)
  │     └── snoozedTabs.delete(tabId)
  └── autoSnoozeCheck() — elke 5 min, snooze tabs inactief >30 min
```

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/tabs/snoozing.ts` | `TabSnoozingManager` class |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/api/server.ts` | `TandemAPIOptions` uitbreiden | `class TandemAPI` / `TandemAPIOptions` |
| `src/main.ts` | Manager instantiëren, timer starten, cleanup | `startAPI()`, `app.on('will-quit')` |
| `src/api/routes/tabs.ts` | Nieuwe snooze endpoints | `function registerTabRoutes()` |
| `shell/index.html` | 💤 visueel + right-click menu | `// === CONTEXT MENU ===`, tab bar render |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| POST | `/tabs/:id/snooze` | Snooze tab. Body: `{until?: string}` (ISO timestamp, optioneel) |
| POST | `/tabs/:id/wake` | Herstel gesnoozede tab |
| GET | `/tabs/snoozed` | Lijst alle gesnoozede tabs |
| POST | `/tabs/snooze-inactive` | Snooze alle tabs inactief langer dan X minuten |

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | TabSnoozingManager + REST API | 1 | — |
| 2 | Shell UI (💤 badge + right-click menu + auto-snooze config) | 1 | Fase 1 |

---

## Risico's / Valkuilen

- **webContents verloren:** als tabId verandert na reload → sla ook de webContentsId op
- **Electron webContents.discard():** mooier dan loadURL('about:blank'), maar beschikbaarheid controleren in Electron 40
- **Auto-snooze en copilot tabs:** NOOIT copilot-beheerde tabs automatisch snoozen — check de tab source marker

---

## Anti-detect overwegingen

✅ Alles via Electron main process — geen DOM manipulatie in webview.
⚠️ Snoozed tabs die herladen na wake kunnen cookie/session state verliezen op sommige sites — acceptabel gedrag, documenteren.

---

## Beslissingen nodig van Robin

- [ ] Wil je auto-snooze aan of uit by default?
- [ ] Drempelwaarde inactiviteit: 30 min? Configureerbaar?
- [ ] Mogen copilot-tabs gesnoozed worden? (Aanbeveling: nee)
