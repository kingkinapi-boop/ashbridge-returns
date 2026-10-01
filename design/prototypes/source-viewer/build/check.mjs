import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import path from 'node:path'
const root = 'C:/Users/User/Documents/GitHub/ashbridge-returns/.claude/worktrees/agent-a146ddf05ba8d2539/design/prototypes/source-viewer'
const U = (p) => 'file:///' + root + '/' + p
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const SIZES = [[1366, 650], [1093, 525]]
const out = { axe: [], budgets: [], keyboard: [], reflow: [], sync: [], misc: [] }
const browser = await chromium.launch()

async function axe(page, label) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const inc = []
  for (const i of r.incomplete) {
    if (i.id !== 'color-contrast') { inc.push(i); continue }
    const sels = i.nodes.map((n) => n.target[n.target.length - 1])
    const ratios = await page.evaluate((sels) => {
      const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
      const parse = (s) => (s.match(/[d.]+/g) || []).map(Number)
      return sels.map((sel) => {
        const e = document.querySelector(sel); if (!e) return 99
        const fg = parse(getComputedStyle(e).color)
        let a = e, bg = [255, 255, 255], found = false
        while (a && !found) { const c = parse(getComputedStyle(a).backgroundColor); if (c.length >= 3 && (c.length === 3 || c[3] === 1)) { bg = c; found = true } else a = a.parentElement }
        const L1 = lum(fg), L2 = lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      })
    }, sels)
    if (Math.min(...ratios) < 4.5) inc.push({ id: 'color-contrast LOW ' + Math.min(...ratios).toFixed(2), nodes: i.nodes })
    else out.misc.push('contrast incompletes resolved by calculation (min ratio ' + Math.min(...ratios).toFixed(2) + ', ' + ratios.length + ' nodes) at ' + label)
  }
  out.axe.push({ label, violations: r.violations.map((v) => v.id + ' x' + v.nodes.length + ' ' + (v.nodes[0]?.target || '')), incomplete: inc.map((i) => i.id + ' x' + i.nodes.length) })
}
const newPage = async (w, h) => { const c = await browser.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', (e) => out.misc.push('PAGEERR ' + e.message)); return [c, p] }

// ---------- axe in every state, both sizes ----------
const states = [
  ['A normal f1', 'a-docked-strip/index.html?item=f1', 5], ['A flagged f4', 'a-docked-strip/index.html?item=f4', 3], ['A flagged f6', 'a-docked-strip/index.html?item=f6', 1],
  ['A empty f7', 'a-docked-strip/index.html?item=f7', 1], ['A error f8', 'a-docked-strip/index.html?item=f8', 1], ['A masked f5', 'a-docked-strip/index.html?item=f5', 3],
  ['A cra f2', 'a-docked-strip/index.html?item=f2', 3], ['A list only', 'a-docked-strip/index.html', 1],
  ['B orphan p1', 'b-tabs-and-decision/index.html?item=p1', 2], ['B tax choice p2', 'b-tabs-and-decision/index.html?item=p2', 1], ['B cited p3', 'b-tabs-and-decision/index.html?item=p3', 5],
  ['B verify v1', 'b-tabs-and-decision/verify.html?item=v1', 1],
  ['C list', 'c-window-first/index.html', 1], ['C pane o1', 'c-window-first/index.html?item=o1', 2], ['C empty o4', 'c-window-first/index.html?item=o4', 1],
  ['A window', 'a-docked-strip/window.html', 1], ['B window', 'b-tabs-and-decision/window.html', 1], ['C window', 'c-window-first/window.html', 1],
  ['landing', 'index.html', 1], ['signed out', 'signed-out.html', 1],
]
for (const [w, h] of SIZES) {
  for (const [label, p, steps] of states) {
    const [c, page] = await newPage(w, h)
    await page.goto(U(p)); await page.waitForTimeout(400)
    await axe(page, `${label} @${w}x${h} source1`)
    for (let i = 2; i <= steps; i++) {
      await page.keyboard.press(']'); await page.waitForTimeout(250)
      await axe(page, `${label} @${w}x${h} source${i}`)
    }
    await c.close()
  }
}
// error state of the cite form and the open details
for (const [w, h] of SIZES) {
  const [c, page] = await newPage(w, h)
  await page.goto(U('b-tabs-and-decision/index.html?item=p1')); await page.waitForTimeout(300)
  await page.click('summary:has-text("Write a reason instead")')
  await page.click('button:has-text("Record the reason")'); await page.waitForTimeout(200)
  await axe(page, `B cite error @${w}x${h}`)
  out.misc.push(`cite error focus @${w}: ` + (await page.evaluate(() => document.activeElement.id)) + ' title ' + (await page.title()).slice(0, 20))
  await page.fill('#sv-reason', 'Supported by the monthly BRIGHTPATH debits; Anita Rao decided.')
  await page.click('button:has-text("Record the reason")'); await page.waitForTimeout(300)
  await axe(page, `B reason recorded @${w}x${h}`)
  out.misc.push(`reason recorded: focus in card ${await page.evaluate(() => !!document.activeElement.closest('#sv-card-pane'))}; meta ${await page.locator('.app-viewer__meta').last().innerText().then((t) => t.replace(/\n/g, ' | '))}`)
  await c.close()
}
// V1 marks flow axe
{
  const [c, page] = await newPage(1366, 650)
  await page.goto(U('a-docked-strip/index.html?item=f2')); await page.waitForTimeout(300)
  for (let i = 0; i < 3; i++) { await page.click('button:has-text("Supports this figure")'); await page.waitForTimeout(250) }
  await axe(page, 'A f2 all marked')
  out.misc.push('f2 status after 3 marks: ' + (await page.locator('[data-item="f2"] [data-status]').innerText()))
  await c.close()
}

// ---------- budgets ----------
for (const [w, h] of SIZES) {
  for (const [name, p, itemSel] of [['A', 'a-docked-strip/index.html', 'f1'], ['B', 'b-tabs-and-decision/index.html', 'p3'], ['C', 'c-window-first/index.html', 'o1']]) {
    const [c, page] = await newPage(w, h)
    await page.goto(U(p)); await page.waitForTimeout(300)
    let navs = 0; page.on('framenavigated', () => navs++)
    const hist0 = await page.evaluate(() => history.length)
    const t0 = Date.now()
    await page.click(`[data-item="${itemSel}"] [data-open]`)
    await page.waitForSelector('.app-box', { state: 'visible', timeout: 3000 })
    const t = Date.now() - t0
    const info = await page.evaluate(() => {
      const box = document.querySelector('.app-box'), st = document.querySelector('.app-viewer__stage')
      const br = box.getBoundingClientRect(), sr = st.getBoundingClientRect()
      const split = document.getElementById('app-split').getBoundingClientRect(), pane = document.getElementById('source-pane').getBoundingClientRect(), work = document.querySelector('.app-split__work').getBoundingClientRect()
      return { boxInView: br.top >= sr.top - 1 && br.bottom <= sr.bottom + 1 && br.left >= sr.left - 1 && br.right <= sr.right + 1, focusBox: document.activeElement === box, paneW: Math.round(pane.width), stageH: Math.round(sr.height), paneBeside: pane.left >= work.right - 1, paneH: Math.round(pane.height), splitH: Math.round(split.height), history: history.length }
    })
    // Escape returns focus to the figure's button
    await page.keyboard.press('Escape')
    const esc = await page.evaluate(() => document.activeElement.getAttribute('data-open') !== null && document.activeElement.closest('[data-item]')?.getAttribute('data-item'))
    // step by key: one key press
    await page.click(`[data-item="${itemSel}"] [data-open]`); await page.waitForTimeout(300)
    const t1 = Date.now(); await page.keyboard.press(']'); await page.waitForTimeout(50)
    const meta = await page.locator('.app-viewer__meta').first().innerText().catch(() => '')
    const stepMeta = await page.evaluate(() => [...document.querySelectorAll('.app-viewer__meta')].map((e) => e.innerText.replace(/\n/g, ' ')).join(' || '))
    out.budgets.push({ version: name, size: `${w}x${h}`, clicksToOpen: 1, msToBoxVisible: t, pageLoads: navs, historyAdded: info.history - hist0, ...info, escapeReturnsTo: esc, stepKeyPresses: 1, afterStep: stepMeta.slice(0, 200) })
    await c.close()
  }
}

// ---------- keyboard walk ----------
for (const [name, p] of [['A', 'a-docked-strip/index.html?item=f1'], ['B', 'b-tabs-and-decision/index.html?item=p1'], ['C', 'c-window-first/index.html?item=o1'], ['Awin', 'a-docked-strip/window.html'], ['Bverify', 'b-tabs-and-decision/verify.html?item=v1']]) {
  for (const [w, h] of SIZES) {
    const [c, page] = await newPage(w, h)
    await page.goto(U(p)); await page.waitForTimeout(400)
    const seen = []; const bad = []
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press('Tab')
      const r = await page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null
        const cs = getComputedStyle(e), b = e.getBoundingClientRect()
        const vis = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none'
        const inView = b.top >= 0 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1 && b.left >= -1
        return { id: e.id || e.tagName + ':' + (e.textContent || '').trim().slice(0, 24), vis, inView, w: Math.round(b.width), h: Math.round(b.height) }
      })
      if (!r) continue
      if (seen.includes(r.id) && seen.indexOf(r.id) === 0 && i > 5) break
      seen.push(r.id)
      if (!r.vis && !/^sv-follow|^sv-keys|^sv-slow|^sv-filter/.test(r.id) && !/checkbox/.test(r.id)) bad.push('no focus style: ' + r.id)
      if (!r.inView && !/^DIV:/.test(r.id)) bad.push('not in view: ' + r.id)
      if (r.w < 24 || r.h < 24) bad.push('small target ' + r.w + 'x' + r.h + ': ' + r.id)
    }
    out.keyboard.push({ page: name, size: `${w}x${h}`, stops: seen.length, problems: [...new Set(bad)].slice(0, 8) })
    await c.close()
  }
}

