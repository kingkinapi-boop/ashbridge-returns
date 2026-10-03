// Designer self-check for version 3 (design card checks 7 and 8): axe (incomplete counts as a failure), keyboard walk, 320 px reflow, budgets at both
// sizes, the task scripts of the brief, the in-place rules (18 to 23) and the shared rule checks V1 to V8 (design/verify/rules.mjs).
// Nothing is installed globally: set AUDIT_MODULES to a folder that holds playwright-core and axe-core.
//   MSYS_NO_PATHCONV=1 AUDIT_MODULES=<folder> node tools/heavy.mjs -- node design/prototypes/cpa-review/v3/_build/verify.mjs [tasks|budgets|rules|v|axe|walk|reflow|fast|all]  (groups can be joined with commas)
// Run from the repository root. Pages are served over http, never file:// (design card check 8).
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import * as R from '../../../../verify/rules.mjs'; // shared rule checks V1 to V8 (design/verify/README.md)

const req = createRequire(path.join(process.env.AUDIT_MODULES, 'package.json'));
const { chromium } = req('playwright-core');
const axeSrc = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SITE = path.resolve('design/prototypes/cpa-review/v3');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((rq, rs) => {
  const p = decodeURIComponent(rq.url.split('?')[0]); const f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end('not found'); }
  rs.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rs);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const url = (f, hash = '') => `http://127.0.0.1:${PORT}/${f}${hash}`;
const SIZES = [[1366, 650], [1093, 525]];
const TR = '[data-trace]:not([hidden])'; // the trace of the number or flag on show (the others are in the page but hidden)
const which = process.argv[2] || 'all';
const VERBOSE = !!process.env.VERBOSE;
const results = { fail: 0, tasks: [], rules: [] };
const log = (...a) => console.log(...a);
const fail = (m) => { results.fail++; log('FAIL', m); };
const ok = (m) => { if (VERBOSE) log('ok  ', m); };
const chk = (bucket, name, cond, extra = '') => { bucket.push([name, !!cond, extra]); if (cond) ok(name + (extra ? ': ' + extra : '')); else fail(name + (extra ? ': ' + extra : '')); return !!cond; };
// one block of steps: a thrown error (a click that finds nothing, a timeout) is a failure with its line number, and the next block still runs
const sec = async (name, fn) => { try { await fn(); } catch (e) { const lines = String(e.message).split('\n').map((l) => l.replace(/\u001b\[[0-9;]*m/g, '').trim()).filter(Boolean); const at = (String(e.stack).match(/verify\.mjs:(\d+)/) || [])[1]; fail(`${name} stopped at line ${at}: ${lines.slice(0, 3).join(' / ')}`); } };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
async function open(f, hash = '', size = [1366, 650], ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, acceptDownloads: false, ...ctxOpts });
  ctx.setDefaultTimeout(4000); ctx.setDefaultNavigationTimeout(45000);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => { page.errors.push(e.message); fail(`page error on ${f}${hash}: ${e.message}`); });
  page.on('response', (r) => { if (r.status() >= 400) fail(`HTTP ${r.status()} for ${r.url().replace(/^http:\/\/127\.0\.0\.1:\d+\//, '')} on ${f}${hash}`); }); // a missing file is a failure
  await page.goto(url(f, hash), { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(250);
  page.ctx = ctx;
  return page;
}
const goHash = async (page, h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(120); };
const hashOf = (page) => page.evaluate(() => location.hash);
const vis = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length > 0), sel);
const nVis = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length > 0).length, sel);
const txt = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const live = (page) => txt(page, '#app-live');
const onRow = (page) => page.evaluate(() => { const a = document.activeElement; return a && a.hasAttribute('data-pick') ? a.closest('[data-row]').getAttribute('data-row') : null; });
const selRow = (page) => page.evaluate(() => { const r = document.querySelector('[data-row].is-selected'); return r ? r.getAttribute('data-row') : null; });
const active = (page) => page.evaluate(() => { const a = document.activeElement; if (!a) return 'none'; return a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (a.hasAttribute('data-pick') ? '[data-pick of ' + a.closest('[data-row]').getAttribute('data-row') + ']' : '') + ' "' + (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"'; });
const DATA = (page) => page.evaluate(() => JSON.parse(document.getElementById('app-data').textContent));
// section change through the interface: the rail when it shows (1201 px and up), the Section select below that
async function toSection(page, slug) {
  const rail = page.locator(`.app-rail a[href="#/${slug}"]`);
  if (await rail.isVisible()) await rail.click(); else await page.selectOption('[data-section-pick]', `#/${slug}`);
  await page.waitForTimeout(120);
}
// run an action inside the page and wait (frame by frame) until a condition holds; returns the milliseconds, or -1 after 2.5 s
const timed = (page, actionSrc, condSrc) => page.evaluate(async ([a, c]) => {
  const act = new Function(a); const cond = new Function('return (' + c + ')');
  const t0 = performance.now(); act();
  while (!cond()) { if (performance.now() - t0 > 2500) return -1; await new Promise((r) => requestAnimationFrame(r)); }
  await new Promise((r) => requestAnimationFrame(r));
  return Math.round(performance.now() - t0);
}, [actionSrc, condSrc]);
const keySrc = (k) => `document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`;
const clickSrc = (sel) => `document.querySelector(${JSON.stringify(sel)}).click()`;
const inBox = (page, evSel, boxSel) => page.evaluate(([e, b]) => { const el = [...document.querySelectorAll(e)].find((x) => x.getClientRects().length); const box = document.querySelector(b).getBoundingClientRect(); if (!el) return { has: false }; const r = el.getBoundingClientRect(); return { has: true, inPane: r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.left >= box.left - 1 && r.right <= box.right + 1, scrollY }; }, [evSel, boxSel]);

// ------------------------------------------------------------------ axe
const SLUGS = ['flags', 'statements', 'schedule-1', 'capital', 'losses', 'rate', 'dividends', 'shareholders', 'ontario', 'disclosures', 'payment'];
const EXPAND = '.app-panes{display:block!important}.app-cpanel{position:static!important}.app-main--record{height:auto!important;display:block!important}.app-review,.app-work,.app-panes{height:auto!important}.app-pane{max-height:none!important}.app-pane__body,.app-cp__body,.app-rail,.app-winbody,[data-view],.app-scroll-x,.app-scroll{overflow:visible!important;max-height:none!important}';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Pass 1 is the page as laid out: violations and incomplete results. Pass 2 removes the scrolling of the panes for the colour contrast rule only,
// because axe cannot judge text that a scrolling pane clips ("partially obscured": incomplete); contrast does not depend on the scroll position.
// Incomplete results that were checked by hand (MOJ timeline and badge: a pseudo element that axe cannot see through) are counted apart, not hidden.
const HAND = (n) => /moj-(timeline|badge)/.test(n.t) && /pseudoContent|elmPartiallyObscured/.test(n.key || '');
const RUN = async (page, opts) => page.evaluate(async (o) => { const r = await window.axe.run(document, o); const f = (l) => l.flatMap((x) => x.nodes.map((n) => ({ id: x.id, t: n.target.join(' ').slice(0, 70), key: ((n.any[0] || n.all[0] || n.none[0] || {}).data || {}).messageKey }))); return { v: f(r.violations), i: f(r.incomplete) }; }, opts);
async function axeRun(page, label, out) {
  await page.evaluate(axeSrc);
  const r1a = await RUN(page, { runOnly: { type: 'tag', values: TAGS }, resultTypes: ['violations', 'incomplete'] });
  const r1b = await RUN(page, { runOnly: { type: 'rule', values: ['region', 'landmark-unique'] }, resultTypes: ['violations', 'incomplete'] });
  const r1 = { v: [...r1a.v, ...r1b.v], i: [...r1a.i, ...r1b.i] };
  const vs = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vs.width, 1400), height: 6000 }); // everything inside the window, so nothing is judged "obscured" only for lying below the fold or beside the edge
  const st = await page.addStyleTag({ content: EXPAND });
  const r2 = await RUN(page, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations', 'incomplete'] });
  await st.evaluate((e) => e.remove());
  await page.setViewportSize(vs);
  const viol = [...r1.v.filter((x) => x.id !== 'color-contrast'), ...r2.v];
  const incAll = [...r1.i.filter((x) => x.id !== 'color-contrast'), ...r2.i];
  const POP = (x) => /keys list open/.test(label) && x.id === 'color-contrast' && /elmPartiallyObscuring|bgOverlap/.test(x.key || ''); // the open keys list floats over the page: its own text is dark on white and the text under it is covered, so axe cannot judge the overlap
  const hand = incAll.filter((x) => HAND(x) || POP(x)), inc = incAll.filter((x) => !HAND(x) && !POP(x));
  out.pages++; out.byHand = (out.byHand || 0) + hand.length;
  const show = (l) => [...new Set(l.map((x) => x.id + ' [' + x.t + '] ' + (x.key || '')))].slice(0, 4).join('; ');
  if (viol.length) { out.violations += viol.length; fail(`axe violation ${label}: ${viol.length} nodes: ${show(viol)}`); }
  if (inc.length) { out.incomplete += inc.length; fail(`axe incomplete ${label}: ${inc.length} nodes: ${show(inc)}`); }
}
// the pages, routes and states axe looks at: [file, routes, then a list of named states reached by an action]
const AXE_PLAN = [
  ['red.html', ['#/brief', '#/brief/attest', '#/flags', '#/flags/01-F04', '#/flags/01-F04/error', '#/flags/01-F02', '#/statements', '#/statements/n-6090', '#/statements/n-6170', '#/statements/n-6155/loading', '#/statements/n-6155/failed', '#/schedule-1', '#/capital', '#/losses', '#/rate', '#/dividends', '#/shareholders', '#/ontario', '#/disclosures', '#/payment', '#/approve', '#/comments', '#/comments/send', '#/comments/send/error', '#/history', '#/find/loan', '#/find/zzz', '#/statements/n-6090/comment-error']],
  ['red-rework.html', ['#/brief', '#/changes', '#/comments', '#/statements', '#/flags', '#/flags/01-F01', '#/history']],
  ['red-gate.html', ['#/approve', '#/flags']],
  ['red-ready.html', ['#/approve', '#/brief']],
  ['red-preparer.html', ['#/brief', '#/flags', '#/flags/01-F04', '#/statements/n-6090', '#/comments', '#/history']],
  ['green.html', ['#/brief', '#/flags', '#/disclosures', '#/comments', '#/approve', '#/history']],
  ['green-ready.html', ['#/approve', '#/payment']],
  ['green-void.html', ['#/brief', '#/changes', '#/flags', '#/statements', '#/comments', '#/history']],
  ['bluewater.html', ['#/brief', '#/flags', '#/payment']],
  ['scarborough.html', ['#/brief', '#/brief/attest', '#/flags', '#/flags/09-F03', '#/forms-not-placed', '#/approve', '#/statements']],
];
async function axeAll() {
  const out = { pages: 0, violations: 0, incomplete: 0 };
  const sizes = (process.env.AXE_SIZES || '1366x650,1093x525,320x640').split(',').map((x) => x.split('x').map(Number));
  const only = process.env.AXE_FILES ? process.env.AXE_FILES.split(',') : null;
  for (const size of sizes) {
    const tag = size.join('x');
    for (const [f, routes] of AXE_PLAN) {
      if (only && !only.includes(f)) continue;
      const page = await open(f, routes[0], size);
      for (const r of routes) { await goHash(page, r); await axeRun(page, `${f}${r} @${tag}`, out); }
      if (f === 'red.html') {
        // judgment: accepted, then the form to change it; the comment panel open, then with errors; the unmark form open, then with an error; the keys list open
        await goHash(page, '#/flags/01-F01'); await page.fill('#jr-01-F01', 'One client, but the owner names two more clients starting in April.'); await page.click('[data-judge-form="01-F01"] button.govuk-button'); await page.waitForTimeout(120);
        await goHash(page, '#/flags/01-F01'); await axeRun(page, `red.html judged @${tag}`, out);
        await page.click(`${TR} [data-judge-change]`); await axeRun(page, `red.html change my judgment @${tag}`, out);
        await goHash(page, '#/statements/n-6090'); await page.keyboard.press('c'); await axeRun(page, `comment panel @${tag}`, out);
        await page.click('[data-comment-form] button.govuk-button'); await page.waitForTimeout(100); await axeRun(page, `comment panel error @${tag}`, out);
        await page.keyboard.press('Escape'); await goHash(page, '#/statements'); await page.click('[data-unmark-open]'); await axeRun(page, `unmark form @${tag}`, out);
        await page.click('[data-unmark-form] button.govuk-button'); await page.waitForTimeout(100); await axeRun(page, `unmark form error @${tag}`, out);
        await page.click('summary.app-keys__summary'); await axeRun(page, `keys list open @${tag}`, out); await page.click('summary.app-keys__summary');
        await goHash(page, '#/comments/send'); await page.fill('#sb-text', 'Please attach the receipts.'); await page.click('[data-sendback-form] button'); await page.waitForTimeout(120); await axeRun(page, `sent back @${tag}`, out);
      }
      if (f === 'red-rework.html') {
        await goHash(page, '#/comments'); await page.click('[data-resolve]'); await page.waitForTimeout(120); await axeRun(page, `rework: a comment resolved @${tag}`, out);
      }
      if (f === 'red-gate.html') {
        await goHash(page, '#/flags/01-F07'); await page.click(`${TR} [data-judge-comment]`); await axeRun(page, `comment instead panel @${tag}`, out);
      }
      await page.ctx.close();
    }
    if (!only || only.includes('others')) {
      for (const [f, h] of [['queue.html', '#/all'], ['queue.html', '#/rework'], ['queue-later.html', '#/rework'], ['queue-later.html', '#/all'], ['queue-empty.html', '#/all'], ['queue-empty.html', '#/rework'], ['queue-error.html', ''], ['approved-red.html', ''], ['approved-green.html', ''], ['approved-blue.html', ''], ['approved-scar.html', ''], ['source-red.html', '#n-6090:0'], ['source-red.html', ''], ['source-green.html', ''], ['source-blue.html', ''], ['source-scar.html', ''], ['signed-out.html', ''], ['notes.html', ''], ['index.html', '']]) {
        const page = await open(f, h, size); await axeRun(page, `${f}${h} @${tag}`, out);
        if (f === 'queue.html' && h === '#/all') { await page.fill('#q-search', 'zzz'); await page.waitForTimeout(100); await axeRun(page, `queue no match @${tag}`, out); await page.fill('#q-search', ''); await page.selectOption('#q-tier', 'green'); await page.waitForTimeout(100); await axeRun(page, `queue tier filter @${tag}`, out); }
        await page.ctx.close();
      }
    }
  }
  log(`AXE states ${out.pages}, violations ${out.violations}, incomplete ${out.incomplete}, incomplete checked by hand (MOJ timeline line and badge; the floating keys list over the page) ${out.byHand}`);
  results.axe = out;
}

// ------------------------------------------------------------------ reflow at 320 px (WCAG 1.4.10)
async function reflow() {
  let n = 0, bad = 0;
  const views = [
    ['queue.html', ['#/all', '#/rework']], ['queue-later.html', ['#/rework']], ['queue-empty.html', ['']], ['queue-error.html', ['']], ['approved-red.html', ['']], ['approved-green.html', ['']], ['source-red.html', ['#n-6090:0']], ['signed-out.html', ['']], ['notes.html', ['']], ['index.html', ['']],
    ['red.html', ['#/brief', '#/brief/attest', '#/flags', '#/flags/01-F04', '#/flags/01-F04/error', '#/statements/n-6090', '#/statements/n-6170', '#/statements/n-6155/failed', '#/schedule-1', '#/capital', '#/disclosures', '#/approve', '#/comments', '#/comments/send/error', '#/history', '#/find/loan', '#/statements/n-6090/comment-error']],
    ['red-rework.html', ['#/brief', '#/changes', '#/comments']], ['red-gate.html', ['#/approve']], ['red-ready.html', ['#/approve']], ['red-preparer.html', ['#/brief', '#/flags']],
    ['green.html', ['#/brief', '#/disclosures', '#/comments', '#/approve']], ['green-ready.html', ['#/approve']], ['green-void.html', ['#/brief', '#/changes']], ['bluewater.html', ['#/brief']], ['scarborough.html', ['#/brief', '#/flags', '#/forms-not-placed', '#/approve']],
  ];
  for (const [f, routes] of views) {
    const page = await open(f, routes[0], [320, 640]);
    for (const r of routes) {
      if (r && /^(red|green|bluewater|scarborough)/.test(f)) await goHash(page, r);
      n++;
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth; const over = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest('[hidden]')) continue;
          const b = el.getBoundingClientRect(); if (b.width === 0 || b.height === 0) continue;
          if (b.right > vw + 1 || b.left < -1) {
            let p = el, scrollable = false; while ((p = p.parentElement)) { const cs = getComputedStyle(p); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && (p.getAttribute('aria-label') || p.getAttribute('aria-labelledby'))) { scrollable = true; break; } }
            if (!scrollable && !el.closest('.govuk-visually-hidden') && getComputedStyle(el).position !== 'absolute') over.push(el.tagName + '.' + String(el.className).slice(0, 40));
          }
        }
        return { sw: document.documentElement.scrollWidth, vw, over: [...new Set(over)].slice(0, 5) };
      });
      if (m.sw > m.vw + 1 || m.over.length) { bad++; fail(`reflow ${f}${r}: scrollWidth ${m.sw} > ${m.vw}; ${m.over.join(', ')}`); }
    }
    await page.ctx.close();
  }
  log(`REFLOW 320: ${n} views, ${bad} overflow`);
  results.reflow = { n, bad };
}

