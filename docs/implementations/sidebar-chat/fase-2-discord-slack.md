# Fase 2 — Discord + Slack Panels

> **Feature:** Sidebar Chat Clients
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Fase 1 klaar (sidebar framework + WhatsApp werkt)

---

## Doel van deze fase

Voeg Discord en Slack toe als sidebar panels. Hetzelfde patroon als WhatsApp (fase 1), maar met service-specifieke aandachtspunten: Discord kan CAPTCHAs tonen bij eerste login, en Slack heeft workspace-specifieke URLs die Robin moet kunnen configureren.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `LEES-MIJ-EERST.md` (deze map) | — (lees volledig) | Context en regels |
| `src/sidebar/manager.ts` | `class SidebarManager`, `DEFAULT_SERVICES`, `SidebarConfig` | Bestaande sidebar manager uit fase 1 |
| `shell/index.html` | `// === SIDEBAR CHAT ===` | Bestaande sidebar HTML uit fase 1 |
| `shell/js/main.js` of `shell/js/sidebar.js` | Sidebar click handlers, `toggleSidebarPanel()` | Bestaande sidebar JS uit fase 1 |
| `shell/css/sidebar.css` | `.sidebar-icon`, `.sidebar-panel-container` | Bestaande sidebar styling |

---

## Te bouwen in deze fase

### Stap 1: Verifieer dat Discord en Slack al in de service-definitie staan

**Wat:** In fase 1 zijn alle 6 services al gedefinieerd in `DEFAULT_SERVICES` in `SidebarManager`. Discord (`persist:discord`) en Slack (`persist:slack`) staan er al in. Verifieer dat de icon strip al knoppen heeft voor Discord en Slack.

**Bestand:** `src/sidebar/manager.ts`

**Zoek naar:** `DEFAULT_SERVICES` array

Discord en Slack moeten hier al staan:
```typescript
{ id: 'discord', name: 'Discord', url: 'https://discord.com/app', partition: 'persist:discord', icon: '🎮' },
{ id: 'slack', name: 'Slack', url: 'https://app.slack.com', partition: 'persist:slack', icon: '💼' },
```

Als het goed is hoeft hier niets aan — de sidebar infrastructure uit fase 1 ondersteunt al meerdere services. Het klikken op Discord/Slack iconen zou al een panel moeten openen.

### Stap 2: Discord-specifieke aanpassingen

**Wat:** Discord heeft twee aandachtspunten:

1. **Minimum breedte:** Discord's web app heeft een minimum breedte van ~420px. Als het panel smaller is, breekt de layout. Zorg dat het panel minimaal 420px breed is wanneer Discord actief is.

2. **CAPTCHA bij eerste login:** Discord kan een hCaptcha tonen bij login vanuit een nieuw browser profiel. Dit is een eenmalig probleem — na succesvolle login wordt de sessie opgeslagen in `persist:discord`.

**Bestand:** `src/sidebar/manager.ts`

**Toevoegen aan:** Service configuratie of `openPanel()` methode

```typescript
// Per-service minimum width
const SERVICE_MIN_WIDTHS: Record<string, number> = {
  discord: 420,
  // andere services: 360 (standaard)
};
```

**Bestand:** `shell/js/sidebar.js` (of waar sidebar JS staat)

Bij het openen van een Discord panel, stel minimum breedte in:
```javascript
function openSidebarPanel(serviceId) {
  const minWidth = SERVICE_MIN_WIDTHS[serviceId] || 360;
  const panelWidth = Math.max(currentPanelWidth, minWidth);
  // pas panel breedte aan
}
```

### Stap 3: Slack workspace URL configuratie

**Wat:** Slack gebruikt workspace-specifieke URLs. De standaard `https://app.slack.com` werkt als redirect naar de juiste workspace, maar sommige workspaces vereisen een directe URL (bv. `https://myteam.slack.com`). Robin moet dit kunnen configureren.

**Bestand:** `src/sidebar/manager.ts`

**Toevoegen aan:** `SidebarConfig` interface en `openPanel()` methode

```typescript
export interface SidebarConfig {
  panels: Record<string, {
    enabled: boolean;
    muted: boolean;
    width: number;
    customUrl?: string;  // ← voor Slack workspace URL
  }>;
  // ...
}
```

Bij het openen van een Slack panel, gebruik `customUrl` als die geconfigureerd is:

```typescript
openPanel(serviceId: string): SidebarService {
  const service = this.getService(serviceId);
  const panelConfig = this.config.panels[serviceId];
  const url = panelConfig?.customUrl || service.url;
  // maak webview aan met deze url
}
```

**Bestand:** `src/api/routes/sidebar.ts`

**Toevoegen:** Endpoint voor workspace URL configuratie

