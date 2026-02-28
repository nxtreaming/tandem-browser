# Fase 3 — Telegram, Instagram en X/Twitter Panels

> **Feature:** Sidebar Chat Clients
> **Sessies:** 1 sessie
> **Prioriteit:** MIDDEL
> **Afhankelijk van:** Fase 2 klaar (Discord + Slack werken)

---

## Doel van deze fase

Voeg de laatste drie messenger panels toe: Telegram, Instagram en X/Twitter. Het sidebar framework en het panel-patroon staan al — deze fase voegt alleen de service-specifieke configuratie en eventuele edge cases toe. Na deze fase zijn alle 6 sidebar chat clients operationeel.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `LEES-MIJ-EERST.md` (deze map) | — (lees volledig) | Context en regels |
| `src/sidebar/manager.ts` | `class SidebarManager`, `DEFAULT_SERVICES` | Service definities verifiëren |
| `shell/index.html` | `// === SIDEBAR CHAT ===` | Icon strip verifiëren — Telegram, Instagram, X moeten er al staan |
| `shell/js/sidebar.js` (of waar sidebar JS staat) | `parseBadgeCount()`, `toggleSidebarPanel()` | Badge parsing + panel logic |
| `shell/css/sidebar.css` | `.sidebar-icon` | Eventuele styling tweaks |

---

## Te bouwen in deze fase

### Stap 1: Verifieer dat Telegram, Instagram en X al in het framework staan

**Wat:** Alle 6 services zijn al gedefinieerd in fase 1. Verifieer dat Telegram, Instagram en X correct werken door ze te openen.

**Bestand:** `src/sidebar/manager.ts`

**Zoek naar:** `DEFAULT_SERVICES` — deze drie moeten er staan:

```typescript
{ id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org/a/', partition: 'persist:telegram', icon: '✈️' },
{ id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com', partition: 'persist:instagram', icon: '📷' },
{ id: 'x', name: 'X', url: 'https://x.com', partition: 'persist:x', icon: '𝕏' },
```

Normaal gesproken zou het klikken op deze iconen al een panel moeten openen met de juiste webview. Test dit eerst voordat je verder bouwt.

### Stap 2: Telegram-specifieke aanpassingen

**Wat:** Telegram Web heeft twee versies. We gebruiken Telegram Web A (`https://web.telegram.org/a/`) — dit is de modernste versie met de beste responsieve layout.

**Aandachtspunten:**
- Telegram Web A werkt goed in smalle panels (responsive design)
- Login gaat via QR-code OF telefoonnummer — beide werken in een webview
- Telegram badge patroon: `Telegram (N)` — het getal staat ACHTER de naam (anders dan de meeste services die `(N) Service` gebruiken)

**Bestand:** `shell/js/sidebar.js`

**Toevoegen aan:** `parseBadgeCount()` functie

```javascript
function parseBadgeCount(serviceId, title) {
  // Standaard: zoek (N) patroon — werkt voor WhatsApp, Discord, Instagram, X
  const numMatch = title.match(/\((\d+)\)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  // Slack-specifiek: * prefix
  if (serviceId === 'slack' && title.startsWith('*')) {
    return -1;
  }

  // Telegram: titel patroon is "Telegram (N)" — standaard regex vangt dit al
  // Geen extra logica nodig

  return 0;
}
```

**Opmerking:** De standaard `\((\d+)\)` regex vangt Telegram's patroon `Telegram (2)` al correct op — geen extra logica nodig.

### Stap 3: Instagram-specifieke aanpassingen

**Wat:** Instagram's web app is volledig responsief en werkt goed in smalle panels. Geen speciale aanpassingen nodig.

**Aandachtspunten:**
- Instagram badge patroon: `(N) Instagram` — standaard patroon, wordt al gevangen door de regex
- Instagram kan een "open in app" banner tonen bovenaan de pagina — dit is vervelend maar onvermijdelijk in een desktop webview. Robin kan deze banner wegklikken.
- Instagram DMs werken via `https://www.instagram.com/direct/inbox/` — deze URL laadt automatisch via de navigatie in de web app

