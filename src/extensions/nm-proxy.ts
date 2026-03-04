/**
 * Native Messaging Proxy for Electron 40+
 *
 * Electron 40 does not implement chrome.runtime.connectNative() or
 * chrome.runtime.sendNativeMessage() for extensions loaded via
 * session.extensions.loadExtension() — the Session object has no
 * setNativeMessagingHostDirectory() API and the extension bindings
 * simply don't wire up native messaging.
 *
 * To work around this, the action-polyfill overrides chrome.runtime via
 * a Proxy so that connectNative() / sendNativeMessage() route through
 * Tandem's local HTTP/WebSocket API instead.
 *
 * Endpoints:
 *   POST /extensions/native-message      — sendNativeMessage (one-shot)
 *   WS   /extensions/native-message/ws   — connectNative (persistent port)
 *
 * Native messaging wire protocol (Chrome spec):
 *   Each message = 4-byte LE uint32 length + UTF-8 JSON payload
 */

import type { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Router } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from '../utils/logger';

const log = createLogger('NMProxy');

// Extension ID that Tandem assigns to the 1Password extension
const TANDEM_EXTENSION_ID = 'chdppelbdlmkldaobdpeaemleeajiodj';

// 1Password's official Chrome Web Store extension ID.
// When spawning BrowserSupport, we use this ID as the origin argument because
// 1Password validates extension IDs against its own internal list (not just
// the Chrome manifest's allowed_origins). The CWS ID is in 1Password's
// internal list; our Tandem-extracted ID is not.
// The actual communication still uses the Tandem extension (via polyfill proxy).
const ONEPW_CHROME_ORIGIN = 'chrome-extension://aeblfdkhhhdcdjpifhhbdiojplfjncoa/';

// Directories to search for native messaging manifests (macOS)
const MANIFEST_DIRS = [
  path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
  path.join(os.homedir(), 'Library', 'Application Support', 'Tandem Browser', 'NativeMessagingHosts'),
  '/Library/Google/Chrome/NativeMessagingHosts',
];

// ─── Manifest lookup ──────────────────────────────────────────────────────────

interface HostInfo {
  binary: string;
  manifestPath: string;
}

function findHostManifest(hostName: string): HostInfo | null {
  for (const dir of MANIFEST_DIRS) {
    const manifestPath = path.join(dir, `${hostName}.json`);
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { path?: string };
      if (manifest.path && fs.existsSync(manifest.path)) {
        return { binary: manifest.path, manifestPath };
      }
    } catch (_) {
      // corrupt manifest — skip
    }
  }
  return null;
}

// ─── Native messaging wire protocol ──────────────────────────────────────────

function readNativeMessage(buf: Buffer): { msg: unknown; remaining: Buffer } | null {
  if (buf.length < 4) return null;
  const len = buf.readUInt32LE(0);
  if (buf.length < 4 + len) return null;
  try {
    const msg = JSON.parse(buf.slice(4, 4 + len).toString('utf-8')) as unknown;
    return { msg, remaining: buf.slice(4 + len) };
  } catch {
    return null;
  }
}

function writeNativeMessage(msg: unknown): Buffer {
  const json = JSON.stringify(msg);
  const jsonLen = Buffer.byteLength(json, 'utf-8');
  const out = Buffer.allocUnsafe(4 + jsonLen);
  out.writeUInt32LE(jsonLen, 0);
  out.write(json, 4, 'utf-8');
  return out;
}

// ─── One-shot: sendNativeMessage ─────────────────────────────────────────────

function sendOneShot(binary: string, _extensionId: string, message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Use the official CWS origin — BrowserSupport validates against its own
    // internal extension ID list; Tandem's extracted ID is not in that list.
    const origin = ONEPW_CHROME_ORIGIN;
    const proc = spawn(binary, [origin], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let outBuf = Buffer.alloc(0);
    let settled = false;

    const done = (value: unknown, err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { proc.kill(); } catch (_) {}
      if (err) reject(err);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      done(undefined, new Error('Native messaging one-shot timeout (10s)'));
    }, 10_000);

    proc.stdout.on('data', (chunk: Buffer) => {
      outBuf = Buffer.concat([outBuf, chunk]);
      const result = readNativeMessage(outBuf);
      if (result) done(result.msg);
    });

    proc.on('error', (err: Error) => done(undefined, err));

    proc.on('close', (code: number | null) => {
      if (!settled) {
        done(undefined, new Error(`Process exited (code ${code ?? '?'}) before response`));
      }
    });

    // Send the request
    proc.stdin.write(writeNativeMessage(message));
    proc.stdin.end();
  });
}

// ─── Persistent port: connectNative ──────────────────────────────────────────

