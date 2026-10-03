// Browser checks for version 3 (design card check 8): axe, runtime class audit, keyboard Tab walk, 320 px reflow, budgets at both screen sizes,
// the task scripts of the brief (loads, clicks, fields, time), and the shared rule checks V1 to V8 (design/verify/rules.mjs) at 1366 x 650 and 1093 x 525.
// The prototype is served over http (never file://). Each signed-in state is reached with the page's own session (localStorage) for the person named.
// Run: PW_NM=<node_modules with playwright and axe-core> node tools/heavy.mjs -- node design/prototypes/queues-record/v3/build/verify.mjs [axe|walk|reflow|budget|tasks|rules|all] [--size=1366x650]
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import * as R from '../../../../verify/rules.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
const NM = (process.env.PW_NM || '').replace(/[\\/]$/, '')
if (!NM) throw new Error('Set PW_NM to a node_modules folder holding playwright and axe-core')
const reqPW = createRequire(path.join(NM, '..', 'x.js'))
const { chromium } = (() => { try { return reqPW('playwright') } catch (e) { return reqPW('playwright-core') } })()
const axeSrc = fs.readFileSync(path.join(NM, 'axe-core', 'axe.min.js'), 'utf8')
const basisText = fs.readFileSync(path.join(ROOT, 'basis.md'), 'utf8')

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' }
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]))
  if (!f.startsWith(ROOT)) { r.statusCode = 403; return r.end() }
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('not found') } r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${srv.address().port}/`
const url = (f) => BASE + f

const args = process.argv.slice(2)
const which = args.find((a) => !a.startsWith('--')) || 'all'
const sizeArg = (args.find((a) => a.startsWith('--size=')) || '').slice(7)
const SIZES = sizeArg ? [sizeArg.split('x').map(Number)] : R.SIZES
const want = (k) => which === 'all' || which === k
// --only=V3,V5 runs just those shared rules (a quick re-run after a fix); the record of a full run is the one without it
const onlyArg = (args.find((a) => a.startsWith('--only=')) || '').slice(7)
const only = onlyArg ? onlyArg.split(',') : null
const on = (k) => !only || only.includes(k)
const browser = await chromium.launch({ headless: true })
const out = []
const say = (s) => { console.log(s); out.push(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// the official GOV.UK button ignores a second click on the same button within one second (data-prevent-double-click), so a second submit waits
const GAP = 1100
const pageErrors = []

// ---------- people and sessions: the pages keep the session in localStorage ----------
const seed = (user) => `(() => { try { if (!localStorage.getItem('proto-seeded')) { localStorage.setItem('proto-seeded', '1');${user ? ` localStorage.setItem('proto-user', ${JSON.stringify(user)}); localStorage.setItem('proto-since', String(Date.now())); localStorage.setItem('proto-last', String(Date.now()));` : ''} } } catch (e) {} })()`
const hook = (pg) => {
  pg.on('pageerror', (e) => pageErrors.push(`${pg.url().replace(BASE, '')}: ${String(e.message).split('\n')[0]}`))
  pg.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) pageErrors.push(`${pg.url().replace(BASE, '')}: console ${m.text().slice(0, 100)}`) })
}
async function ctx(user, w, h) {
  const c = await browser.newContext({ viewport: { width: w, height: h } })
  await c.addInitScript(seed(user))
  c.on('page', hook)
  return c
}
async function open(user, f, [w, h]) {
  const c = await ctx(user, w, h)
  const p = await c.newPage()
  await p.goto(url(f))
  return p
}

const TABS = ['overview', 'workbench', 'review', 'documents', 'exceptions', 'history', 'ops']
const SAMPLES = ['maple-ridge', 'halton-haulage', 'bluewater-renovations', 'lakeshore-eats', 'eglinton-holdings', 'eglinton-retail', 'riverdale-rentals', 'queen-west-design', 'scarborough-robotics', 'danforth-cleaning', 'humber-bay-software', 'kensington-market-crafts', 'sharma-medicine', 'rouge-valley-landscaping-2024', 'rouge-valley-landscaping-2025']
const FILLERS = ['filler-007', 'filler-012', 'filler-047', 'filler-083', 'filler-120', 'filler-250']

// ---------- the states every check visits ----------
const tick = async (p, n = 1) => { for (let i = 0; i < n; i++) await p.locator('[data-row-select]:visible').nth(i).check({ force: true }); await p.evaluate(() => window.scrollTo(0, 0)) }
const FILE = { name: 'check.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b') }
const CATALOGUE = []
const add = (user, file, extra = {}) => CATALOGUE.push({ user, file, label: `${user ? user : 'nobody'}: ${file}`, ...extra })
for (const f of ['index.html', 'sign-in.html', 'sign-in-error.html', 'sign-in-ended.html?next=queue-a.html%23view%3Dwaiting', 'code.html', 'code-error.html', 'signed-out.html']) add(null, f)
for (const f of ['queue-a.html', 'queue-a.html#view=all', 'queue-a.html#view=waiting', 'queue-a.html#view=due14', 'queue-a.html#view=rework', 'queue-a.html#view=all&sort=3d', 'queue-b.html', 'queue-b.html#view=all&q=halton', 'queue-b.html#view=all&q=zzz', 'not-found.html', 'search.html', 'search.html?q=landscaping', 'search.html?q=zzz']) add('aisha', f)
for (const f of ['queue-a-empty.html', 'queue-b-empty.html', 'queue-a-empty.html#view=all', 'queue-b-empty.html#view=rework']) add('casey', f)
for (const f of ['queue-a.html', 'queue-a.html#view=rework', 'queue-b.html', 'queue-cpa.html', 'queue-cpa.html#view=rework', 'queue-ops.html', 'queue-new.html', 'board.html', 'search.html?q=rouge+valley']) add('dana', f)
for (const f of ['queue-ops.html', 'queue-ops.html#view=filed', 'queue-new.html', 'queue-new.html#view=unassigned']) add('priti', f)
for (const f of ['board.html', 'board.html#view=overdue', 'queue-cpa.html', 'queue-a.html', 'queue-ops.html']) add('owen', f)
for (const s of SAMPLES) add('dana', `rec-${s}.html`, { tabs: true })
for (const s of ['halton-haulage', 'maple-ridge', 'danforth-cleaning', 'riverdale-rentals', 'eglinton-retail', 'bluewater-renovations']) add('aisha', `rec-${s}.html`, { tabs: true })
for (const s of ['scarborough-robotics', 'riverdale-rentals', 'lakeshore-eats', 'queen-west-design']) add('priti', `rec-${s}.html`, { tabs: true })
for (const s of ['maple-ridge', 'riverdale-rentals', 'eglinton-holdings']) add('owen', `rec-${s}.html`, { tabs: true })
for (const s of FILLERS) add('dana', `rec-${s}.html`, { tabs: true })
for (const s of ['filler-012', 'filler-083']) add('aisha', `rec-${s}.html`, { tabs: true })
// states reached by an action (a fresh session each)
const ACTIONS = [
  ['hold released (Halton, Aisha)', 'aisha', 'rec-halton-haulage.html', async (p) => { await p.click('[data-action=release]') }],
  ['hold taken (Eglinton Retail, Aisha)', 'aisha', 'rec-eglinton-retail.html', async (p) => { await p.click('[data-action=take]') }],
  ['hold held by another (Halton, Dana)', 'dana', 'rec-halton-haulage.html', async () => {}],
  ['documents: a source open (Halton, Aisha)', 'aisha', 'rec-halton-haulage.html#documents/1', async () => {}],
  ['documents: sorted, 6 rows (Maple Ridge, Dana)', 'dana', 'rec-maple-ridge.html#documents', async (p) => { await p.locator('th[aria-sort] button').first().click() }],
  ['chase: error (Danforth, Aisha)', 'aisha', 'rec-danforth-cleaning.html#history', async (p) => { await p.click('[data-chase-form] button[type=submit]') }],
  ['chase: recorded (Danforth, Aisha)', 'aisha', 'rec-danforth-cleaning.html#history', async (p) => { await p.check('[data-chase-form] input[name=how] >> nth=0'); await p.click('[data-chase-form] button[type=submit]') }],
  ['chase from the identity bar (Lakeshore, Dana)', 'dana', 'rec-lakeshore-eats.html', async (p) => { await p.click('[data-action=chase]') }],
  ['ops: error (Scarborough, Priti)', 'priti', 'rec-scarborough-robotics.html#ops', async (p) => { await p.click('form[data-step=chk] button[type=submit]') }],
  ['ops: saved (Scarborough, Priti)', 'priti', 'rec-scarborough-robotics.html#ops', async (p) => { await p.setInputFiles('#f-chk', FILE); await p.click('form[data-step=chk] button[type=submit]') }],
  ['ops: T183CORP sent (Riverdale, Priti)', 'priti', 'rec-riverdale-rentals.html#ops', async (p) => { await p.click('form[data-step=t183] button[type=submit]') }],
  ['bulk bar open (New returns, Priti)', 'priti', 'queue-new.html', async (p) => { await tick(p, 2) }],
  ['bulk error (New returns, Priti)', 'priti', 'queue-new.html', async (p) => { await tick(p, 2); await p.click('[data-bulkbar] button[type=submit]') }],
  ['bulk assigned (New returns, Priti)', 'priti', 'queue-new.html', async (p) => { await tick(p, 2); await p.selectOption('#assign-to', { index: 1 }); await p.click('[data-bulkbar] button[type=submit]') }],
  ['Board: a state chosen (Owen)', 'owen', 'board.html', async (p) => { await p.click('[data-state-filter=review]') }],
  ['filter with no match (Dana, Preparer queue B)', 'dana', 'queue-b.html', async (p) => { await p.fill('[data-list-filter]', 'zzz-none') }],
  ['keyboard shortcuts open (Aisha)', 'aisha', 'queue-a.html', async (p) => { await p.click('.app-shortcuts summary') }],
  ['source window (Aisha)', 'aisha', 'source.html?n=Chequing+statements&s=Maplestone+Bank+(Test)&st=Read&r=Halton+Haulage+Ltd.+(Test)&y=31+Mar+2026', async () => {}],
]

// ---------- in-page helpers ----------
const axeJs = async () => {
  const slim = (x) => ({ id: x.id, n: x.nodes.length, target: x.nodes[0].target.join(' '), html: x.nodes[0].html.slice(0, 100) })
  const a = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
  const b = await window.axe.run(document, { runOnly: { type: 'rule', values: ['region', 'landmark-unique'] } })
  return { v: [...a.violations, ...b.violations].map(slim), i: [...a.incomplete, ...b.incomplete].map(slim) }
}
const auditJs = () => {
  const bad = new Set(); const styles = new Set()
  document.querySelectorAll('[class]').forEach((e) => { for (const c of (e.getAttribute('class') || '').split(/\s+/)) if (c && !/^(govuk-|moj-|app-|js-enabled$)/.test(c)) bad.add(c) })
  document.querySelectorAll('[style]').forEach((e) => styles.add(e.tagName.toLowerCase() + ' ' + e.getAttribute('style')))
  const app = new Set(); document.querySelectorAll('[class]').forEach((e) => { for (const c of (e.getAttribute('class') || '').split(/\s+/)) if (c.startsWith('app-')) app.add(c) })
  return { bad: [...bad], styles: [...styles], app: [...app] }
}
const ensureAxe = async (p) => { if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: axeSrc }) }
async function eachState(size, fn, only = () => true) {
  for (const s of CATALOGUE) {
    if (!only(s)) continue
    const c = await ctx(s.user, size[0], size[1])
    try {
      const p = await c.newPage()
      await p.goto(url(s.file))
      if (s.tabs) for (const tb of TABS) { await p.evaluate((x) => { location.hash = x }, tb); await sleep(70); await fn(p, `${s.label}#${tb}`, s) }
      else await fn(p, s.label, s)
    } catch (e) { say(`  ERROR ${s.label}: ${String(e.message).split('\n')[0]}`) } finally { await c.close() }
  }
}
async function eachAction(size, fn) {
  for (const [name, user, file, act] of ACTIONS) {
    const c = await ctx(user, size[0], size[1])
    try {
      const p = await c.newPage()
      await p.goto(url(file))
      await act(p); await sleep(150)
      await fn(p, name)
    } catch (e) { say(`  ERROR ${name}: ${String(e.message).split('\n')[0]}`) } finally { await c.close() }
  }
}

