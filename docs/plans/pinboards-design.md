# Design: Pinboards

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Hard (1-2 weken)
> **Auteur:** Kees

---

## Probleem / Motivatie

Robin gebruikt Opera's Pinboards dagelijks om webcontent te verzamelen: links voor research, afbeeldingen ter inspiratie, tekstfragmenten uit artikelen, YouTube-video's voor later. Het is een visueel moodboard — sneller en flexibeler dan bookmarks, rijker dan een tekstnotitie.

Tandem mist dit concept volledig. Er zijn page notes (`POST /context/note`) en bookmarks met mappen, maar geen visueel bord waar je vrij content op kunt gooien en organiseren.

**Opera heeft:** Virtuele "magneetborden" waar je links, afbeeldingen, tekst, screenshots en YouTube-embeds op sleept. Kanban-modus (To Do / In Progress / Done). Deelbaar via link (geen login nodig voor kijkers). Emoji-reacties. Toegankelijk via sidebar-icoon, `opera://pinboards`, en rechtermuisknop → "Save to Pinboard".

**Tandem heeft nu:** `POST /context/note` voor tekstnotities per URL. Bookmarks met mappen (`BookmarkManager`). Sessie-state opslaan. Geen visueel bord, geen card-layout, geen Kanban.

**Gap:** Tandem mist een plek om webcontent visueel te verzamelen en organiseren. Bookmarks zijn plat en saai. Page notes zitten vast aan één URL. Robin heeft een creatieve ruimte nodig — een digitaal prikbord.

---

## Gebruikerservaring — hoe het werkt

> Robin doet research naar een nieuw project. Hij opent tien tabs, vindt een interessant artikel, een mooie afbeelding, en een YouTube-tutorial.
>
> Hij klikt met rechts op de afbeelding → "Save to Pinboard" → kiest zijn "Project X Research" board. De afbeelding verschijnt als kaart op zijn bord.
>
> Hij selecteert een alinea uit een artikel → rechtermuisknop → "Save selection to Pinboard". De tekst wordt een quote-kaart.
>
> Later opent hij het Pinboard-paneel via het icoon in de sidebar. Hij ziet al zijn boards: "Project X Research", "Design Inspiratie", "Later Lezen". Hij klikt op "Project X Research" en ziet een grid van kaarten — links met thumbnails, afbeeldingen, tekstfragmenten.
>
> Hij sleept kaarten om ze te herordenen. Hij klikt op een link-kaart en de pagina opent in een nieuwe tab. Hij verwijdert een kaart die niet meer relevant is.
>
> Geen cloud, geen login, geen sync — alles lokaal in `~/.tandem/pinboards/`.

---

## Wat Pinboards zijn

Pinboards zijn visuele moodboards binnen de browser. Denk aan Pinterest-achtige borden, maar privé en lokaal. Je "pint" webcontent — links, afbeeldingen, tekst, quotes — op een bord voor later gebruik.

### Verschil met bookmarks
| | Bookmarks | Pinboards |
|---|-----------|-----------|
| **Structuur** | Hiërarchische mappen | Visuele kaart-grid |
| **Content** | Alleen URLs | Links, afbeeldingen, tekst, quotes |
| **Context** | Titel + URL | Thumbnail, notitie, originele URL, type |
| **Organisatie** | Mappen en subfolders | Meerdere borden, drag-to-reorder |
| **Gebruik** | Permanente bladwijzers | Tijdelijke research, inspiratie, projecten |

### Use cases voor Robin
- **Research sessies:** Links en quotes verzamelen voor een project
- **Design inspiratie:** Afbeeldingen en screenshots bijeenbrengen
- **Later lezen:** Pagina's saven met meer context dan een bookmark
- **Project resources:** Alle relevante links voor een lopend project op één plek

---

## Opera's Implementatie (referentie)

Opera biedt het volledige spectrum:
- **Content types:** tekst, links (met preview-cards), afbeeldingen, screenshots, YouTube-embeds, muziekbestanden, documenten
- **Organisatie:** vrije drag-and-drop op een canvas + Kanban-modus (kolommen)
- **Samenwerking:** delen via link, geen login nodig, emoji-reacties
- **Toegang:** sidebar-icoon, `opera://pinboards`, rechtermuisknop context menu

### Wat we overnemen (V1)
- Meerdere benoemde borden met emoji
- Content types: link, afbeelding, tekst/quote
- Rechtermuisknop "Save to Pinboard"
- Sidebar-paneel als toegangspunt
- Lokale JSON storage

