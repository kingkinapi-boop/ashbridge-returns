// Screenshot helper for the designer: node shot.mjs "<page#hash>,<w>,<h>,<name>[,<click selector>...]" ...
// PW_NM names the folder holding playwright (default: the one beside the repo's node_modules). Pictures go to SHOT_DIR.
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const DESIGN = path.resolve(here, '../../../..')
const NM = process.env.PW_NM || 'C:/Users/User/AppData/Local/Temp/pv/node_modules'
const req = createRequire(NM.replace(/node_modules\/?$/, '') + 'x.js')
const { chromium } = req('playwright')
const OUT = process.env.SHOT_DIR || 'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Documents-GitHub-ashbridge-returns/52c430ec-89ac-42dc-85fa-d1f9d161db2e/scratchpad/d4/'
fs.mkdirSync(OUT, { recursive: true })
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.csv': 'text/csv', '.json': 'application/json' }
const srv = http.createServer((q, r) => {
  const f = path.join(DESIGN, decodeURIComponent(q.url.split('?')[0]))
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('nf') } r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const ROOT = `http://127.0.0.1:${srv.address().port}/prototypes/workbench/gaps-roundtrip-3a/`
const browser = await chromium.launch()
for (const j of process.argv.slice(2)) {
  const [url, w, h, name, ...clicks] = j.split(',')
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await page.goto(ROOT + url)
  await page.waitForTimeout(500)
  for (const c of clicks) { await page.click(c); await page.waitForTimeout(250) }
  await page.screenshot({ path: OUT + name + '.png' })
  console.log(name, 'errors:', errs.join(' | ') || 'none')
  await ctx.close()
}
await browser.close()
srv.close()
