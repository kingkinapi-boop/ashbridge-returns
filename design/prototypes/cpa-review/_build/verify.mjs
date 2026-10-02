// Designer self-check (design card checks 7 and 8): axe (incomplete counts as a failure), keyboard walk, 320 px reflow, budgets at both sizes,
// and the in-place rules (18 to 23). Nothing is installed globally: set AUDIT_MODULES to a folder that holds playwright-core and axe-core.
//   node tools/heavy.mjs -- node design/prototypes/cpa-review/_build/verify.mjs [axe|walk|reflow|budgets|rules|all]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import * as R from '../../../verify/rules.mjs'; // shared rule checks V1 to V8 (design/verify/README.md)
const req = createRequire(path.join(process.env.AUDIT_MODULES, 'package.json'));
const { chromium } = req('playwright-core');
const axeSrc = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// the pages are served over http, never file:// (design card check 8)
const SITE = path.resolve('design/prototypes/cpa-review');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((rq, rs) => {
  const p = decodeURIComponent(rq.url.split('?')[0]); const f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end('not found'); }
  rs.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rs);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const url = (f, hash = '') => `http://127.0.0.1:${PORT}/v1-record-tabs/${f}${hash}`;
const SIZES = [[1366, 650], [1093, 525]];
const which = process.argv[2] || 'all';
const results = { fail: 0 };
const log = (...a) => console.log(...a);
const fail = (m) => { results.fail++; log('FAIL', m); };
const ok = (m) => log('ok  ', m);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
async function open(f, hash = '', size = [1366, 650]) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, acceptDownloads: false });
  ctx.setDefaultTimeout(4000); ctx.setDefaultNavigationTimeout(45000);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(url(f, hash), { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(250);
  page.ctx = ctx;
  return page;
}
const goHash = async (page, h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(120); };

// ------------------------------------------------------------------ axe
const SECS = ['brief', 'flags', 'statements', 'schedule-1', 'capital', 'losses', 'rate', 'dividends', 'shareholders', 'ontario', 'disclosures', 'payment', 'comments', 'history', 'find/loan'];
const EXPAND = '.app-panes{display:block!important}.app-cpanel{position:static!important}.app-main--record{height:auto!important;display:block!important}.app-review,.app-work,.app-panes{height:auto!important}.app-pane{max-height:none!important}.app-pane__body,.app-rail,.app-winbody,[data-view],.app-scroll-x{overflow:visible!important;max-height:none!important}';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Pass 1 is the page as laid out: violations and incomplete results. Pass 2 removes the scrolling of the panes for the colour contrast rule only,
// because axe cannot judge text that a scrolling pane clips ("partially obscured": incomplete); contrast does not depend on the scroll position.
// Incomplete results that were checked by hand (MOJ timeline and badge: a pseudo element that axe cannot see through) are counted apart, not hidden.
const HAND = (n) => /moj-(timeline|badge)/.test(n.t) && /pseudoContent|elmPartiallyObscured/.test(n.key || '');
const RUN = async (page, opts) => page.evaluate(async (o) => { const r = await window.axe.run(document, o); const f = (l) => l.flatMap((x) => x.nodes.map((n) => ({ id: x.id, t: n.target.join(' ').slice(0, 70), key: ((n.any[0] || n.all[0] || n.none[0] || {}).data || {}).messageKey }))); return { v: f(r.violations), i: f(r.incomplete) }; }, opts);
async function axeRun(page, label, ruleOut) {
  await page.evaluate(axeSrc);
  const r1a = await RUN(page, { runOnly: { type: 'tag', values: TAGS }, resultTypes: ['violations', 'incomplete'] });
  const r1b = await RUN(page, { runOnly: { type: 'rule', values: ['region', 'landmark-unique'] }, resultTypes: ['violations', 'incomplete'] });
  const r1 = { v: [...r1a.v, ...r1b.v], i: [...r1a.i, ...r1b.i] };
  const vs = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vs.width, 1400), height: 6000 }); // everything inside the window (and wide enough that a table is not clipped), so nothing is judged "obscured" only for lying below the fold or beside the edge
  const st = await page.addStyleTag({ content: EXPAND });
  const r2 = await RUN(page, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations', 'incomplete'] });
  await st.evaluate((e) => e.remove());
  await page.setViewportSize(vs);
  const viol = [...r1.v.filter((x) => x.id !== 'color-contrast'), ...r2.v];
  const incAll = [...r1.i.filter((x) => x.id !== 'color-contrast'), ...r2.i];
  const hand = incAll.filter(HAND), inc = incAll.filter((x) => !HAND(x));
  ruleOut.pages++; ruleOut.byHand = (ruleOut.byHand || 0) + hand.length;
  const show = (l) => [...new Set(l.map((x) => x.id + ' [' + x.t + '] ' + (x.key || '')))].slice(0, 4).join('; ');
  if (viol.length) { ruleOut.violations += viol.length; fail(`axe violation ${label}: ${viol.length} nodes: ${show(viol)}`); }
  if (inc.length) { ruleOut.incomplete += inc.length; fail(`axe incomplete ${label}: ${inc.length} nodes: ${show(inc)}`); }
}
async function axeAll() {
  const out = { pages: 0, violations: 0, incomplete: 0 };
  for (const size of (process.env.AXE_SIZES || '1366x650,1093x525,320x640').split(',').map((x) => x.split('x').map(Number))) {
    for (const f of ['red.html', 'red-rework.html', 'green.html', 'green-ready.html'].filter((x) => !process.env.AXE_FILES || process.env.AXE_FILES.split(',').includes(x))) {
      const page = await open(f, '#/brief', size);
      const secs = [...SECS, ...(f === 'red-rework.html' ? ['changes'] : [])];
      for (const s of secs) { await goHash(page, '#/' + s); await axeRun(page, `${f}#/${s} @${size.join('x')}`, out); }
      if (f === 'red.html') {
        for (const st of ['statements/n-6170', 'statements/n-6155/loading', 'statements/n-6155/failed', 'statements/n-6090', 'flags/01-F03']) { await goHash(page, '#/' + st); await axeRun(page, `${f}#/${st} @${size.join('x')}`, out); }
        // comment panel open, then submitted empty (error state)
        await goHash(page, '#/statements/n-6090'); await page.keyboard.press('c'); await axeRun(page, `comment panel @${size.join('x')}`, out);
        await page.click('[data-comment-form] button.govuk-button'); await page.waitForTimeout(100); await axeRun(page, `comment panel error @${size.join('x')}`, out);
        await goHash(page, '#/flags/01-F03'); await page.click('[data-trace]:not([hidden]) [data-flag-form] button'); await page.waitForTimeout(100); await axeRun(page, `flag decision error @${size.join('x')}`, out);
        await goHash(page, '#/comments/send'); await page.click('[data-sendback-form] button'); await page.waitForTimeout(100); await axeRun(page, `send back error @${size.join('x')}`, out);
        await goHash(page, '#/statements/n-6090'); await page.click('[data-open-source]', { trial: true }).catch(() => {});
        await page.keyboard.press('Escape');
      }
      if (f === 'red-rework.html') { await goHash(page, '#/statements'); await axeRun(page, `rework statements (mark came off) @${size.join('x')}`, out); }
      if (f === 'green-ready.html') { await goHash(page, '#/payment'); await page.click('[data-unmark-open]'); await axeRun(page, `unmark form @${size.join('x')}`, out); }
      await page.ctx.close();
    }
    for (const f of ['queue.html', 'queue-later.html', 'queue-empty.html', 'approved-green.html', 'approved-red.html', 'source-red.html', 'source-green.html', 'notes.html', '../index.html'].filter(() => !process.env.AXE_FILES || process.env.AXE_FILES.split(',').includes('others'))) {
      const page = await open(f, '', size); await axeRun(page, `${f} @${size.join('x')}`, out);
      if (f === 'queue.html') { await page.fill('#q-search', 'zzz'); await page.waitForTimeout(100); await axeRun(page, `queue no match @${size.join('x')}`, out); }
      await page.ctx.close();
    }
  }
  log(`AXE pages ${out.pages}, violations ${out.violations}, incomplete ${out.incomplete}, incomplete checked by hand (MOJ timeline line) ${out.byHand}`);
  results.axe = out;
}

