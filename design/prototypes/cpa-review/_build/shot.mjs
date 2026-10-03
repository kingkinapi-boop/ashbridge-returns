// Run: node design/prototypes/cpa-review/_build/shot.mjs <page path under cpa-review>[#hash] [width height] [--dom]
// Takes a screenshot (or with --dom prints the DOM after the scripts ran) with headless Edge, for looking at a page while designing.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
const args = process.argv.slice(2);
const dom = args.includes('--dom');
const [pageArg, w = 1440, h = 900] = args.filter((a) => a !== '--dom');
const [page, hash] = pageArg.split('#');
const file = path.resolve('design/prototypes/cpa-review', page);
const out = path.join(os.tmpdir(), 'shots'); fs.mkdirSync(out, { recursive: true });
const png = path.join(out, page.replace(/[\\/]/g, '_').replace(/\.html$/, '') + '.png');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = 'file:///' + file.replace(/\\/g, '/') + (hash ? '#' + hash : '');
if (dom) {
  const r = spawnSync(edge, ['--headless=new', '--disable-gpu', '--virtual-time-budget=6000', '--dump-dom', url], { encoding: 'utf8', maxBuffer: 1 << 28 });
  fs.writeFileSync(path.join(out, 'dom.html'), r.stdout);
  console.log(path.join(out, 'dom.html'));
} else {
  spawnSync(edge, ['--headless=new', '--disable-gpu', `--window-size=${w},${h}`, '--virtual-time-budget=8000', `--screenshot=${png}`, url], { stdio: 'ignore' });
  console.log(png);
}