### Wat we NIET bouwen (V1)
- Cloud sharing / deelbare links
- Emoji-reacties
- YouTube-embeds (komt in V2)
- Kanban-kolommen (komt in V2)
- Vrije canvas drag-and-drop (komt in V3)

---

## Tandem's Aanpak: Local-First

Tandem's filosofie is **lokaal, privacy-first, geen cloud dependencies**. Pinboards volgen dit patroon:

- **Opslag:** `~/.tandem/pinboards/boards.json` — een JSON-bestand met alle borden en items
- **Geen server nodig:** Alles wordt via de bestaande Express API (localhost:8765) bediend
- **Geen login:** Geen accounts, geen sync, geen externe diensten
- **Volledige controle:** Robin's data blijft op Robin's machine

Later (V2+) kan cloud sharing optioneel worden toegevoegd, maar V1 is 100% offline.

---

## Technische Aanpak

### Architectuur

```
┌──────────────────────────────────────────────────────┐
│  Shell UI (sidebar panel / tandem://pinboards)        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Board List  │  Item Grid (cards)                │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────┘
                         │ HTTP (localhost:8765)
┌────────────────────────▼─────────────────────────────┐
│  Express API — /pinboards endpoints                   │
│  registerPinboardRoutes() in routes/pinboards.ts      │
└────────────────────────┬─────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────┐
│  PinboardManager (src/pinboards/manager.ts)           │
│  CRUD operaties, JSON storage, thumbnail generatie    │
└────────────────────────┬─────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  ~/.tandem/pinboards │
              │  └── boards.json     │
              └─────────────────────┘
```

### Data Model

```typescript
interface PinboardStore {
  boards: Pinboard[];
  lastModified: string;
}

interface Pinboard {
  id: string;           // unieke ID (timestamp + random)
  name: string;         // "Project X Research"
  emoji: string;        // "📌" (default) of gekozen emoji
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
  items: PinboardItem[];
}

interface PinboardItem {
  id: string;           // unieke ID
  type: 'link' | 'image' | 'text' | 'quote';
  url?: string;         // bron-URL (voor links en afbeeldingen)
  title?: string;       // paginatitel of zelf gekozen titel
  content?: string;     // tekstinhoud (voor text/quote types)
  thumbnail?: string;   // data URI of pad naar thumbnail
  note?: string;        // optionele gebruikersnotitie
  sourceUrl?: string;   // URL van de pagina waarvan het item komt
  createdAt: string;    // ISO 8601
  position: number;     // volgorde in het bord (0, 1, 2, ...)
}
```

**Type-specifiek gedrag:**
| Type | `url` | `title` | `content` | `thumbnail` |
|------|-------|---------|-----------|-------------|
| `link` | Doel-URL | Paginatitel | — | Favicon of page screenshot |
| `image` | Afbeeldings-URL | Alt-tekst of filename | — | De afbeelding zelf (verkleind) |
| `text` | — | Optioneel | De getypte tekst | — |
| `quote` | — | — | Geselecteerde tekst | — |

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/pinboards/manager.ts` | `PinboardManager` class — CRUD, storage, ID-generatie |
| `src/api/routes/pinboards.ts` | `registerPinboardRoutes()` — REST endpoints |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/registry.ts` | `pinboardManager` toevoegen aan `ManagerRegistry` | `interface ManagerRegistry` |
| `src/api/server.ts` | Pinboard routes importeren en registreren | `setupRoutes()` |
| `src/main.ts` | `PinboardManager` instantiëren, aan registry toevoegen, cleanup in will-quit | `startAPI()`, `app.on('will-quit')` |
| `src/context-menu/types.ts` | `PinboardManager` toevoegen aan `ContextMenuDeps` | `interface ContextMenuDeps` |
| `src/context-menu/menu-builder.ts` | "Save to Pinboard" items toevoegen | `build()`, nieuwe methode `addPinboardItems()` |
| `shell/index.html` | Pinboard sidebar-icoon + paneel UI | Sidebar sectie |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| GET | `/pinboards` | Lijst van alle borden (zonder items, voor sidebar) |
| POST | `/pinboards` | Nieuw bord aanmaken (name, emoji) |
| GET | `/pinboards/:id` | Eén bord ophalen met alle items |
| PUT | `/pinboards/:id` | Bord bijwerken (name, emoji) |
| DELETE | `/pinboards/:id` | Bord verwijderen inclusief alle items |
| GET | `/pinboards/:id/items` | Alle items van een bord |
| POST | `/pinboards/:id/items` | Item toevoegen aan bord |
| PUT | `/pinboards/:id/items/:itemId` | Item bijwerken (note, position, title) |
| DELETE | `/pinboards/:id/items/:itemId` | Item verwijderen |
| POST | `/pinboards/:id/items/reorder` | Items herordenen (array van IDs in nieuwe volgorde) |

