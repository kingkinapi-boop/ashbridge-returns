// The shared rule checks V1 to V8 (design/verify/rules.mjs) on every state of the viewer at both budget sizes, and the page-level
// checks of design check 7 that the shared rules do not reach: the rendered DOM (classes, inline styles, controls, tables, headings,
// titles, the return shell), counts that agree with the rows they describe, one figure one string, and every link of the landing page.
import * as R from '../../../../verify/rules.mjs'
import { sleep, SIZES } from './verify-lib.mjs'
import { urlOf } from './verify-act.mjs'
import { BOXES } from './verify-keys.mjs'
import { lists, sources } from './data.mjs'

export const sections = {}
const ERR = '.govuk-error-summary'
const OPEN = '[data-item] [data-open]'
const REASON = 'Overridden by the preparer: the second monitor is claimed as class 50 instead. Anita Rao decided.'
const WHY = 'The client confirmed the terms in writing, so I accept the risk and keep the flag for the filing note.'
const RET = 'Maple Ridge Consulting Inc. (Test)'

// ---------------------------------------------------------------- bookkeeping for the shared rule results
function rk(T, name, r) {
  const rule = r.rule === 'multi' ? 'V?' : r.rule
  const tally = (T.out.sharedTally = T.out.sharedTally || {})
  const x = (tally[rule] = tally[rule] || { pass: 0, fail: 0 })
  r.ok ? x.pass++ : x.fail++
  T.out.shared.push({ name, rule, ok: r.ok, failures: r.failures.slice(0, 3) })
  T.ck(`${rule}: ${name}`, r.ok, r.failures.join('; '))
}

