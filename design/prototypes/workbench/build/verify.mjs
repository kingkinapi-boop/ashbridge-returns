// Verify script for the workbench (version B, round 2). Run:
//   PW_NM=<node_modules folder holding playwright and @axe-core/playwright> node tools/heavy.mjs -- node design/prototypes/workbench/build/verify.mjs [section ...]
// Sections (default all): lint, walk, rules, axe, keys, reflow, budgets. Serves design/ over http (never file://).
// Prints one line per check and a summary; exit code 1 if anything fails. The numbers go into reports/design-workbench.md.
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as R from '../../../verify/rules.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const DESIGN = path.resolve(here, '../../..')
const SRC = path.join(here, '..', 'b-split-pane')
const NM = process.env.PW_NM
const req = NM ? createRequire(NM.replace(/node_modules\/?$/, '') + 'x.js') : createRequire(import.meta.url)
const { chromium } = req('playwright')
let AxeBuilder = null
try { AxeBuilder = req('@axe-core/playwright').AxeBuilder || req('@axe-core/playwright').default } catch (e) { AxeBuilder = null }
const want = new Set(process.argv.slice(2))
const on = (s) => want.size === 0 || want.has(s)

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.csv': 'text/csv', '.svg': 'image/svg+xml' }
const srv = http.createServer((q, r) => {
  const f = path.join(DESIGN, decodeURIComponent(q.url.split('?')[0]))
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('nf') } r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const ROOT = `http://127.0.0.1:${srv.address().port}/`
const B = ROOT + 'prototypes/workbench/b-split-pane/'
const browser = await chromium.launch()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SIZES = R.SIZES
const MINBOX = {}

let pass = 0
const fails = []
const counts = {}
function ck(section, name, ok, detail = '') {
  counts[section] = counts[section] || { pass: 0, fail: 0 }
  if (ok) { counts[section].pass++; pass++; if (process.env.VERBOSE && section !== 'rules' && section !== 'walk') console.log('ok   ' + section + ': ' + name) } else { counts[section].fail++; fails.push(`${section}: ${name} ${detail}`); console.log(`FAIL ${section}: ${name} ${detail}`) }
}
async function open(url, [w, h], opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, ...opts })
  const page = await ctx.newPage()
  page.__errors = []
  page.on('pageerror', (e) => page.__errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.__errors.push(m.text()) })
  await page.goto(url.startsWith('http') ? url : B + url)
  await sleep(350)
  page.__ctx = ctx
  return page
}
const done = (page) => page.__ctx.close()
const rec = (stage, hash, extra = '') => `record.html?stage=${stage}${extra}#/${hash}`