### Geen nieuwe npm packages nodig ✅

Alles wordt gebouwd met bestaande dependencies:
- Express (API routes)
- `fs` / `path` (JSON storage)
- `crypto` (ID generatie, of `Date.now().toString(36)` patroon van `BookmarkManager`)

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | **Backend + API** — `PinboardManager` class, JSON storage, alle REST endpoints, registry wiring | 1 | — |
| 2 | **UI Panel + Context Menu** — Sidebar icoon, paneel met boardlijst + itemgrid, rechtermuisknop "Save to Pinboard" | 1 | Fase 1 |
| 3 | **Visueel Board View** — Kaarten met thumbnails, drag-to-reorder, delete, board switching, polish | 1 | Fase 2 |

### Details per fase

**Fase 1 — Backend + API** (`docs/implementations/pinboards/fase-1-backend-api.md`)
- `PinboardManager` class met CRUD voor borden en items
- JSON storage in `~/.tandem/pinboards/boards.json`
- Alle endpoints registreren via `registerPinboardRoutes()`
- Registry wiring: `ManagerRegistry`, `main.ts`, `will-quit` cleanup
- Curl-tests als acceptatiecriteria

**Fase 2 — UI Panel + Context Menu** (`docs/implementations/pinboards/fase-2-ui-panel.md`)
- Pinboard icoon in de sidebar (naast bestaande iconen)
- Paneel toont boardlijst + items van geselecteerd board
- Rechtermuisknuk context menu: "Save page to Pinboard", "Save image to Pinboard", "Save selection to Pinboard"
- Basis item-weergave (lijst met titel, type-icoon, datum)

**Fase 3 — Visueel Board View** (`docs/implementations/pinboards/fase-3-visual-board.md`)
- Card-grid layout met thumbnails, titels, notities
- Drag-to-reorder (met positie-update naar API)
- Delete-knop per kaart
- Board-switcher dropdown
- Visuele polish: hover-effecten, type-iconen, lege-state

---

## Risico's / Valkuilen

- **JSON file grootte:** Als Robin honderden items met inline thumbnails (data URIs) opslaat, kan `boards.json` groot worden. **Mitigatie:** Thumbnails als aparte bestanden opslaan in `~/.tandem/pinboards/thumbnails/`, alleen pad opslaan in JSON. Maar V1 begint simpel met data URIs voor kleine hoeveelheden.
- **Context menu complexiteit:** De `ContextMenuBuilder` is al vrij groot. **Mitigatie:** `addPinboardItems()` als aparte methode, alleen tonen als er boards bestaan.
- **UI in shell/index.html:** Shell is al een groot bestand. **Mitigatie:** Pinboard UI als apart paneel/sectie met eigen IIFE, vergelijkbaar met het `ocChat` patroon.
- **Thumbnail generatie:** `webContents.capturePage()` voor pagina-screenshots is async en kan traag zijn. **Mitigatie:** V1 gebruikt favicon-URLs voor links, geen screenshots. Thumbnails voor images zijn de afbeeldingen zelf (verkleind via CSS, niet server-side).

---

## Anti-detect overwegingen

- ✅ Alles via Electron main process / shell — geen injectie in webview
- ✅ Context menu items worden gebouwd door `ContextMenuBuilder` in het main process
- ✅ Pinboard paneel is onderdeel van de shell UI, niet van de webview
- ✅ Geen netwerk calls naar externe diensten — alles lokaal
- ⚠️ Bij "Save image to Pinboard": de `srcURL` komt uit de webview `context-menu` event params (standaard Electron/Chromium gedrag, niet detecteerbaar)
- ⚠️ Bij "Save selection to Pinboard": de `selectionText` komt uit dezelfde params (standaard gedrag)

---

## Beslissingen nodig van Robin

- [ ] **Bord emoji:** Standaard emoji-selector of vrij tekstveld? (Voorstel: vrij tekstveld, default "📌")
- [ ] **Thumbnail strategie:** Favicons voor links (simpel, snel) of page screenshots (rijker, trager)?
- [ ] **Sidebar positie:** Eigen icoon in sidebar of onderdeel van bestaand copilot paneel?
- [ ] **Maximaal aantal boards:** Onbeperkt of cap? (Voorstel: onbeperkt, net als bookmarkmappen)

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________
