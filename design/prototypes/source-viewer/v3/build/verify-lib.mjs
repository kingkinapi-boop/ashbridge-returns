// Shared set-up for the v3 verify script (D03, version B+): a static server over http (never file://), headless Chromium,
// the check recorder, axe (injected with addScriptTag; contrast "incomplete" counts as a failure unless calculated), and the
// in-page measures. Playwright and axe-core come from node_modules above this folder (or PW_NM=<folder holding node_modules>).
// Only headless Chromium is used; nobody's browser or Chrome extension is touched.
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const V3 = path.resolve(here, '..') // design/prototypes/source-viewer/v3
export const DESIGN = path.resolve(here, '../../../..') // design
export const HERE = here
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const SIZES = [[1366, 650], [1093, 525]] // staff-screens rule 18
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const pwBase = process.env.PW_NM ? process.env.PW_NM.replace(/node_modules[\\/]*$/, '') + 'x.js' : import.meta.url
const req = createRequire(pwBase)
export const { chromium } = req('playwright')
const axeSource = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8')

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.md': 'text/plain', '.json': 'application/json' }

export const out = { base: 'http (127.0.0.1, random port)', checks: [], axe: [], budgets: [], tasks: [], keyboard: [], reflow: [], window: [], shared: [], lint: {}, sections: {} }
let current = ''
export function setSection(n) { current = n }
export function ck(name, ok, detail = '') {
  out.checks.push({ section: current, name, ok: !!ok, detail: String(detail).slice(0, 500) })
  if (!ok) console.log('FAIL', `[${current}]`, name, '|', String(detail).slice(0, 300))
}

export async function init() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'
    const f = path.join(DESIGN, p)
    if (!f.startsWith(DESIGN)) { r.statusCode = 403; r.end('no'); return }
    fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end('not found'); return } r.setHeader('content-type', mime[path.extname(f)] || 'text/plain'); r.setHeader('cache-control', 'no-store'); r.end(d) })
  })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const BASE = `http://127.0.0.1:${srv.address().port}/prototypes/source-viewer/v3/`
  const browser = await chromium.launch()
  const T = { srv, browser, BASE, U: (p) => BASE + p, ck, sleep, out, SIZES }

  // a context with the listeners every check wants: no script error, no console error, no failed request
  T.newCtx = async (w, h, opts = {}) => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, ...opts })
    c.on('page', (p) => {
      p.on('pageerror', (e) => ck('no page error', false, e.message))
      p.on('console', (m) => { if (m.type() === 'error') ck('no console error', false, m.text()) })
    })
    c.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) ck('no failed request', false, r.status() + ' ' + r.url()) })
    return c
  }
  T.newPage = async (w, h, opts = {}) => { const c = await T.newCtx(w, h, opts); const p = await c.newPage(); return [c, p] }
  T.go = async (page, url, ms = 450) => { await page.goto(T.U(url)); await T.settle(page, ms) }

  // wait until the viewer has drawn what it will draw: the card, and for a page image the box
  T.settle = async (page, ms = 250) => {
    await page.waitForSelector('.app-viewer__card, .app-viewer__empty, .app-results-wrap, #main', { state: 'attached', timeout: 4000 }).catch(() => {})
    await page.waitForFunction(() => {
      const pg = document.querySelector('.app-page')
      return !pg || pg.classList.contains('app-page--loaded') || !!document.querySelector('.govuk-error-summary')
    }, null, { timeout: 4000 }).catch(() => {})
    await sleep(ms)
  }

  // the in-page counters for the loads, clicks, keys and fields of a task
  T.counters = async (page) => {
    await page.addInitScript(() => {
      window.__n = { click: 0, key: 0, fields: new Set() }
      document.addEventListener('click', () => { window.__n.click++ }, true)
      document.addEventListener('keydown', (e) => { if (e.key !== 'Tab' && e.key !== 'Shift') window.__n.key++ }, true)
      document.addEventListener('input', (e) => { const t = e.target; if (/^(INPUT|TEXTAREA)$/.test(t.tagName) && t.type !== 'checkbox' && t.type !== 'radio') window.__n.fields.add(t.id || t.name) }, true)
    })
  }
  T.reading = (page) => page.evaluate(() => ({ clicks: window.__n.click, keys: window.__n.key, fields: window.__n.fields.size }))
  T.resetCounters = (page) => page.evaluate(() => { window.__n.click = 0; window.__n.key = 0; window.__n.fields.clear() })

  // axe with the five tags, plus region and landmark-unique; "incomplete" is a failure unless the colour contrast is calculated
  // from the computed colours and is enough (clipped table cells, text over a plain background that axe could not decide)
  T.axe = async (page, label) => {
    const has = await page.evaluate(() => typeof window.axe)
    if (has !== 'object') await page.addScriptTag({ content: axeSource })
    const r = await page.evaluate(async (tags) => {
      const o = { elementRef: true }
      const a = await axe.run(document, { ...o, runOnly: { type: 'tag', values: tags } })
      const b = await axe.run(document, { ...o, runOnly: { type: 'rule', values: ['region', 'landmark-unique'] } })
      const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
      const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number)
      const ratio = (e) => {
        const cs = getComputedStyle(e), fg = parse(cs.color)
        let a2 = e, bg = null
        while (a2 && !bg) {
          const s2 = getComputedStyle(a2)
          if (s2.backgroundImage && s2.backgroundImage !== 'none') return 0
          const c = parse(s2.backgroundColor)
          if (c.length >= 3 && (c.length === 3 || c[3] === 1)) bg = c
          a2 = a2.parentElement
        }
        bg = bg || [255, 255, 255]
        const L1 = lum(fg), L2 = lum(bg)
        const need = (parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700)) ? 3 : 4.5
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) / need
      }
      const short = (v) => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 2).map((n) => n.target.join(' ')), h: (v.nodes[0] && v.nodes[0].html || '').slice(0, 110) })
      const viol = [...a.violations, ...b.violations].map(short)
      const inc = [], resolved = []
      for (const v of [...a.incomplete, ...b.incomplete]) {
        if (v.id !== 'color-contrast') { inc.push(short(v)); continue }
        const rs = v.nodes.map((n) => ratio(n.element))
        if (Math.min(...rs) >= 1) resolved.push({ id: v.id, n: v.nodes.length, low: +Math.min(...rs).toFixed(2) })
        else inc.push(short(v))
      }
      return { viol, inc, resolved }
    }, TAGS)
    out.axe.push({ label, violations: r.viol.map((v) => `${v.id} x${v.n} ${v.t[0] || ''}`), incomplete: r.inc.map((v) => `${v.id} x${v.n} ${v.t[0] || ''}`), resolvedByCalculation: r.resolved.length })
    if (r.viol.length || r.inc.length) console.log('AXE', label, JSON.stringify(r.viol), JSON.stringify(r.inc))
    return r
  }
  T.close = async () => { await browser.close(); srv.close() }
  return T
}