// ---------------------------------------------------------------- the rendered DOM, after the scripts have run
export const domChecks = () => {
  const out = { badClass: {}, badInline: [], plain: [], btn: [], tab: [], tables: [], filler: [], dupIds: [], digits: [], h1: 0, mains: 0, skip: false, header: false, lang: '', title: document.title, bar: '', tabs: [], current: 0, bgUrls: [] }
  const okClass = (c) => /^(govuk-|moj-|app-)/.test(c) || c === 'js-enabled' || c === 'govuk-frontend-supported'
  const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
  const ids = {}
  const bg = new Set()
  const all = [...document.body.querySelectorAll('*'), document.body]
  for (const e of all) {
    const tag = e.tagName.toLowerCase()
    if (/^(script|style|noscript)$/.test(tag) || e.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue
    const cl = e.getAttribute('class')
    if (cl) cl.split(/\s+/).filter(Boolean).forEach((c) => { if (!okClass(c)) out.badClass[c] = (out.badClass[c] || 0) + 1 })
    const st = e.getAttribute('style')
    if (st) {
      const props = st.split(';').map((s) => s.split(':')[0].trim()).filter(Boolean)
      const allowed = e.classList.contains('app-box') ? ['left', 'top', 'width', 'height'] : e.classList.contains('app-page') ? ['width'] : e.id === 'app-split' ? ['--app-pane-w'] : []
      const extra = props.filter((p) => !allowed.includes(p))
      if (extra.length) out.badInline.push(`${tag}${e.id ? '#' + e.id : ''} ${extra.join(',')}`)
    }
    if (e.id) ids[e.id] = (ids[e.id] || 0) + 1
    if (vis(e)) { const b = getComputedStyle(e).backgroundImage; if (b && b !== 'none') for (const m of b.matchAll(/url\("?([^")]+)"?\)/g)) bg.add(m[1].replace(location.origin, '')) }
    const control = /^(a|button|input|select|textarea|summary|label)$/.test(tag)
    if (e.hasAttribute('onclick') || e.hasAttribute('onkeydown')) out.plain.push(`${tag} with an inline handler`)
    if (tag === 'a' && !e.hasAttribute('href')) out.plain.push(`a without href: ${(e.textContent || '').trim().slice(0, 20)}`)
    if (e.matches('[data-open], [data-undo], [data-primary], [data-route], [data-fig-nav], [data-flag-nav]') && !/^(a|button)$/.test(tag)) out.plain.push(`${tag} carries a control hook`)
    if (!control && e.getAttribute('role') === 'button') out.plain.push(`${tag} with role button`)
    if (vis(e) && !e.closest('a[href], button, summary, label, select, input, textarea, [role=separator]') && getComputedStyle(e).cursor === 'pointer') out.plain.push(`${tag}${e.id ? '#' + e.id : ''} shows a pointer but is not a control`)
    if (e.classList.contains('govuk-button') && !/^(a|button|input)$/.test(tag)) out.btn.push(tag)
    if (e.getAttribute('tabindex') === '0' && !control && e.getAttribute('role') !== 'separator' && !(e.getAttribute('role') === 'region' && e.getAttribute('aria-label')) && !(tag === 'section' && e.getAttribute('aria-label'))) out.tab.push(`${tag}${e.id ? '#' + e.id : ''} takes focus and is not a control or a labelled region`)
  }
  out.dupIds = Object.keys(ids).filter((k) => ids[k] > 1)
  out.bgUrls = [...bg]
  document.querySelectorAll('table').forEach((t) => {
    if (!vis(t)) return
    const cap = t.querySelector('caption')
    if (!cap || !cap.textContent.trim()) out.tables.push('a table has no caption')
    t.querySelectorAll('th').forEach((th) => { if (!th.getAttribute('scope')) out.tables.push('th without scope: ' + th.textContent.trim().slice(0, 20)) })
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim())
    t.querySelectorAll('tbody tr').forEach((tr) => {
      if (!vis(tr)) return
      ;[...tr.children].forEach((cell, i) => {
        if (cell.tagName !== 'TD') return
        const txt = cell.textContent.replace(/\s+/g, ' ').trim()
        if (/^(-|–|—|n\/a|tbd|\.{2,}|\?+|null|undefined|nan)$/i.test(txt)) out.filler.push(`"${txt}" in ${heads[i] || 'column ' + (i + 1)}`)
        if (/amount|now|approved|withdrawals|deposits|balance|debit|credit/i.test(heads[i] || '') && !cell.classList.contains('govuk-table__cell--numeric') && !cell.classList.contains('app-num')) out.tables.push(`money cell not numeric: "${txt.slice(0, 16)}" under ${heads[i]}`)
      })
    })
  })
  const text = document.body.innerText || ''
  if (/\b\d{9}\b|\b\d{3}[ -]\d{3}[ -]\d{3}\b/.test(text)) out.digits.push('nine digits in a row, SIN-like')
  if (/lorem ipsum|coming soon|\bTBD\b|\bplaceholder\b/i.test(text)) out.filler.push('filler words in the page text')
  out.h1 = [...document.querySelectorAll('h1')].filter(vis).length
  out.mains = document.querySelectorAll('main').length
  const first = document.querySelector('a[href]')
  out.skip = !!first && first.classList.contains('govuk-skip-link') && first.getAttribute('href') === '#main' && !!document.getElementById('main')
  const gh = document.querySelector('.govuk-generic-header')
  out.header = !!gh && !!gh.querySelector('.govuk-generic-header__logo svg') && /Ashbridge Tax/.test(gh.textContent)
  out.lang = document.documentElement.lang
  const bar = document.querySelector('[data-identity-bar]')
  out.bar = bar ? bar.textContent.replace(/\s+/g, ' ').trim() : ''
  const nav = document.querySelector('.moj-sub-navigation[aria-label="Return record"]')
  out.tabs = nav ? [...nav.querySelectorAll('a')].map((a) => a.textContent.trim()) : []
  out.current = nav ? nav.querySelectorAll('[aria-current="page"]').length : 0
  return out
}

// one report of the rendered DOM of one page state: four lines in the results, each with its own name
export async function domReport(T, page, label, o = {}) {
  const d = await page.evaluate(domChecks)
  const { ck } = T
  ck(`DOM ${label}: only govuk-, moj- and app- classes, and no inline style but the box position, the page width and the pane width`, !Object.keys(d.badClass).length && !d.badInline.length, JSON.stringify({ classes: d.badClass, inline: d.badInline.slice(0, 4) }))
  ck(`DOM ${label}: no control drawn as plain text, no pointer on a non-control, no govuk-button on a non-button, no focus stop on plain text`, !d.plain.length && !d.btn.length && !d.tab.length, JSON.stringify({ plain: d.plain.slice(0, 4), btn: d.btn.slice(0, 3), tab: d.tab.slice(0, 3) }))
  ck(`DOM ${label}: every table has a caption and scoped headers, money sits in numeric cells, no filler in a data column, no digits in a row that look like a SIN`, !d.tables.length && !d.filler.length && !d.digits.length, JSON.stringify({ tables: d.tables.slice(0, 4), filler: d.filler.slice(0, 4), digits: d.digits }))
  const missing = await page.evaluate(async (urls) => { const bad = []; for (const u of urls) { const r = await fetch(u).catch(() => null); if (!r || !r.ok) bad.push(u) } return bad }, d.bgUrls)
  ck(`DOM ${label}: no GOV.UK crest, crown or logotype is drawn, and every background image that is drawn exists`, !d.bgUrls.some((u) => /crest|crown|logotype|govuk-logo/i.test(u)) && !missing.length, JSON.stringify({ drawn: d.bgUrls.slice(0, 4), missing }))
  const shellOk = !o.shell || (d.bar.includes(`${RET}, year end 31 Dec 2025`) && (!o.tabs || (d.tabs.join(',') === 'Workbench,Review,Documents,Exceptions,Ops' && d.current === 1)))
  const titleOk = (o.title ? o.title.test(d.title) : / - Ashbridge Tax$/.test(d.title)) && (!o.shell || d.title.includes(`${RET}, year end 31 Dec 2025`))
  ck(`DOM ${label}: one h1, one main, skip link first, Generic header with the logo, no duplicate ids${o.shell ? ', the return shell (identity bar, five record tabs, one current)' : ''}, a title that names the page`, d.h1 === 1 && d.mains === 1 && d.skip && d.header && !d.dupIds.length && d.lang === 'en' && shellOk && titleOk, JSON.stringify({ h1: d.h1, mains: d.mains, skip: d.skip, header: d.header, dup: d.dupIds, lang: d.lang, bar: d.bar.slice(0, 60), tabs: d.tabs, current: d.current, title: d.title.slice(0, 80) }))
  return d
}

// ---------------------------------------------------------------- the states: V5 counts, V3 in view, V1 no early error
const STATES = [
  ['Review, nothing chosen yet (empty pane)', 'review.html?as=dev', { v3: false }],
  ['Review, six sources of six kinds (f1)', urlOf('cpa', 'f1', '1')],
  ['Review, an adjusting entry (f1, source 2)', urlOf('cpa', 'f1', '2')],
  ['Review, the entry\'s own bank sheet row (f1, 2.1)', urlOf('cpa', 'f1', '2.1')],
  ['Review, QBO line with an id (f1, source 3)', urlOf('cpa', 'f1', '3')],
  ['Review, bank page with the box (f1, source 4)', urlOf('cpa', 'f1', '4')],
  ['Review, client answer (f1, source 5)', urlOf('cpa', 'f1', '5')],
  ['Review, written reason (f1, source 6)', urlOf('cpa', 'f1', '6')],
  ['Review, QBO line without an id (f3)', urlOf('cpa', 'f3', '1')],
  ['Review, flagged, its evidence first (f4)', urlOf('cpa', 'f4', '1')],
  ['Review, masked slip (f5)', urlOf('cpa', 'f5', '1')],
  ['Review, empty: not checked, no evidence (f7)', urlOf('cpa', 'f7'), { primary: '[data-evidence]' }],
  ['Review, the page image fails (f8)', urlOf('cpa', 'f8', '1'), { primary: '[data-evidence]', v1: false }],
  ['Review, CRA capture with its pull date (f9)', urlOf('cpa', 'f9', '1')],
  ['Review, last year (f2, source 3)', urlOf('cpa', 'f2', '3')],
  ['Workbench, candidates, none chosen (c2)', urlOf('prep', 'c2')],
  ['Workbench, override with a reason only (c5)', urlOf('prep', 'c5')],
  ['Workbench, dropped cell (c6)', urlOf('prep', 'c6')],
  ['Workbench, cited figure (c7)', urlOf('prep', 'c7', '1'), { primary: '[data-evidence]' }],
  ['Documents, an extracted value (v1)', urlOf('verify', 'v1')],
  ['Exceptions, as the CPA (x2)', urlOf('risks', 'x2')],
  ['Exceptions, as the preparer, read only (x2)', 'exceptions.html?as=anita&item=x2', { primary: '[data-evidence]' }],
  ['Ops, complete or chase (o1)', urlOf('ops', 'o1')],
  ['Ops, nothing attached (o5)', urlOf('ops', 'o5')],
  ['Ops, done rows with Undo (state done, o2)', 'ops.html?state=done&as=sam&item=o2', { primary: '[data-evidence]', seeded: true }],
  ['Documents, done rows (state done, v1)', 'documents.html?state=done&as=anita&item=v1', { primary: '[data-evidence]', seeded: true }],
  ['Exceptions, done rows (state done, x1)', 'exceptions.html?state=done&as=dev&item=x1', { primary: '[data-evidence]', seeded: true }],
  ['Void, the books changed after approval (g2)', urlOf('changed', 'g2'), { primary: '[data-evidence]' }],
]
const PLAIN = [
  ['Landing page', 'index.html'], ['Second window, nothing selected yet', 'window.html'], ['Search, nothing searched', 'search.html'],
  ['Search, results', 'search.html?q=meals'], ['Search, no result', 'search.html?q=zzzz'], ['Signed out', 'signed-out.html'],
]

sections.states = async (T) => {
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    const counts = []
    for (const [label, url, o = {}] of STATES) {
      const [c, page] = await T.newPage(w, h)
      await T.go(page, url, 450)
      const v5 = await R.V5(page)
      if (!o.seeded) counts.push(v5)
      rk(T, `${label} ${tag}: every count names its scope`, v5)
      if (o.v3 !== false) rk(T, `${label} ${tag}: the evidence and the decision are in view, no scroll`, await R.V3(page, { primary: o.primary || '[data-primary]' }))
      if (o.v1 !== false) rk(T, `${label} ${tag}: no error before a submit, on load or after typing`, await R.V1(page))
      await c.close()
    }
    for (const [label, url] of PLAIN) {
      const [c, page] = await T.newPage(w, h)
      await T.go(page, url, 350)
      const v5 = await R.V5(page)
      counts.push(v5)
      rk(T, `${label} ${tag}: every count names its scope`, v5)
      rk(T, `${label} ${tag}: no error before a submit`, await R.V1(page))
      await c.close()
    }
    rk(T, `${tag}: a count with one name and one scope has one number on every page`, R.V5same(counts))
  }
}

