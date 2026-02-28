# Design: Private Browsing Window

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Easy (1-2d)
> **Auteur:** Kees

---

## Probleem / Motivatie

Tandem heeft session-isolatie via `/sessions` (met `persist:` partities), maar geen écht privé venster dat automatisch alles wist bij sluiten. Robin moet handmatig een sessie aanmaken en daarna handmatig data wissen.

**Opera heeft:** Private Browsing — Cmd+Shift+N opent een nieuw venster dat geen history opslaat, geen cookies bewaart, en alles automatisch wist bij sluiten. Visueel herkenbaar door een donker thema.

**Tandem heeft nu:** `POST /sessions/create` en `POST /sessions/switch` via `function registerSessionRoutes()` in `src/api/routes/sessions.ts`. Sessions gebruiken `persist:[naam]` partities die wél data bewaren op disk.

**Gap:** Geen ephemere (in-memory) sessie die automatisch opruimt. Geen Cmd+Shift+N shortcut. Geen visuele indicator voor privé-modus.

---

## Gebruikerservaring — hoe het werkt

> Robin wil snel iets opzoeken zonder dat het in zijn browsing history terechtkomt.
>
> Hij drukt **Cmd+Shift+N**. Er opent een nieuw Tandem-venster met een opvallende donkerpaarse titelbalk/header. In de tab bar staat subtiel "🔒 Private" als indicator.
>
> Robin browst normaal in dit venster — alles werkt hetzelfde, maar:
> - Geen history wordt opgeslagen
> - Cookies bestaan alleen in geheugen (verdwijnen bij sluiten)
> - Geen autofill, geen form memory
> - Downloads blijven wél staan (die zijn al naar disk geschreven)
>
> Robin sluit het privé-venster (Cmd+W of ✕). Alle sessiedata (cookies, cache, localStorage) wordt automatisch gewist. Het is alsof het venster nooit bestond.
>
> Het hoofdvenster van Tandem is onveranderd — zijn normale sessie, tabs, en history zijn intact.

---

## Technische Aanpak

### Architectuur

```
    Cmd+Shift+N
         │
    ┌────▼─────────────────────────────┐
    │ main.ts                           │
    │ createPrivateWindow()             │
    │                                   │
    │ new BrowserWindow({               │
    │   partition: 'private-[uuid]'     │  ← GEEN 'persist:' prefix
    │ })                                │     = in-memory only
    │                                   │
    │ win.on('closed', () => {          │
    │   session.clearStorageData()      │  ← wis alles bij sluiten
    │ })                                │
    └───────────────────────────────────┘
```

### Electron Session Partities

Het verschil zit in de partition-string:
- `persist:tandem` → data wordt opgeslagen op disk (normaal gedrag)
- `private-abc123` → **geen `persist:` prefix** → data is in-memory only, verdwijnt automatisch

Electron's `session.fromPartition()` zonder `persist:` prefix creëert een ephemere sessie. Dit is precies wat we nodig hebben.

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| — | Geen — logica past in `main.ts` en bestaande modules |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/main.ts` | `createPrivateWindow()` functie + Cmd+Shift+N accelerator registratie | `createWindow()` (als referentie) |
| `src/api/routes/browser.ts` | `POST /window/private` endpoint | `function registerBrowserRoutes()` |
| `shell/index.html` | Privé-indicator in tab bar + paars thema detectie | Tab bar sectie |
| `shell/css/main.css` | `.private-mode` klasse voor paarse header styling | Root variabelen |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| POST | `/window/private` | Open een nieuw privé-venster |

### Geen nieuwe npm packages nodig? ✅

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Volledige implementatie: `createPrivateWindow()`, ephemere partition, cleanup on close, shortcut, visuele indicator, API endpoint | 1 | — |

---

## Risico's / Valkuilen

- **Meerdere privé-vensters:** Elk privé-venster moet zijn eigen unieke partition krijgen (`private-[uuid]`), anders delen ze cookies. Mitigatie: UUID per venster genereren.
- **Copilot in privé-modus:** Moet de AI copilot beschikbaar zijn in privé-vensters? Opera schakelt Aria uit. Mitigatie: Robin laten beslissen — optioneel uitschakelen.
- **Downloads:** Bestanden die gedownload worden in privé-modus blijven op disk staan — dat is verwacht gedrag (zoals in alle browsers), maar vermeld het aan Robin.
- **Extensions:** Chrome extensions in privé-modus laden kan privacy schenden (extensions kunnen data loggen). Mitigatie: standaard geen extensions laden in privé, optioneel aan te zetten.

---

## Anti-detect overwegingen

- ✅ Ephemere partition is een standaard Electron feature — geen detecteerbaar verschil vanuit de webview
- ⚠️ **Let op:** de User-Agent en fingerprint moeten identiek zijn aan het normale venster. Een andere partition mag geen ander fingerprint-profiel opleveren. Dit is standaard het geval in Electron (zelfde Chromium instance), maar verifieer dat Tandem's stealth patches ook in de nieuwe partition actief zijn.
- ✅ Visuele indicator (paarse header) is shell-side, onzichtbaar voor websites

---

## Beslissingen nodig van Robin

- [ ] Copilot beschikbaar in privé-venster? Opera schakelt Aria uit.
- [ ] Extensions laden in privé-modus? Standaard uit, optioneel aan?
- [ ] Moet privé-venster een eigen API port krijgen, of dezelfde 8765 gebruiken?
- [ ] Visual: donkerpaarse header, of een andere kleur/indicator?

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________
