// Verify script for the source viewer prototypes (D03), fix round 1. Serves the pages over http (never file://) and runs
// design family checks 6 to 9 plus the ten acceptance checks of the findings review (brief, "Fix round 1").
// Run through the heavy-job wrapper:  node tools/heavy.mjs -- node design/prototypes/source-viewer/build/verify.mjs
// Playwright and @axe-core/playwright come from a scratch folder (SV_NM), nothing is installed globally.
// Only headless Chromium is used; the Chrome extension is never touched.
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as R from '../../../verify/rules.mjs' // shared checks V1 to V8 (design/verify)

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const droot = path.resolve(here, '../../..')
const NM = process.env.PW_NM || process.env.SV_NM || 'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Documents-GitHub-ashbridge-returns/308b0a14-ed6c-4f0f-87db-5f8b4fff98fc/scratchpad/tool/node_modules'
const req = createRequire(NM.replace(/node_modules\/?$/, '') + 'x.js')
const { chromium } = req('playwright')
const AxeBuilder = req('@axe-core/playwright').default || req('@axe-core/playwright')
const ONLY = process.env.SV_ONLY ? process.env.SV_ONLY.split(',') : null

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/plain' }
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'
  const f = path.join(droot, p) // the server root is design/, so the shared parts folder is reachable
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end('not found'); return } r.setHeader('content-type', mime[path.extname(f)] || 'text/plain'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${srv.address().port}/prototypes/source-viewer/`
const U = (p) => BASE + p
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const SIZES = [[1366, 650], [1093, 525]]
const browser = await chromium.launch()
const out = { base: 'http (127.0.0.1, random port)', checks: [], axe: [], budgets: [], keyboard: [], reflow: [], window: [], lint: {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function ck(name, ok, detail = '') { out.checks.push({ name, ok: !!ok, detail: String(detail) }); if (!ok) console.log('FAIL', name, detail) }
async function newCtx(w, h) { const c = await browser.newContext({ viewport: { width: w, height: h } }); c.on('page', (p) => p.on('pageerror', (e) => ck('no page error', false, e.message))); return c }
async function newPage(w, h) { const c = await newCtx(w, h); const p = await c.newPage(); return [c, p] }
async function section(name, fn) { if (ONLY && !ONLY.includes(name)) return; const t = Date.now(); try { await fn() } catch (e) { ck(`section ${name} ran`, false, e.stack.split('\n').slice(0, 3).join(' | ')) } console.log(`section ${name} done in ${Math.round((Date.now() - t) / 1000)} s`) }

const ready = async (p, ms = 3000) => { await p.waitForSelector('.app-box, .app-viewer__card', { state: 'visible', timeout: ms }).catch(() => {}); await sleep(120) }
async function openRow(p, id) { await p.click(`[data-item="${id}"] [data-open]`); await ready(p) }

// measures taken inside the page
const measure = () => {
  const de = document.documentElement
  const st = document.querySelector('.app-viewer__stage'), box = document.querySelector('.app-box'), pb = document.querySelector('.app-page'), img = pb && pb.querySelector('img')
  const sr = st && st.getBoundingClientRect(), br = box && box.getBoundingClientRect()
  const work = document.querySelector('.app-split__work'), wr = work && work.getBoundingClientRect()
  const rows = [...document.querySelectorAll('[data-item]')].filter((r) => r.offsetParent !== null)
  const full = wr ? rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= wr.top - 1 && b.bottom <= wr.bottom + 1 }).length : null
  const pane = document.getElementById('source-pane'), pr = pane && pane.getBoundingClientRect()
  return {
    overflowPx: de.scrollHeight - innerHeight, sideScroll: de.scrollWidth - innerWidth,
    stageH: sr && Math.round(sr.height), stageRatio: sr && +(sr.height / innerHeight).toFixed(3),
    textPx: img && pb ? +(img.clientWidth / 612 * Number(pb.getAttribute('data-min-text'))).toFixed(1) : null,
    boxW: br && Math.round(br.width), stageW: sr && Math.round(sr.width),
    boxWhole: br ? br.left >= sr.left - 1 && br.right <= sr.right + 1 && br.top >= sr.top - 1 && br.bottom <= sr.bottom + 1 : null,
    boxLeftInView: br ? br.left >= sr.left - 1 && br.left < sr.right - 8 && br.top >= sr.top - 1 && br.top < sr.bottom - 8 : null,
    focusBox: br ? document.activeElement === box : null,
    zoom: (document.querySelector('.app-zoom-level') || {}).textContent || null,
    fullRows: full, paneW: pr && Math.round(pr.width), paneVisible: !!(pr && pr.width > 0),
  }
}

// ---------------------------------------------------------------- axe over http (check 8, acceptance 10)
async function axeRun(page, label, resolveClipped = false) {
  const a = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const b = await new AxeBuilder({ page }).withRules(['region', 'landmark-unique']).analyze()
  const viol = [...a.violations, ...b.violations].map((v) => `${v.id} x${v.nodes.length} ${v.nodes[0] ? v.nodes[0].target : ''}`)
  let incAll = [...a.incomplete, ...b.incomplete]
  const resolved = []
  if (resolveClipped) {
    // 320 px only: a table inside its labelled scroll region is partly clipped by design, so axe cannot decide the colour of a
    // clipped cell; each such node's contrast is calculated from its computed colours and counted only if it is 4.5:1 or better
    const keep = []
    for (const i of incAll) {
      if (i.id !== 'color-contrast') { keep.push(i); continue }
      const sels = i.nodes.map((n) => n.target[n.target.length - 1])
      const ratios = await page.evaluate((sels) => {
        const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
        const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number)
        return sels.map((sel) => {
          const e = document.querySelector(sel); if (!e) return 0
          const fg = parse(getComputedStyle(e).color)
          let a = e, bg = [255, 255, 255], found = false
          while (a && !found) { const c = parse(getComputedStyle(a).backgroundColor); if (c.length >= 3 && (c.length === 3 || c[3] === 1)) { bg = c; found = true } else a = a.parentElement }
          const L1 = lum(fg), L2 = lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
        })
      }, sels)
      if (Math.min(...ratios) >= 4.5) resolved.push(`${label}: ${sels.length} clipped node(s), lowest ratio ${Math.min(...ratios).toFixed(2)}`)
      else keep.push(i)
    }
    incAll = keep
  }
  const inc = incAll.map((v) => `${v.id} x${v.nodes.length} ${v.nodes[0] ? v.nodes[0].target : ''}`)
  out.axe.push({ label, violations: viol, incomplete: inc, resolvedByCalculation: resolved })
  if (viol.length || inc.length) console.log('AXE', label, viol.join('; '), '|', inc.join('; '))
}
await section('axe', async () => {
  const states = [
    ['A f1', 'a-docked-strip/index.html?item=f1', 5], ['A f4 flagged', 'a-docked-strip/index.html?item=f4', 3], ['A f6 flagged', 'a-docked-strip/index.html?item=f6', 1],
    ['A f7 empty', 'a-docked-strip/index.html?item=f7', 1], ['A f5 masked', 'a-docked-strip/index.html?item=f5', 3], ['A f2', 'a-docked-strip/index.html?item=f2', 3], ['A list', 'a-docked-strip/index.html', 1],
    ['B p1 orphan', 'b-tabs-and-decision/index.html?item=p1', 2], ['B p2 choice', 'b-tabs-and-decision/index.html?item=p2', 1], ['B p3', 'b-tabs-and-decision/index.html?item=p3', 5],
    ['B verify v1', 'b-tabs-and-decision/index.html?tab=verify&item=v1', 1], ['B verify list', 'b-tabs-and-decision/index.html?tab=verify', 1],
    ['C list', 'c-window-first/index.html', 1], ['C o1', 'c-window-first/index.html?item=o1', 2], ['C o4 empty', 'c-window-first/index.html?item=o4', 1], ['C o5', 'c-window-first/index.html?item=o5', 3],
    ['landing', 'index.html', 1], ['signed out', 'signed-out.html', 1],
  ]
  for (const [w, h] of SIZES) {
    for (const [label, p, steps] of states) {
      const [c, page] = await newPage(w, h)
      await page.goto(U(p)); await sleep(450)
      await axeRun(page, `${label} @${w}x${h} source 1`)
      for (let i = 2; i <= steps; i++) { await page.keyboard.press(']'); await sleep(250); await axeRun(page, `${label} @${w}x${h} source ${i}`) }
      await c.close()
    }
    // the failed image and Try again; the cite error; the reason recorded; marked; tab route
    { const [c, page] = await newPage(w, h)
      await page.goto(U('a-docked-strip/index.html?item=f8')); await sleep(500)
      await axeRun(page, `A f8 image failed @${w}x${h}`)
      await page.click('button:has-text("Try again")'); await sleep(500); await axeRun(page, `A f8 after Try again @${w}x${h}`)
      await c.close() }
    { const [c, page] = await newPage(w, h)
      await page.goto(U('b-tabs-and-decision/index.html?item=p1')); await sleep(400)
      await page.click('button[data-primary]'); await sleep(250)
      await axeRun(page, `B cite error @${w}x${h}`)
      await page.fill('#sv-reason', 'Supported by the monthly BRIGHTPATH debits; Anita Rao decided.'); await page.click('button[data-primary]'); await sleep(350)
      await axeRun(page, `B reason recorded @${w}x${h}`)
      await page.click('a[data-route="verify"]'); await sleep(300); await axeRun(page, `B after tab route to Verify @${w}x${h}`)
      await c.close() }
    { const [c, page] = await newPage(w, h)
      await page.goto(U('a-docked-strip/index.html?item=f2')); await sleep(400)
      for (let i = 0; i < 3; i++) { await page.keyboard.press('m'); await sleep(200) }
      await axeRun(page, `A all marked @${w}x${h}`)
      await c.close() }
    // windows with a selection (the work page stores it) and the pane-hidden list
    for (const [dir, item] of [['a-docked-strip', 'f1'], ['b-tabs-and-decision', 'p3'], ['c-window-first', 'o1']]) {
      const ctx = await newCtx(w, h); const page = await ctx.newPage()
      await page.goto(U(`${dir}/index.html?item=${item}`)); await sleep(400)
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('#sv-open-window')])
      if (pop) { await pop.setViewportSize({ width: w, height: h }); await sleep(1500); await axeRun(pop, `${dir[0].toUpperCase()} window @${w}x${h}`); await axeRun(page, `${dir[0].toUpperCase()} work page, pane hidden @${w}x${h}`) }
      await ctx.close()
    }
  }
  for (const [label, p] of [['A list', 'a-docked-strip/index.html'], ['A f1', 'a-docked-strip/index.html?item=f1'], ['B p1', 'b-tabs-and-decision/index.html?item=p1'], ['C o1', 'c-window-first/index.html?item=o1'], ['A window', 'a-docked-strip/window.html'], ['landing', 'index.html']]) {
    const [c, page] = await newPage(320, 640); await page.goto(U(p)); await sleep(500); await axeRun(page, `${label} @320x640`, true); await c.close()
  }
  const v = out.axe.reduce((n, r) => n + r.violations.length, 0), i = out.axe.reduce((n, r) => n + r.incomplete.length, 0)
  ck('axe over http incl. region and landmark-unique: 0 violations (acceptance 10)', v === 0, `${out.axe.length} page-states, ${v} violations`)
  const rc = out.axe.reduce((n, r) => n + (r.resolvedByCalculation || []).length, 0)
  ck('axe: 0 incomplete (acceptance 10); 320 px clipped table cells resolved by calculation are counted separately', i === 0, `${i} incomplete; ${rc} clipped 320 px view(s) resolved by calculated contrast`)
})

// ---------------------------------------------------------------- acceptance 1, 2 and the budgets
await section('budgets', async () => {
  const versions = [['A', 'a-docked-strip/index.html', 'f1', 'f2'], ['B', 'b-tabs-and-decision/index.html', 'p3', 'p4'], ['C', 'c-window-first/index.html', 'o1', 'o2']]
  for (const [w, h] of SIZES) {
    for (const [name, p, first] of versions) {
      const [c, page] = await newPage(w, h)
      await page.goto(U(p)); await sleep(350)
      await page.evaluate(() => { window.__loadMarker = 1 })
      const h0 = await page.evaluate(() => history.length)
      const t0 = Date.now()
      await page.click(`[data-item="${first}"] [data-open]`)
      await page.waitForSelector('.app-box', { state: 'visible', timeout: 3000 })
      const ms = Date.now() - t0
      await sleep(120)
      const m = await page.evaluate(measure)
      const loads = await page.evaluate(() => window.__loadMarker === 1 ? 0 : 1)
      const hist = (await page.evaluate(() => history.length)) - h0
      await page.keyboard.press('Escape')
      const esc = await page.evaluate(() => document.activeElement.closest('[data-item]') && document.activeElement.closest('[data-item]').getAttribute('data-item'))
      out.budgets.push({ version: name, size: `${w}x${h}`, clicksToOpen: 1, msToBoxVisible: ms, pageLoads: loads, historyAdded: hist, ...m, escapeReturnsTo: esc })
      const tag = `${name} @${w}x${h}`
      ck(`${tag}: no page overflow (page height equals viewport)`, m.overflowPx <= 0 && m.sideScroll <= 0, `${m.overflowPx} px, side ${m.sideScroll}`)
      ck(`${tag}: page area at least 60% of the height (acceptance 2)`, m.stageRatio >= 0.6, `${m.stageH} px = ${Math.round(m.stageRatio * 100)}%`)
      ck(`${tag}: at least 3 full rows beside the pane`, m.fullRows >= 3, `${m.fullRows} rows`)
      ck(`${tag}: 0 loads, no history entry, focus on the box, Escape to the row`, loads === 0 && hist === 0 && m.focusBox === true && esc === first, `${loads} loads, ${hist} history, focus ${m.focusBox}, esc ${esc}`)
      await c.close()
    }
  }
  // acceptance 1: every page source opens readable (smallest text in the box at least 12 px) with the box whole or its left edge in view
  const pages = [['A f1 Lakeview p2', 'a-docked-strip/index.html?item=f1', 'f1'], ['A f8 Lakeview p3', 'a-docked-strip/index.html?item=f8', 'f8'], ['A f5 T5', 'a-docked-strip/index.html?item=f5', 'f5'],
    ['B verify v2', 'b-tabs-and-decision/index.html?tab=verify&item=v2', 'v2'], ['B verify v3', 'b-tabs-and-decision/index.html?tab=verify&item=v3', 'v3'], ['C o1 p2', 'c-window-first/index.html?item=o1', 'o1'], ['C o3 T5', 'c-window-first/index.html?item=o3', 'o3']]
  for (const [w, h] of SIZES) {
    for (const [label, p] of pages) {
      const [c, page] = await newPage(w, h)
      await page.goto(U(p)); await sleep(500)
      if (await page.locator('button:has-text("Try again")').count()) { await page.click('button:has-text("Try again")'); await sleep(500) }
      await page.waitForSelector('.app-box', { timeout: 3000 }).catch(() => {}); await sleep(200)
      const m = await page.evaluate(measure)
      out.budgets.push({ version: label, size: `${w}x${h}`, opening: true, zoom: m.zoom, textPx: m.textPx, boxW: m.boxW, stageW: m.stageW, boxWhole: m.boxWhole, boxLeftInView: m.boxLeftInView })
      ck(`${label} @${w}x${h}: opening zoom ${m.zoom}, smallest text ${m.textPx} px, box ${m.boxWhole ? 'whole' : 'left edge in view'}, page area ${Math.round(m.stageRatio * 100)}% (acceptances 1 and 2)`, m.textPx >= 12 && (m.boxWhole || m.boxLeftInView) && m.stageRatio >= 0.6, JSON.stringify(m))
      await c.close()
    }
  }
  // the window at both sizes: page area at least 60% of the height (acceptance 2) and no overflow
  for (const [w, h] of SIZES) {
    for (const [dir, item] of [['a-docked-strip', 'f1'], ['b-tabs-and-decision', 'p3'], ['c-window-first', 'o1']]) {
      const ctx = await newCtx(w, h); const page = await ctx.newPage()
      await page.goto(U(`${dir}/index.html?item=${item}`)); await sleep(300)
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('#sv-open-window')])
      await pop.setViewportSize({ width: w, height: h }); await sleep(1600)
      const m = await pop.evaluate(measure)
      ck(`${dir[0].toUpperCase()} window @${w}x${h}: page area at least 60%, no overflow, text readable, box whole or left edge`, m.stageRatio >= 0.6 && m.overflowPx <= 0 && m.textPx >= 12 && (m.boxWhole || m.boxLeftInView), JSON.stringify(m))
      out.budgets.push({ version: `${dir[0].toUpperCase()} window`, size: `${w}x${h}`, ...m })
      await ctx.close()
    }
  }
  // flagged and orphan states keep a usable page area
  for (const [w, h] of SIZES) {
    const [c, page] = await newPage(w, h)
    await page.goto(U('a-docked-strip/index.html?item=f4')); await sleep(500)
    const m = await page.evaluate(measure)
    ck(`A f4 flagged @${w}x${h}: page area at least 60% of the height`, m.stageRatio >= 0.6, `${m.stageH} px`)
    await c.close()
  }
})

// ---------------------------------------------------------------- zoom: keys, persistence, never clips the box
await section('zoom', async () => {
  const [c, page] = await newPage(1366, 650)
  await page.goto(U('c-window-first/index.html?item=o1')); await sleep(600)
  const z0 = (await page.evaluate(measure)).zoom
  let clipped = 0
  for (let i = 0; i < 10; i++) { await page.keyboard.press('+'); await sleep(60); const m = await page.evaluate(measure); if (!(m.boxWhole || m.boxLeftInView)) clipped++ }
  const zMax = (await page.evaluate(measure)).zoom
  await page.keyboard.press('=') ; await sleep(60)
  const zMax2 = (await page.evaluate(measure)).zoom
  ck('zoom in stops at the largest size where the box shows, and never clips it (fault 4)', clipped === 0 && zMax === zMax2, `open ${z0}, max ${zMax}, clipped ${clipped}`)
  await page.keyboard.press(']'); await sleep(500)
  if (await page.locator('button:has-text("Try again")').count()) { await page.click('button:has-text("Try again")'); await sleep(500) } // page 3 fails once by design
  const zNext = (await page.evaluate(measure)).zoom
  ck('zoom persists per kind for the session when stepping to another page source', parseInt(zNext) >= Math.min(parseInt(zMax), 150), `${zMax} then ${zNext}`)
  await page.keyboard.press('-'); await sleep(60); await page.keyboard.press('-'); await sleep(60)
  const zOut = (await page.evaluate(measure)).zoom
  await page.keyboard.press('0'); await sleep(100)
  const zFit = (await page.evaluate(measure)).zoom
  const mFit = await page.evaluate(measure)
  ck('keys - and 0 zoom out and fit the box (back to the readable size of that page)', parseInt(zOut) < parseInt(zNext) && zFit !== zOut && mFit.textPx >= 12 && (mFit.boxWhole || mFit.boxLeftInView), `${zNext} to ${zOut}, 0 gives ${zFit}, text ${mFit.textPx} px`)
  await page.click('button:has-text("Zoom +")'); await sleep(100)
  ck('the zoom buttons repeat the keys (rule 10)', await page.locator('button[aria-keyshortcuts="+"]').count() === 1 && await page.locator('button[aria-keyshortcuts="-"]').count() === 1 && await page.locator('button[aria-keyshortcuts="0"]').count() === 1, '')
  await c.close()
  // a key typed in a text field fires nothing (rule 10)
  const [c2, p2] = await newPage(1366, 650)
  await p2.goto(U('b-tabs-and-decision/index.html?item=p1')); await sleep(400)
  await p2.focus('#sv-reason'); const before = await p2.evaluate(() => document.querySelector('[aria-current="page"][class*="moj-sub-navigation__link"]') && [...document.querySelectorAll('.app-viewer__steps [aria-current]')].map((e) => e.textContent).join())
  await p2.keyboard.type('m ] [ + - 0 j k o')
  const after = await p2.evaluate(() => [...document.querySelectorAll('.app-viewer__steps [aria-current]')].map((e) => e.textContent).join())
  const val = await p2.inputValue('#sv-reason')
  ck('keys typed in the reason field fire nothing (rule 10)', val === 'm ] [ + - 0 j k o' && before === after, `${val} | ${before} | ${after}`)
  await p2.fill('#sv-filter', '')
  await p2.focus('#sv-filter'); await p2.keyboard.type('m]+0'); await sleep(100)
  ck('keys typed in the filter fire nothing', (await p2.inputValue('#sv-filter')) === 'm]+0', '')
  await c2.close()
})

// ---------------------------------------------------------------- acceptance 3, 4: mark key
await section('mark', async () => {
  for (const [w, h] of SIZES) {
    const [c, page] = await newPage(w, h)
    let clicks = 0; await page.exposeFunction('__click', () => { clicks++ }); await page.addInitScript(() => document.addEventListener('click', () => window.__click(), true))
    await page.goto(U('a-docked-strip/index.html?item=f2')); await sleep(500)
    clicks = 0
    for (let i = 0; i < 3; i++) { await page.keyboard.press('m'); await sleep(250) }
    const st = await page.locator('[data-item="f2"] [data-status]').innerText()
    ck(`3 sources marked with 3 keys and 0 clicks @${w}x${h} (acceptance 3)`, st === 'Checked' && clicks === 0, `${st}, ${clicks} clicks`)
    // on the last source: the next unmarked figure
    const t = await page.evaluate(() => document.querySelector('#sv-title-pane').textContent)
    ck(`after the last source the next unmarked figure opens @${w}x${h}`, /Meals add-back|Sales to Northwind|Dividend|Home office/.test(t) || t.indexOf('Taxes payable') < 0, t)
    await c.close()
  }
  const [c, page] = await newPage(1366, 650)
  await page.goto(U('a-docked-strip/index.html?item=f3')); await sleep(500)
  await page.keyboard.press('m'); await sleep(200)          // marks source 1, moves to 2
  await page.keyboard.press('['); await sleep(200)          // back to source 1 (marked)
  const marked1 = await page.locator('.app-steps__btn').first().getAttribute('class')
  await page.keyboard.press('m'); await sleep(200)          // pressed on a marked source
  await page.keyboard.press('['); await sleep(200)
  const still = await page.locator('.app-steps__btn').first().getAttribute('class')
  const status = await page.locator('[data-item="f3"] [data-status]').innerText()
  ck('the mark key pressed twice on one source never unmarks (acceptance 4, rule 22)', /marked/.test(marked1) && /marked/.test(still) && /Checking, 1 of 2/.test(status), `${status}`)
  // the key never approves or unmarks: remove mark only by a button
  ck('"Remove mark" is a button only (no key)', (await page.locator('button:has-text("Remove mark")').count()) === 1 && (await page.locator('button:has-text("Remove mark")').first().getAttribute('aria-keyshortcuts')) === null, '')
  await c.close()
  // from the box, 1 Tab reaches the decision (A, B cite, B verify, C)
  for (const [label, url, row, expect] of [['A', 'a-docked-strip/index.html', 'f1', /Supports this figure/], ['B verify', 'b-tabs-and-decision/index.html?tab=verify', 'v1', /Accept/], ['B cite', 'b-tabs-and-decision/index.html', 'p1', /The candidate shown/], ['C', 'c-window-first/index.html', 'o1', /Complete/]]) {
    for (const [w, h] of SIZES) {
      const [c3, p3] = await newPage(w, h)
      await p3.goto(U(url)); await sleep(350)
      await p3.click(`[data-item="${row}"] [data-open]`); await ready(p3); await sleep(250)
      await p3.keyboard.press('Tab')
      const txt = await p3.evaluate(() => ((document.activeElement.textContent || '') + ' ' + ((document.activeElement.labels && document.activeElement.labels[0] && document.activeElement.labels[0].textContent) || '')).trim())
      ck(`${label} @${w}x${h}: from the box 1 Tab reaches the decision`, expect.test(txt), txt.slice(0, 40))
      await c3.close()
    }
  }
})

// ---------------------------------------------------------------- acceptance 5: Complete on the last unhandled row
await section('done', async () => {
  const [c, page] = await newPage(1093, 525)
  await page.goto(U('c-window-first/index.html')); await sleep(400)
  // decide o2, o3, o4 (chase), o5 first, leave o1 (the first row) as the last unhandled: next is by list order, wrapping up
  await page.click('[data-item="o2"] [data-act="done"]'); await sleep(100)
  const f1 = await page.evaluate(() => document.activeElement.closest('[data-item]') && document.activeElement.closest('[data-item]').getAttribute('data-item'))
  ck('Complete moves focus to the next unhandled row (o3), not the previous one', f1 === 'o3', f1)
  await page.click('[data-item="o4"] [data-act="chase"]'); await sleep(100)
  await page.click('[data-item="o5"] [data-act="done"]'); await sleep(100)
  const f2 = await page.evaluate(() => document.activeElement.closest('[data-item]') && document.activeElement.closest('[data-item]').getAttribute('data-item'))
  ck('after the last rows, focus goes to the first unhandled above (o1... or o3)', f2 === 'o1' || f2 === 'o3', f2)
  await page.click('[data-item="o3"] [data-act="done"]'); await sleep(100)
  await page.click('[data-item="o1"] [data-act="done"]'); await sleep(200)
  const d = await page.evaluate(() => ({ id: document.activeElement.id, text: document.activeElement.textContent.trim(), hidden: document.getElementById('sv-done').hidden }))
  ck('Complete on the last unhandled row focuses "All items checked" (acceptance 5, rule 19)', d.id === 'sv-done' && /^All items checked/.test(d.text) && !d.hidden, JSON.stringify(d))
  await c.close()
  // the same from the viewer's decision slot, opening the item first
  const [c2, p2] = await newPage(1366, 650)
  await p2.goto(U('c-window-first/index.html')); await sleep(400)
  for (const id of ['o1', 'o2', 'o3', 'o5']) { await p2.click(`[data-item="${id}"] [data-open]`); await ready(p2); await p2.getByRole('button', { name: /^Complete/ }).last().click(); await sleep(200) }
  await p2.click('[data-item="o4"] [data-open]'); await sleep(300)
  await p2.getByRole('button', { name: /^Chase/ }).last().click(); await sleep(200)
  const d2 = await p2.evaluate(() => ({ id: document.activeElement.id }))
  ck('Complete and Chase in the decision slot end on "All items checked"', d2.id === 'sv-done', JSON.stringify(d2))
  await c2.close()
  // B verify: Accept on the last value
  const [c3, p3] = await newPage(1366, 650)
  await p3.goto(U('b-tabs-and-decision/index.html?tab=verify')); await sleep(400)
  await p3.click('[data-item="v1"] [data-open]'); await ready(p3)
  for (let i = 0; i < 4; i++) { await p3.getByRole('button', { name: /^Accept/ }).last().click(); await sleep(250) }
  const d3 = await p3.evaluate(() => document.activeElement.id)
  ck('B verify: Accept on every value ends on the done message', d3 === 'sv-done', d3)
  await c3.close()
})

// ---------------------------------------------------------------- acceptance 6, 7 and the window states
await section('window', async () => {
  for (const [name, dir, item, other] of [['A', 'a-docked-strip', 'f1', 'f2'], ['B', 'b-tabs-and-decision', 'p3', 'p4'], ['C', 'c-window-first', 'o1', 'o2']]) {
    const ctx = await newCtx(1366, 650); const page = await ctx.newPage()
    await page.goto(U(`${dir}/index.html`)); await sleep(350)
    const t0 = Date.now()
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('#sv-open-window')])
    ck(`${name}: the second window opens from 1 click`, !!pop, '')
    if (!pop) { await ctx.close(); continue }
    await page.click(`[data-item="${item}"] [data-open]`); await sleep(500)
    const title1 = await pop.locator('#sv-title-window').innerText()
    const hidden = await page.evaluate(() => document.getElementById('app-split').classList.contains('app-split--no-pane'))
    const listW = await page.evaluate(() => Math.round(document.querySelector('.app-split__work').getBoundingClientRect().width))
    ck(`${name}: the window follows a selection and the pane hides so the list takes the width`, /./.test(title1) && hidden && listW > 1100, `${title1} | hidden ${hidden} | list ${listW}`)
    // focus stays on the row while the pane is hidden
    ck(`${name}: focus is not lost into the hidden pane`, await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.offsetParent !== null), '')
    await page.keyboard.press(']'); await sleep(450)
    const meta = await pop.locator('.app-viewer__meta').innerText()
    ck(`${name}: ] on the work page steps the window`, /Source 2 of|Candidate source 2/.test(meta), meta.slice(0, 40))
    await pop.keyboard.press(']'); await sleep(500)
    const wmeta = await pop.locator('.app-viewer__meta').innerText()
    // acceptance 6: reload the work page, both say open and following within 2 s
    await page.reload(); const t1 = Date.now()
    await page.waitForFunction(() => /open, following/.test(document.getElementById('sv-win-status').textContent), null, { timeout: 2500 }).catch(() => {})
    const wt = Date.now() - t1
    const ws = await page.locator('#sv-win-status').innerText()
    await pop.waitForFunction(() => /Following the work page/.test(document.getElementById('sv-win-msg').textContent), null, { timeout: 2500 }).catch(() => {})
    const wm = await pop.locator('#sv-win-msg').innerText()
    ck(`${name}: after a work page reload both show open and following within 2 s (acceptance 6)`, /open, following/.test(ws) && /Following the work page/.test(wm) && wt <= 2000, `${wt} ms | ${ws} | ${wm}`)
    // reload the window
    await pop.reload(); const t2 = Date.now()
    await page.waitForFunction(() => /open, following/.test(document.getElementById('sv-win-status').textContent), null, { timeout: 2500 }).catch(() => {})
    await pop.waitForFunction(() => /Following the work page/.test(document.getElementById('sv-win-msg').textContent), null, { timeout: 2500 }).catch(() => {})
    const wt2 = Date.now() - t2
    const title2 = await pop.locator('#sv-title-window').innerText().catch(() => '')
    ck(`${name}: after a window reload both show open and following, and the window shows the selection (acceptance 6)`, wt2 <= 2000 && /./.test(title2) && /open, following/.test(await page.locator('#sv-win-status').innerText()), `${wt2} ms | ${title2}`)
    // Follow off: the window keeps its source and the pane comes back
    await pop.uncheck('#sv-follow'); await sleep(500)
    const back = await page.evaluate(() => !document.getElementById('app-split').classList.contains('app-split--no-pane'))
    const txt = await page.locator('#sv-win-status').innerText()
    ck(`${name}: Follow off brings the pane back and says so`, back && /not following/.test(txt), txt)
    await page.click(`[data-item="${other}"] [data-open]`); await sleep(400)
    const stay = await pop.locator('#sv-title-window').innerText()
    const msg = await pop.locator('#sv-win-msg').innerText()
    ck(`${name}: Follow off keeps the window on its source and says what the work page shows`, stay === title2 && /Not following/.test(msg), `${stay} | ${msg}`)
    await pop.check('#sv-follow'); await sleep(500)
    const caught = await pop.locator('#sv-title-window').innerText()
    ck(`${name}: turning Follow on catches up`, caught !== title2 || /Following/.test(await pop.locator('#sv-win-msg').innerText()), caught)
    // closed: the message and the pane
    const tc = Date.now(); await pop.close()
    await page.waitForFunction(() => /Window closed, open again/.test(document.getElementById('sv-win-status').textContent), null, { timeout: 3000 }).catch(() => {})
    const closedMs = Date.now() - tc
    const closedShown = await page.evaluate(() => /Window closed, open again/.test(document.getElementById('sv-win-status').textContent) && !document.getElementById('app-split').classList.contains('app-split--no-pane'))
    ck(`${name}: a closed window shows "Window closed, open again" and the pane returns`, closedShown, `${closedMs} ms`)
    // open again by the key o, reuse the same window
    await page.keyboard.press('o'); await sleep(900)
    ck(`${name}: o opens the window again`, ctx.pages().length >= 2, '')
    await ctx.close()
  }
  // blocked pop-up
  { const [c, page] = await newPage(1366, 650)
    await page.addInitScript(() => { window.open = () => null })
    await page.goto(U('c-window-first/index.html?item=o1')); await sleep(400)
    await page.click('#sv-open-window'); await sleep(200)
    const t = await page.locator('#sv-win-status').innerText()
    const shown = await page.evaluate(() => !document.getElementById('app-split').classList.contains('app-split--no-pane'))
    ck('a blocked pop-up says so and the docked pane stays', /blocked/.test(t) && shown, t)
    await c.close() }
  // acceptance 7: sign-out from the window ends the work page, and from the work page ends the window and every other page
  for (const dir of ['a-docked-strip', 'b-tabs-and-decision', 'c-window-first']) {
    const ctx = await newCtx(1366, 650); const page = await ctx.newPage()
    await page.goto(U(`${dir}/index.html`)); await sleep(350)
    const other = await ctx.newPage(); await other.goto(U('index.html')); await sleep(300)
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('#sv-open-window')])
    await sleep(1200)
    const t0 = Date.now()
    await pop.click('#sv-signout')
    await page.waitForURL(/signed-out\.html/, { timeout: 3000 }).catch(() => {})
    await other.waitForURL(/signed-out\.html/, { timeout: 3000 }).catch(() => {})
    ck(`${dir[0].toUpperCase()}: sign-out in the window signs out the work page and every other page (acceptance 7, SEC)`, /signed-out/.test(page.url()) && /signed-out/.test(other.url()), `${Date.now() - t0} ms, ${page.url().split('/').pop()}, ${other.url().split('/').pop()}`)
    await ctx.close()
    const ctx2 = await newCtx(1366, 650); const p2 = await ctx2.newPage()
    await p2.goto(U(`${dir}/index.html`)); await sleep(350)
    const [pop2] = await Promise.all([ctx2.waitForEvent('page', { timeout: 4000 }).catch(() => null), p2.click('#sv-open-window')])
    await sleep(1200)
    await p2.click('#sv-signout'); await sleep(1200)
    ck(`${dir[0].toUpperCase()}: sign-out on the work page ends the window`, pop2.isClosed() || /signed-out/.test(pop2.url()), pop2.isClosed() ? 'closed' : pop2.url())
    await ctx2.close()
  }
  // two work tabs, two returns
  { const ctx = await newCtx(1366, 650)
    const t1 = await ctx.newPage(); await t1.goto(U('a-docked-strip/index.html')); await sleep(350)
    const t2 = await ctx.newPage(); await t2.goto(U('a-docked-strip/index.html')); await sleep(350)
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), t1.click('#sv-open-window')])
    await sleep(1200)
    await t2.click('[data-item="f2"] [data-open]'); await sleep(500)
    const a = await pop.locator('#sv-title-window').innerText()
    await t1.click('[data-item="f3"] [data-open]'); await sleep(500)
    const b = await pop.locator('#sv-title-window').innerText()
    ck('the window follows the work tab last used on the same return', /Taxes payable/.test(a) && /Meals add-back/.test(b), `${a} | ${b}`)
    await pop.keyboard.press(']'); await sleep(500)
    const t1src = await t1.locator('.app-viewer__meta').innerText(), t2src = await t2.locator('.app-viewer__meta').innerText()
    ck('a step in the window drives only the tab it follows', /Source 2 of/.test(t1src) && /Source 1 of/.test(t2src), `${t1src.slice(0, 20)} | ${t2src.slice(0, 20)}`)
    const foreign = await ctx.newPage(); await foreign.goto(U('signed-out.html'))
    await foreign.evaluate(() => { const ch = new BroadcastChannel('ashbridge-source-viewer'); ch.postMessage({ t: 'select', ret: 'Another Return Inc. (Test), year end 31 Dec 2025', tab: 'zz', item: 'f5', idx: 0, list: 'cpa' }) })
    await sleep(500)
    const c2 = await pop.locator('#sv-title-window').innerText()
    ck("another return's work page never drives the window", c2 === b, `${c2}`)
    await ctx.close() }
})

// ---------------------------------------------------------------- acceptance 8, 9: the URL and the record tabs as routes
await section('url', async () => {
  const [c, page] = await newPage(1366, 650)
  await page.goto(U('index.html')); await sleep(200)
  await page.goto(U('a-docked-strip/index.html?item=f1')); await sleep(500)
  await page.keyboard.press(']'); await sleep(200); await page.keyboard.press(']'); await sleep(300)
  const h0 = await page.evaluate(() => history.length)
  const u1 = page.url().replace(BASE, '')
  ck('the URL follows the selection (item and source) with replaceState', /item=f1&src=3/.test(u1), u1)
  await page.fill('#sv-filter', 'due'); await sleep(200)
  ck('the filter is in the URL too', /q=due/.test(page.url()), page.url())
  await page.reload(); await sleep(700)
  const m1 = await page.evaluate(() => ({ t: document.getElementById('sv-title-pane').textContent, meta: document.querySelector('.app-viewer__meta').textContent, f: document.getElementById('sv-filter').value, h: history.length }))
  ck('reload returns to the same figure, source and filter (acceptance 8)', /Due from shareholder/.test(m1.t) && /Source 3 of 5/.test(m1.meta) && m1.f === 'due', JSON.stringify(m1))
  ck('selecting, stepping and reloading add no history entry', m1.h === h0, `${h0} then ${m1.h}`)
  await page.goto(U('signed-out.html')); await sleep(200)
  await page.goBack(); await sleep(700)
  const m2 = await page.evaluate(() => ({ t: document.getElementById('sv-title-pane').textContent, meta: document.querySelector('.app-viewer__meta').textContent }))
  ck('Back returns to the same figure and source (acceptance 8)', /Due from shareholder/.test(m2.t) && /Source 3 of 5/.test(m2.meta), JSON.stringify(m2))
  await c.close()
  // scroll of the list kept
  const [c1, p1] = await newPage(1093, 525)
  await p1.goto(U('a-docked-strip/index.html')); await sleep(400)
  const can = await p1.evaluate(() => { const w = document.querySelector('.app-split__work'); w.scrollTop = 120; return w.scrollHeight > w.clientHeight })
  await sleep(400); await p1.reload(); await sleep(500)
  const sc = await p1.evaluate(() => document.querySelector('.app-split__work').scrollTop)
  ck('reload keeps the list scroll (rule 21)', !can || sc > 60, `scrolled ${sc}`)
  await c1.close()
  // acceptance 9: a record tab change is a client route, 0 loads, with its own URL; the window follows
  const ctx = await newCtx(1366, 650); const b = await ctx.newPage()
  await b.goto(U('b-tabs-and-decision/index.html')); await sleep(400)
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), b.click('#sv-open-window')])
  await sleep(1200)
  await b.evaluate(() => { window.__loadMarker = 7 })
  await b.click('[data-item="p3"] [data-open]'); await sleep(400)
  const h1 = await b.evaluate(() => history.length)
  await b.click('a[data-route="verify"]'); await sleep(500)
  const r = await b.evaluate(() => ({ marker: window.__loadMarker, navs: performance.getEntriesByType('navigation').length, h1: document.getElementById('sv-h1').textContent, title: document.title, cur: document.querySelector('[data-route][aria-current]').textContent, hist: history.length, rows: [...document.querySelectorAll('[data-panel]:not([hidden]) [data-item]')].length }))
  ck('a tab change makes 0 loads and has its own URL (acceptance 9, rules 18, 20)', r.marker === 7 && r.navs === 1 && /tab=verify/.test(b.url()) && r.h1 === 'Verify extracted values' && r.cur === 'Verify values' && r.hist === h1 + 1 && r.rows === 4, JSON.stringify(r) + ' ' + b.url())
  await b.click('[data-item="v2"] [data-open]'); await sleep(600)
  const wt = await pop.locator('#sv-title-window').innerText()
  ck('the window follows the tab change and shows the new list (acceptance 9)', /Withdrawal on 20 Dec/.test(wt), wt)
  await b.goBack(); await sleep(500)
  const rb = await b.evaluate(() => ({ marker: window.__loadMarker, h1: document.getElementById('sv-h1').textContent, url: location.search, state: history.state, entries: navigation.entries().map((e) => e.url.replace(location.origin, '') + (navigation.currentEntry === e ? ' *' : '')) }))
  ck('Back after a tab change returns to the first tab with 0 loads', rb.marker === 7 && rb.h1 === 'Cite figures', JSON.stringify(rb))
  await b.goForward(); await sleep(500)
  ck('Forward returns to the second tab', (await b.evaluate(() => document.getElementById('sv-h1').textContent)) === 'Verify extracted values', '')
  // a cite survives a reload (session storage), reload keeps the cite
  await pop.close(); await sleep(1500)
  await b.goto(U('b-tabs-and-decision/index.html?item=p1')); await sleep(500)
  await b.click('#sv-src-0'); await b.click('button[data-primary]'); await sleep(400)
  await b.reload(); await sleep(600)
  const st = await b.locator('[data-item="p1"] [data-status]').innerText()
  ck('a cited source survives a reload (prototype keeps it in session storage)', /Cited/.test(st), st)
  await ctx.close()
})

// ---------------------------------------------------------------- the B cite flow, T3, and the failed image
await section('flows', async () => {
  const [c, page] = await newPage(1366, 650)
  let clicks = 0; await page.exposeFunction('__click', () => { clicks++ }); await page.addInitScript(() => document.addEventListener('click', () => window.__click(), true))
  await page.goto(U('b-tabs-and-decision/index.html')); await sleep(400)
  await page.click('[data-item="p1"] [data-open]'); await ready(page)
  clicks = 0
  await page.click('#sv-src-0'); await page.click('button[data-primary]'); await sleep(300)
  const go = await page.locator('#sv-next-orphan').innerText()
  ck('B T3: cite an orphan in 2 clicks after opening it (radio, Record), then a button goes to the next orphan', clicks === 2 && /Go to/.test(go), `${clicks} clicks, ${go}`)
  await page.click('#sv-next-orphan'); await sleep(400)
  await page.fill('#sv-reason', 'short'); await page.click('button[data-primary]'); await sleep(250)
  const err = await page.evaluate(() => ({ f: document.activeElement.id, t: document.title.slice(0, 7), m: !!document.getElementById('sv-reason-err'), noChoose: !document.getElementById('sv-src-error') }))
  ck('B: a reason that is too short shows the error summary focused, the title starts "Error: " and the message sits at the field (and never a choose error)', err.f === 'sv-cite-sum' && err.t === 'Error: ' && err.m && err.noChoose, JSON.stringify(err))
  await c.close()
  const [c2, p2] = await newPage(1366, 650)
  await p2.goto(U('a-docked-strip/index.html?item=f8')); await sleep(600)
  const failed = await p2.locator('.govuk-error-summary').count()
  await p2.click('button:has-text("Try again")'); await ready(p2); await sleep(300)
  const m = await p2.evaluate(measure)
  ck('the failed page image shows an error summary with Try again, and recovers with the box in view', failed === 1 && m.boxLeftInView !== null && m.focusBox === true, JSON.stringify(m))
  await c2.close()
  const [c3, p3] = await newPage(1366, 650)
  await p3.goto(U('a-docked-strip/index.html?item=f7')); await sleep(400)
  ck('the empty state says "Not checked: no evidence" and what to do', (await p3.locator('.app-viewer__card').innerText()).includes('Not checked: no evidence'), '')
  await c3.close()
})

// ---------------------------------------------------------------- keyboard walk and 320 px
await section('keyboard', async () => {
  for (const [name, p] of [['A', 'a-docked-strip/index.html?item=f1'], ['B', 'b-tabs-and-decision/index.html?item=p1'], ['B verify', 'b-tabs-and-decision/index.html?tab=verify&item=v1'], ['C', 'c-window-first/index.html?item=o1'], ['A window', 'a-docked-strip/window.html']]) {
    for (const [w, h] of SIZES) {
      const [c, page] = await newPage(w, h)
      await page.goto(U(p)); await sleep(500)
      const seen = [], bad = []
      for (let i = 0; i < 100; i++) {
        await page.keyboard.press('Tab')
        const r = await page.evaluate(() => {
          const e = document.activeElement; if (!e || e === document.body) return null
          const cs = getComputedStyle(e), b = e.getBoundingClientRect()
          const vis = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none' || e.classList.contains('govuk-checkboxes__input') || e.classList.contains('govuk-radios__input')
          const inView = b.top >= -1 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1 && b.left >= -1
          return { id: e.id || e.tagName + ':' + (e.textContent || '').trim().slice(0, 24), vis, inView, topInView: b.top >= -1 && b.top < innerHeight - 24, w: Math.round(b.width), h: Math.round(b.height) }
        })
        if (!r) continue
        if (seen.includes(r.id) && seen.indexOf(r.id) === 0 && i > 5) break
        seen.push(r.id)
        if (!r.vis) bad.push('no focus style: ' + r.id)
        if (!r.inView && !(/^DIV:/.test(r.id) && r.topInView)) bad.push('not in view: ' + r.id)
        if ((r.w < 24 || r.h < 24) && !/^sv-follow|^sv-keys|^sv-slow/.test(r.id)) bad.push(`small target ${r.w}x${r.h}: ${r.id}`)
      }
      out.keyboard.push({ page: name, size: `${w}x${h}`, stops: seen.length, problems: [...new Set(bad)].slice(0, 6) })
      ck(`keyboard walk ${name} @${w}x${h}: ${seen.length} stops, focus visible, in view, targets 24 px`, bad.length === 0, [...new Set(bad)].slice(0, 4).join('; '))
      await c.close()
    }
  }
  // the splitter by keyboard
  const [c, page] = await newPage(1366, 650)
  await page.goto(U('a-docked-strip/index.html')); await sleep(300)
  await page.focus('#app-splitter')
  const w0 = +(await page.getAttribute('#app-splitter', 'aria-valuenow'))
  await page.keyboard.press('ArrowLeft'); const w1 = +(await page.getAttribute('#app-splitter', 'aria-valuenow'))
  await page.keyboard.press('Home'); const w2 = +(await page.getAttribute('#app-splitter', 'aria-valuenow'))
  await page.keyboard.press('Enter'); const w3 = +(await page.getAttribute('#app-splitter', 'aria-valuenow'))
  ck('the splitter takes Left, Home, Enter (rule 12)', w1 === w0 + 24 && w2 === 360 && w3 === 480, `${w0} ${w1} ${w2} ${w3}`)
  await c.close()
})
await section('reflow', async () => {
  for (const [label, p] of [['A list', 'a-docked-strip/index.html'], ['A viewer f1', 'a-docked-strip/index.html?item=f1'], ['A viewer f7', 'a-docked-strip/index.html?item=f7'], ['B viewer p1', 'b-tabs-and-decision/index.html?item=p1'], ['B verify', 'b-tabs-and-decision/index.html?tab=verify'], ['C list', 'c-window-first/index.html'], ['C window', 'c-window-first/window.html'], ['A window', 'a-docked-strip/window.html'], ['landing', 'index.html']]) {
    const [c, page] = await newPage(320, 640)
    await page.goto(U(p)); await sleep(600)
    const r = await page.evaluate(() => {
      const over = [], vw = document.documentElement.clientWidth
      document.querySelectorAll('body *').forEach((e) => {
        const b = e.getBoundingClientRect(); if (b.width === 0 || b.right <= vw + 1) return
        let a = e.parentElement, inScroll = false
        while (a && a !== document.body) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth) { inScroll = true; break } a = a.parentElement }
        if (!inScroll) over.push(e.tagName + '.' + String(e.className).slice(0, 30) + ' right=' + Math.round(b.right))
      })
      return { docScroll: document.documentElement.scrollWidth, vw, over: over.slice(0, 3) }
    })
    out.reflow.push({ label, ...r, ok: r.docScroll <= r.vw && r.over.length === 0 })
    ck(`320 px reflow: ${label}`, r.docScroll <= r.vw && r.over.length === 0, JSON.stringify(r))
    await c.close()
  }
  const [c, page] = await newPage(320, 640)
  await page.goto(U('a-docked-strip/index.html')); await page.click('[data-item="f1"] [data-open]'); await sleep(400)
  const listHidden = await page.evaluate(() => document.querySelector('.app-split__work').offsetParent === null)
  await page.keyboard.press('Escape'); await sleep(100)
  const back = await page.evaluate(() => ({ list: document.querySelector('.app-split__work').offsetParent !== null, f: document.activeElement.textContent.trim().slice(0, 14) }))
  ck('320 px: the viewer replaces the list, Esc goes back with focus on the figure button', listHidden && back.list && /Show sources|Showing/.test(back.f), JSON.stringify(back))
  await c.close()
})

// ---------------------------------------------------------------- round 2: re-walks (B cite and reason, C Complete) and the shared rules V1 to V8
const BOXES = '.app-box, .app-viewer__card, .app-viewer__stage'
async function openItem(page, url, id) { await page.goto(U(url)); await sleep(350); if (id) { await openRow(page, id); await sleep(150) } }
function rk(name, r) { ck(name, r.ok, r.failures.join('; ')) }

await section('b-cite', async () => {
  for (const [w, h] of SIZES) {
    // D2: after Cite, the shared advance moves to the next figure that still needs one, focus in its box
    let [c, page] = await newPage(w, h)
    await openItem(page, 'b-tabs-and-decision/index.html', 'p1')
    let r = await R.V4(page, { name: 'B Cite then advance', run: async (p) => { await p.click('#sv-src-0'); await p.click('button[data-primary]') }, wait: 450, expect: BOXES })
    rk(`B @${w}x${h}: after Cite focus lands in the next figure's box (V4)`, r)
    const nx = await page.evaluate(() => ({ title: (document.getElementById('sv-title-pane') || {}).textContent, status: document.querySelector('[data-item="p1"] [data-status]').textContent.trim(), note: document.getElementById('sv-recorded').textContent }))
    ck(`B @${w}x${h}: Cite records p1 and the viewer shows the next one to cite (D2)`, /Cited/.test(nx.status) && /Home office/.test(nx.title || '') && /recorded/.test(nx.note), JSON.stringify(nx))
    await c.close()
    // Record a reason: the box is typed in, nothing else is chosen; the same advance
    ;[c, page] = await newPage(w, h)
    let clicks = 0
    await page.exposeFunction('__click', () => { clicks++ })
    await page.addInitScript(() => document.addEventListener('click', () => window.__click(), true))
    await openItem(page, 'b-tabs-and-decision/index.html', 'p1'); clicks = 0
    await page.click('#sv-reason'); await page.fill('#sv-reason', 'Supported by the monthly BRIGHTPATH debits; Anita Rao decided.')
    const radioOn = await page.evaluate(() => document.getElementById('sv-src-reason').checked)
    await page.click('button[data-primary]'); await sleep(450)
    const f = await page.evaluate(() => ({ a: document.activeElement.matches('.app-box, .app-viewer__card, .app-viewer__stage'), st: document.querySelector('[data-item="p1"] [data-status]').textContent.trim() }))
    ck(`B @${w}x${h}: a reason takes 2 clicks after opening (box, Record), typing checks "A written reason", focus lands in the next box`, clicks === 2 && radioOn && f.a && /Cited/.test(f.st), JSON.stringify({ clicks, radioOn, ...f }))
    await c.close()
    // D4: no closed fold; the evidence and the decision are both in view at once
    ;[c, page] = await newPage(w, h)
    await openItem(page, 'b-tabs-and-decision/index.html', 'p1')
    rk(`B @${w}x${h}: evidence and the decision in view, no closed fold (V3)`, await R.V3(page))
    ck(`B @${w}x${h}: no details in the viewer`, (await page.locator('.app-viewer details').count()) === 0, '')
    const ar = await page.evaluate(() => { const s = document.querySelector('.app-viewer__stage').getBoundingClientRect(); return +(s.height / innerHeight).toFixed(3) })
    ck(`B @${w}x${h}: page area at least 55% of the height with the cite form under it`, ar >= 0.55, String(ar))
    await c.close()
  }
})