// ---------------------------------------------------------------- the second window (a full page), shared rules on the popup
sections.popup = async (T) => {
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    const ctx = await T.newCtx(w, h)
    const page = await ctx.newPage()
    await T.go(page, urlOf('cpa', 'f1', '1'), 450)
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#sv-open-window')])
    await pop.waitForLoadState('domcontentloaded')
    await sleep(900)
    rk(T, `Second window as a full page ${tag}: no error before a submit`, await R.V1(pop))
    rk(T, `Second window as a full page ${tag}: the evidence is in view with no scroll`, await R.V3(pop, { primary: '[data-evidence]' }))
    rk(T, `Second window as a full page ${tag}: every count names its scope`, await R.V5(pop))
    rk(T, `Second window as a full page ${tag}: ] and [ move to a source and focus lands in its box`, await R.V4(pop, null, { shortcuts: [{ key: ']', selector: BOXES }, { key: '[', selector: BOXES }] }))
    await domReport(T, pop, `second window ${tag}`, { shell: true, title: /^Source window[:,] / })
    await ctx.close()
  }
}

// ---------------------------------------------------------------- the actions: V2 the page stays, V4 focus lands
const ACTIONS = [
  ['Review, key m (next number)', urlOf('cpa', 'f1', '1'), { name: 'm', press: 'm', wait: 300 }, { expect: BOXES, keys: true }],
  ['Review, Supports, next source', urlOf('cpa', 'f1', '1'), { name: 'Supports, next source', click: '.app-viewer__foot--tick button[data-primary]', wait: 300 }, { expect: BOXES }],
  ['Review, a step button of the sources', urlOf('cpa', 'f1', '1'), { name: 'step 3', run: async (p) => { await p.locator('.app-viewer__steps button').nth(1).click() }, wait: 400 }, { expect: BOXES }],
  ['Review, zoom in on a page image', urlOf('cpa', 'f1', '4'), { name: 'Zoom in', run: async (p) => { await p.getByRole('button', { name: 'Zoom in' }).click() }, wait: 300 }, { expect: '.app-viewer__zoom button' }],
  ['Review, the filter', urlOf('cpa'), { name: 'filter', run: async (p) => { await p.fill('#sv-filter', 'meals') }, wait: 250 }, { expect: '#sv-filter' }],
  ['Review, a record tab (client route)', urlOf('cpa'), { name: 'Documents tab', click: '.moj-sub-navigation a[data-route="documents"]', wait: 300 }, { expect: '.moj-sub-navigation a[data-route="documents"]' }],
  ['Review, a record tab then Back', urlOf('cpa'), { name: 'Documents tab, then Back', run: async (p) => { await p.click('.moj-sub-navigation a[data-route="documents"]'); await sleep(250); await p.goBack() }, wait: 400 }, { expect: '.moj-sub-navigation a' }],
  ['Review, the splitter by arrow key', urlOf('cpa', 'f1', '1'), { name: 'splitter', run: async (p) => { await p.focus('#app-splitter'); await p.keyboard.press('ArrowLeft') }, wait: 300 }, { expect: '#app-splitter' }],
  ['Review, open the second window', urlOf('cpa', 'f1', '1'), { name: 'Open in a second window', click: '#sv-open-window', wait: 500 }, { expect: '#sv-open-window' }],
  ['Workbench, Cite a candidate', urlOf('prep', 'c2'), { name: 'Cite', run: async (p) => { await p.click('#sv-src-0'); await p.click('button[data-primary]') }, wait: 450 }, { expect: BOXES }],
  ['Workbench, Record with nothing chosen (error)', urlOf('prep', 'c2'), { name: 'Record with nothing chosen', click: 'button[data-primary]', wait: 300 }, { expect: ERR, error: true }],
  ['Workbench, a reason for an override', urlOf('prep', 'c5'), { name: 'Record a reason', run: async (p) => { await p.click('#sv-reason'); await p.fill('#sv-reason', REASON); await p.click('button[data-primary]') }, wait: 450 }, { expect: BOXES }],
  ['Workbench, Record with no reason (error)', urlOf('prep', 'c5'), { name: 'Record with no reason', click: 'button[data-primary]', wait: 300 }, { expect: ERR, error: true }],
  ['Documents, Accept', urlOf('verify', 'v1'), { name: 'Accept', click: 'button[data-primary]', wait: 300 }, { expect: BOXES }],
  ['Documents, Reject', urlOf('verify', 'v1'), { name: 'Reject', run: async (p) => { await p.getByRole('button', { name: /^Reject/ }).click() }, wait: 300 }, { expect: BOXES }],
  ['Exceptions, Accept the risk with no reason (error)', urlOf('risks', 'x2'), { name: 'Accept the risk, no reason', click: '.app-viewer__foot button[data-primary]', wait: 300 }, { expect: ERR, error: true }],
  ['Exceptions, Accept the risk', urlOf('risks', 'x2'), { name: 'Accept the risk', run: async (p) => { await p.click('#sv-judge-why'); await p.fill('#sv-judge-why', WHY); await p.click('.app-viewer__foot button[data-primary]') }, wait: 350 }, { expect: BOXES }],
  ['Exceptions, Comment, do not accept', urlOf('risks', 'x2'), { name: 'Comment', run: async (p) => { await p.fill('#sv-judge-why', WHY); await p.getByRole('button', { name: /^Comment, do not accept/ }).click() }, wait: 350 }, { expect: BOXES }],
  ['Ops, Complete', urlOf('ops', 'o1'), { name: 'Complete', click: 'button[data-primary]', wait: 300 }, { expect: OPEN }],
  ['Ops, Chase with nothing attached', urlOf('ops', 'o5'), { name: 'Chase', click: 'button[data-primary]', wait: 300 }, { expect: OPEN }],
  ['Ops, Undo opens its reason box', 'ops.html?state=done&as=sam', { name: 'Undo', click: '[data-item="o2"] [data-undo]', wait: 250 }, { expect: '#undo-row-o2-why' }],
  ['Ops, Undo with no reason (error)', 'ops.html?state=done&as=sam', { name: 'Undo, no reason', run: async (p) => { await p.click('[data-item="o2"] [data-undo]'); await p.click('#undo-row-o2 button[type=submit]') }, wait: 300 }, { expect: '.app-undo-sum', error: true }],
  ['Ops, Undo with a reason', 'ops.html?state=done&as=sam', { name: 'Undo with a reason', run: async (p) => { await p.click('[data-item="o2"] [data-undo]'); await p.fill('#undo-row-o2-why', 'Wrong statement month, checked again.'); await p.click('#undo-row-o2 button[type=submit]') }, wait: 350 }, { expect: '[data-item="o2"] [data-open]' }],
]
const KEYS_AFTER_M = [{ key: ']', selector: BOXES }, { key: '[', selector: BOXES }, { key: 'm', selector: BOXES }, { key: 'n', selector: BOXES }, { key: 'p', selector: BOXES }, { key: 'o', selector: BOXES }]