// ------------------------------------------------------------------ keyboard walk: every control reachable by Tab, focus visible and not covered (rule 11)
async function walk() {
  const out = { stops: 0, unreachable: 0, hidden: 0, nofocus: 0, views: 0 };
  const INSPECT = () => {
    const sel = 'a[href],button,input,select,textarea,summary,[tabindex="0"]';
    const everything = [...document.querySelectorAll('*')];
    const name = (e) => everything.indexOf(e) + ':' + e.tagName + ':' + (e.id || e.textContent.trim().slice(0, 24));
    const reachable = [...document.querySelectorAll(sel)].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden' && !e.closest('details:not([open]) > :not(summary)') && !e.classList.contains('govuk-skip-link') && e.tabIndex >= 0; });
    const seenGroup = new Set(); // a radio group is one tab stop; the other radios are reached by the arrow keys
    return reachable.filter((e) => { if (e.type === 'radio') { const g = e.name; if (seenGroup.has(g)) return false; seenGroup.add(g); } return true; }).map(name);
  };
  const VIEWS = [['red.html', '#/statements/n-6090'], ['red.html', '#/flags/01-F04'], ['red.html', '#/brief'], ['red.html', '#/comments'], ['red.html', '#/approve'], ['green-ready.html', '#/approve'], ['red-rework.html', '#/changes'], ['red-rework.html', '#/comments'], ['green-void.html', '#/brief'], ['red-preparer.html', '#/flags'], ['scarborough.html', '#/forms-not-placed'], ['queue.html', '#/all'], ['queue-error.html', ''], ['approved-red.html', ''], ['source-red.html', '#n-6090:0']];
  for (const [f, route] of VIEWS) {
    for (const size of SIZES) {
      const page = await open(f, route, size); out.views++;
      const want = await page.evaluate(INSPECT);
      const seen = new Set();
      for (let i = 0; i < 320; i++) {
        await page.keyboard.press('Tab');
        const s = await page.evaluate(() => {
          const e = document.activeElement; if (!e || e === document.body) return null; const b = e.getClientRects()[0] || e.getBoundingClientRect();
          const cs = getComputedStyle(e); const styled = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || e.matches(':focus-visible');
          const cx = Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 2), cy = Math.min(Math.max(b.top + Math.min(b.height / 2, 10), 1), innerHeight - 2);
          const top = document.elementFromPoint(cx, cy); const covered = !!top && !(e.contains(top) || top.contains(e));
          const everything = [...document.querySelectorAll('*')];
          return { key: everything.indexOf(e) + ':' + e.tagName + ':' + (e.id || e.textContent.trim().slice(0, 24)), styled, covered };
        });
        if (!s) continue;
        if (seen.has(s.key)) break;
        seen.add(s.key); out.stops++;
        if (s.covered) { out.hidden++; fail(`focus covered ${f}${route} @${size.join('x')}: ${s.key}`); }
        if (!s.styled) { out.nofocus++; fail(`no focus style ${f}${route} @${size.join('x')}: ${s.key}`); }
      }
      const miss = want.filter((k) => !seen.has(k));
      if (miss.length) { out.unreachable += miss.length; fail(`not reached by Tab ${f}${route} @${size.join('x')}: ${miss.slice(0, 6).join(' | ')}`); }
      await page.ctx.close();
    }
  }
  log(`WALK: ${out.stops} tab stops over ${out.views} views (${VIEWS.length} states at 2 sizes), ${out.unreachable} controls not reached, ${out.hidden} focused controls covered, ${out.nofocus} without a focus style`);
  results.walk = out;
}

