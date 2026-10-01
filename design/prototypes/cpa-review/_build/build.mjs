// Run: node design/prototypes/cpa-review/_build/build.mjs
// Writes the static pages for the three versions. No packages. Reads reference/sample-clients (made-up data).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './model.mjs';
import { shell, queuePage, setMode } from './ui.mjs';
import * as tabs from './tabs.mjs';
import * as split from './split.mjs';
import { notesPage, layoutPage, indexPage } from './notes.mjs';

const OUT = path.join(ROOT, 'design', 'prototypes', 'cpa-review');
const VERSIONS = [
  { dir: 'v1-record-tabs', id: 'v1', build: (e) => tabs.build('v1', e) },
  { dir: 'v2-list-and-detail', id: 'v2', build: (e) => split.build(e) },
  { dir: 'v3-two-monitors', id: 'v3', build: (e) => tabs.build('v3', e) },
];

let count = 0;
for (const v of VERSIONS) {
  const dir = path.join(OUT, v.dir);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const emit = (name, html) => { fs.writeFileSync(path.join(dir, name), html); count++; };
  const q = queuePage(v.id, false).main;
  emit('queue.html', shell({ title: 'Review queue', main: q, nav: 'queue' }));
  emit('queue-empty.html', shell({ title: 'Review queue, empty', main: queuePage(v.id, true).main, nav: 'queue' }));
  setMode(v.id);
  v.build(emit);
  emit('notes.html', notesPage(v.id));
  if (v.id === 'v3') emit('layout.html', layoutPage());
}
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage(VERSIONS));
console.log('pages written:', count + 1);