sections.actions = async (T) => {
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    for (const [label, url, action, o] of ACTIONS) {
      let [c, page] = await T.newPage(w, h)
      await T.go(page, url, 450)
      rk(T, `${label} ${tag}: the page stays put and the identity bar stays in view`, await R.V2(page, action))
      await c.close()
      ;[c, page] = await T.newPage(w, h)
      await T.go(page, url, 450)
      rk(T, `${label} ${tag}: focus lands on ${o.expect.slice(0, 40)}`, await R.V4(page, { ...action, expect: o.expect }, o.keys ? { shortcuts: KEYS_AFTER_M } : {}))
      if (o.error) {
        const t = await page.evaluate(() => ({ title: document.title, summary: !!document.querySelector('.govuk-error-summary'), msg: !!document.querySelector('.govuk-error-message') }))
        T.ck(`${label} ${tag}: the title starts "Error: ", the summary shows with the message at the field`, /^Error: /.test(t.title) && t.summary && t.msg, JSON.stringify(t))
        if (w === 1366) await domReport(T, page, `${label} (error state)`, { shell: true, tabs: true, title: /^Error: .* - Ashbridge Tax$/ })
      }
      await c.close()
    }
  }
}

// ---------------------------------------------------------------- filters and search (V5 caption, V6, V8)
const FILTERS = [
  ['Workbench', 'workbench.html?as=anita', 'figures', 'prep'], ['Review', 'review.html?as=dev', 'figures', 'cpa'], ['Documents', 'documents.html?as=anita', 'values', 'verify'],
  ['Exceptions', 'exceptions.html?as=dev', 'exceptions', 'risks'], ['Ops', 'ops.html?as=sam', 'items', 'ops'],
]
const navigating = (page) => new Proxy(page, {
  get(t, k) {
    if (k === 'press') return async (...a) => { await t.press(...a); await t.waitForLoadState('load').catch(() => {}); await t.waitForSelector('#sv-results-count:not(:empty)', { timeout: 3000 }).catch(() => {}) }
    const v = t[k]
    return typeof v === 'function' ? v.bind(t) : v
  },
})