// ---------------------------------------------------------------- measures taken inside the page
export const measure = () => {
  const de = document.documentElement, vh = innerHeight
  const vis = (e) => e.getClientRects().length > 0
  const st = document.querySelector('.app-viewer__stage'), sr = st && st.getBoundingClientRect()
  const box = document.querySelector('.app-box') || document.querySelector('.app-cell-boxed'), br = box && box.getBoundingClientRect()
  const pb = document.querySelector('.app-page'), img = pb && pb.querySelector('img')
  const work = document.querySelector('.app-split__work'), wr = work && work.getBoundingClientRect()
  const panel = document.querySelector('[data-panel]:not([hidden])') || document
  const rows = [...panel.querySelectorAll('[data-item]')].filter((r) => !r.hidden && vis(r))
  const full = wr ? rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= wr.top - 1 && b.bottom <= wr.bottom + 1 }).length : null
  const pane = document.getElementById('source-pane'), pr = pane && pane.getBoundingClientRect()
  // text sizes: everything is at least 16 px except the sheet grid (source text, at least 12 px) and the overlay label on the page image
  const small = []
  let minBody = 999
  const skip = (e) => e.closest('.app-sheet, .app-box__label, .govuk-visually-hidden, script, style, svg, noscript')
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    const t = n.nodeValue.trim(); if (!t) continue
    const e = n.parentElement; if (!e || skip(e) || !vis(e)) continue
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden') continue
    const px = parseFloat(cs.fontSize)
    if (px < minBody) minBody = px
    if (px < 15.99) small.push(t.slice(0, 24) + ' ' + px + 'px')
  }
  const sheet = [...document.querySelectorAll('.app-sheet td, .app-sheet th')].filter(vis)
  const sheetPx = sheet.length ? Math.min(...sheet.map((e) => parseFloat(getComputedStyle(e).fontSize))) : null
  const activeBox = document.activeElement === box
  return {
    overflowPx: de.scrollHeight - vh, sideScroll: de.scrollWidth - innerWidth,
    stageH: sr && Math.round(sr.height), stageRatio: sr && +(sr.height / vh).toFixed(3),
    pageTextPx: img && pb ? +(img.clientWidth / 612 * Number(pb.getAttribute('data-min-text'))).toFixed(1) : null, sheetPx,
    boxW: br && Math.round(br.width), stageW: sr && Math.round(sr.width),
    boxWhole: br ? br.left >= sr.left - 1 && br.right <= sr.right + 1 && br.top >= sr.top - 1 && br.bottom <= sr.bottom + 1 : null,
    boxLeftInView: br ? br.left >= sr.left - 1 && br.left < sr.right - 8 && br.top >= sr.top - 1 && br.top < sr.bottom - 8 : null,
    focusBox: br ? activeBox : null, zoom: (document.querySelector('.app-zoom-level') || {}).textContent || null,
    rowsInList: rows.length, fullRows: full, paneW: pr && Math.round(pr.width), paneVisible: !!(pr && pr.width > 0),
    paneBeside: pr && wr ? pr.left >= wr.right - 2 : null,
    minBodyPx: minBody === 999 ? null : minBody, smallText: small.slice(0, 5), smallCount: small.length,
  }
}

// every focusable thing in the page: size and visibility (for the targets rule)
export const targets = () => {
  const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
  const small = []
  document.querySelectorAll('button, summary, a[href], textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role=separator], [tabindex="0"]').forEach((e) => {
    if (!vis(e) || e.closest('.govuk-visually-hidden') || e.matches('.govuk-skip-link')) return // the skip link is off screen until focused; the keyboard walk measures it focused
    if (e.matches('a') && e.closest('p, li > a:only-child') && !e.closest('.moj-sub-navigation, .govuk-generic-header, .app-bar-link')) { /* an inline link in a sentence is exempt */ if (e.closest('p')) return }
    const b = e.getBoundingClientRect()
    if (b.width < 23.5 || b.height < 23.5) small.push((e.id || e.tagName.toLowerCase() + ':' + (e.textContent || '').trim().slice(0, 18)) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height))
  })
  return small
}
