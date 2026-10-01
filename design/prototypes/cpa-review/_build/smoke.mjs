// Quick look: node tools/heavy.mjs -- node design/prototypes/cpa-review/_build/smoke.mjs <page>#<route> [w h]
// Needs playwright-core installed outside the repo: set AUDIT_MODULES to a folder holding node_modules (nothing is installed globally).
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
const req = createRequire(path.join(process.env.AUDIT_MODULES, 'package.json'));
const { chromium } = req('playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const [target, w = 1366, h = 650] = process.argv.slice(2);
const [pg, hash] = target.split('#');
const file = path.resolve('design/prototypes/cpa-review/v1-record-tabs', pg);
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('file:///' + file.replace(/\\/g, '/') + (hash ? '#' + hash : ''));
await page.waitForTimeout(1500);
const out = path.join(os.tmpdir(), 'shots'); fs.mkdirSync(out, { recursive: true });
const png = path.join(out, `${pg.replace('.html', '')}-${(hash || '').replace(/[\/]/g, '_')}-${w}x${h}.png`);
await page.screenshot({ path: png });
console.log(png);
await browser.close();