// ------------------------------------------------------------------ reflow at 320 px (WCAG 1.4.10)
async function reflow() {
  let n = 0, bad = 0;
  const pages = ['queue.html', 'queue-later.html', 'queue-empty.html', 'approved-green.html', 'source-green.html', 'notes.html', 'red.html', 'red-rework.html', 'green.html', 'green-ready.html'];
  for (const f of pages) {
    const page = await open(f, f.endsWith('.html') && /^(red|green)/.test(f) ? '#/brief' : '', [320, 640]);
    const routes = /^(red|green)/.test(f) ? ['brief', 'flags', 'statements/n-6090', 'schedule-1', 'losses', 'comments', 'history', 'find/loan'] : [''];
    for (const r of routes) {
      if (r) await goHash(page, '#/' + r);
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
      if (m.sw > m.vw + 1 || m.over.length) { bad++; fail(`reflow ${f}#/${r}: scrollWidth ${m.sw} > ${m.vw}; ${m.over.join(', ')}`); }
    }
    await page.ctx.close();
  }
  log(`REFLOW 320: ${n} views, ${bad} overflow`);
  results.reflow = { n, bad };
}

// ------------------------------------------------------------------ keyboard walk: every control reachable by Tab, focus visible and not covered (rule 11)
async function walk() {
  const out = { stops: 0, unreachable: 0, hidden: 0, nofocus: 0 };
  const INSPECT = () => {
    const sel = 'a[href],button,input,select,textarea,summary,[tabindex="0"]';
    const everything = [...document.querySelectorAll('*')];
    const name = (e) => everything.indexOf(e) + ':' + e.tagName + ':' + (e.id || e.textContent.trim().slice(0, 24));
    const reachable = [...document.querySelectorAll(sel)].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden' && !e.closest('details:not([open]) > :not(summary)') && !e.classList.contains('govuk-skip-link') && e.tabIndex >= 0; });
    // a radio group is one tab stop; the other radios are reached by the arrow keys
    const seenGroup = new Set();
    return reachable.filter((e) => { if (e.type === 'radio') { const g = e.name; if (seenGroup.has(g)) return false; seenGroup.add(g); } return true; }).map(name);
  };
  for (const [f, route] of [['red.html', '#/statements/n-6090'], ['red.html', '#/flags/01-F03'], ['red.html', '#/brief'], ['red.html', '#/comments'], ['green-ready.html', '#/payment'], ['queue.html', '']]) {
    for (const size of SIZES) {
      const page = await open(f, route, size);
      const want = await page.evaluate(INSPECT);
      const seen = new Set();
      for (let i = 0; i < 300; i++) {
        await page.keyboard.press('Tab');
        const s = await page.evaluate(() => {
          const e = document.activeElement; if (!e || e === document.body) return null; const b = e.getBoundingClientRect();
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
  log(`WALK: ${out.stops} tab stops over 12 views, ${out.unreachable} controls not reached, ${out.hidden} focused controls covered, ${out.nofocus} without a focus style`);
  results.walk = out;
}

// ------------------------------------------------------------------ budgets, with page loads counted as full document navigations (rule 18)
async function budgets() {
  const rep = [];
  for (const size of SIZES) {
    const tag = size.join('x');
    // open a return from the queue
    let page = await open('queue.html', '', size);
    let loads = 0; page.on('load', () => { loads++; });
    let t0 = Date.now(); let clicks = 0;
    await page.click('[data-q-open] >> text=Maple Ridge'); clicks++; await page.waitForSelector('[data-row]', { state: 'attached' }); await page.waitForSelector('[data-count-reviewed]');
    rep.push([`open a return @${tag}`, `loads ${loads}, clicks ${clicks}, ${Date.now() - t0} ms`]);
    if (loads !== 1) fail(`open return loads ${loads} @${tag}`);
    // brief fits: six numbers, tier and first flags on the first screen
    const fit = await page.evaluate(() => { const vh = innerHeight; const tiles = [...document.querySelectorAll('.app-tile')].map((e) => e.getBoundingClientRect().bottom); const strip = document.querySelector('.app-brief .app-strip').getBoundingClientRect().bottom; const rows = [...document.querySelectorAll('[data-panel="brief"] tbody tr')].map((e) => e.getBoundingClientRect()); const first = rows[0]; const pane = document.querySelector('[data-list-body]').getBoundingClientRect(); return { vh, tilesBottom: Math.max(...tiles), strip, firstFlagTop: first.top, firstFlagBottom: first.bottom, secondFlagTop: rows[1].top, secondBottom: rows[1].bottom, paneBottom: pane.bottom, docH: document.documentElement.scrollHeight, nvisible: rows.filter((r) => r.bottom <= pane.bottom).length }; });
    rep.push([`brief on the first screen @${tag}`, `six numbers end ${Math.round(fit.tilesBottom)} px, tier line ends ${Math.round(fit.strip)}, flag rows fully visible ${fit.nvisible}, viewport ${fit.vh}, pane ends ${Math.round(fit.paneBottom)}, page height ${fit.docH}`]);
    if (fit.tilesBottom > fit.vh || (size[0] === 1366 && fit.nvisible < 1)) fail(`brief does not fit @${tag}: ${JSON.stringify(fit)}`);
    // start review, then the first flags
    await page.click('text=Start review: Flags'); await page.waitForTimeout(100);
    // open a number's source: click, time to the boxed figure
    await goHash(page, '#/statements'); loads = 0;
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-panel="stmt"] [data-row]')].map((r) => r.getAttribute('data-row')));
    const target = ids.filter((i) => /^n-6\d\d\d/.test(i))[2];
    t0 = Date.now();
    await page.click(`[data-row="${target}"] [data-pick]`);
    await page.waitForSelector('.app-source__hit:visible, .app-hit:visible', { timeout: 1500 }); const dt = Date.now() - t0;
    const box = await page.evaluate(() => { const b = document.querySelector('[data-source-body]').getBoundingClientRect(); const h = [...document.querySelectorAll('.app-source__hit,.app-hit,.app-card')].find((e) => e.getBoundingClientRect().height > 0); const r = h.getBoundingClientRect(); return { inPane: r.top >= b.top - 1 && r.bottom <= b.bottom + 1, focusInSource: document.activeElement === document.querySelector('[data-source-body]'), paneH: Math.round(b.height) }; });
    rep.push([`open a number's source @${tag}`, `loads ${loads}, clicks 1, ${dt} ms (incl. tool overhead), figure in view ${box.inPane}, focus moved to the source ${box.focusInSource}`]);
    if (loads) fail(`source open caused a load @${tag}`); if (!box.inPane) fail(`boxed figure not in view @${tag}`); if (!box.focusInSource) fail(`focus not in the source @${tag}`); if (dt > 1000) fail(`source took ${dt} ms @${tag}`);
    const hist = await page.evaluate(() => history.length); await page.keyboard.press('Escape'); await page.click(`[data-row="${ids.filter((i) => /^n-6\d\d\d/.test(i))[3]}"] [data-pick]`); const hist2 = await page.evaluate(() => history.length);
    rep.push([`history entries added by opening sources @${tag}`, `${hist2 - hist}`]); if (hist2 !== hist) fail(`opening a source added history @${tag}`);
    // timings in the page (no tool overhead): key to DOM done
    const time = await page.evaluate(async () => { const t = async (k) => { const a = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await new Promise((r) => requestAnimationFrame(() => r())); return Math.round(performance.now() - a); }; return { j: await t('j'), k: await t('k'), f: await t('f'), n: await t('n'), next: await t(']'), prev: await t('[') }; });
    rep.push([`key to result in the page @${tag}`, JSON.stringify(time)]); if (time.j > 200 || time.f > 200 || time.n > 200 || time.next > 300) fail(`key too slow @${tag}: ${JSON.stringify(time)}`);
    // mark reviewed: 1 key, 0 loads
    await goHash(page, '#/schedule-1'); loads = 0; await page.keyboard.press('r'); await page.waitForTimeout(150);
    const mk = await page.evaluate(() => ({ route: location.hash, on: document.querySelector('[data-count-reviewed]').textContent })); rep.push([`Reviewed, next @${tag}`, `1 key, loads ${loads}, now ${mk.route}, ${mk.on} reviewed`]); if (loads) fail('mark caused a load');
    // comment: c, type, severity, text, add
    await goHash(page, '#/statements/n-6090'); const before = await page.evaluate(() => document.querySelector('[data-comment-count]').textContent); t0 = Date.now(); loads = 0;
    await page.keyboard.press('c'); await page.click('label[for="type-0"]'); await page.click('label[for="severity-1"]'); await page.fill('#text', 'Please attach the receipts.'); await page.click('[data-comment-form] button.govuk-button');
    await page.waitForTimeout(100); const after = await page.evaluate(() => document.querySelector('[data-comment-count]').textContent);
    rep.push([`comment @${tag}`, `loads ${loads}, 1 key + 3 fields + 1 submit, ${Date.now() - t0} ms, comments ${before} -> ${after}, trace pane lists it: ${await page.evaluate(() => document.querySelector('[data-trace="n-6090"] [data-notes]').textContent.includes('Please attach'))}`]);
    if (loads || +after !== +before + 1) fail(`comment budget @${tag}`);
    // whole return: j through every number, r on each section
    let keys = 0; await goHash(page, '#/flags'); const total = await page.evaluate(() => [...document.querySelectorAll('[data-row]')].length);
    for (let i = 0; i < total + 5; i++) { await page.keyboard.press('j'); keys++; }
    rep.push([`walk every number by j @${tag}`, `${total} rows, ${keys} keys, ends at ${await page.evaluate(() => location.hash)}`]);
    await page.ctx.close();
    // approve with every section marked: 1 load, 1 click
    page = await open('green-ready.html', '#/brief', size); loads = 0; page.on('load', () => { loads++; });
    t0 = Date.now(); await page.click('[data-approve]'); await page.waitForSelector('.govuk-panel'); rep.push([`approve @${tag}`, `loads ${loads}, clicks 1, ${Date.now() - t0} ms`]); if (loads !== 1) fail('approve loads');
    await page.ctx.close();
    // panes never stack
    page = await open('red.html', '#/statements/n-6090', size);
    const pn = await page.evaluate(() => [...document.querySelectorAll('.app-pane')].map((p) => { const b = p.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }));
    const stacked = new Set(pn.map((p) => p[1])).size > 1; rep.push([`three panes side by side @${tag}`, `${JSON.stringify(pn)} stacked: ${stacked}`]); if (stacked) fail(`panes stacked @${tag}`);
    const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight, srcH: Math.round(document.querySelector('[data-source-body]').getBoundingClientRect().height), listH: Math.round(document.querySelector('[data-list-body]').getBoundingClientRect().height) }));
    // readable text and rows visible beside a pane (rule 18)
    const rt = await page.evaluate(() => {
      const skip = '.govuk-tag,.moj-badge,.app-dot,.app-flagmark,.app-madeup,.app-madeup-note,button,kbd,.govuk-hint,.app-caption,.app-source__label,.app-pane__sub';
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
    rep.push([`readable text and rows beside a pane @${tag}`, `smallest body text ${rt.min.body} px over ${rt.min.bodyN} text nodes (offenders: ${JSON.stringify(rt.bad)}), smallest source text ${rt.min.src} px, ${rt.rows} return rows fully visible in a ${rt.listH} px list pane`]);
    if (rt.min.body < 16 || rt.min.src < 12) fail(`text too small @${tag}: ${JSON.stringify(rt)}`);
    rep.push([`record page height @${tag}`, `page ${doc.h} px for a ${doc.vh} px window; list body ${doc.listH} px, source body ${doc.srcH} px`]);
    await page.ctx.close();
  }
  rep.forEach((r) => log('BUDGET', r[0], '|', r[1]));
  results.budgets = rep;
}

// ------------------------------------------------------------------ rules in action
async function rules() {
  const R = [];
  const chk = (name, cond, extra = '') => { R.push([name, cond]); if (cond) ok(name + (extra ? ': ' + extra : '')); else fail(name + (extra ? ': ' + extra : '')); };
  let page = await open('red.html', '#/statements/n-6090');
  // 22: r on a reviewed section never unmarks; a never approves
  await goHash(page, '#/statements'); const before = await page.evaluate(() => document.querySelector('[data-count-reviewed]').textContent);
  await page.keyboard.press('r'); await page.waitForTimeout(100); const after = await page.evaluate(() => document.querySelector('[data-count-reviewed]').textContent);
  chk('rule 22: r on a Reviewed section never unmarks', +after >= +before, `${before} -> ${after}`);
  const noUnmarkKey = await page.evaluate(() => !document.querySelector('[aria-keyshortcuts]') || ![...document.querySelectorAll('[data-unmark-open]')].some((e) => e.hasAttribute('aria-keyshortcuts')));
  chk('rule 22: the unmark control has no shortcut', noUnmarkKey);
  await goHash(page, '#/statements'); await page.evaluate(() => document.querySelector('[data-unmark-open]').click()); await page.waitForTimeout(80);
  await page.click('[data-unmark-form] button.govuk-button'); await page.waitForTimeout(80);
  chk('unmark needs a reason (error shown)', await page.evaluate(() => !document.querySelector('#um-err').hidden));
  await page.fill('#um-why', 'Checked again, a number moved.'); await page.click('[data-unmark-form] button.govuk-button'); await page.waitForTimeout(80);
  chk('unmark with a reason takes the mark off', await page.evaluate(() => +document.querySelector('[data-count-reviewed]').textContent === 0));
  // reviewed next marks and moves on
  const flagsOpen = await page.evaluate(() => document.querySelector('[data-rail-mark="flags"]').textContent);
  await goHash(page, '#/statements'); await page.keyboard.press('r'); await page.waitForTimeout(150);
  chk('Reviewed, next marks and moves to the next section', await page.evaluate(() => location.hash.startsWith('#/schedule-1')), await page.evaluate(() => location.hash));
  // approve key
  await page.keyboard.press('a'); chk('rule 22: key a does not approve (no navigation)', page.url().includes('red.html'));
  // flags section: mark absent while a flag is open (rule 8)
  await goHash(page, '#/flags'); chk('rule 8: no Reviewed button while a flag is open', await page.evaluate(() => !document.querySelector('[data-reviewed-next]')));
  // decide all flags in place, 0 loads
  let loads = 0; page.on('load', () => { loads++; });
  let guard = 0; while (guard++ < 12) { const open = await page.evaluate(() => [...document.querySelectorAll('[data-flag-state]')].some((e) => e.textContent.startsWith('Open')) && !!document.querySelector('[data-trace]:not([hidden]) [data-flag-form] input')); if (!open) break; await page.click('[data-trace]:not([hidden]) [data-flag-form] label[for$="-a"]'); await page.click('[data-trace]:not([hidden]) [data-flag-form] button'); await page.waitForTimeout(80); }
  chk('rule 19: flag decisions run in place (0 loads)', loads === 0);
  chk('Reviewed, next appears once no flag is open', await page.evaluate(() => !!document.querySelector('[data-reviewed-next]')));
  // flags: "answered by preparer" apart from "accepted by CPA"
  const flagTxt = await page.evaluate(() => document.querySelector('[data-panel="flags"]').textContent);
  chk('flags show preparer answer apart from CPA acceptance', /Answered by preparer/.test(flagTxt) && /Accepted by CPA/.test(flagTxt) && /Left for you/.test(flagTxt));
  // 5 section changes are client side, own url
  loads = 0; await page.click('[data-rail="schedule-1"], [data-rail="s1"]'); await page.waitForTimeout(80);
  chk('rule 18: a section change is a client-side route with its own URL (0 loads)', loads === 0 && (await page.evaluate(() => location.hash)).startsWith('#/schedule-1'));
  // counts agree
  await page.click('[data-tab="comments"]'); await page.waitForTimeout(80);
  const cnt = await page.evaluate(() => ({ badge: +document.querySelector('[data-comment-count]').textContent, rows: document.querySelectorAll('[data-comments-list] tbody tr').length }));
  chk('counts agree: Comments badge equals the rows in the list', cnt.badge === cnt.rows, JSON.stringify(cnt));
  const rc = await page.evaluate(() => ({ tag: +document.querySelector('[data-count-reviewed]').textContent, rail: document.querySelectorAll('.app-rail__mark--on').length, bar: document.querySelector('progress') ? 0 : 0 }));
  chk('counts agree: identity bar Reviewed count equals rail marks', rc.tag === rc.rail, JSON.stringify(rc));
  // search
  await page.click('[data-tab="review"]'); await page.fill('#find-q', 'a'); await page.press('#find-q', 'Enter'); await page.waitForTimeout(100);
  chk('rule 21: a search with many matches shows a results page', await page.evaluate(() => location.hash.startsWith('#/find/') && document.querySelectorAll('[data-find-results] tbody tr').length > 1));
  await page.fill('#find-q', 'Dividend paid'); await page.press('#find-q', 'Enter'); await page.waitForTimeout(100);
  chk('rule 21: a search with one match goes to it', await page.evaluate(() => location.hash.startsWith('#/dividends/')), await page.evaluate(() => location.hash));
  // send back in place
  await goHash(page, '#/comments/send'); await page.fill('#sb-text', 'Please attach the five receipts.'); await page.click('[data-sendback-form] button'); await page.waitForTimeout(100);
  chk('send back runs in place and confirms', await page.evaluate(() => !!document.querySelector('[data-sb-done]')));
  await page.ctx.close();
  // second window follows selection and tab changes
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 650 } }); ctx.setDefaultTimeout(4000); const p = await ctx.newPage(); await p.goto(url('red.html', '#/statements/n-6090')); await p.waitForTimeout(300);
  const popupP = ctx.waitForEvent('page'); await p.click('[data-open-source]'); const w = await popupP; await w.waitForLoadState(); await w.waitForTimeout(600);
  chk('second window opened by script from a click', !!w);
  const cap1 = await w.evaluate(() => document.querySelector('[data-srcset]:not([hidden]) .app-caption, [data-source-caption]:not([hidden])') && (document.querySelector('[data-source]:not([hidden]) .app-caption') || document.querySelector('[data-source-caption]')).textContent);
  await p.bringToFront(); await p.click('[data-row="n-6095"] [data-pick]'); await w.waitForTimeout(400);
  const cap2 = await w.evaluate(() => (document.querySelector('[data-source]:not([hidden]) .app-caption') || {}).textContent);
  chk('second window follows a number', cap1 !== cap2 && !!cap2, `${cap1} -> ${cap2}`);
  const srcLabel = await w.evaluate(() => document.querySelector('[data-win-for]').textContent);
  await p.click('[data-rail="s1"], [data-rail="schedule-1"]'); await w.waitForTimeout(400);
  const lab2 = await w.evaluate(() => document.querySelector('[data-win-for]').textContent);
  chk('second window follows a section change', srcLabel !== lab2, `${srcLabel} -> ${lab2}`);
  await p.click('[data-tab="history"]'); await w.waitForTimeout(400);
  chk('second window follows a tab change', /History/.test(await w.evaluate(() => document.querySelector('[data-win-for]').textContent)));
  await p.click('[data-tab="review"]'); await p.waitForTimeout(100); await goHash(p, '#/flags/01-F03'); await w.waitForTimeout(400);
  const flagCap = await w.evaluate(() => (document.querySelector('[data-source]:not([hidden]) .app-caption') || {}).textContent);
  chk('a flag shows its own cited evidence', /Cited evidence/.test(flagCap || ''), flagCap);
  const win = await p.evaluate(() => document.querySelector('[data-source-win]').textContent); chk('main window shows the second window is following', /open, following/.test(win), win);
  await ctx.close();
  // queue: filters, back keeps them, previous and next follow the list
  page = await open('queue.html'); await page.selectOption('#q-state', 'Back from rework'); await page.waitForTimeout(80);
  chk('queue: Back from rework view with none shows an empty message', await page.evaluate(() => !document.querySelector('[data-q-empty]').hidden));
  await page.selectOption('#q-state', ''); await page.selectOption('#q-tier', 'green'); await page.fill('#q-search', 'queen'); await page.waitForTimeout(80);
  await page.click('[data-q-open]:visible'); await page.waitForTimeout(300);
  chk('queue to record in one load, queue filters kept in session', page.url().includes('green.html'));
  await page.click('[data-queue-back]'); await page.waitForTimeout(300);
  chk('rule 21: Back returns to the queue with its filters', await page.evaluate(() => document.querySelector('#q-tier').value === 'green' && document.querySelector('#q-search').value === 'queen'));
  await page.ctx.close();
  results.rules = R;
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
      for (const [f, h] of [['red.html', '#/brief'], ['red.html', '#/flags/01-F03'], ['red.html', '#/statements/n-6090'], ['red.html', '#/comments'], ['red.html', '#/comments/send'], ['red.html', '#/history'], ['red-rework.html', '#/changes'], ['green.html', '#/brief'], ['green-ready.html', '#/payment'], ['queue.html', ''], ['queue-empty.html', ''], ['approved-green.html', '']]) {
        const page = await open(f, h, size); A('V1', L(`${f}${h}`), await R.V1(page)); await page.ctx.close();
      }
      { const page = await open('red.html', '#/statements/n-6090', size); await page.keyboard.press('c'); await page.waitForTimeout(150); A('V1', L('comment panel open, typing'), await R.V1(page)); await page.ctx.close(); }
      { const page = await open('green-ready.html', '#/payment', size); await page.evaluate(() => document.querySelector('[data-unmark-open]').click()); await page.waitForTimeout(100); A('V1', L('unmark form open, typing'), await R.V1(page)); await page.ctx.close(); }
    }
    // ---- V2: in-place actions leave scroll and the identity bar alone
    if (want('V2')) {
      const page = await open('red.html', '#/statements/n-6090', size);
      const acts = [
        { name: 'pick a number', click: rowBtn('n-6095') }, { name: 'j', press: 'j' }, { name: 'k', press: 'k' }, { name: 'f (next flag)', press: 'f' },
        { name: 'open comment panel', run: async (p) => { await p.evaluate(() => { location.hash = '#/statements/n-6090'; }); await p.waitForTimeout(100); await p.keyboard.press('c'); } },
        { name: 'cancel comment', click: '[data-comment-cancel]' },
        { name: 'section from the rail or the select', run: async (p) => { if (await p.locator('[data-rail="s1"]').isVisible()) await p.click('[data-rail="s1"]'); else await p.selectOption('[data-section-pick]', '#/schedule-1'); } },
        { name: 'n (next section)', press: 'n' }, { name: 'r (Reviewed, next)', press: 'r' },
        { name: 'record a flag decision', run: async (p) => { await p.evaluate(() => { location.hash = '#/flags/01-F03'; }); await p.waitForTimeout(100); await p.click('[data-trace]:not([hidden]) [data-flag-form] label[for$="-a"]'); await p.click('[data-trace]:not([hidden]) [data-flag-form] button'); } },
        { name: 'comment panel error', run: async (p) => { await p.evaluate(() => { location.hash = '#/statements/n-6090'; }); await p.waitForTimeout(100); await p.keyboard.press('c'); await p.click('[data-comment-form] button.govuk-button'); } },
      ];
      for (const a of acts) A('V2', L(a.name), await R.V2(page, a));
      await page.ctx.close();
    }
    // ---- V3: the evidence and the primary action in view, no page scroll, in every pane state
    if (want('V3')) {
      for (const [f, h, lab] of [['red.html', '#/statements/n-6090', 'number with a source'], ['red.html', '#/statements/n-6170', 'number with no evidence'], ['red.html', '#/flags/01-F03', 'flag with cited evidence'], ['red.html', '#/schedule-1', 'Schedule 1 first number'], ['red.html', '#/losses', 'losses'], ['red.html', '#/payment', 'payment and filing'], ['red-rework.html', '#/statements', 'back from rework'], ['green.html', '#/statements', 'green return'], ['green-ready.html', '#/payment', 'green, section marked']]) {
        const page = await open(f, h, size); A('V3', L(`${lab} (${f}${h})`), await R.V3(page)); await page.ctx.close();
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
        { name: 'j', press: 'j', expect: '[data-pick]' },
        { name: 'Back after a section change', run: async (p) => { await p.evaluate(() => { location.hash = '#/schedule-1'; }); await p.waitForTimeout(150); await p.goBack(); }, expect: '#route-title, [data-pick]' },
        { name: 'r (Reviewed, next)', press: 'r', expect: '[data-pick], #route-title' },
      ];
      for (const a of acts) A('V4', L(a.name), await R.V4(page, a));
      await page.evaluate(() => { location.hash = '#/statements/n-6090'; }); await page.waitForTimeout(150);
      A('V4', L('shortcuts j k f ] [ o n r a c'), await R.V4(page, null, { shortcuts: [
        { key: 'j', selector: '[data-pick]' }, { key: 'k', selector: '[data-pick]' }, { key: 'f', selector: '[data-pick]' },
        { key: ']', selector: '[data-source-body]' }, { key: '[', selector: '[data-source-body]' }, { key: 'o', selector: '[data-open-source]' },
        { key: 'n', selector: '[data-pick], #route-title' }, { key: 'r', selector: '[data-pick], #route-title' },
        { key: 'a', selector: '[data-approve], .app-approvehint a' }, { key: 'c', selector: '#type-0' }] }));
      await page.ctx.close();
      const pg2 = await open('green.html', '#/brief', size);
      A('V4', L('a with sections left focuses "Approve: N sections left"'), await R.V4(pg2, { name: 'a', press: 'a', expect: '.app-approvehint a' }));
      const said = await pg2.evaluate(() => document.getElementById('app-live').textContent);
      A('V4', L('a announces why'), { ok: /not ready: \d+ of 11 sections left/.test(said), failures: [`live region says "${said}"`] });
      await pg2.ctx.close();
      const pg3 = await open('green-ready.html', '#/brief', size);
      A('V4', L('a with every section Reviewed focuses Approve return'), await R.V4(pg3, { name: 'a', press: 'a', expect: '[data-approve]' }));
      await pg3.ctx.close();
    }
    // ---- V5: counts carry their scope; the same count is the same number on every page of one return
    if (want('V5')) {
      const seen = [];
      for (const h of ['#/brief', '#/flags', '#/statements/n-6090', '#/comments', '#/history']) { const page = await open('red.html', h, size); const r = await R.V5(page); A('V5', L(`red.html${h}`), r); seen.push(r); await page.ctx.close(); }
      A('V5', L('red.html: same count, same number across pages'), R.V5same(seen));
      const seenG = []; for (const h of ['#/brief', '#/comments', '#/payment']) { const page = await open('green.html', h, size); const r = await R.V5(page); A('V5', L(`green.html${h}`), r); seenG.push(r); await page.ctx.close(); }
      A('V5', L('green.html: same count, same number across pages'), R.V5same(seenG));
      const q = await open('queue.html', '', size); A('V5', L('queue.html'), await R.V5(q));
      A('V5', L('queue caption updates with a filter'), await R.V5caption(q, { name: 'tier filter', run: (p) => p.selectOption('#q-tier', 'green') }, { caption: '[data-q-count]' })); await q.ctx.close();
    }
    // ---- V6: search keeps its promise
    if (want('V6')) {
      const page = await open('red.html', '#/brief', size);
      A('V6', L('Find a number: name and account number'), await R.V6(page, { input: '#find-q', result: '[data-find-results] tbody tr, [data-row].is-selected', label: '#find-hint', kinds: [{ kind: 'name', value: 'Dividend paid' }, { kind: 'account number', value: '6090' }] }));
      await page.ctx.close();
      const q = await open('queue.html', '', size);
      A('V6', L('Queue: search by name'), await R.V6(q, { input: '#q-search', result: 'tbody tr:not([hidden])', label: 'label[for="q-search"]', kinds: [{ kind: 'name', value: 'Queen West Design Studio Inc. (Test)' }] })); await q.ctx.close();
    }
    // ---- V7: every click does something
    if (want('V7')) {
      for (const [f, h, lab] of [['red.html', '#/brief', 'brief'], ['red.html', '#/statements/n-6090', 'a number picked'], ['red.html', '#/flags/01-F03', 'a flag'], ['red.html', '#/comments', 'comments'], ['green-ready.html', '#/payment', 'every section Reviewed, last section'], ['queue.html', '', 'queue'], ['approved-green.html', '', 'approved']]) {
        const page = await open(f, h, size);
        A('V7', L(`${lab} (${f}${h})`), await R.V7(page, { selector: 'button, a[href]:not(.govuk-skip-link), [role=button], input[type=submit], summary', limit: 70, reset: async (p) => { await p.goto('about:blank'); await p.goto(url(f, h)); await p.waitForTimeout(200); } })); await page.ctx.close();
      }
    }
    if (want('V7')) {
      // the skip link is visually hidden until focused, so the shared check cannot click it: Tab to it, press Enter, and the route must stay and focus must land on the heading
      const page = await open('red.html', '#/statements/n-6090', size); await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
      const st = await page.evaluate(() => ({ hash: location.hash, active: document.activeElement && document.activeElement.id }));
      A('V7', L('skip link keeps the route and focuses the heading'), { ok: st.hash === '#/statements/n-6090' && st.active === 'route-title', failures: [JSON.stringify(st)] }); await page.ctx.close();
    }
    // ---- V8: no field on these pages is tied to an option, so there is nothing to type into (checked: every text field is a stand-alone field)
    if (want('V8')) {
      const page = await open('red.html', '#/statements/n-6090', size); await page.keyboard.press('c');
      const tied = await page.evaluate(() => [...document.querySelectorAll('input[type=text],input[type=search],textarea')].filter((e) => e.closest('.govuk-radios__conditional, .govuk-checkboxes__conditional')).length);
      A('V8', L('no text field is a conditional of a radio or checkbox'), { ok: tied === 0, failures: [`${tied} fields tied to an option: run R.V8 on them`] });
      await page.ctx.close();
    }
  }
  log(`V1 TO V8: ${out.run} checks, ${out.bad} failing; by rule ${JSON.stringify(out.byRule)}; comment panel ${JSON.stringify(results.cpanel)}`);
  results.v = out;
}