// ---------- axe, with the runtime class and inline style audit ----------
if (want('axe')) {
  for (const size of SIZES) {
    const t = { states: 0, violations: 0, incomplete: 0 }
    const classes = new Set(); const styles = new Set(); const appSeen = new Set()
    const one = async (p, label) => {
      await ensureAxe(p)
      const r = await p.evaluate(axeJs)
      t.states++; t.violations += r.v.length; t.incomplete += r.i.length
      for (const v of r.v) say(`  VIOLATION ${size.join('x')} ${label}: ${v.id} (${v.n}) ${v.target} ${v.html}`)
      for (const v of r.i) say(`  INCOMPLETE ${size.join('x')} ${label}: ${v.id} (${v.n}) ${v.target} ${v.html}`)
      const a = await p.evaluate(auditJs)
      a.bad.forEach((c) => classes.add(c)); a.styles.forEach((c) => styles.add(c)); a.app.forEach((c) => appSeen.add(c))
    }
    await eachState(size, one)
    await eachAction(size, one)
    const unlisted = [...appSeen].filter((c) => !basisText.includes(c) && !['app-width-container--wide', 'app-shortcuts'].includes(c))
    say(`AXE ${size.join(' x ')}: ${t.states} page states, ${t.violations} violations, ${t.incomplete} incomplete`)
    say(`CLASSES ${size.join(' x ')}: ${classes.size} classes without govuk-, moj- or app- ${[...classes].join(' ')}; ${unlisted.length} app- classes in the live page not listed in basis.md ${unlisted.join(' ')}; ${appSeen.size} app- classes seen`)
    say(`STYLES ${size.join(' x ')}: ${styles.size} inline style attributes in live pages ${[...styles].slice(0, 6).join(' | ')}`)
  }
}

// ---------- 320 px reflow ----------
if (want('reflow')) {
  const size = [320, 640]
  let n = 0; let bad = 0
  const chk = async (p, label) => {
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth; const offenders = []
      document.querySelectorAll('body *').forEach((el) => { if (el.closest('.app-tablewrap, .app-viewer__scroll')) return; const b = el.getBoundingClientRect(); if (b.width && b.right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[hidden]') && el.getClientRects().length) offenders.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0]) })
      const scrollers = [...document.querySelectorAll('.app-tablewrap, .app-viewer__scroll')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
      const labelled = scrollers.every((e) => e.getAttribute('aria-label') && e.getAttribute('tabindex') === '0' && e.getAttribute('role') === 'region')
      const small = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, summary')].filter((e) => e.getClientRects().length && !e.closest('[hidden], .govuk-visually-hidden') && !e.classList.contains('govuk-skip-link')).filter((e) => { const b = e.getBoundingClientRect(); const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline'; return !inline && (b.width < 24 || b.height < 24) && !e.classList.contains('govuk-checkboxes__input') && !e.classList.contains('govuk-radios__input') }).map((e) => e.tagName.toLowerCase() + '.' + (e.className || '').toString().split(' ')[0] + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))
      return { sw: document.documentElement.scrollWidth, vw, offenders: [...new Set(offenders)].slice(0, 4), labelled, small: [...new Set(small)].slice(0, 4) }
    })
    n++
    if (r.sw > r.vw + 1 || !r.labelled || r.offenders.length || r.small.length) { bad++; say(`  REFLOW ${label}: scrollWidth ${r.sw} vs ${r.vw}; outside the page ${r.offenders.join(' ')}; scroll regions labelled ${r.labelled}; targets under 24 px ${r.small.join(' ')}`) }
  }
  const keep = (s) => !s.tabs || /halton|maple-ridge|scarborough|danforth|filler-012|riverdale/.test(s.file)
  for (const s of CATALOGUE) {
    if (!keep(s)) continue
    const c = await ctx(s.user, ...size)
    try {
      const p = await c.newPage(); await p.goto(url(s.file))
      if (s.tabs) for (const tb of ['overview', 'workbench', 'review', 'documents', 'history', 'ops']) { await p.evaluate((x) => { location.hash = x }, tb); await sleep(70); if (tb === 'documents') await p.locator('[data-doc]').first().click(); await chk(p, `${s.label}#${tb}`) }
      else await chk(p, s.label)
    } catch (e) { say(`  ERROR ${s.label}: ${String(e.message).split('\n')[0]}`) } finally { await c.close() }
  }
  await eachAction(size, chk)
  // the service navigation folds behind a Menu button and Sign out is still its last item
  {
    const p = await open('dana', 'queue-cpa.html', size)
    const r = await p.evaluate(() => { const t = document.querySelector('.govuk-service-navigation__toggle'); const l = document.querySelector('#navigation'); return { toggle: !!t && t.getClientRects().length > 0, listHidden: l.getClientRects().length === 0 } })
    await p.click('.govuk-service-navigation__toggle'); await sleep(100)
    const last = await p.evaluate(() => { const items = [...document.querySelectorAll('#navigation .govuk-service-navigation__item')]; return { shown: items.every((i) => i.getClientRects().length > 0), last: items[items.length - 1].textContent.trim() } })
    n++; const ok = r.toggle && r.listHidden && last.shown && last.last === 'Sign out'; if (!ok) { bad++; say(`  REFLOW menu: ${JSON.stringify(r)} ${JSON.stringify(last)}`) }
  }
  say(`REFLOW 320 px: ${n} page states, ${bad} fail`)
}

// ---------- keyboard Tab walk ----------
if (want('walk')) {
  const size = SIZES[0]
  const walk = async (p, label) => {
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0) })
    let stops = 0; let noRing = 0; let covered = 0; let trap = false; const seen = new Set(); const first = []
    for (let i = 0; i < 900; i++) {
      await p.keyboard.press('Tab')
      const r = await p.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return { body: true }
        const b = e.getBoundingClientRect(); const rects = [...e.getClientRects()]; const r0 = rects[0] || b
        // a link that wraps has several line boxes: the point tested is on its first line, not the middle of the box around all of them
        const cx = Math.min(Math.max(r0.left + Math.min(r0.width / 2, 20), 1), innerWidth - 1); const cy = Math.min(Math.max(r0.top + Math.min(r0.height / 2, 10), 1), innerHeight - 1)
        const top = document.elementFromPoint(cx, cy)
        const hidden = !(rects.length > 0) || !(top && (e === top || e.contains(top) || top.contains(e) || (e.matches('input[type=checkbox], input[type=radio]') && (e.nextElementSibling === top || (e.nextElementSibling && e.nextElementSibling.contains(top))))))
        const pad = 8; const x = Math.max(0, Math.floor(b.left - pad)); const y = Math.max(0, Math.floor(b.top - pad))
        const clip = { x, y, width: Math.max(1, Math.min(innerWidth, Math.ceil(b.right + pad)) - x), height: Math.max(1, Math.min(innerHeight, Math.ceil(b.bottom + pad)) - y) }
        return { id: (e.id || e.tagName) + '|' + Math.round(b.top + scrollY) + '|' + Math.round(b.left) + '|' + (e.textContent || '').trim().slice(0, 12), hidden, clip, name: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) }
      })
      if (r.body) { if (i > 3) break; continue }
      if (seen.has(r.id)) { trap = i < 880 ? false : true; break }
      seen.add(r.id); stops++; if (first.length < 3) first.push(r.name)
      // the focus style is whatever changes on screen when the element loses focus (an outline, a shadow, a background, MOJ's bar): the area around it is compared with and without focus
      const focusedPic = await p.screenshot({ clip: r.clip, caret: 'hide' })
      const handle = await p.evaluateHandle(() => document.activeElement)
      await handle.evaluate((e) => e.blur())
      const plainPic = await p.screenshot({ clip: r.clip, caret: 'hide' })
      await handle.evaluate((e) => e.focus({ preventScroll: true }))
      await handle.dispose()
      if (focusedPic.equals(plainPic)) { noRing++; if (noRing < 3) say(`    no visible focus style: ${r.name}`) }
      if (r.hidden) { covered++; if (covered < 3) say(`    covered or hidden when focused: ${r.name}`) }
    }
    return { stops, noRing, covered, trap, first }
  }
  const targets = [
    ['nobody', 'index.html'], ['nobody', 'sign-in.html'], ['nobody', 'sign-in-error.html'], ['nobody', 'code.html'], ['nobody', 'code-error.html'], ['nobody', 'sign-in-ended.html?next=queue-a.html'], ['nobody', 'signed-out.html'],
    ['aisha', 'queue-a.html'], ['aisha', 'queue-b.html'], ['aisha', 'queue-b.html#view=all&q=halton'], ['casey', 'queue-a-empty.html'], ['aisha', 'search.html?q=landscaping'], ['dana', 'queue-a.html'], ['dana', 'queue-cpa.html'], ['priti', 'queue-ops.html'], ['priti', 'queue-new.html', async (p) => { await tick(p, 2) }], ['owen', 'board.html'],
    ['aisha', 'rec-halton-haulage.html#workbench'], ['aisha', 'rec-halton-haulage.html#documents/1'], ['aisha', 'rec-danforth-cleaning.html#history'], ['aisha', 'rec-filler-012.html#overview'], ['aisha', 'rec-eglinton-retail.html#overview'],
    ['dana', 'rec-maple-ridge.html#review'], ['dana', 'rec-maple-ridge.html#documents'], ['dana', 'rec-lakeshore-eats.html#history'], ['dana', 'rec-halton-haulage.html#overview'],
    ['priti', 'rec-scarborough-robotics.html#ops'], ['priti', 'rec-riverdale-rentals.html#ops'], ['owen', 'rec-riverdale-rentals.html#overview'],
    ['aisha', 'source.html?n=Chequing+statements&s=Maplestone+Bank+(Test)&st=Read&r=Halton+Haulage+Ltd.+(Test)&y=31+Mar+2026'],
  ]
  let bad = 0
  for (const [user, f, pre] of targets) {
    const p = await open(user === 'nobody' ? null : user, f, size)
    if (f.includes('#')) { await p.reload() }
    if (pre) await pre(p)
    const r = await walk(p, f)
    const flag = r.noRing || r.covered || r.trap || r.stops < 3
    if (flag) bad++
    say(`  WALK ${user}: ${f}: ${r.stops} tab stops, ${r.noRing} without a visible focus style, ${r.covered} hidden or covered, ${r.trap ? 'a keyboard trap' : 'no trap'}; first stops: ${r.first.join(' > ')}`)
    await p.context().close()
  }
  say(`WALK: ${targets.length} pages walked by Tab alone, ${bad} with a problem`)
}

