import { BrowserWindow } from 'electron';
import { PanelManager } from '../panel/manager';
import { DrawOverlayManager } from '../draw/overlay';

export interface ActivityEntry {
  id: number;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * ActivityTracker — Tracks navigation, clicks, scrolls via Electron webview events.
 * 
 * CRITICAL: All tracking happens via Electron main process events,
 * NOT via injected scripts in the webview. Anti-detect safe.
 * 
 * Auto-snapshots on navigation events.
 */
export class ActivityTracker {
  private win: BrowserWindow;
  private panelManager: PanelManager;
  private drawManager: DrawOverlayManager;
  private log: ActivityEntry[] = [];
  private counter = 0;
  private maxEntries = 1000;
  private autoSnapshotEnabled = true;

  constructor(win: BrowserWindow, panelManager: PanelManager, drawManager: DrawOverlayManager) {
    this.win = win;
    this.panelManager = panelManager;
    this.drawManager = drawManager;
  }

  /** Handle webview event forwarded from renderer */
  onWebviewEvent(data: { type: string; url?: string; tabId?: string; [key: string]: unknown }): void {
    const entry: ActivityEntry = {
      id: ++this.counter,
      type: data.type,
      timestamp: Date.now(),
      data,
    };
    this.log.push(entry);
    if (this.log.length > this.maxEntries) {
      this.log = this.log.slice(-this.maxEntries);
    }

    // Log to panel
    this.panelManager.logActivity(
      data.type as any,
      data as Record<string, unknown>
    );

    // Auto-snapshot on navigation
    if (this.autoSnapshotEnabled && data.type === 'did-navigate' && data.url) {
      // Delay snapshot to let page render
      setTimeout(() => {
        this.win.webContents.send('auto-snapshot-request', { url: data.url });
      }, 2000);
    }
  }

  /** Get activity log */
  getLog(limit: number = 100, since?: number): ActivityEntry[] {
    let entries = this.log;
    if (since) {
      entries = entries.filter(e => e.timestamp > since);
    }
    return entries.slice(-limit);
  }

  /** Enable/disable auto-snapshot */
  setAutoSnapshot(enabled: boolean): void {
    this.autoSnapshotEnabled = enabled;
  }
}
