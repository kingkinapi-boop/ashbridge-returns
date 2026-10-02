// Shared rule checks V1 to V8 (reports/findings-designs-2.md, staff-screens rules 9, 18, 19, 20).
// Every function takes a Playwright page (already on the page and state under test) and returns
// { rule, ok, failures: [string] }. Action checks take a described action (see README.md):
//   { name, click: selector } | { name, press: key } | { name, run: async (page) => {} }, optional { expect, wait }.
// No imports: the caller brings Playwright. Run each check at both rule-18 sizes (SIZES, atSizes).

export const SIZES = [[1366, 650], [1093, 525]]
export const IDENTITY = '[data-identity-bar]'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const res = (rule, failures) => ({ rule, ok: failures.length === 0, failures })

// Run fn(page, [w,h]) on a fresh page at each size; returns the merged result.
export async function atSizes(browser, url, fn, sizes = SIZES) {
  const all = []
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    await page.goto(url)
    const r = await fn(page, [w, h])
    for (const f of r.failures) all.push(`${w}x${h}: ${f}`)
    await ctx.close()
  }
  return res('multi', all)
}

async function perform(page, a) {
  if (a.click) await page.click(a.click)
  else if (a.press) await page.keyboard.press(a.press)
  else if (a.run) await a.run(page)
  await sleep(a.wait ?? 200)
}

const inViewJs = ({ sel, full }) => {
  const els = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length)
  return els.map((e) => {
    const b = e.getBoundingClientRect()
    const ok = full ? b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth
      : b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth
    return { ok, text: (e.textContent || '').trim().slice(0, 30), top: Math.round(b.top), bottom: Math.round(b.bottom) }
  })
}

// V1 No early error: nothing error-like is visible on load or after non-submit input; [hidden] means display:none.
export async function V1(page, { input } = {}) {
  const f = []
  const scan = async (when) => {
    const r = await page.evaluate(() => {
      const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
      const bad = [...document.querySelectorAll('.govuk-error-message, .govuk-error-summary, [class*="--error"]')].filter(vis).map((e) => e.className.toString().slice(0, 40))
      const hid = [...document.querySelectorAll('[hidden]')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.tagName.toLowerCase() + '#' + (e.id || e.className))
      return { bad, hid, title: document.title }
    })
    if (r.bad.length) f.push(`${when}: visible error parts ${r.bad.join(', ')}`)
    if (r.hid.length) f.push(`${when}: [hidden] but displayed ${r.hid.join(', ')}`)
    if (/^Error: /.test(r.title)) f.push(`${when}: title starts "Error: "`)
  }
  await scan('on load')
  const inputs = input ? [input] : await page.$$eval('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea', (els) => els.slice(0, 6).map((e, i) => { e.setAttribute('data-v1-i', i); return `[data-v1-i="${i}"]` }))
  for (const sel of inputs) {
    const el = page.locator(sel).first()
    if (!(await el.isVisible().catch(() => false))) continue
    const type = await el.evaluate((e) => e.type)
    if (type === 'checkbox' || type === 'radio') await el.check({ force: true }).catch(() => {})
    else if (type !== 'file') await el.fill('x').catch(() => {})
    await sleep(120)
    await scan(`after input ${sel}`)
  }
  return res('V1', f)
}

// V2 The page stays put: scrollY moves at most 8 px and the identity bar stays in view.
export async function V2(page, action, { identity = IDENTITY, max = 8 } = {}) {
  const f = []
  const y0 = await page.evaluate(() => scrollY)
  await perform(page, action)
  const y1 = await page.evaluate(() => scrollY)
  if (Math.abs(y1 - y0) > max) f.push(`${action.name || 'action'}: scrollY moved ${y1 - y0} px`)
  const v = await page.evaluate(inViewJs, { sel: identity, full: true })
  if (!v.length) f.push(`identity bar ${identity} not found`)
  else if (!v.every((x) => x.ok)) f.push(`${action.name || 'action'}: identity bar left the view`)
  return res('V2', f)
}

// V3 The work is in view: every [data-evidence] and [data-primary] is inside the viewport with no scroll; no primary in a closed details.
export async function V3(page, { evidence = '[data-evidence]', primary = '[data-primary]' } = {}) {
  const f = []
  const y = await page.evaluate(() => scrollY)
  if (y > 8) f.push(`page already scrolled ${y} px`)
  for (const [name, sel] of [['evidence', evidence], ['primary', primary]]) {
    const v = await page.evaluate(inViewJs, { sel, full: true })
    if (!v.length) f.push(`no visible ${name} (${sel})`)
    for (const x of v) if (!x.ok) f.push(`${name} "${x.text}" outside the viewport (top ${x.top}, bottom ${x.bottom})`)
  }
  const closed = await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const d = e.closest('details'); return d && !d.open }).length, primary)
  if (closed) f.push(`${closed} primary action(s) inside a closed details`)
  return res('V3', f)
}