// ---------- 320 px reflow ----------
for (const [label, p] of [['A list', 'a-docked-strip/index.html'], ['A viewer f1', 'a-docked-strip/index.html?item=f1'], ['A viewer f7', 'a-docked-strip/index.html?item=f7'], ['B viewer p1', 'b-tabs-and-decision/index.html?item=p1'], ['B verify', 'b-tabs-and-decision/verify.html'], ['C list', 'c-window-first/index.html'], ['C window', 'c-window-first/window.html'], ['A window', 'a-docked-strip/window.html'], ['landing', 'index.html']]) {
  const [c, page] = await newPage(320, 640)
  await page.goto(U(p)); await page.waitForTimeout(500)
  const r = await page.evaluate(() => {
    const over = []
    const vw = document.documentElement.clientWidth
    document.querySelectorAll('body *').forEach((e) => {
      const b = e.getBoundingClientRect(); if (b.width === 0 || b.right <= vw + 1) return
      // ignore content inside a scrollable region
      let a = e.parentElement, inScroll = false
      while (a && a !== document.body) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth) { inScroll = true; break } a = a.parentElement }
      if (!inScroll) over.push(e.tagName + '.' + (e.className || '').toString().slice(0, 30) + ' right=' + Math.round(b.right))
    })
    return { docScroll: document.documentElement.scrollWidth, vw, over: over.slice(0, 4) }
  })
  out.reflow.push({ label, ...r, ok: r.docScroll <= r.vw && r.over.length === 0 })
  await axe(page, `${label} @320x640`)
  await c.close()
}
// 320: back control and escape on the viewer view
{
  const [c, page] = await newPage(320, 640)
  await page.goto(U('a-docked-strip/index.html')); await page.click('[data-item="f1"] [data-open]'); await page.waitForTimeout(300)
  const listHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.app-split__work')).display === 'none')
  await page.click('.app-viewer__controls button:has-text("Back to the list")').catch(() => {})
  const listBack = await page.evaluate(() => getComputedStyle(document.querySelector('.app-split__work')).display !== 'none')
  out.misc.push(`320 viewer replaces list: ${listHidden}; Back shows list: ${listBack}; focus: ${await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 20))}`)
  await c.close()
}