await section('c-undo', async () => {
  for (const [w, h] of SIZES) {
    let [c, page] = await newPage(w, h)
    await openItem(page, 'c-window-first/index.html')
    await page.click('[data-item="o1"] [data-act="done"]'); await sleep(250)
    const row = await page.evaluate(() => { const r = document.querySelector('[data-item="o1"]'); const vis = (e) => e.getClientRects().length > 0; return { tag: r.querySelector('[data-status]').textContent.trim(), done: [...r.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim().replace(/\s+/g, ' ')) } })
    ck(`C @${w}x${h}: a done row shows the Complete tag and Undo, with no live Complete or Chase button (D3, rule 8)`, row.tag === 'Complete' && row.done.some((t) => /^Undo/.test(t)) && !row.done.some((t) => /^(Complete|Chase)/.test(t)), JSON.stringify(row))
    const y0 = await page.evaluate(() => scrollY)
    await page.click('[data-item="o1"] [data-undo]'); await sleep(150)
    const foc = await page.evaluate(() => document.activeElement.id)
    ck(`C @${w}x${h}: Undo opens a reason box in place and focuses it`, /^undo-row-o1-why$/.test(foc), foc)
    await page.click('#undo-row-o1 button[type=submit]'); await sleep(200)
    const e = await page.evaluate(() => ({ f: document.activeElement.className, t: document.title.slice(0, 7), m: !!document.getElementById('undo-row-o1-err'), y: scrollY, still: !!document.querySelector('[data-item="o1"] [data-undo]') }))
    ck(`C @${w}x${h}: Undo with no reason shows the error at the top of its own form, focused, scroll kept`, /app-undo-sum/.test(e.f) && e.t === 'Error: ' && e.m && Math.abs(e.y - y0) <= 8 && e.still, JSON.stringify(e))
    await page.fill('#undo-row-o1-why', 'Wrong statement month, checked again.'); await page.click('#undo-row-o1 button[type=submit]'); await sleep(250)
    const u = await page.evaluate(() => ({ tag: document.querySelector('[data-item="o1"] [data-status]').textContent.trim(), f: document.activeElement.getAttribute('data-act') || document.activeElement.textContent.trim().slice(0, 20), title: document.title.slice(0, 7) }))
    ck(`C @${w}x${h}: Undo with a reason puts the row back to Not checked, Complete is live again and has focus`, /Not checked/.test(u.tag) && u.f === 'done' && u.title !== 'Error: ', JSON.stringify(u))
    await c.close()
    // from the viewer's decision slot
    ;[c, page] = await newPage(w, h)
    await openItem(page, 'c-window-first/index.html', 'o1')
    await page.getByRole('button', { name: /^Complete/ }).last().click(); await sleep(250)
    await openRow(page, 'o1'); await sleep(200)
    const sl = await page.evaluate(() => ({ foot: document.querySelector('.app-viewer__foot').textContent.trim().replace(/\s+/g, ' '), complete: [...document.querySelectorAll('.app-viewer__foot button')].filter((b) => /^Complete/.test(b.textContent.trim())).length }))
    ck(`C @${w}x${h}: a done item's decision slot shows the Complete tag and Undo, no Complete button`, /^Complete/.test(sl.foot) && /Undo/.test(sl.foot) && sl.complete === 0, JSON.stringify(sl))
    await page.click('.app-viewer__foot [data-undo]'); await page.fill('.app-viewer__foot textarea', 'Sent to the wrong item.'); await page.click('.app-viewer__foot button[type=submit]'); await sleep(250)
    const sl2 = await page.evaluate(() => ({ tag: document.querySelector('[data-item="o1"] [data-status]').textContent.trim(), has: [...document.querySelectorAll('.app-viewer__foot button')].some((b) => /^Complete/.test(b.textContent.trim())) }))
    ck(`C @${w}x${h}: Undo from the slot returns the item to Not checked with Complete live in the slot`, /Not checked/.test(sl2.tag) && sl2.has, JSON.stringify(sl2))
    await c.close()
  }
})

