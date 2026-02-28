# Changelog

All notable changes to Tandem Browser will be documented in this file.

## [v0.15.2] - 2026-02-28

### Toegevoegd
- **Sidebar Infrastructuur** (`src/sidebar/`) — fundament voor alle sidebar features
  - `src/sidebar/types.ts` — SidebarState ('hidden'|'narrow'|'wide'), SidebarItem, SidebarConfig types
  - `src/sidebar/manager.ts` — SidebarManager class met load/save/getConfig/updateConfig/toggleItem/reorderItems/setState/setActiveItem
  - `src/api/routes/sidebar.ts` — 6 REST endpoints:
    - `GET  /sidebar/config` — volledige config ophalen
    - `POST /sidebar/config` — config bijwerken (state, activeItemId)
    - `POST /sidebar/items/:id/toggle` — item enable/disable
    - `POST /sidebar/items/:id/activate` — panel openen of sluiten
    - `POST /sidebar/reorder` — drag-to-reorder (orderedIds array)
    - `POST /sidebar/state` — sidebar state wijzigen (hidden/narrow/wide)
  - 12 default sidebar items: workspaces, personal news, pinboards, bookmarks, history, downloads + whatsapp, telegram, discord, slack, instagram, x
  - Config persistent in `~/.tandem/sidebar-config.json`

### Gewijzigd
- `src/registry.ts` — `sidebarManager: SidebarManager` toegevoegd aan ManagerRegistry interface
- `src/main.ts` — SidebarManager instantiatie in `startAPI()` + cleanup in `app.on('will-quit')`
- `src/api/server.ts` — `registerSidebarRoutes(router, ctx)` toegevoegd
- `src/api/tests/helpers.ts` — test helper bijgewerkt voor nieuwe manager
- `git-hooks/post-commit` — emoji-prefix stripping zodat `🗂️ feat:` correct als `feat:` herkend wordt

### Architectuur
- Elke messenger (WhatsApp/Telegram/Discord/Slack/Instagram/X) krijgt eigen slot in sidebar — niet gegroepeerd
- Twee visuele stijlen in UI (fase 2): outline Heroicons voor utility, brand colored SVGs voor messengers
- Active indicator: gekleurde rounded square achter actief icoon (Opera-stijl)

## [v0.15.1] - 2026-02-28

- fix: About window now shows correct version

- Removed broken preload-about approach
- Version now hardcoded in shell/about.html (v0.15.0)
- Post-commit hook updated to auto-update about.html on version bump
- Cleaner and more reliable than runtime injection

## [v0.15.0] - 2026-02-28

- feat: add auto-versioning git hook + setup script

- git-hooks/post-commit: auto-bump version + update CHANGELOG
- setup-dev.sh: one-command dev environment setup
- Configures core.hooksPath to use git-hooks/ (committed in repo)
- Kees can run ./setup-dev.sh after next pull to enable hook
- Ensures consistent versioning across all dev machines

## [v0.14.3] - 2026-02-28

- fix: About window improvements (height 650, auto-version from package.json)

## [v0.14.2] - 2026-02-28

- fix: correct path depth for About window (shell/about.html now loads)

## [v0.14.1] - 2026-02-28

- feat: auto-sync webhook.secret with OpenClaw hooks.token (cross-platform fix)

## [v0.14.0] - 2026-02-27

- Initial stable release with 19/19 items complete
