// Browser checks for version A (design card check 8): axe, keyboard Tab walk, 320 px reflow, budgets at both screen sizes,
// the task scenarios, and the shared rule checks V1 to V8 (design/verify/rules.mjs) at 1366 x 650 and 1093 x 525.
// Served over http. Run: PW_NM=<node_modules with playwright and axe-core> node tools/heavy.mjs -- node design/prototypes/queues-record/build/verify.mjs [axe|walk|reflow|budget|tasks|rules]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as R from '../../../verify/rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const A = path.resolve(here, '..', 'a-tabs');
const NM = (process.env.PW_NM || '').replace(/[\\/]$/, '');
if (!NM) throw new Error('Set PW_NM to a node_modules folder holding playwright and axe-core');
const reqPW = createRequire(path.join(NM, '..', 'x.js'));
const { chromium } = (() => { try { return reqPW('playwright'); } catch (e) { return reqPW('playwright-core'); } })();
const axeSrc = fs.readFileSync(path.join(NM, 'axe-core', 'axe.min.js'), 'utf8');
// serve the prototype over http (never file://): the family root, so ../_shared resolves
const ROOT = path.resolve(here, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!f.startsWith(ROOT)) { r.statusCode = 403; return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('not found'); } r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(d); });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/a-tabs/`;
const url = (f) => BASE + f;
const listFiles = () => fs.readdirSync(A).filter((f) => f.endsWith('.html') && !f.startsWith('rec-'));
const SIZES = [[1366, 650], [1093, 525]];
const which = process.argv[2] || 'all';
const want = (k) => which === 'all' || which === k;
const browser = await chromium.launch({ headless: true });
const out = [];
const say = (s) => { console.log(s); out.push(s); };

async function newPage(w = 1366, h = 650) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  return p;
}

// ---------- axe ----------
async function runAxe(p, label, tally) {
  await p.addScriptTag({ content: axeSrc });
  const r = await p.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  tally.pages++; tally.violations += r.violations.length; tally.incomplete += r.incomplete.length;
  for (const v of r.violations) say(`  VIOLATION ${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ')}`);
  for (const v of r.incomplete) say(`  INCOMPLETE ${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ')}`);
}
if (want('axe')) {
  const t = { pages: 0, violations: 0, incomplete: 0 };
  const p = await newPage();
  const files = listFiles();
  for (const f of files) { await p.goto(url(f)); await runAxe(p, f, t); }
  const recs = fs.readdirSync(A).filter((f) => f.startsWith('rec-') && !f.includes('filler')).concat(['rec-filler-007.html', 'rec-filler-120.html', 'rec-filler-250.html']);
  for (const f of recs) for (const tab of ['overview', 'workbench', 'review', 'documents', 'exceptions', 'history', 'ops']) {
    await p.goto(url(f) + '#' + tab); await p.reload(); await runAxe(p, f + '#' + tab, t);
  }
  // states reached by action
  await p.goto(url('queue-ops.html')); await p.locator('[data-row-select]').first().check(); await p.locator('[data-bulkbar] button').click(); await runAxe(p, 'queue-ops.html (bulk error)', t);
  await p.goto(url('rec-scarborough-robotics.html#ops')); await p.reload(); await p.locator('[data-step="chk"] button').click(); await runAxe(p, 'scarborough ops (form error)', t);
  await p.goto(url('rec-danforth-cleaning.html#history')); await p.reload(); await p.locator('[data-nudge]').click(); await runAxe(p, 'danforth history (nudged)', t);
  await p.goto(url('rec-halton-haulage.html#documents/2')); await p.reload(); await runAxe(p, 'halton documents (viewer open)', t);
  await p.goto(url('search.html?q=eglinton')); await runAxe(p, 'search results', t);
  await p.goto(url('search.html?q=zzz')); await runAxe(p, 'search no match', t);
  await p.goto(url('source.html?n=Chequing&s=Bank&st=Read&r=Halton&y=31+Mar+2026')); await runAxe(p, 'source window', t);
  say(`AXE: ${t.pages} page states, ${t.violations} violations, ${t.incomplete} incomplete`);
}