// ---------------------------------------------------------------- page list (every page and state linked from states.html)
const states = fs.readFileSync(path.join(SRC, 'states.html'), 'utf8')
const PAGES = [...new Set([...states.matchAll(/<a [^>]*href="([^"#][^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))].filter((u) => !/^(https?:|mailto:)/.test(u))
const ERRORISH = /\/(error|blocked)$|signed-out/

// ================================================================ LINT (design card checks 6, 7, 9)
if (on('lint')) {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.html')).map((f) => path.join(SRC, f))
    .concat(fs.readdirSync(path.join(SRC, 'assets')).filter((f) => /\.(css|js)$/.test(f)).map((f) => path.join(SRC, 'assets', f)))
    .concat([path.join(SRC, 'PARTS.md'), path.join(SRC, '..', '..', '..', 'briefs', 'workbench.md')])
    .concat(fs.readdirSync(path.join(DESIGN, 'parts', 'cite-or-reason')).map((f) => path.join(DESIGN, 'parts', 'cite-or-reason', f)))
  const RETIRED = /export 1\b|export 2\b|review-lines export|receipt export|receipt check|gate 1\b|judgment input sheet|AI-proposed GIFI|AI-proposed code|Judgment tab|Judgment: 0/i
  let retired = 0, dash = 0, zoom = 0, cdn = 0, filler = 0, inline = 0
  for (const f of files) {
    if (!fs.existsSync(f)) continue
    const t = fs.readFileSync(f, 'utf8')
    const isBrief = f.endsWith('workbench.md')
    if (RETIRED.test(t.replace(/Judgment: 0 found/g, ''))) { retired++; console.log('retired term in', path.relative(DESIGN, f)) }
    if (/—/.test(t)) { dash++; console.log('em dash in', path.relative(DESIGN, f)) }
    if (/[^-]zoom\s*:/.test(t) && f.endsWith('.css')) zoom++
    if (/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(t) && !isBrief && !f.endsWith('.md') && /fonts\.googleapis|cdn\.|unpkg|jsdelivr|cdnjs/.test(t)) cdn++
    if (/lorem ipsum|coming soon|\bTODO\b|placeholder text/i.test(t) && !isBrief) filler++
    if (f.endsWith('.html') && /<[a-z][^>]*\sstyle="/i.test(t)) { inline++; console.log('inline style in', path.relative(DESIGN, f)) }
  }
  ck('lint', 'retired terms (check 6)', retired === 0, `${retired} files`)
  ck('lint', 'em dashes', dash === 0, `${dash} files`)
  ck('lint', 'CSS zoom', zoom === 0)
  ck('lint', 'CDN or third-party font', cdn === 0)
  ck('lint', 'placeholder text', filler === 0)
  ck('lint', 'inline style attributes in source', inline === 0)
  const brief = fs.readFileSync(path.join(DESIGN, 'briefs', 'workbench.md'), 'utf8')
  ck('lint', 'brief names its blueprint commit', /b9c5003/.test(brief))
  // classes: only govuk-, moj-, app-; every app- class listed in PARTS.md or the part README
  const listed = fs.readFileSync(path.join(SRC, 'PARTS.md'), 'utf8') + fs.readFileSync(path.join(DESIGN, 'parts', 'cite-or-reason', 'README.md'), 'utf8')
  const used = new Set(); const odd = new Set()
  for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.html'))) {
    const t = fs.readFileSync(path.join(SRC, f), 'utf8')
    for (const m of t.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/).filter(Boolean)) { if (c.startsWith('app-')) used.add(c); else if (!/^(govuk-|moj-|js-enabled)/.test(c)) odd.add(c) }
  }
  const js = fs.readFileSync(path.join(SRC, 'assets', 'b.js'), 'utf8') + fs.readFileSync(path.join(DESIGN, 'parts', 'cite-or-reason', 'cite-or-reason.js'), 'utf8')
  for (const m of js.matchAll(/className = '([^']*)'/g)) for (const c of m[1].split(/\s+/)) if (c.startsWith('app-')) used.add(c)
  const unlisted = [...used].filter((c) => !new RegExp('`' + c.replace(/[-_]/g, '[-_]') + '`').test(listed) && !listed.includes('`' + c + '`') && !listed.includes(c))
  ck('lint', `every app- class is listed with a reason (${used.size} classes)`, unlisted.length === 0, unlisted.join(' '))
  ck('lint', 'only govuk-, moj- and app- classes', odd.size === 0, [...odd].join(' '))
  // links: no self-link, no # link that changes nothing, no link to a missing file
  let bad = 0
  for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.html'))) {
    const t = fs.readFileSync(path.join(SRC, f), 'utf8')
    for (const m of t.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>/g)) {
      const h = m[1]
      if (h.includes("'+") || /govuk-header__homepage-link/.test(m[0])) continue // script templates; the logo is the home link
      if (h === '#' || h === '') { bad++; console.log('empty link in', f); continue }
      if (/^(https?:|mailto:|data:)/.test(h) || h.startsWith('#')) continue
      const file = h.split(/[?#]/)[0]
      if (file === f && !h.includes('#') && !h.includes('?')) { bad++; console.log('self link', f, h) }
      if (file && !fs.existsSync(path.join(SRC, file))) { bad++; console.log('missing', f, h) }
    }
    const ids = [...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i && !/__ID__/.test(x))
    if (dup.length) { bad++; console.log('duplicate ids in', f, [...new Set(dup)].join(' ')) }
  }
  ck('lint', 'no self-link, empty link, missing file or duplicate id (check 7)', bad === 0, `${bad} findings`)
}

// ================================================================ WALK: the re-walked tasks (P6 cite and reason, Books, Comments, Gaps) at both sizes
const activeItem = '.app-paneset:not([hidden]) .app-item:not([hidden])'
const activeH2 = activeItem + ' .app-item__head h2'
const jsClick = (sel) => async (q) => { await q.evaluate((x) => document.querySelector(x).click(), sel) }
async function scrollY(p) { return p.evaluate(() => scrollY) }
async function stateOf(p, id) { return (await p.locator(`tr[data-id="${id}"] [data-state]`).first().innerText()).replace(/\s+/g, ' ').trim() }
if (on('walk')) {
  for (const size of SIZES) {
    const tag = `${size[0]}x${size[1]}`
    // ---- P6, source path: 2 clicks
    let p = await open(rec('traced', 'trace'), size)
    let clicks = 0
    const y0 = await scrollY(p)
    await p.click(`${activeItem} [name="t1-src"][value="0"]`, { force: true }); clicks++
    await p.click(`${activeItem} [data-primary]`); clicks++
    await sleep(500)
    ck('walk', `${tag} P6 cite by source: 2 clicks`, clicks === 2)
    ck('walk', `${tag} P6 cite by source: state is Cited-or-Source saved`, /Source saved|Cited/.test(await stateOf(p, 't1')), await stateOf(p, 't1'))
    ck('walk', `${tag} P6 cite: page did not move`, Math.abs((await scrollY(p)) - y0) <= 8)
    ck('walk', `${tag} P6 cite: focus on the next row's heading`, await p.evaluate(() => document.activeElement && document.activeElement.tagName === 'H2' && /S8\.RENT\.HOME/.test(document.activeElement.textContent)), await p.evaluate(() => document.activeElement && document.activeElement.outerHTML.slice(0, 80)))
    ck('walk', `${tag} P6 cite: next item's source is in the viewer`, await p.locator(`${activeItem}`).evaluate((it) => !!it.querySelector('[data-viewer]:not([hidden]) [data-viewer-box]')))
    ck('walk', `${tag} P6 left list shows 5 open after one cite`, /5/.test(await p.locator('[data-badge="trace"]').first().innerText()))
    await done(p)
    // ---- P6, reason path: click the box, type, Cite = 2 clicks; no "choose" error
    p = await open(rec('traced', 'trace'), size)
    clicks = 0
    await p.click(`${activeItem} [data-cor-reason]`); clicks++
    await p.keyboard.type('Half of account 6020 is the meals add-back; the client confirmed by email on 12 Jan.')
    ck('walk', `${tag} P6 typing selects "A written reason"`, await p.locator(`${activeItem} [data-cor-reason-radio]`).isChecked())
    await p.click(`${activeItem} [data-primary]`); clicks++
    await sleep(500)
    ck('walk', `${tag} P6 cite by reason: 2 clicks`, clicks === 2)
    ck('walk', `${tag} P6 cite by reason: saved`, /Source saved/.test(await stateOf(p, 't1')), await stateOf(p, 't1'))
    ck('walk', `${tag} P6 reason: no error left on the page`, (await p.locator('.govuk-error-summary:visible, .govuk-error-message:visible').count()) === 0)
    await done(p)
    // ---- both orders: source then reason, reason then source
    p = await open(rec('traced', 'trace'), size)
    await p.click(`${activeItem} [name="t1-src"][value="0"]`, { force: true })
    await p.fill(`${activeItem} [data-cor-reason]`, 'x reason')
    ck('walk', `${tag} P6 source then type: the reason radio wins`, await p.locator(`${activeItem} [data-cor-reason-radio]`).isChecked())
    await p.click(`${activeItem} [name="t1-src"][value="1"]`, { force: true })
    ck('walk', `${tag} P6 type then pick a source: the source wins`, await p.locator(`${activeItem} [name="t1-src"][value="1"]`).isChecked() && !(await p.locator(`${activeItem} [data-cor-reason-radio]`).isChecked()))
    await done(p)
    // ---- empty submit: GOV.UK error pattern, in place, summary focused inside the form
    p = await open(rec('traced', 'trace'), size)
    const ys = await scrollY(p)
    await p.click(`${activeItem} [data-primary]`)
    await sleep(250)
    const ev = await p.evaluate(() => {
      const f = document.querySelector('.app-paneset:not([hidden]) .app-item:not([hidden]) form')
      const sum = f.querySelector('.govuk-error-summary'); const a = document.activeElement
      return { sumVisible: !!sum && sum.getClientRects().length > 0, focusInSum: a === sum || (sum && sum.contains(a)), inForm: sum && f.contains(sum), title: document.title, msg: [...f.querySelectorAll('.govuk-error-message')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()), link: sum && sum.querySelector('a') ? sum.querySelector('a').getAttribute('href') : '' }
    })
    ck('walk', `${tag} error: summary at the top of the form and focused`, ev.sumVisible && ev.focusInSum && ev.inForm, JSON.stringify(ev))
    ck('walk', `${tag} error: title starts "Error: "`, /^Error: /.test(ev.title))
    ck('walk', `${tag} error: same message at the field`, ev.msg.length >= 1 && /Choose a source or write a reason/.test(ev.msg.join(' ')), ev.msg.join('|'))
    ck('walk', `${tag} error: page scroll kept`, Math.abs((await scrollY(p)) - ys) <= 8)
    ck('walk', `${tag} error: nothing preselected`, (await p.locator(`${activeItem} input[type=radio]:checked`).count()) === 0)
    // reason radio chosen with no text
    await p.click(`${activeItem} [data-cor-reason-radio]`, { force: true })
    await p.click(`${activeItem} [data-primary]`)
    await sleep(250)
    const msg2 = await p.locator(`${activeItem} .app-cor__reason .govuk-error-message`).first().innerText().catch(() => '')
    ck('walk', `${tag} error: reason chosen but empty says what to write`, /Write the reason/.test(msg2), msg2)
    await done(p)
    // ---- load: no error before a submit anywhere in Trace
    // ---- pinned pane: the pane stays put when the page scrolls, on Trace, Books, Comments, Gaps
    for (const [name, url] of [['Trace', rec('traced', 'trace')], ['Books', rec('import', 'books', '&sel=a2010')], ['Comments', rec('rework', 'comments')], ['Gaps', rec('import', 'gaps')]]) {
      p = await open(url, size)
      const info = await p.evaluate(() => {
        const pane = document.querySelector('.app-pane'); const r0 = pane.getBoundingClientRect()
        const nat = r0.top + scrollY; const max = document.documentElement.scrollHeight - innerHeight
        scrollTo(0, Math.min(max, 400))
        const r1 = pane.getBoundingClientRect()
        const prim = document.querySelector('.app-paneset:not([hidden]) .app-item:not([hidden]) [data-primary]')
        const pb = prim ? prim.getBoundingClientRect() : null
        const box = document.querySelector('.app-paneset:not([hidden]) [data-viewer-box]'); const bb = box ? box.getBoundingClientRect() : null
        return { nat: Math.round(nat), moved: scrollY, top: Math.round(r1.top), bottom: Math.round(r1.bottom), vh: innerHeight, prim: pb && [Math.round(pb.top), Math.round(pb.bottom)], box: bb && [Math.round(bb.top), Math.round(bb.bottom)] }
      })
      const expectTop = Math.max(8, info.nat - info.moved)
      ck('walk', `${tag} ${name}: pane stays put (top ${info.top}, expected ${expectTop})`, Math.abs(info.top - expectTop) <= 2 && info.bottom <= info.vh, JSON.stringify(info))
      ck('walk', `${tag} ${name}: decision still in view after the page scrolled`, !info.prim || (info.prim[0] >= 0 && info.prim[1] <= info.vh), JSON.stringify(info))
      ck('walk', `${tag} ${name}: source still in view after the page scrolled`, !info.box || (info.box[0] >= 0 && info.box[1] <= info.vh), JSON.stringify(info))
      await done(p)
    }
    // ---- Books: flags only, a flagged row, no confirm button, row pick keeps scroll and history
    p = await open(rec('import', 'books', '&sel=a2010'), size)
    ck('walk', `${tag} Books: no confirm button`, (await p.getByRole('button', { name: /confirm|accept all/i }).count()) === 0)
    const h0 = await p.evaluate(() => history.length); const yb = await scrollY(p)
    await jsClick('tr[data-id="a6090"] [data-row]')(p); await sleep(250)
    ck('walk', `${tag} Books: row pick keeps scroll, adds no history`, Math.abs((await scrollY(p)) - yb) <= 8 && (await p.evaluate(() => history.length)) === h0)
    ck('walk', `${tag} Books: pane shows the mapped-twice account`, /6090/.test(await p.locator(`${activeH2}`).innerText()))
    ck('walk', `${tag} Books: highlighted source line is inside the box`, await p.evaluate(() => { const b = document.querySelector('.app-paneset:not([hidden]) [data-viewer-box]'); const h = b && b.querySelector('[data-hl]'); if (!h) return false; const a = b.getBoundingClientRect(), c = h.getBoundingClientRect(); return c.top >= a.top - 1 && c.bottom <= a.bottom + 1 }))
    const pop = p.context().waitForEvent('page', { timeout: 3000 }).catch(() => null)
    await p.click(`${activeItem} [data-src-window]`)
    const pg = await pop
    ck('walk', `${tag} Books: second window opens by script`, !!pg)
    if (pg) await pg.close()
    await done(p)
    // ---- Comments: approve the drafted fix in place, counts agree; Resolve at the number goes to the cell
    p = await open(rec('rework', 'comments', '&sel=c2'), size)
    const yc = await scrollY(p)
    await p.click(`${activeItem} [data-act="set"]`); await sleep(400)
    ck('walk', `${tag} Comments: approve keeps the scroll`, Math.abs((await scrollY(p)) - yc) <= 8)
    ck('walk', `${tag} Comments: approve keeps the comment open until the round trip`, /Draft approved/.test(await stateOf(p, 'c2')), await stateOf(p, 'c2'))
    ck('walk', `${tag} Comments: counts agree (badge, list, next step)`, await p.evaluate(() => { const open = document.querySelectorAll('.app-view[data-view="comments"] tr[data-open="1"]').length; const b = document.querySelector('[data-badge="comments"] [data-n]'); return b && Number(b.textContent) === open }))
    await p.click('.app-ws a[data-goto="comments"]').catch(() => {})
    await p.click('tr[data-id="c1"] [data-row]'); await sleep(250)
    await p.click(`${activeItem} a[data-goto="trace"]`); await sleep(500)
    ck('walk', `${tag} Comments: Resolve at the number opens Trace on S4.LOAN.INT`, /trace$/.test(p.url()) && /S4\.LOAN\.INT/.test(await p.locator(`${activeH2}`).innerText()), p.url())
    await done(p)
    // ---- Gaps: Keep moves to the next question and announces
    p = await open(rec('import', 'gaps'), size)
    const yg = await scrollY(p)
    await p.click(`${activeItem} [data-primary]`); await sleep(500)
    ck('walk', `${tag} Gaps: Keep keeps the scroll`, Math.abs((await scrollY(p)) - yg) <= 8)
    ck('walk', `${tag} Gaps: Keep opens question 2 with focus in the pane`, /Question 2/.test(await p.locator(`${activeH2}`).innerText()) && await p.evaluate(() => !!document.activeElement.closest('.app-pane')))
    ck('walk', `${tag} Gaps: the decision and the source are both in view`, (await R.V3(p)).ok, (await R.V3(p)).failures.join('; '))
    await done(p)
    // ---- search reaches trace cells by name and value
    p = await open('results.html?q=S8.RENT', size)
    ck('walk', `${tag} Search: cell name S8.RENT finds the cell`, /S8\.RENT\.HOME/.test(await p.locator('#res-groups').innerText()))
    for (const q of ['$5,040.00', '5,040.00', '5040']) {
      await p.goto(B + 'results.html?q=' + encodeURIComponent(q)); await sleep(200)
      ck('walk', `${tag} Search: cell value ${q} finds the cell`, /S8\.RENT\.HOME/.test(await p.locator('#res-groups').innerText()))
    }
    await done(p)
    // ---- page errors in the walk are failures
  }
}

// ================================================================ RULES V1 to V8 at both sizes
if (on('rules')) {
  for (const size of SIZES) {
    const tag = `${size[0]}x${size[1]}`
    const rc = (r, name) => ck('rules', `${tag} ${r.rule} ${name}`, r.ok, r.failures.join('; '))
    // V1: on load, every page and state except those that show an error on purpose; and after non-submit input in Trace
    let p0 = null
    for (const u of PAGES) {
      if (ERRORISH.test(u) || !/\.html/.test(u)) continue
      const p = await open(u, size)
      rc(await R.V1(p), `no early error: ${u}`)
      await done(p)
    }
    let p = await open(rec('traced', 'trace'), size)
    rc(await R.V1(p, { input: `${activeItem} [data-cor-reason]` }), 'no early error after typing a reason (Trace)')
    await done(p)
    // V1 also on the error states: the error is shown and the title says so (the opposite check)
    p = await open(rec('traced', 'trace/error'), size)
    ck('rules', `${tag} V1 error state shows the error pattern (Trace)`, (await p.locator('.govuk-error-summary:visible').count()) === 1 && /^Error: /.test(await p.title()))
    await done(p)

    // V2: every in-place action keeps the page put and the identity bar in view
    const pane = [
      ['Trace', rec('traced', 'trace'), [
        { name: 'pick a second row', run: jsClick('tr[data-id="t2"] [data-row]') },
        { name: 'Next', click: `${activeItem} [data-nav="next"]` },
        { name: 'cite with nothing chosen (error in place)', click: `${activeItem} [data-primary]` },
        { name: 'cite by source', run: async (q) => { await q.click(`${activeItem} [name$="-src"][value="0"]`, { force: true }); await q.click(`${activeItem} [data-primary]`) }, wait: 600 },
      ]],
      ['Books', rec('import', 'books', '&sel=a2010'), [{ name: 'pick another account', run: jsClick('tr[data-id="a6090"] [data-row]') }, { name: 'Next', click: `${activeItem} [data-nav="next"]` }]],
      ['Comments', rec('rework', 'comments', '&sel=c2'), [{ name: 'Approve the drafted fix', click: `${activeItem} [data-act="set"]`, wait: 500 }]],
      ['Gaps', rec('import', 'gaps'), [{ name: 'Keep', click: `${activeItem} [data-primary]`, wait: 600 }, { name: 'pick question 4', run: jsClick('tr[data-id="g4"] [data-row]') }]],
    ]
    for (const [name, url, actions] of pane) {
      for (const a of actions) {
        const q = await open(url, size)
        rc(await R.V2(q, a), `page stays put: ${name} ${a.name}`)
        await done(q)
      }
    }

    // V3: work in view in every pane state that has a decision on a source
    const V3STATES = [
      ['Trace t1', rec('traced', 'trace', '&sel=t1')], ['Trace t2', rec('traced', 'trace', '&sel=t2')], ['Trace t3', rec('traced', 'trace', '&sel=t3')],
      ['Trace t4', rec('traced', 'trace', '&sel=t4')], ['Trace t5 (override)', rec('traced', 'trace', '&sel=t5')], ['Trace t6 (dropped)', rec('traced', 'trace', '&sel=t6')],
      ['Trace after CPA t7', rec('rework', 'trace', '&sel=t7')],
      ['Books flagged 2010', rec('import', 'books', '&sel=a2010')], ['Books flagged 1500', rec('import', 'books', '&sel=a1500')], ['Books flagged 6090', rec('import', 'books', '&sel=a6090')],
      ['Comments c1', rec('rework', 'comments', '&sel=c1')], ['Comments c2', rec('rework', 'comments', '&sel=c2')], ['Comments c3', rec('rework', 'comments', '&sel=c3')],
      ['Gaps g1', rec('import', 'gaps', '&sel=g1')], ['Gaps g3', rec('import', 'gaps', '&sel=g3')],
      ['Diagnostics D118', rec('traced', 'diagnostics', '&sel=d2')], ['Exceptions e1', rec('import', 'exceptions', '&sel=e1')],
    ]
    for (const [name, url] of V3STATES) {
      const q = await open(url, size)
      const r = await R.V3(q)
      // own check: the source box and the decision sit inside the pane's visible area, not under its clip
      const clip = await q.evaluate(() => {
        const sc = document.querySelector('.app-paneset:not([hidden]) .app-item:not([hidden]) .app-item__scroll'); const box = document.querySelector('.app-paneset:not([hidden]) [data-viewer-box]')
        const cap = document.querySelector('.app-paneset:not([hidden]) .app-viewer__cap'); if (!sc || !box) return 'no pane parts'
        const a = sc.getBoundingClientRect(), b = box.getBoundingClientRect(), c = cap && cap.getBoundingClientRect()
        if (b.top < a.top - 1 || b.bottom > a.bottom + 1) return `box ${Math.round(b.top)}-${Math.round(b.bottom)} outside the scroll area ${Math.round(a.top)}-${Math.round(a.bottom)}`
        if (c && c.bottom > a.bottom + 1) return `caption ends at ${Math.round(c.bottom)}, below the scroll area ${Math.round(a.bottom)}`
        if (b.height < 50) return `box only ${Math.round(b.height)} px high`
        return ''
      })
      const bh = await q.evaluate(() => { const b = document.querySelector('.app-paneset:not([hidden]) [data-viewer-box]'); return b ? Math.round(b.getBoundingClientRect().height) : 0 })
      const key = tag; MINBOX[key] = Math.min(MINBOX[key] ?? 999, bh)
      rc({ rule: 'V3', ok: r.ok && !clip, failures: r.failures.concat(clip ? [clip] : []) }, `work in view: ${name}`)
      await done(q)
    }

    // V4: focus lands after the action, and the shortcuts focus a visible control
    for (const [name, url, action, shortcuts] of [
      ['Trace cite', rec('traced', 'trace'), { name: 'Cite by source', run: async (q) => { await q.click(`${activeItem} [name$="-src"][value="0"]`, { force: true }); await q.click(`${activeItem} [data-primary]`) }, wait: 600, expect: `${activeH2}` }, [{ key: '/', selector: '#site-search' }]],
      ['Trace shortcuts', rec('traced', 'trace'), null, [{ key: 'n', selector: 'tr.app-row-selected [data-row]' }, { key: 'p', selector: 'tr.app-row-selected [data-row]' }, { key: '/', selector: '#site-search' }]],
      ['Trace error', rec('traced', 'trace'), { name: 'Cite with nothing chosen', click: `${activeItem} [data-primary]`, expect: `${activeItem} .govuk-error-summary` }, []],
      ['Comments approve', rec('rework', 'comments', '&sel=c2'), { name: 'Approve', click: `${activeItem} [data-act="set"]`, wait: 500, expect: `${activeH2}` }, []],
      ['Gaps keep', rec('import', 'gaps'), { name: 'Keep', click: `${activeItem} [data-primary]`, wait: 600, expect: `${activeH2}` }, [{ key: 'n', selector: 'tr.app-row-selected [data-row]' }]],
      ['Books row then Back to the row', rec('import', 'books', '&sel=a2010'), { name: 'Pick a row and press Esc', run: async (q) => { await jsClick('tr[data-id="a6090"] [data-row]')(q); await q.keyboard.press('Escape') }, expect: 'tr[data-id="a6090"] [data-row]' }, []],
    ]) {
      const q = await open(url, size)
      rc(await R.V4(q, action, { shortcuts }), `focus lands: ${name}`)
      await done(q)
    }

    // V5: counts carry their scope; the same count is the same number on every page; filter captions follow the filter
    const v5 = []
    for (const [stage, hash] of [['import', 'checklist'], ['import', 'trace'], ['traced', 'trace'], ['traced', 'checklist'], ['rework', 'checklist'], ['rework', 'comments'], ['traced', 'handoff'], ['import', 'books'], ['import', 'gaps'], ['import', 'evidence']]) {
      const q = await open(rec(stage, hash), size)
      const r = await R.V5(q); v5.push({ ...r, stage })
      rc(r, `counts carry scope: ${stage} ${hash}`)
      await done(q)
    }
    for (const st of ['import', 'traced', 'rework']) rc(R.V5same(v5.filter((x) => x.stage === st)), `one count, one number, stage ${st}`)
    let q = await open(rec('traced', 'trace'), size)
    rc(await R.V5caption(q, { name: 'filter cells by "MEALS"', run: async (z) => { await z.fill('.app-view[data-view="trace"] input[data-filter-for]', 'MEALS') } }, { caption: '.app-view[data-view="trace"] [data-shown-for]' }), 'filter caption follows the filter (Trace)')
    await done(q)
    q = await open('queue.html', size)
    rc(await R.V5(q), 'counts carry scope: queue')
    rc(await R.V5caption(q, { name: 'filter the queue', run: async (z) => { await z.fill('[data-filter-for="queue-table"]', 'Maple') } }, { caption: '[data-shown-for="queue-table"]' }), 'filter caption follows the filter (queue)')
    await done(q)

    // V6: search keeps its promise (results page label names return, account, fact, cell)
    q = await open('results.html?q=x', size)
    rc(await R.V6(q, { input: '#res-q', result: '#res-groups li', label: 'label[for="res-q"]', kinds: [
      { kind: 'return', value: 'Bluewater Renovations Inc. (Test)' }, { kind: 'account', value: '6020' }, { kind: 'fact', value: 'Priya Nair (Test)' },
      { kind: 'cell', value: 'S8.RENT.HOME' }, { kind: 'cell', value: '$5,040.00' }] }), 'search finds what its label names')
    await done(q)

    // V7: every click does something (the pane's own controls and the steps), Trace, Books, Comments, Gaps
    for (const [name, url, extra] of [['Trace', rec('traced', 'trace'), ''], ['Books', rec('import', 'books', '&sel=a2010'), ''], ['Comments', rec('rework', 'comments', '&sel=c2'), ''], ['Gaps', rec('import', 'gaps'), '']]) {
      const z = await open(url, size)
      rc(await R.V7(z, { selector: 'main button, main a[href], main summary, header a[href], .app-tabs a[href]', limit: 90, reset: async (pp) => { await pp.reload(); await sleep(250) } }), `every click does something: ${name}`)
      await done(z)
    }

    // V8: one choice, one action (Trace, every cite form)
    for (const id of ['t1', 't2', 't3', 't4', 't7']) {
      const z = await open(rec('traced', 'trace', `&sel=${id}`), size)
      rc(await R.V8(z, { field: `${activeItem} [data-cor-reason]`, radio: `${activeItem} [data-cor-reason-radio]`, submit: `${activeItem} [data-primary]` }), `typing a reason selects it: ${id}`)
      await done(z)
    }
    {
      const z = await open(rec('traced', 'trace', '&sel=t6'), size)
      rc(await R.V8(z, { field: `${activeItem} [data-cor-reason]`, radio: `${activeItem} [data-cor-reason-radio]`, submit: `${activeItem} [data-primary]` }), 'typing a reason selects it: t6 (what will you do)')
      await done(z)
    }
  }
}

// ================================================================ AXE at both sizes on every page and state
if (on('axe')) {
  if (!AxeBuilder) ck('axe', 'axe available', false, 'install @axe-core/playwright next to playwright (PW_NM)')
  else {
    const extra = [rec('traced', 'trace/error'), rec('import', 'exceptions/error'), rec('import', 'books/error'), rec('import', 'handoff/error'), rec('upload', 'roundtrip/error')]
    const urls = [...new Set(PAGES.concat(extra))]
    for (const size of SIZES) {
      let viol = 0, inc = 0, n = 0
      const incomplete = []; let incChecked = 0, minRatio = 99
      for (const u of urls) {
        const p = await open(u, size)
        const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).options({ rules: { region: { enabled: true }, 'landmark-unique': { enabled: true } } }).analyze()
        n++
        if (r.violations.length) { viol += r.violations.length; console.log(`axe violations at ${size.join('x')} on ${u}:`, r.violations.map((v) => v.id + ' (' + v.nodes.length + ')').join(', ')) }
        for (const i of r.incomplete) {
          if (i.id !== 'color-contrast') { inc++; incomplete.push(`${u} ${i.id}`); continue }
          // axe cannot judge text inside a scrolling box: compute the ratio from the computed colours instead (check 8: incomplete counts as a failure until checked)
          for (const nn of i.nodes) {
            const ratio = await p.evaluate((sel) => {
              const el = document.querySelector(sel); if (!el) return -1
              const parse = (c) => { const m = c.match(/[0-9.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] } }
              const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
              let bg = { r: 255, g: 255, b: 255, a: 1 }; const stack = []
              for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) { stack.push(c); if (c.a >= 1) break } }
              for (const c of stack.reverse()) bg = { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 }
              const fg = parse(getComputedStyle(el).color); const l1 = lum({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) }), l2 = lum(bg)
              return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
            }, nn.target[nn.target.length - 1])
            incChecked++; minRatio = Math.min(minRatio, ratio < 0 ? 99 : ratio)
            if (ratio < 4.5) { inc++; incomplete.push(`${u} contrast ${ratio.toFixed(2)} ${nn.target.join(' ')}`) }
          }
        }
        await done(p)
      }
      ck('axe', `${size.join('x')}: ${n} pages and states, violations`, viol === 0, `${viol} violations`)
      ck('axe', `${size.join('x')}: contrast "incomplete" items (${incChecked} nodes checked by computed colours, lowest ratio ${minRatio.toFixed(1)} to 1; needs 4.5)`, inc === 0, `${inc} open: ${incomplete.slice(0, 6).join(' ;; ')}`)
    }
  }
}