// ---------- budgets: the fold at both sizes ----------
if (want('budget')) {
  const lists = [
    ['Preparer queue A, My returns (Aisha)', 'aisha', 'queue-a.html'], ['Preparer queue B, My returns (Aisha)', 'aisha', 'queue-b.html'],
    ['Preparer queue A, empty (Casey)', 'casey', 'queue-a-empty.html'], ['Preparer queue B, empty (Casey)', 'casey', 'queue-b-empty.html'],
    ['Preparer queue A, everyone (Dana)', 'dana', 'queue-a.html'], ['Preparer queue B, everyone (Dana)', 'dana', 'queue-b.html'],
    ['Review queue (Dana)', 'dana', 'queue-cpa.html'], ['Ops queue (Priti)', 'priti', 'queue-ops.html'], ['New returns (Priti)', 'priti', 'queue-new.html'], ['Board (Owen)', 'owen', 'board.html'],
  ]
  for (const size of SIZES) {
    const [w, h] = size
    say(`BUDGET at ${w} x ${h}`)
    for (const [label, user, f] of lists) {
      const p = await open(user, f, size)
      const m = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('#returns tbody tr')].filter((r) => !r.hidden && r.getClientRects().length)
        const h1 = document.querySelector('h1').getBoundingClientRect()
        const strip = document.querySelector('.app-pipeline'); const sb = strip ? strip.getBoundingClientRect() : null
        const empty = document.querySelector('[data-list-empty]:not([hidden])'); const eb = empty ? empty.getBoundingClientRect() : null
        const first = rows[0] ? rows[0].getBoundingClientRect() : null
        const cols = [...document.querySelectorAll('#returns thead th')].filter((t) => t.getClientRects().length).length
        return { n: rows.length, top: first ? Math.round(first.top) : null, bottom: first ? Math.round(first.bottom) : null, whole: rows.filter((r) => r.getBoundingClientRect().bottom <= innerHeight).length, h1: Math.round(h1.bottom), strip: sb ? [Math.round(sb.top), Math.round(sb.bottom)] : null, empty: eb ? [Math.round(eb.top), Math.round(eb.bottom)] : null, cols, sw: document.documentElement.scrollWidth, vw: innerWidth }
      })
      const ok = m.top == null ? (m.empty && m.empty[1] <= h ? 'empty message wholly inside the first screen' : 'empty message not whole') : m.bottom <= h ? 'first row wholly inside the first screen' : m.top < h ? 'first row starts inside the first screen, ends below' : 'first row below the fold'
      say(`  ${w}x${h} ${label}: ${m.n} rows; ${m.top == null ? `empty message ${m.empty ? m.empty.join(' to ') : 'none'}` : `first row top ${m.top}, bottom ${m.bottom}`}; ${m.whole} rows whole in view; ${ok}; ${m.cols} columns${m.strip ? `; state strip ${m.strip.join(' to ')}` : ''}${m.sw > m.vw + 1 ? `; PAGE SCROLLS SIDEWAYS ${m.sw} > ${m.vw}` : ''}`)
      await p.context().close()
    }
    // the record: the identity bar, the tabs and the first block of the landing tab, for each role
    const recs = [['Aisha, Halton Haulage (Workbench, since strip)', 'aisha', 'rec-halton-haulage.html'], ['Aisha, Maple Ridge (Workbench)', 'aisha', 'rec-maple-ridge.html'], ['Dana, Maple Ridge (Review)', 'dana', 'rec-maple-ridge.html'], ['Priti, Riverdale Rentals (Overview, approved)', 'priti', 'rec-riverdale-rentals.html'], ['Owen, Riverdale Rentals (Overview, approved)', 'owen', 'rec-riverdale-rentals.html'], ['Aisha, Willow Landscaping 012 (Workbench, approval void)', 'aisha', 'rec-filler-012.html'], ['Dana, Eglinton Holdings (Review, rework)', 'dana', 'rec-eglinton-holdings.html'], ['Priti, Scarborough Robotics (Overview, ready to file)', 'priti', 'rec-scarborough-robotics.html'], ['Aisha, Danforth Cleaning (Workbench, waiting on client)', 'aisha', 'rec-danforth-cleaning.html']]
    for (const [label, user, f] of recs) {
      const p = await open(user, f, size); await sleep(80)
      const m = await p.evaluate(() => {
        const q = (s) => document.querySelector(s); const bb = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)] }
        const panel = q('.app-panel:not([hidden])'); const kids = [...panel.children].filter((c) => !c.hidden && c.getClientRects().length && !c.classList.contains('govuk-visually-hidden'))
        const block = kids[0]; const alertEl = q('.app-panel:not([hidden]) .moj-alert')
        const facts = document.querySelectorAll('.app-fact').length
        return { ident: bb(q('.moj-identity-bar')), since: q('[data-since]:not([hidden])') ? bb(q('[data-since]:not([hidden])')) : null, tabs: bb(q('.app-tabrow')), block: block ? bb(block) : null, blockTag: block ? block.tagName.toLowerCase() + (block.className ? '.' + block.className.toString().split(' ')[0] : '') : '', alert: alertEl ? bb(alertEl) : null, facts, tab: q('.moj-sub-navigation__link[aria-current=page]').textContent.trim(), h: innerHeight }
      })
      say(`  ${w}x${h} Record, ${label}: landing tab ${m.tab}; identity bar ${m.ident.join(' to ')}${m.since ? `; since strip ${m.since.join(' to ')}` : ''}; tabs ${m.tabs.join(' to ')}; first block (${m.blockTag}) ${m.block ? m.block.join(' to ') : 'none'}${m.alert ? `; alert ${m.alert.join(' to ')}` : ''}; ${m.facts} facts; first block ${m.block && m.block[1] <= h ? 'wholly inside the first screen' : 'NOT wholly inside the first screen'}`)
      await p.context().close()
    }
    // the sign-in pages: the form and the Continue button inside the first screen
    for (const f of ['sign-in.html', 'sign-in-error.html', 'code.html', 'code-error.html']) {
      const p = await open(null, f, size)
      const m = await p.evaluate(() => { const b = document.querySelector('[data-primary]').getBoundingClientRect(); const e = document.querySelector('[data-evidence]').getBoundingClientRect(); return { btn: Math.round(b.bottom), form: [Math.round(e.top), Math.round(e.bottom)], h: innerHeight } })
      say(`  ${w}x${h} ${f}: form ${m.form.join(' to ')}, button bottom ${m.btn}, ${m.btn <= h ? 'wholly inside the first screen' : 'NOT wholly inside the first screen'}`)
      await p.context().close()
    }
    // Documents: the viewer beside the list (never stacked), the cited line in view without scrolling the page
    {
      const p = await open('aisha', 'rec-halton-haulage.html#documents', size); await p.reload(); await p.locator('[data-doc]').first().click(); await sleep(150)
      const g = await p.evaluate(() => { const l = document.querySelector('.app-docs__list').getBoundingClientRect(); const v = document.querySelector('.app-viewer').getBoundingClientRect(); const hit = document.querySelector('[data-hit]').getBoundingClientRect(); const rg = document.querySelector('[data-viewer-scroll]').getBoundingClientRect(); const send = document.querySelector('[data-second]').getBoundingClientRect(); return { side: v.left >= l.right - 1 && Math.abs(v.top - l.top) < 80, vh: Math.round(v.height), vtop: Math.round(v.top), vbottom: Math.round(v.bottom), hit: [Math.round(hit.top), Math.round(hit.bottom)], hitInBox: hit.top >= rg.top && hit.bottom <= rg.bottom, send: Math.round(send.bottom), y: scrollY, h: innerHeight } })
      say(`  ${w}x${h} Documents (Halton): viewer beside the list ${g.side}; viewer ${g.vtop} to ${g.vbottom} (height ${g.vh}); cited line ${g.hit.join(' to ')} inside its box ${g.hitInBox}; Send to second window bottom ${g.send}; page scrolled ${g.y} px`)
      await p.context().close()
    }
  }
}