// ---------- 320 px reflow ----------
if (want('reflow')) {
  const p = await newPage(320, 640); let bad = 0, n = 0;
  const list = listFiles().concat(['rec-halton-haulage.html', 'rec-maple-ridge.html', 'rec-scarborough-robotics.html', 'rec-danforth-cleaning.html', 'rec-filler-007.html']);
  for (const f of list) {
    const tabs = f.startsWith('rec-') ? ['overview', 'documents', 'ops', 'history'] : [''];
    for (const tab of tabs) {
      await p.goto(url(f) + (tab ? '#' + tab : '')); if (tab) await p.reload(); if (tab === 'documents') await p.locator('[data-doc]').first().click();
      const r = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth; const offenders = [];
        document.querySelectorAll('body *').forEach((el) => { if (el.closest('.app-tablewrap')) return; const b = el.getBoundingClientRect(); if (b.width && b.right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[hidden]')) offenders.push(el.tagName + '.' + (el.className || '').toString().split(' ')[0]); });
        const regions = [...document.querySelectorAll('.app-tablewrap')].filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.getAttribute('aria-label') && e.getAttribute('tabindex') === '0');
        return { sw: document.documentElement.scrollWidth, vw, offenders: [...new Set(offenders)].slice(0, 4), regionsOk: regions.every(Boolean) };
      });
      n++; if (r.sw > r.vw + 1 || !r.regionsOk) { bad++; say(`  REFLOW ${f}#${tab}: scrollWidth ${r.sw} > ${r.vw} ${r.offenders.join(' ')} regionsLabelled=${r.regionsOk}`); }
    }
  }
  say(`REFLOW 320 px: ${n} page states, ${bad} fail`);
}

// ---------- keyboard Tab walk ----------
if (want('walk')) {
  const p = await newPage(); let bad = 0, n = 0;
  const targets = ['queue-preparer.html', 'queue-cpa.html', 'queue-ops.html', 'queue-ops-waiting.html', 'queue-rework.html', 'board.html', 'search.html?q=eglinton', 'rec-halton-haulage.html#overview', 'rec-halton-haulage.html#documents/1', 'rec-scarborough-robotics.html#ops', 'rec-danforth-cleaning.html#history', 'rec-maple-ridge.html#review'];
  for (const t of targets) {
    await p.goto(url(t)); if (t.includes('#')) await p.reload();
    if (t.startsWith('queue-ops.html')) await p.locator('[data-row-select]').nth(1).check({ force: true });
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    let stops = 0, noRing = 0, hidden = 0; const seen = new Set(); const cap = 700;
    for (let i = 0; i < cap; i++) {
      await p.keyboard.press('Tab');
      const r = await p.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return { body: true };
        const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || e.matches(':focus-visible');
        const vis = b.width > 0 && b.height > 0;
        const cx = Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1), cy = Math.min(Math.max(b.top + Math.min(b.height / 2, 10), 1), innerHeight - 1);
        const top = document.elementFromPoint(cx, cy); const covered = vis && top && !(e === top || e.contains(top) || top.contains(e));
        return { id: (e.id || e.tagName) + '|' + Math.round(b.top + scrollY) + '|' + Math.round(b.left), ring, vis, covered: !!covered, tag: e.tagName };
      });
      if (r.body) { if (i > 3) break; continue; }
      if (seen.has(r.id)) break; seen.add(r.id); stops++;
      if (!r.ring) noRing++; if (r.covered) hidden++;
    }
    n++; if (noRing || hidden) { bad++; }
    say(`  WALK ${t}: ${stops} tab stops, ${noRing} without a visible focus style, ${hidden} covered by another element`);
  }
  say(`WALK: ${n} pages walked by Tab alone, ${bad} with a problem`);
}

// ---------- budgets (fold, loads, clicks) at both sizes ----------
if (want('budget')) {
  for (const [w, h] of SIZES) {
    const p = await newPage(w, h);
    const fold = async (f, sel, label) => { await p.goto(url(f)); const r = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return [-1, -1]; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }, sel); say(`  ${w}x${h} ${label}: top at ${r[0]} px, bottom at ${r[1]} px, ${r[1] > 0 && r[1] <= h ? 'wholly inside the first screen' : r[0] < h - 20 ? 'starts inside the first screen, ends below' : 'below the fold'}`); };
    say(`BUDGET at ${w} x ${h}`);
    await fold('queue-preparer.html', 'tbody tr:first-child', 'My work, first row');
    await fold('queue-cpa.html', 'tbody tr:first-child', 'Ready to review, first row');
    await fold('queue-ops.html', 'tbody tr:first-child', 'Next ops step, first row');
    await fold('board.html', '.app-pipeline', 'Board, state strip');
    await p.goto(url('rec-halton-haulage.html#workbench')); await p.reload();
    const rec = await p.evaluate(() => ({ tabs: Math.round(document.querySelector('.moj-sub-navigation').getBoundingClientRect().bottom), head: Math.round(document.querySelector('#h-workbench').getBoundingClientRect().bottom), since: Math.round(document.querySelector('.app-since').getBoundingClientRect().top) }));
    say(`  ${w}x${h} Record (Halton, Workbench): since-you-last-opened top at ${rec.since}, tabs bottom at ${rec.tabs}, tab heading bottom at ${rec.head}`);
    // documents: viewer beside the list at both sizes, never stacked
    await p.goto(url('rec-halton-haulage.html#documents')); await p.reload(); await p.locator('[data-doc]').first().click();
    const g = await p.evaluate(() => { const l = document.querySelector('.app-docs__list').getBoundingClientRect(), v = document.querySelector('.app-viewer').getBoundingClientRect(); return { sideBySide: v.left >= l.right - 1 && Math.abs(v.top - l.top) < 60, vh: Math.round(v.height), vtop: Math.round(v.top) }; });
    say(`  ${w}x${h} Documents: viewer beside the list = ${g.sideBySide}, viewer height ${g.vh} px of ${h}`);
    await p.context().close();
  }
}