```typescript
// POST /sidebar/config — pas panel configuratie aan
router.post('/sidebar/config', async (req: Request, res: Response) => {
  try {
    const { service, customUrl, width } = req.body;
    if (!service) return res.status(400).json({ error: 'Missing required field: service' });
    ctx.sidebarManager.updatePanelConfig(service, { customUrl, width });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

### Stap 4: Notification badge parsing voor Discord en Slack

**Wat:** Verifieer dat de badge detectie correct werkt voor Discord en Slack title patronen.

**Discord title patroon:** `(5) Discord | #general - Server Name` → extract `5`

**Slack title patroon:** Slack gebruikt verschillende patronen:
- `* Slack - Workspace` → ongelezen berichten (sterretje), badge = generiek indicator
- `(3) Slack - Workspace` → sommige Slack versies gebruiken getal in titel
- Geen getal → `*` als indicator → toon een punt-badge (geen getal)

**Bestand:** `shell/js/sidebar.js` (of waar badge detectie staat)

Pas de badge parser aan om Slack's sterretje-patroon te herkennen:

```javascript
function parseBadgeCount(serviceId, title) {
  // Standaard: zoek (N) patroon
  const numMatch = title.match(/\((\d+)\)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  // Slack-specifiek: * prefix = ongelezen (geen specifiek getal)
  if (serviceId === 'slack' && title.startsWith('*')) {
    return -1; // -1 = "er zijn ongelezen berichten" (toon stip, geen getal)
  }

  return 0;
}

function updateBadge(serviceId, count) {
  const badge = document.getElementById(`badge-${serviceId}`);
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count.toString();
    badge.style.display = 'flex';
  } else if (count === -1) {
    badge.textContent = '•';  // stip voor "ongelezen maar geen getal"
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}
```

### Stap 5: Test Discord en Slack panels

**Wat:** Handmatig testen dat beide panels correct laden, login werkt, en sessie bewaard blijft.

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Open Discord panel
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/open \
  -H "Content-Type: application/json" \
  -d '{"service": "discord"}'
# Verwacht: {"ok":true,"panel":{"id":"discord","name":"Discord",...}}

# Test 2: Open Slack panel
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/open \
  -H "Content-Type: application/json" \
  -d '{"service": "slack"}'
# Verwacht: {"ok":true,"panel":{"id":"slack","name":"Slack",...}}

# Test 3: Configureer Slack workspace URL
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/sidebar/config \
  -H "Content-Type: application/json" \
  -d '{"service": "slack", "customUrl": "https://myteam.slack.com"}'
# Verwacht: {"ok":true}

# Test 4: Verifieer configuratie opgeslagen
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/sidebar/list
# Verwacht: slack service met customUrl in de output

# Test 5: Toggle werkt voor alle drie
for svc in whatsapp discord slack; do
  curl -s -H "Authorization: Bearer $TOKEN" \
    -X POST http://localhost:8765/sidebar/toggle \
    -H "Content-Type: application/json" \
    -d "{\"service\": \"$svc\"}"
  echo ""
done
# Verwacht: 3x {"ok":true,"visible":true,...}
```

**UI verificatie:**
- [ ] Discord icoon (🎮) klikken opent Discord web app in sidebar panel
- [ ] Discord login scherm verschijnt, login is mogelijk
- [ ] Na login: sessie blijft bewaard na browser herstart (persist:discord)
- [ ] Slack icoon (💼) klikken opent Slack in sidebar panel
- [ ] Slack workspace login werkt
- [ ] Als `customUrl` geconfigureerd is, laadt Slack die specifieke workspace URL
- [ ] Notification badges verschijnen voor Discord en Slack bij ongelezen berichten
- [ ] Schakelen tussen WhatsApp, Discord en Slack werkt soepel (vorige verbergt, nieuwe verschijnt)
- [ ] Alle drie panels onthouden hun scroll-positie en chat-state

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-2-discord-slack.md) volledig
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
6. git commit -m "🗨️ feat: sidebar Discord + Slack panels"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende sessie start bij fase-3-telegram-instagram-x.md
```

---

## Bekende valkuilen

- [ ] Discord minimum breedte (420px) — panel mag niet smaller worden
- [ ] Discord CAPTCHA bij eerste login — dit is eenmalig, persist:discord onthoudt de sessie daarna
- [ ] Slack workspace URL — standaard `https://app.slack.com` redirect naar juiste workspace, maar sommige setups vereisen directe URL
- [ ] Slack badge patroon anders dan andere services — `*` prefix ipv `(N)` getal
- [ ] TypeScript strict mode — geen `any` buiten catch
- [ ] Vergeet niet het nieuwe `/sidebar/config` endpoint ook te testen