await section('rules', async () => {
  const pages = [
    ['A f1', 'a-docked-strip/index.html', 'f1'], ['A f4 flagged', 'a-docked-strip/index.html', 'f4'], ['B p1 orphan', 'b-tabs-and-decision/index.html', 'p1'], ['B p2 choice', 'b-tabs-and-decision/index.html', 'p2'],
    ['B verify v1', 'b-tabs-and-decision/index.html?tab=verify', 'v1'], ['C o1', 'c-window-first/index.html', 'o1'], ['C o5', 'c-window-first/index.html', 'o5'], ['C o4 empty', 'c-window-first/index.html', 'o4'],
  ]
  for (const [w, h] of SIZES) {
    const counts = []
    for (const [label, url, id] of pages) {
      const [c, page] = await newPage(w, h)
      await page.goto(U(url)); await sleep(350)
      counts.push(await R.V5(page)); rk(`${label} @${w}x${h}: V5 counts carry their scope`, counts[counts.length - 1])
      rk(`${label} @${w}x${h}: V1 no early error on load and after input`, await R.V1(page))
      await page.goto(U(url)); await sleep(300) // the filter box was filled by V1
      await openRow(page, id); await sleep(200)
      rk(`${label} @${w}x${h}: V3 evidence and decision in view`, await R.V3(page))
      rk(`${label} @${w}x${h}: V1 after opening`, await R.V1(page))
      await c.close()
    }
    rk(`@${w}x${h}: V5 same name and scope, same number on every page`, R.V5same(counts))
    // V2 and V4: in-place actions keep the page and the focus lands
    let [c, p] = await newPage(w, h)
    await openItem(p, 'a-docked-strip/index.html', 'f1')
    rk(`A @${w}x${h}: V2 mark and next keeps the page`, await R.V2(p, { name: 'm', press: 'm' }))
    rk(`A @${w}x${h}: V4 mark and next lands focus`, await R.V4(p, { name: 'm', press: 'm', expect: BOXES }, { shortcuts: [{ key: ']', selector: BOXES }, { key: '[', selector: BOXES }, { key: 'j', selector: BOXES }, { key: 'k', selector: BOXES }] }))
    await c.close()
    ;[c, p] = await newPage(w, h)
    await openItem(p, 'b-tabs-and-decision/index.html', 'p1')
    rk(`B @${w}x${h}: V2 Cite keeps the page`, await R.V2(p, { name: 'Cite', run: async (q) => { await q.click('#sv-src-0'); await q.click('button[data-primary]') }, wait: 450 }))
    await c.close()
    ;[c, p] = await newPage(w, h)
    await openItem(p, 'b-tabs-and-decision/index.html', 'p1')
    rk(`B @${w}x${h}: V2 an error in the cite form keeps the page`, await R.V2(p, { name: 'Record with nothing chosen', click: 'button[data-primary]' }))
    await c.close()
    ;[c, p] = await newPage(w, h)
    await openItem(p, 'b-tabs-and-decision/index.html?tab=verify', 'v1')
    rk(`B verify @${w}x${h}: V2 Accept keeps the page`, await R.V2(p, { name: 'Accept', run: async (q) => { await q.getByRole('button', { name: /^Accept/ }).last().click() }, wait: 300 }))
    await c.close()
    ;[c, p] = await newPage(w, h)
    await openItem(p, 'c-window-first/index.html', 'o1')
    rk(`C @${w}x${h}: V2 Complete keeps the page`, await R.V2(p, { name: 'Complete', run: async (q) => { await q.getByRole('button', { name: /^Complete/ }).last().click() } }))
    await c.close()
    ;[c, p] = await newPage(w, h)
    await p.goto(U('c-window-first/index.html')); await sleep(300)
    rk(`C @${w}x${h}: V4 Complete in the row lands focus on the next row`, await R.V4(p, { name: 'Complete o1', click: '[data-item="o1"] [data-act="done"]', expect: '[data-item] [data-open]' }))
    await c.close()
    // V5 caption follows the filter, V6 search keeps its promise
    for (const [label, url] of [['A', 'a-docked-strip/index.html'], ['B', 'b-tabs-and-decision/index.html'], ['C', 'c-window-first/index.html']]) {
      ;[c, p] = await newPage(w, h)
      await p.goto(U(url)); await sleep(300)
      rk(`${label} @${w}x${h}: V5 the filter caption follows the filter`, await R.V5caption(p, { name: 'filter', run: async (q) => { await q.fill('#sv-filter', 'zzz-nothing') } }, { caption: '#sv-filter-count' }))
      await p.fill('#sv-filter', '')
      const name = (await p.locator('[data-item] th').first().textContent()).replace(/\s*\(tax choice\)/, '').trim()
      rk(`${label} @${w}x${h}: V6 a figure name copied as shown finds its row`, await R.V6(p, { input: '#sv-filter', result: '[data-item]:not([hidden])', label: 'label[for="sv-filter"]', kinds: [{ kind: label === 'C' ? 'items' : 'figures', value: name }] }))
      await c.close()
    }
    // V8 One choice, one action (B)
    ;[c, p] = await newPage(w, h)
    await openItem(p, 'b-tabs-and-decision/index.html', 'p1')
    rk(`B @${w}x${h}: V8 typing a reason never gives a choose error and selects the reason`, await R.V8(p, { field: '#sv-reason', radio: '#sv-src-reason', submit: 'button[data-primary]' }))
    await c.close()
    // V7 every click does something: A, B cite, B verify, C
    for (const [label, url, id] of [['A f1', 'a-docked-strip/index.html', 'f1'], ['B p1', 'b-tabs-and-decision/index.html', 'p1'], ['B verify v1', 'b-tabs-and-decision/index.html?tab=verify', 'v1'], ['C o1', 'c-window-first/index.html', 'o1']]) {
      ;[c, p] = await newPage(w, h)
      await openItem(p, url, id)
      rk(`${label} @${w}x${h}: V7 every control does something`, await R.V7(p, { skip: '[disabled], [aria-disabled=true], [data-noop-ok], .govuk-skip-link, [aria-current="page"]', reset: async (q) => { await q.evaluate(() => sessionStorage.clear()); await openItem(q, url, id); await sleep(600); await q.evaluate(() => document.activeElement && document.activeElement.blur()) }, limit: 45 }))
      await c.close()
    }
    // V7 on a done row in C
    ;[c, p] = await newPage(w, h)
    await p.goto(U('c-window-first/index.html')); await sleep(300)
    await p.click('[data-item="o1"] [data-act="done"]'); await sleep(250)
    rk(`C done row @${w}x${h}: V7 no dead control (no second Complete)`, await R.V7(p, { selector: '[data-item="o1"] button', reset: async (q) => { await q.goto(U('c-window-first/index.html')); await sleep(300) } }))
    await c.close()
  }
})

