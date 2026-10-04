// npm run test:flake:shifted: the unit project three times (real date, +2 days, +1 year), then names every test
// whose result under a shift differs from the real-date run (ARC-15, A469). Extra arguments go to every run.
// The same file is the date shim: a run loads it with `--import` through NODE_OPTIONS, so the shift is in place
// before any test file loads (workers inherit it). It moves Date.now() and `new Date()` with no argument only.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const DAY_MS = 86_400_000
const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === SELF

if (!isMain) {
  const shift = Number(process.env['CQ10_SHIFT_MS'] ?? 0)
  if (shift > 0) {
    const RealDate = Date
    const shiftedNow = () => RealDate.now() + shift
    globalThis.Date = new Proxy(RealDate, {
      construct: (target, args, newTarget) =>
        Reflect.construct(target, args.length === 0 ? [shiftedNow()] : args, newTarget),
      apply: () => new RealDate(shiftedNow()).toString(),
      get: (target, prop, receiver) => (prop === 'now' ? shiftedNow : Reflect.get(target, prop, receiver)),
    })
  }
} else {
  main()
}

function stripShim(options) {
  return (options ?? '').replace(/--import[= ]\S*flake-shifted\S*/g, '').trim()
}

function runOnce(label, shiftMs, args, dir) {
  const outputFile = path.join(dir, `${label}.json`)
  const env = { ...process.env }
  delete env['CQ10_SHIFT_MS']
  let options = stripShim(env['NODE_OPTIONS'])
  if (shiftMs > 0) {
    env['CQ10_SHIFT_MS'] = String(shiftMs)
    options = `${options} --import=${pathToFileURL(SELF).href}`.trim()
  }
  if (options === '') delete env['NODE_OPTIONS']
  else env['NODE_OPTIONS'] = options
  const r = spawnSync(
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', '--project', 'unit', '--reporter=json', `--outputFile=${outputFile}`, ...args],
    { encoding: 'utf8', shell:false, env, maxBuffer: 1 << 28 },
  )
  let report
  try {
    report = JSON.parse(fs.readFileSync(outputFile, 'utf8'))
  } catch {
    report = { testResults: [] }
  }
  const results = new Map()
  for (const file of report.testResults ?? []) {
    const name = path.relative(process.cwd(), file.name).split(path.sep).join('/')
    const tests = file.assertionResults ?? []
    if (tests.length === 0) {
      results.set(name, file.status === 'failed' ? 'failed' : 'none')
      continue
    }
    for (const t of tests) results.set(`${name} > ${t.fullName ?? t.title}`, t.status)
  }
  return { results, status: r.status }
}

function main() {
  const args = process.argv.slice(2)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flake-shifted-'))
  let failed = false
  try {
    const base = runOnce('base', 0, args, dir)
    const ran = [...base.results.values()].filter((s) => s !== 'none' && s !== 'skipped' && s !== 'pending' && s !== 'todo')
    if (ran.length === 0) {
      console.error('flake-shifted: the unshifted run ran no test')
      failed = true
    }
    if (base.status !== 0 || ran.some((s) => s === 'failed')) {
      console.error('flake-shifted: the unshifted run has a failing test')
      failed = true
    }
    for (const [label, ms] of [['+2d', 2 * DAY_MS], ['+1y', 365 * DAY_MS]]) {
      const shifted = runOnce(label.slice(1), ms, args, dir)
      const keys = new Set([...base.results.keys(), ...shifted.results.keys()])
      for (const key of keys) {
        const was = base.results.get(key) ?? 'missing'
        const now = shifted.results.get(key) ?? 'missing'
        if (was !== now) {
          console.log(`DIFFERS ${label} ${key}`)
          failed = true
        }
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  process.exit(failed ? 1 : 0)
}