// V4 Focus lands: after the action focus is on a visible element, never body, and matches action.expect when given.
// shortcuts: [{ key, selector }] each must focus a visible control. A Back step: { name, run: (p) => p.goBack(), expect }.
export async function V4(page, action, { shortcuts = [] } = {}) {
  const f = []
  if (action) {
    await perform(page, action)
    const r = await page.evaluate((exp) => {
      const a = document.activeElement
      const body = !a || a === document.body || a === document.documentElement
      return { body, visible: !body && a.getClientRects().length > 0, matches: exp ? !!(a && a.matches(exp)) : true, desc: a ? a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') : 'none' }
    }, action.expect || null)
    if (r.body) f.push(`${action.name || 'action'}: focus fell to body`)
    else if (!r.visible) f.push(`${action.name || 'action'}: focus on hidden ${r.desc}`)
    else if (!r.matches) f.push(`${action.name || 'action'}: focus on ${r.desc}, expected ${action.expect}`)
  }
  for (const s of shortcuts) {
    await page.evaluate(() => document.activeElement && document.activeElement.blur())
    await page.keyboard.press(s.key)
    await sleep(120)
    const ok = await page.evaluate((sel) => { const a = document.activeElement; return !!a && a.matches(sel) && a.getClientRects().length > 0 }, s.selector)
    if (!ok) f.push(`shortcut "${s.key}" does not focus a visible ${s.selector}`)
  }
  return res('V4', f)
}

// V5 Counts carry their scope: each [data-count="name"] needs "N of M" or its data-scope words shown in its text.
// Returns the counts so a family can compare across pages with V5same. V5caption checks a filter updates its caption.
export async function V5(page, { sel = '[data-count]' } = {}) {
  const f = []
  const counts = await page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length).map((e) => ({ name: e.getAttribute('data-count') || '', scope: e.getAttribute('data-scope') || '', text: e.textContent.replace(/\s+/g, ' ').trim() })))
  for (const c of counts) {
    const m = c.text.match(/\d+/)
    c.n = m ? Number(m[0]) : null
    const ofM = /\d+\s+of\s+\d+/i.test(c.text)
    const scoped = c.scope && c.text.toLowerCase().includes(c.scope.toLowerCase())
    if (!ofM && !scoped) f.push(`count "${c.text}" has no scope word or "N of M"`)
  }
  return { ...res('V5', f), counts }
}
export function V5same(results) {
  const f = [], seen = new Map()
  for (const r of results) for (const c of r.counts || []) {
    const k = c.name + '|' + c.scope
    if (seen.has(k) && seen.get(k).n !== c.n) f.push(`"${c.name}" (${c.scope || 'no scope'}) is ${seen.get(k).n} on one page and ${c.n} on another`)
    else if (!seen.has(k)) seen.set(k, c)
  }
  return res('V5', f)
}
export async function V5caption(page, action, { caption }) {
  const before = await page.locator(caption).first().textContent()
  await perform(page, action)
  const after = await page.locator(caption).first().textContent()
  return res('V5', before === after ? [`caption "${before.trim()}" did not update after ${action.name || 'filter'}`] : [])
}

// V6 Search keeps its promise: for each kind the label names, a value copied in the format shown finds a match.
// kinds: [{ kind, value }]; opts.input, opts.result (selector of one result), opts.label (selector whose text must name each kind).
export async function V6(page, { input, result, label, kinds, submit = 'Enter' }) {
  const f = []
  if (label) {
    const t = ((await page.locator(label).first().textContent()) || '').toLowerCase()
    for (const k of kinds) if (!t.includes(k.kind.toLowerCase())) f.push(`label does not name "${k.kind}"`)
  }
  for (const k of kinds) {
    await page.fill(input, '')
    await page.fill(input, k.value)
    if (submit) await page.press(input, submit)
    await sleep(250)
    const n = await page.locator(result).evaluateAll((els) => els.filter((e) => e.getClientRects().length).length)
    if (n < 1) f.push(`searching ${k.kind} "${k.value}" finds nothing`)
  }
  return res('V6', f)
}

// V7 Every click does something: no DOM, URL, focus, popup or announcement change after a click fails.
// opts.reset(page) restores the state before each control (default: reload); opts.skip selects exempt controls; opts.limit caps controls.
export async function V7(page, { selector = 'button, a[href], [role=button], input[type=submit], summary', skip = '[disabled], [aria-disabled=true], [data-noop-ok]', reset, limit = 60 } = {}) {
  const f = []
  const url0 = page.url()
  const total = await page.locator(selector).count()
  for (let i = 0; i < Math.min(total, limit); i++) {
    if (reset) await reset(page); else await page.goto(url0)
    const el = page.locator(selector).nth(i)
    if (!(await el.isVisible().catch(() => false))) continue
    if (await el.evaluate((e, s) => e.matches(s), skip)) continue
    const label = ((await el.textContent()) || (await el.getAttribute('aria-label')) || '').trim().replace(/\s+/g, ' ').slice(0, 30)
    const snap = () => page.evaluate(() => JSON.stringify([document.body.innerHTML, location.href.replace(/#$/, ''), (document.activeElement && document.activeElement !== document.body && !document.activeElement.__v7 ? document.activeElement.outerHTML.slice(0, 200) : ""), document.title]))
    let popup = false
    const onPop = () => { popup = true }
    page.context().on('page', onPop)
    page.once('dialog', (d) => { popup = true; d.dismiss() })
    page.once('download', onPop)
    await el.evaluate((e) => { e.__v7 = true })
    const a = await snap()
    await el.click({ timeout: 2000 }).catch(() => {})
    await sleep(250)
    const b = await snap().catch(() => null)
    page.context().off('page', onPop)
    if (b !== null && a === b && !popup) f.push(`control #${i} "${label}" does nothing`)
  }
  return res('V7', f)
}

// V8 One choice, one action: typing in a field tied to an option never gives a "choose" error and selects the option.
export async function V8(page, { field, radio, submit, value = '1234' }) {
  const f = []
  await page.fill(field, value)
  await page.click(submit)
  await sleep(250)
  const r = await page.evaluate((radioSel) => ({
    err: [...document.querySelectorAll('.govuk-error-message, .govuk-error-summary, [role=alert]')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()),
    checked: !!document.querySelector(radioSel + ':checked'),
  }), radio)
  const choose = r.err.filter((t) => /choose|select an? |pick/i.test(t))
  if (choose.length) f.push(`typing in ${field} gives "${choose[0].slice(0, 60)}"`)
  if (!r.checked) f.push(`typing in ${field} did not select ${radio}`)
  return res('V8', f)
}
