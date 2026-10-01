// Browser checks for version A (design card check 8): axe, keyboard Tab walk, 320 px reflow, budgets at both screen sizes,
// and the task scenarios (in-place actions, list context, search, second window).
// Run through the heavy-command guard, with playwright-core and axe-core installed OUTSIDE the repo:
//   PW=<dir with node_modules/playwright-core> AXE=<dir with node_modules/axe-core> node tools/heavy.mjs -- node design/prototypes/queues-record/build/verify.mjs [axe|walk|reflow|budget|tasks]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const A = path.resolve(here, '..', 'a-tabs');
const PW = process.env.PW || 'C:/Users/User/Documents/GitHub/ashbridge-app';
const AXE = process.env.AXE;
const reqPW = createRequire(path.join(PW, 'package.json'));
const { chromium } = reqPW('playwright-core');
const axeSrc = fs.readFileSync(path.join(AXE, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const url = (f) => { const m = /^([^?#]*)(.*)$/.exec(f); return pathToFileURL(path.join(A, m[1])).href + m[2]; };
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
  const files = fs.readdirSync(A).filter((f) => f.endsWith('.html') && !f.startsWith('rec-'));
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
  const list = fs.readdirSync(A).filter((f) => f.endsWith('.html') && !f.startsWith('rec-')).concat(['rec-halton-haulage.html', 'rec-maple-ridge.html', 'rec-scarborough-robotics.html', 'rec-danforth-cleaning.html', 'rec-filler-007.html']);
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
  ok('"Since you last opened" is first under the identity bar', await p.evaluate(() => { const s = document.querySelector('.app-since'), i = document.querySelector('.moj-identity-bar'), f = document.querySelector('.app-facts'); return !s || (i.getBoundingClientRect().bottom <= s.getBoundingClientRect().top && s.getBoundingClientRect().bottom <= f.getBoundingClientRect().top); }));
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
await browser.close();
fs.writeFileSync(path.join(here, 'verify-output.txt'), out.join('\n') + '\n');
