import { contextBridge } from 'electron';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json (preload runs in Node context)
const pkgPath = join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

contextBridge.exposeInMainWorld('tandem', {
  version: pkg.version,
});
