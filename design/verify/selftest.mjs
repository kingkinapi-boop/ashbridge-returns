// Self-test for design/verify/rules.mjs: each rule must FAIL on its planted bad page and PASS on the matching good page,
// at both rule-18 sizes. Run:  node tools/heavy.mjs -- node design/verify/selftest.mjs
// Playwright comes from PW_NM (a node_modules folder holding playwright) or from a normal install.
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as R from './rules.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const NM = process.env.PW_NM
const req = NM ? createRequire(NM.replace(/node_modules\/?$/, '') + 'x.js') : createRequire(import.meta.url)
const { chromium } = req('playwright')

const srv = http.createServer((q, r) => {
  const f = path.join(here, 'planted', path.basename(q.url.split('?')[0]))
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end('nf') } r.setHeader('content-type', 'text/html'); r.end(d) })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${srv.address().port}/`
const browser = await chromium.launch()

const click = (sel, name) => ({ name, click: sel })
const cases = {
  V1: (p) => R.V1(p),
  V2: (p) => R.V2(p, click('#go', 'Mark reviewed')),
  V3: (p) => R.V3(p),
  V4: (p) => R.V4(p, { name: 'Cite', click: '#cite', expect: '#result' }, { shortcuts: [{ key: 'n', selector: '#next' }] }),
  V5: async (p, size, good) => {
    const a = await R.V5(p)
    const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } })
    const p2 = await ctx.newPage(); await p2.goto(BASE + 'V5.html?page=b' + (good ? '&good=1' : ''))
    const b = await R.V5(p2); await ctx.close()
    const cap = await R.V5caption(p, click('#filter', 'Mine only'), { caption: '#cap' })
    const same = R.V5same([a, b])
    return { ok: a.ok && b.ok && cap.ok && same.ok, failures: [...a.failures, ...b.failures, ...cap.failures, ...same.failures] }
  },
  V6: (p) => R.V6(p, { input: '#q', result: '[data-result]', label: '#lab', kinds: [{ kind: 'name', value: 'Probe Co. (Test)' }, { kind: 'year end', value: '2025-12-31' }] }),
  V7: (p) => R.V7(p),
  V8: (p) => R.V8(p, { field: '#amt', radio: '#w2', submit: '#go' }),
}
const urlFor = (rule, good, extra = '') => BASE + `${rule}.html?${extra}${good ? 'good=1' : ''}`

let pass = 0, total = 0
for (const rule of Object.keys(cases)) {
  for (const good of [false, true]) {
    for (const size of R.SIZES) {
      const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } })
      const p = await ctx.newPage()
      await p.goto(urlFor(rule, good, rule === 'V5' ? 'page=a&' : ''))
      let r
      try { r = await cases[rule](p, size, good) } catch (e) { r = { ok: false, failures: ['threw ' + e.message.split('\n')[0]] } }
      await ctx.close()
      const expected = good ? r.ok : !r.ok // good must pass; bad must fail
      total++; if (expected) pass++
      console.log(`${expected ? 'ok  ' : 'WRONG'} ${rule} ${good ? 'good' : 'bad '} ${size.join('x')} -> ${r.ok ? 'passes' : 'fails'}${r.failures.length ? ' [' + r.failures[0].slice(0, 80) + ']' : ''}`)
    }
  }
}
await browser.close(); srv.close()
console.log(`selftest: ${pass} of ${total} cases behave (8 rules x bad and good x 2 sizes)`)
process.exit(pass === total ? 0 : 1)
