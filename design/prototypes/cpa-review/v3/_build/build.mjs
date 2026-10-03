// Run: node design/prototypes/cpa-review/v3/_build/build.mjs
// Writes every page of version 3 into design/prototypes/cpa-review/v3/ (the static/ folder is never removed: it holds the vendor copy, the sheet and the page script).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SCENARIOS } from './model.mjs';
import { recordPage, sourceWindow } from './record.mjs';
import { queuePage, approvedPage, signedOutPage } from './queue.mjs';
import { notesPage, indexPage } from './notes.mjs';

const dir = path.join(ROOT, 'design', 'prototypes', 'cpa-review', 'v3');
for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) fs.rmSync(path.join(dir, f));
let count = 0;
const emit = (name, html) => { fs.writeFileSync(path.join(dir, name), html); count++; };
for (const scn of Object.values(SCENARIOS)) emit(`${scn.slug}.html`, recordPage(scn));
for (const w of ['red', 'green', 'blue', 'scar']) emit(`source-${w}.html`, sourceWindow(w));
emit('queue.html', queuePage('first'));
emit('queue-later.html', queuePage('later'));
emit('queue-empty.html', queuePage('empty'));
emit('queue-error.html', queuePage('error'));
for (const w of ['red', 'green', 'blue', 'scar']) emit(`approved-${w}.html`, approvedPage(w));
emit('signed-out.html', signedOutPage());
emit('notes.html', notesPage());
emit('index.html', indexPage());
console.log('pages written:', count);