sections.rules = async (T) => {
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    for (const [label, url, kind, list] of FILTERS) {
      const [c, page] = await T.newPage(w, h)
      await T.go(page, url, 350)
      rk(T, `${label} ${tag}: the filter caption follows the filter`, await R.V5caption(page, { name: 'filter', run: async (q) => { await q.fill('#sv-filter', 'zzz-nothing') } }, { caption: '#sv-filter-count' }))
      await page.fill('#sv-filter', '')
      const it = lists[list][0]
      const values = [it.name, it.amount, it.line || it.flagId].filter(Boolean)
      for (const value of values) rk(T, `${label} ${tag}: a ${value === it.name ? 'name' : 'value'} copied as shown ("${String(value).slice(0, 28)}") finds its row`, await R.V6(page, { input: '#sv-filter', result: '[data-item]:not([hidden])', label: 'label[for="sv-filter"]', kinds: [{ kind, value }], submit: null }))
      await c.close()
    }
    // header search: results page, each kind named in the label found by a value copied in the format shown
    const [c, page] = await T.newPage(w, h)
    await T.go(page, 'workbench.html?as=anita', 350)
    const kinds = [
      { kind: 'figures', value: lists.prep[1].name }, { kind: 'values', value: lists.prep[1].amount }, { kind: 'exceptions', value: lists.risks[1].name },
      { kind: 'items', value: lists.ops[1].name }, { kind: 'sources', value: sources['qbo-txn-2188'].title }, { kind: 'sources', value: `${sources['lv-dec-p2'].title}, ${sources['lv-dec-p2'].page}` },
    ]
    rk(T, `Header search ${tag}: a figure, a value, an exception, an item and a source copied as shown each find a result`, await R.V6(navigating(page), { input: '#sv-search', result: '[data-result]', label: 'label[for="sv-search"]', kinds }))
    await c.close()
    // V8 one choice, one action
    const [c2, p2] = await T.newPage(w, h)
    await T.go(p2, urlOf('prep', 'c2'), 450)
    rk(T, `Workbench ${tag}: typing a reason selects "A written reason" and never gives a "choose" error`, await R.V8(p2, { field: '#sv-reason', radio: '#sv-src-reason', submit: 'button[data-primary]' }))
    await c2.close()
  }
}

// ---------------------------------------------------------------- V7: every control does something, region by region
const STATE_V7 = [
  ['Review, the pane', urlOf('cpa', 'f1', '1'), '#source-pane button, #source-pane a[href], #source-pane summary', 36],
  ['Review, the shell and the list', urlOf('cpa', 'f1', '1'), 'header a[href], header button, .app-return a[href], .app-tools button, .app-tools input, [data-panel="review"] tbody tr:nth-child(-n+3) [data-open]', 24],
  ['Review, a page image', urlOf('cpa', 'f4', '2'), '#source-pane button, #source-pane a[href], #source-pane summary', 36],
  ['Workbench, the cite form', urlOf('prep', 'c2'), '#source-pane button, #source-pane a[href], #source-pane input, #source-pane summary', 24],
  ['Workbench, the reason form', urlOf('prep', 'c5'), '#source-pane button, #source-pane a[href], #source-pane summary', 16],
  ['Documents, the box', urlOf('verify', 'v1'), '#source-pane button, #source-pane a[href], #source-pane summary', 24],
  ['Exceptions, the judgment', urlOf('risks', 'x2'), '#source-pane button, #source-pane a[href], #source-pane summary', 24],
  ['Ops, complete and chase', urlOf('ops', 'o1'), '#source-pane button, #source-pane a[href], #source-pane summary', 24],
  ['Ops, nothing attached', urlOf('ops', 'o5'), '#source-pane button, #source-pane a[href], #source-pane summary', 16],
  ['Ops, done rows', 'ops.html?state=done&as=sam&item=o2', '[data-item="o2"] button, [data-item="o3"] button, #source-pane button', 16],
  ['Void', urlOf('changed', 'g2'), '#source-pane button, #source-pane a[href], [data-void-only] a[href], [data-item] button', 16],
]
sections.controls = async (T) => {
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    for (const [label, url, selector, limit] of STATE_V7) {
      const [c, page] = await T.newPage(w, h)
      await T.go(page, url, 450)
      const reset = async (q) => {
        await q.evaluate(() => { try { sessionStorage.clear(); localStorage.clear() } catch (e) { /* storage may be blocked */ } })
        await q.goto(T.U(url)); await T.settle(q, 300)
        await q.evaluate(() => document.activeElement && document.activeElement.blur())
      }
      rk(T, `${label} ${tag}: every control changes the page, the focus or the URL, or opens a window`, await R.V7(page, { selector, reset, limit }))
      await c.close()
    }
  }
}