**Minimum breedte:** 360px (Instagram's responsive layout schaalt goed naar beneden)

### Stap 4: X/Twitter-specifieke aanpassingen

**Wat:** X/Twitter's web app is volledig responsief. De sidebar levert dezelfde ervaring als een smal browservenster.

**Aandachtspunten:**
- X badge patroon: `(N) X` — standaard patroon
- X kan een "Cookies accepteren" dialoog tonen bij eerste bezoek — Robin moet dit eenmalig accepteren. Het wordt opgeslagen in `persist:x`.
- X/Twitter heeft goed responsief design met een "slim" layout voor smalle schermen

**Relatie met X-Scout:** Tandem heeft een interne X-Scout agent voor X/Twitter intelligence. De sidebar X panel is NIET dezelfde als X-Scout — de sidebar is voor Robin's handmatige X/Twitter gebruik. X-Scout opereert via de hoofd-webview met stealth. Ze gebruiken verschillende partitions en mogen niet met elkaar interfereren.

### Stap 5: Optioneel — Panel reordering

**Wat:** Robin wil misschien de volgorde van de sidebar iconen aanpassen. Dit is een nice-to-have voor fase 3.

**Implementatie:** Voeg een `order` veld toe aan `SidebarConfig.panels`:

```typescript
panels: Record<string, {
  enabled: boolean;
  muted: boolean;
  width: number;
  customUrl?: string;
  order?: number;  // ← volgorde in de icon strip
}>
```

**API endpoint:**

```typescript
// POST /sidebar/reorder — pas icoon volgorde aan
router.post('/sidebar/reorder', async (req: Request, res: Response) => {
  try {
    const { order } = req.body; // ["whatsapp", "slack", "discord", "telegram", "x", "instagram"]
    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Missing required field: order (array of service IDs)' });
    }
    ctx.sidebarManager.reorderPanels(order);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

Dit is **optioneel** — als er geen tijd voor is, kan het in een latere sprint.

### Stap 6: Optioneel — Panel enable/disable

**Wat:** Robin wil misschien niet alle 6 iconen zien. Voeg een enable/disable per service toe.

**API endpoint:**

```typescript
// POST /sidebar/enable — enable/disable een service
router.post('/sidebar/enable', async (req: Request, res: Response) => {
  try {
    const { service, enabled } = req.body;
    if (!service) return res.status(400).json({ error: 'Missing required field: service' });
    ctx.sidebarManager.enablePanel(service, enabled !== false);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

**Shell-side:** Verberg iconen met `enabled: false` in de icon strip.

Dit is ook **optioneel** voor fase 3.

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Open Telegram panel
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/open \
  -H "Content-Type: application/json" \
  -d '{"service": "telegram"}'
# Verwacht: {"ok":true,"panel":{"id":"telegram","name":"Telegram",...}}

# Test 2: Open Instagram panel
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/open \
  -H "Content-Type: application/json" \
  -d '{"service": "instagram"}'
# Verwacht: {"ok":true,"panel":{"id":"instagram","name":"Instagram",...}}

# Test 3: Open X panel
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/open \
  -H "Content-Type: application/json" \
  -d '{"service": "x"}'
# Verwacht: {"ok":true,"panel":{"id":"x","name":"X",...}}

# Test 4: Status — alle 6 services zichtbaar
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/sidebar/status
# Verwacht: {"ok":true,"services":[...6 services...]}

# Test 5: Alle services togglebaar
for svc in whatsapp discord slack telegram instagram x; do
  echo "=== $svc ==="
  curl -s -H "Authorization: Bearer $TOKEN" \
    -X POST http://localhost:8765/sidebar/toggle \
    -H "Content-Type: application/json" \
    -d "{\"service\": \"$svc\"}"
  echo ""
done
# Verwacht: 6x {"ok":true,"visible":true,...}

# Test 6 (optioneel): Panel reorder
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/reorder \
  -H "Content-Type: application/json" \
  -d '{"order": ["whatsapp", "slack", "discord", "telegram", "x", "instagram"]}'
# Verwacht: {"ok":true}
```

**UI verificatie:**
- [ ] Telegram icoon (✈️) opent Telegram Web A in sidebar panel
- [ ] Telegram login (QR-code of telefoon) werkt in het panel
- [ ] Telegram sessie blijft bewaard na herstart (persist:telegram)
- [ ] Instagram icoon (📷) opent Instagram in sidebar panel
- [ ] Instagram login werkt, feed en DMs zijn toegankelijk
- [ ] Instagram sessie bewaard na herstart (persist:instagram)
- [ ] X icoon (𝕏) opent X/Twitter in sidebar panel
- [ ] X login werkt, timeline en DMs zijn toegankelijk
- [ ] X sessie bewaard na herstart (persist:x)
- [ ] Schakelen tussen alle 6 panels werkt soepel
- [ ] Notification badges werken voor alle 6 services
- [ ] Elke service onthoudt zijn eigen login, chat-positie, en scroll-state

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-3-telegram-instagram-x.md) volledig
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
6. git commit -m "🗨️ feat: sidebar Telegram + Instagram + X panels"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Feature compleet! Alle 6 sidebar chat clients operationeel.
```

---

## Bekende valkuilen

- [ ] Telegram Web versie — gebruik `https://web.telegram.org/a/` (Web A), niet de oude `https://web.telegram.org/z/` of `https://web.telegram.org/k/`
- [ ] Instagram "open in app" banner — kan niet voorkomen worden, Robin moet hem wegklikken. Wordt per-sessie onthouden.
- [ ] X/Twitter cookie-dialoog — eenmalig accepteren, opgeslagen in persist:x
- [ ] X sidebar is NIET X-Scout — verschillende partitions, verschillende doelen. Geen interferentie.
- [ ] TypeScript strict mode — geen `any` buiten catch
- [ ] Test ALLE 6 services na voltooiing, niet alleen de 3 nieuwe — regressie voorkomen