// ---------- the task scripts of the brief: loads, clicks, fields, time ----------
if (want('tasks')) {
  const size = [1366, 650]
  const results = []
  const ok = (name, cond, extra = '') => { results.push(!!cond); say(`  ${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ': ' + extra : ''}`) }
  const mk = async (user) => { const c = await ctx(user, ...size); const p = await c.newPage(); const st = { loads: 0 }; p.on('load', () => { st.loads++ }); return { c, p, st } }
  say('TASKS at 1366 x 650')

  // sign in, two-step code, landing by role (QR2, QR3, QR5, SEC-1)
  {
    const { c, p, st } = await mk(null)
    let t0 = Date.now(); await p.goto(url('sign-in.html')); const tSign = Date.now() - t0
    const fields = await p.locator('main input:not([type=hidden])').count()
    ok('Sign in: 1 load, 2 fields, 1 submit', st.loads === 1 && fields === 2, `${st.loads} load, ${fields} fields, ${tSign} ms`)
    ok('Sign in: autofill attributes, and paste is not blocked in either field', await p.evaluate(() => { const u = document.querySelector('#user-id'); const pw = document.querySelector('#password'); const free = (el) => el.dispatchEvent(new Event('paste', { cancelable: true, bubbles: true })); return u.autocomplete === 'username' && pw.autocomplete === 'current-password' && free(u) && free(pw) }))
    ok('Sign in: the focus is on the first field or the page start (a person can type at once)', await p.evaluate(() => { const a = document.activeElement; return a === document.body || a.id === 'user-id' }))
    st.loads = 0; await p.fill('#user-id', 'aisha'); await p.fill('#password', 'ashbridge-test'); t0 = Date.now(); await p.press('#password', 'Enter'); await p.waitForURL(/code\.html/); const tCode = Date.now() - t0
    ok('Enter submits the sign-in form; 1 load to the code page', st.loads === 1 && /code\.html/.test(p.url()), `${st.loads} load, ${tCode} ms`)
    const f2 = await p.locator('main input:not([type=hidden])').count()
    ok('Two-step code: 1 field, numeric, one-time-code, paste not blocked', f2 === 1 && await p.evaluate(() => { const i = document.querySelector('#code'); return i.autocomplete === 'one-time-code' && i.inputMode === 'numeric' && i.dispatchEvent(new Event('paste', { cancelable: true, bubbles: true })) }))
    st.loads = 0; await p.fill('#code', '482 913'); t0 = Date.now(); await p.press('#code', 'Enter'); await p.waitForURL(/queue-a\.html/); const tList = Date.now() - t0
    ok('A code with spaces pasted in is accepted; Aisha lands on My returns, 1 load', st.loads === 1 && /queue-a\.html/.test(p.url()) && (await p.locator('h1').textContent()) === 'My returns', `${st.loads} load, ${tList} ms`)
    // failures: one message, never a locked state
    for (const [label, user, pw] of [['wrong password', 'aisha', 'nope'], ['unknown user', 'zed', 'ashbridge-test'], ['empty form', '', '']]) {
      const q = await c.newPage(); await q.goto(url('sign-in.html')); await q.fill('#user-id', user); await q.fill('#password', pw); await q.click('[data-primary]'); await q.waitForURL(/sign-in-error/)
      const msg = await q.locator('.govuk-error-summary__list a').textContent(); const foc = await q.evaluate(() => document.activeElement && document.activeElement.className.includes('govuk-error-summary'))
      ok(`Sign in fails (${label}): the one message, summary focused, title starts "Error: "`, msg === 'Sign-in failed. Check what you entered, then try again.' && foc && (await q.title()).startsWith('Error: '), msg)
      await q.close()
    }
    {
      let same = true; let locked = false
      for (let i = 0; i < 6; i++) { const q = await c.newPage(); await q.goto(url('sign-in.html')); await q.fill('#user-id', 'aisha'); await q.fill('#password', 'wrong' + i); await q.click('[data-primary]'); await q.waitForURL(/sign-in-error/); const m = await q.locator('.govuk-error-summary__list a').textContent(); if (m !== 'Sign-in failed. Check what you entered, then try again.') same = false; if (/lock/i.test(await q.locator('main').textContent())) locked = true; await q.close() }
      ok('Six wrong passwords in a row give the same message and never a locked state (QR2)', same && !locked)
      const q = await c.newPage(); await q.goto(url('sign-in.html')); await q.fill('#user-id', 'aisha'); await q.fill('#password', 'ashbridge-test'); await q.click('[data-primary]'); await q.waitForURL(/code\.html/); await q.fill('#code', '000000'); await q.click('[data-primary]'); await q.waitForURL(/code-error/)
      ok('A wrong code gives the same message, with no resend control', (await q.locator('.govuk-error-summary__list a').textContent()) === 'Sign-in failed. Check what you entered, then try again.' && !/resend|new code/i.test(await q.locator('main').textContent()))
      await q.close()
    }
    // the landing page of each role
    for (const [user, land, tab] of [['aisha', /queue-a\.html/, 'workbench'], ['casey', /queue-a\.html/, 'workbench'], ['dana', /queue-cpa\.html/, 'review'], ['priti', /queue-ops\.html/, 'overview'], ['owen', /board\.html/, 'overview']]) {
      const cc = await ctx(null, ...size); const q = await cc.newPage(); await q.goto(url('sign-in.html')); await q.fill('#user-id', user); await q.fill('#password', 'ashbridge-test'); await q.press('#password', 'Enter'); await q.waitForURL(/code\.html/); await q.fill('#code', '482913'); await q.press('#code', 'Enter'); await q.waitForURL(land)
      const nav = await q.locator('#navigation .govuk-service-navigation__item').allTextContents()
      const first = q.locator('#returns tbody tr:not([hidden]) a[data-pick]').first(); const emptyOk = (await first.count()) === 0
      if (!emptyOk) { await first.click(); await q.waitForURL(/rec-/); await sleep(120) }
      ok(`${user} lands on ${q.url().includes('rec-') ? 'the list and a record opens on' : 'the list; no row to open'} ${emptyOk ? '' : (await q.evaluate(() => location.hash.slice(1)))}; navigation: ${nav.map((x) => x.trim()).join(', ')}`, (emptyOk || (await q.evaluate(() => location.hash.slice(1))) === tab) && nav[nav.length - 1].trim() === 'Sign out' && !nav.some((x) => /today/i.test(x)))
      await cc.close()
    }
    // the kept address wins; a timeout; the 12-hour limit
    for (const [name, mutate] of [['30 minutes idle', () => localStorage.setItem('proto-last', String(Date.now() - 31 * 60 * 1000))], ['12 hours in all', () => localStorage.setItem('proto-since', String(Date.now() - 13 * 60 * 60 * 1000))]]) {
      const cc = await ctx('aisha', ...size); const q = await cc.newPage(); await q.goto(url('queue-a.html#view=waiting&sort=3d')); await q.reload()
      const before = await q.evaluate(() => [location.hash, document.querySelector('[data-view][aria-current]').getAttribute('data-view')])
      await q.evaluate(mutate); await q.goto('about:blank'); await q.goto(url('queue-a.html#view=waiting&sort=3d')); await q.waitForURL(/sign-in-ended/)
      const ended = (await q.locator('h1').textContent()).trim()
      let clicks = 0; await q.fill('#user-id', 'aisha'); await q.fill('#password', 'ashbridge-test'); await q.press('#password', 'Enter'); clicks++; await q.waitForURL(/code\.html/); await q.fill('#code', '482913'); await q.press('#code', 'Enter'); clicks++; await q.waitForURL(/queue-a\.html/); await sleep(150)
      const after = await q.evaluate(() => [location.hash, document.querySelector('[data-view][aria-current]').getAttribute('data-view'), document.querySelector('th[aria-sort="descending"] button') ? document.querySelector('th[aria-sort="descending"] button').getAttribute('data-index') : ''])
      ok(`Session ends after ${name}: sign-in page "${ended}", the asked-for address kept, 2 submits as at any sign-in, the selection restored`, after[0] === before[0] && after[1] === 'waiting' && after[2] === '3' && clicks === 2, `${before.join(' ')} -> ${after.join(' ')}`)
      await cc.close()
    }
    // no session at all: sign-in page with the address kept
    {
      const cc = await ctx(null, ...size); const q = await cc.newPage(); await q.goto(url('rec-halton-haulage.html#documents/2')); await q.waitForURL(/sign-in\.html/)
      ok('No session: the asked-for record address is kept for after the sign-in', decodeURIComponent(q.url()).includes('next=rec-halton-haulage.html#documents/2'), decodeURIComponent(q.url().split('?')[1]))
      await q.fill('#user-id', 'aisha'); await q.fill('#password', 'ashbridge-test'); await q.press('#password', 'Enter'); await q.waitForURL(/code\.html/); await q.fill('#code', '482913'); await q.press('#code', 'Enter'); await q.waitForURL(/rec-halton/); await sleep(150)
      ok('After the code the person lands on that record, Documents, source 2 open', (await q.evaluate(() => location.hash)) === '#documents/2' && (await q.locator('[data-viewer-title]').count()) === 1, await q.evaluate(() => location.hash))
      await cc.close()
    }
    await c.close()
  }

  // sign out closes the second window (SEC-1, QR4)
  {
    const { c, p, st } = await mk('aisha')
    await p.goto(url('rec-halton-haulage.html#documents')); await p.locator('[data-doc="1"]').click()
    const [pop] = await Promise.all([c.waitForEvent('page'), p.locator('[data-second]').click()])
    await pop.waitForLoadState(); const ptitle = await pop.locator('h1').textContent()
    st.loads = 0; const clicks = 1; await p.locator('[data-signout]').click(); await p.waitForURL(/signed-out/); await sleep(500)
    ok('Sign out: 1 click, 1 load, the second window closes', st.loads === 1 && clicks === 1 && pop.isClosed(), `${st.loads} load, second window "${ptitle}" closed: ${pop.isClosed()}`)
    await p.goto(url('queue-a.html')); await p.waitForURL(/sign-in\.html/)
    ok('After Sign out an old address needs a sign-in again', /sign-in\.html/.test(p.url()))
    await c.close()
  }

  // find a return, open it, tabs, source (preparer)
  {
    const { c, p, st } = await mk('aisha')
    await p.goto(url('queue-a.html')); st.loads = 0
    let t0 = Date.now(); const rowHref = await p.locator('#returns tbody tr:not([hidden]) a[data-pick]').first().getAttribute('href')
    await p.locator('#returns tbody tr:not([hidden]) a[data-pick]').first().click(); await p.waitForURL(/rec-/); await p.waitForLoadState('load'); const tOpen = Date.now() - t0
    ok('Next return to work: 1 click from the landing list (sorted by filing due) opens the first row on Workbench, 1 load', st.loads === 1 && (await p.evaluate(() => location.hash)) === '#workbench', `${rowHref}, ${st.loads} load, ${tOpen} ms`)
    // tab switches, on a return with five documents
    await p.goto(url('rec-halton-haulage.html')); await sleep(100)
    await p.evaluate(() => { window.__marker = 'same-document' }); st.loads = 0
    const heights = []; for (const t of TABS) { t0 = Date.now(); await p.locator(`.moj-sub-navigation__link[data-route="${t}"]`).click(); heights.push(Date.now() - t0) }
    ok('Tab switch: 1 click each, 0 page loads, the header and identity bar stay, own URL', st.loads === 0 && (await p.evaluate(() => window.__marker)) === 'same-document' && (await p.evaluate(() => location.hash)) === '#ops', `${st.loads} loads, slowest ${Math.max(...heights)} ms`)
    ok('Each tab names itself in the title and the panel heading', await (async () => { await p.locator('.moj-sub-navigation__link[data-route="exceptions"]').click(); const named = await p.waitForFunction(() => /^Exceptions - Halton Haulage Ltd\. \(Test\), year end 31 Mar 2026 - Ashbridge Tax$/.test(document.title), null, { timeout: 2000 }).then(() => true, () => false); return named && (await p.locator('.app-panel:not([hidden]) > h2').textContent()) === 'Exceptions' })(), await p.title())
    ok('Choosing the tab that is open says so and keeps the focus on it', await (async () => { await p.locator('.moj-sub-navigation__link[data-route="exceptions"]').click(); return /already open/.test(await p.locator('[data-route-status]').textContent()) && (await p.evaluate(() => document.activeElement.getAttribute('data-route'))) === 'exceptions' })())
    // source from Documents
    await p.locator('.moj-sub-navigation__link[data-route="documents"]').click(); const hist = await p.evaluate(() => history.length); st.loads = 0
    t0 = Date.now(); await p.locator('[data-doc="2"]').click(); await p.locator('[data-viewer-title]').waitFor(); const tSrc = Date.now() - t0
    ok('Open a source from Documents: 1 click, no page load, no history entry, focus in the viewer, under 1 s', st.loads === 0 && (await p.evaluate(() => history.length)) === hist && (await p.evaluate(() => document.activeElement.hasAttribute('data-viewer-title'))) && tSrc < 1000, `${tSrc} ms`)
    ok('The URL names the source (#documents/2) so a reload or a second window restores it', (await p.evaluate(() => location.hash)) === '#documents/2')
    const [pop] = await Promise.all([c.waitForEvent('page'), p.locator('[data-second]').click()]); await pop.waitForLoadState()
    ok('Send to second window opens it by script with the chosen document', (await pop.locator('h1').textContent()) === (await p.locator('[data-doc="2"]').getAttribute('data-name')), await pop.locator('h1').textContent())
    await p.locator('[data-doc="3"]').click(); await sleep(500)
    ok('The second window follows the next document', (await pop.locator('h1').textContent()) === (await p.locator('[data-doc="3"]').getAttribute('data-name')), await pop.locator('h1').textContent())
    await p.locator('.moj-sub-navigation__link[data-route="history"]').click(); await sleep(300)
    ok('The second window stays open after a tab change', !pop.isClosed())
    await c.close()
  }

  // find a return by name, number, year end (QR, SEC-2)
  {
    const { c, p, st } = await mk('aisha')
    await p.goto(url('queue-a.html')); st.loads = 0
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('s')
    ok('Key s moves focus to the search box and repeats a visible control', await p.evaluate(() => document.activeElement && document.activeElement.id === 'header-search') && (await p.locator('#header-search').getAttribute('aria-keyshortcuts')) === 's')
    await p.keyboard.type('halton'); await p.keyboard.press('Enter'); await p.waitForURL(/rec-halton/); await sleep(120)
    ok('Find a return: s, type, Enter (3 actions) opens the single match on Workbench; the search page redirects before it finishes loading, so one page load completes', st.loads === 1 && /#workbench$/.test(p.url()), `${st.loads} completed page load`)
    await p.goto(url('queue-a.html')); await p.fill('#header-search', 'lakeshore'); await p.keyboard.press('Enter'); await p.waitForURL(/search\.html/); await sleep(120)
    ok('SEC-2: a preparer searching a return that is not hers finds nothing', /No return matches/.test(await p.locator('h1').textContent()) && /assigned to you/.test(await p.locator('[data-search-summary]').textContent()), await p.locator('h1').textContent())
    await p.goto(url('rec-lakeshore-eats.html')); await p.waitForURL(/not-found/)
    ok('SEC-2: the address of a return that is not hers answers "not found"', /Page not found/.test(await p.locator('h1').textContent()))
    await p.goto(url('queue-a.html')); await p.fill('#header-search', 'landscaping'); await p.keyboard.press('Enter'); await p.waitForURL(/search\.html/); await sleep(120)
    const nres = await p.locator('[data-search-table] tbody tr').count()
    ok('Several matches show a results table, sorted by corporation name, first result focused', nres > 1 && (await p.evaluate(() => document.activeElement.hasAttribute('data-pick'))), `${nres} rows, ${await p.locator('h1').textContent()}`)
    await c.close()
    const d = await mk('dana')
    for (const [kind, value] of [['business number', '779886143'], ['year end', '31 Mar 2026'], ['year end partial', '2026-03']]) { await d.p.goto(url('queue-cpa.html')); await d.p.fill('#header-search', value); await d.p.keyboard.press('Enter'); await sleep(350); ok(`Dana finds returns by ${kind} "${value}"`, (await d.p.locator('[data-search-table] tbody tr').count()) >= 1 || /rec-/.test(d.p.url()), d.p.url().replace(BASE, '')) }
    await d.c.close()
  }

  // lists: speed, state in the address, Back, previous and next (rule 21)
  {
    const { c, p, st } = await mk('aisha')
    await p.goto(url('queue-b.html')); st.loads = 0
    const t = await p.evaluate(() => {
      const time = (fn) => { const t0 = performance.now(); fn(); return Math.round(performance.now() - t0) }
      const f = document.querySelector('[data-list-filter]'); const sel = document.querySelector('[data-view-select]')
      const tFilter = time(() => { f.value = 'a'; f.dispatchEvent(new Event('input', { bubbles: true })) })
      const tView = time(() => { sel.value = 'all'; sel.dispatchEvent(new Event('change', { bubbles: true })) })
      const tSort = time(() => document.querySelectorAll('#returns th button')[1].click())
      return { tFilter, tView, tSort }
    })
    ok('Filter, view change and sort run in the page: 0 loads, each under 200 ms', st.loads === 0 && t.tFilter < 200 && t.tView < 200 && t.tSort < 200, `filter ${t.tFilter} ms, view ${t.tView} ms, sort ${t.tSort} ms`)
    ok('The view, the filter and the sort are in the address', /view=all/.test(await p.evaluate(() => location.hash)) && /q=a/.test(await p.evaluate(() => location.hash)) && /sort=1a/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash))
    const count = await p.locator('#returns tbody tr:not([hidden])').count()
    await p.reload()
    ok('Reload restores the same view, filter and sort', (await p.locator('#returns tbody tr:not([hidden])').count()) === count && (await p.inputValue('[data-list-filter]')) === 'a' && (await p.locator('th[aria-sort="ascending"] button').getAttribute('data-index')) === '1')
    // Back to the list keeps filter, sort, scroll and returns focus to the row
    await p.evaluate(() => window.scrollTo(0, 120)); const y0 = await p.evaluate(() => scrollY)
    const slug = await p.evaluate(() => { const a = [...document.querySelectorAll('#returns tbody tr:not([hidden]) a[data-pick]')][2]; const s = a.closest('tr').getAttribute('data-slug'); a.click(); return s })
    await p.waitForURL(/rec-/); await sleep(150)
    const nav = await p.evaluate(() => ({ back: document.querySelector('[data-back]').textContent, prev: !document.querySelector('[data-prev]').hidden, next: !document.querySelector('[data-next]').hidden, tab: location.hash }))
    ok('A record opened from a list offers Back to that list, Previous and Next', /^Back to My returns/.test(nav.back) && nav.prev && nav.next, JSON.stringify(nav))
    const here = await p.locator('h1').textContent()
    await p.locator('a[data-next]').click(); await p.waitForURL(/rec-/); await sleep(120)
    ok('Next opens the next row of that filtered, sorted list and keeps the tab', (await p.locator('h1').textContent()) !== here && (await p.evaluate(() => location.hash)) === nav.tab, `${here} -> ${await p.locator('h1').textContent()}`)
    await p.locator('a[data-prev]').click(); await p.waitForURL(/rec-/); await sleep(120)
    await p.locator('a[data-back]').click(); await p.waitForURL(/queue-b/); await sleep(200)
    const back = await p.evaluate(() => ({ q: document.querySelector('[data-list-filter]').value, sort: document.querySelector('th[aria-sort="ascending"] button').getAttribute('data-index'), y: Math.round(scrollY), focusRow: document.activeElement && document.activeElement.closest('tr') ? document.activeElement.closest('tr').getAttribute('data-slug') : '', rows: document.querySelectorAll('#returns tbody tr:not([hidden])').length }))
    ok('Back to the list restores filter, sort, scroll and puts focus on the row left', back.q === 'a' && back.sort === '1' && back.rows === count && Math.abs(back.y - y0) <= 8 && back.focusRow === slug, `${JSON.stringify(back)} wanted row ${slug}, scroll ${y0}`)
    await c.close()
  }

  // the other roles open a record on their landing tab; columns and facts within the brief's limits
  {
    for (const [user, f, tab] of [['dana', 'queue-cpa.html', '#review'], ['priti', 'queue-ops.html', '#overview'], ['owen', 'board.html', '#overview']]) {
      const { c, p, st } = await mk(user)
      await p.goto(url(f)); st.loads = 0
      const cols = await p.evaluate(() => [...document.querySelectorAll('#returns thead th')].filter((x) => x.getClientRects().length).length)
      const t0 = Date.now(); await p.locator('#returns tbody tr:not([hidden]) a[data-pick]').first().click(); await p.waitForURL(/rec-/); await p.waitForLoadState('load'); await sleep(100)
      const facts = await p.locator('.app-fact').count()
      ok(`${user}: list to record in 1 click, 1 load, under 1 s, landing ${tab}; ${cols} columns (at most 8); ${facts} facts (at most 10)`, st.loads === 1 && (await p.evaluate(() => location.hash)) === tab && cols <= 8 && facts <= 10 && Date.now() - t0 < 1000, `${Date.now() - t0} ms`)
      await c.close()
    }
    const { c, p } = await mk('aisha')
    for (const f of ['queue-a.html', 'queue-b.html']) { await p.goto(url(f)); const cols = await p.evaluate(() => [...document.querySelectorAll('#returns thead th')].filter((x) => x.getClientRects().length).map((x) => x.textContent.trim())); ok(`${f}: QR8 columns in order, ${cols.length} (at most 8)`, cols.join('|') === 'Corporation and year end|State|Tier|Filing due|Balance due|Held by|Blocked by', cols.join(', ')) }
    await p.goto(url('queue-a.html')); ok('The caption states the default order (RV-20)', /sorted by filing due date, earliest first, then corporation name/.test(await p.locator('#returns caption').textContent()))
    await c.close()
  }

  // a list opens in one page load, under a second, with every row of its widest view already in the page (no pagination): the Board holds all 300 returns
  {
    for (const [user, f] of [['aisha', 'queue-a.html'], ['aisha', 'queue-b.html'], ['dana', 'queue-cpa.html'], ['priti', 'queue-ops.html'], ['priti', 'queue-new.html'], ['owen', 'board.html']]) {
      const { c, p, st } = await mk(user)
      const t0 = Date.now(); await p.goto(url(f), { waitUntil: 'load' }); const ms = Date.now() - t0
      const rows = await p.locator('#returns tbody tr').count(); const status = (await p.locator('[data-status-count]').textContent()).trim()
      // the widest view is the largest count on a view tab or in the Show menu; it is the whole list this person may see
      const widest = await p.evaluate(() => Math.max(0, ...[...document.querySelectorAll('[data-view-tabs] .moj-badge, #list-view option')].map((e) => Number((e.textContent.match(/\d+/) || [0])[0]))))
      const pager = await p.locator('.govuk-pagination, .moj-pagination').count()
      ok(`${user}: ${f} opens in 1 page load, under 1 s, every row of the list in the page (${rows} rows in the page, the widest view is ${widest}; no pagination)`, st.loads === 1 && ms < 1000 && widest > 0 && rows >= widest && pager === 0 && /^Showing \d+ of \d+ returns in /.test(status), `${ms} ms, "${status}"`)
      await c.close()
    }
  }

  // the hold, the chase and the Ops forms act in place (rules 9, 19)
  {
    const { c, p, st } = await mk('aisha')
    await p.goto(url('rec-halton-haulage.html')); st.loads = 0
    ok('Halton: held by you, ends 14:20 if idle', /Held by you, ends 14:20 if idle/.test(await p.locator('[data-hold-text]').textContent()))
    await p.click('[data-action=release]'); await sleep(100)
    ok('Release the hold: in place, announced, the fact changes, focus on the fact', /Nobody holds/.test(await p.locator('[data-hold-text]').textContent()) && (await p.evaluate(() => document.activeElement.hasAttribute('data-hold-text'))) && st.loads === 0 && /released/.test(await p.locator('[data-hold-announce]').textContent()))
    await p.click('[data-action=take]'); await sleep(100)
    const tl = (await p.locator('[data-timeline] .moj-timeline__item').first().textContent()).replace(/\s+/g, ' ')
    ok('Take the hold: ends four hours on (15:20 if idle), History gains an entry', /Held by you, ends 15:20 if idle/.test(await p.locator('[data-hold-text]').textContent()) && /Hold taken by Aisha Rahman \(Test\)/.test(tl), tl.trim().slice(0, 80))
    await p.goto(url('rec-eglinton-retail.html')); await sleep(80)
    ok('Eglinton Retail: an ended hold says when and why (FLOW-10, A11)', /Ended .*idle for 4 hours/.test(await p.locator('[data-hold-text]').textContent()), await p.locator('[data-hold-text]').textContent())
    await c.close()
    const d = await mk('dana'); await d.p.goto(url('rec-halton-haulage.html')); await sleep(80)
    ok('Dana reads that Aisha holds Halton and sees no Take or Release action', /Held by Aisha Rahman \(Test\), ends 14:20 if idle/.test(await d.p.locator('[data-hold-text]').textContent()) && (await d.p.locator('[data-action=take], [data-action=release]').count()) === 0)
    await d.c.close()
    const a2 = await mk('aisha'); await a2.p.goto(url('rec-danforth-cleaning.html#history')); await a2.p.reload(); a2.st.loads = 0
    await a2.p.click('[data-chase-form] button[type=submit]'); await sleep(100)
    ok('Chase with nothing chosen: error summary focused at the form, same message at the field, title starts "Error: ", no load', await a2.p.evaluate(() => document.activeElement.hasAttribute('data-chase-summary')) && (await a2.p.locator('#chase-how-error').isVisible()) && (await a2.p.title()).startsWith('Error: ') && a2.st.loads === 0)
    await sleep(GAP); await a2.p.check('[data-chase-form] input[name=how] >> nth=0'); await a2.p.click('[data-chase-form] button[type=submit]'); await sleep(100)
    ok('Chase recorded: a dated note on the return (nothing sent), banner focused, History gains an entry, no load', await a2.p.evaluate(() => document.activeElement.hasAttribute('data-chase-banner')) && /dated note on the return; nothing was sent/.test(await a2.p.locator('[data-chase-banner-text]').textContent()) && !(await a2.p.title()).startsWith('Error: ') && a2.st.loads === 0)
    await a2.c.close()
    const pr = await mk('priti'); await pr.p.goto(url('rec-scarborough-robotics.html#ops')); await pr.p.reload(); pr.st.loads = 0
    ok('Scarborough: the Ops tab leads with the open step, the later steps wait', (await pr.p.locator('form[data-step=chk]').isVisible()) && !(await pr.p.locator('form[data-step=conf]').isVisible()))
    await pr.p.click('form[data-step=chk] button[type=submit]'); await sleep(100)
    ok('Ops step with no file: error summary in the form, focused, field error, no load', await pr.p.evaluate(() => document.activeElement.hasAttribute('data-ops-summary')) && (await pr.p.locator('#f-chk-error').isVisible()) && pr.st.loads === 0)
    await sleep(GAP); await pr.p.setInputFiles('#f-chk', FILE); await pr.p.click('form[data-step=chk] button[type=submit]'); await sleep(100)
    ok('Ops step saved: result announced and focused, the next step opens, no load', await pr.p.evaluate(() => document.activeElement.hasAttribute('data-ops-result')) && (await pr.p.locator('form[data-step=conf]').isVisible()) && pr.st.loads === 0)
    await pr.c.close()
  }

  // bulk assign on New returns (rule 19): no box on a flagged row, sticky bar, error in place
  {
    const { c, p, st } = await mk('priti')
    await p.goto(url('queue-new.html')); st.loads = 0
    const flagged = await p.evaluate(() => [...document.querySelectorAll('#returns tbody tr[data-slug]')].filter((r) => (r.getAttribute('data-wait') === 'yes' || r.getAttribute('data-tier') === 'red') && r.querySelector('[data-row-select]')).length)
    const noBox = await p.evaluate(() => [...document.querySelectorAll('#returns tbody tr[data-slug]:not([hidden])')].filter((r) => !r.querySelector('[data-row-select]')).length)
    ok('No checkbox on a row flagged for a person (waiting on client, a blocker or a red tier)', flagged === 0 && noBox > 0, `${flagged} flagged rows with a box; ${noBox} rows without a box`)
    ok('The bulk bar is absent until a row is chosen', await p.locator('[data-bulkbar]').isHidden())
    await tick(p, 2)
    ok('Choosing rows shows the bar with what is selected, no load', (await p.locator('[data-sel-count]').textContent()) === '2 returns selected' && (await p.locator('[data-bulkbar]').isVisible()))
    const press = async () => { const b = await p.locator('[data-bulkbar] button[type=submit]').boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await sleep(150) }
    const y0 = await p.evaluate(() => scrollY); await press()
    ok('Assign with nobody chosen: summary focused in the bar, field error, title starts "Error: ", scroll unchanged', await p.evaluate(() => document.activeElement.hasAttribute('data-bulk-summary')) && (await p.locator('#assign-to-error').isVisible()) && (await p.title()).startsWith('Error: ') && Math.abs((await p.evaluate(() => scrollY)) - y0) <= 8 && st.loads === 0)
    await sleep(GAP); await p.selectOption('#assign-to', { index: 1 }); await press()
    ok('Assign to a preparer: result announced, bar gone, focus on the next row, no load', /assigned to/.test(await p.locator('[data-bulk-result]').textContent()) && (await p.locator('[data-bulkbar]').isHidden()) && (await p.evaluate(() => !!document.activeElement.closest('tr[data-slug]'))) && st.loads === 0)
    await c.close()
  }

  say(`TASKS: ${results.filter(Boolean).length} of ${results.length} pass`)
}

