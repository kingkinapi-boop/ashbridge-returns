// Design card checks 6, 7 and 9 as a script (no packages): retired terms, prototype lint, basis (listed app- parts, no zoom, no third-party fonts).
// Run from the repository root:  node design/prototypes/cpa-review/v3/_build/lint.mjs
import fs from 'node:fs';
import path from 'node:path';
const V3 = 'design/prototypes/cpa-review/v3';
const BRIEF = 'design/briefs/cpa-review.md';
let bad = 0;
const issue = (f, m) => { bad++; console.log('FAIL', f.replace(V3 + '/', ''), m); };
const pages = fs.readdirSync(V3).filter((f) => f.endsWith('.html')).map((f) => path.join(V3, f));
const css = path.join(V3, 'static/ashbridge-v3.css');
const js = path.join(V3, 'static/review-v3.js');
const builders = fs.readdirSync(path.join(V3, '_build')).filter((f) => f.endsWith('.mjs')).map((f) => path.join(V3, '_build', f));
const dashChar = String.fromCharCode(8212);

// check 6: retired terms in the brief and in every prototype file (vendor copies of GOV.UK and MOJ are not ours)
const RETIRED = ['export 1', 'export 2', 'review-lines export', 'receipt export', 'gate 1', 'judgment input sheet', 'AI-proposed GIFI'];
for (const f of [...pages, css, js, ...builders, BRIEF]) {
  if (/_build[\\/](lint|verify)\.mjs$/.test(f)) continue; // the two check scripts hold the list of retired words themselves
  const t = fs.readFileSync(f, 'utf8').toLowerCase();
  for (const r of RETIRED) if (t.includes(r.toLowerCase())) issue(f, 'retired term: ' + r);
  if (t.includes(dashChar)) issue(f, 'em dash');
}
// the brief names the blueprint commit it was written from, and is at most 80 lines
const brief = fs.readFileSync(BRIEF, 'utf8');
if (!/blueprint commit `?[0-9a-f]{7}/i.test(brief)) issue(BRIEF, 'does not name the blueprint commit');
if (brief.split('\n').length > 80) issue(BRIEF, 'longer than 80 lines: ' + brief.split('\n').length);

// check 9: basis
const cssText = fs.readFileSync(css, 'utf8');
if (/(^|[^-])zoom\s*:/.test(cssText)) issue(css, 'CSS zoom');
if (/@font-face|fonts\.googleapis|fonts\.gstatic|typekit/i.test(cssText)) issue(css, 'third-party font');
const notesHtml = fs.readFileSync(path.join(V3, 'notes.html'), 'utf8');
const notesText = notesHtml.replace(/<[^>]+>/g, ' ');
const listed = (c) => new RegExp('(^|[^a-z0-9_-])' + c.replace(/[-]/g, '\\-') + '([^a-z0-9_-]|$)').test(notesText);
const used = new Set();
const known = new Set(['is-selected', 'js-enabled', 'govuk-frontend-supported']);
const IDS = new Set(['app-live', 'app-data']); // ids, not classes
for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8');
  if (/fonts\.googleapis|typekit|@font-face/i.test(h)) issue(f, 'third-party font');
  if (/ style="/.test(h)) issue(f, 'inline style');
  if (/\bsrc="https?:|href="https?:/.test(h)) issue(f, 'external resource');
  if (/\b\d{3}[- ]\d{3}[- ]\d{3}\b/.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) issue(f, 'a nine-digit pattern that could be a SIN');
  for (const m of h.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) { if (!c) continue; if (/^(govuk-|moj-)/.test(c) || known.has(c)) continue; if (/^app-/.test(c)) used.add(c); else issue(f, 'class without prefix: ' + c); }
}
const jsText = fs.readFileSync(js, 'utf8');
for (const m of jsText.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) { if (!c || /['+()?:]/.test(c)) continue; if (/^app-/.test(c)) used.add(c); else if (!/^(govuk-|moj-)/.test(c) && !known.has(c)) issue(js, 'class without prefix: ' + c); }
for (const m of jsText.matchAll(/'(app-[a-z0-9_-]+)/g)) used.add(m[1]);
for (const m of jsText.matchAll(/className\s*=\s*'([^']*)'/g)) for (const c of m[1].split(/\s+/)) { if (/^app-/.test(c)) used.add(c); else if (c && !/^(govuk-|moj-)/.test(c) && !known.has(c)) issue(js, 'class without prefix: ' + c); }
for (const id of IDS) used.delete(id);
for (const c of used) if (!listed(c)) issue('notes.html', 'app- class not listed with a reason: ' + c);
// every app- class in the stylesheet is listed
const cssClasses = new Set([...cssText.matchAll(/\.(app-[a-z0-9_-]+)/g)].map((m) => m[1]));
for (const c of cssClasses) if (!listed(c)) issue('ashbridge-v3.css', 'app- class not listed: ' + c);
// every app- class that is used has a rule (so nothing is left unstyled by accident)
const NO_RULE_OK = new Set(['app-data', 'app-live']);
for (const c of used) if (!cssClasses.has(c) && !NO_RULE_OK.has(c)) console.log('note: app- class used with no rule of its own (inherits from its parent or is a hook):', c);

// check 7: prototype lint
const routes = new Set(['brief', 'flags', 'statements', 'schedule-1', 'capital', 'losses', 'rate', 'dividends', 'shareholders', 'ontario', 'disclosures', 'payment', 'forms-not-placed', 'comments', 'history', 'changes', 'find', 'approve', 'all', 'rework']);
const tail = new Set(['attest', 'send', 'error', 'loading', 'failed', 'comment-error']);
let links = 0;
for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8'); const own = path.basename(f);
  const ids = [...h.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]); const seen = new Set(); for (const i of ids) { if (seen.has(i)) issue(f, 'duplicate id ' + i); seen.add(i); }
  if ((h.match(/<h1[ >]/g) || []).length !== 1) issue(f, 'h1 count ' + (h.match(/<h1[ >]/g) || []).length);
  if (!/<title>[^<]+ - Ashbridge Tax<\/title>/.test(h)) issue(f, 'title');
  if (!/class="govuk-skip-link"/.test(h) || !/id="main-content"/.test(h)) issue(f, 'skip link or main');
  if (!/<html lang="en"/.test(h)) issue(f, 'html lang');
  if ((h.match(/<main\b/g) || []).length !== 1) issue(f, 'main count');
  const errPage = /govuk-error-summary/.test(h.replace(/<script[\s\S]*?<\/script>/g, '')) && !/hidden/.test((h.match(/<div class="govuk-error-summary"[^>]*>/) || [''])[0]);
  const titleErr = /<title>Error: /.test(h);
  if (errPage && !titleErr) issue(f, 'error summary shown but the title does not start "Error: "');
  if (!errPage && titleErr) issue(f, 'title starts "Error: " but no error summary shows');
  for (const m of h.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)) {
    const t = m[1]; links++;
    const exempt = /aria-current|govuk-header__homepage-link/.test(m[0]);
    if (t === '' || t === '#') { issue(f, 'link goes nowhere: ' + JSON.stringify(t)); continue; }
    if (t.startsWith('http')) continue;
    const [file, hash] = t.split('#');
    if (!exempt && file && path.resolve(path.dirname(f), file) === path.resolve(f) && !hash) issue(f, 'self-link ' + t);
    if (file && !fs.existsSync(path.join(path.dirname(f), file))) issue(f, 'missing page ' + file);
    if (file && hash && fs.existsSync(path.join(path.dirname(f), file)) && !hash.startsWith('/')) { const other = fs.readFileSync(path.join(path.dirname(f), file), 'utf8'); if (!other.includes(` id="${hash}"`)) issue(f, 'missing anchor ' + t); }
    const checkRoute = (hs) => { const parts = hs.replace(/^#\/?/, '').split('/'); if (!routes.has(parts[0])) issue(f, 'unknown route ' + t); else if (parts[2] && !tail.has(parts[2])) issue(f, 'unknown state in route ' + t); else if (parts[1] && !routes.has(parts[0])) issue(f, 'bad route ' + t); };
    if (!file && hash && hash.startsWith('/')) checkRoute('#' + hash.slice(0));
    else if (!file && hash && !seen.has(hash)) issue(f, 'missing anchor #' + hash);
    if (file && hash && hash.startsWith('/') && file.endsWith('.html')) checkRoute('#' + hash);
  }
  for (const m of h.matchAll(/<(span|div|p|strong|u)\b[^>]*class="[^"]*(govuk-button|govuk-link)\b[^"]*"/g)) issue(f, 'control drawn as plain text: ' + m[0].slice(0, 60));
  for (const m of h.matchAll(/<a\b[^>]*class="[^"]*govuk-button[^"]*"[^>]*>/g)) if (!/role="button"/.test(m[0])) issue(f, 'button link without role');
  if (/lorem|coming soon|placeholder=|to be decided|\bTBD\b|\bTODO\b/i.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) issue(f, 'filler or placeholder text');
  for (const m of h.matchAll(/<t[dh][^>]*>\s*(n\/a|tbd|todo|xxx|\.\.\.|-|\?)\s*<\/t[dh]>/gi)) issue(f, 'filler in a data cell: ' + m[0]);
  // every key carries aria-keyshortcuts and is listed in the page's own key list (rule 10)
  const listedKeys = new Set([...h.matchAll(/<kbd>([^<]+)<\/kbd>/g)].map((m) => m[1]));
  for (const m of h.matchAll(/aria-keyshortcuts="([^"]+)"/g)) if (!listedKeys.has(m[1])) issue(f, 'aria-keyshortcuts ' + m[1] + ' is not in the page key list');
  // counts that must agree: a table caption that ends in (N) has N body rows
  for (const t of h.split('<table').slice(1)) {
    const body = t.split('</table>')[0];
    const cap = body.match(/<caption[^>]*>[^<(]*\((\d+)\)<\/caption>/); if (!cap) continue;
    const rows = (body.match(/<tr/g) || []).length - 1;
    if (+cap[1] !== rows) issue(f, `count disagrees: caption says ${cap[1]}, table has ${rows} rows`);
  }
  const pinned = h.match(/Pinned flags: red first, then dollar effect \((\d+)\)/);
  const flagsN = (h.match(/data-row="\d\d-F\d\d"/g) || []).length; if (pinned && flagsN && +pinned[1] !== flagsN) issue(f, `count disagrees: pinned flags ${pinned[1]}, flag rows ${flagsN}`);
  const tiles = (h.match(/class="app-tile"/g) || []).length; if (/data-record/.test(h) && tiles !== 6) issue(f, 'the brief shows ' + tiles + ' tiles, not six');
  const reviewedTag = h.match(/data-count-reviewed><\/span> of (\d+) sections Reviewed/); const railN = (h.match(/data-rail="[a-z0-9-]+"/g) || []).length;
  if (reviewedTag && /data-record/.test(h)) { const secs = +reviewedTag[1]; const expectRail = secs + 1 + (/data-rail="approve"/.test(h) ? 1 : 0); if (railN !== expectRail) issue(f, `count disagrees: ${secs} sections, ${railN} rail entries (expected ${expectRail})`); }
  const cmt = h.match(/data-comment-count>(\d+)</); if (cmt && /id="app-data"/.test(h)) { const data = JSON.parse(h.match(/<script type="application\/json" id="app-data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')); if (data.comments.length !== +cmt[1]) issue(f, `count disagrees: comments badge ${cmt[1]}, data ${data.comments.length}`); }
  // the JSON block of a record page parses and names each section once
  if (/id="app-data"/.test(h)) { try { const data = JSON.parse(h.match(/<script type="application\/json" id="app-data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')); const keys = data.sections.map((s) => s.key); if (new Set(keys).size !== keys.length) issue(f, 'duplicate section keys'); for (const s of data.sections) if (!h.includes(`data-panel="${s.key}"`)) issue(f, 'no panel for section ' + s.key); } catch (e) { issue(f, 'app-data does not parse: ' + e.message); } }
}
const BAD_BUTTON = /<button\b(?![^>]*\btype=)/;
for (const f of pages) { const h = fs.readFileSync(f, 'utf8'); if (BAD_BUTTON.test(h)) issue(f, 'a button without a type'); }
console.log(`LINT: ${pages.length} pages, ${links} links, ${used.size} app- classes, ${cssClasses.size} app- classes in the stylesheet, ${bad} issues`);
process.exit(bad ? 1 : 0);
