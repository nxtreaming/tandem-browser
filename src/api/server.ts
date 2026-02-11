import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { BrowserWindow } from 'electron';
import { copilotAlert } from '../main';
import { TabManager } from '../tabs/manager';
import { PanelManager } from '../panel/manager';
import { DrawOverlayManager } from '../draw/overlay';
import { ActivityTracker } from '../activity/tracker';
import { VoiceManager } from '../voice/recognition';
import { humanizedClick, humanizedType } from '../input/humanized';

export class TandemAPI {
  private app: express.Application;
  private server: http.Server | null = null;
  private win: BrowserWindow;
  private port: number;
  private tabManager: TabManager;
  private panelManager: PanelManager;
  private drawManager: DrawOverlayManager;
  private activityTracker: ActivityTracker;
  private voiceManager: VoiceManager;

  constructor(win: BrowserWindow, port: number = 8765, tabManager: TabManager, panelManager: PanelManager, drawManager: DrawOverlayManager, activityTracker: ActivityTracker, voiceManager: VoiceManager) {
    this.win = win;
    this.port = port;
    this.tabManager = tabManager;
    this.panelManager = panelManager;
    this.drawManager = drawManager;
    this.activityTracker = activityTracker;
    this.voiceManager = voiceManager;
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.setupRoutes();
  }

  /** Get active tab's WebContents, or null */
  private async getActiveWC(): Promise<Electron.WebContents | null> {
    return this.tabManager.getActiveWebContents();
  }

  /** Helper to run JS in the active tab's webview */
  private async execInActiveTab(code: string): Promise<any> {
    const wc = await this.getActiveWC();
    if (!wc) throw new Error('No active tab');
    return wc.executeJavaScript(code);
  }

