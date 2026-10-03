// Run: node design/prototypes/cpa-review/_build/check.mjs
// Lints the built pages: links and form actions resolve, one h1, no inline style, only govuk-/moj-/app- classes, no em dash, no duplicate ids.
import fs from 'fs'; import path from 'path';
const root = 'design/prototypes/cpa-review';
const files = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.name === '_build') continue; const p = path.join(d, f.name); f.isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } })(root);
let bad = 0; const issue = (f, m) => { bad++; if (bad < 60) console.log(f.replace(root + '/', ''), m); };
const classBad = new Set();
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8');
  if (h.includes(String.fromCharCode(8212))) issue(f, 'em dash');
  if (/style="/.test(h)) issue(f, 'inline style');
  const h1 = (h.match(/<h1[ >]/g) || []).length; if (h1 !== 1) issue(f, 'h1 count ' + h1);
  for (const m of h.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c && !/^(govuk-|moj-|app-|is-selected|js-enabled)/.test(c)) classBad.add(c);
  const ids = [...h.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]); const seen = new Set(); for (const i of ids) { if (seen.has(i)) issue(f, 'dup id ' + i); seen.add(i); }
  for (const m of h.matchAll(/href="([^"#]*)(#[^"]*)?"/g)) {
    const t = m[1]; if (!t || t.startsWith('http')) continue;
    if (!fs.existsSync(path.join(path.dirname(f), t))) issue(f, 'missing link ' + t);
  }
  for (const m of h.matchAll(/action="([^"]+)"/g)) if (!fs.existsSync(path.join(path.dirname(f), m[1]))) issue(f, 'missing action ' + m[1]);
  if (/href="#"/.test(h)) issue(f, 'href=#');
  if (/RETRY|undefined|NaN|\[object/.test(h)) issue(f, 'bad token');
}
console.log('files', files.length, 'issues', bad, 'non-prefixed classes', [...classBad]);