// ------------------------------------------------------------------ budgets: loads, clicks, fields and time, against the table in the brief (rule 18)
async function budgets() {
  const rep = [];
  const B = (name, detail, cond) => { rep.push([name, detail, !!cond]); if (!cond) fail(`budget ${name}: ${detail}`); };
  for (const size of SIZES) {
    const tag = size.join('x');
    // ---- open a return from the queue: 1 load, 1 click, the first row whole on the first screen
    let page, loads = 0, t0 = 0;
    await sec(`budgets A @${tag}`, async () => {
    page = await open('queue.html', '', size);
    const q0 = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-q-table] tbody tr')].find((x) => !x.hidden).getBoundingClientRect(); const rows = [...document.querySelectorAll('[data-q-table] tbody tr')].filter((x) => !x.hidden).map((x) => x.getBoundingClientRect()); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, whole: rows.filter((x) => x.top >= 0 && x.bottom <= innerHeight).length }; });
    loads = 0; page.on('load', () => { loads++; });
    t0 = Date.now();
    await page.click('[data-q-open]:visible >> nth=0'); await page.waitForFunction(() => document.querySelector('[data-count-reviewed]') && document.querySelector('[data-count-reviewed]').textContent !== '');
    const dtOpen = Date.now() - t0;
    B(`open a return from the queue @${tag}`, `loads ${loads}, 1 click, ${dtOpen} ms (incl. tool overhead); first row ${q0.top} to ${q0.bottom} px in a ${q0.vh} px window, ${q0.whole} rows whole on the first screen`, loads === 1 && dtOpen < 2000 && q0.top >= 0 && q0.bottom <= q0.vh);
    await page.ctx.close();
    });
    // the rest of the budgets run on Maple Ridge (red, 9 flags, 4 accepted risks), opened directly
    await sec(`budgets A2 @${tag}`, async () => {
    page = await open('red.html', '#/brief', size); loads = 0; page.on('load', () => { loads++; });
    // ---- the brief on the first screen
    const fit = await page.evaluate(() => {
      const vh = innerHeight; const tiles = [...document.querySelectorAll('.app-tile')].map((e) => e.getBoundingClientRect()); const strip = document.querySelector('.app-brief .app-strip').getBoundingClientRect();
      const pane = document.querySelector('[data-list-body]'); const pb = pane.getBoundingClientRect(); const rows = [...document.querySelectorAll('[data-panel="brief"] [aria-label="Pinned flags"] tbody tr')].map((e) => e.getBoundingClientRect());
      const att = document.querySelector('#attest-h'); const tr = [...document.querySelectorAll('.app-changes tbody tr')]; const lastTop = tr.length ? tr[tr.length - 1].getBoundingClientRect().bottom : 0; const attList = document.querySelector('.app-att'); const attBottom = attList ? attList.getBoundingClientRect().bottom : 0;
      const need = Math.max(lastTop, attBottom) - pb.top + pane.scrollTop;
      const chg = document.querySelector('.app-changes'); const chTop = chg ? chg.getBoundingClientRect().top - pb.top + pane.scrollTop : 0;
      return { vh, tilesN: tiles.length, tilesBottom: Math.max(...tiles.map((t) => t.bottom)), tilesTop: Math.min(...tiles.map((t) => t.top)), strip: strip.bottom, firstFlagBottom: rows[0].bottom, firstFlagVisible: rows.filter((r) => r.bottom <= pb.bottom).length, paneH: Math.round(pb.height), paneBottom: Math.round(pb.bottom), docH: Math.round(document.querySelector('#main-content').getBoundingClientRect().bottom + window.scrollY), changesRows: tr.length, hasAtt: !!att, screens: Math.round((need / pb.height) * 10) / 10, changesAt: Math.round((chTop / pb.height) * 10) / 10, scrollH: pane.scrollHeight };
    });
    B(`the brief on the first screen @${tag}`, `six numbers end ${Math.round(fit.tilesBottom)} px (tier line ends ${Math.round(fit.strip)}), ${fit.firstFlagVisible} pinned flag rows whole, window ${fit.vh}, pane ${fit.paneH} px high, work area ends at ${fit.docH}; the ten changes (${fit.changesRows} rows) start ${fit.changesAt} and the attestations end ${fit.screens} pane heights down`, fit.tilesN === 6 && fit.tilesBottom <= fit.vh && fit.strip <= fit.vh && (size[0] !== 1366 || fit.firstFlagVisible >= 1) && fit.docH <= fit.vh + 1);
    results.briefScreens = results.briefScreens || {}; results.briefScreens[tag] = { end: fit.screens, changesAt: fit.changesAt, tilesBottom: Math.round(fit.tilesBottom), flagsWhole: fit.firstFlagVisible };
    // ---- open a number's source: 1 click, boxed figure in view, focus moved, no history entry, next and previous source
    await goHash(page, '#/statements'); loads = 0;
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-panel="stmt"] [data-row]')].map((r) => r.getAttribute('data-row')));
    const target = ids.filter((i) => /^n-6\d\d\d/.test(i))[2];
    const dt = await timed(page, clickSrc(`[data-row="${target}"] [data-pick]`), `!!document.querySelector('[data-source]:not([hidden]) [data-evidence]')`);
    const box = await inBox(page, '[data-source]:not([hidden]) [data-evidence]', '[data-source-body]');
    const foc = await page.evaluate(() => document.activeElement === document.querySelector('[data-source-body]'));
    B(`open a number's source @${tag}`, `loads ${loads}, 1 click, ${dt} ms to the boxed figure, figure in view ${box.inPane}, page scroll ${box.scrollY}, focus moved to the source ${foc}`, loads === 0 && dt >= 0 && dt < 1000 && box.inPane && foc && box.scrollY <= 8);
    const hist = await page.evaluate(() => history.length); await page.keyboard.press('Escape'); await page.click(`[data-row="${ids.filter((i) => /^n-6\d\d\d/.test(i))[3]}"] [data-pick]`); const hist2 = await page.evaluate(() => history.length);
    B(`history entries added by opening sources @${tag}`, `${hist2 - hist}`, hist2 === hist);
    const tn = await timed(page, keySrc(']'), `true`); const tp = await timed(page, keySrc('['), `true`);
    B(`next and previous source @${tag}`, `] ${tn} ms, [ ${tp} ms`, tn >= 0 && tn < 300 && tp >= 0 && tp < 300);
    // ---- next flag, previous flag, next number, a section, a tab: 0 loads, 1 click or key, under 0.2 s
    await goHash(page, '#/flags'); await page.waitForTimeout(100); const h0 = await hashOf(page);
    const tnf = await timed(page, keySrc('n'), `location.hash !== ${JSON.stringify(h0)}`); const h1 = await hashOf(page);
    const tpf = await timed(page, keySrc('p'), `location.hash !== ${JSON.stringify(h1)}`);
    const tm = await timed(page, keySrc('m'), `location.hash.indexOf('#/flags') !== 0`);
    const ts = await timed(page, `(function(){ var r = document.querySelector('.app-rail a[href="#/schedule-1"]'); if (r && r.getClientRects().length) r.click(); else { var s = document.querySelector('[data-section-pick]'); s.value = '#/schedule-1'; s.dispatchEvent(new Event('change', { bubbles: true })); } })()`, `location.hash.indexOf('#/schedule-1') === 0 && document.querySelector('#route-title').textContent === 'Schedule 1'`);
    const tt = await timed(page, clickSrc('[data-tab="comments"]'), `location.hash === '#/comments' && !document.querySelector('[data-view="comments"]').hidden`);
    B(`next flag, previous flag, next number, a section, a tab @${tag}`, `loads ${loads}, n ${tnf} ms, p ${tpf} ms, m ${tm} ms, section ${ts} ms, tab ${tt} ms`, loads === 0 && [tnf, tpf, tm, ts, tt].every((x) => x >= 0 && x < 200));
    // ---- Reviewed, next: 1 key, 0 loads
    await goHash(page, '#/schedule-1'); loads = 0; const trn = await timed(page, keySrc('r'), `location.hash.indexOf('#/schedule-1') !== 0`);
    B(`Reviewed, next @${tag}`, `1 key, loads ${loads}, ${trn} ms, now ${await hashOf(page)}`, loads === 0 && trn >= 0 && trn < 200);
    // ---- comment on a number: key c, type, severity, text, submit; 0 loads
    await goHash(page, '#/statements/n-6090'); const before = await txt(page, '[data-comment-count]'); t0 = Date.now(); loads = 0;
    await page.keyboard.press('c'); await page.click('label[for="type-0"]'); await page.click('label[for="severity-1"]'); await page.fill('#text', 'Please attach the receipts.'); await page.click('[data-comment-form] button.govuk-button');
    await page.waitForTimeout(80); const after = await txt(page, '[data-comment-count]'); const dtc = Date.now() - t0;
    B(`comment on a number @${tag}`, `loads ${loads}, 1 key + 3 fields + 1 submit, ${dtc} ms (incl. tool overhead), comments ${before} to ${after}`, loads === 0 && +after === +before + 1 && dtc < 10000);
    // ---- judge an accepted risk: accept (the field, Accept)
    await goHash(page, '#/flags/01-F01'); t0 = Date.now(); loads = 0; const j0 = await txt(page, '[data-flag-state="01-F01"]');
    await page.fill('#jr-01-F01', 'One client, but the owner names two more clients starting in April.'); await page.click('[data-judge-form="01-F01"] button.govuk-button'); await page.waitForTimeout(80);
    const j1 = await txt(page, '[data-flag-state="01-F01"]'); const dtj = Date.now() - t0;
    B(`judge an accepted risk: accept @${tag}`, `loads ${loads}, 1 field + Accept, ${dtj} ms (incl. tool overhead), "${j0}" to "${j1}"`, loads === 0 && j1 === 'Accepted' && dtj < 10000);
    // ---- judge by commenting instead
    await goHash(page, '#/flags/01-F03'); t0 = Date.now(); loads = 0;
    await page.click(`${TR} [data-judge-comment]`); await page.click('label[for="type-1"]'); await page.click('label[for="severity-0"]'); await page.fill('#text', 'Which loan is this repayment against?'); await page.click('[data-comment-form] button.govuk-button'); await page.waitForTimeout(80);
    const j2 = await txt(page, '[data-flag-state="01-F03"]'); const dtj2 = Date.now() - t0;
    B(`judge by commenting instead @${tag}`, `loads ${loads}, Comment instead + 3 fields + Add comment, ${dtj2} ms (incl. tool overhead), now "${j2}"`, loads === 0 && j2 === 'Commented instead' && dtj2 < 15000);
    await page.ctx.close();
    });
    // ---- approve, with everything done: 1 load, 1 click
    await sec(`budgets B @${tag}`, async () => {
    page = await open('green-ready.html', '#/brief', size); loads = 0; page.on('load', () => { loads++; });
    t0 = Date.now(); await page.click('[data-approve]'); await page.waitForSelector('.govuk-panel'); const dta = Date.now() - t0;
    B(`approve @${tag}`, `loads ${loads}, 1 click, ${dta} ms (incl. tool overhead)`, loads === 1 && dta < 2000);
    await page.ctx.close();
    });
    // ---- switch All and Back from rework: 0 loads, 1 click, own URL, filters kept
    await sec(`budgets C @${tag}`, async () => {
    page = await open('queue-later.html', '#/all', size); loads = 0; page.on('load', () => { loads++; });
    await page.fill('#q-search', 'ridge'); await page.waitForTimeout(60);
    const tv = await timed(page, clickSrc('[data-qview="rework"]'), `location.hash === '#/rework' && document.querySelector('[data-qview="rework"]').getAttribute('aria-current') === 'page'`);
    const kept = await page.evaluate(() => document.querySelector('#q-search').value);
    const tv2 = await timed(page, clickSrc('[data-qview="all"]'), `location.hash === '#/all'`);
    B(`switch All and Back from rework @${tag}`, `loads ${loads}, 1 click, ${tv} ms and ${tv2} ms, own URL, search "${kept}" kept`, loads === 0 && tv >= 0 && tv < 200 && tv2 >= 0 && tv2 < 200 && kept === 'ridge');
    await page.ctx.close();
    });
    // ---- resolve a comment after rework; why voided and what changed
    await sec(`budgets D @${tag}`, async () => {
    page = await open('red-rework.html', '#/comments', size); loads = 0; page.on('load', () => { loads++; });
    const r0 = await txt(page, '[data-count="resolved"]'); t0 = Date.now(); await page.click('[data-resolve] >> nth=0'); await page.waitForTimeout(60); const r1 = await txt(page, '[data-count="resolved"]'); const dtr = Date.now() - t0;
    B(`resolve a comment after rework @${tag}`, `loads ${loads}, 1 click, ${dtr} ms, "${r0}" to "${r1}"`, loads === 0 && r0 !== r1 && dtr < 2000);
    await page.ctx.close();
    page = await open('green-void.html', '#/brief', size); loads = 0; page.on('load', () => { loads++; });
    t0 = Date.now(); await page.click('.app-alert a'); await page.waitForFunction(() => !document.querySelector('[data-view="changes"]').hidden); const dtv = Date.now() - t0;
    B(`why voided, and what changed @${tag}`, `loads ${loads}, 1 click, ${dtv} ms, ${await hashOf(page)}`, loads === 0 && dtv < 2000);
    await page.ctx.close();
    });
    // ---- panes never stack; readable text; rows beside a pane
    await sec(`budgets E @${tag}`, async () => {
    page = await open('red.html', '#/statements/n-6090', size);
    const pn = await page.evaluate(() => [...document.querySelectorAll('.app-pane')].map((p) => { const b = p.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }));
    const stacked = new Set(pn.map((p) => p[1])).size > 1; B(`three panes side by side @${tag}`, `${JSON.stringify(pn)} stacked: ${stacked}`, !stacked);
    const doc = await page.evaluate(() => ({ h: Math.round(document.querySelector('#main-content').getBoundingClientRect().bottom + window.scrollY), vh: innerHeight, srcH: Math.round(document.querySelector('[data-source-body]').getBoundingClientRect().height), listH: Math.round(document.querySelector('[data-list-body]').getBoundingClientRect().height), traceH: Math.round(document.querySelector('[data-trace-body]').getBoundingClientRect().height) }));
    const rt = await page.evaluate(() => {
      const skip = '.govuk-tag,.moj-badge,.app-dot,.app-flagmark,.app-madeup,.app-madeup-note,button,kbd,.govuk-hint,.app-caption,.app-source__label,.app-pane__sub,.app-btngroup__label';
      const min = { body: 99, src: 99, bodyN: 0 }; const bad = new Map();
      for (const r of document.querySelectorAll('.app-pane__body')) {
        if (r.closest('[hidden]') || !r.getBoundingClientRect().width) continue;
        const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) {
          if (!n.textContent.trim()) continue; const e = n.parentElement; if (!e || e.closest('[hidden]') || e.closest('.govuk-visually-hidden') || !e.getBoundingClientRect().width) continue;
          const px = parseFloat(getComputedStyle(e).fontSize);
          if (e.closest('.app-source,.app-card,.app-sheet,.app-entry')) { min.src = Math.min(min.src, px); continue; }
          if (e.closest(skip)) continue;
          min.body = Math.min(min.body, px); min.bodyN++; if (px < 16) bad.set(e.tagName + '.' + String(e.className).slice(0, 30), px);
        }
      }
      const b = document.querySelector('[data-list-body]').getBoundingClientRect();
      const rows = [...document.querySelectorAll('[data-panel="stmt"] tr[data-row]')].filter((r) => { const x = r.getBoundingClientRect(); return x.top >= b.top - 1 && x.bottom <= b.bottom + 1; }).length;
      return { min, bad: [...bad].slice(0, 6), rows, listH: Math.round(b.height) };
    });
    B(`readable text and rows beside a pane @${tag}`, `smallest body text ${rt.min.body} px over ${rt.min.bodyN} text nodes (offenders ${JSON.stringify(rt.bad)}), smallest source text ${rt.min.src} px, ${rt.rows} number rows whole in a ${rt.listH} px list pane`, rt.min.body >= 16 && rt.min.src >= 12);
    B(`record page height @${tag}`, `page ${doc.h} px for a ${doc.vh} px window; list pane ${doc.listH} px, trace pane ${doc.traceH} px, source pane ${doc.srcH} px`, doc.h <= doc.vh + 1);
    await page.ctx.close();
    });
  }
  rep.forEach((r) => log('BUDGET', r[2] ? 'ok  ' : 'FAIL', r[0], '|', r[1]));
  results.budgets = rep;
}

