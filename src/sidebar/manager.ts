import * as fs from 'fs';
import * as path from 'path';
import { tandemDir, ensureDir } from '../utils/paths';
import type { SidebarConfig, SidebarItem, SidebarState } from './types';

// Elke messenger krijgt eigen slot in de sidebar (zoals Opera)
// Utility items bovenaan, messenger items onderaan (met separator in UI)
const DEFAULT_CONFIG: SidebarConfig = {
  state: 'narrow',
  activeItemId: null,
  items: [
    // Utility panels (outline icon, grijs)
    { id: 'workspaces', label: 'Workspaces',   icon: '', type: 'panel',   enabled: true, order: 0 },
    { id: 'news',       label: 'Personal News', icon: '', type: 'panel',   enabled: true, order: 1 },
    { id: 'pinboards',  label: 'Pinboards',    icon: '', type: 'panel',   enabled: true, order: 2 },
    { id: 'bookmarks',  label: 'Bookmarks',    icon: '', type: 'panel',   enabled: true, order: 3 },
    { id: 'history',    label: 'History',      icon: '', type: 'panel',   enabled: true, order: 4 },
    { id: 'downloads',  label: 'Downloads',    icon: '', type: 'panel',   enabled: true, order: 5 },
    // Messenger webviews (brand colored icon, eigen persist: partition)
    { id: 'whatsapp',   label: 'WhatsApp',     icon: '', type: 'webview', enabled: true, order: 6 },
    { id: 'telegram',   label: 'Telegram',     icon: '', type: 'webview', enabled: true, order: 7 },
    { id: 'discord',    label: 'Discord',      icon: '', type: 'webview', enabled: true, order: 8 },
    { id: 'slack',      label: 'Slack',        icon: '', type: 'webview', enabled: true, order: 9 },
    { id: 'instagram',  label: 'Instagram',    icon: '', type: 'webview', enabled: true, order: 10 },
    { id: 'x',          label: 'X (Twitter)',  icon: '', type: 'webview', enabled: true, order: 11 },
  ]
};

export class SidebarManager {
  private storageFile: string;
  private config: SidebarConfig;

  constructor() {
    this.storageFile = path.join(tandemDir(), 'sidebar-config.json');
    this.config = this.load();
  }

  getConfig(): SidebarConfig { return this.config; }

  updateConfig(partial: Partial<SidebarConfig>): SidebarConfig {
    this.config = { ...this.config, ...partial };
    this.save();
    return this.config;
  }

  toggleItem(id: string): SidebarItem | undefined {
    const item = this.config.items.find(i => i.id === id);
    if (!item) return undefined;
    item.enabled = !item.enabled;
    this.save();
    return item;
  }

  reorderItems(orderedIds: string[]): void {
    orderedIds.forEach((id, idx) => {
      const item = this.config.items.find(i => i.id === id);
      if (item) item.order = idx;
    });
    this.config.items.sort((a, b) => a.order - b.order);
    this.save();
  }

  setState(state: SidebarState): void {
    this.config.state = state;
    this.save();
  }

  setActiveItem(id: string | null): void {
    this.config.activeItemId = id;
    this.save();
  }

  private load(): SidebarConfig {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        // Merge with defaults to handle new items added in future versions
        return { ...DEFAULT_CONFIG, ...raw };
      }
    } catch { /* use defaults */ }
    return { ...DEFAULT_CONFIG };
  }

  private save(): void {
    try {
      ensureDir(tandemDir());
      fs.writeFileSync(this.storageFile, JSON.stringify(this.config, null, 2));
    } catch { /* ignore */ }
  }

  destroy(): void { /* nothing to clean up */ }
}
