// Verify script for Gap review and Round trip (designer 4, D07 and D05). Run:
//   PW_NM=<node_modules folder holding playwright and @axe-core/playwright> node design/prototypes/workbench/gaps-roundtrip-3a/build/verify.mjs [section ...]
// Sections (default all): lint, rules, axe, keys, reflow, budgets. Serves design/ over http (never file://), both versions in turn.
// Prints one line per failing check and a summary; exit code 1 if anything fails. The numbers go into reports/design-workbench-3a.md.
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as R from '../../../../verify/rules.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const FAMILY = path.resolve(here, '..')
const DESIGN = path.resolve(here, '../../../..')
const NM = process.env.PW_NM
const req = NM ? createRequire(NM.replace(/node_modules\/?$/, '') + 'x.js') : createRequire(import.meta.url)
const { chromium } = req('playwright')
let AxeBuilder = null
try { AxeBuilder = req('@axe-core/playwright').AxeBuilder || req('@axe-core/playwright').default } catch (e) { AxeBuilder = null }
const want = new Set(process.argv.slice(2))
const on = (s) => want.size === 0 || want.has(s)
const VERSIONS = ['a-list-detail', 'b-one-column']
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.json': 'application/json' }
const srv = http.createServer((q, r) => {
  const f = path.join(DESIGN, decodeURIComponent(q.url.split('?')[0]))
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('nf') } r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const ROOT = `http://127.0.0.1:${srv.address().port}/prototypes/workbench/gaps-roundtrip-3a/`
const browser = await chromium.launch()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SIZES = R.SIZES

let pass = 0
const fails = []
const counts = {}
const facts = []
function ck(section, name, ok, detail = '') {
  counts[section] = counts[section] || { pass: 0, fail: 0 }
  if (ok) { counts[section].pass++; pass++; if (process.env.VERBOSE) console.log('ok   ' + section + ': ' + name) } else { counts[section].fail++; fails.push(`${section}: ${name} ${detail}`); console.log(`FAIL ${section}: ${name} ${detail}`) }
}
async function open(url, [w, h], opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, ...opts })
  const page = await ctx.newPage()
  page.__errors = []
  page.on('pageerror', (e) => page.__errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.__errors.push(m.text()) })
  await page.goto(url.startsWith('http') ? url : ROOT + url)
  await sleep(300)
  page.__ctx = ctx
  return page
}
const done = async (page) => { if (page.__errors.length) ck('errors', `no script errors on ${page.url().replace(ROOT, '')}`, false, page.__errors.join(' | ')); await page.__ctx.close() }
const scrollY = (p) => p.evaluate(() => scrollY)
const PANE = '[data-qpane]:not([hidden])'