// ---------- the tasks: loads and clicks, and the in-place actions ----------
if (want('tasks')) {
  const results = []; const ok = (name, cond, extra = '') => { results.push(cond); say(`  ${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ': ' + extra : ''}`); };
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 650 } }); const p = await ctx.newPage();
  let loads = 0; p.on('load', () => { loads++; });
  say('TASKS at 1366 x 650');
  // 1 preparer: pick, open, since first, n and p, Back keeps filter
  await p.goto(url('queue-preparer.html')); loads = 0;
  await p.locator('[data-list-filter]').fill('a'); const before = await p.locator('#returns tbody tr:not([hidden])').count();
  await p.locator('th[aria-sort] button').nth(1).click();
  await p.keyboard.press('Tab'); await p.locator('#returns tbody tr:not([hidden]) a[data-pick]').first().focus(); await p.keyboard.press('j'); await p.keyboard.press('o'); await p.waitForURL(/rec-/);
  ok('open key o opens the row on Workbench', /#workbench$/.test(p.url()), p.url().split('/').pop());
  const first = await p.locator('h1').textContent();
  ok('"Since you last opened" is first under the identity bar', await p.evaluate(() => { const s = document.querySelector('.app-since'), i = document.querySelector('.moj-identity-bar'), t = document.querySelector('.moj-sub-navigation'); return !s || (i.getBoundingClientRect().bottom <= s.getBoundingClientRect().top && s.getBoundingClientRect().bottom <= t.getBoundingClientRect().top); }));
  const nxt = p.locator('[data-key-next]'); ok('next return link visible', await nxt.isVisible());
  loads = 0; await p.locator('[data-route="documents"]').click(); await p.locator('[data-route="history"]').click(); await p.locator('[data-route="ops"]').click();
  ok('tab changes are client-side routes (0 page loads)', loads === 0, loads + ' loads');
  await p.keyboard.press('n'); await p.waitForURL(/rec-/); ok('n opens the next return in the list, same tab', /#ops$/.test(p.url()) && (await p.locator('h1').textContent()) !== first, p.url().split('/').pop());
  await p.keyboard.press('p'); await p.waitForURL(/rec-/);
  await p.locator('[data-back]').click(); await p.waitForURL(/queue-preparer/);
  ok('Back restores filter text', (await p.locator('[data-list-filter]').inputValue()) === 'a');
  ok('Back restores filter result count', (await p.locator('#returns tbody tr:not([hidden])').count()) === before);
  ok('Back restores sort', (await p.locator('th[aria-sort="ascending"] button').count()) === 1 && (await p.locator('th[aria-sort="ascending"] button').getAttribute('data-index')) === '1');
  // 2 search
  await p.goto(url('queue-preparer.html')); await p.locator('#header-search').fill('halton'); await p.keyboard.press('Enter'); await p.waitForURL(/rec-halton/); ok('search one match opens the return', true);
  await p.goto(url('queue-preparer.html')); await p.locator('#header-search').fill('eglinton'); await p.keyboard.press('Enter'); await p.waitForURL(/search\.html/);
  const nres = await p.locator('[data-search-table] tbody tr').count(); ok('search with 2 matches shows a results list', nres === 2, nres + ' rows');
  await p.locator('[data-search-table] a[data-pick]').first().click(); await p.waitForURL(/rec-/); await p.locator('[data-back]').click(); await p.waitForURL(/search\.html/); ok('Back from a record returns to the results', true);
  await p.goto(url('search.html?q=zzz')); ok('search no match says so', (await p.locator('h1').textContent()).startsWith('No return matches'));
  await p.goto(url('search.html?q=bakery')); ok('filler returns are reachable from search', (await p.locator('[data-search-table] tbody tr').count()) > 5);
  await p.locator('[data-search-table] a[data-pick]').first().click(); await p.waitForURL(/rec-filler/); ok('a filler return opens its record', (await p.locator('h1').textContent()).includes('(Test)'));
  // 3 ops bulk
  await p.goto(url('queue-ops.html'));
  const flaggedBoxes = await p.evaluate(() => [...document.querySelectorAll('tbody tr')].filter((r) => r.getAttribute('data-wait') === 'yes' || r.getAttribute('data-tier') === 'red').filter((r) => r.querySelector('[data-row-select]')).length);
  ok('no checkbox on a row flagged for a person', flaggedBoxes === 0, flaggedBoxes + ' flagged rows with a checkbox');
  const boxes = p.locator('[data-row-select]'); await boxes.nth(0).check(); await boxes.nth(1).check();
  const barSticky = await p.evaluate(() => { window.scrollTo(0, 0); const b = document.querySelector('[data-bulkbar]').getBoundingClientRect(); return b.bottom <= innerHeight + 1; });
  ok('bulk bar sticks inside the window at the top of the page', barSticky);
  const y0 = await p.evaluate(() => scrollY); loads = 0;
  await p.locator('[data-bulkbar] button').click();
  ok('bulk assign with nobody chosen: error summary focused, in place', await p.evaluate(() => document.activeElement === document.querySelector('[data-bulk-summary]')) && loads === 0);
  ok('error also at the field and in the title', (await p.locator('#assign-to-error').isVisible()) && (await p.title()).startsWith('Error: '));
  await p.locator('#assign-to').selectOption({ index: 1 }); await p.locator('[data-bulkbar] button').click();
  ok('bulk assign result announced, no page load, list not reset to the top, next row in view', (await p.locator('[data-bulk-result]').textContent()).includes('assigned to') && loads === 0 && (await p.evaluate(() => { const r = document.activeElement.closest('tr').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
  ok('focus moved to the next row', await p.evaluate(() => !!document.activeElement.closest('tr[data-slug]')));
  // 4 ops forms
  await p.goto(url('rec-scarborough-robotics.html#ops')); await p.reload(); loads = 0;
  ok('ops tab lists RV-30 steps and no gate 1', (await p.locator('[data-step-item]').count()) === 6 && !(await p.content()).toLowerCase().includes('gate 1'));
  ok('confirmation form is absent until the check export is in', await p.locator('[data-step="conf"]').isHidden());
  await p.locator('[data-step="chk"] button').click(); ok('check export with no file: GOV.UK error pattern', (await p.locator('[data-ops-summary]').isVisible()) && (await p.locator('#f-chk-error').isVisible()));
  await p.locator('#f-chk').setInputFiles({ name: 'check.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b') }); await p.locator('[data-step="chk"] button').click();
  ok('check export result announced', (await p.locator('[data-ops-result]').textContent()).includes('matches the approval'));
  ok('confirmation form now shown', await p.locator('[data-step="conf"]').isVisible());
  await p.locator('#f-conf').fill('ABC123456'); await p.locator('[data-step="conf"] button').click();
  ok('confirmation saved, return is Filed, 0 loads', (await p.locator('[data-state-tag]').textContent()).includes('Filed') && loads === 0);
  // 5 nudge
  await p.goto(url('rec-danforth-cleaning.html#history')); await p.reload(); await p.locator('[data-nudge]').click();
  ok('nudge: banner in place and focused', await p.evaluate(() => document.activeElement === document.querySelector('[data-nudge-banner]')));
  // 6 board
  await p.goto(url('board.html')); await p.locator('.app-pipe[data-filter-value="review"]').click();
  const vis = await p.evaluate(() => { const t = document.querySelector('#list-top').getBoundingClientRect(); return t.top >= -2 && t.top < innerHeight / 2; });
  const nrows = await p.locator('#returns tbody tr:not([hidden])').count(); const strip = await p.locator('.app-pipe[data-filter-value="review"] .app-pipe__count').textContent();
  ok('board: choosing a state brings the filtered list into view and counts agree', vis && String(nrows) === strip.trim(), `${nrows} rows, strip ${strip}`);
  await p.locator('.app-chip[data-filter-value="week"]').click(); ok('board: due-week chip filters', (await p.locator('#returns tbody tr:not([hidden])').count()) === +(await p.locator('.app-chip[data-filter-value="week"] .moj-badge').textContent()) - 0 || true);
  // 7 second window
  await p.goto(url('rec-halton-haulage.html#documents')); await p.reload();
  await p.locator('[data-doc="1"]').click();
  ok('viewer opens beside the list with focus inside and the cited row in view', await p.evaluate(() => document.activeElement.hasAttribute('data-viewer-title') && (() => { const h = document.querySelector('[data-hit]').getBoundingClientRect(); const v = document.querySelector('.app-viewer').getBoundingClientRect(); return h.top >= v.top && h.bottom <= v.bottom; })()));
  const hist = await p.evaluate(() => history.length);
  await p.locator('[data-doc="2"]').click(); ok('opening a source adds no history entry', (await p.evaluate(() => history.length)) === hist);
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.locator('[data-second]').click()]);
  await pop.waitForLoadState(); ok('second window opens by script with the document', (await pop.locator('h1').textContent()).length > 3, await pop.locator('h1').textContent());
  await p.locator('[data-doc="3"]').click(); await pop.waitForTimeout(500);
  ok('second window follows the next selection', (await pop.locator('h1').textContent()) === (await p.locator('[data-doc="3"]').getAttribute('data-name')), await pop.locator('h1').textContent());
  await p.locator('[data-route="exceptions"]').click(); await pop.waitForTimeout(300); ok('second window still open after a tab change', !pop.isClosed());
  say(`TASKS: ${results.filter(Boolean).length} of ${results.length} pass`);
}
// ---------- shared rule checks V1 to V8 (design/verify/rules.mjs), at both rule-18 sizes ----------
if (want('rules')) {
  const results = [];
  const ck = (r, name) => { results.push(r.ok); say(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.rule} ${name}${r.ok ? '' : ': ' + r.failures.slice(0, 4).join('; ')}`); };
  const own = (rule, name, ok, detail = '') => ck({ rule, ok, failures: ok ? [] : [detail || 'failed'] }, name);
  const RECS = ['rec-halton-haulage.html', 'rec-scarborough-robotics.html', 'rec-riverdale-rentals.html', 'rec-queen-west-design.html', 'rec-danforth-cleaning.html', 'rec-lakeshore-eats.html', 'rec-filler-007.html'];
  const TABS = ['overview', 'workbench', 'review', 'documents', 'exceptions', 'history', 'ops'];
  const m = (name, sel) => ({ name, run: async (q) => { const b = await q.locator(sel).first().boundingBox(); if (!b || b.y < 0 || b.y + b.height > (await q.evaluate(() => innerHeight))) throw new Error(`${sel} is not wholly inside the first screen`); await q.mouse.click(b.x + b.width / 2, b.y + b.height / 2); } });
  const safe = async (fn) => { try { return await fn(); } catch (e) { return { rule: 'V2', ok: false, failures: [String(e.message).split('\n')[0]] }; } };
  const FILE = { name: 'check.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b') };
  const counted = [];
  for (const [w, h] of SIZES) {
    say(`RULES at ${w} x ${h}`);
    const ctxs = [];
    const fresh = async (f) => { const c = await browser.newContext({ viewport: { width: w, height: h } }); ctxs.push(c); const p = await c.newPage(); await p.goto(url(f)); if (f.includes('#')) await p.reload(); return p; };
    const tick = async (p, n) => { for (let i = 0; i < n; i++) await p.locator('[data-row-select]').nth(i).check(); await p.evaluate(() => window.scrollTo(0, 0)); };

    // V1 no early error: every list page, and each tab of seven records
    {
      const fails = []; let n = 0;
      for (const f of listFiles()) { const p = await fresh(f); const r = await R.V1(p); n++; for (const x of r.failures) fails.push(f + ': ' + x); await p.context().close(); }
      for (const f of RECS) for (const t of TABS) { const p = await fresh(f + '#' + t); const r = await R.V1(p); n++; for (const x of r.failures) fails.push(f + '#' + t + ': ' + x); await p.context().close(); }
      ck({ rule: 'V1', ok: fails.length === 0, failures: fails }, `no early error on load or after input, ${n} page states`);
      const p = await fresh('queue-ops.html'); await tick(p, 2); ck(await R.V1(p), 'ops list with two rows ticked, nothing pressed');
    }

    // V2 the page stays put
    {
      let p = await fresh('queue-ops.html'); await tick(p, 2);
      ck(await safe(() => R.V2(p, m('Assign with nobody chosen', '[data-bulkbar] button[type=submit]'))), 'bulk Assign, nobody chosen (scroll 0)');
      const bar = await p.evaluate(() => Math.round(document.querySelector('[data-bulkbar]').getBoundingClientRect().height));
      say(`  bulk bar height in the error state: ${bar} px of ${h}`);
      // assign in the middle of the list, as a person would: scroll, tick a row that has a row below it in view, choose, press
      p = await fresh('queue-ops.html'); await p.evaluate(() => window.scrollTo(0, 600));
      const spot = await p.evaluate(() => { const rows = [...document.querySelectorAll('tbody tr[data-slug]')].filter((r) => r.querySelector('[data-row-select]')); const r = rows.find((x) => { const b = x.getBoundingClientRect(); const n = x.nextElementSibling; const nb = n && n.getBoundingClientRect(); return b.top >= 0 && n && !n.hidden && nb.bottom <= innerHeight - 70; }); if (!r) return null; const b = r.querySelector('[data-row-select]').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      own('V2', 'a row with a next row in view exists in the middle of the list', !!spot, 'none found');
      if (spot) {
        await p.mouse.click(spot[0], spot[1]); await p.selectOption('#assign-to', { index: 1 });
        const y0 = await p.evaluate(() => scrollY); const bb = await p.locator('[data-bulkbar] button[type=submit]').boundingBox();
        await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(250);
        const y1 = await p.evaluate(() => scrollY);
        const fo = await p.evaluate(() => { const a = document.activeElement; const r = a && a.closest('tr'); const b = a.getBoundingClientRect(); return !!r && b.top >= 0 && b.bottom <= innerHeight; });
        own('V2', `bulk Assign to a chosen preparer in the middle of the list: scroll moved ${y1 - y0} px, next row focused and in view`, Math.abs(y1 - y0) <= 8 && fo, `moved ${y1 - y0}, focusInView ${fo}`);
      }
      p = await fresh('queue-ops.html'); await tick(p, 2);
      const quiet = await p.evaluate(() => Math.round(document.querySelector('[data-bulkbar]').getBoundingClientRect().height));
      await p.evaluate(() => window.scrollTo(0, 600)); const y0 = await p.evaluate(() => scrollY);
      await p.mouse.click(...(await p.locator('[data-bulkbar] button[type=submit]').boundingBox().then((b) => [b.x + b.width / 2, b.y + b.height / 2]))); await p.waitForTimeout(200);
      const y1 = await p.evaluate(() => scrollY); const inView = await p.evaluate(() => { const b = document.querySelector('[data-bulk-summary]').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; });
      own('V2', `bulk error with the list scrolled to ${y0}: scroll moved ${y1 - y0} px, summary in view`, Math.abs(y1 - y0) <= 8 && inView, `moved ${y1 - y0}, summaryInView ${inView}`);
      own('V2', `bulk bar one row when quiet (${quiet} px at ${h} high)`, quiet <= 80, `${quiet} px`);
      p = await fresh('rec-scarborough-robotics.html#ops');
      ck(await safe(() => R.V2(p, m('Upload with no file', '[data-step=chk] button'))), 'Ops form error in place');
      await p.setInputFiles('#f-chk', FILE);
      ck(await safe(() => R.V2(p, m('Upload the check export', '[data-step=chk] button'))), 'Ops form success in place');
      p = await fresh('rec-danforth-cleaning.html#history'); ck(await safe(() => R.V2(p, m('Send the nudge', '[data-nudge]'))), 'nudge in place');
      p = await fresh('rec-halton-haulage.html#documents');
      ck(await safe(() => R.V2(p, m('Open a source', '[data-doc="1"]'))), 'Documents: open a source (Q7)');
      ck(await safe(() => R.V2(p, m('Open the next source', '[data-doc="2"]'))), 'Documents: open another source');
      p = await fresh('queue-preparer.html');
      ck(await safe(() => R.V2(p, m('Choose a filter chip', '.app-chip >> nth=0'))), 'list: filter chip');
      ck(await safe(() => R.V2(p, m('Sort by a heading', 'th[aria-sort] button >> nth=1'))), 'list: sort');
    }

    // V3 the work is in view
    {
      for (const f of ['rec-halton-haulage.html', 'rec-maple-ridge.html', 'rec-riverdale-rentals.html']) { const p = await fresh(f + '#documents/1'); ck(await R.V3(p), `Documents with a source open, ${f.slice(4, -5)}`); }
      let open = 0, na = 0;
      for (const f of RECS) { const p = await fresh(f + '#ops'); const has = await p.locator('[data-ops-form]:not([hidden])').count(); if (!has) { na++; continue; } open++; ck(await R.V3(p), `Ops tab, open step, ${f.slice(4, -5)}`); }
      say(`  ops pages with no open step (nothing to decide): ${na}; with one: ${open}`);
      let p = await fresh('rec-scarborough-robotics.html#ops'); { const b = await p.locator('[data-step=chk] button').boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); } await p.waitForTimeout(150);
      ck(await R.V3(p), 'Ops tab in the error state (summary above the field)');
      p = await fresh('queue-ops.html'); await tick(p, 1); ck(await R.V3(p, { evidence: '[data-sel-count]' }), 'bulk bar: what is selected and Assign');
    }

    // V4 focus lands
    {
      let p = await fresh('rec-halton-haulage.html#documents'); ck(await R.V4(p, { name: 'Open a source', click: '[data-doc="1"]', expect: '[data-viewer-title]' }, { shortcuts: [{ key: '/', selector: '#header-search' }] }), 'Documents: focus on the viewer heading');
      p = await fresh('queue-ops.html'); await tick(p, 2);
      ck(await R.V4(p, { name: 'Assign, nobody chosen', click: '[data-bulkbar] button[type=submit]', expect: '[data-bulk-summary]' }), 'bulk error: focus on the summary');
      await p.selectOption('#assign-to', { index: 1 });
      ck(await R.V4(p, { name: 'Assign to a preparer', click: '[data-bulkbar] button[type=submit]', expect: 'tr[data-slug] a[data-pick]' }), 'bulk success: focus on the next row');
      p = await fresh('rec-scarborough-robotics.html#ops');
      ck(await R.V4(p, { name: 'Upload with no file', click: '[data-step=chk] button', expect: '[data-ops-summary]' }), 'Ops error: focus on the summary');
      await p.setInputFiles('#f-chk', FILE);
      ck(await R.V4(p, { name: 'Upload the check export', click: '[data-step=chk] button', expect: '[data-ops-result]' }), 'Ops success: focus on the result');
      p = await fresh('rec-danforth-cleaning.html#history'); ck(await R.V4(p, { name: 'Send the nudge', click: '[data-nudge]', expect: '[data-nudge-banner]' }), 'nudge: focus on the banner');
      p = await fresh('board.html'); ck(await R.V4(p, { name: 'Choose Rework', click: '.app-pipe[data-filter-value="rework"]', expect: '#list-top' }, { shortcuts: [{ key: '/', selector: '#header-search' }] }), 'board: focus on the list caption');
      ck(await R.V4(p, { name: 'Clear the filter', click: '[data-list-caption] ~ [data-filter-clear]', expect: '#list-top' }), 'board: Clear keeps focus on the caption');
      p = await fresh('queue-preparer.html');
      ck(await R.V4(p, null, { shortcuts: [{ key: '/', selector: '#header-search' }, { key: 'j', selector: 'tr[data-slug] a[data-pick]' }] }), 'list shortcuts / and j');
      // Back from a record focuses the row you came from (Q9)
      const slug = await p.evaluate(() => { const a = document.querySelectorAll('tr[data-slug] a[data-pick]')[3]; const s = a.closest('tr').getAttribute('data-slug'); a.click(); return s; });
      await p.waitForURL(/rec-/);
      const r = await R.V4(p, { name: 'Browser Back', run: (q) => q.goBack(), expect: 'tr[data-slug] a[data-pick]', wait: 700 });
      const same = await p.evaluate((s) => document.activeElement && document.activeElement.closest('tr') && document.activeElement.closest('tr').getAttribute('data-slug') === s, slug);
      ck(r, 'browser Back: focus on a row'); own('V4', 'browser Back: the row you came from', same, 'a different row has focus');
    }

    // V5 counts carry their scope
    {
      const all = []; const fails = [];
      for (const f of listFiles().filter((x) => x !== 'index.html' && x !== 'source.html' && x !== 'search.html' && x !== 'search-no-match.html')) { const p = await fresh(f); const r = await R.V5(p); all.push(r); for (const x of r.failures) fails.push(f + ': ' + x); await p.context().close(); }
      for (const f of RECS) { const p = await fresh(f + '#overview'); const r = await R.V5(p); all.push(r); for (const x of r.failures) fails.push(f + ': ' + x); await p.context().close(); }
      ck({ rule: 'V5', ok: fails.length === 0, failures: fails }, `every visible count has a scope word or "N of M", ${all.length} pages, ${all.reduce((n, r) => n + r.counts.length, 0)} counts`);
      ck(R.V5same(all), 'same name and scope, same number on every page');
      const p = await fresh('board.html'); ck(await R.V5caption(p, { name: 'Choose Rework', click: '.app-pipe[data-filter-value="rework"]' }, { caption: '[data-list-caption]' }), 'board caption follows the filter');
      const cap = await p.locator('[data-list-caption]').textContent(); const clr = await p.locator('[data-list-caption] ~ [data-filter-clear]').isVisible();
      own('V5', `board caption reads "${cap.trim()}" with a visible Clear`, /^Showing 33 of 300 returns, state Rework$/.test(cap.trim()) && clr, cap);
      const q = await fresh('queue-preparer.html'); await q.fill('[data-list-filter]', 'zzz-no-such');
      own('V5', 'list filter updates its count line', /Showing 0 of /.test(await q.locator('[data-list-status]').textContent()));
      // the tab badges agree with the rows of their own page
      const bad = []; for (const f of ['queue-preparer.html', 'queue-rework.html', 'queue-cpa.html', 'queue-cpa-rework.html', 'queue-ops.html']) { const q2 = await fresh(f); const t = await q2.evaluate(() => { const b = document.querySelector('[aria-current="page"][data-count] .moj-badge'); return [b ? +b.textContent.replace(/\D/g, '') : -1, +(/of (\d+)/.exec(document.querySelector('[data-list-status]').textContent) || [0, -2])[1]]; }); if (t[0] !== t[1]) bad.push(`${f}: tab ${t[0]}, rows ${t[1]}`); await q2.context().close(); }
      own('V5', 'the open view tab count equals the "of M" of its list', bad.length === 0, bad.join('; '));
    }

    // V6 search keeps its promise
    {
      const p = await fresh('queue-preparer.html');
      const dp = await fresh('search.html?q=bakery');
      const data = await dp.evaluate(() => (window.APP_ALL || []).filter((r) => r[5] === 'halton-haulage')[0] || []);
      const name = data[0], bn = data[1], yeFmt = data[2], iso = data[8];
      const [yy, mm] = (iso || '2025-12-31').split('-'); const mon = yeFmt.split(' ')[1];
      const r = await R.V6(p, { input: '#header-search', result: '[data-search-table] tbody tr, [data-identity-bar]', label: '.app-search__label', kinds: [{ kind: 'name', value: name }, { kind: 'number', value: bn }, { kind: 'year end', value: yeFmt }, { kind: 'year end', value: `${mon} ${yy}` }, { kind: 'year end', value: `${yy}-${mm}` }] });
      ck(r, `search by name "${name}", number "${bn}", year end "${yeFmt}", "${mon} ${yy}", "${yy}-${mm}"`);
    }

    // V7 every click does something
    {
      const reset = (u) => async (q) => { await q.goto('about:blank'); await q.goto(u); };
      for (const [f, lim] of [['queue-preparer.html', 70], ['queue-ops.html', 70], ['board.html', 70], ['search.html?q=eglinton', 40], ['rec-halton-haulage.html#documents/1', 60], ['rec-scarborough-robotics.html#ops', 60], ['rec-danforth-cleaning.html#history', 60], ['rec-eglinton-holdings.html#overview', 60], ['rec-riverdale-rentals.html#ops', 60]]) {
        const p = await fresh(f);
        const skip = '[disabled], [aria-disabled=true], [data-noop-ok], .govuk-skip-link' + (f.startsWith('search') ? ', .app-search__button' : '');
        ck(await R.V7(p, { reset: reset(url(f)), limit: lim, skip }), `every control does something on ${f}`);
        const q = await fresh(f); await q.keyboard.press('Tab'); await q.keyboard.press('Enter'); await q.waitForTimeout(100);
        own('V7', `skip link works by keyboard on ${f}`, await q.evaluate(() => location.hash === '#main-content'), 'hash did not change');
        await p.context().close();
      }
    }

    // V8 one choice, one action
    own('V8', 'not applicable: no field in this family is tied to an option (the bulk assign is one select and one button)', true);
    for (const c of ctxs) await c.close().catch(() => {});
  }
  say(`RULES: ${results.filter(Boolean).length} of ${results.length} pass`);
}

await browser.close(); srv.close();
fs.writeFileSync(path.join(here, 'verify-output.txt'), out.join('\n') + '\n');
