// Run: node design/prototypes/cpa-review/_build/build.mjs
// Second round: rebuilds ONLY version 1 (v1-record-tabs) and the index. Versions 2 and 3 stay in their folders as first drafted
// (their generators, split.mjs and tabs.mjs, are frozen: they predate the new model and are not run any more).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SCENARIOS } from './model.mjs';
import { recordPage, sourceWindow, queuePage, approvedPage } from './v1.mjs';
import { notesPage, indexPage } from './notes-v1.mjs';

const OUT = path.join(ROOT, 'design', 'prototypes', 'cpa-review');
const dir = path.join(OUT, 'v1-record-tabs');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
let count = 0;
const emit = (name, html) => { fs.writeFileSync(path.join(dir, name), html); count++; };
for (const scn of Object.values(SCENARIOS)) emit(`${scn.slug}.html`, recordPage(scn));
emit('source-red.html', sourceWindow('red'));
emit('source-green.html', sourceWindow('green'));
emit('queue.html', queuePage('first'));
emit('queue-later.html', queuePage('later'));
emit('queue-empty.html', queuePage('empty'));
emit('approved-red.html', approvedPage('red'));
emit('approved-green.html', approvedPage('green'));
emit('notes.html', notesPage());
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());
console.log('pages written:', count + 1);