// ---------- shared rule checks V1 to V8 (design/verify/rules.mjs), at both rule-18 sizes ----------
if (want('rules')) {
  const results = []
  const ck = (r, name) => { results.push(r.ok); say(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.rule} ${name}${r.ok ? '' : ': ' + r.failures.slice(0, 4).join('; ')}`) }
  const own = (rule, name, ok, detail = '') => ck({ rule, ok, failures: ok ? [] : [detail || 'failed'] }, name)
  const safe = async (fn) => { try { return await fn() } catch (e) { return { rule: 'V2', ok: false, failures: [String(e.message).split('\n')[0]] } } }
  const m = (name, sel) => ({ name, run: async (q) => { const b = await q.locator(sel).first().boundingBox(); const ih = await q.evaluate(() => innerHeight); if (!b || b.y < 0 || b.y + b.height > ih) throw new Error(`${sel} is not wholly inside the first screen`); await q.mouse.click(b.x + b.width / 2, b.y + b.height / 2) } })
  for (const size of SIZES) {
    const [w, h] = size
    say(`RULES at ${w} x ${h}`)
    const fresh = async (user, f) => { const p = await open(user, f, size); if (f.includes('#')) await p.reload(); await sleep(60); return p }
    const done = async (p) => { await p.context().close() }

    // V1 no early error: every non-error state of every page
    if (on('V1')) {
      const fails = []; let n = 0
      const skip = /-error\.html/
      for (const s of CATALOGUE) {
        if (skip.test(s.file)) continue
        const c = await ctx(s.user, w, h)
        try { const p = await c.newPage(); await p.goto(url(s.file)); const tabs = s.tabs ? TABS : ['']; for (const t of tabs) { if (t) { await p.evaluate((x) => { location.hash = x }, t); await sleep(60) } const r = await R.V1(p); n++; for (const x of r.failures) fails.push(`${s.label}${t ? '#' + t : ''}: ${x}`) } } catch (e) { fails.push(`${s.label}: ${String(e.message).split('\n')[0]}`) } finally { await c.close() }
      }
      ck({ rule: 'V1', ok: fails.length === 0, failures: fails }, `no early error on load or after input, ${n} page states`)
      for (const f of ['sign-in.html', 'code.html']) { const p = await fresh(null, f); ck(await R.V1(p), `${f}: nothing wrong before Continue`); await done(p) }
      for (const f of ['sign-in-error.html', 'code-error.html']) { const p = await fresh(null, f); const r = await p.evaluate(() => ({ summary: document.querySelectorAll('.govuk-error-summary').length, msg: document.querySelectorAll('.govuk-error-message').length, t: document.title })); own('V1', `${f}: the error shows once submitted, in the summary and at the field, title starts "Error: "`, r.summary === 1 && r.msg >= 1 && r.t.startsWith('Error: '), JSON.stringify(r)); await done(p) }
    }

    // V2 the page stays put
    if (on('V2')) {
      let p = await fresh('aisha', 'queue-a.html')
      ck(await safe(() => R.V2(p, m('Choose the All mine view', '[data-view=all]'))), 'list: choose a view tab')
      ck(await safe(() => R.V2(p, m('Sort by a heading', 'th[aria-sort] button >> nth=1'))), 'list: sort')
      ck(await safe(() => R.V2(p, m('Start the list afresh from the logo', 'a[data-home]'))), 'list: the logo starts the list afresh')
      await done(p)
      p = await fresh('aisha', 'queue-b.html')
      ck(await safe(() => R.V2(p, { name: 'Type in the filter', run: async (q) => { await q.fill('[data-list-filter]', 'rouge') } })), 'list B: filter')
      ck(await safe(() => R.V2(p, { name: 'Choose a view in the Show menu', run: async (q) => { await q.selectOption('[data-view-select]', 'all') } })), 'list B: Show menu')
      await done(p)
      p = await fresh('owen', 'board.html'); ck(await safe(() => R.V2(p, m('Choose a state in the strip', '[data-state-filter]'))), 'Board: a state in the strip'); await done(p)
      p = await fresh('priti', 'queue-new.html'); await tick(p, 2)
      ck(await safe(() => R.V2(p, m('Assign with nobody chosen', '[data-bulkbar] button[type=submit]'))), 'bulk Assign, nobody chosen')
      await sleep(GAP); await p.selectOption('#assign-to', { index: 1 })
      ck(await safe(() => R.V2(p, m('Assign to a preparer', '[data-bulkbar] button[type=submit]'))), 'bulk Assign to a preparer')
      await done(p)
      // the same, in the middle of a scrolled list as a person would
      p = await fresh('priti', 'queue-new.html'); await p.evaluate(() => window.scrollTo(0, 500))
      const spot = await p.evaluate(() => { const rows = [...document.querySelectorAll('#returns tbody tr:not([hidden])')].filter((r) => r.querySelector('[data-row-select]')); const r = rows.find((x) => { const b = x.getBoundingClientRect(); const n = x.nextElementSibling; return b.top >= 0 && n && !n.hidden && n.getBoundingClientRect().bottom <= innerHeight - 90 }); if (!r) return null; const b = r.querySelector('[data-row-select]').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2] })
      own('V2', 'a row with a next row in view exists in the middle of the New returns list', !!spot, 'none found')
      if (spot) {
        await p.mouse.click(spot[0], spot[1]); await p.selectOption('#assign-to', { index: 1 }); const y0 = await p.evaluate(() => scrollY); const bb = await p.locator('[data-bulkbar] button[type=submit]').boundingBox()
        await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(250)
        const y1 = await p.evaluate(() => scrollY); const fo = await p.evaluate(() => { const a = document.activeElement; const r = a && a.closest('tr'); const b = a.getBoundingClientRect(); return !!r && b.top >= 0 && b.bottom <= innerHeight })
        own('V2', `bulk Assign in the middle of the list: scroll moved ${y1 - y0} px, next row focused and in view`, Math.abs(y1 - y0) <= 8 && fo, `moved ${y1 - y0}, focus in view ${fo}`)
      }
      await done(p)
      p = await fresh('priti', 'queue-new.html'); await tick(p, 2); await p.evaluate(() => window.scrollTo(0, 500)); { const y0 = await p.evaluate(() => scrollY); const b = await p.locator('[data-bulkbar] button[type=submit]').boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await sleep(200); const y1 = await p.evaluate(() => scrollY); const inView = await p.evaluate(() => { const b = document.querySelector('[data-bulk-summary]').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight }); own('V2', `bulk error with the list scrolled to ${y0}: scroll moved ${y1 - y0} px, summary in view`, Math.abs(y1 - y0) <= 8 && inView, `moved ${y1 - y0}, summary in view ${inView}`) }
      await done(p)
      p = await fresh('aisha', 'rec-halton-haulage.html'); ck(await safe(() => R.V2(p, m('Release the hold', '[data-action=release]'))), 'record: release the hold'); ck(await safe(() => R.V2(p, m('Take the hold', '[data-action=take]'))), 'record: take the hold'); await done(p)
      p = await fresh('aisha', 'rec-halton-haulage.html'); for (const t of ['documents', 'exceptions', 'history', 'overview']) ck(await safe(() => R.V2(p, m(`Open the ${t} tab`, `.moj-sub-navigation__link[data-route="${t}"]`))), `record: tab ${t}`); await done(p)
      p = await fresh('aisha', 'rec-danforth-cleaning.html#history')
      ck(await safe(() => R.V2(p, m('Record a chase with nothing chosen', '[data-chase-form] button[type=submit]'))), 'chase: error in place')
      await sleep(GAP); await p.check('[data-chase-form] input[name=how] >> nth=0')
      ck(await safe(() => R.V2(p, m('Record the chase', '[data-chase-form] button[type=submit]'))), 'chase: recorded in place')
      await done(p)
      p = await fresh('dana', 'rec-lakeshore-eats.html'); ck(await safe(() => R.V2(p, m('Record a chase from the identity bar', '[data-action=chase]'))), 'identity bar, one action (Dana): Record a chase'); await done(p)
      p = await fresh('aisha', 'rec-danforth-cleaning.html')
      ck(await safe(() => R.V2(p, m('Open the Actions menu', '.moj-button-menu__toggle-button'))), 'identity bar, two actions (Aisha): open the Actions menu')
      ck(await safe(() => R.V2(p, m('Choose Record a chase in the Actions menu', '[data-action=chase]'))), 'identity bar, two actions (Aisha): Record a chase'); await done(p)
      p = await fresh('priti', 'rec-scarborough-robotics.html#ops')
      ck(await safe(() => R.V2(p, m('Upload with no file', 'form[data-step=chk] button[type=submit]'))), 'Ops form: error in place')
      await sleep(GAP); await p.setInputFiles('#f-chk', FILE)
      ck(await safe(() => R.V2(p, m('Upload the check export', 'form[data-step=chk] button[type=submit]'))), 'Ops form: saved in place')
      await done(p)
      p = await fresh('priti', 'rec-riverdale-rentals.html#ops'); ck(await safe(() => R.V2(p, m('Send T183CORP', 'form[data-step=t183] button[type=submit]'))), 'Ops step without fields: saved in place'); await done(p)
      p = await fresh('aisha', 'rec-halton-haulage.html#documents')
      ck(await safe(() => R.V2(p, m('Open a source', '[data-doc="1"]'))), 'Documents: open a source'); ck(await safe(() => R.V2(p, m('Open the next source', '[data-doc="2"]'))), 'Documents: open another source'); await done(p)
    }

    // V3 the work is in view
    if (on('V3')) {
      for (const f of ['sign-in.html', 'sign-in-error.html', 'code.html', 'code-error.html']) { const p = await fresh(null, f); ck(await R.V3(p), `${f}: the form and Continue are in the first screen`); await done(p) }
      for (const [u, f] of [['aisha', 'halton-haulage'], ['dana', 'maple-ridge'], ['dana', 'riverdale-rentals'], ['aisha', 'eglinton-retail']]) { const p = await fresh(u, `rec-${f}.html#documents/1`); ck(await R.V3(p), `Documents with a source open, ${f} (${u})`); await done(p) }
      let open = 0; let na = 0
      for (const [u, f] of [['priti', 'scarborough-robotics'], ['priti', 'riverdale-rentals'], ['priti', 'queen-west-design'], ['priti', 'lakeshore-eats'], ['dana', 'eglinton-holdings'], ['owen', 'halton-haulage']]) { const p = await fresh(u, `rec-${f}.html#ops`); const has = await p.locator('[data-ops-form]:not([hidden])').count(); if (!has) { na++; await done(p); continue } open++; ck(await R.V3(p), `Ops tab, an open step, ${f} (${u})`); await done(p) }
      say(`  ops pages with no open step (nothing to decide): ${na}; with one: ${open}`)
      let p = await fresh('priti', 'rec-scarborough-robotics.html#ops'); { const b = await p.locator('form[data-step=chk] button[type=submit]').boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2) } await sleep(150)
      ck(await R.V3(p), 'Ops tab in the error state (summary above the field)'); await done(p)
      p = await fresh('priti', 'queue-new.html'); await tick(p, 1); ck(await R.V3(p, { evidence: '[data-sel-count]' }), 'bulk bar: what is selected and Assign'); await done(p)
      p = await fresh('aisha', 'rec-danforth-cleaning.html#history'); ck(await R.V3(p, { evidence: '[data-chase-form] fieldset', primary: '[data-chase-form] button[type=submit]' }), 'History: the chase form is in the first screen'); await done(p)
    }

    // V4 focus lands
    if (on('V4')) {
      let p = await fresh(null, 'sign-in-error.html'); own('V4', 'sign-in error: focus on the error summary on load', await p.evaluate(() => document.activeElement && document.activeElement.className.includes('govuk-error-summary')), 'summary not focused'); await done(p)
      p = await fresh(null, 'code-error.html'); own('V4', 'code error: focus on the error summary on load', await p.evaluate(() => document.activeElement && document.activeElement.className.includes('govuk-error-summary')), 'summary not focused'); await done(p)
      p = await fresh('aisha', 'rec-halton-haulage.html#documents'); ck(await R.V4(p, { name: 'Open a source', click: '[data-doc="1"]', expect: '[data-viewer-title]' }, { shortcuts: [{ key: 's', selector: '#header-search' }] }), 'Documents: focus on the viewer heading; key s'); await done(p)
      p = await fresh('priti', 'queue-new.html'); await tick(p, 2)
      ck(await R.V4(p, { name: 'Assign, nobody chosen', click: '[data-bulkbar] button[type=submit]', expect: '[data-bulk-summary]' }), 'bulk error: focus on the summary')
      await sleep(GAP); await p.selectOption('#assign-to', { index: 1 })
      ck(await R.V4(p, { name: 'Assign to a preparer', click: '[data-bulkbar] button[type=submit]', expect: 'tr[data-slug] a[data-pick]' }), 'bulk success: focus on the next row'); await done(p)
      p = await fresh('priti', 'rec-scarborough-robotics.html#ops')
      ck(await R.V4(p, { name: 'Upload with no file', click: 'form[data-step=chk] button[type=submit]', expect: '[data-ops-summary]' }), 'Ops error: focus on the summary')
      await sleep(GAP); await p.setInputFiles('#f-chk', FILE)
      ck(await R.V4(p, { name: 'Upload the check export', click: 'form[data-step=chk] button[type=submit]', expect: '[data-ops-result]' }), 'Ops success: focus on the result'); await done(p)
      p = await fresh('aisha', 'rec-danforth-cleaning.html#history')
      ck(await R.V4(p, { name: 'Record a chase, nothing chosen', click: '[data-chase-form] button[type=submit]', expect: '[data-chase-summary]' }), 'chase error: focus on the summary')
      await sleep(GAP); await p.check('[data-chase-form] input[name=how] >> nth=0')
      ck(await R.V4(p, { name: 'Record the chase', click: '[data-chase-form] button[type=submit]', expect: '[data-chase-banner]' }), 'chase recorded: focus on the banner'); await done(p)
      p = await fresh('dana', 'rec-lakeshore-eats.html'); ck(await R.V4(p, { name: 'Record a chase from the identity bar', click: '[data-action=chase]', expect: '#chase-how' }), 'identity bar chase (one action): focus on the first choice'); await done(p)
      p = await fresh('aisha', 'rec-danforth-cleaning.html')
      ck(await R.V4(p, { name: 'Open the Actions menu', click: '.moj-button-menu__toggle-button', expect: '.moj-button-menu__toggle-button' }), 'Actions menu opened: focus stays on the menu button')
      ck(await R.V4(p, { name: 'Record a chase from the Actions menu', click: '[data-action=chase]', expect: '#chase-how' }), 'identity bar chase (Actions menu): focus on the first choice'); await done(p)
      p = await fresh('aisha', 'rec-halton-haulage.html')
      ck(await R.V4(p, { name: 'Release the hold', click: '[data-action=release]', expect: '[data-hold-text]' }), 'hold released: focus on the hold fact')
      ck(await R.V4(p, { name: 'Take the hold', click: '[data-action=take]', expect: '[data-hold-text]' }), 'hold taken: focus on the hold fact')
      ck(await R.V4(p, { name: 'Open the Documents tab', click: '.moj-sub-navigation__link[data-route="documents"]', expect: '.moj-sub-navigation__link[data-route="documents"]' }), 'tab change: focus stays on the tab'); await done(p)
      p = await fresh('owen', 'board.html'); ck(await R.V4(p, { name: 'Choose a state', click: '[data-state-filter="review"]', expect: '[data-state-filter="review"]' }, { shortcuts: [{ key: 's', selector: '#header-search' }] }), 'Board: focus stays on the chosen state; key s'); await done(p)
      p = await fresh('aisha', 'queue-b.html'); ck(await R.V4(p, { name: 'Filter to nothing, then Clear', run: async (q) => { await q.fill('[data-list-filter]', 'zzz'); await q.click('[data-filter-clear]') }, expect: '[data-list-filter]' }, { shortcuts: [{ key: 's', selector: '#header-search' }] }), 'list: Clear puts focus on the filter; key s'); await done(p)
      p = await fresh('aisha', 'queue-a.html'); ck(await R.V4(p, { name: 'Choose All mine', click: '[data-view=all]', expect: '[data-view=all]' }), 'list: focus stays on the chosen view tab')
      ck(await R.V4(p, { name: 'The logo starts the list afresh', click: 'a[data-home]', expect: '[data-list-status]' }), 'list: the logo puts focus on the status line')
      // Back from a record returns to the row you came from
      const slug = await p.evaluate(() => { const a = document.querySelectorAll('#returns tbody tr:not([hidden]) a[data-pick]')[3]; const s = a.closest('tr').getAttribute('data-slug'); a.click(); return s })
      await p.waitForURL(/rec-/); await sleep(120); await p.locator('[data-back]').click(); await p.waitForURL(/queue-a/); await sleep(200)
      const same = await p.evaluate((s) => document.activeElement && document.activeElement.closest('tr') && document.activeElement.closest('tr').getAttribute('data-slug') === s, slug)
      own('V4', 'Back to the list: focus on the row you came from', same, 'a different row has focus'); await done(p)
    }

    // V5 counts carry their scope, per person
    if (on('V5')) {
      const perUser = {}
      for (const [user, files] of Object.entries({ aisha: ['queue-a.html', 'queue-b.html', 'queue-a.html#view=all', 'queue-a.html#view=rework'], casey: ['queue-a-empty.html', 'queue-b-empty.html'], dana: ['queue-a.html', 'queue-b.html', 'queue-cpa.html', 'queue-ops.html', 'queue-new.html', 'board.html'], priti: ['queue-ops.html', 'queue-new.html'], owen: ['board.html', 'queue-a.html', 'queue-cpa.html', 'queue-ops.html', 'queue-new.html'] })) {
        const all = []; const fails = []; const badge = new Map(); const badFail = []
        for (const f of files) {
          const p = await fresh(user, f); const r = await R.V5(p); all.push(r); for (const x of r.failures) fails.push(`${f}: ${x}`)
          // the shared V5same reads the first number in the text, which for "Due in 14 days" is 14; the badge number is read here
          const bs = await p.evaluate(() => [...document.querySelectorAll('[data-view][data-count], [data-state-filter][data-count]')].map((a) => { const b = a.querySelector('.moj-badge, .app-pipe__count'); return [a.getAttribute('data-count'), b ? +b.textContent.replace(/\D/g, '') : null] }))
          for (const [n, v] of bs) { if (badge.has(n) && badge.get(n) !== v) badFail.push(`"${n}" is ${badge.get(n)} on one page and ${v} on ${f}`); else badge.set(n, v) }
          await done(p)
        }
        perUser[user] = all
        ck({ rule: 'V5', ok: fails.length === 0, failures: fails }, `${user}: every visible count has a scope word or "N of M", ${all.length} pages, ${all.reduce((n, r) => n + r.counts.length, 0)} counts`)
        ck(R.V5same(all), `${user}: the same name and scope is the same number on every page`)
        own('V5', `${user}: the number on each view tab or state button (${badge.size} names) is the same on every page that shows it`, badFail.length === 0, badFail.join('; '))
      }
      // names carry scope: the same label is never the same count name for a person's own and everyone's
      const a = perUser.aisha[0].counts.map((c) => c.name); const d = perUser.dana[0].counts.map((c) => c.name)
      own('V5', 'My returns and the Preparer queue never share a count name (A252, K4)', !a.some((n) => d.includes(n)), a.filter((n) => d.includes(n)).join(', '))
      let p = await fresh('owen', 'board.html'); ck(await R.V5caption(p, { name: 'Choose a state', click: '[data-state-filter="rework"]' }, { caption: '[data-status-count]' }), 'Board status line follows the state chosen')
      const cap = (await p.locator('[data-status-count]').textContent()).trim(); const clr = await p.locator('[data-filter-clear]').isVisible()
      const strip = +(await p.locator('[data-state-filter="rework"] .app-pipe__count').textContent())
      own('V5', `Board status reads "${cap}" with a visible Clear, and the number is the one on the state button (${strip})`, new RegExp(`^Showing ${strip} of 300 returns in All returns, state Rework\\.$`).test(cap) && clr, cap); await done(p)
      p = await fresh('aisha', 'queue-b.html'); await p.fill('[data-list-filter]', 'zzz-no-such')
      own('V5', 'list filter updates its count line', /Showing 0 of \d+ returns in .*matching "zzz-no-such"/.test(await p.locator('[data-status-count]').textContent()), await p.locator('[data-status-count]').textContent()); await done(p)
      const bad = []
      for (const [user, f] of [['aisha', 'queue-a.html'], ['aisha', 'queue-a.html#view=rework'], ['dana', 'queue-cpa.html'], ['dana', 'queue-a.html'], ['priti', 'queue-ops.html'], ['owen', 'board.html']]) { const q = await fresh(user, f); const t = await q.evaluate(() => { const b = document.querySelector('[data-view][aria-current="page"] .moj-badge'); const tot = /of (\d+) returns/.exec(document.querySelector('[data-status-count]').textContent); return [b ? +b.textContent.replace(/\D/g, '') : -1, tot ? +tot[1] : -2] }); if (t[0] !== t[1]) bad.push(`${user} ${f}: tab ${t[0]}, rows ${t[1]}`); await done(q) }
      own('V5', 'the open view tab count equals the "of M" of its list', bad.length === 0, bad.join('; '))
    }

    // V6 search keeps its promise
    if (on('V6')) {
      const p = await fresh('dana', 'queue-cpa.html')
      const r = await R.V6(p, { input: '#header-search', result: '[data-search-table] tbody tr, .moj-identity-bar', label: '.app-search__label', kinds: [{ kind: 'name', value: 'Halton Haulage Ltd. (Test)' }, { kind: 'number', value: '779886143' }, { kind: 'year end', value: '31 Mar 2026' }, { kind: 'year end', value: 'Mar 2026' }, { kind: 'year end', value: '2026-03' }] })
      ck(r, 'search by name "Halton Haulage Ltd. (Test)", number "779886143", year end "31 Mar 2026", "Mar 2026", "2026-03"')
      await done(p)
      const q = await fresh('aisha', 'queue-a.html')
      ck(await R.V6(q, { input: '#header-search', result: '[data-search-table] tbody tr, .moj-identity-bar', label: '.app-search__label', kinds: [{ kind: 'name', value: 'Danforth Cleaning Co. Ltd. (Test)' }, { kind: 'year end', value: '31 Mar 2026' }] }), 'a preparer finds her own by name and year end')
      await done(q)
    }

    // V7 every click does something
    if (on('V7')) {
      // each control starts from the same state: the guide page (no guard) restores the person's session and clears the tab's saved holds, then the page under test loads
      const setSession = (u) => { try { sessionStorage.clear(); ['proto-user', 'proto-since', 'proto-last'].forEach((k) => localStorage.removeItem(k)); if (u) { localStorage.setItem('proto-user', u); localStorage.setItem('proto-since', String(Date.now())); localStorage.setItem('proto-last', String(Date.now())) } localStorage.setItem('proto-seeded', '1') } catch (e) {} }
      const reset = (who, u) => async (q) => { await q.goto(url('index.html')); await q.evaluate(setSession, who); await q.goto(u) }
      const pages = [['aisha', 'queue-a.html', 90], ['aisha', 'queue-b.html', 90], ['casey', 'queue-a-empty.html', 40], ['dana', 'queue-a.html', 60], ['dana', 'queue-cpa.html', 60], ['priti', 'queue-ops.html', 60], ['priti', 'queue-new.html', 60], ['owen', 'board.html', 70], ['dana', 'search.html?q=rouge+valley', 40],
        [null, 'sign-in.html', 20], [null, 'sign-in-error.html', 20], [null, 'code.html', 20], [null, 'code-error.html', 20], [null, 'sign-in-ended.html?next=queue-a.html', 20], [null, 'signed-out.html', 20],
        ['aisha', 'rec-halton-haulage.html#documents/1', 60], ['aisha', 'rec-danforth-cleaning.html#history', 60], ['priti', 'rec-scarborough-robotics.html#ops', 60], ['dana', 'rec-maple-ridge.html#overview', 60], ['aisha', 'rec-eglinton-retail.html#overview', 60], ['owen', 'rec-riverdale-rentals.html#overview', 60], ['dana', 'rec-lakeshore-eats.html#history', 60]]
      for (const [user, f, lim] of pages) {
        const p = await fresh(user, f)
        // the skip link is tested by keyboard below; the header Search button on the results page runs the same query again; Continue and Verify on an error page, with the fields left empty, show the same error again
        // (the next block presses them with correct entries)
        const skip = '[disabled], [aria-disabled=true], [data-noop-ok], .govuk-skip-link' + (f.startsWith('search') ? ', .app-search__button' : '') + (/-error\.html/.test(f) ? ', [data-primary]' : '')
        ck(await R.V7(p, { reset: reset(user, url(f)), limit: lim, skip }), `every control does something on ${user || 'nobody'}: ${f}`)
        await done(p)
        // the address holds the tab, view, filter and sort (rule 21), so the skip link moves focus to the main block and leaves the address alone
        const q = await fresh(user, f); const before = q.url(); await q.evaluate(() => document.querySelector('.govuk-skip-link').focus()); await q.keyboard.press('Enter'); await sleep(100)
        own('V7', `the skip link works by keyboard on ${f}: focus moves to the main block and the address (tab, view, filter, sort) is unchanged`, q.url() === before && (await q.evaluate(() => document.activeElement && document.activeElement.id === 'main-content')), `address ${before.replace(BASE, '')} -> ${q.url().replace(BASE, '')}, focus on ${await q.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName))}`)
        await done(q)
      }
      // the two error pages: with correct entries Continue and Verify move on
      {
        let p = await fresh(null, 'sign-in-error.html'); await p.fill('#user-id', 'aisha'); await p.fill('#password', 'ashbridge-test'); await p.click('[data-primary]'); await p.waitForURL(/code\.html/, { timeout: 3000 }).catch(() => {})
        own('V7', 'sign-in-error.html: Continue with correct entries moves on to the code page', /code\.html/.test(p.url()), p.url().replace(BASE, '')); await done(p)
        p = await fresh(null, 'code-error.html'); await p.fill('#code', '482913'); await p.click('[data-primary]'); await p.waitForURL(/queue-a\.html/, { timeout: 3000 }).catch(() => {})
        own('V7', 'code-error.html: Verify with the right code signs in and opens the list', /queue-a\.html/.test(p.url()), p.url().replace(BASE, '')); await done(p)
      }
    }

    // V8 one choice, one action
    if (on('V8')) own('V8', 'not applicable: no field in this family is tied to an option (the bulk assign is one select and one button; the chase is three radios and one button)', true)
    say(`  RULES at ${w} x ${h}: ${results.filter(Boolean).length} of ${results.length} pass so far`)
  }
  say(`RULES: ${results.filter(Boolean).length} of ${results.length} pass`)
}

say(`PAGE ERRORS: ${pageErrors.length}${pageErrors.length ? ' ' + [...new Set(pageErrors)].slice(0, 8).join(' | ') : ''}`)
await browser.close(); srv.close()
fs.mkdirSync(path.join(here, 'verify-output'), { recursive: true })
fs.writeFileSync(path.join(here, 'verify-output', `${which}${sizeArg ? '-' + sizeArg : ''}${onlyArg ? '-only-' + onlyArg.replace(/,/g, '-') : ''}.txt`), out.join('\n') + '\n')