// ---------- second window follows (both versions) ----------
for (const [name, dir] of [['A', 'a-docked-strip'], ['B', 'b-tabs-and-decision'], ['C', 'c-window-first']]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 650 } })
  const page = await ctx.newPage()
  await page.goto(U(`${dir}/index.html`)); await page.waitForTimeout(300)
  const first = name === 'A' ? 'f1' : name === 'B' ? 'p3' : 'o1'
  const second = name === 'A' ? 'f2' : name === 'B' ? 'p4' : 'o2'
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('#sv-open-window')])
  const r = { version: name, popupOpened: !!pop }
  if (pop) {
    await pop.waitForTimeout(1200)
    r.winState = await page.locator('#sv-win-status').innerText()
    await page.click(`[data-item="${first}"] [data-open]`); await pop.waitForTimeout(600)
    r.followed1 = await pop.locator('#sv-title-window').innerText()
    await page.keyboard.press(']'); await pop.waitForTimeout(600)
    r.followedStep = await pop.locator('.app-viewer__meta').last().innerText().then((t) => t.replace(/\n/g, ' ').slice(0, 60))
    await page.click(`[data-item="${second}"] [data-open]`); await pop.waitForTimeout(600)
    r.followed2 = await pop.locator('#sv-title-window').innerText()
    // step in window propagates back
    await pop.keyboard.press(']'); await page.waitForTimeout(600)
    r.windowStepToPane = await page.locator('.app-viewer__meta').last().innerText().then((t) => t.replace(/\n/g, ' ').slice(0, 50)).catch(() => '')
    // Follow off
    await pop.uncheck('#sv-follow'); await page.click(`[data-item="${first}"] [data-open]`); await pop.waitForTimeout(500)
    r.notFollowingMsg = await pop.locator('#sv-win-msg').innerText()
    r.titleStays = await pop.locator('#sv-title-window').innerText()
    await pop.check('#sv-follow'); await pop.waitForTimeout(400)
    r.catchUp = await pop.locator('#sv-title-window').innerText()
    // window closed state
    await pop.close(); await page.waitForTimeout(1500)
    r.afterClose = await page.locator('#sv-win-status').innerText()
    // reopen then sign out closes it
    const [pop2] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('#sv-open-window')])
    await pop2.waitForTimeout(800)
    await page.click('#sv-signout'); await page.waitForTimeout(800)
    r.signOutClosedWindow = pop2.isClosed()
    r.signedOutPage = await page.title()
  }
  out.sync.push(r)
  await ctx.close()
}