// ---------------------------------------------------------------- the rendered DOM of every page and state
const DOM_PAGES = [
  ['Landing page', 'index.html', {}],
  ['Workbench', 'workbench.html?as=anita', { shell: true, tabs: true, title: /^Cite figures, / }],
  ['Workbench, candidates open (c2)', urlOf('prep', 'c2'), { shell: true, tabs: true }],
  ['Workbench, reason only (c5)', urlOf('prep', 'c5'), { shell: true, tabs: true }],
  ['Review', 'review.html?as=dev', { shell: true, tabs: true, title: /^Review figures, / }],
  ['Review, six sources (f1)', urlOf('cpa', 'f1', '1'), { shell: true, tabs: true }],
  ['Review, the entry (f1, 2)', urlOf('cpa', 'f1', '2'), { shell: true, tabs: true }],
  ['Review, an entry sheet row (f1, 2.1)', urlOf('cpa', 'f1', '2.1'), { shell: true, tabs: true }],
  ['Review, QBO without an id (f3)', urlOf('cpa', 'f3', '1'), { shell: true, tabs: true }],
  ['Review, flagged (f4)', urlOf('cpa', 'f4', '1'), { shell: true, tabs: true }],
  ['Review, masked slip (f5)', urlOf('cpa', 'f5', '1'), { shell: true, tabs: true }],
  ['Review, empty (f7)', urlOf('cpa', 'f7'), { shell: true, tabs: true }],
  ['Review, the image fails (f8)', urlOf('cpa', 'f8', '1'), { shell: true, tabs: true, title: /^Error: / }],
  ['Review, CRA capture (f9)', urlOf('cpa', 'f9', '1'), { shell: true, tabs: true }],
  ['Documents', urlOf('verify', 'v1'), { shell: true, tabs: true, title: /^Verify extracted values, / }],
  ['Exceptions', urlOf('risks', 'x2'), { shell: true, tabs: true, title: /^Judge accepted risks, / }],
  ['Ops', urlOf('ops', 'o1'), { shell: true, tabs: true, title: /^Check items, / }],
  ['Ops, nothing attached (o5)', urlOf('ops', 'o5'), { shell: true, tabs: true }],
  ['Ops, done rows', 'ops.html?state=done&as=sam&item=o2', { shell: true, tabs: true }],
  ['Documents, done rows', 'documents.html?state=done&as=anita&item=v1', { shell: true, tabs: true }],
  ['Exceptions, done rows', 'exceptions.html?state=done&as=dev&item=x1', { shell: true, tabs: true }],
  ['Void', 'workbench.html?state=void&as=anita&item=g2', { shell: true, tabs: true }],
  ['Second window, empty', 'window.html', { shell: true, title: /^Source window, / }],
  ['Search, results', 'search.html?q=meals', { title: /^Search results for meals, / }],
  ['Search, nothing searched', 'search.html', { title: /^Search results, / }],
  ['Search, no result', 'search.html?q=zzzz', { title: /^Search results for zzzz, / }],
  ['Signed out', 'signed-out.html', { title: /^You have signed out - / }],
]
sections.dom = async (T) => {
  for (const [label, url, o] of DOM_PAGES) {
    const [c, page] = await T.newPage(1366, 650)
    await T.go(page, url, 450)
    await domReport(T, page, label, o)
    await c.close()
  }
  // the same pages at 320 px: the narrow views add controls (Back to the list) and hide others; classes and controls are checked again
  for (const [label, url, o] of DOM_PAGES.filter((x) => /^(Workbench|Review, six|Review, empty|Documents|Ops|Void)/.test(x[0]))) {
    const [c, page] = await T.newPage(320, 640)
    await T.go(page, url, 450)
    await domReport(T, page, `${label} at 320 px`, { ...o, title: o.title })
    await c.close()
  }
}

// ---------------------------------------------------------------- counts that agree with the rows they describe
const readFacts = () => {
  const text = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '')
  const panel = document.querySelector('[data-panel]:not([hidden])')
  const rows = [...panel.querySelectorAll('[data-item]')].filter((r) => !r.closest('[data-nofilter]'))
  return {
    rows: rows.map((r) => ({ id: r.getAttribute('data-item'), hidden: r.hidden, flagged: r.hasAttribute('data-flagged'), status: text(r.querySelector('[data-status]')), open: text(r.querySelector('[data-open]')) })),
    caption: text(document.getElementById('sv-filter-count')),
    lines: [...panel.querySelectorAll('[data-count]')].filter((e) => e.getClientRects().length).map(text),
  }
}
const num = (re, s) => { const m = re.exec(s); return m ? m.slice(1).map(Number) : null }
const COUNT_CHECKS = {
  workbench: (f) => { const got = num(/^(\d+) of (\d+) figures need a source or a reason\./, f.lines.find((l) => /need a source/.test(l)) || ''); const rows = f.rows; return { got, want: [rows.filter((r) => !/\bCited\b/.test(r.status)).length, rows.length] } },
  review: (f) => { const got = num(/^(\d+) of (\d+) figures ticked\. (\d+) flagged for a person\. (\d+) with no evidence\./, f.lines.find((l) => /figures ticked/.test(l)) || ''); const rows = f.rows; return { got, want: [rows.filter((r) => /All sources ticked/.test(r.status)).length, rows.length, rows.filter((r) => r.flagged).length, rows.filter((r) => /\(0\)/.test(r.open)).length] } },
  documents: (f) => { const got = num(/^(\d+) of (\d+) values not checked\./, f.lines.find((l) => /values not checked/.test(l)) || ''); const rows = f.rows; return { got, want: [rows.filter((r) => /^Not checked/.test(r.status)).length, rows.length] } },
  exceptions: (f) => { const got = num(/^(\d+) of (\d+) accepted risks not judged\. (\d+) exceptions in all\./, f.lines.find((l) => /accepted risks/.test(l)) || ''); const rows = f.rows; const acc = rows.filter((r) => /Accepted risk/.test(r.status)); return { got, want: [acc.filter((r) => /Not judged/.test(r.status)).length, acc.length, rows.length] } },
  ops: (f) => { const got = num(/^(\d+) of (\d+) items still to check\./, f.lines.find((l) => /items still to check/.test(l)) || ''); const rows = f.rows; return { got, want: [rows.filter((r) => !/^(Complete|Chased)/.test(r.status)).length, rows.length] } },
}
const DECISIONS = {
  workbench: async (p) => { await p.click('[data-item="c2"] [data-open]'); await sleep(300); await p.click('#sv-src-0'); await p.click('button[data-primary]'); await sleep(400) },
  review: async (p) => { await p.click('[data-item="f2"] [data-open]'); await sleep(300); for (let i = 0; i < 3; i++) { await p.click('.app-viewer__foot--tick button[data-primary]'); await sleep(200) } },
  documents: async (p) => { await p.click('[data-item="v1"] [data-open]'); await sleep(300); await p.click('button[data-primary]'); await sleep(300) },
  exceptions: async (p) => { await p.click('[data-item="x2"] [data-open]'); await sleep(300); await p.fill('#sv-judge-why', WHY); await p.click('.app-viewer__foot button[data-primary]'); await sleep(350) },
  ops: async (p) => { await p.click('[data-item="o2"] [data-open]'); await sleep(300); await p.click('button[data-primary]'); await sleep(300) },
}
sections.counts = async (T) => {
  for (const [label, url, , list] of FILTERS) {
    const tab = url.split('.html')[0]
    const [c, page] = await T.newPage(1366, 650)
    await T.go(page, url, 350)
    for (const when of ['on load', 'after one decision']) {
      if (when !== 'on load') await DECISIONS[tab](page)
      const f = await page.evaluate(readFacts)
      const r = COUNT_CHECKS[tab](f)
      T.ck(`${label} ${when}: the count line says ${r.want.join(', ')} and the rows agree`, !!r.got && r.got.join() === r.want.join(), `${JSON.stringify(r)} | ${f.lines.join(' | ')}`)
      const shown = f.rows.filter((x) => !x.hidden).length
      T.ck(`${label} ${when}: the filter caption says "Showing ${shown} of ${f.rows.length}"`, f.caption === `Showing ${shown} of ${f.rows.length}` || f.caption === '', f.caption)
    }
    // the same list counted by the data: no list has a row the count lines do not know about
    T.ck(`${label}: the number of rows is the number of items in the data (${lists[list].length})`, (await page.evaluate(readFacts)).rows.length === lists[list].length, '')
    await c.close()
  }
  // the changed cells of the void state: the heading counts them
  const [c, page] = await T.newPage(1366, 650)
  await T.go(page, 'workbench.html?state=void&as=anita', 350)
  const v = await page.evaluate(() => ({ head: document.getElementById('sv-changed-h').textContent, rows: document.querySelectorAll('[data-nofilter] [data-item]').length, others: document.querySelectorAll('[data-panel="workbench"] [data-item]:not([data-list="changed"])').length, caption: (document.getElementById('sv-filter-count') || {}).textContent }))
  T.ck(`Void: the heading says "${v.head}" and the table has ${v.rows} rows; the figures table still says "${v.caption}"`, v.head === `Changed since approval, ${v.rows} cells` && v.caption === `Showing ${v.others} of ${v.others}`, JSON.stringify(v))
  await c.close()
}

