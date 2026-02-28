# Design: Workspaces UI

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Medium (3-5d)
> **Auteur:** Kees

---

## Probleem / Motivatie

Tandem heeft al volledige session-isolatie via `/sessions` (aparte cookies, localStorage, cache per sessie). Maar er is geen visuele manier om tussen sessies te wisselen — alles gaat via API calls. Opera heeft Workspaces: gekleurde vierkantjes bovenaan de sidebar waarmee je met één klik van context wisselt.

**Opera heeft:** Tot 5 named workspaces met custom iconen en kleuren. Eén klik = wissel alle zichtbare tabs. Ctrl+Tab cyclet alleen binnen huidige workspace. Context menu: "Verplaats tab naar workspace".
**Tandem heeft nu:** `SessionManager` met `POST /sessions/create`, `POST /sessions/switch`, full partition isolation. Maar geen sidebar icons, geen visuele switcher, geen tab-filtering per sessie.
**Gap:** De backend is er — de UI ontbreekt volledig.

---

## Gebruikerservaring — hoe het werkt

> Robin opent Tandem. Bovenaan de sidebar (boven het Copilot panel) ziet hij een verticale strip met gekleurde vierkantjes. Het eerste vierkantje (blauw, "Default") is actief.
> Robin klikt op "+" om een nieuwe workspace aan te maken. Hij noemt het "Work" en kiest een groene kleur met een 💼 emoji.
> Hij opent werk-gerelateerde tabs (Slack, GitHub, Jira). Al deze tabs horen bij de "Work" workspace.
> Hij klikt op het blauwe "Default" vierkantje — de tab bar wisselt: nu ziet hij alleen zijn persoonlijke tabs (YouTube, Reddit). De Work tabs zijn verborgen, niet gesloten.
> Rechtermuisklik op een tab → "Verplaats naar workspace → Work" — de tab verdwijnt uit Default en verschijnt in Work.

---

## Technische Aanpak

### Architectuur

```
┌──────────────────────────────────────────────────┐
│ Shell (index.html)                                │
│  ┌──────┐ ┌────────┐ ┌────────────────────────┐  │
│  │ W.S. │ │Tab Bar │ │ Toolbar (URL bar etc.) │  │
│  │ strip│ │(filtered│ └────────────────────────┘  │
│  │      │ │ by WS) │                              │
│  │ 🔵   │ └────────┘                              │
│  │ 🟢   │ ┌────────────────────────────────────┐  │
│  │ +    │ │ Webview (active tab content)        │  │
│  └──────┘ └────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

SessionManager (bestaand)
  ↕ maps to
WorkspaceManager (nieuw) → beheert workspace metadata + tab toewijzing
  ↕
Shell IPC → workspace strip UI + tab bar filtering
```

### Kernbeslissing: Workspaces = Sessions

Tandem's sessies bieden al volledige isolatie (eigen cookies, cache). In plaats van een aparte "workspace" laag te bouwen, mappen we elke sessie 1:1 op een workspace:

- Session "default" = Workspace "Default" (altijd aanwezig)
- `POST /sessions/create {name: "Work"}` = nieuwe workspace "Work"
- `POST /sessions/switch {name: "Work"}` = workspace switch → tab bar filtert, partition wisselt

Dit betekent dat werkruimtes in Tandem **dieper** zijn dan Opera's workspaces — bij het wisselen krijg je ook andere cookies/logins, wat krachtig is voor multi-account workflows.

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/workspaces/manager.ts` | WorkspaceManager — workspace metadata (kleur, emoji, volgorde), tab↔workspace mapping |
| `src/api/routes/workspaces.ts` | REST API endpoints voor workspace operaties |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/registry.ts` | `workspaceManager` toevoegen aan `ManagerRegistry` | `interface ManagerRegistry` |
| `src/api/server.ts` | Workspace routes registreren | `setupRoutes()` |
| `src/main.ts` | WorkspaceManager instantiëren + registreren | `startAPI()` |
| `src/sessions/manager.ts` | Optioneel: metadata veld toevoegen aan Session type | `interface Session` |
| `shell/index.html` | Workspace icon strip toevoegen boven copilot panel | `<div class="main-layout">` |
| `shell/js/main.js` | Workspace switching, tab filtering, strip rendering | event handlers |
| `shell/css/main.css` | Workspace strip styling | nieuwe CSS classes |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| GET | `/workspaces` | Lijst alle workspaces met metadata (kleur, emoji, tab count) |
| POST | `/workspaces` | Maak nieuwe workspace `{name, color?, emoji?}` |
| DELETE | `/workspaces/:name` | Verwijder workspace (tabs gaan naar Default) |
| POST | `/workspaces/:name/switch` | Activeer deze workspace (= session switch + tab filter) |
| PUT | `/workspaces/:name` | Update metadata (kleur, emoji, naam) |
| POST | `/workspaces/:name/move-tab` | Verplaats tab naar deze workspace `{tabId}` |
| GET | `/workspaces/:name/tabs` | Lijst tabs in deze workspace |

### Geen nieuwe npm packages nodig? ✅

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Backend: WorkspaceManager + tab↔workspace mapping + API | 1 | — |
| 2 | Shell UI: workspace icon strip, tab filtering, context menu | 1 | Fase 1 |

---

## Risico's / Valkuilen

- **Session = Workspace koppeling:** Door 1:1 mapping met sessions krijgt elke workspace een eigen Electron partition. Dit is krachtig maar betekent ook dat login state verschilt per workspace — dit is een feature, geen bug, maar moet duidelijk gecommuniceerd worden.
- **Tab bar filtering:** De tab bar toont momenteel alle tabs. Na workspace switch moeten alleen de tabs van de actieve workspace zichtbaar zijn. Tabs in andere workspaces zijn verborgen, niet gesloten.
- **Default workspace:** De "default" workspace kan niet verwijderd worden en correspondeert met `persist:tandem`.
- **Persistence:** Workspace metadata (kleur, emoji) moet opgeslagen worden in `~/.tandem/workspaces.json` zodat het browser restarts overleeft.

---

## Anti-detect overwegingen

- ✅ Workspace strip en switching zijn puur shell UI — geen injectie in webview
- ✅ Elke workspace gebruikt zijn eigen Electron partition — websites zien alleen hun eigen sessie
- ✅ Session switching is al bestaande functionaliteit — we voegen alleen UI toe

---

## Beslissingen nodig van Robin

- [ ] Maximum aantal workspaces? Opera heeft 5, maar Tandem's sessions zijn ongelimiteerd.
- [ ] Workspace strip positie: links van de tab bar (verticale strip) of boven de tab bar (horizontale strip)?
- [ ] Workspace keyboard shortcut: Cmd+1-5 conflicteert met tab switching. Alternatief: Ctrl+Shift+1-5?

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________