// ------------------------------------------------------------------ the task scripts of the brief, clicked through (tasks 1 to 10, CP1 to CP16)
async function tasks() {
  const T = results.tasks;
  for (const size of SIZES) {
    const tag = size.join('x');
    const L = (m) => `${m} @${tag}`;
    let page, loads = 0;
    // ---- task 1: the queue (V15, CP8)
    await sec(L('task 1'), async () => {
    page = await open('queue.html', '#/all', size);
    const q = await page.evaluate(() => { const tbl = document.querySelector('[data-q-table]'); if (!tbl) return { missing: `${document.title} | ${location.href} | ${document.readyState} | ${document.body ? document.body.innerHTML.length : 'no body'}`, n: 0, heads: [], sorted: [], order: '', first: '', count: '', caption: '' }; const heads = [...tbl.querySelectorAll('thead th')].map((h) => h.textContent.trim()); const rows = [...tbl.querySelectorAll('tbody tr')]; return { heads, n: rows.length, sorted: [...tbl.querySelectorAll('thead th')].filter((h) => h.getAttribute('aria-sort') === 'ascending' || h.getAttribute('aria-sort') === 'descending').map((h) => h.textContent.trim()), order: document.getElementById('q-order').textContent, first: rows[0].textContent.replace(/\s+/g, ' ').trim(), count: document.querySelector('[data-q-count]').textContent, caption: tbl.querySelector('caption').textContent }; });
    chk(T, L('task 1 the queue lists ten returns with the columns of the brief'), q.n === 10 && /\(10\)/.test(q.caption) && ['Return', 'Year end', 'Tier and why', 'Filing due', 'Balance due', 'Preparer who signed', 'Round', 'Waiting'].every((h) => q.heads.some((x) => x.startsWith(h))), q.missing || q.heads.join(' | '));
    chk(T, L('task 1 default order is stated and the first row is the overdue one'), /overdue first, then tier/.test(q.order) && /Overdue/.test(q.first) && q.sorted.length === 1, `${q.order} | sorted by ${q.sorted.join(',')} | first: ${q.first.slice(0, 90)}`);
    chk(T, L('task 1 the count says "N returns waiting"'), /^10 returns waiting\.$/.test(q.count), q.count);
    await page.fill('#q-search', 'queen'); await page.waitForTimeout(80); const c1 = await txt(page, '[data-q-count]');
    chk(T, L('task 1 search by name narrows the list and the count says so'), /^1 return shown of 10 waiting\.$/.test(c1), c1);
    await page.fill('#q-search', ''); await page.selectOption('#q-tier', 'green'); await page.waitForTimeout(80); const c2 = await txt(page, '[data-q-count]');
    chk(T, L('task 1 the tier filter narrows the list'), /shown of 10 waiting/.test(c2), c2);
    await page.selectOption('#q-tier', ''); await page.fill('#q-search', 'zzzz'); await page.waitForTimeout(80);
    chk(T, L('task 1 no match says so and how to get back'), (await vis(page, '[data-q-empty]')) && /No returns match/.test(await txt(page, '[data-q-empty-title]')), await txt(page, '[data-q-empty]'));
    await page.click('[data-q-clear]'); await page.waitForTimeout(60);
    chk(T, L('task 1 clear filters brings every row back and focuses the search'), (await txt(page, '[data-q-count]')) === '10 returns waiting.' && (await page.evaluate(() => document.activeElement.id)) === 'q-search');
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('s'); chk(T, L('task 1 key s focuses the search'), (await page.evaluate(() => document.activeElement.id)) === 'q-search');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement.blur());
    await page.click('[data-qview="rework"]'); await page.waitForTimeout(80);
    const qr = await page.evaluate(() => ({ h: location.hash, rows: [...document.querySelectorAll('[data-q-table] tbody tr')].filter((r) => !r.hidden).length, count: document.querySelector('[data-q-count]').textContent, cur: document.querySelector('[data-qview="rework"]').getAttribute('aria-current') }));
    chk(T, L('task 1 Back from rework is its own URL and lists the two returns the preparers have sent back'), qr.h === '#/rework' && qr.rows === 2 && qr.count === '2 returns back from rework.' && qr.cur === 'page', JSON.stringify(qr));
    await page.fill('#q-search', 'zzzz'); await page.waitForTimeout(80);
    chk(T, L('task 1 no match inside Back from rework says "No returns match"'), (await vis(page, '[data-q-empty]')) && /No returns match/.test(await txt(page, '[data-q-empty-title]')), await txt(page, '[data-q-empty]'));
    await page.ctx.close();
    page = await open('queue-empty.html', '', size);
    chk(T, L('task 1 empty: nothing waiting says so and that there is nothing to do'), (await vis(page, '[data-q-none="all"]')) && !(await vis(page, '[data-q-none="rework"]')) && !(await vis(page, '[data-q-table]')) && /No returns are waiting for your review/.test(await txt(page, '[data-q-none="all"]')) && /Nothing to do now/.test(await txt(page, '[data-q-none="all"]')), await txt(page, '[data-q-none="all"]'));
    await page.click('[data-qview="rework"]'); await page.waitForTimeout(80);
    chk(T, L('task 1 empty: Back from rework says no returns are back and keeps its own URL'), (await hashOf(page)) === '#/rework' && (await vis(page, '[data-q-none="rework"]')) && !(await vis(page, '[data-q-none="all"]')) && /No returns are back from rework/.test(await txt(page, '[data-q-none="rework"]')), await txt(page, '[data-q-none="rework"]'));
    await page.ctx.close();
    page = await open('queue-error.html', '', size);
    chk(T, L('task 1 error: the summary says what happened, that nothing was lost, and offers Try again'), (await vis(page, '.govuk-error-summary')) && /could not be loaded/.test(await txt(page, '.govuk-error-summary')) && /No return was changed or lost/.test(await txt(page, 'main')) && (await vis(page, '#retry')) && !(await vis(page, '[data-q-table]')), (await txt(page, '.govuk-error-summary')).slice(0, 120));
    await page.ctx.close();
    page = await open('queue-later.html', '#/rework', size);
    const ql = await page.evaluate(() => ({ rows: [...document.querySelectorAll('[data-q-table] tbody tr')].filter((r) => !r.hidden).map((r) => r.querySelector('th').textContent.trim() + ' / ' + r.getAttribute('data-q-round')), count: document.querySelector('[data-q-count]').textContent, badge: document.querySelector('[data-qview="rework"] .moj-badge') ? document.querySelector('[data-qview="rework"] .moj-badge').textContent.trim() : '' }));
    chk(T, L('task 1 later the same day: Back from rework lists three returns, Maple Ridge among them'), ql.rows.length === 3 && ql.rows.some((r) => /Maple Ridge/.test(r)) && /^3 returns back from rework\.$/.test(ql.count) && /^3/.test(ql.badge), JSON.stringify(ql));
    loads = 0; page.on('load', () => { loads++; });
    await page.click('tr[data-q-name^="maple"] [data-q-open]'); await page.waitForFunction(() => document.querySelector('[data-count-reviewed]') && document.querySelector('[data-count-reviewed]').textContent !== '');
    chk(T, L('task 1 open it: one load, then the identity bar shows Back to the queue'), loads === 1 && (await page.evaluate(() => document.querySelector('[data-queue-back]').getAttribute('href'))) === 'queue-later.html#/rework', `loads ${loads}, back to ${await page.evaluate(() => document.querySelector('[data-queue-back]').getAttribute('href'))}`);
    await page.click('[data-queue-back]'); await page.waitForTimeout(200);
    chk(T, L('task 1 Back returns to the same view'), (await hashOf(page)) === '#/rework' && page.url().includes('queue-later.html'), page.url());
    await page.ctx.close();
    // previous and next follow the list; the queue keeps its filter
    page = await open('queue.html', '#/all', size); await page.fill('#q-search', 'o'); await page.waitForTimeout(100);
    const names = await page.evaluate(() => [...document.querySelectorAll('[data-q-table] tbody tr')].filter((r) => !r.hidden).map((r) => r.querySelector('th').textContent.trim()));
    await page.click('[data-q-open] >> nth=0'); await page.waitForFunction(() => document.querySelector('[data-count-reviewed]') && document.querySelector('[data-count-reviewed]').textContent !== '');
    const nx = await page.evaluate(() => ({ next: !document.querySelector('[data-queue-next]').hidden, prev: !document.querySelector('[data-queue-prev]').hidden }));
    chk(T, L('task 1 next return follows the filtered list; no previous on the first'), nx.next && !nx.prev, JSON.stringify(nx) + ' ' + names.length + ' rows listed');
    await page.click('[data-queue-back]'); await page.waitForTimeout(200);
    chk(T, L('task 1 Back keeps the search'), (await page.evaluate(() => document.querySelector('#q-search').value)) === 'o', await page.evaluate(() => document.querySelector('#q-search').value));
    await page.ctx.close();
    });

    // ---- task 2: read the brief (RV-2, V02, CP6, CP7)
    await sec(L('task 2'), async () => {
    page = await open('red.html', '#/brief', size);
    const b = await page.evaluate(() => { const p = document.querySelector('[data-panel="brief"]'); return { tiles: [...p.querySelectorAll('.app-tile')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()), tier: p.querySelector('.app-strip').textContent.replace(/\s+/g, ' ').trim(), flags: p.querySelectorAll('[aria-label="Pinned flags"] tbody tr').length, flagHeads: [...p.querySelectorAll('[aria-label="Pinned flags"] thead th')].map((h) => h.textContent.trim()), judge: [...p.querySelectorAll('[data-flag-state]')].length, changes: p.querySelectorAll('.app-changes tbody tr').length, news: /New this year \(\d+\)/.test(p.textContent), gone: /Gone since last year \(\d+\)/.test(p.textContent), att: p.querySelectorAll('.app-att > li').length, attNot: [...p.querySelectorAll('.app-att > li')].filter((l) => /Not met/.test(l.textContent)).length, assumptions: /Assumptions and client decisions \(\d+\)/.test(p.textContent), accTags: [...p.querySelectorAll('.govuk-tag')].filter((t) => /Accepted risk/i.test(t.textContent)).length }; });
    chk(T, L('task 2 six numbers against last year with their states'), b.tiles.length === 6 && b.tiles.every((t) => /Last year|No prior year/.test(t)) && b.tiles.some((t) => /Not confirmed in Taxprep yet/.test(t)), b.tiles.map((t) => t.slice(0, 60)).join(' || '));
    chk(T, L('task 2 tier in words with why, dates'), /Red tier/.test(b.tier) && /Filing due/.test(b.tier) && /balance due/.test(b.tier), b.tier.slice(0, 200));
    chk(T, L('task 2 pinned flags carry dollar effect, tax effect, the preparer answer and the CPA judgment'), b.flags === 9 && b.flagHeads.length === 5 && /judgment/.test(b.flagHeads[4]) && b.judge === 9 && b.accTags === 4, `${b.flags} flags, heads ${b.flagHeads.join(' | ')}, ${b.judge} judgment cells, ${b.accTags} accepted-risk tags`);
    chk(T, L('task 2 just below: ten largest changes, new and gone, assumptions, three attestations with what remains'), b.changes === 10 && b.news && b.gone && b.assumptions && b.att === 3 && b.attNot >= 1, `${b.changes} change rows, ${b.att} attestations (${b.attNot} not met)`);
    await page.click('a[href="#/brief/attest"]'); await page.waitForTimeout(150);
    chk(T, L('task 2 the attestation link moves focus to the attestations heading'), (await page.evaluate(() => document.activeElement.id)) === 'attest-h', await active(page));
    await page.ctx.close();
    page = await open('scarborough.html', '#/brief', size);
    const sc = await page.evaluate(() => ({ tiles: [...document.querySelectorAll('.app-tile')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()), none: /No prior year to compare/.test(document.querySelector('[data-panel="brief"]').textContent), flags: document.querySelectorAll('[aria-label="Pinned flags"] tbody tr').length, acc: [...document.querySelectorAll('[aria-label="Pinned flags"] .govuk-tag')].filter((t) => /Accepted risk/i.test(t.textContent)).length, count: document.querySelector('[data-count="reviewed"]').textContent.replace(/\s+/g, ' ').trim() }));
    chk(T, L('task 2 first year: no prior year, with the reason, and no changes to rank (many accepted risks)'), sc.tiles.filter((t) => /No prior year \(first year\)/.test(t)).length >= 5 && sc.none && sc.acc === 5 && /of 12 sections Reviewed/.test(sc.count), `${sc.flags} flags, ${sc.acc} accepted, ${sc.count}`);
    await page.ctx.close();
    page = await open('bluewater.html', '#/brief', size);
    chk(T, L('task 2 overdue is in words on the brief'), /Filing overdue/.test(await txt(page, '.app-strip')) && /Filing overdue/.test(await txt(page, '[data-identity-bar]')), (await txt(page, '.app-strip')).slice(0, 120));
    await page.ctx.close();
    });

    // ---- task 3: judge the flags (EX-1, V03, CP2, CP3, CP4, CP5)
    await sec(L('task 3'), async () => {
    page = await open('red.html', '#/brief', size);
    const D = await DATA(page); const acc = D.flags.filter((f) => f.kind === 'accepted').map((f) => f.id);
    await page.click('[data-primary]'); await page.waitForTimeout(120);
    chk(T, L('task 3 "Start review: Flags" opens the first flag, red first'), (await hashOf(page)).startsWith('#/flags/' + D.flags[0].id) && (await selRow(page)) === D.flags[0].id, await hashOf(page));
    const f1 = await page.evaluate(() => { const t = document.querySelector('[data-trace]:not([hidden])'); return { text: t.textContent.replace(/\s+/g, ' '), form: !!t.querySelector('[data-judge-form]'), src: !!document.querySelector('[data-source]:not([hidden]) .app-caption') && /Cited evidence/.test(document.querySelector('[data-source]:not([hidden]) .app-caption').textContent) }; });
    chk(T, L('task 3 an accepted risk shows what the preparer did apart from what you did, its cited evidence, and the judgment form'), /Preparer/.test(f1.text) && /Accepted risk: left for you to judge/.test(f1.text) && /You ?Not judged/.test(f1.text) && f1.form && f1.src, f1.text.slice(0, 400));
    await page.click(`${TR} [data-judge-form] button.govuk-button`); await page.waitForTimeout(100);
    const e1 =await page.evaluate(() => ({ summary: !document.querySelector('[data-jes]').hidden, active: document.activeElement.hasAttribute('data-jes'), title: document.title, link: document.querySelector('[data-jes] a').getAttribute('href') }));
    chk(T, L('task 3 an empty judgment shows the error pattern inside the form and focuses its summary'), e1.summary && e1.active && /^Error: /.test(e1.title) && /^#jr-/.test(e1.link), JSON.stringify(e1));
    await page.fill(`#jr-${acc[0]}`, 'One client, but the owner names two more clients starting in April.'); await page.click(`${TR} [data-judge-form] button.govuk-button`); await page.waitForTimeout(120);
    const e2 = await page.evaluate(() => ({ title: document.title, sel: document.querySelector('[data-row].is-selected').getAttribute('data-row'), foc: document.activeElement.hasAttribute('data-pick'), live: document.getElementById('app-live').textContent, st: document.querySelector('[data-flag-state]').textContent }));
    chk(T, L('task 3 Accept records the judgment, moves to the next unjudged accepted risk and says so'), !/^Error: /.test(e2.title) && e2.sel === acc[1] && e2.foc && /judged: accepted/.test(e2.live) && /3 accepted risks left/.test(e2.live), JSON.stringify(e2));
    chk(T, L('task 3 the list shows the state in words next to each flag'), (await page.evaluate(() => [...document.querySelectorAll('[data-panel="flags"] [data-flag-state]')].map((e) => e.textContent).join(',')))
      .split(',').filter((x) => x === 'Accepted').length === 1, await page.evaluate(() => [...document.querySelectorAll('[data-panel="flags"] [data-flag-state]')].map((e) => e.textContent).join(',')));
    await page.click(`${TR} [data-judge-comment]`); await page.waitForTimeout(100);
    const cp =await page.evaluate(() => ({ open: !!document.querySelector('[data-comment-host] form'), note: document.querySelector('.app-cp__note').textContent, sev: [...document.querySelectorAll('input[name=severity]')].map((i) => i.value).join('/'), typ: [...document.querySelectorAll('input[name=type]')].map((i) => i.value).join('/'), foc: document.activeElement.id }));
    chk(T, L('task 3 Comment instead opens the panel with type and the three severities; it says it counts as the judgment'), cp.open && cp.sev === 'Must fix/Should fix/Note' && cp.typ === 'Error/Question/Missing evidence/Presentation' && /also counts as your judgment of/.test(cp.note) && cp.foc === 'type-0', JSON.stringify(cp));
    await page.click('label[for="type-1"]'); await page.click('label[for="severity-0"]'); await page.fill('#text', 'Which loan is this repayment against?'); await page.click('[data-comment-form] button.govuk-button'); await page.waitForTimeout(120);
    const e3 = await page.evaluate((id) => ({ st: document.querySelector(`[data-panel="flags"] [data-flag-state="${id}"]`).textContent, n: document.querySelector('[data-comment-count]').textContent, foc: document.activeElement.hasAttribute('data-pick'), live: document.getElementById('app-live').textContent }), acc[1]);
    chk(T, L('task 3 commenting instead is the judgment, and the comment count moves'), e3.st === 'Commented instead' && e3.n === '5' && e3.foc && /This is your judgment of/.test(e3.live), JSON.stringify(e3));
    // the other two: n and p step the flags; the judged state can be changed
    await page.keyboard.press('Escape'); await goHash(page, '#/flags/' + acc[0]); await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('n'); await page.waitForTimeout(100); const st1 = await selRow(page);
    await page.keyboard.press('p'); await page.waitForTimeout(100); const st2 = await selRow(page);
    chk(T, L('task 3 n and p step the flags and focus the row'), st1 === D.flags[1].id && st2 === D.flags[0].id && (await onRow(page)) === D.flags[0].id, `${st1} then ${st2}`);
    await page.click(`${TR} [data-judge-change]`); await page.waitForTimeout(80);
    chk(T, L('task 3 "Change my judgment" opens the form with the old reason and focuses it'), (await page.evaluate((id) => document.activeElement.id === 'jr-' + id && document.activeElement.value.length > 10, acc[0])), await active(page));
    await page.ctx.close();
    });

    // ---- task 3, sorting (rule 6): the flags lists are MOJ sortable tables (more than 5 rows); the default order is stated; n and p follow the list as sorted
    await sec(L('task 3 sort'), async () => {
    page = await open('red.html', '#/brief', size);
    const bs = await page.evaluate(() => { const t = document.querySelector('[aria-label="Pinned flags"] table'); return { module: t.getAttribute('data-module'), heads: [...t.querySelectorAll('thead th')].map((h) => (h.getAttribute('aria-sort') || '-') + ':' + h.textContent.trim()), buttons: t.querySelectorAll('thead th button').length, cap: t.querySelector('caption').textContent.replace(/\s+/g, ' ').trim() }; });
    chk(T, L('task 3 the pinned flags are an MOJ sortable table: every column sorts, the default is red first then dollar effect, stated in the caption'), bs.module === 'moj-sortable-table' && bs.buttons === 5 && /^ascending:Flag/.test(bs.heads[0]) && /red first, then dollar effect \(9\)/.test(bs.cap), JSON.stringify(bs));
    const firstRow = () => page.evaluate(() => document.querySelector('[aria-label="Pinned flags"] tbody tr').textContent.replace(/\s+/g, ' ').trim());
    const f0 = await firstRow();
    await page.click('[aria-label="Pinned flags"] thead th:nth-child(2) button'); await page.waitForTimeout(80);
    const f1 = await firstRow(); const sorted1 = await page.evaluate(() => document.querySelector('[aria-label="Pinned flags"] thead th:nth-child(2)').getAttribute('aria-sort'));
    await page.click('[aria-label="Pinned flags"] thead th:nth-child(2) button'); await page.waitForTimeout(80);
    const f2 = await firstRow(); const sorted2 = await page.evaluate(() => document.querySelector('[aria-label="Pinned flags"] thead th:nth-child(2)').getAttribute('aria-sort'));
    chk(T, L('task 3 sorting the pinned flags by dollar effect reorders them in place, in both directions, and says which way'), /^F01/.test(f0) && sorted1 === 'ascending' && /^F04/.test(f1) && sorted2 === 'descending' && /^F01/.test(f2), `${f0.slice(0, 50)} | ${f1.slice(0, 50)} | ${f2.slice(0, 50)}`);
    await page.ctx.close();
    page = await open('red.html', '#/flags', size);
    const ls = await page.evaluate(() => { const t = document.querySelector('[data-panel="flags"] table'); return { module: t.getAttribute('data-module'), heads: [...t.querySelectorAll('thead th')].map((h) => (h.getAttribute('aria-sort') || '-') + ':' + h.textContent.trim()), buttons: t.querySelectorAll('thead th button').length, rows: [...t.querySelectorAll('tbody tr')].map((r) => r.getAttribute('data-row')) }; });
    chk(T, L('task 3 the Flags list is an MOJ sortable table with its default order red first, then dollar effect'), ls.module === 'moj-sortable-table' && ls.buttons === 3 && /^ascending:Flag/.test(ls.heads[0]) && ls.rows[0] === '01-F01' && ls.rows[3] === '01-F04' && ls.rows[8] === '01-F06', JSON.stringify(ls));
    await page.click('[data-panel="flags"] thead th:nth-child(2) button'); await page.waitForTimeout(100);
    const ord = await page.evaluate(() => [...document.querySelectorAll('[data-panel="flags"] tbody tr')].map((r) => r.getAttribute('data-row')));
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('n'); await page.waitForTimeout(100); const n1 = await selRow(page);
    await page.keyboard.press('n'); await page.waitForTimeout(100); const n2 = await selRow(page);
    await page.keyboard.press('p'); await page.waitForTimeout(100); const n3 = await selRow(page);
    chk(T, L('task 3 after sorting by dollar effect, n and p follow the list on screen'), ord[0] === '01-F04' && ord[8] === '01-F01' && n1 === ord[0] && n2 === ord[1] && n3 === ord[0], `${ord.join(',')} then ${n1}, ${n2}, ${n3}`);
    await page.click('[data-panel="flags"] thead th:nth-child(3) button'); await page.waitForTimeout(100);
    const st = await page.evaluate(() => [...document.querySelectorAll('[data-panel="flags"] tbody tr')].map((r) => (r.querySelector('[data-flag-state]') || {}).textContent));
    chk(T, L('task 3 the judgment column sorts too, by the words shown'), st.length === 9 && JSON.stringify(st) === JSON.stringify([...st].sort((a, b) => a.localeCompare(b))) && new Set(st).size === 2, st.join(','));
    await page.ctx.close();
    });

    // ---- task 4: walk the return (CP9): reviewed, next; empty, printed and unplaced sections
    await sec(L('task 4'), async () => {
    page = await open('green.html', '#/disclosures', size);
    const em = await page.evaluate(() => ({ text: document.querySelector('[data-panel="disc"]').textContent.replace(/\s+/g, ' '), btn: !!document.querySelector('[data-reviewed-next]'), layout: document.querySelector('[data-panes]').getAttribute('data-layout') }));
    chk(T, L('task 4 a section with nothing in this return says so and still needs its mark'), /Nothing in this return for this section/.test(em.text) && /still needs its mark/.test(em.text) && em.btn && em.layout === 'wide', em.text.slice(0, 160));
    const cnt0 = +(await txt(page, '[data-count-reviewed]')); await page.click('[data-reviewed-next]'); await page.waitForTimeout(120);
    chk(T, L('task 4 Reviewed, next marks the section and moves to the next'), +(await txt(page, '[data-count-reviewed]')) === cnt0 + 1 && (await hashOf(page)).startsWith('#/payment'), `${cnt0} to ${await txt(page, '[data-count-reviewed]')}, ${await hashOf(page)}`);
    await page.ctx.close();
    page = await open('red.html', '#/capital', size);
    const pr = await page.evaluate(() => { const first = document.querySelector('[data-panel="cap"] [data-page]:not([hidden]) .app-caption'); return { pages: document.querySelectorAll('[data-panel="cap"] [data-page]').length, shown: [...document.querySelectorAll('[data-panel="cap"] [data-page]')].filter((p) => !p.hidden).length, caption: first ? first.textContent : '', next: !!document.querySelector('[data-panel="cap"] [data-page-next]') }; });
    chk(T, L('task 4 a schedule not drawn as a view shows the printed return pages, one at a time, with Next page'), pr.pages >= 2 && pr.shown === 1 && /Printed return, page/.test(pr.caption) && pr.next, JSON.stringify(pr));
    await page.click('[data-panel="cap"] [data-page-next]'); await page.waitForTimeout(80);
    chk(T, L('task 4 Next page shows the next printed page and says which'), (await page.evaluate(() => [...document.querySelectorAll('[data-panel="cap"] [data-page]')].findIndex((p) => !p.hidden))) === 1 && /page 2 of/.test(await live(page)), await live(page));
    await page.ctx.close();
    page = await open('scarborough.html', '#/forms-not-placed', size);
    const un = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-panel="unplaced"] tbody tr').length, text: document.querySelector('[data-panel="unplaced"]').textContent.replace(/\s+/g, ' '), rail: document.querySelectorAll('[data-rail]').length, pick: document.querySelector('[data-section-pick]').options.length }));
    chk(T, L('task 4 forms the file does not place are named and need a mark (12th section)'), un.rows === 2 && /form not placed: /.test(un.text) && un.pick === 14, JSON.stringify({ rows: un.rows, pick: un.pick }));
    await page.ctx.close();
    page = await open('red.html', '#/flags', size);
    await page.evaluate(() => document.activeElement.blur()); const m0 = await hashOf(page); await goHash(page, '#/statements'); await page.keyboard.press('m'); await page.waitForTimeout(100);
    const mm = await selRow(page); await goHash(page, '#/payment'); const lastRow = await page.evaluate(() => [...document.querySelectorAll('[data-panel="pay"] [data-row]')].pop().getAttribute('data-row')); await page.click(`[data-row="${lastRow}"] [data-pick]`); await page.keyboard.press('m'); await page.waitForTimeout(100);
    chk(T, L('task 4 m steps to the next number and says when it is the last'), !!mm && /This is the last number/.test(await live(page)), `${m0} then ${mm}; ${await live(page)}`);
    await page.ctx.close();
    });

    // ---- task 5: check one number (RV-4); keys n p m ] [ o and the second window words
    await sec(L('task 5'), async () => {
    page = await open('red.html', '#/statements', size); loads = 0; page.on('load', () => { loads++; });
    await page.click('[data-row="n-6095"] [data-pick]'); await page.waitForTimeout(150);
    const s5 = await page.evaluate(() => { const h = document.querySelector('[data-source]:not([hidden]) [data-evidence]'); const bx = document.querySelector('[data-source-body]').getBoundingClientRect(); const r = h && h.getBoundingClientRect(); return { hit: !!r, inView: !!r && r.top >= bx.top - 1 && r.bottom <= bx.bottom + 1, focusSource: document.activeElement === document.querySelector('[data-source-body]'), scrollY, trace: !!document.querySelector('[data-trace="n-6095"]:not([hidden])'), cap: document.querySelector('[data-source]:not([hidden]) .app-caption').textContent, win: document.querySelector('[data-source-win]').textContent }; });
    chk(T, L('task 5 pick a number: source beside it, figure boxed and in view, focus in the source, no page scroll'), loads === 0 && s5.hit && s5.inView && s5.focusSource && s5.trace && s5.scrollY <= 8, JSON.stringify(s5));
    chk(T, L('task 5 the second window is off by default and the words say so'), s5.win === 'Second window: off', s5.win);
    await page.keyboard.press('Escape'); await page.waitForTimeout(60); const back = await onRow(page);
    chk(T, L('task 5 Escape returns to the number'), back === 'n-6095', `focus on ${back}`);
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('m'); await page.waitForTimeout(100);
    chk(T, L('task 5 m moves to the next number: source follows, focus on the row'), (await selRow(page)) !== 'n-6095' && (await onRow(page)) === (await selRow(page)), await selRow(page));
    const cap1 = await txt(page, '[data-source]:not([hidden]) .app-caption'); await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press(']'); await page.waitForTimeout(100); const cap2 = await txt(page, '[data-source]:not([hidden]) .app-caption'); await page.keyboard.press('['); await page.waitForTimeout(100); const cap3 = await txt(page, '[data-source]:not([hidden]) .app-caption');
    const nsrc = await page.evaluate(() => +document.querySelector(`[data-srcset="${document.querySelector('[data-row].is-selected').getAttribute('data-row')}"]`).getAttribute('data-count'));
    chk(T, L('task 5 ] and [ step the sources (focus in the source) or say there is one'), nsrc < 2 ? /source 1 of 1/.test(cap1) : cap1 !== cap2 && cap3 === cap1, `${cap1} | ${cap2} | ${cap3}`);
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('o'); await page.waitForTimeout(100);
    chk(T, L('task 5 o with the second window off focuses the source and says how to turn the window on'), (await page.evaluate(() => document.activeElement === document.querySelector('[data-source-body]'))) && /Open in a second window/.test(await live(page)), await live(page));
    await goHash(page, '#/statements/n-6170'); const ne = await page.evaluate(() => ({ t: document.querySelector('[data-srcset]:not([hidden]) .app-card').textContent.replace(/\s+/g, ' '), btn: !!document.querySelector('[data-srcset]:not([hidden]) [data-comment-kind]') }));
    chk(T, L('task 5 a number with no evidence says so (CK-2) and offers a missing-evidence comment'), /Not checked: no evidence/.test(ne.t) && ne.btn, ne.t.slice(0, 120));
    await page.ctx.close();
    });

    // ---- task 6: comment (RV-7, CP5)
    await sec(L('task 6'), async () => {
    page = await open('red.html', '#/statements/n-6090', size); loads = 0; page.on('load', () => { loads++; });
    const c0 = +(await txt(page, '[data-comment-count]'));
    await page.keyboard.press('c'); await page.waitForTimeout(120);
    const pan = await page.evaluate(() => { const p = document.querySelector('[data-comment-host]').getBoundingClientRect(); const tr = document.querySelector('.app-pane--trace').getBoundingClientRect(); const so = document.querySelector('.app-pane--source').getBoundingClientRect(); const bt = document.querySelector('.app-cp [data-primary]').getBoundingClientRect(); return { covers: p.left <= tr.left + 1 && p.right >= so.right - 1, btnInView: bt.bottom <= innerHeight && bt.top >= 0, caption: document.querySelector('[data-cp-caption]').textContent, fields: document.querySelectorAll('.app-cp [data-g]').length, inner: (b => b.scrollHeight > b.clientHeight + 1)(document.querySelector('.app-cp__body')), foc: document.activeElement.id, w: Math.round(p.width), h: Math.round(p.height) }; });
    chk(T, L('task 6 the panel opens in place over trace and source: three fields, Add comment in view, caption of the source, focus in the first field'), pan.covers && pan.btnInView && pan.fields === 3 && !pan.inner && /^Source: /.test(pan.caption) && pan.foc === 'type-0', JSON.stringify(pan));
    await page.click('[data-comment-form] button.govuk-button'); await page.waitForTimeout(100);
    const er = await page.evaluate(() => ({ items: [...document.querySelectorAll('[data-es-list] a')].map((a) => a.textContent), foc: document.activeElement.hasAttribute('data-es'), title: document.title }));
    chk(T, L('task 6 nothing chosen: the error summary lists type, severity and text, and the title starts "Error: "'), er.items.length === 3 && er.foc && /^Error: /.test(er.title), JSON.stringify(er.items));
    await page.click('label[for="type-0"]'); await page.click('label[for="severity-1"]'); await page.fill('#text', 'Please attach the receipts.'); await page.click('[data-comment-form] button.govuk-button'); await page.waitForTimeout(150);
    const cmt = await page.evaluate(() => ({ n: +document.querySelector('[data-comment-count]').textContent, listed: document.querySelector('[data-trace="n-6090"] [data-notes]').textContent.includes('Please attach'), row: document.activeElement.hasAttribute('data-pick'), closed: !document.querySelector('[data-comment-host]').hasAttribute('data-open'), scrollY, title: document.title, sev: /Error, Should fix/.test(document.querySelector('[data-trace="n-6090"] [data-notes]').textContent) }));
    chk(T, L('task 6 submit: the comment count and the trace list it with type and severity, focus back on the row, 0 loads, no scroll'), cmt.n === c0 + 1 && cmt.listed && cmt.sev && cmt.row && cmt.closed && loads === 0 && cmt.scrollY <= 8 && !/^Error: /.test(cmt.title), JSON.stringify(cmt));
    await goHash(page, '#/comments');
    const cl = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-comments-list] tbody tr').length, badge: +document.querySelector('[data-comment-count]').textContent, heads: [...document.querySelectorAll('[data-comments-list] thead th')].map((h) => h.textContent.trim()).join('|'), send: !!document.querySelector('[data-sendback-form]') }));
    chk(T, L('task 6 the Comments tab lists the same count, with type and severity columns and the send-back form'), cl.rows === cl.badge && /Type\|Severity/.test(cl.heads) && cl.send, JSON.stringify(cl));
    await page.ctx.close();
    });

    // ---- task 7: approve (RV-10, RV-11, CP4, CP11)
    await sec(L('task 7'), async () => {
    page = await open('red-gate.html', '#/approve', size);
    const gate = await page.evaluate(() => ({ hasBtn: !!document.querySelector('[data-approve]'), text: document.querySelector('[data-approve-body]').textContent.replace(/\s+/g, ' '), links: [...document.querySelectorAll('[data-approve-body] a')].map((a) => a.getAttribute('href')), disabled: document.querySelectorAll('[disabled],[aria-disabled=true]').length, left: document.querySelector('.app-approvehint') ? 1 : 0 }));
    chk(T, L('task 7 Approve is absent (not disabled) and what remains is listed as links: accepted risks not judged'), !gate.hasBtn && /Approve is not here yet/.test(gate.text) && /Accepted risks not judged \(2 of 4\)/.test(gate.text) && gate.links.filter((l) => /^#\/flags\//.test(l)).length === 2 && gate.disabled === 0, gate.text.slice(0, 220));
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('a'); await page.waitForTimeout(100);
    chk(T, L('task 7 key a only focuses the first thing that is left and says why'), (await hashOf(page)) === '#/approve' && page.url().includes('red-gate.html') && /Approve is not ready/.test(await live(page)), `${await active(page)} | ${await live(page)}`);
    const firstLeft = await page.evaluate(() => document.querySelector('[data-approve-body] a').getAttribute('href')); await page.click('[data-approve-body] a >> nth=0'); await page.waitForTimeout(100);
    chk(T, L('task 7 a link goes straight to what is left'), (await hashOf(page)).startsWith(firstLeft), `${firstLeft} -> ${await hashOf(page)}`);
    await page.ctx.close();
    page = await open('scarborough.html', '#/approve', size);
    const sap = await txt(page, '[data-approve-body]');
    chk(T, L('task 7 Approve lists sections not marked, forms not placed and accepted risks not judged (many)'), /Sections not Reviewed \(10 of 12\)/.test(sap) && /Forms not placed \(2\)/.test(sap) && /Accepted risks not judged \(4 of 5\)/.test(sap), sap.slice(0, 400));
    await page.ctx.close();
    page = await open('red-ready.html', '#/approve', size); loads = 0; page.on('load', () => { loads++; });
    chk(T, L('task 7 everything done: Approve shows, nothing is left'), (await vis(page, '[data-approve]')) && /Everything is done/.test(await txt(page, '[data-approve-body]')), (await txt(page, '[data-approve-body]')).slice(0, 160));
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('a'); await page.waitForTimeout(80);
    const a1 = await page.evaluate(() => document.activeElement.hasAttribute('data-approve'));
    chk(T, L('task 7 key a focuses Approve and does not approve'), a1 && page.url().includes('red-ready.html') && loads === 0, `${await active(page)}`);
    await page.keyboard.press('Enter'); await page.waitForSelector('.govuk-panel', { timeout: 3000 });
    const ap = await page.evaluate(() => ({ panel: document.querySelector('.govuk-panel__title').textContent, tables: [...document.querySelectorAll('caption')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()), next: !!document.querySelector('[data-queue-next-link]'), judged: document.querySelectorAll('[data-judg-row]').length, marks: document.querySelectorAll('tbody tr').length }));
    chk(T, L('task 7 Enter approves: one load, the approval record lists judgments with reasons, marks with who and when, time on each section, sources opened'), loads === 1 && /approved/i.test(ap.panel) && ap.tables.some((c) => /judgments on the accepted risks \(4\)/.test(c)) && ap.tables.some((c) => /time on each section and every source opened/.test(c)) && ap.next, JSON.stringify(ap));
    await page.ctx.close();
    });

    // ---- task 8: re-review after rework (RV-7, RV-12, CP12, CP14, CP16)
    await sec(L('task 8'), async () => {
    page = await open('red-rework.html', '#/brief', size);
    const rw = await page.evaluate(() => ({ strip: document.querySelector('.app-strip').textContent.replace(/\s+/g, ' '), off: document.querySelector('[data-rail="stmt"], [data-section-pick]') ? 1 : 0 }));
    chk(T, L('task 8 the brief shows the fix-round digest line: numbers changed, marks that came off, comments'), /Back from rework: 2 numbers changed, 1 mark came off/.test(rw.strip) && /4 comments/.test(rw.strip), rw.strip.slice(0, 260));
    await page.click('.app-strip a[href="#/changes"]'); await page.waitForTimeout(120);
    const ch = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-view="changes"] tbody tr').length, digest: document.querySelector('.app-digest').textContent.replace(/\s+/g, ' '), off: [...document.querySelectorAll('[data-off-item]')].map((l) => l.textContent.replace(/\s+/g, ' ')), cap: document.querySelector('[data-view="changes"] caption').textContent }));
    chk(T, L('task 8 Changes: only the changed numbers, before and after; the marks that came off and why; the digest'), ch.rows === 2 && /\(2\)/.test(ch.cap) && ch.off.length === 1 && /Still to re-mark/.test(ch.off[0]) && /Second review/.test(ch.digest) && /AI fix drafts/.test(ch.digest), JSON.stringify(ch));
    await goHash(page, '#/comments');
    const rc = await page.evaluate(() => ({ line: document.querySelector('[data-count="resolved"]').textContent, resolve: document.querySelectorAll('[data-resolve]').length, answers: [...document.querySelectorAll('[data-comments-list] tbody tr')].filter((r) => /Preparer: /.test(r.textContent)).length, drafts: document.querySelectorAll('.app-draft').length, draftControls: document.querySelectorAll('.app-drafts button, .app-drafts input, .app-drafts select, .app-drafts textarea, .app-drafts a.govuk-button').length, aiTags: [...document.querySelectorAll('.app-draft .govuk-tag')].filter((t) => t.textContent.trim() === 'AI draft').length, cites: document.querySelectorAll('.app-draft .app-lines').length }));
    chk(T, L('task 8 comments show the preparer answers and a Resolve button for each answered one'), /\d of 4 comments resolved/.test(rc.line) && rc.resolve >= 1 && rc.answers >= 3, JSON.stringify(rc));
    chk(T, L('task 8 AI fix drafts are read-only "AI draft" cards with citations and no control to approve them'), rc.drafts >= 1 && rc.aiTags === rc.drafts && rc.draftControls === 0 && rc.cites >= rc.drafts, JSON.stringify(rc));
    const res0 = rc.resolve; await page.click('[data-resolve] >> nth=0'); await page.waitForTimeout(100);
    const rc2 = await page.evaluate(() => ({ line: document.querySelector('[data-count="resolved"]').textContent, resolve: document.querySelectorAll('[data-resolve]').length, foc: document.activeElement.hasAttribute('data-resolve') || document.activeElement.getAttribute('role') === 'region' || document.activeElement.id === 'route-title' }));
    chk(T, L('task 8 Resolve resolves in place, focus moves on, the count updates'), rc2.resolve === res0 - 1 && rc2.foc && rc2.line !== rc.line, JSON.stringify(rc2));
    await goHash(page, '#/statements'); await page.waitForTimeout(100);
    const off = await page.evaluate(() => ({ tag: document.querySelector('.app-toolbar__body .govuk-tag').textContent, why: document.querySelector('.app-offwhy') ? document.querySelector('.app-offwhy').textContent : '', btn: !!document.querySelector('[data-reviewed-next]') }));
    chk(T, L('task 8 the section whose mark came off says so in words with the reason, and can be marked again'), /Mark came off/.test(off.tag) && /changed from/.test(off.why) && off.btn, JSON.stringify(off));
    await page.ctx.close();
    });

    // ---- task 9: the second window (CP10)
    await sec(L('task 9'), async () => {
      const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } }); ctx.setDefaultTimeout(4000);
      const p = await ctx.newPage(); await p.goto(url('red.html', '#/statements/n-6090')); await p.waitForTimeout(300);
      chk(T, L('task 9 one checkbox beside "Open in a second window", off by default, state in words'), !(await p.evaluate(() => document.querySelector('#win-pref').checked)) && (await txt(p, '[data-source-win]')) === 'Second window: off');
      const popupP = ctx.waitForEvent('page'); await p.click('label[for="win-pref"]'); const w = await popupP; await w.waitForLoadState(); await w.waitForTimeout(700);
      chk(T, L('task 9 ticking it opens the window by script (window.open) and the words say it is following'), !!w && (await txt(p, '[data-source-win]')) === 'Second window: on, open, following', await txt(p, '[data-source-win]'));
      const cap1 = await w.evaluate(() => { const e = document.querySelector('[data-source]:not([hidden]) .app-caption'); return e ? e.textContent : ''; });
      await p.bringToFront(); await p.click('[data-row="n-6095"] [data-pick]'); await w.waitForTimeout(400);
      const cap2 = await w.evaluate(() => { const e = document.querySelector('[data-source]:not([hidden]) .app-caption'); return e ? e.textContent : ''; });
      chk(T, L('task 9 the window follows a number'), !!cap2 && cap1 !== cap2, `${cap1} -> ${cap2}`);
      const l1 = await w.evaluate(() => document.querySelector('[data-win-for]').textContent);
      await toSection(p, 'schedule-1'); await w.waitForTimeout(400); const l2 = await w.evaluate(() => document.querySelector('[data-win-for]').textContent);
      chk(T, L('task 9 the window follows a section change'), l1 !== l2, `${l1} -> ${l2}`);
      await p.click('[data-tab="history"]'); await w.waitForTimeout(400);
      chk(T, L('task 9 the window follows a tab change'), /History/.test(await w.evaluate(() => document.querySelector('[data-win-for]').textContent)));
      await p.click('[data-tab="review"]'); await goHash(p, '#/flags/01-F04'); await w.waitForTimeout(400);
      chk(T, L('task 9 a flag shows its cited evidence in the window'), /Cited evidence/.test(await w.evaluate(() => (document.querySelector('[data-source]:not([hidden]) .app-caption') || {}).textContent || '')));
      await p.reload(); await p.waitForTimeout(500);
      const pref = await p.evaluate(() => ({ ticked: document.querySelector('#win-pref').checked, words: document.querySelector('[data-source-win]').textContent }));
      chk(T, L('task 9 the choice is remembered for the signed-in person; the window is open and following again'), pref.ticked && /^Second window: on/.test(pref.words), JSON.stringify(pref));
      await p.click('label[for="win-pref"]'); await p.waitForTimeout(600);
      chk(T, L('task 9 un-ticking closes the window and the words say off'), w.isClosed() && (await txt(p, '[data-source-win]')) === 'Second window: off', await txt(p, '[data-source-win]'));
      const pop2 = ctx.waitForEvent('page'); await p.click('label[for="win-pref"]'); const w2 = await pop2; await w2.waitForLoadState(); await w2.waitForTimeout(500);
      await p.click('[data-signout]'); await p.waitForTimeout(600);
      chk(T, L('task 9 signing out closes the second window'), w2.isClosed(), p.url());
      await ctx.close();
    });

    // ---- task 10: a voided approval (FLOW-5, TB-11, CP9)
    await sec(L('task 10'), async () => {
    page = await open('green-void.html', '#/brief', size);
    const vd = await page.evaluate(() => ({ alert: document.querySelector('.moj-alert') ? document.querySelector('.moj-alert').textContent.replace(/\s+/g, ' ') : '', ro: document.querySelector('.app-readonly') ? document.querySelector('.app-readonly').textContent : '', ctl: document.querySelectorAll('[data-reviewed-next],[data-approve],[data-comment-open],[data-judge-form],[data-unmark-open],.app-approvehint').length, tag: [...document.querySelectorAll('[data-identity-bar] .govuk-tag')].map((t) => t.textContent.trim()).join(', '), rail: !!document.querySelector('[data-rail="approve"]'), pick: ((s) => (s ? [...s.options].some((o) => /Approve/.test(o.textContent)) : 'no select on the page'))(document.querySelector('[data-section-pick]')) }));
    chk(T, L('task 10 void: the alert says why in words and links to what changed; read-only with the reason; no mark, comment or approve control'), /Approval void/.test(vd.alert) && /entry/.test(vd.alert) && /Waiting for the preparer/.test(vd.ro) && vd.ctl === 0 && !vd.rail && !vd.pick && /Approval void/.test(vd.tag), JSON.stringify({ alert: vd.alert.slice(0, 120), ro: vd.ro.slice(0, 60), ctl: vd.ctl, tag: vd.tag, rail: vd.rail, pick: vd.pick }));
    await page.click('.app-alert a'); await page.waitForTimeout(120);
    const vc = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-view="changes"] tbody tr').length, digest: document.querySelector('.app-digest').textContent.replace(/\s+/g, ' '), off: document.querySelectorAll('[data-off-item]').length }));
    chk(T, L('task 10 Changes: before and after, the marks that came off, what happens next'), vc.rows >= 1 && vc.off >= 1 && /Void since/.test(vc.digest) && /What happens next/.test(vc.digest), JSON.stringify(vc));
    await page.ctx.close();
    });

    // ---- the assigned preparer's read-only view (CP13, V04)
    await sec(L('task 10b'), async () => {
    page = await open('red-preparer.html', '#/flags/01-F04', size);
    const pv = await page.evaluate(() => ({ ctl: document.querySelectorAll('[data-reviewed-next],[data-approve],[data-comment-open],[data-judge-form],[data-unmark-open],.app-approvehint,[data-sendback-form],[data-flag-state]').length, ro: document.querySelector('.app-readonly') ? document.querySelector('.app-readonly').textContent : '', tag: [...document.querySelectorAll('[data-identity-bar] .govuk-tag')].map((t) => t.textContent.trim()).join(', '), rail: !!document.querySelector('[data-rail="approve"]') }));
    chk(T, L('task 10b the assigned preparer sees the record read-only: no mark, judge, approve or comment control, and says why'), pv.ctl === 0 && /Read-only/.test(pv.ro) && /Read-only: preparer/.test(pv.tag) && !pv.rail, JSON.stringify(pv));
    await goHash(page, '#/comments');
    chk(T, L('task 10b the CPA drafts stay hidden until the return is sent back'), /has not sent any comments yet/.test(await txt(page, '[data-comments-list]')), (await txt(page, '[data-comments-list]')).slice(0, 120));
    await page.ctx.close();
    });
  }
  log(`TASKS: ${results.tasks.length} checks, ${results.tasks.filter((x) => !x[1]).length} failing`);
}