function handlePersistentConnection(ws: WebSocket, binary: string, _extensionId: string, host: string): void {
  // Use the official CWS origin — BrowserSupport validates against its own
  // internal extension ID list; Tandem's extracted ID is not in that list.
  const origin = ONEPW_CHROME_ORIGIN;
  const proc = spawn(binary, [origin], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let outBuf: any = Buffer.alloc(0);

  // Native → WebSocket
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proc.stdout.on('data', (chunk: any) => {
    outBuf = Buffer.concat([outBuf, chunk]);
    let result = readNativeMessage(outBuf);
    while (result) {
      outBuf = result.remaining;
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(result.msg)); } catch (_) {}
      }
      result = readNativeMessage(outBuf);
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    log.warn(`🔌 NM "${host}" stderr: ${chunk.toString().trim()}`);
  });

  proc.on('error', (err: Error) => {
    log.warn(`⚠️ NM "${host}" process error: ${err.message}`);
    if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'Native process error');
  });

  proc.on('close', (code: number | null) => {
    log.info(`🔌 NM "${host}" process exited (code ${code ?? '?'})`);
    if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'Native process exited');
  });

  // WebSocket → Native
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws.on('message', (data: any) => {
    try {
      const msg = JSON.parse(data.toString()) as unknown;
      proc.stdin.write(writeNativeMessage(msg));
    } catch (_) {
      log.warn(`⚠️ NM "${host}" invalid WS message`);
    }
  });

  ws.on('close', () => {
    log.info(`🔌 NM "${host}" WS closed — killing process`);
    try { proc.kill(); } catch (_) {}
  });

  log.info(`🔌 NM "${host}" persistent connection established`);
}

// ─── Public class ─────────────────────────────────────────────────────────────

export class NativeMessagingProxy {
  /**
   * Register POST /extensions/native-message on the Express router.
   * Must be called after body-parser middleware is in place.
   */
  registerRoutes(router: Router): void {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    router.post('/extensions/native-message', async (req, res) => {
      const { host, message, extensionId } = req.body as {
        host?: string;
        message?: unknown;
        extensionId?: string;
      };

      if (!host || message === undefined) {
        res.status(400).json({ error: 'Missing required fields: host, message' });
        return;
      }

      const effectiveId = extensionId ?? TANDEM_EXTENSION_ID;
      const hostInfo = findHostManifest(host);
      if (!hostInfo) {
        log.warn(`⚠️ NM proxy: host "${host}" not found`);
        res.status(404).json({ error: `Native messaging host "${host}" not found` });
        return;
      }

      try {
        const response = await sendOneShot(hostInfo.binary, effectiveId, message);
        log.info(`🔌 NM proxy: one-shot "${host}" OK`);
        res.json(response);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn(`⚠️ NM proxy one-shot error for "${host}": ${msg}`);
        res.status(500).json({ error: msg });
      }
    });

    log.info('🔌 NM proxy: HTTP route registered — POST /extensions/native-message');
  }

  /**
   * Register WebSocket handler at /extensions/native-message/ws on httpServer.
   * No auth required — localhost only.
   */
  startWebSocket(httpServer: HttpServer): void {
    // Use noServer:true + manual upgrade handling to avoid conflicts with other
    // WebSocketServer instances (e.g. GatekeeperWebSocket) on the same http.Server.
    // Multiple WSS instances attached via server:httpServer can interfere — the first
    // one to handle an upgrade event may return 400 for paths it doesn't own.
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
      const url = new URL(req.url ?? '', 'http://localhost');
      if (url.pathname !== '/extensions/native-message/ws') return; // not ours

      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, req);
      });
    });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url ?? '', 'http://localhost');
      const host = url.searchParams.get('host');
      const extensionId = url.searchParams.get('extensionId') ?? TANDEM_EXTENSION_ID;

      if (!host) {
        ws.close(1008, 'Missing ?host= parameter');
        return;
      }

      const hostInfo = findHostManifest(host);
      if (!hostInfo) {
        log.warn(`⚠️ NM proxy WS: host "${host}" not found`);
        ws.close(1011, `Native messaging host "${host}" not found`);
        return;
      }

      handlePersistentConnection(ws, hostInfo.binary, extensionId, host);
    });

    log.info('🔌 NM proxy: WebSocket server ready at ws://127.0.0.1:8765/extensions/native-message/ws');
  }

  /**
   * Patch the content_security_policy of an extracted extension manifest
   * to allow connections to the Tandem API (http/ws on port 8765).
   * Called before session.extensions.loadExtension() so the SW can reach our proxy.
   */
  patchManifestCSP(manifestPath: string): boolean {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw) as Record<string, unknown>;
      let changed = false;

      const addToCSP = (csp: string): string => {
        const additions = ['http://127.0.0.1:8765', 'ws://127.0.0.1:8765'];
        for (const url of additions) {
          if (csp.includes(url)) continue;
          // Inject into connect-src directive
          if (csp.includes('connect-src')) {
            csp = csp.replace(/connect-src([^;]*)/, (_m, p1: string) => `connect-src${p1} ${url}`);
          } else {
            // Append new directive
            csp = `${csp.trimEnd()}; connect-src ${url}`;
          }
          changed = true;
        }
        return csp;
      };

      const csp = manifest['content_security_policy'];
      if (typeof csp === 'object' && csp !== null) {
        // MV3: { extension_pages: "...", sandbox: "..." }
        const cspObj = csp as Record<string, string>;
        if (typeof cspObj['extension_pages'] === 'string') {
          cspObj['extension_pages'] = addToCSP(cspObj['extension_pages']);
        }
      } else if (typeof csp === 'string') {
        // MV2 string CSP
        manifest['content_security_policy'] = addToCSP(csp);
      }

      if (changed) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        log.info(`🔌 NM proxy: patched CSP in ${manifestPath}`);
      }
      return changed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`⚠️ NM proxy: failed to patch manifest CSP at ${manifestPath}: ${msg}`);
      return false;
    }
  }
}

export const nmProxy = new NativeMessagingProxy();