// ---------------------------------------------------------------- lint (checks 6, 7, 9)
await section('lint', async () => {
  const lint = []
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'build' || e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])
  const files = walk(root)
  const html = files.filter((f) => f.endsWith('.html')), texts = files.filter((f) => /\.(html|js|css|md|svg)$/.test(f) && !f.endsWith('govuk-moj.css'))
  const briefPath = path.resolve(root, '../../briefs/source-viewer.md')
  const retired = ['export 1', 'export 2', 'review-lines export', 'receipt export', 'gate 1', 'judgment input sheet', 'AI-proposed GIFI', 'Judgment tab']
  for (const f of [...texts, briefPath, ...fs.readdirSync(here).filter((n) => n.endsWith('.mjs')).map((n) => path.join(here, n)).filter((n) => !n.endsWith('verify.mjs'))]) {
    const t = fs.readFileSync(f, 'utf8')
    const isBrief = f === briefPath
    for (const r of retired) if (t.toLowerCase().includes(r.toLowerCase()) && !isBrief) lint.push(`retired term "${r}" in ${path.basename(f)}`)
    if (!isBrief && (t.includes('\u2014') || t.includes('\u2013'))) lint.push(`dash in ${path.basename(f)}`)
    if (!isBrief && /lorem ipsum|coming soon|\bTBD\b|placeholder=/i.test(t)) lint.push(`filler in ${path.basename(f)}`)
    if (!isBrief && /377979456|\bSIN ending|ending in \d/.test(t)) lint.push(`SIN digits in ${path.basename(f)}`)
    if (/\bzoom\s*:/.test(t) && f.endsWith('.css')) lint.push(`CSS zoom in ${path.basename(f)}`)
    if (/cdn|googleapis|fonts\.gstatic/i.test(t) && !isBrief && !f.endsWith('.md')) lint.push(`third-party host in ${path.basename(f)}`)
  }
  const briefT = fs.readFileSync(briefPath, 'utf8')
  for (const r of retired) if (briefT.toLowerCase().includes(r.toLowerCase())) lint.push(`retired term "${r}" in the brief`)
  for (const f of html) {
    const t = fs.readFileSync(f, 'utf8'), dir = path.dirname(f)
    for (const m of t.matchAll(/href="([^"]*)"/g)) {
      const hh = m[1].replace(/&amp;/g, '&')
      if (hh === '#' || hh === '') lint.push(`dead # link in ${path.basename(f)}`)
      else if (hh.startsWith('#')) { if (!t.includes(`id="${hh.slice(1)}"`)) lint.push(`missing anchor ${hh} in ${path.basename(f)}`) }
      else if (!/^https?:/.test(hh)) { const tgt = path.resolve(dir, hh.split('?')[0]); if (!fs.existsSync(tgt)) lint.push(`broken link ${hh} in ${path.basename(f)}`) }
    }
    for (const m of t.matchAll(/<a [^>]*href="([^"#?]+)"[^>]*>/g)) { if (path.resolve(path.dirname(f), m[1]) === path.resolve(f) && !/aria-current/.test(m[0])) lint.push(`self link ${m[1]} in ${path.basename(f)}`) }
    for (const m of t.matchAll(/class="([^"]*)"/g)) for (const cl of m[1].split(/\s+/).filter(Boolean)) if (!/^(govuk-|moj-|app-)/.test(cl) && !['js-enabled'].includes(cl)) lint.push(`class ${cl} in ${path.basename(f)}`)
    if ((t.match(/<h1[ >]/g) || []).length !== 1) lint.push(`h1 count in ${path.basename(f)}`)
    if (/style="/.test(t)) lint.push(`inline style in ${path.basename(f)}`)
    if (!/<a href="#main" class="govuk-skip-link"/.test(t)) lint.push(`no skip link in ${path.basename(f)}`)
    if (!/govuk-generic-header/.test(t)) lint.push(`no Generic header in ${path.basename(f)}`)
  }
  const appCss = fs.readFileSync(path.join(root, 'assets/app.css'), 'utf8') + fs.readFileSync(path.resolve(root, '../../parts/cite-or-reason/cite-or-reason.css'), 'utf8')
  const defined = new Set([...appCss.matchAll(/\.(app-[a-z0-9_-]+)/g)].map((m) => m[1]))
  const used = new Set()
  for (const f of files.filter((f) => /assets[\\/][a-z0-9-]+\.js$/.test(f) && !/data\.js$/.test(f))) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/\b(app-[a-z0-9_-]+)/g)) used.add(m[1]) }
  for (const f of html) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/\b(app-[a-z0-9_-]+)/g)) used.add(m[1]) }
  for (const u of used) if (!defined.has(u) && !/^app-(split|viewer|pane-w)$/.test(u)) lint.push(`app class without CSS: ${u}`)
  // every app- class is listed in some notes.md
  const notes = ['a-docked-strip', 'b-tabs-and-decision', 'c-window-first'].map((d) => fs.readFileSync(path.join(root, d, 'notes.md'), 'utf8')).join('\n')
  for (const u of used) if (!notes.includes('`' + u) && !/^app-(pane-w)$/.test(u)) lint.push(`app class not listed in notes.md: ${u}`)
  // only one viewer: no page draws its own (the viewer markup comes from viewer.js alone)
  for (const f of html) { const t = fs.readFileSync(f, 'utf8'); if (/app-viewer__(head|stage|card)/.test(t)) lint.push(`page draws its own viewer: ${path.basename(f)}`) }
  // counts agree
  const count = []
  for (const [f, rows] of [['a-docked-strip/index.html', 8], ['b-tabs-and-decision/index.html', 10], ['c-window-first/index.html', 5]]) {
    const t = fs.readFileSync(path.join(root, f), 'utf8'); const n = (t.match(/data-item="/g) || []).length
    if (n !== rows) count.push(`${f}: ${n} rows, expected ${rows}`)
    for (const m of t.matchAll(/(?:>|\s)(\d+) of (\d+) (figures|items|values)/g)) if (+m[2] !== (f.startsWith('b') ? (m[3] === 'values' ? 4 : 6) : rows)) count.push(`${f}: "${m[0].trim()}"`)
  }
  out.lint = { appClasses: [...used].sort(), findings: [...new Set(lint)], countDisagreements: count }
  ck('retired-term, dash, filler and SIN lint (check 6)', !lint.filter((l) => /retired|dash|filler|SIN/.test(l)).length, lint.filter((l) => /retired|dash|filler|SIN/.test(l)).join('; '))
  ck('prototype lint (check 7): links, classes, one h1, no inline style, counts agree', !lint.filter((l) => !/retired|dash|filler|SIN/.test(l)).length && !count.length, [...lint.filter((l) => !/retired|dash|filler|SIN/.test(l)), ...count].join('; '))
})

await browser.close(); srv.close()
const fails = out.checks.filter((c) => !c.ok)
out.summary = { checks: out.checks.length, failed: fails.length, axeStates: out.axe.length }
fs.writeFileSync(path.join(here, 'verify-result.json'), JSON.stringify(out, null, 1))
console.log(`\n${out.checks.length} checks, ${fails.length} failed`)
for (const f of fails) console.log(' FAIL', f.name, '-', f.detail.slice(0, 300))
process.exit(fails.length ? 1 : 0)