// ------------------------------------------------------------------ rules in action (staff-screens rules 8, 10, 18 to 23)
async function rules() {
  const Rl = results.rules;
  for (const size of SIZES) {
    const tag = size.join('x'); const L = (m) => `${m} @${tag}`;
    let page;
    await sec(L('rules a'), async () => {
    page = await open('red.html', '#/statements', size);
    // rule 22: r on a Reviewed section never unmarks; a never approves; no unmark key
    const before =+(await txt(page, '[data-count-reviewed]'));
    await page.keyboard.press('r'); await page.waitForTimeout(100); const after = +(await txt(page, '[data-count-reviewed]'));
    chk(Rl, L('rule 22 r on a Reviewed section never takes the mark off'), after >= before, `${before} to ${after}`);
    chk(Rl, L('rule 22 the unmark control has no shortcut'), await page.evaluate(() => ![...document.querySelectorAll('[data-unmark-open]')].some((e) => e.hasAttribute('aria-keyshortcuts'))));
    await goHash(page, '#/statements'); await page.click('[data-unmark-open]'); await page.click('[data-unmark-form] button.govuk-button'); await page.waitForTimeout(80);
    chk(Rl, L('rule 9 taking a mark off needs a reason (error pattern)'), await page.evaluate(() => !document.querySelector('#um-err').hidden && /^Error: /.test(document.title)));
    await page.fill('#um-why', 'Checked again, a number moved.'); await page.click('[data-unmark-form] button.govuk-button'); await page.waitForTimeout(80);
    chk(Rl, L('rule 5 taking the mark off with a reason works and goes in the history'), (await page.evaluate(() => document.querySelector('[data-toolbar-body] .govuk-tag').textContent.trim())) === 'Not reviewed' && (await page.evaluate(() => /mark taken off/.test(document.querySelector('[data-timeline]').textContent))));
    // rule 8: no Reviewed button... not applicable; no disabled controls anywhere
    chk(Rl, L('rule 8 no disabled button and no disabled control on the record'), (await page.evaluate(() => document.querySelectorAll('button[disabled],[aria-disabled=true],input[disabled]').length)) === 0);
    // rule 10: keys listed, aria-keyshortcuts, nothing fires in a text field, the off switch
    const ks = await page.evaluate(() => ({ list: [...document.querySelectorAll('.app-keys__list kbd')].map((k) => k.textContent), attrs: [...document.querySelectorAll('[aria-keyshortcuts]')].map((e) => e.getAttribute('aria-keyshortcuts')) }));
    chk(Rl, L('rule 10 every aria-keyshortcuts value is in the visible list, and the list is only D01 keys'), ks.attrs.every((a) => ks.list.includes(a)) && ks.list.every((k) => ['n', 'p', 'm', 'o', 'r', 'a', 'c', 's', ']', '[', 'Esc'].includes(k)), `list ${ks.list.join(' ')} attrs ${[...new Set(ks.attrs)].join(' ')}`);
    await goHash(page, '#/statements/n-6090'); await page.focus('#find-q'); const hs = await hashOf(page); await page.keyboard.type('nmpcr'); await page.waitForTimeout(80);
    chk(Rl, L('rule 10 nothing fires while the focus is in a text field'), (await hashOf(page)) === hs && (await page.evaluate(() => document.querySelector('#find-q').value)) === 'nmpcr' && !(await page.evaluate(() => !!document.querySelector('[data-comment-host] form'))));
    await page.fill('#find-q', '');
    await page.click('summary.app-keys__summary'); await page.click('label[for="keys-off"]'); await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement.blur()); const hk = await hashOf(page); await page.keyboard.press('m'); await page.waitForTimeout(80);
    chk(Rl, L('rule 10 with single-key shortcuts off, keys do nothing; the choice is kept for the person'), (await hashOf(page)) === hk && (await page.evaluate(() => JSON.parse(localStorage.getItem('ashbridge-pref:Zo (Test)') || '{}').keysOff === true)));
    await page.reload(); await page.waitForTimeout(250);
    chk(Rl, L('rule 10 the off switch is still on after a reload'), await page.evaluate(() => document.querySelector('#keys-off').checked));
    await page.ctx.close();
    });

    // flags: the judge-first order, Reviewed, next after the flags, 0 loads
    await sec(L('rules b'), async () => {
    page = await open('red.html', '#/flags', size); let loads = 0; page.on('load', () => { loads++; });
    const D = await DATA(page);
    for (const f of D.flags.filter((x) => x.kind === 'accepted')) { await goHash(page, '#/flags/' + f.id); await page.fill(`#jr-${f.id}`, 'Accepted, with my reason.'); await page.click(`[data-judge-form="${f.id}"] button.govuk-button`); await page.waitForTimeout(80); }
    chk(Rl, L('rule 19 four judgments run in place (0 loads), and the Approve hint counts what is left'), loads === 0 && /Approve: 10 left/.test(await txt(page, '.app-approvehint')), `${await txt(page, '.app-approvehint')}`);
    await goHash(page, '#/flags'); await page.click('[data-reviewed-next]'); await page.waitForTimeout(100);
    chk(Rl, L('rule 14 sections keep the fixed order: Reviewed, next on Flags goes to Statements and GIFI'), (await hashOf(page)).startsWith('#/statements'), await hashOf(page));
    // rule 18: a section change is a client-side route with its own URL
    loads = 0; await toSection(page, 'schedule-1');
    chk(Rl, L('rule 18 a section change is a client-side route with its own URL (0 loads)'), loads === 0 && (await hashOf(page)).startsWith('#/schedule-1'), await hashOf(page));
    // counts agree
    await page.click('[data-tab="comments"]'); await page.waitForTimeout(80);
    const cnt = await page.evaluate(() => ({ badge: +document.querySelector('[data-comment-count]').textContent, rows: document.querySelectorAll('[data-comments-list] tbody tr').length }));
    chk(Rl, L('rule 5 counts agree: the Comments badge equals the rows in the list'), cnt.badge === cnt.rows || (cnt.rows === 0 && cnt.badge === 0), JSON.stringify(cnt));
    const rc = await page.evaluate(() => ({ tag: +document.querySelector('[data-count-reviewed]').textContent, rail: document.querySelectorAll('[data-rail-mark].app-rail__mark--on').length, picks: [...document.querySelector('[data-section-pick]').options].filter((o) => /\(Reviewed\)/.test(o.textContent)).length }));
    chk(Rl, L('rule 5 counts agree: the identity bar count equals the rail marks and the Section select'), rc.tag === rc.picks && (rc.rail === 0 || rc.rail === rc.tag), JSON.stringify(rc));
    // rule 21: search
    await page.click('[data-tab="review"]'); await page.fill('#find-q', 'a'); await page.press('#find-q', 'Enter'); await page.waitForTimeout(120);
    chk(Rl, L('rule 21 a search with many matches shows a results page, with the count'), await page.evaluate(() => location.hash.startsWith('#/find/') && document.querySelectorAll('[data-find-results] tbody tr').length > 1 && /\d+ results for/.test(document.querySelector('#find-h').textContent)));
    await page.fill('#find-q', 'Dividend paid'); await page.press('#find-q', 'Enter'); await page.waitForTimeout(120);
    chk(Rl, L('rule 21 a search with one match goes to it'), (await hashOf(page)).startsWith('#/dividends/'), await hashOf(page));
    await page.fill('#find-q', 'qqqq'); await page.press('#find-q', 'Enter'); await page.waitForTimeout(120);
    chk(Rl, L('rule 21 a search with no match says so'), /No number matches/.test(await txt(page, '#find-h')));
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('s'); chk(Rl, L('rule 21 key s focuses the search'), (await page.evaluate(() => document.activeElement.id)) === 'find-q');
    // send back in place
    await goHash(page, '#/comments/send'); await page.click('[data-sendback-form] button'); await page.waitForTimeout(80);
    chk(Rl, L('rule 9 send back with nothing written shows the error pattern in the form'), await page.evaluate(() => !document.querySelector('[data-sb-es]').hidden && /^Error: /.test(document.title)));
    await page.fill('#sb-text', 'Please attach the five receipts.'); await page.click('[data-sendback-form] button'); await page.waitForTimeout(100);
    chk(Rl, L('rule 19 send back runs in place and confirms'), await page.evaluate(() => !!document.querySelector('[data-sb-done]')));
    await page.ctx.close();
    });

    // many accepted risks and many sections: the Section select and the flags order
    await sec(L('rules c'), async () => {
    page = await open('scarborough.html', '#/flags', size);
    const many = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-panel="flags"] tbody tr').length, state: [...document.querySelectorAll('[data-panel="flags"] [data-flag-state]')].map((e) => e.textContent).join(','), first: document.querySelector('[data-panel="flags"] tbody tr').getAttribute('data-row') }));
    chk(Rl, L('many: seven flags, five accepted risks, one judged, in the list with states in words'), many.rows === 7 && (many.state.match(/Not judged/g) || []).length === 4 && (many.state.match(/Accepted/g) || []).length === 1, JSON.stringify(many));
    await page.ctx.close();
    });

    // the approved record: marks, judgments, time, sources
    await sec(L('rules d'), async () => {
    page = await open('approved-red.html', '', size);
    const ar = await page.evaluate(() => ({ judg: document.querySelectorAll('[data-judg-row]').length, all: document.body.textContent.replace(/\s+/g, ' ') }));
    chk(Rl, L('RV-11 the approval record lists each judgment with the reason, and each mark with who and when, time and sources'), ar.judg === 4 && /Sources opened/i.test(ar.all) && /Time on section/i.test(ar.all) && /Reason/i.test(ar.all), `${ar.judg} judgments`);
    await page.ctx.close();
    });
  }
  log(`RULES: ${results.rules.length} checks, ${results.rules.filter((x) => !x[1]).length} failing`);
}

