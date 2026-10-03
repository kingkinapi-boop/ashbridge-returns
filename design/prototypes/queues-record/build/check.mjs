// Lint for version A: design card checks 6, 7 and 9 (and the older page checks).
// Run: node build/check.mjs
//  6  retired terms (export 1, export 2, review-lines export, receipt export, gate 1, judgment input sheet, AI-proposed GIFI)
//  7  no self-link, no # link that changes nothing, no control drawn as plain text, no filler text in a data column,
//     no two counts that disagree (view badges, chips and the state strip against the rows)
//  9  only govuk-, moj- and app- classes, every app- class listed in basis.md, no zoom, no third-party font, no inline style
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'a-tabs');
const TABS = ['overview', 'workbench', 'review', 'documents', 'exceptions', 'history', 'ops'];
let bad = 0; const apps = new Set();
const basis = fs.readFileSync(path.join(ROOT, 'basis.md'), 'utf8');
const listed = new Set([...basis.matchAll(/app-[a-z0-9_-]+/g)].map((m) => m[0]));
const RETIRED = /export 1\b|export 2\b|review-lines export|receipt export|gate 1\b|judgment input sheet|judgment inputs|AI-proposed GIFI/i;
const FILLER = /^(next ops step|tbd|n\/a|lorem.*|coming soon|xxx+|placeholder)$/i;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
const html = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
const seen = new Set(); const err = (f, m) => { const key = m.startsWith('app- class') ? m : f + m; if (seen.has(key)) return; seen.add(key); bad++; if (bad < 60) console.log(f + ': ' + m); };

const rowsOf = (h) => [...h.matchAll(/<tr class="govuk-table__row" data-slug="([^"]*)"([^>]*)>/g)].map((m) => m[0]);
const attr = (row, k) => (new RegExp(` data-${k}="([^"]*)"`).exec(row) || [])[1];

