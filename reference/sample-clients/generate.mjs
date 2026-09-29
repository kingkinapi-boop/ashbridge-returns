#!/usr/bin/env node
// Builds the ten made-up sample clients (01-maple-ridge to 10-danforth-cleaning) next to this file.
// Fixed seeds, no packages, Node 20 or later.  Usage: node generate.mjs [client numbers, e.g. 01 05]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { finalize, writeClient } from './lib/emit.mjs';
import { money } from './lib/util.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).filter((a) => /^\d\d$/.test(a));
const cdir = path.join(root, 'clients');
const builders = [];
for (const f of fs.readdirSync(cdir).filter((f) => /^c\d\d.*\.mjs$/.test(f)).sort()) {
  const m = await import(pathToFileURL(path.join(cdir, f)).href);
  for (const [k, fn] of Object.entries(m)) if (/^build\d\d$/.test(k)) builders.push([k.slice(5), fn]);
}
builders.sort((a, b) => a[0].localeCompare(b[0]));

let files = 0;
for (const [num, build] of builders) {
  if (only.length && !only.includes(num)) continue;
  const c = build();
  const fin = finalize(c);
  writeClient(c, fin, root);
  const rows = Object.values(c.accts).map((a) => `${a.tag} ${a.export.length}${a.missing.length ? '+' + a.missing.length : ''}`).join(', ');
  const perMonth = Object.values(c.accts).map((a) => `${a.tag} ${Math.round(a.export.length / c.months.length)}`).join(', ');
  console.log(`${c.dir}: rows ${rows} | per month ${perMonth} | entries ${c.ajes.length} | flags ${c.flagList.length} | net income before tax ${money(fin.netIncome)}${fin.netIncome < 0 ? ' (loss)' : ''}`);
  files += Object.keys(c.accts).length * 2 + 3;
}
console.log(`wrote ${files} files for ${builders.filter(([n]) => !only.length || only.includes(n)).length} clients`);