// ------------------------------------------------------------------ V1 to V8 (design/verify/rules.mjs), at both rule-18 sizes
async function rulesV() {
  const out = { run: 0, bad: 0, byRule: {} };
  const A = (rule, label, r) => { out.run++; out.byRule[rule] = (out.byRule[rule] || 0) + 1; if (!r.ok) { out.bad++; fail(`${rule} ${label}: ${r.failures.join('; ')}`); } };
  const rowBtn = (id) => `[data-row="${id}"] [data-pick]`;
  const only = process.env.V_ONLY ? process.env.V_ONLY.split(',') : null;
  const want = (r) => !only || only.includes(r);
  for (const size of SIZES) {
    const tag = size.join('x');
    const L = (m) => `${m} @${tag}`;
    // ---- V1: no early error, on load of every page and after non-submit input
    if (want('V1')) {
      for (const [f, h] of [['red.html', '#/brief'], ['red.html', '#/flags/01-F04'], ['red.html', '#/statements/n-6090'], ['red.html', '#/comments'], ['red.html', '#/comments/send'], ['red.html', '#/approve'], ['red.html', '#/history'], ['red-rework.html', '#/changes'], ['red-rework.html', '#/comments'], ['red-gate.html', '#/approve'], ['red-ready.html', '#/approve'], ['red-preparer.html', '#/brief'], ['green.html', '#/brief'], ['green.html', '#/disclosures'], ['green-ready.html', '#/payment'], ['green-void.html', '#/brief'], ['bluewater.html', '#/brief'], ['scarborough.html', '#/forms-not-placed'], ['queue.html', '#/all'], ['queue-later.html', '#/rework'], ['queue-empty.html', '#/all'], ['approved-green.html', ''], ['approved-red.html', ''], ['source-red.html', '#n-6090:0']]) {
        const page = await open(f, h, size); A('V1', L(`${f}${h}`), await R.V1(page)); await page.ctx.close();
      }
      { const page = await open('red.html', '#/statements/n-6090', size); await page.keyboard.press('c'); await page.waitForTimeout(150); A('V1', L('comment panel open, typing'), await R.V1(page)); await page.ctx.close(); }
      { const page = await open('red.html', '#/flags/01-F04', size); A('V1', L('judgment form, typing a reason'), await R.V1(page, { input: '#jr-01-F04' })); await page.ctx.close(); }
      { const page = await open('green-ready.html', '#/payment', size); await page.evaluate(() => document.querySelector('[data-unmark-open]').click()); await page.waitForTimeout(100); A('V1', L('unmark form open, typing'), await R.V1(page)); await page.ctx.close(); }
    }
    // ---- V2: in-place actions leave scroll and the identity bar alone
    if (want('V2')) {
      const page = await open('red.html', '#/statements/n-6090', size);
      const acts = [
        { name: 'pick a number', click: rowBtn('n-6095') }, { name: 'm (next number)', press: 'm' },
        { name: 'n (next flag)', press: 'n' }, { name: 'p (previous flag)', press: 'p' }, { name: ']', press: ']' }, { name: '[', press: '[' },
        { name: 'open comment panel', run: async (p) => { await p.evaluate(() => { location.hash = '#/statements/n-6090'; }); await p.waitForTimeout(100); await p.keyboard.press('c'); } },
        { name: 'cancel comment', click: '[data-comment-cancel]' },
        { name: 'section from the rail or the select', run: async (p) => { await toSection(p, 'schedule-1'); } },
        { name: 'r (Reviewed, next)', press: 'r' },
        { name: 'accept an accepted risk with a reason', run: async (p) => { await p.evaluate(() => { location.hash = '#/flags/01-F01'; }); await p.waitForTimeout(100); await p.fill('#jr-01-F01', 'My reason.'); await p.click('[data-trace]:not([hidden]) [data-judge-form] button.govuk-button'); } },
        { name: 'judgment error', run: async (p) => { await p.evaluate(() => { location.hash = '#/flags/01-F03'; }); await p.waitForTimeout(100); await p.click('[data-trace]:not([hidden]) [data-judge-form] button.govuk-button'); } },
        { name: 'comment panel error', run: async (p) => { await p.evaluate(() => { location.hash = '#/statements/n-6090'; }); await p.waitForTimeout(100); await p.keyboard.press('c'); await p.click('[data-comment-form] button.govuk-button'); } },
        { name: 'open the Comments tab', click: '[data-tab="comments"]' }, { name: 'open the History tab', click: '[data-tab="history"]' }, { name: 'back to the Review tab', click: '[data-tab="review"]' },
      ];
      for (const a of acts) A('V2', L(a.name), await R.V2(page, a));
      await page.ctx.close();
      const pg = await open('red-rework.html', '#/comments', size);
      A('V2', L('resolve a comment'), await R.V2(pg, { name: 'resolve a comment', click: '[data-resolve] >> nth=0' })); await pg.ctx.close();
      const pq = await open('queue.html', '#/all', size);
      A('V2', L('queue: search'), await R.V2(pq, { name: 'queue search', run: async (p) => { await p.fill('#q-search', 'queen'); } }, { identity: 'h1' })); await pq.ctx.close();
    }
    // ---- V3: the evidence and the primary action in view, no page scroll, in every pane state
    if (want('V3')) {
      for (const [f, h, lab] of [['red.html', '#/statements/n-6090', 'number with a source'], ['red.html', '#/statements/n-6170', 'number with no evidence'], ['red.html', '#/flags/01-F04', 'flag with cited evidence and the judgment form'], ['red.html', '#/flags/01-F02', 'flag with cited evidence'], ['red.html', '#/schedule-1', 'Schedule 1 first number'], ['red.html', '#/payment', 'payment and filing'], ['red-rework.html', '#/statements', 'back from rework'], ['red-rework.html', '#/flags/01-F01', 'a judged flag'], ['green.html', '#/statements', 'green return'], ['green-ready.html', '#/payment', 'green, section marked'], ['scarborough.html', '#/flags/09-F03', 'many accepted risks'], ['bluewater.html', '#/flags', 'overdue return'], ['red-preparer.html', '#/statements/n-6090', 'read-only preparer']]) {
        const page = await open(f, h, size); A('V3', L(`${lab} (${f}${h})`), await R.V3(page, f === 'red-preparer.html' ? { primary: '[data-step-next]' } : {})); await page.ctx.close();
      }
      const page = await open('red.html', '#/statements/n-6090', size); await page.keyboard.press('c'); await page.waitForTimeout(150);
      A('V3', L('comment panel open'), await R.V3(page));
      const inside = await page.evaluate(() => { const b = document.querySelector('.app-cp__body'); const f = [...document.querySelectorAll('.app-cp [data-g]')].map((g) => g.getBoundingClientRect()); const bt = document.querySelector('.app-cp [data-primary]').getBoundingClientRect(); const cap = document.querySelector('[data-cp-caption]'); const cp = document.querySelector('[data-comment-host]').getBoundingClientRect(); return { innerScroll: b.scrollHeight > b.clientHeight + 1, groups: f.length, fieldsInside: f.every((r) => r.top >= cp.top && r.bottom <= cp.bottom + 0.5), btnInside: bt.bottom <= cp.bottom + 0.5, capText: cap ? cap.textContent.slice(0, 40) : null, panelH: Math.round(cp.height), panelW: Math.round(cp.width) }; });
      const ok3 = !inside.innerScroll && inside.groups === 3 && inside.fieldsInside && inside.btnInside && /^Source: /.test(inside.capText || '');
      A('V3', L(`comment panel: 3 fields + Add comment inside, no inner scroll, caption in header (${inside.panelW} x ${inside.panelH})`), { ok: ok3, failures: [JSON.stringify(inside)] });
      results.cpanel = results.cpanel || {}; results.cpanel[tag] = inside; await page.ctx.close();
    }
    // ---- V4: focus lands after every action, Back, and each shortcut
    if (want('V4')) {
      const page = await open('red.html', '#/statements/n-6090', size);
      const acts = [
        { name: 'click a number', click: rowBtn('n-6095'), expect: '[data-source-body]' },
        { name: 'c opens the comment panel', press: 'c', expect: '#type-0' },
        { name: 'Escape closes the panel', press: 'Escape', expect: '[data-pick]' },
        { name: 'c, then Cancel', run: async (p) => { await p.keyboard.press('c'); await p.click('[data-comment-cancel]'); }, expect: '[data-pick]' },
        { name: 'empty submit shows the summary', run: async (p) => { await p.keyboard.press('c'); await p.click('[data-comment-form] button.govuk-button'); }, expect: '[data-es]' },
        { name: 'add a comment', run: async (p) => { await p.click('label[for="type-0"]'); await p.click('label[for="severity-1"]'); await p.fill('#text', 'Receipts please.'); await p.click('[data-comment-form] button.govuk-button'); }, expect: '[data-pick]' },
        { name: 'm', press: 'm', expect: '[data-pick]' },
        { name: 'Back after a section change', run: async (p) => { await p.evaluate(() => { location.hash = '#/schedule-1'; }); await p.waitForTimeout(150); await p.goBack(); }, expect: '#route-title, [data-pick]' },
        { name: 'r (Reviewed, next)', press: 'r', expect: '[data-pick], #route-title' },
        { name: 'judgment error focuses the form summary', run: async (p) => { await p.evaluate(() => { location.hash = '#/flags/01-F01'; }); await p.waitForTimeout(150); await p.click('[data-trace]:not([hidden]) [data-judge-form] button.govuk-button'); }, expect: '[data-jes]' },
        { name: 'accept a risk moves to the next one to judge', run: async (p) => { await p.fill('#jr-01-F01', 'My reason.'); await p.click('[data-trace]:not([hidden]) [data-judge-form] button.govuk-button'); }, expect: '[data-pick]' },
        { name: 'Comment instead focuses the panel', run: async (p) => { await p.click('[data-trace]:not([hidden]) [data-judge-comment]'); }, expect: '#type-0' },
      ];
      for (const a of acts) A('V4', L(a.name), await R.V4(page, a));
      await page.keyboard.press('Escape'); await page.evaluate(() => { location.hash = '#/statements/n-6090'; }); await page.waitForTimeout(150);
      A('V4', L('shortcuts n p m ] [ o r s a c'), await R.V4(page, null, { shortcuts: [
        { key: 'n', selector: '[data-pick]' }, { key: 'p', selector: '[data-pick]' }, { key: 'm', selector: '[data-pick]' },
        { key: ']', selector: '[data-source-body]' }, { key: '[', selector: '[data-source-body]' }, { key: 'o', selector: '[data-source-body], [data-open-source]' },
        { key: 'r', selector: '[data-pick], #route-title' }, { key: 's', selector: '#find-q' },
        { key: 'a', selector: '[data-approve], .app-approvehint a, [data-panel="approve"] a' }, { key: 'c', selector: '#type-0' }] }));
      await page.ctx.close();
      const pg2 = await open('green.html', '#/brief', size);
      A('V4', L('a with sections left focuses "Approve: N left"'), await R.V4(pg2, { name: 'a', press: 'a', expect: '.app-approvehint a' }));
      const said = await pg2.evaluate(() => document.getElementById('app-live').textContent);
      A('V4', L('a announces why'), { ok: /Approve is not ready: \d+ sections? not Reviewed and 0 accepted risks not judged/.test(said), failures: [`live region says "${said}"`] });
      await pg2.ctx.close();
      const pg3 = await open('green-ready.html', '#/brief', size);
      A('V4', L('a with everything done focuses Approve return'), await R.V4(pg3, { name: 'a', press: 'a', expect: '[data-approve]' }));
      await pg3.ctx.close();
      const pg4 = await open('queue.html', '#/all', size);
      A('V4', L('queue: s focuses the search'), await R.V4(pg4, null, { shortcuts: [{ key: 's', selector: '#q-search' }] }));
      await pg4.ctx.close();
    }
    // ---- V5: counts carry their scope; the same count is the same number on every page of one return
    if (want('V5')) {
      const seen = [];
      for (const h of ['#/brief', '#/flags', '#/statements/n-6090', '#/comments', '#/history', '#/approve']) { const page = await open('red.html', h, size); const r = await R.V5(page); A('V5', L(`red.html${h}`), r); seen.push(r); await page.ctx.close(); }
      A('V5', L('red.html: same count, same number across pages'), R.V5same(seen));
      const seenG = []; for (const h of ['#/brief', '#/comments', '#/payment', '#/approve']) { const page = await open('green.html', h, size); const r = await R.V5(page); A('V5', L(`green.html${h}`), r); seenG.push(r); await page.ctx.close(); }
      A('V5', L('green.html: same count, same number across pages'), R.V5same(seenG));
      const seenR = []; for (const h of ['#/brief', '#/changes', '#/comments']) { const page = await open('red-rework.html', h, size); const r = await R.V5(page); A('V5', L(`red-rework.html${h}`), r); seenR.push(r); await page.ctx.close(); }
      A('V5', L('red-rework.html: same count, same number across pages'), R.V5same(seenR));
      const q = await open('queue.html', '#/all', size); A('V5', L('queue.html'), await R.V5(q));
      A('V5', L('queue caption updates with a filter'), await R.V5caption(q, { name: 'tier filter', run: (p) => p.selectOption('#q-tier', 'green') }, { caption: '[data-q-count]' })); await q.ctx.close();
      const qe = await open('queue-later.html', '#/rework', size); A('V5', L('queue-later.html rework view'), await R.V5(qe)); await qe.ctx.close();
    }
    // ---- V6: search keeps its promise
    if (want('V6')) {
      const page = await open('red.html', '#/brief', size);
      A('V6', L('Find a number: name and account number'), await R.V6(page, { input: '#find-q', result: '[data-find-results] tbody tr, [data-row].is-selected', label: '#find-hint', kinds: [{ kind: 'name', value: 'Dividend paid' }, { kind: 'account number', value: '6090' }] }));
      await page.ctx.close();
      const q = await open('queue.html', '#/all', size);
      A('V6', L('Queue: search by name'), await R.V6(q, { input: '#q-search', result: 'tbody tr:not([hidden])', label: 'label[for="q-search"]', kinds: [{ kind: 'name', value: 'Queen West Design Studio Inc. (Test)' }] })); await q.ctx.close();
    }
    // ---- V7: every click does something
    if (want('V7')) {
      const SEL = 'button, a[href]:not(.govuk-skip-link), [role=button], input[type=submit], summary';
      // The rail links are clicked on the first two pages only (they are the same control on every page); on the rest they are skipped to keep the run short.
      const SET = [['red.html', '#/brief', 'brief', 70, false], ['red.html', '#/statements/n-6090', 'a number picked', 70, false], ['red.html', '#/flags/01-F04', 'a flag with the judgment form', 60, true], ['red.html', '#/comments', 'comments', 45, true], ['red-gate.html', '#/approve', 'two accepted risks not judged', 40, true], ['red-ready.html', '#/approve', 'Approve shows', 35, true], ['red-rework.html', '#/changes', 'changes after rework', 40, true],
        ['red-rework.html', '#/comments', 'rework comments', 40, true], ['green-ready.html', '#/payment', 'every section Reviewed, last section', 55, true], ['green-void.html', '#/brief', 'void', 40, true], ['red-preparer.html', '#/flags/01-F04', 'read-only preparer', 40, true], ['scarborough.html', '#/forms-not-placed', 'forms not placed', 40, true], ['queue.html', '#/all', 'queue', 60, false], ['queue-later.html', '#/rework', 'queue, back from rework', 45, false], ['approved-red.html', '', 'approved', 30, false], ['source-red.html', '#n-6090:0', 'second window', 25, false]];
      const half = process.env.V7_HALF ? +process.env.V7_HALF : 0;
      for (const [i, [f, h, lab, lim, noRail]] of SET.entries()) {
        if (half && (i % 2) !== (half - 1)) continue;
        const page = await open(f, h, size);
        A('V7', L(`${lab} (${f}${h})`), await R.V7(page, { selector: SEL, limit: lim, skip: '[disabled], [aria-disabled=true], [data-noop-ok]' + (noRail ? ', [data-rail]' : ''), reset: async (p) => { await p.goto('about:blank'); await p.goto(url(f, h)); await p.waitForTimeout(200); } })); await page.ctx.close();
      }
      // the skip link is visually hidden until focused, so the shared check cannot click it: Tab to it, press Enter, and the route must stay and focus must land on the heading
      const page = await open('red.html', '#/statements/n-6090', size); await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
      const st = await page.evaluate(() => ({ hash: location.hash, active: document.activeElement && document.activeElement.id }));
      A('V7', L('skip link keeps the route and focuses the heading'), { ok: st.hash === '#/statements/n-6090' && st.active === 'route-title', failures: [JSON.stringify(st)] }); await page.ctx.close();
    }
    // ---- V8: no field on these pages is tied to an option, so there is nothing to type into (checked: every text field is a stand-alone field)
    if (want('V8')) {
      for (const [f, h] of [['red.html', '#/statements/n-6090'], ['red.html', '#/flags/01-F04'], ['queue.html', '#/all']]) {
        const page = await open(f, h, size); if (f === 'red.html' && /n-6090/.test(h)) await page.keyboard.press('c');
        const tied = await page.evaluate(() => [...document.querySelectorAll('input[type=text],input[type=search],textarea')].filter((e) => e.closest('.govuk-radios__conditional, .govuk-checkboxes__conditional')).length);
        A('V8', L(`${f}${h}: no text field is a conditional of a radio or checkbox`), { ok: tied === 0, failures: [`${tied} fields tied to an option: run R.V8 on them`] });
        await page.ctx.close();
      }
    }
  }
  log(`V1 TO V8: ${out.run} checks, ${out.bad} failing; by rule ${JSON.stringify(out.byRule)}; comment panel ${JSON.stringify(results.cpanel)}`);
  results.v = out;
}

const GROUPS = which.split(','); // one group, or several separated by commas (for example axe,reflow,walk)
const want = (g) => GROUPS.includes(g) || which === 'all' || (GROUPS.includes('fast') && ['tasks', 'rules', 'budgets'].includes(g)); // fast = tasks, rules and budgets in one run
try {
  if (want('tasks')) await tasks();
  if (want('rules')) await rules();
  if (want('budgets')) await budgets();
  if (want('v')) await rulesV();
  if (want('axe')) await axeAll();
  if (want('reflow')) await reflow();
  if (want('walk')) await walk();
} finally { await browser.close(); server.close(); }
log(`\nTOTAL failures: ${results.fail}`);
process.exit(results.fail ? 1 : 0);