// ------------------------------------------------------------------ re-walk of tasks 5, 6 and 7 of the brief (round 2): counts of loads, clicks and keys
async function tasks() {
  const rep = [];
  const t = (name, cond, extra) => { rep.push([name, cond, extra]); if (cond) ok(`${name}: ${extra}`); else fail(`${name}: ${extra}`); };
  for (const size of SIZES) {
    const tag = size.join('x');
    // task 5: check one number (pick, source beside it, next number, next source, back)
    let page = await open('red.html', '#/statements', size); let loads = 0; page.on('load', () => { loads++; });
    await page.click('[data-row="n-6095"] [data-pick]'); await page.waitForTimeout(150);
    const s5 = await page.evaluate(() => { const h = document.querySelector('[data-source]:not([hidden]) [data-evidence]'); const b = document.querySelector('[data-source-body]').getBoundingClientRect(); const r = h && h.getBoundingClientRect(); return { hit: !!r, inView: !!r && r.top >= b.top - 1 && r.bottom <= b.bottom + 1, focusSource: document.activeElement === document.querySelector('[data-source-body]'), scrollY: scrollY, trace: !!document.querySelector('[data-trace="n-6095"]:not([hidden])') }; });
    t(`task 5 pick a number @${tag}`, loads === 0 && s5.hit && s5.inView && s5.focusSource && s5.trace && s5.scrollY <= 8, `1 click, ${loads} loads, boxed figure in view ${s5.inView}, focus in source ${s5.focusSource}, trace beside it ${s5.trace}, page scroll ${s5.scrollY}`);
    const before = await page.evaluate(() => location.hash); await page.keyboard.press('j'); await page.waitForTimeout(120);
    const after = await page.evaluate(() => ({ h: location.hash, src: !!document.querySelector('[data-source]:not([hidden]) [data-evidence]'), act: document.activeElement.hasAttribute('data-pick') }));
    t(`task 5 j to the next number @${tag}`, after.h !== before && after.src && after.act && loads === 0, `1 key, ${before} -> ${after.h}, source shown ${after.src}, focus on the row ${after.act}, ${loads} loads`);
    await page.keyboard.press(']'); await page.waitForTimeout(120);
    const cap1 = await page.evaluate(() => (document.querySelector('[data-source]:not([hidden]) .app-caption') || {}).textContent);
    await page.keyboard.press('['); await page.waitForTimeout(120);
    const cap2 = await page.evaluate(() => (document.querySelector('[data-source]:not([hidden]) .app-caption') || {}).textContent);
    t(`task 5 next and previous source @${tag}`, cap1 !== cap2, `${cap2} | ${cap1}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(80);
    const back = await page.evaluate(() => document.activeElement.hasAttribute('data-pick'));
    t(`task 5 Escape returns to the number @${tag}`, back, `focus on the row ${back}`);
    await page.ctx.close();
    // task 6: comment on a number
    page = await open('red.html', '#/statements/n-6090', size); loads = 0; page.on('load', () => { loads++; });
    const c0 = await page.evaluate(() => +document.querySelector('[data-comment-count]').textContent);
    await page.keyboard.press('c'); await page.waitForTimeout(120);
    const pan = await page.evaluate(() => { const p = document.querySelector('[data-comment-host]').getBoundingClientRect(); const tr = document.querySelector('.app-pane--trace').getBoundingClientRect(); const so = document.querySelector('.app-pane--source').getBoundingClientRect(); const bt = document.querySelector('.app-cp [data-primary]').getBoundingClientRect(); return { coversTraceAndSource: p.left <= tr.left + 1 && p.right >= so.right - 1, btnInView: bt.bottom <= innerHeight && bt.top >= 0, caption: document.querySelector('[data-cp-caption]').textContent, fields: document.querySelectorAll('.app-cp [data-g]').length, innerScroll: (b => b.scrollHeight > b.clientHeight + 1)(document.querySelector('.app-cp__body')) }; });
    t(`task 6 panel opens over trace and source @${tag}`, pan.coversTraceAndSource && pan.btnInView && pan.fields === 3 && !pan.innerScroll && /^Source: /.test(pan.caption), `1 key, 3 fields, no scrolling inside ${!pan.innerScroll}, Add comment in view ${pan.btnInView}, header "${pan.caption}"`);
    await page.click('label[for="type-0"]'); await page.click('label[for="severity-1"]'); await page.fill('#text', 'Please attach the receipts.'); await page.click('[data-comment-form] button.govuk-button'); await page.waitForTimeout(150);
    const c1 = await page.evaluate(() => ({ n: +document.querySelector('[data-comment-count]').textContent, listed: document.querySelector('[data-trace="n-6090"] [data-notes]').textContent.includes('Please attach'), row: document.activeElement.hasAttribute('data-pick'), closed: !document.querySelector('[data-comment-host]').hasAttribute('data-open'), scrollY }));
    t(`task 6 submit @${tag}`, c1.n === c0 + 1 && c1.listed && c1.row && c1.closed && loads === 0 && c1.scrollY <= 8, `1 key + 3 fields + 1 submit, ${loads} loads, comments ${c0} -> ${c1.n}, trace lists it ${c1.listed}, focus back on the row ${c1.row}`);
    await page.ctx.close();
    // task 7: approve
    page = await open('green.html', '#/brief', size);
    await page.keyboard.press('a'); await page.waitForTimeout(100);
    const a1 = await page.evaluate(() => ({ foc: document.activeElement.matches('.app-approvehint a') && document.activeElement.textContent, live: document.getElementById('app-live').textContent }));
    t(`task 7 a with sections left @${tag}`, /^Approve: \d+ sections left$/.test(a1.foc || '') && /not ready/.test(a1.live), `focus on "${a1.foc}", says "${a1.live}"`);
    for (const slug of ['flags', 'statements', 'schedule-1', 'capital', 'losses', 'rate', 'dividends', 'shareholders', 'ontario', 'disclosures', 'payment']) {
      await goHash(page, '#/' + slug);
      let g = 0; while (g++ < 12 && (await page.evaluate(() => !!document.querySelector('[data-trace]:not([hidden]) [data-flag-form] input')))) { await page.click('[data-trace]:not([hidden]) [data-flag-form] label[for$="-a"]'); await page.click('[data-trace]:not([hidden]) [data-flag-form] button'); await page.waitForTimeout(80); }
      if (slug === 'flags' && (await page.evaluate(() => !document.querySelector('[data-reviewed-next]')))) await goHash(page, '#/flags');
      await page.keyboard.press('r'); await page.waitForTimeout(100);
    }
    const n7 = await page.evaluate(() => ({ n: +document.querySelector('[data-count-reviewed]').textContent, ap: !!document.querySelector('[data-approve]') }));
    t(`task 7 all 11 marks, Approve shows @${tag}`, n7.n === 11 && n7.ap, `${n7.n} of 11 marked, Approve return shown ${n7.ap}`);
    await page.keyboard.press('a'); await page.waitForTimeout(80);
    const a2 = await page.evaluate(() => document.activeElement.hasAttribute('data-approve'));
    loads = 0; page.on('load', () => { loads++; });
    await page.keyboard.press('Enter'); await page.waitForSelector('.govuk-panel', { timeout: 3000 }).catch(() => {});
    const ap = await page.evaluate(() => ({ panel: !!document.querySelector('.govuk-panel'), rows: document.querySelectorAll('tbody tr').length, next: !!document.querySelector('[data-queue-next-link]') }));
    t(`task 7 a, then Enter approves @${tag}`, a2 && ap.panel && ap.rows >= 12 && ap.next, `a focused Approve ${a2}, 1 key + Enter, ${loads} load, record rows ${ap.rows}, next return link ${ap.next}`);
    await page.ctx.close();
  }
  results.tasks = rep;
}

try {
  if (which === 'tasks' || which === 'all') await tasks();
  if (which === 'v' || which === 'all') await rulesV();
  if (which === 'axe' || which === 'all') await axeAll();
  if (which === 'reflow' || which === 'all') await reflow();
  if (which === 'walk' || which === 'all') await walk();
  if (which === 'budgets' || which === 'all') await budgets();
  if (which === 'rules' || which === 'all') await rules();
} finally { await browser.close(); server.close(); }
log(`\nTOTAL failures: ${results.fail}`);
process.exit(results.fail ? 1 : 0);
