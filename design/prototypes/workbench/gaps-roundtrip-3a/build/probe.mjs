// Designer helper: evaluate an expression on a page. node probe.mjs "<page#hash>" <w> <h> "<js expression returning JSON>"
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
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' }
const srv = http.createServer((q, r) => {
  const f = path.join(DESIGN, decodeURIComponent(q.url.split('?')[0]))
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('nf') } r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const [url, w, h, expr] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage()
await page.goto(`http://127.0.0.1:${srv.address().port}/prototypes/workbench/gaps-roundtrip-3a/${url}`)
await page.waitForTimeout(500)
console.log(JSON.stringify(await page.evaluate(expr)))
await browser.close()
srv.close()
