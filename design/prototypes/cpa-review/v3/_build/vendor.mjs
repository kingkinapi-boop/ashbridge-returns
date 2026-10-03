// One-off, repeatable: copies the local GOV.UK Frontend 6.5.1 and MOJ Frontend 11 files (kept from version 1) into v3/static/vendor/
// so version 3 stands alone and works offline. Changes made to the copies, and only these:
//   1. the asset URLs: "assets/images/" becomes "images/" (git ignores a folder named assets on Windows);
//   2. the two GDS Transport @font-face blocks are removed (the basis sets no third-party font, RV-55);
//   3. the GOV.UK crest image URL becomes "none" (no crown on any Ashbridge page, RV-55; the rules that used it are not used here);
//   4. the compiled font stack "GDS Transport,arial,sans-serif" becomes "Roboto,arial,sans-serif" (the basis font; the sheet is compiled
//      without our settings, so the one stack it hard-codes is swapped here and nothing else about the rules changes).
// Run: node design/prototypes/cpa-review/v3/_build/vendor.mjs
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const V3 = path.resolve(HERE, '..');
const SRC = path.resolve(V3, '..', 'assets', 'vendor');
const OUT = path.join(V3, 'static', 'vendor');
fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });

const fix = (css) => css
  .replace(/@font-face\{[^}]*\}/g, '')
  .replace(/url\(assets\/images\/govuk-crest\.svg\)/g, 'none')
  .replace(/url\(assets\/images\//g, 'url(images/')
  .replace(/GDS Transport,arial,sans-serif/g, 'Roboto,arial,sans-serif');
const used = new Set();
for (const f of ['govuk-frontend.min.css', 'moj-frontend.min.css']) {
  const css = fix(fs.readFileSync(path.join(SRC, f), 'utf8'));
  for (const m of css.matchAll(/url\(images\/([^)]+)\)/g)) used.add(m[1]);
  fs.writeFileSync(path.join(OUT, f), css);
}
for (const f of ['govuk-frontend.bundle.js', 'moj-frontend.bundle.js']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
for (const f of used) fs.copyFileSync(path.join(SRC, 'assets', 'images', f), path.join(OUT, 'images', f));
console.log('vendor files written; images used:', [...used].join(', '));