// ---------------------------------------------------------------- one figure one string, and a source count that is the same everywhere
const readRow = (id) => {
  const row = document.querySelector(`[data-item="${id}"]`)
  const th = row.querySelector('th')
  const name = th.firstChild.textContent.replace(/\s+/g, ' ').trim()
  const money = row.querySelector('td.govuk-table__cell--numeric')
  return { name, amount: money ? money.textContent.trim() : '', label: (row.querySelector('[data-open]') || {}).textContent || '' }
}
const readPane = () => {
  const text = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '')
  const nav = document.querySelector('.app-viewer__steps:not(.app-viewer__steps--sub)')
  const steps = nav ? nav.querySelectorAll('li:not(.app-steps__sep):not(.app-steps__go)').length : (document.querySelector('.app-viewer__stage') ? 1 : 0)
  const meta = text(document.querySelector('.app-viewer__meta'))
  return { title: text(document.getElementById('sv-title-pane')), steps, meta, of: (/(?:Source|Candidate) \d+ of (\d+)/.exec(meta) || [])[1] }
}
sections.strings = async (T) => {
  const PAGES = [['Workbench', 'workbench.html?as=anita', 'prep'], ['Review', 'review.html?as=dev', 'cpa'], ['Documents', 'documents.html?as=anita', 'verify'], ['Exceptions', 'exceptions.html?as=dev', 'risks'], ['Ops', 'ops.html?as=sam', 'ops'], ['Void', 'workbench.html?state=void&as=anita', 'changed']]
  for (const [label, url, list] of PAGES) {
    const [c, page] = await T.newPage(1366, 650)
    await T.go(page, url, 350)
    const bad = [], badCount = []
    for (const it of lists[list]) {
      const row = await page.evaluate(readRow, it.id)
      await page.click(`[data-item="${it.id}"] [data-open]`)
      await T.settle(page, 300)
      const pane = await page.evaluate(readPane)
      const want = row.amount ? `${row.name}, ${row.amount}` : row.name
      if (pane.title !== want) bad.push(`${it.id}: row "${want}" but the viewer title says "${pane.title}"`)
      const m = /\((\d+)\)/.exec(row.label)
      if (m) {
        const n = Number(m[1])
        const noSource = n === 0
        if (!noSource && (pane.steps !== n || Number(pane.of) !== n)) badCount.push(`${it.id}: button says ${n}, the steps say ${pane.steps}, the pane says "of ${pane.of}"`)
      }
    }
    T.ck(`${label}: one figure prints the same string in the row and in the viewer title (${lists[list].length} rows)`, !bad.length, bad.slice(0, 3).join('; '))
    T.ck(`${label}: a row's source count is the number of steps and the "of N" in the viewer (${lists[list].length} rows)`, !badCount.length, badCount.slice(0, 3).join('; '))
    await c.close()
  }
}