  private setupRoutes(): void {
    // ═══════════════════════════════════════════════
    // STATUS
    // ═══════════════════════════════════════════════

    this.app.get('/status', async (_req: Request, res: Response) => {
      try {
        const tab = this.tabManager.getActiveTab();
        if (!tab) {
          res.json({ ready: false, tabs: 0 });
          return;
        }
        const wc = await this.getActiveWC();
        res.json({
          ready: !!wc,
          url: tab.url,
          title: tab.title,
          loading: wc ? wc.isLoading() : false,
          activeTab: tab.id,
          tabs: this.tabManager.count,
        });
      } catch (e: any) {
        res.json({ ready: false, error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════

    this.app.post('/navigate', async (req: Request, res: Response) => {
      const { url } = req.body;
      if (!url) { res.status(400).json({ error: 'url required' }); return; }
      try {
        const wc = await this.getActiveWC();
        if (!wc) { res.status(500).json({ error: 'No active tab' }); return; }
        wc.loadURL(url);
        this.panelManager.logActivity('navigate', { url });
        res.json({ ok: true, url });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // PAGE CONTENT
    // ═══════════════════════════════════════════════

    this.app.get('/page-content', async (_req: Request, res: Response) => {
      try {
        const content = await this.execInActiveTab(`
          (() => {
            const title = document.title;
            const url = window.location.href;
            const meta = document.querySelector('meta[name="description"]');
            const description = meta ? meta.getAttribute('content') : '';
            const body = document.body.cloneNode(true);
            body.querySelectorAll('script, style, nav, footer, aside, [role="banner"], [role="navigation"], .ad, .ads, .advertisement').forEach(el => el.remove());
            const text = body.innerText.replace(/\\n{3,}/g, '\\n\\n').trim();
            return { title, url, description, text, length: text.length };
          })()
        `);
        res.json(content);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/page-html', async (_req: Request, res: Response) => {
      try {
        const html = await this.execInActiveTab('document.documentElement.outerHTML');
        res.type('html').send(html);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // CLICK — via sendInputEvent (Event.isTrusted = true)
    // ═══════════════════════════════════════════════

    this.app.post('/click', async (req: Request, res: Response) => {
      const { selector } = req.body;
      if (!selector) { res.status(400).json({ error: 'selector required' }); return; }
      try {
        const wc = await this.getActiveWC();
        if (!wc) { res.status(500).json({ error: 'No active tab' }); return; }
        const result = await humanizedClick(wc, selector);
        this.panelManager.logActivity('click', { selector });
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // TYPE — via sendInputEvent char-by-char (Event.isTrusted = true)
    // ═══════════════════════════════════════════════

    this.app.post('/type', async (req: Request, res: Response) => {
      const { selector, text, clear } = req.body;
      if (!selector || text === undefined) {
        res.status(400).json({ error: 'selector and text required' });
        return;
      }
      try {
        const wc = await this.getActiveWC();
        if (!wc) { res.status(500).json({ error: 'No active tab' }); return; }
        const result = await humanizedType(wc, selector, text, !!clear);
        this.panelManager.logActivity('input', { selector, textLength: text.length });
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // EXECUTE JS
    // ═══════════════════════════════════════════════

    this.app.post('/execute-js', async (req: Request, res: Response) => {
      const { code } = req.body;
      if (!code) { res.status(400).json({ error: 'code required' }); return; }
      try {
        const result = await this.execInActiveTab(code);
        res.json({ ok: true, result });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // SCREENSHOT — via capturePage (main process, not in webview)
    // ═══════════════════════════════════════════════

    this.app.get('/screenshot', async (req: Request, res: Response) => {
      try {
        const wc = await this.getActiveWC();
        if (!wc) { res.status(500).json({ error: 'No active tab' }); return; }
        const image = await wc.capturePage();
        const png = image.toPNG();

        if (req.query.save) {
          const fs = require('fs');
          const filePath = req.query.save as string;
          fs.writeFileSync(filePath, png);
          res.json({ ok: true, path: filePath, size: png.length });
        } else {
          res.type('png').send(png);
        }
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // COOKIES
    // ═══════════════════════════════════════════════

    this.app.get('/cookies', async (req: Request, res: Response) => {
      try {
        const url = req.query.url as string || '';
        const cookies = await this.win.webContents.session.cookies.get(
          url ? { url } : {}
        );
        res.json({ cookies });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // SCROLL — via sendInputEvent (mouseWheel)
    // ═══════════════════════════════════════════════

    this.app.post('/scroll', async (req: Request, res: Response) => {
      const { direction = 'down', amount = 500 } = req.body;
      try {
        const wc = await this.getActiveWC();
        if (!wc) { res.status(500).json({ error: 'No active tab' }); return; }
        const deltaY = direction === 'up' ? -amount : amount;
        wc.sendInputEvent({
          type: 'mouseWheel',
          x: 400,
          y: 400,
          deltaX: 0,
          deltaY,
        });
        this.panelManager.logActivity('scroll', { direction, amount });
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // COPILOT ALERT
    // ═══════════════════════════════════════════════

    this.app.post('/copilot-alert', (req: Request, res: Response) => {
      const { title = 'Hulp nodig', body = '' } = req.body;
      copilotAlert(title, body);
      res.json({ ok: true, sent: true });
    });

    // ═══════════════════════════════════════════════
    // WAIT
    // ═══════════════════════════════════════════════

    this.app.post('/wait', async (req: Request, res: Response) => {
      const { selector, timeout = 10000 } = req.body;
      try {
        const code = selector ? `
          new Promise((res, rej) => {
            const check = () => {
              const el = document.querySelector('${selector}');
              if (el) return res({ ok: true, found: true });
              setTimeout(check, 200);
            };
            check();
            setTimeout(() => res({ ok: true, found: false, timeout: true }), ${timeout});
          })
        ` : `
          new Promise(res => {
            if (document.readyState === 'complete') return res({ ok: true, ready: true });
            window.addEventListener('load', () => res({ ok: true, ready: true }));
            setTimeout(() => res({ ok: true, ready: false, timeout: true }), ${timeout});
          })
        `;
        const result = await this.execInActiveTab(code);
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // LINKS
    // ═══════════════════════════════════════════════

    this.app.get('/links', async (_req: Request, res: Response) => {
      try {
        const links = await this.execInActiveTab(`
          Array.from(document.querySelectorAll('a[href]')).map(a => ({
            text: a.textContent?.trim().substring(0, 100),
            href: a.href,
            visible: a.offsetParent !== null
          })).filter(l => l.href && !l.href.startsWith('javascript:'))
        `);
        res.json({ links });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // FORMS
    // ═══════════════════════════════════════════════

    this.app.get('/forms', async (_req: Request, res: Response) => {
      try {
        const forms = await this.execInActiveTab(`
          Array.from(document.querySelectorAll('form')).map((form, i) => ({
            index: i,
            action: form.action,
            method: form.method,
            fields: Array.from(form.querySelectorAll('input, textarea, select')).map(f => ({
              tag: f.tagName.toLowerCase(),
              type: f.type || '',
              name: f.name || '',
              id: f.id || '',
              placeholder: f.placeholder || '',
              value: f.value || ''
            }))
          }))
        `);
        res.json({ forms });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // TAB MANAGEMENT
    // ═══════════════════════════════════════════════

    /** Open a new tab */
    this.app.post('/tabs/open', async (req: Request, res: Response) => {
      const { url = 'about:blank', groupId } = req.body;
      try {
        const tab = await this.tabManager.openTab(url, groupId);
        res.json({ ok: true, tab });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Close a tab */
    this.app.post('/tabs/close', async (req: Request, res: Response) => {
      const { tabId } = req.body;
      if (!tabId) { res.status(400).json({ error: 'tabId required' }); return; }
      try {
        const closed = await this.tabManager.closeTab(tabId);
        res.json({ ok: closed });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** List all tabs */
    this.app.get('/tabs/list', async (_req: Request, res: Response) => {
      try {
        const tabs = this.tabManager.listTabs();
        const groups = this.tabManager.listGroups();
        res.json({ tabs, groups });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Focus a tab */
    this.app.post('/tabs/focus', async (req: Request, res: Response) => {
      const { tabId } = req.body;
      if (!tabId) { res.status(400).json({ error: 'tabId required' }); return; }
      try {
        const focused = await this.tabManager.focusTab(tabId);
        res.json({ ok: focused });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Group tabs */
    this.app.post('/tabs/group', async (req: Request, res: Response) => {
      const { groupId, name, color = '#4285f4', tabIds } = req.body;
      if (!groupId || !name || !tabIds) {
        res.status(400).json({ error: 'groupId, name, and tabIds required' });
        return;
      }
      try {
        const group = this.tabManager.setGroup(groupId, name, color, tabIds);
        res.json({ ok: true, group });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // PANEL — Kees side panel
    // ═══════════════════════════════════════════════

    /** Get activity log */
    this.app.get('/activity-log', (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const type = req.query.type as string | undefined;
        const events = this.panelManager.getActivityLog(limit, type);
        res.json({ events });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Toggle panel */
    this.app.post('/panel/toggle', (req: Request, res: Response) => {
      try {
        const { open } = req.body;
        const isOpen = this.panelManager.togglePanel(open);
        res.json({ ok: true, open: isOpen });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Get chat messages */
    this.app.get('/chat', (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const messages = this.panelManager.getChatMessages(limit);
        res.json({ messages });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Send chat message as Kees */
    this.app.post('/chat', (req: Request, res: Response) => {
      const { text } = req.body;
      if (!text) { res.status(400).json({ error: 'text required' }); return; }
      try {
        const msg = this.panelManager.addChatMessage('kees', text);
        res.json({ ok: true, message: msg });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // DRAW — Annotated screenshots
    // ═══════════════════════════════════════════════

    /** Get last annotated screenshot */
    this.app.get('/screenshot/annotated', (_req: Request, res: Response) => {
      try {
        const png = this.drawManager.getLastScreenshot();
        if (!png) {
          res.status(404).json({ error: 'No annotated screenshot available' });
          return;
        }
        res.type('png').send(png);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Take annotated screenshot */
    this.app.post('/screenshot/annotated', async (_req: Request, res: Response) => {
      try {
        const activeTab = this.tabManager.getActiveTab();
        const wcId = activeTab ? activeTab.webContentsId : null;
        const result = await this.drawManager.captureAnnotated(wcId);
        if (result.ok) {
          res.json(result);
        } else {
          res.status(500).json(result);
        }
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Toggle draw mode */
    this.app.post('/draw/toggle', (req: Request, res: Response) => {
      try {
        const { enabled } = req.body;
        const isEnabled = this.drawManager.toggleDrawMode(enabled);
        res.json({ ok: true, drawMode: isEnabled });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** List recent screenshots */
    this.app.get('/screenshots', (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const screenshots = this.drawManager.listScreenshots(limit);
        res.json({ screenshots });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // VOICE — Speech recognition control
    // ═══════════════════════════════════════════════

    /** Start voice input */
    this.app.post('/voice/start', (_req: Request, res: Response) => {
      try {
        this.voiceManager.start();
        res.json({ ok: true, listening: true });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Stop voice input */
    this.app.post('/voice/stop', (_req: Request, res: Response) => {
      try {
        this.voiceManager.stop();
        res.json({ ok: true, listening: false });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    /** Get voice status */
    this.app.get('/voice/status', (_req: Request, res: Response) => {
      try {
        const status = this.voiceManager.getStatus();
        res.json(status);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // ═══════════════════════════════════════════════
    // ACTIVITY LOG — Live co-pilot feed
    // ═══════════════════════════════════════════════

    /** Get detailed activity log with timestamps */
    this.app.get('/activity-log', (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const since = req.query.since ? parseInt(req.query.since as string) : undefined;
        const entries = this.activityTracker.getLog(limit, since);
        res.json({ entries, count: entries.length });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  stop(): void {
    this.server?.close();
  }
}