// ---------------------------------------------------------------- page lists (every page and state linked from each version's states page)
const pagesOf = (v) => {
  const t = fs.readFileSync(path.join(FAMILY, v, 'states.html'), 'utf8')
  const own = [...new Set([...t.matchAll(/<a [^>]*href="([^"#:][^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))].filter((u) => /\.html/.test(u) && !u.startsWith('..'))
  return own.map((u) => v + '/' + u).concat([v + '/states.html'])
}
const ERRORISH = /#.*(error|refused|incomplete)/
const ALL = {}
for (const v of VERSIONS) ALL[v] = [...new Set(pagesOf(v))]
const nPages = Object.values(ALL).reduce((a, b) => a + b.length, 0) + 1

// ================================================================ LINT (design card checks 6 and 7, rule 1)
if (on('lint')) {
  const files = []
  for (const v of VERSIONS) {
    for (const f of fs.readdirSync(path.join(FAMILY, v))) files.push(path.join(FAMILY, v, f))
  }
  for (const f of fs.readdirSync(path.join(FAMILY, 'assets'))) files.push(path.join(FAMILY, 'assets', f))
  files.push(path.join(FAMILY, 'index.html'))
  for (const f of fs.readdirSync(path.join(FAMILY, 'build'))) if (/data\.mjs$|build\.mjs$/.test(f)) files.push(path.join(FAMILY, 'build', f))
  const RETIRED = /export 1\b|export 2\b|review-lines export|receipt export|receipt check|gate 1\b|judgment input sheet|AI-proposed GIFI|AI-proposed code|Judgment tab|Judgment: 0/i
  let retired = 0, dash = 0, zoom = 0, cdn = 0, filler = 0, inline = 0
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8')
    if (RETIRED.test(t)) { retired++; console.log('retired term in', path.relative(DESIGN, f)) }
    if (/—/.test(t)) { dash++; console.log('em dash in', path.relative(DESIGN, f)) }
    if (/[^-]zoom\s*:/.test(t) && f.endsWith('.css')) zoom++
    if (/fonts\.googleapis|cdn\.|unpkg|jsdelivr|cdnjs/.test(t) && !f.endsWith('.md')) cdn++
    if (/lorem ipsum|coming soon|placeholder text/i.test(t) || /\bTODO\b/.test(t)) filler++
    if (f.endsWith('.html') && /<[a-z][^>]*\sstyle="/i.test(t)) { inline++; console.log('inline style in', path.relative(DESIGN, f)) }
  }
  ck('lint', `retired terms (check 6) in ${files.length} files`, retired === 0, `${retired} files`)
  ck('lint', 'em dashes', dash === 0, `${dash} files`)
  ck('lint', 'CSS zoom', zoom === 0)
  ck('lint', 'CDN or third-party font', cdn === 0)
  ck('lint', 'placeholder text', filler === 0)
  ck('lint', 'inline style attributes in the pages', inline === 0)
  // classes: only govuk-, moj- and app-; every app- class listed in that version's PARTS.md (or the base part list)
  const base = fs.readFileSync(path.join(DESIGN, 'prototypes', 'workbench', 'b-split-pane', 'PARTS.md'), 'utf8') + fs.readFileSync(path.join(DESIGN, 'parts', 'cite-or-reason', 'README.md'), 'utf8')
  for (const v of VERSIONS) {
    const listed = fs.readFileSync(path.join(FAMILY, v, 'PARTS.md'), 'utf8') + base
    const used = new Set(); const odd = new Set()
    for (const f of fs.readdirSync(path.join(FAMILY, v)).filter((x) => x.endsWith('.html'))) {
      const t = fs.readFileSync(path.join(FAMILY, v, f), 'utf8')
      for (const m of t.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/).filter(Boolean)) { if (c.startsWith('app-')) used.add(c); else if (!/^(govuk-|moj-|js-enabled)/.test(c)) odd.add(c) }
    }
    const js = fs.readFileSync(path.join(FAMILY, 'assets', 'g3.js'), 'utf8')
    for (const m of js.matchAll(/class="([^"$]*)"/g)) for (const c of m[1].split(/\s+/).filter(Boolean)) { if (c.startsWith('app-')) used.add(c); else if (!/^(govuk-|moj-)/.test(c)) odd.add(c) }
    const css = fs.readFileSync(path.join(FAMILY, 'assets', 'g3.css'), 'utf8')
    for (const m of css.matchAll(/\.(app-g3-[a-z0-9_-]+)/g)) used.add(m[1])
    const unlisted = [...used].filter((c) => !listed.includes('`' + c + '`'))
    ck('lint', `${v}: every app- class is listed with a reason (${used.size} classes)`, unlisted.length === 0, unlisted.join(' '))
    ck('lint', `${v}: only govuk-, moj- and app- classes`, odd.size === 0, [...odd].join(' '))
    // links: no empty link, self link or missing file; no duplicate ids in a page
    let bad = 0
    for (const f of fs.readdirSync(path.join(FAMILY, v)).filter((x) => x.endsWith('.html'))) {
      const t = fs.readFileSync(path.join(FAMILY, v, f), 'utf8')
      for (const m of t.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>/g)) {
        const h = m[1]
        if (/govuk-header__homepage-link/.test(m[0])) continue
        if (h === '#' || h === '') { bad++; console.log('empty link in', v, f); continue }
        if (/^(https?:|mailto:|data:)/.test(h) || h.startsWith('#')) continue
        const file = h.split(/[?#]/)[0]
        if (file === f && !h.includes('#') && !h.includes('?')) { bad++; console.log('self link', f, h) }
        if (file && !fs.existsSync(path.join(FAMILY, v, file))) { bad++; console.log('missing', v, f, h) }
      }
      const ids = [...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
      const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
      if (dup.length) { bad++; console.log('duplicate ids in', v, f, [...new Set(dup)].join(' ')) }
    }
    ck('lint', `${v}: no self-link, empty link, missing file or duplicate id (check 7)`, bad === 0, `${bad} findings`)
  }
}

// ================================================================ RULES V1 to V8
const RT_PRIMARY_URLS = ['gfi.before', 'gfi.flagged', 'gfi.refused-header', 'import.ready', 'import.held', 'taxprep.todo', 'upload.form', 'upload.refused-cents', 'upload.refused-pdf', 'diag.paste', 'diag.paste-error', 'diag.gone', 'diag.result', 'cite.todo', 'signoff.blocked', 'signoff.ready']
if (on('rules')) {
  for (const v of VERSIONS) {
    for (const size of SIZES) {
      const tag = `${v} ${size[0]}x${size[1]}`
      const rc = (r, name) => ck('rules', `${tag} ${r.rule} ${name}`, r.ok, r.failures.join('; '))
      // V1 on every page and state; error states must show the pattern instead
      for (const u of ALL[v]) {
        const p = await open(u, size)
        if (ERRORISH.test(u)) {
          const ev = await p.evaluate(() => ({ sum: [...document.querySelectorAll('.govuk-error-summary')].filter((e) => e.getClientRects().length).length, title: document.title, msg: [...document.querySelectorAll('.govuk-error-message')].filter((e) => e.getClientRects().length).length }))
          const refusedUpload = /gfi\.refused|upload\.refused/.test(u)
          ck('rules', `${tag} V1 error state shows the pattern, title starts "Error: ": ${u.split('/').slice(1).join('/')}`, ev.sum >= 1 && /^Error: /.test(ev.title) && (refusedUpload ? ev.msg >= 1 : true), JSON.stringify(ev))
        } else rc(await R.V1(p), `no early error: ${u.split('/').slice(1).join('/')}`)
        await done(p)
      }
      let p = await open(`${v}/record-maple.html#/gaps`, size)
      rc(await R.V1(p, { input: `${PANE} input[data-label]` }), 'no early error after typing a slot value')
      await done(p)

      // V2: every in-place action keeps the page put and the identity bar in view
      const g = `${v}/record-maple.html`
      const acts = [
        [`${g}#/gaps`, { name: 'Keep and next', click: `${PANE} [data-act="keep"]`, wait: 500 }],
        [`${g}#/gaps`, { name: 'Next', click: `${PANE} [data-nav="next"]` }],
        [`${g}#/gaps`, { name: 'type a slot value and Save', run: async (q) => { await q.fill(`${PANE} input[data-label] >> nth=2`, '12 Jan 2026'); await q.click(`${PANE} [data-act="save"]`) }, wait: 500 }],
        [`${g}#/gaps`, { name: 'open Merge', click: `${PANE} [data-act="merge-open"]` }],
        [`${g}#/gaps`, { name: 'Merge into question 2', run: async (q) => { await q.click(`${PANE} [data-act="merge-open"]`); await q.click(`${PANE} [data-targets] button >> nth=0`) }, wait: 500 }],
        [`${g}#/gaps`, { name: 'Drop with a reason', run: async (q) => { await q.click(`${PANE} [data-act="drop-open"]`); await q.keyboard.type('The client will not claim this'); await q.click(`${PANE} [data-act="drop"]`) }, wait: 500 }],
        [`${g}#/gaps`, { name: 'Drop with no reason (error in place)', run: async (q) => { await q.click(`${PANE} [data-act="drop-open"]`); await q.click(`${PANE} [data-act="drop"]`) } }],
        [`${g}#/gaps`, { name: 'Add from the bank', run: async (q) => { await q.click('[data-bank] summary'); await q.click('[data-bank-item] button >> nth=0') }, wait: 500 }],
        [`${g}#/gaps/ready`, { name: 'Sign the gap list', click: '[data-form="sign"] button', wait: 500 }],
        [`${g}#/gaps/ready`, { name: 'Change this answer', click: `${PANE} [data-act="reopen"]` }],
        [`${g}#/roundtrip/upload.form`, { name: 'Upload both files, accepted', run: async (q) => { await q.setInputFiles('[data-scene="form"] input[type=file] >> nth=0', { name: 'lock.csv', mimeType: 'text/csv', buffer: Buffer.from('a') }); await q.setInputFiles('[data-scene="form"] input[type=file] >> nth=1', { name: 'ret.pdf', mimeType: 'application/pdf', buffer: Buffer.from('a') }); await q.click('[data-scene="form"] [data-primary]') }, wait: 500 }],
        [`${g}#/roundtrip/taxprep.todo`, { name: 'Ready pressed', click: '[data-act="ready"]', wait: 500 }],
        [`${g}#/roundtrip/diag.result`, { name: 'open a Warning reason', click: '[data-act="diag-open"][data-kind="warning"] >> nth=0' }],
        [`${g}#/roundtrip/diag.gone`, { name: 'acknowledge one gone diagnostic', click: '[data-act="gone-ack"] >> nth=0' }],
      ]
      for (const [url, a] of acts) {
        const q = await open(url, size)
        rc(await R.V2(q, a), `page stays put: ${a.name}`)
        await done(q)
      }

      // V3: work in view in every pane state that has a decision on a source (and a decision in every inline state)
      const NONSRC = { evidence: '#page-title' }
      for (const [name, hash, opt] of [
        ['Maple q1 (draft)', 'maple#/gaps', {}], ['Maple q3 (empty slots)', 'maple#/gaps/edit', {}], ['Maple partial', 'maple#/gaps/partial', {}], ['Maple edit slots error', 'maple#/gaps/editerror', {}],
        ['Maple merge open', 'maple#/gaps/merge', {}], ['Maple drop open', 'maple#/gaps/drop', {}], ['Maple drop error', 'maple#/gaps/droperror', {}], ['Maple bank open', 'maple#/gaps/bank', {}],
        ['Halton q1 (draft)', 'halton#/gaps', {}], ['Halton partial', 'halton#/gaps/partial', {}],
        ['Maple ready to sign', 'maple#/gaps/ready', { evidence: '#page-title' }], ['Danforth nothing to ask', 'danforth#/gaps', NONSRC], ['Maple signed', 'maple#/gaps/signed', { primary: '#page-title', evidence: '#page-title' }], ['Maple held (read only)', 'maple#/gaps/held', { primary: '[data-evidence]' }],
      ]) {
        const q = await open(`${v}/record-${hash.replace('#', '.html#')}`, size)
        const r = await R.V3(q, opt)
        const clip = opt.evidence ? '' : await q.evaluate(() => {
          const sc = document.querySelector('[data-qpane]:not([hidden]) .app-item__scroll'); const box = document.querySelector('[data-qpane]:not([hidden]) [data-evidence]')
          if (!box) return 'no source box'
          const b = box.getBoundingClientRect()
          if (sc && getComputedStyle(sc).overflowY !== 'visible') { const a = sc.getBoundingClientRect(); if (b.top < a.top - 1 || b.bottom > a.bottom + 1) return `box ${Math.round(b.top)}-${Math.round(b.bottom)} outside its scroll area ${Math.round(a.top)}-${Math.round(a.bottom)}` }
          if (b.height < 60) return `source box only ${Math.round(b.height)} px high`
          return ''
        })
        rc({ rule: 'V3', ok: r.ok && !clip, failures: r.failures.concat(clip ? [clip] : []) }, `work in view: ${name}`)
        await done(q)
      }
      // V3 for Round trip: the deciding control of each step state (or the first control when the step has none) is fully in view, page unscrolled, the open step starts in view
      for (const s of RT_PRIMARY_URLS) {
        const q = await open(`${g}#/roundtrip/${s}`, size)
        const r = await q.evaluate(() => {
          const sc = document.querySelector('[data-body]:not([hidden]) [data-scene]:not([hidden])')
          const vis = (e) => e.getClientRects().length > 0
          let ctl = [...sc.querySelectorAll('[data-primary], [data-act="download"], [data-act="ready"], a.govuk-button')].filter(vis)
          const kind = ctl.length ? 'deciding control' : 'first control'
          if (!ctl.length) ctl = [...sc.querySelectorAll('button, a[href], input, textarea, select')].filter(vis).slice(0, 1)
          const out = []
          if (scrollY > 8) out.push(`page scrolled ${scrollY}`)
          if (!ctl.length) out.push('no control and no primary in the step')
          for (const e of ctl) { const b = e.getBoundingClientRect(); if (b.top < 0 || b.bottom > innerHeight) out.push(`${kind} "${(e.textContent || e.name || '').trim().slice(0, 24)}" at ${Math.round(b.top)}-${Math.round(b.bottom)} of ${innerHeight}`) }
          const o = document.querySelector('[data-body]:not([hidden])').getBoundingClientRect()
          if (!(o.top >= 0 && o.top < innerHeight - 60)) out.push(`open step starts at ${Math.round(o.top)} of ${innerHeight}`)
          return out
        })
        rc({ rule: 'V3', ok: r.length === 0, failures: r }, `deciding control in view: round trip ${s}`)
        await done(q)
      }

      // V4: focus lands after the action, and the shortcuts focus a visible control
      for (const [name, url, action, shortcuts] of [
        ['Keep', `${g}#/gaps`, { name: 'Keep', click: `${PANE} [data-act="keep"]`, wait: 500, expect: `${PANE} [data-pos]` }, [{ key: 'n', selector: `${PANE} [data-pos]` }, { key: 'p', selector: `${PANE} [data-pos]` }, { key: '/', selector: '#site-search' }]],
        ['Merge', `${g}#/gaps`, { name: 'Merge into question 2', run: async (q) => { await q.click(`${PANE} [data-act="merge-open"]`); await q.click(`${PANE} [data-targets] button >> nth=0`) }, wait: 500, expect: `${PANE} [data-pos]` }, []],
        ['Drop', `${g}#/gaps`, { name: 'Drop', run: async (q) => { await q.click(`${PANE} [data-act="drop-open"]`); await q.keyboard.type('Not needed'); await q.click(`${PANE} [data-act="drop"]`) }, wait: 500, expect: `${PANE} [data-pos]` }, []],
        ['Drop error', `${g}#/gaps`, { name: 'Drop with no reason', run: async (q) => { await q.click(`${PANE} [data-act="drop-open"]`); await q.click(`${PANE} [data-act="drop"]`) }, expect: `${PANE} .govuk-error-summary` }, []],
        ['Save error', `${g}#/gaps`, { name: 'Save with every slot empty', run: async (q) => { for (const i of await q.locator(`${PANE} input[data-label]`).all()) await i.fill('x'); for (const i of await q.locator(`${PANE} input[data-label]`).all()) await i.fill(''); await q.click(`${PANE} [data-act="save"]`) }, expect: `${PANE} .govuk-error-summary` }, []],
        ['Add from the bank', `${g}#/gaps`, { name: 'Add', run: async (q) => { await q.click('[data-bank] summary'); await q.click('[data-bank-item] button >> nth=0') }, wait: 500, expect: `${PANE} [data-pos]` }, []],
        ['Sign', `${g}#/gaps/ready`, { name: 'Sign', click: '[data-form="sign"] button', wait: 500, expect: '[data-signed]' }, []],
        ['Sign refused', `${g}#/gaps/ready`, { name: 'Sign with an empty slot', run: async (q) => { await q.evaluate(() => { document.querySelector('[data-qpane="q2"] input[data-label]').value = '' }); await q.click('[data-form="sign"] button') }, expect: '[data-form="sign"] .govuk-error-summary' }, []],
        ['Upload refused', `${g}#/roundtrip/upload.form`, { name: 'Upload with nothing chosen', click: '[data-scene="form"] [data-primary]', expect: '[data-scene="form"] .govuk-error-summary' }, []],
        ['Ready', `${g}#/roundtrip/taxprep.todo`, { name: 'Ready', click: '[data-act="ready"]', wait: 500, expect: '[data-body="upload"] [data-body-title], [data-open-step="upload"]' }, []],
        ['Paste error', `${g}#/roundtrip/diag.paste`, { name: 'Check with nothing pasted', click: '[data-form="diag-paste"] [data-primary]', expect: '[data-form="diag-paste"] .govuk-error-summary' }, []],
      ]) {
        const q = await open(url, size)
        rc(await R.V4(q, action, { shortcuts }), `focus lands: ${name}`)
        await done(q)
      }

      // V5: counts carry their scope; one count, one number
      const v5 = []
      for (const [name, hash] of [['maple gaps', 'maple#/gaps'], ['maple partial', 'maple#/gaps/partial'], ['halton gaps', 'halton#/gaps'], ['danforth gaps', 'danforth#/gaps'], ['maple gfi read', 'maple#/roundtrip/gfi.read'], ['maple gfi flagged', 'maple#/roundtrip/gfi.flagged'], ['maple import held', 'maple#/roundtrip/import.held'], ['maple upload accepted', 'maple#/roundtrip/upload.accepted'], ['maple diag result', 'maple#/roundtrip/diag.result'], ['maple diag gone', 'maple#/roundtrip/diag.gone'], ['maple cite', 'maple#/roundtrip/cite.todo']]) {
        const q = await open(`${v}/record-${hash.replace('#', '.html#')}`, size)
        const r = await R.V5(q); v5.push({ ...r, name })
        rc(r, `counts carry scope: ${name}`)
        await done(q)
      }
      for (const r of v5) rc(R.V5same([r]), `one count, one number on the page: ${r.name}`)
      let q = await open(`${g}#/roundtrip/gfi.read`, size)
      rc(await R.V5caption(q, { name: 'filter code lines by "1000"', run: async (z) => { await z.fill('[data-filter-input] >> nth=0', '1000') } }, { caption: '[data-body]:not([hidden]) [data-scene]:not([hidden]) [data-filter-count]' }), 'filter caption follows the filter (code lines)')
      await done(q)
      q = await open(`${g}#/roundtrip/diag.result`, size)
      rc(await R.V5caption(q, { name: 'filter diagnostics by "Warning"', run: async (z) => { await z.selectOption('[data-body]:not([hidden]) [data-filter-select]', 'Warning') } }, { caption: '[data-body]:not([hidden]) [data-filter-count]' }), 'filter caption follows the filter (diagnostics)')
      await done(q)

      // V7: every click does something (Gap review and the Round trip steps)
      for (const [name, url] of [['Gap review', `${g}#/gaps`], ['Round trip upload step', `${g}#/roundtrip/upload.form`], ['Round trip diagnostics', `${g}#/roundtrip/diag.result`]]) {
        const z = await open(url, size)
        rc(await R.V7(z, { selector: 'main button, main a[href], main summary', limit: 45, reset: async (pp) => { await pp.goto(ROOT + url); await sleep(250) } }), `every click does something: ${name}`)
        await done(z)
      }
    }
  }
  facts.push('V6 (search) and V8 (one choice, one action) do not apply here: the header search is the shared one on the workbench-2 results page, and no field is tied to an option.')
}

// ================================================================ AXE at both sizes on every page and state
if (on('axe')) {
  if (!AxeBuilder) ck('axe', 'axe available', false, 'install @axe-core/playwright next to playwright (PW_NM)')
  else {
    for (const v of VERSIONS) {
      for (const size of SIZES) {
        let viol = 0, inc = 0, n = 0
        const incomplete = []; let incChecked = 0, minRatio = 99
        for (const u of ALL[v]) {
          const p = await open(u, size)
          const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).options({ rules: { region: { enabled: true }, 'landmark-unique': { enabled: true } } }).analyze()
          n++
          if (r.violations.length) { viol += r.violations.length; console.log(`axe violations at ${size.join('x')} on ${u}:`, r.violations.map((x) => x.id + ' (' + x.nodes.length + ')').join(', ')) }
          for (const i of r.incomplete) {
            if (i.id !== 'color-contrast') { inc++; incomplete.push(`${u} ${i.id}`); continue }
            for (const nn of i.nodes) {
              const ratio = await p.evaluate((sel) => {
                const el = document.querySelector(sel); if (!el) return -1
                const parse = (c) => { const m = c.match(/[0-9.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] } }
                const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
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
        ck('axe', `${v} ${size.join('x')}: ${n} pages and states, violations`, viol === 0, `${viol} violations`)
        ck('axe', `${v} ${size.join('x')}: contrast "incomplete" items (${incChecked} nodes checked by computed colours, lowest ratio ${minRatio.toFixed(1)} to 1; needs 4.5)`, inc === 0, `${inc} open: ${incomplete.slice(0, 6).join(' ;; ')}`)
        facts.push(`axe ${v} ${size.join('x')}: ${n} pages and states, ${viol} violations, ${incChecked} contrast nodes checked by computed colours (lowest ${minRatio.toFixed(1)}), ${inc} open`)
      }
    }
  }
}

// ================================================================ KEYBOARD: Tab walk, visible focus, not covered
async function tabWalk(url, size, max = 150) {
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
      if (!styled && label) { const b = getComputedStyle(label, '::before'); styled = b.boxShadow !== 'none' || b.outlineStyle !== 'none' }
      if (!styled && label) { const a = getComputedStyle(label, '::after'); styled = a.opacity !== '0' }
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
  await p.__ctx.close()
  return out
}
if (on('keys')) {
  for (const v of VERSIONS) {
    for (const size of SIZES) {
      const tag = `${v} ${size.join('x')}`
      for (const [name, hash] of [['gaps', 'gaps'], ['gaps merge open', 'gaps/merge'], ['gaps drop error', 'gaps/droperror'], ['gaps ready to sign', 'gaps/ready'], ['upload form', 'roundtrip/upload.form'], ['upload refused', 'roundtrip/upload.refused-cents'], ['diagnostics', 'roundtrip/diag.result']]) {
        const w = await tabWalk(`${v}/record-maple.html#/${hash}`, size)
        ck('keys', `${tag} Tab walk ${name}: ${w.stops} stops, every one has a visible focus style`, w.noStyle.length === 0, w.noStyle.slice(0, 5).join(' | '))
        ck('keys', `${tag} Tab walk ${name}: no stop covered by another element`, w.covered.length === 0, w.covered.slice(0, 5).join(' | '))
        facts.push(`tab walk ${tag} ${name}: ${w.stops} stops`)
      }
      // keyboard-only journeys
      let p = await open(`${v}/record-maple.html#/gaps`, size)
      await p.focus(`${PANE} [data-act="keep"]`); await p.keyboard.press('Enter'); await sleep(400)
      ck('keys', `${tag} keyboard: Keep with Enter moves to question 2`, /Question 2/.test(await p.locator(`${PANE} [data-pos]`).innerText()))
      await p.keyboard.press('r'); await sleep(300)
      ck('keys', `${tag} keyboard: r keeps question 2 (visible Keep control repeated)`, /Question 3/.test(await p.locator(`${PANE} [data-pos]`).innerText()))
      await p.focus('#keys-on').catch(() => {})
      await done(p)
      p = await open(`${v}/record-maple.html#/gaps`, size)
      await p.focus(`${PANE} [data-act="drop-open"]`); await p.keyboard.press('Enter'); await sleep(200)
      await p.keyboard.type('The client will not claim this'); await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await sleep(400)
      ck('keys', `${tag} keyboard: drop with a reason, by keys only`, /Question 2/.test(await p.locator(`${PANE} [data-pos]`).innerText()) && /Dropped/.test(await p.locator('[data-qrow="q1"] [data-state]').first().textContent()))
      await done(p)
      p = await open(`${v}/record-maple.html#/gaps`, size)
      await p.focus('#keys-on').catch(() => {})
      const had = await p.evaluate(() => !!document.querySelector('#keys-on'))
      await p.evaluate(() => { document.querySelector('#keys-on').checked = false })
      await p.evaluate(() => document.activeElement && document.activeElement.blur())
      await p.keyboard.press('r'); await sleep(200)
      ck('keys', `${tag} keyboard: single keys can be turned off (r does nothing then)`, had && /Question 1/.test(await p.locator(`${PANE} [data-pos]`).innerText()))
      await done(p)
    }
  }
}

// ================================================================ 320 px reflow
if (on('reflow')) {
  for (const v of VERSIONS) {
    let bad = 0, n = 0
    for (const u of ALL[v]) {
      const p = await open(u, [320, 640])
      const r = await p.evaluate(() => {
        const w = document.documentElement.clientWidth
        const over = []
        document.querySelectorAll('body *').forEach((e) => {
          if (!e.getClientRects().length) return
          const b = e.getBoundingClientRect()
          if (b.right > w + 1 && !e.closest('[role="region"][aria-label], .app-scroll, .govuk-visually-hidden, .app-live, .govuk-skip-link')) over.push(e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30))
        })
        const pane = document.querySelector('.app-pane, .app-g3-detail')
        const stacked = !pane || !pane.getClientRects().length || pane.getBoundingClientRect().width >= w * 0.8
        return { sw: document.documentElement.scrollWidth, w, over: over.slice(0, 3), stacked }
      })
      n++
      const ok = r.sw <= r.w + 1 && r.over.length === 0 && r.stacked
      if (!ok) { bad++; console.log('reflow fail', u, JSON.stringify(r)) }
      await done(p)
    }
    ck('reflow', `${v} 320 px: ${n} pages, nothing scrolls sideways outside a labelled region, the panes stack`, bad === 0, `${bad} failures`)
    facts.push(`reflow ${v}: ${n} pages at 320 px, ${bad} failures`)
  }
}

// ================================================================ BUDGETS (brief section 2)
if (on('budgets')) {
  const FILE = { name: 'file.csv', mimeType: 'text/csv', buffer: Buffer.from('a') }
  for (const v of VERSIONS) {
    for (const size of SIZES) {
      const tag = `${v} ${size.join('x')}`
      const g = `${v}/record-maple.html`
      const newPage = async (hash) => {
        const p = await open(`${g}#/${hash}`, size)
        p.__loads = 0
        p.on('request', (rq) => { if (rq.isNavigationRequest() && rq.frame() === p.mainFrame()) p.__loads++ })
        return p
      }
      const timed = async (fn) => { const t0 = Date.now(); await fn(); return Date.now() - t0 }
      let p, ms, clicks
      // P2 keep: 1 click, 0 loads
      p = await newPage('gaps'); clicks = 0
      ms = await timed(async () => { await p.click(`${PANE} [data-act="keep"]`); clicks++; await sleep(150) })
      ck('budgets', `${tag} P2 keep: ${clicks} click, 0 page loads, ${ms} ms`, clicks === 1 && p.__loads === 0 && ms < 15000)
      await done(p)
      // edit: 1 field, 2 clicks (field, Save)
      p = await newPage('gaps'); clicks = 0
      ms = await timed(async () => { await p.click(`${PANE} input[data-label] >> nth=2`); clicks++; await p.keyboard.type('12 Jan 2026'); await p.click(`${PANE} [data-act="save"]`); clicks++; await sleep(150) })
      ck('budgets', `${tag} P2 edit slots: ${clicks} clicks, 1 field, 0 page loads, ${ms} ms`, clicks === 2 && p.__loads === 0 && /Question 2/.test(await p.locator(`${PANE} [data-pos]`).innerText()))
      await done(p)
      // merge: 2 clicks
      p = await newPage('gaps'); clicks = 0
      ms = await timed(async () => { await p.click(`${PANE} [data-act="merge-open"]`); clicks++; await p.click(`${PANE} [data-targets] button >> nth=0`); clicks++; await sleep(150) })
      ck('budgets', `${tag} P2 merge: ${clicks} clicks, 0 fields, 0 page loads, ${ms} ms`, clicks === 2 && p.__loads === 0 && /Merged into question/.test(await p.locator('[data-qrow="q1"] [data-state]').first().textContent()))
      await done(p)
      // drop: 2 clicks and 1 field (the box takes focus when Drop opens)
      p = await newPage('gaps'); clicks = 0
      ms = await timed(async () => { await p.click(`${PANE} [data-act="drop-open"]`); clicks++; await p.keyboard.type('Client will not claim this'); await p.click(`${PANE} [data-act="drop"]`); clicks++; await sleep(150) })
      ck('budgets', `${tag} P2 drop with a reason: ${clicks} clicks, 1 field, 0 page loads, ${ms} ms`, clicks === 2 && p.__loads === 0 && /Dropped/.test(await p.locator('[data-qrow="q1"] [data-state]').first().textContent()))
      await done(p)
      // add from the bank: 2 clicks (open the list, choose)
      p = await newPage('gaps'); clicks = 0
      ms = await timed(async () => { await p.click('[data-bank] summary'); clicks++; await p.click('[data-bank-item] button >> nth=0'); clicks++; await sleep(150) })
      ck('budgets', `${tag} P2 add from the bank: ${clicks} clicks, 0 fields, 0 page loads, ${ms} ms`, clicks === 2 && p.__loads === 0 && (await p.locator('[data-qrow]').count()) === 6)
      await done(p)
      // sign: 1 click
      p = await newPage('gaps/ready'); clicks = 0
      ms = await timed(async () => { await p.click('[data-form="sign"] button'); clicks++; await sleep(150) })
      ck('budgets', `${tag} P2 sign: ${clicks} click, 0 page loads, ${ms} ms`, clicks === 1 && p.__loads === 0 && (await p.locator('[data-signed]').isVisible()))
      await done(p)
      // change step: 0 loads, own URL, 1 click
      p = await newPage('gaps'); clicks = 0
      await p.click('.app-steps a[data-goto="roundtrip"]'); clicks++; await sleep(250)
      ck('budgets', `${tag} step change Gap review to Round trip: ${clicks} click, 0 page loads, own URL`, p.__loads === 0 && /#\/roundtrip/.test(p.url()))
      const h0 = await p.evaluate(() => history.length)
      await p.click('.app-steps a[data-goto="gaps"]'); await sleep(200)
      ck('budgets', `${tag} step change back: 0 page loads, history grows by one entry`, p.__loads === 0 && (await p.evaluate(() => history.length)) === h0 + 1)
      await done(p)
      // opening a source adds no history entry (A: row click; B: Next)
      p = await newPage('gaps')
      const h1 = await p.evaluate(() => history.length)
      await p.click(`${PANE} [data-nav="next"]`); await sleep(150)
      ck('budgets', `${tag} opening another source adds no history entry`, (await p.evaluate(() => history.length)) === h1)
      // second window opens by script from the open button
      const pop = p.context().waitForEvent('page', { timeout: 4000 }).catch(() => null)
      await p.check(`${PANE} [data-sw-toggle]`, { force: true }).catch(() => {})
      await p.click(`${PANE} [data-act="open-source"]`)
      const pg = await pop
      ck('budgets', `${tag} Open source opens the second window by script`, !!pg)
      if (pg) {
        await sleep(400)
        await p.click(`${PANE} [data-nav="next"]`); await sleep(500)
        ck('budgets', `${tag} the second window follows the selection`, /Question 3/.test(await pg.locator('body').innerText()), (await pg.locator('body').innerText()).slice(0, 80))
        await pg.close()
      }
      await done(p)
      // P3 upload the .GFI: 2 clicks, 1 file, result in view
      p = await newPage('roundtrip/gfi.before'); clicks = 0
      await p.setInputFiles('[data-scene="before"] input[type=file]', FILE); clicks++
      await p.click('[data-scene="before"] [data-primary]'); clicks++; await sleep(300)
      const gv = await p.evaluate(() => { const c = document.querySelector('[data-count="gfi-lines"]'); if (!c || !c.getClientRects().length) return 'result count not visible'; const b = c.getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0 ? '' : `result at ${Math.round(b.top)}-${Math.round(b.bottom)} of ${innerHeight}` })
      ck('budgets', `${tag} P3 upload the .GFI: ${clicks} clicks, 1 file, result in view${gv ? ' (' + gv + ')' : ''}`, clicks === 2 && !gv && p.__loads === 0)
      await done(p)
      // P5 download: 1 click then the focus moves
      p = await newPage('roundtrip/import.ready')
      const dl = p.waitForEvent('download', { timeout: 4000 }).catch(() => null)
      await p.click('[data-act="download"]'); const d = await dl
      ck('budgets', `${tag} P5 start the import-file download: 1 click, 0 page loads, file received (${d ? d.suggestedFilename() : 'none'})`, !!d && p.__loads === 0 && /\.csv$/i.test(d ? d.suggestedFilename() : ''))
      await done(p)
      // P5 press Ready: 1 click, focus on the Upload step, announced
      p = await newPage('roundtrip/taxprep.todo')
      await p.click('[data-act="ready"]'); await sleep(300)
      const rf = await p.evaluate(() => ({ f: document.activeElement && (document.activeElement.textContent || '').trim().slice(0, 30), live: [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent).join(' ') }))
      ck('budgets', `${tag} P5 press Ready: 1 click, focus on the Upload step, announced`, /Upload/.test(rf.f) && /Ready pressed/.test(rf.live), JSON.stringify(rf))
      await done(p)
      // P5 upload lock export and printed return, read a refusal: 3 clicks, refusal and fix in view without page scroll
      p = await newPage('roundtrip/upload.form'); clicks = 0
      await p.selectOption('[data-scene="form"] [data-proto]', 'refused-cents'); // prototype-only choice of what the file gives
      await p.setInputFiles('[data-scene="form"] input[type=file] >> nth=0', FILE); clicks++
      await p.setInputFiles('[data-scene="form"] input[type=file] >> nth=1', { name: 'r.pdf', mimeType: 'application/pdf', buffer: Buffer.from('a') }); clicks++
      await p.click('[data-scene="form"] [data-primary]'); clicks++; await sleep(300)
      const rv = await p.evaluate(() => {
        const sc = document.querySelector('[data-body="upload"] [data-scene="refused-cents"]'); if (!sc) return 'no refused scene'
        const sum = sc.querySelector('.govuk-error-summary'); const fix = [...sc.querySelectorAll('strong')].find((s) => /What to do/.test(s.textContent))
        const out = []
        for (const [n, e] of [['summary', sum], ['fix', fix && fix.parentElement]]) { if (!e) { out.push(n + ' missing'); continue } const b = e.getBoundingClientRect(); if (b.top < 0 || b.bottom > innerHeight) out.push(`${n} ${Math.round(b.top)}-${Math.round(b.bottom)} of ${innerHeight}`) }
        return out.join('; ')
      })
      ck('budgets', `${tag} P5 upload both files and read a refusal: ${clicks} clicks, summary and fix in view, page scroll ${await scrollY(p)}${rv ? ' (' + rv + ')' : ''}`, clicks === 3 && !rv && (await scrollY(p)) <= 8)
      await done(p)
      // P7 paste diagnostics: 3 clicks, 2 fields
      p = await newPage('roundtrip/diag.paste'); clicks = 0
      await p.click('[data-form="diag-paste"] textarea'); clicks++; await p.keyboard.type('pasted list (made up)')
      await p.click('[data-form="diag-paste"] input[name="count"]'); clicks++; await p.keyboard.type('23')
      await p.click('[data-form="diag-paste"] [data-primary]'); clicks++; await sleep(300)
      ck('budgets', `${tag} P7 paste the diagnostics list: ${clicks} clicks, 2 fields, result shown`, clicks === 3 && /23/.test(await p.locator('[data-count="diag-open"]').first().innerText().catch(() => '')) || (await p.locator('[data-body="diag"] [data-scene="result"]').isVisible()))
      await done(p)
      // P7 acknowledge a gone diagnostic: 1 click
      p = await newPage('roundtrip/diag.gone')
      const before = await p.locator('[data-count="gone-n"]').first().innerText()
      await p.click('[data-act="gone-ack"] >> nth=0'); await sleep(200)
      ck('budgets', `${tag} P7 acknowledge one "gone since the earlier paste": 1 click ("${before}" then "${await p.locator('[data-count="gone-n"]').first().innerText()}")`, before !== (await p.locator('[data-count="gone-n"]').first().innerText()))
      await done(p)
      // P7 give a Warning its reason: 2 clicks, 1 field
      p = await newPage('roundtrip/diag.result'); clicks = 0
      await p.click('[data-act="diag-open"][data-kind="warning"] >> nth=0'); clicks++
      await p.keyboard.type('The client confirmed this on 12 Jan 2026.')
      await p.click('[data-act="diag-reason"]'); clicks++; await sleep(300)
      ck('budgets', `${tag} P7 give a Warning its reason: ${clicks} clicks, 1 field, 0 page loads`, clicks === 2 && p.__loads === 0 && /Reason given by/.test(await p.locator('[data-diag-state]').first().innerText().catch(() => '')) || (await p.locator('[data-body="diag"] [data-diag-state]:has-text("Reason given")').count()) === 1)
      await done(p)
      // body text size and fold (rule 18)
      p = await open(`${g}#/gaps`, size)
      const m = await p.evaluate(() => ({ body: parseFloat(getComputedStyle(document.body).fontSize), pane: document.querySelector('.app-pane') ? parseFloat(getComputedStyle(document.querySelector('.app-pane .govuk-body, .app-pane .govuk-label')).fontSize) : 16, vh: innerHeight, main: Math.round(document.querySelector('main').getBoundingClientRect().height), src: (() => { const e = document.querySelector('[data-qpane]:not([hidden]) [data-evidence] td, [data-qpane]:not([hidden]) [data-evidence] th'); return e ? parseFloat(getComputedStyle(e).fontSize) : 0 })() }))
      ck('budgets', `${tag} body text at least 16 px (page ${m.body}, pane ${m.pane}), source text at least 12 px (${m.src})`, m.body >= 16 && m.pane >= 16 && m.src >= 12)
      facts.push(`budget ${tag}: body ${m.body} px, source text ${m.src} px, page ${m.main} px high (window ${m.vh})`)
      if (v.startsWith('a')) {
        ck('budgets', `${tag} the pane sits beside the list (never stacks)`, await p.evaluate(() => { const a = document.querySelector('.app-pane').getBoundingClientRect(), b = document.querySelector('.app-g3-list').getBoundingClientRect(); return a.left >= b.right - 2 && a.top < b.bottom }))
        const rows = await p.evaluate(() => [...document.querySelectorAll('[data-qrow]')].filter((r) => r.getClientRects().length && r.getBoundingClientRect().bottom <= innerHeight).length)
        facts.push(`rows whole beside the pane ${tag}: ${rows} of 5 questions`)
        ck('budgets', `${tag} at least 3 questions whole beside the pane (${rows})`, rows >= 3)
      }
      await done(p)
    }
  }
}

await browser.close()
srv.close()
const line = Object.entries(counts).map(([k, v]) => `${k} ${v.pass}/${v.pass + v.fail}`).join(', ')
for (const f of facts) console.log('fact: ' + f)
console.log(`\npages and states served: ${nPages}`)
console.log(`verify: ${pass} passed, ${fails.length} failed (${line})`)
if (fails.length) { console.log('\nFailures:'); for (const f of fails) console.log(' - ' + f) }
process.exit(fails.length ? 1 : 0)
