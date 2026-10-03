// Developer tool: serve v3 over http and take screenshots, to look at a page. Not part of the checks.
// Run: PW_NM=<node_modules folder> node tools/heavy.mjs -- node design/prototypes/queues-record/v3/build/shot.mjs <outdir> <w>x<h> <page>[ <page> ...]
// A page may be "file.html#tab"; add "!as=dana" to sign that person in first (default aisha, "!as=none" for nobody); add "!full" for a full-page shot; add "!y=400" to scroll first.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
const NM = (process.env.PW_NM || '').replace(/[\\/]$/, '')
if (!NM) throw new Error('Set PW_NM to a node_modules folder holding playwright')
const reqPW = createRequire(path.join(NM, '..', 'x.js'))
const { chromium } = (() => { try { return reqPW('playwright') } catch (e) { return reqPW('playwright-core') } })()
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' }
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]))
  if (!f.startsWith(ROOT)) { r.statusCode = 403; return r.end() }
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('not found') } r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${srv.address().port}/`
const [outDir, size, ...pages] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
const browser = await chromium.launch({ headless: true })
let i = 0
for (const spec of pages) {
  const [u, ...opts] = spec.split('!')
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const role = (opts.find((o) => o.startsWith('as=')) || '').slice(3) || 'aisha'
  if (role !== 'none') await ctx.addInitScript((r) => { try { if (!localStorage.getItem('proto-user')) { localStorage.setItem('proto-user', r); localStorage.setItem('proto-since', String(Date.now())); localStorage.setItem('proto-last', String(Date.now())) } } catch (e) {} }, role)
  const p = await ctx.newPage()
  await p.goto(BASE + u)
  if (u.includes('#')) await p.reload()
  await p.waitForTimeout(400)
  const y = (opts.find((o) => o.startsWith('y=')) || '').slice(2)
  if (y) { await p.evaluate((n) => window.scrollTo(0, +n), y); await p.waitForTimeout(100) }
  const file = path.join(outDir, `shot-${String(++i).padStart(2, '0')}-${u.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}${role ? '-' + role : ''}.png`)
  await p.screenshot({ path: file, fullPage: opts.includes('full') })
  console.log(file)
  await ctx.close()
}
await browser.close()
srv.close()
