// Checks: every local link exists; only govuk-, moj-, app- classes; one h1; no em dash; no inline style; ids unique.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
let bad = 0; const apps = new Set();
for (const v of ['a-tabs', 'b-split', 'c-pipeline']) {
  const dir = path.join(ROOT, v);
  for (const f of fs.readdirSync(dir)) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    const err = (m) => { bad++; if (bad < 40) console.log(v + '/' + f + ': ' + m); };
    for (const m of h.matchAll(/href="([^"#?]+)(?:[#?][^"]*)?"/g)) {
      const t = m[1]; if (/^https?:/.test(t)) continue;
      if (!fs.existsSync(path.resolve(dir, t))) err('dead link ' + t);
    }
    const h1 = (h.match(/<h1[ >]/g) || []).length; if (h1 !== 1) err('h1 count ' + h1);
    if (/style="/.test(h)) err('inline style');
    if (/[—–]/.test(h)) err('dash');
    for (const m of h.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) { if (!c) continue; if (!/^(govuk-|moj-|app-)/.test(c) && !['js-enabled'].includes(c)) { if (!/^(govuk-template__body)/.test(c)) err('class ' + c); } if (c.startsWith('app-')) apps.add(c); }
    const ids = [...h.matchAll(/ id="([^"]+)"/g)].map((x) => x[1]); const dup = ids.find((x, i) => ids.indexOf(x) !== i); if (dup) err('dup id ' + dup);
  }
}
console.log('problems:', bad); console.log([...apps].sort().join(' '));