// ---------------------------------------------------------------- links: every link of the landing page, then every link of every page
const FACTS = () => {
  const text = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : '' }
  return {
    h1: text('h1'), title: text('#sv-title-pane'), meta: text('.app-viewer__meta'), card: text('.app-viewer__card'), foot: text('.app-viewer__foot'), warn: text('.app-warning'), prov: text('.app-viewer__prov'), note: text('.app-viewer__note'),
    err: !!document.querySelector('.govuk-error-summary'), noid: !!document.querySelector('.app-noid'), box: !!document.querySelector('.app-box, .app-cell-boxed'), checked: document.querySelectorAll('input[name="sv-src"]:checked').length,
    voidAlert: !!document.querySelector('.moj-alert--warning:not([hidden])'), buttons: [...document.querySelectorAll('#source-pane button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()), reason: !!document.getElementById('sv-reason'), cand0: !!document.getElementById('sv-src-0'),
    results: document.querySelectorAll('[data-result]').length, win: text('#sv-title-window'),
  }
}
const STATE_FACTS = {
  'review.html?item=f1&src=1': (f) => f.title === 'Due from shareholder, 13,212' && /^Source 1 of 6/.test(f.meta) && /QBO/.test(f.card) && !f.err,
  'review.html?item=f1&src=2.1': (f) => /Source 2 of 6, entry source 1 of 7/.test(f.meta),
  'review.html?item=f1&src=3': (f) => /QBO Transaction ID/.test(f.card) && /2188/.test(f.card),
  'review.html?item=f3&src=1': (f) => f.noid && /Composite key/.test(f.card),
  'review.html?item=f4&src=1': (f) => /Evidence for the flag/.test(f.prov) && /Flagged for a person/.test(f.note),
  'review.html?item=f7': (f) => /Not checked: no evidence/.test(f.warn),
  'review.html?item=f8&src=1': (f) => f.err,
  'review.html?item=f5&src=1': (f) => /SIN on file/.test(f.card) && !/\d{9}/.test(f.card),
  'review.html?item=f9&src=1': (f) => /Pulled from CRA Auto-fill/.test(f.card) && /2 Jun 2026 at 10:15/.test(f.card),
  'review.html?item=f2&src=3': (f) => /Schedule 100/.test(f.card) && /Last year/.test(f.prov),
  'workbench.html?item=c2': (f) => f.cand0 && f.checked === 0 && /exact value/.test(f.foot + f.meta),
  'workbench.html?item=c5': (f) => f.reason && !f.cand0,
  'documents.html?item=v1': (f) => f.buttons.some((b) => /^Accept/.test(b)) && f.buttons.some((b) => /^Reject/.test(b)),
  'exceptions.html?item=x2': (f) => f.buttons.some((b) => /^Accept the risk/.test(b)),
  'ops.html?item=o1': (f) => f.buttons.some((b) => /^Complete/.test(b)) && f.buttons.some((b) => /^Chase/.test(b)),
  'ops.html?state=done&item=o2': (f) => /Complete/.test(f.foot) && /Undo/.test(f.foot),
  'workbench.html?state=void&item=g1': (f) => f.voidAlert && /Nothing to decide/.test(f.card),
  'workbench.html?as=dev&item=c2': (f) => /Only the preparer cites/.test(f.foot),
}
const PAGE_FACTS = {
  'workbench.html': (f) => f.h1 === 'Cite figures', 'review.html?as=dev': (f) => f.h1 === 'Review figures', 'documents.html': (f) => f.h1 === 'Verify extracted values', 'exceptions.html?as=dev': (f) => f.h1 === 'Judge accepted risks',
  'ops.html?as=sam': (f) => f.h1 === 'Check items', 'window.html': (f) => f.h1 === 'Source window' && /Source viewer/.test(f.win), 'search.html?q=meals': (f) => f.results > 0, 'signed-out.html': (f) => /signed out/.test(f.h1),
}
sections.links = async (T) => {
  const [c0, p0] = await T.newPage(1366, 650)
  await T.go(p0, 'index.html', 300)
  const links = await p0.$$eval('main a[href]', (as) => as.map((a) => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), href: a.getAttribute('href') })))
  await c0.close()
  T.ck(`the landing page lists ${links.length} links, each to a state or a page`, links.length >= 26, String(links.length))
  const miss = []
  for (const l of links) {
    const [c, page] = await T.newPage(1366, 650)
    await T.go(page, l.href, 450)
    const f = await page.evaluate(FACTS)
    const check = STATE_FACTS[l.href] || PAGE_FACTS[l.href]
    if (!check) { miss.push(`${l.href} has no check`); await c.close(); continue }
    const ok = !!check(f)
    T.ck(`landing page link "${l.text}" (${l.href}) opens the state it names`, ok, JSON.stringify(f).slice(0, 300))
    await c.close()
  }
  T.ck('every link on the landing page has a check in this script', !miss.length, miss.join('; '))
  // the error state's Try again button loads the image
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, 'review.html?item=f8&src=1', 450)
    await page.getByRole('button', { name: /Try again/ }).click()
    await T.settle(page, 600)
    const after = await page.evaluate(() => ({ err: !!document.querySelector('.govuk-error-summary'), box: !!document.querySelector('.app-box'), title: document.title }))
    T.ck('Error: Try again loads the page image, the error summary goes and the title loses "Error: "', !after.err && after.box && !/^Error: /.test(after.title), JSON.stringify(after))
    await c.close() }
  // every link of every page: it resolves, a hash link names an element that exists, a link to the page you are on is the current record tab only
  for (const [label, url] of [['Workbench', 'workbench.html'], ['Review', 'review.html?as=dev'], ['Documents', 'documents.html'], ['Exceptions', 'exceptions.html?as=dev'], ['Ops', 'ops.html?as=sam'], ['Second window', 'window.html'], ['Search', 'search.html?q=meals'], ['Signed out', 'signed-out.html'], ['Void', 'workbench.html?state=void&item=g1'], ['Landing page', 'index.html']]) {
    const [c, page] = await T.newPage(1366, 650)
    await T.go(page, url, 450)
    const r = await page.evaluate(async () => {
      const here = location.pathname + location.search
      const bad = [], self = [], seen = new Set()
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href')
        const u = new URL(href, location.href)
        if (u.origin !== location.origin) { bad.push(`${href} leaves the prototype`); continue }
        if (href.startsWith('#')) { if (!document.getElementById(href.slice(1))) bad.push(`${href} names no element`); continue }
        if (u.pathname + u.search === here && !a.closest('.moj-sub-navigation') && a.getClientRects().length) self.push(`${href} links to this page`)
        if (seen.has(u.pathname)) continue
        seen.add(u.pathname)
        const res = await fetch(u.pathname).catch(() => null)
        if (!res || !res.ok) bad.push(`${href} does not load`)
      }
      return { bad, self, count: document.querySelectorAll('a[href]').length }
    })
    T.ck(`${label}: all ${r.count} links load or name an element on the page, none leaves the prototype`, !r.bad.length, r.bad.slice(0, 4).join('; '))
    T.ck(`${label}: no link to the page you are on, apart from the current record tab`, !r.self.length, r.self.slice(0, 4).join('; '))
    await c.close()
  }
}
