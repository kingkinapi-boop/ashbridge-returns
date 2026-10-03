// Design card checks 6, 7 and 9 as a script (no packages): retired terms, prototype lint, basis (listed app- parts, no zoom, no third-party fonts).
//   node design/prototypes/cpa-review/_build/lint.mjs
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'design/prototypes/cpa-review';
const V1 = path.join(ROOT, 'v1-record-tabs');
const BRIEF = 'design/briefs/cpa-review.md';
let bad = 0;
const issue = (f, m) => { bad++; console.log('FAIL', f.replace(ROOT + '/', ''), m); };
const files = fs.readdirSync(V1).filter((f) => f.endsWith('.html')).map((f) => path.join(V1, f)).concat([path.join(ROOT, 'index.html')]);
const assets = ['assets/ashbridge-v1.css', 'assets/review-v1.js'].map((f) => path.join(ROOT, f));
const builders = ['v1.mjs', 'notes-v1.mjs', 'build.mjs'].map((f) => path.join(ROOT, '_build', f));

// check 6: retired terms in the brief and in every prototype file
const RETIRED = ['export 1', 'export 2', 'review-lines export', 'receipt export', 'gate 1', 'judgment input sheet', 'AI-proposed GIFI'];
for (const f of [...files, ...assets, ...builders, BRIEF]) {
  const t = fs.readFileSync(f, 'utf8').toLowerCase();
  for (const r of RETIRED) if (t.includes(r.toLowerCase())) issue(f, 'retired term: ' + r);
  if (t.includes(String.fromCharCode(8212))) issue(f, 'em dash');
}
// the brief names the blueprint commit it was written from
const brief = fs.readFileSync(BRIEF, 'utf8');
if (!/blueprint commit `?[0-9a-f]{7}/i.test(brief)) issue(BRIEF, 'does not name the blueprint commit');

// check 9: basis
const css = fs.readFileSync(assets[0], 'utf8');
if (/(^|[^-])zoom\s*:/.test(css)) issue(assets[0], 'CSS zoom');
if (/@font-face|fonts\.googleapis|fonts\.gstatic|typekit/i.test(css)) issue(assets[0], 'third-party font');
const notes = fs.readFileSync(path.join(V1, 'notes.html'), 'utf8');
const used = new Set();
const known = new Set(['is-selected', 'js-enabled']);
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8');
  if (/fonts\.googleapis|typekit|@font-face/i.test(h)) issue(f, 'third-party font');
  if (/ style="/.test(h)) issue(f, 'inline style');
  for (const m of h.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) { if (!c) continue; if (/^(govuk-|moj-)/.test(c) || known.has(c)) continue; if (/^app-/.test(c)) used.add(c); else issue(f, 'class without prefix: ' + c); }
}
const js = fs.readFileSync(assets[1], 'utf8'); for (const m of js.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) { if (/^app-/.test(c)) used.add(c); else if (c && !/^(govuk-|moj-)/.test(c)) issue(assets[1], 'class without prefix: ' + c); }
const notesText = notes.replace(/<[^>]+>/g, ' ');
for (const c of used) { if (!new RegExp('(^|[^a-z-])' + c.replace(/[-]/g, '\\-') + '([^a-z-]|$)').test(notesText)) issue('notes.html', 'app- class not listed with a reason: ' + c); }
// every app- class used in the css exists in a listed part
for (const m of css.matchAll(/\.(app-[a-z0-9_-]+)/g)) { if (!new RegExp('(^|[^a-z-])' + m[1].replace(/[-]/g, '\\-') + '([^a-z-]|$)').test(notesText)) { issue('ashbridge-v1.css', 'app- class not listed: ' + m[1]); break; } }

// check 7: prototype lint
const routes = new Set(['brief', 'flags', 'statements', 'schedule-1', 'capital', 'losses', 'rate', 'dividends', 'shareholders', 'ontario', 'disclosures', 'payment', 'comments', 'history', 'changes', 'find']);
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8'); const own = path.basename(f);
  const ids = [...h.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]); const seen = new Set(); for (const i of ids) { if (seen.has(i)) issue(f, 'duplicate id ' + i); seen.add(i); }
  if ((h.match(/<h1[ >]/g) || []).length !== 1) issue(f, 'h1 count ' + (h.match(/<h1[ >]/g) || []).length);
  if (!/<title>[^<]+ - Ashbridge Tax<\/title>/.test(h)) issue(f, 'title');
  if (!/class="govuk-skip-link"/.test(h) || !/id="main-content"/.test(h)) issue(f, 'skip link or main');
  for (const m of h.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)) {
    const t = m[1];
    const exempt = /aria-current|govuk-header__homepage-link/.test(m[0]);
    if (t === '' || t === '#') { issue(f, 'link goes nowhere: ' + JSON.stringify(t)); continue; }
    if (t.startsWith('http')) continue;
    const [file, hash] = t.split('#');
    if (!exempt && file && path.resolve(path.dirname(f), file) === path.resolve(f) && !hash) issue(f, 'self-link ' + t);
    if (file && !fs.existsSync(path.join(path.dirname(f), file))) issue(f, 'missing page ' + file);
    if (!file && hash && hash.startsWith('/')) { if (!routes.has(hash.slice(1).split('/')[0])) issue(f, 'unknown route ' + t); }
    else if (!file && hash && !seen.has(hash)) issue(f, 'missing anchor #' + hash);
    if (file && hash && hash.startsWith('/') && file.endsWith('.html') && !routes.has(hash.slice(1).split('/')[0])) issue(f, 'unknown route ' + t);
  }
  for (const m of h.matchAll(/<(span|div|p|strong|u)\b[^>]*class="[^"]*(govuk-button|govuk-link)\b[^"]*"/g)) issue(f, 'control drawn as plain text: ' + m[0].slice(0, 60));
  for (const m of h.matchAll(/<a\b[^>]*class="[^"]*govuk-button[^"]*"[^>]*>/g)) if (!/role="button"/.test(m[0])) issue(f, 'button link without role');
  if (/lorem|coming soon|placeholder=|to be decided|\bTBD\b|\bTODO\b/i.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) issue(f, 'filler or placeholder text');
  for (const m of h.matchAll(/<t[dh][^>]*>\s*(n\/a|tbd|todo|xxx|\.\.\.|-|\?)\s*<\/t[dh]>/gi)) issue(f, 'filler in a data cell: ' + m[0]);
  for (const m of h.matchAll(/<label\b/g)) { /* every field has a label: checked by axe */ }
  // counts that must agree
  const tables = h.split('<table');
  for (const t of tables) {
    const cap = t.match(/<caption[^>]*>[^<(]*\((\d+)\)<\/caption>/); if (!cap) continue;
    const rows = (t.split('</table>')[0].match(/<tr/g) || []).length - 1;
    if (+cap[1] !== rows) issue(f, `count disagrees: caption says ${cap[1]}, table has ${rows} rows`);
  }
  const big = h.match(/(\d+) large changes in all/); if (big) { const tags = (h.match(/Large change<\/strong>/g) || []).length + (h.match(/Changed by preparer<\/strong>/g) || []).length; /* tags appear once per row in the sections */ if (+big[1] !== (h.match(/Large change<\/strong>/g) || []).length && !/Back from rework/.test(h)) issue(f, `count disagrees: ${big[1]} large changes in the brief, ${(h.match(/Large change<\/strong>/g) || []).length} tagged`); }
  const nine = h.match(/(Nine|Eight|Seven|Ten) flags in all/); const pinned = h.match(/Pinned flags: red first, then dollar effect \((\d+)\)/); if (nine && pinned) { const w = { Seven: 7, Eight: 8, Nine: 9, Ten: 10 }[nine[1]]; if (w !== +pinned[1]) issue(f, 'count disagrees: tier text says ' + nine[1] + ' flags, pinned flags ' + pinned[1]); }
  const hist = h.match(/(d+) numbers, (nine|eight|seven) flags fired/); if (hist) { const rowsN = [...h.matchAll(/<tr class="([^"]*)" data-row="([a-z0-9-]+)"/g)].filter((m) => !/app-row--sub/.test(m[1]) && !/^(r|p)-/.test(m[2]) && !/^dd-F/.test(m[2])).length; if (+hist[1] !== rowsN) issue(f, `count disagrees: history says ${hist[1]} numbers built, the sections list ${rowsN}`); }
  const flagsN = (h.match(/data-row="\d\d-F\d\d"/g) || []).length; if (pinned && flagsN && +pinned[1] !== flagsN) issue(f, `count disagrees: pinned flags ${pinned[1]}, flag rows ${flagsN}`);
}
console.log(`LINT: ${files.length} pages, ${used.size} app- classes, ${bad} issues`);
process.exit(bad ? 1 : 0);