for (const f of files) {
  const h = html[f];
  const e = (m) => err(f, m);
  // links
  for (const m of h.matchAll(/<a\b([^>]*)>/g)) {
    const a = m[1]; const hm = /href="([^"]*)"/.exec(a);
    if (!hm) { e('link without href'); continue; }
    const href = hm[1];
    if (href === '#' || href === '') { e('empty # link'); continue; }
    if (/^https?:/.test(href)) continue;
    const [p, frag] = href.split('#'); const pf = p.split('?')[0];
    if (pf === '' && frag !== undefined) { if (!TABS.includes(frag.split('/')[0]) && !new RegExp(` id="${frag}"`).test(h)) e('# link to nothing: #' + frag); continue; }
    if (!fs.existsSync(path.resolve(dir, pf))) { e('dead link ' + href); continue; }
    if (pf === f && !(frag && TABS.includes(frag.split('/')[0]))) e('self-link ' + href);
    if (pf.startsWith('rec-') && frag && !TABS.includes(frag.split('/')[0])) e('bad route ' + href);
    if (/class="[^"]*govuk-button/.test(a)) e('link drawn as a button: ' + href);
    if (/role="button"/.test(a)) e('role=button on a link');
  }
  for (const m of h.matchAll(/<(span|div|p|li)\b[^>]*(onclick|role="button")[^>]*>/g)) e('control drawn as text: ' + m[0].slice(0, 50));
  // structure
  const h1 = (h.match(/<h1[ >]/g) || []).length; if (h1 !== 1) e('h1 count ' + h1);
  if (/ style="/.test(h)) e('inline style');
  if (/[—–]/.test(h)) e('dash');
  if (RETIRED.test(h)) e('retired term: ' + RETIRED.exec(h)[0]);
  if (/lorem|coming soon|placeholder=/i.test(h)) e('placeholder text');
  for (const m of h.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) {
    if (!c) continue;
    if (!/^(govuk-|moj-|app-|js-enabled)/.test(c)) e('class ' + c);
    if (c.startsWith('app-')) { apps.add(c); if (!listed.has(c)) e('app- class not in basis.md: ' + c); }
  }
  const ids = [...h.matchAll(/ id="([^"]+)"/g)].map((x) => x[1]); const dup = ids.find((x, i) => ids.indexOf(x) !== i); if (dup) e('dup id ' + dup);
  // filler in data columns
  for (const m of h.matchAll(/<td class="govuk-table__cell[^"]*"[^>]*>([^<]*)<\/td>/g)) if (FILLER.test(m[1].trim())) e('filler in a data cell: ' + m[1]);
}

// counts that must agree
const badgeOf = (f) => { const out = {}; for (const m of html[f].matchAll(/<a class="moj-sub-navigation__link" href="([^"]+)">[^<]*<span class="moj-badge moj-badge--grey"><span class="govuk-visually-hidden">\(<\/span>(\d+)/g)) out[m[1]] = +m[2]; for (const m of html[f].matchAll(/<span class="moj-sub-navigation__link" aria-current="page">[^<]*<span class="moj-badge moj-badge--grey"><span class="govuk-visually-hidden">\(<\/span>(\d+)/g)) out[f] = +m[1]; return out; };
for (const f of files.filter((x) => x.startsWith('queue-'))) {
  const b = badgeOf(f); delete b[f];
  for (const [t, n] of Object.entries(b)) if (html[t]) { const rows = rowsOf(html[t]).length; if (rows !== n) err(f, `view badge ${t} says ${n}, page has ${rows} rows`); }
  const rows = rowsOf(html[f]);
  for (const m of html[f].matchAll(/data-filter-key="([^"]+)" data-filter-value="([^"]+)">[^<]*<span class="moj-badge moj-badge--grey">(\d+)<\/span>/g)) {
    const [, k, v, n] = m;
    const c = rows.filter((r) => k === 'due' ? +attr(r, 'due') <= +v : attr(r, k) === v).length;
    if (c !== +n) err(f, `chip ${k}=${v} says ${n}, rows say ${c}`);
  }
  const t = /<caption[^>]*>[^<]*?, (\d+) returns/.exec(html[f]); if (t && +t[1] !== rows.length) err(f, `caption says ${t[1]}, rows ${rows.length}`);
  const intro = /All (\d+) returns in the firm/.exec(html[f]); if (intro && +intro[1] !== rows.length) err(f, `intro says ${intro[1]}, rows ${rows.length}`);
}
{
  const f = 'board.html'; const rows = rowsOf(html[f]);
  for (const m of html[f].matchAll(/data-filter-key="state" data-filter-value="([^"]+)" data-scroll-list><span class="app-pipe__count">(\d+)/g)) { const c = rows.filter((r) => attr(r, 'state') === m[1]).length; if (c !== +m[2]) err(f, `strip ${m[1]} says ${m[2]}, rows ${c}`); }
  for (const m of html[f].matchAll(/data-filter-key="(tier|wait|due|band)" data-filter-value="([^"]+)">[^<]*<span class="moj-badge moj-badge--grey">(\d+)<\/span>/g)) { const [, k, v, n] = m; const c = rows.filter((r) => k === 'due' ? +attr(r, 'due') <= +v : attr(r, k) === v).length; if (c !== +n) err(f, `chip ${k}=${v} says ${n}, rows ${c}`); }
}
// check 9: stylesheet
const css = fs.readFileSync(path.join(ROOT, '_shared', 'a.css'), 'utf8');
if (/\bzoom\s*:/.test(css)) err('a.css', 'zoom');
if (/@import|fonts\.googleapis|fonts\.gstatic/.test(css)) err('a.css', 'third-party font');
for (const m of css.matchAll(/\.(app-[a-z0-9_-]+)/g)) if (!listed.has(m[1])) err('a.css', 'class not in basis.md: ' + m[1]);
console.log(`checked ${files.length} pages, problems: ${bad}`);
console.log('app- classes used: ' + [...apps].sort().join(' '));
process.exit(bad ? 1 : 0);