// ---------- lint ----------
const lint = []
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'build' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])
const files = walk(root)
const html = files.filter((f) => f.endsWith('.html')), texts = files.filter((f) => /\.(html|js|css|md|svg)$/.test(f) && !f.endsWith('govuk-moj.css'))
const retired = ['export 1', 'export 2', 'review-lines export', 'receipt export', 'gate 1', 'judgment input sheet', 'AI-proposed GIFI', 'Judgment tab']
for (const f of texts) {
  const t = fs.readFileSync(f, 'utf8')
  for (const r of retired) if (t.toLowerCase().includes(r.toLowerCase())) lint.push(`retired term "${r}" in ${path.basename(f)}`)
  if (t.includes('\u2014') || t.includes('\u2013')) lint.push(`dash in ${path.basename(f)}`)
  if (/lorem ipsum|coming soon|\bTBD\b|placeholder=/i.test(t)) lint.push(`filler in ${path.basename(f)}`)
  if (/377979456|\bSIN ending|ending in \d/.test(t)) lint.push(`SIN digits in ${path.basename(f)}`)
}
for (const f of html) {
  const t = fs.readFileSync(f, 'utf8'), dir = path.dirname(f)
  for (const m of t.matchAll(/href="([^"]*)"/g)) {
    const h = m[1]
    if (h === '#' || h === '') lint.push(`dead # link in ${path.basename(f)}`)
    else if (h.startsWith('#')) { if (!t.includes(`id="${h.slice(1)}"`)) lint.push(`missing anchor ${h} in ${path.basename(f)}`) }
    else if (!/^https?:/.test(h)) { const tgt = path.resolve(dir, h.split('?')[0]); if (!fs.existsSync(tgt)) lint.push(`broken link ${h} in ${path.basename(f)}`) }
  }
  // self links (aria-current tab links are the MOJ current-page pattern and exempt)
  for (const m of t.matchAll(/<a [^>]*href="([^"#?]+)"[^>]*>/g)) { if (path.resolve(path.dirname(f), m[1]) === path.resolve(f) && !/aria-current/.test(m[0])) lint.push(`self link ${m[1]} in ${path.basename(f)}`) }
  // classes
  for (const m of t.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/).filter(Boolean)) if (!/^(govuk-|moj-|app-)/.test(c) && !['js-enabled'].includes(c)) lint.push(`class ${c} in ${path.basename(f)}`)
  if ((t.match(/<h1[ >]/g) || []).length !== 1) lint.push(`h1 count in ${path.basename(f)}`)
  if (/style="/.test(t)) lint.push(`inline style in ${path.basename(f)}`)
}
// classes in JS-built DOM and inline style in JS (only the box position and the page width are allowed)
const appCss = fs.readFileSync(path.join(root, 'assets/app.css'), 'utf8')
const defined = new Set([...appCss.matchAll(/\.(app-[a-z0-9_-]+)/g)].map((m) => m[1]))
const used = new Set()
for (const f of files.filter((f) => /assets[\\/][a-z0-9-]+\.js$/.test(f) && !/data\.js$/.test(f))) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/\b(app-[a-z0-9_-]+)/g)) used.add(m[1]) }
for (const f of html) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/\b(app-[a-z0-9_-]+)/g)) used.add(m[1]) }
for (const u of used) if (!defined.has(u) && !/^app-(split|viewer|pane-w)$/.test(u)) lint.push(`app class without CSS: ${u}`)
out.lint = { appClasses: [...used].sort(), findings: [...new Set(lint)] }

// counts agree: figures text vs rows
const countLint = []
for (const [f, rowsSel] of [['a-docked-strip/index.html', 8], ['b-tabs-and-decision/index.html', 6], ['c-window-first/index.html', 5], ['b-tabs-and-decision/verify.html', 4]]) {
  const t = fs.readFileSync(path.join(root, f), 'utf8'); const rows = (t.match(/data-item="/g) || []).length
  const claimed = [...t.matchAll(/of (\d+) (figures|items|values)/g)].map((m) => +m[1]); const show = [...t.matchAll(/Showing (\d+) of (\d+)/g)].map((m) => +m[2])
  if (rows !== rowsSel || claimed.some((c) => c !== rows) || show.some((c) => c !== rows)) countLint.push(`${f}: rows ${rows}, claimed ${claimed}, showing ${show}`)
}
out.lint.countDisagreements = countLint
console.log(JSON.stringify(out, null, 1))
await browser.close()
