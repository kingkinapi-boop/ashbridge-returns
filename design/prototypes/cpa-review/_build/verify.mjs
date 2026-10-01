// Designer self-check (design card checks 7 and 8): axe (incomplete counts as a failure), keyboard walk, 320 px reflow, budgets at both sizes,
// and the in-place rules (18 to 23). Nothing is installed globally: set AUDIT_MODULES to a folder that holds playwright-core and axe-core.
//   node tools/heavy.mjs -- node design/prototypes/cpa-review/_build/verify.mjs [axe|walk|reflow|budgets|rules|all]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const req = createRequire(path.join(process.env.AUDIT_MODULES, 'package.json'));
const { chromium } = req('playwright-core');
const axeSrc = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const DIR = path.resolve('design/prototypes/cpa-review/v1-record-tabs');
const url = (f, hash = '') => 'file:///' + path.join(DIR, f).replace(/\\/g, '/') + hash;
const SIZES = [[1366, 650], [1093, 525]];
const which = process.argv[2] || 'all';
const results = { fail: 0 };
const log = (...a) => console.log(...a);
const fail = (m) => { results.fail++; log('FAIL', m); };
const ok = (m) => log('ok  ', m);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
async function open(f, hash = '', size = [1366, 650]) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, acceptDownloads: false });
  ctx.setDefaultTimeout(4000);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(url(f, hash), { waitUntil: 'load' });
  await page.waitForTimeout(250);
  page.ctx = ctx;
  return page;
}
const goHash = async (page, h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(120); };

// ------------------------------------------------------------------ axe
const SECS = ['brief', 'flags', 'statements', 'schedule-1', 'capital', 'losses', 'rate', 'dividends', 'shareholders', 'ontario', 'disclosures', 'payment', 'comments', 'history', 'find/loan'];
const EXPAND = '.app-main--record{height:auto!important;display:block!important}.app-review,.app-work,.app-panes{height:auto!important}.app-pane{max-height:none!important}.app-pane__body,.app-rail,.app-winbody,[data-view],.app-scroll-x{overflow:visible!important;max-height:none!important}';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Pass 1 is the page as laid out: violations and incomplete results. Pass 2 removes the scrolling of the panes for the colour contrast rule only,
// because axe cannot judge text that a scrolling pane clips ("partially obscured": incomplete); contrast does not depend on the scroll position.
// Incomplete results that were checked by hand (MOJ timeline and badge: a pseudo element that axe cannot see through) are counted apart, not hidden.
const HAND = (n) => /moj-(timeline|badge)/.test(n.t) && /pseudoContent|elmPartiallyObscured/.test(n.key || '');
const RUN = async (page, opts) => page.evaluate(async (o) => { const r = await window.axe.run(document, o); const f = (l) => l.flatMap((x) => x.nodes.map((n) => ({ id: x.id, t: n.target.join(' ').slice(0, 70), key: ((n.any[0] || n.all[0] || n.none[0] || {}).data || {}).messageKey }))); return { v: f(r.violations), i: f(r.incomplete) }; }, opts);
async function axeRun(page, label, ruleOut) {
  await page.evaluate(axeSrc);
  const r1 = await RUN(page, { runOnly: { type: 'tag', values: TAGS }, resultTypes: ['violations', 'incomplete'] });
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
            let p = el, scrollable = false; while ((p = p.parentElement)) { const cs = getComputedStyle(p); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.getAttribute('aria-label')) { scrollable = true; break; } }
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

try {
  if (which === 'axe' || which === 'all') await axeAll();
  if (which === 'reflow' || which === 'all') await reflow();
  if (which === 'walk' || which === 'all') await walk();
  if (which === 'budgets' || which === 'all') await budgets();
  if (which === 'rules' || which === 'all') await rules();
} finally { await browser.close(); }
log(`\nTOTAL failures: ${results.fail}`);
process.exit(results.fail ? 1 : 0);