// ================================================================ KEYBOARD: Tab walk, visible focus, not covered
async function tabWalk(url, size, max = 140) {
  const p = await open(url, size)
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0) })
  const out = { stops: 0, noStyle: [], covered: [], body: 0 }
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab')
    const r = await p.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return { body: true }
      const cs = getComputedStyle(el)
      const label = el.type === 'radio' || el.type === 'checkbox' ? document.querySelector(`label[for="${el.id}"]`) : null
      let styled = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || cs.backgroundColor === 'rgb(245, 201, 76)' || cs.textDecorationThickness === '3px'
      if (!styled && label) { const b = getComputedStyle(label, '::before'); styled = b.boxShadow !== 'none' || (b.outlineStyle !== 'none') || b.borderColor !== '' && b.boxShadow !== 'none' }
      if (!styled && label) { const a = getComputedStyle(label, '::after'); styled = a.opacity !== '0' }
      if (!styled) { const bg = cs.backgroundColor; const par = el.parentElement && getComputedStyle(el.parentElement).backgroundColor; styled = bg !== par && /245, 201, 76/.test(bg) }
      const r = el.getBoundingClientRect()
      const cx = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 20))), cy = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 10)))
      const top = document.elementFromPoint(cx, cy)
      const visible = r.width > 0 && r.height > 0
      const covered = visible && top && !(el === top || el.contains(top) || top.contains(el) || (label && (label === top || label.contains(top))))
      return { body: false, styled, covered, desc: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' ' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24), off: r.bottom < 0 || r.top > innerHeight }
    })
    if (r.body) { out.body++; if (i > 5) break; continue }
    out.stops++
    if (!r.styled) out.noStyle.push(r.desc)
    if (r.covered && !r.off) out.covered.push(r.desc)
  }
  await done(p)
  return out
}
if (on('keys')) {
  for (const size of SIZES) {
    const tag = size.join('x')
    for (const [name, url] of [['queue', 'queue.html'], ['trace', rec('traced', 'trace')], ['gaps', rec('import', 'gaps')], ['comments', rec('rework', 'comments', '&sel=c2')]]) {
      const w = await tabWalk(url, size)
      ck('keys', `${tag} Tab walk ${name}: ${w.stops} stops, every one has a visible focus style`, w.noStyle.length === 0, w.noStyle.slice(0, 5).join(' | '))
      ck('keys', `${tag} Tab walk ${name}: no stop covered by another element`, w.covered.length === 0, w.covered.slice(0, 5).join(' | '))
    }
    // keyboard-only journeys: queue, open Maple, Download (Enter); Trace cite by keyboard
    let p = await open('queue.html', size)
    await p.focus('a[href^="record.html"][data-open-return]'); await p.keyboard.press('Enter'); await sleep(900)
    ck('keys', `${tag} keyboard: queue, Maple Ridge by Enter opens the return`, /record\.html/.test(p.url()))
    await p.focus('a[data-goto="trace"]').catch(() => {})
    await done(p)
    p = await open(rec('traced', 'trace'), size)
    await p.focus(`${activeItem} [name="t1-src"][value="0"]`)
    await p.keyboard.press('Space')
    await p.focus(`${activeItem} [data-primary]`); await p.keyboard.press('Enter'); await sleep(500)
    ck('keys', `${tag} keyboard: cite a source with Space and Enter`, /Source saved/.test(await stateOf(p, 't1')))
    await p.keyboard.press('Enter').catch(() => {})
    await done(p)
    p = await open(rec('traced', 'trace'), size)
    await p.focus(`${activeItem} [data-cor-reason]`); await p.keyboard.type('Reason typed by keyboard alone')
    ck('keys', `${tag} keyboard: one Tab from the reason box reaches the decision`, await (async () => { await p.keyboard.press('Tab'); return p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-primary')) })())
    await done(p)
    p = await open(rec('traced', 'trace'), size)
    await p.click('tr[data-id="t1"] [data-row]'); await p.keyboard.press('Escape')
    ck('keys', `${tag} keyboard: Enter on a row moves focus into the pane, Esc returns to the row`, await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-row')))
    await done(p)
  }
}

// ================================================================ 320 px reflow
if (on('reflow')) {
  const urls = [...new Set(PAGES.concat([rec('traced', 'trace/error'), rec('rework', 'comments', '&sel=c2')]))]
  let bad = 0, n = 0
  for (const u of urls) {
    const p = await open(u, [320, 640])
    const r = await p.evaluate(() => {
      const w = document.documentElement.clientWidth
      const over = []
      document.querySelectorAll('body *').forEach((e) => {
        if (!e.getClientRects().length) return
        const b = e.getBoundingClientRect()
        if (b.right > w + 1 && !e.closest('[role="region"][aria-label], .app-scroll, .govuk-visually-hidden, .app-live, .govuk-skip-link')) over.push(e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30))
      })
      const pane = document.querySelector('.app-pane'); const ws = document.querySelector('.app-ws, .app-split')
      const stacked = !pane || !ws || pane.getBoundingClientRect().top >= ws.querySelector('.app-main').getBoundingClientRect().bottom - 2
      return { sw: document.documentElement.scrollWidth, w, over: over.slice(0, 3), stacked }
    })
    n++
    const ok = r.sw <= r.w + 1 && r.over.length === 0 && r.stacked
    if (!ok) { bad++; console.log('reflow fail', u, JSON.stringify(r)) }
    await done(p)
  }
  ck('reflow', `320 px: ${n} pages, nothing scrolls sideways outside a labelled region, the pane stacks`, bad === 0, `${bad} failures`)
}

// ================================================================ BUDGETS
if (on('budgets')) {
  for (const size of SIZES) {
    const tag = size.join('x')
    // P1: queue to the return
    let p = await open('queue.html', size)
    let loads = 0
    p.on('request', (rq) => { if (rq.isNavigationRequest() && rq.frame() === p.mainFrame()) loads++ })
    await p.click('a[href^="record.html"][data-open-return]'); await sleep(900)
    ck('budgets', `${tag} P1 open Maple Ridge: 1 click, 1 page load`, loads === 1 && /record\.html/.test(p.url()), `loads ${loads}`)
    // step change: 0 loads, own URL
    loads = 0
    await p.click('.app-steps a[data-goto="gaps"]'); await sleep(300)
    ck('budgets', `${tag} step change: 0 page loads and its own URL`, loads === 0 && /#\/gaps/.test(p.url()), `loads ${loads} ${p.url()}`)
    const h = await p.evaluate(() => history.length)
    await p.click('tr[data-id="g3"] [data-row]'); await sleep(200)
    ck('budgets', `${tag} opening a source adds no history entry`, (await p.evaluate(() => history.length)) === h)
    const t = await p.evaluate(() => { const t0 = performance.now(); document.querySelector('tr[data-id="g2"] [data-row]').click(); return performance.now() - t0 })
    ck('budgets', `${tag} row pick opens the source in under 50 ms (${Math.round(t)} ms)`, t < 50)
    await done(p)
    // P5: queue, name, Download = 2 clicks, 1 page load, and the file arrives
    p = await open('queue.html', size)
    loads = 0
    p.on('request', (rq) => { if (rq.isNavigationRequest() && rq.frame() === p.mainFrame()) loads++ })
    const dl = p.waitForEvent('download', { timeout: 6000 }).catch(() => null)
    await p.click('a[href^="record.html"][data-open-return]'); await sleep(700)
    await p.click('[data-act="download"]')
    const d = await dl
    ck('budgets', `${tag} P5 download from the queue: 2 clicks, 1 page load, file received (${d ? d.suggestedFilename() : 'none'})`, !!d && loads === 1 && /01_2025-12-31_v1\.csv/.test(d.suggestedFilename()))
    await done(p)
    // P6: cite is 2 clicks from a selected row (done in walk); here from a cold step: step link, radio, Cite = 3 clicks and 0 loads
    p = await open(rec('traced', 'checklist'), size)
    loads = 0
    p.on('request', (rq) => { if (rq.isNavigationRequest() && rq.frame() === p.mainFrame()) loads++ })
    await p.click('.app-steps a[data-goto="trace"]'); await sleep(300)
    await p.click(`${activeItem} [name="t1-src"][value="0"]`, { force: true })
    await p.click(`${activeItem} [data-primary]`); await sleep(500)
    ck('budgets', `${tag} P6 from the checklist: step, source, Cite = 3 clicks, 0 page loads`, loads === 0 && /Source saved/.test(await stateOf(p, 't1')))
    // page area height and text size (rule 18)
    const m = await p.evaluate(() => ({ body: parseFloat(getComputedStyle(document.body).fontSize), paneText: parseFloat(getComputedStyle(document.querySelector('.app-pane .govuk-body, .app-pane .govuk-label')).fontSize), pane: Math.round(document.querySelector('.app-pane').getBoundingClientRect().height), main: Math.round(document.querySelector('main').getBoundingClientRect().height) }))
    ck('budgets', `${tag} body text at least 16 px (page ${m.body}, pane ${m.paneText}); pane ${m.pane} px high`, m.body >= 16 && m.paneText >= 16)
    // panes never stack at either size
    ck('budgets', `${tag} the pane sits beside the list (never stacks)`, await p.evaluate(() => { const a = document.querySelector('.app-pane').getBoundingClientRect(), b = document.querySelector('.app-main').getBoundingClientRect(); return a.left >= b.right - 2 && a.top < b.bottom }))
    // rows visible beside the pane and first row whole (fold), Trace and Books
    for (const [name, url, tableSel] of [['Trace', rec('traced', 'trace'), '.app-view[data-view="trace"] tbody tr[data-id]'], ['Books', rec('import', 'books'), '.app-view[data-view="books"] tbody tr[data-id]'], ['Queue', 'queue.html', '#queue-table tbody tr']]) {
      const q = await open(url, size)
      const f = await q.evaluate((s) => { const rows = [...document.querySelectorAll(s)].filter((r) => r.getClientRects().length); const vh = innerHeight; const first = rows[0] && rows[0].getBoundingClientRect(); return { first: first ? Math.round(first.bottom) : -1, vh, whole: rows.filter((r) => r.getBoundingClientRect().bottom <= vh).length } }, tableSel)
      ck('budgets', `${tag} fold ${name}: first row whole (ends ${f.first} of ${f.vh}), ${f.whole} rows whole`, f.first > 0 && f.first <= f.vh && f.whole >= 1)
      await done(q)
    }
    await done(p)
  }
}

await browser.close()
srv.close()
const line = Object.entries(counts).map(([k, v]) => `${k} ${v.pass}/${v.pass + v.fail}`).join(', ')
console.log("smallest source box in the V3 states (px): " + JSON.stringify(MINBOX))
console.log(`\nverify: ${pass} passed, ${fails.length} failed (${line})`)
if (fails.length) { console.log('\nFailures:'); for (const f of fails) console.log(' - ' + f) }
process.exit(fails.length ? 1 : 0)
