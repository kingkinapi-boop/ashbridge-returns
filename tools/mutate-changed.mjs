// npm run mutate:changed -- <card> [base]: mutation-test the changed src/**/*.ts and testworld/**/*.ts files marked `// @mutate` in their first 5 lines.
// On a core card (`core: true` in plan/slices.json, or the word `core` anywhere in its Tags line) a changed file inside the
// card's Paths with no marker fails first, and so does a card with no marked target inside its Paths (never "no mutation targets").
// Test harness files on the Lead-kept `harness` list in tools/test-homes.json are never mutated or gated (printed
// "harness, not mutated"), and any non-test module outside that list that imports one of them fails the run (CQ6).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadIndex, globToRegExp, ROOT } from './lib.mjs'

const [id, baseArg] = process.argv.slice(2)
if (!id) {
  console.error('usage: node tools/mutate-changed.mjs <card> [base]')
  process.exit(2)
}
const card = loadIndex().cards.find((c) => c.id === id)
const cardFile = path.join(ROOT, 'plan', 'cards', `${id}.md`)
if (!card || !fs.existsSync(cardFile)) {
  console.error(`no card ${id} (plan/slices.json and plan/cards/${id}.md)`)
  process.exit(2)
}
// core is data: the slices.json flag, or a Tags token that is exactly "core" (not "hardcore", not "core-adjacent").
const tagsLine = fs.readFileSync(cardFile, 'utf8').match(/^Tags:(.*)$/m)?.[1] ?? ''
const core = card.core === true || tagsLine.toLowerCase().split(/[^a-z0-9-]+/).includes('core')

// The Lead-kept harness list: test plumbing Stryker can never reach. No list file means no exemptions (strictest).
const homesFile = path.join(ROOT, 'tools', 'test-homes.json')
const harness = fs.existsSync(homesFile) ? (JSON.parse(fs.readFileSync(homesFile, 'utf8')).harness ?? []) : []
const isHarness = (f) => harness.includes(f)

const base = baseArg ?? 'origin/main'
const git = (args) => spawnSync('git', args, { encoding: 'utf8' })

// A shallow cloud clone may not have the base yet.
const branch = base.startsWith('origin/') ? base.slice('origin/'.length) : null
if (branch) git(['fetch', '-q', 'origin', branch])

const diff = git(['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`])
if (diff.status !== 0) {
  console.error(`git diff against ${base} failed: ${diff.stderr.trim()}`)
  process.exit(1)
}
const changedAll = diff.stdout
  .split('\n')
  .filter((f) => /^(src|testworld)\/.*\.ts$/.test(f) && !/\.(test|acceptance)\.ts$|\.db\.test\.ts$|\.eval\.test\.ts$/.test(f))
  .filter((f) => !/(^|\/)(__fixtures__|__golden__)\//.test(f)) // spec-owned test data, not product code
  .filter((f) => fs.existsSync(f))
for (const f of changedAll.filter(isHarness)) console.log(`${f}: harness, not mutated`)
const changed = changedAll.filter((f) => !isHarness(f))
// A spec commit that only adds test data (fixtures, goldens) has nothing to score.
const specDataOnly = changed.length === 0 && diff.stdout.split('\n').some((f) => /^(src|testworld)\/.*(^|\/)(__fixtures__|__golden__)\//.test(f))
const marked = (f) => fs.readFileSync(f, 'utf8').split('\n').slice(0, 5).some((l) => l.includes('// @mutate'))

// A non-test module outside the harness list may not import a harness file (changed or not).
const leaks = harnessImports()
if (leaks.length > 0) {
  console.error(`harness file imported by a non-test module (only tests and the harness itself may):\n${leaks.join('\n')}`)
  process.exit(1)
}

if (core) {
  const inPaths = (card.paths || []).map(globToRegExp)
  const missing = changed.filter((f) => inPaths.some((re) => re.test(f)) && !marked(f))
  if (missing.length > 0) {
    console.error(`core file without @mutate (first 5 lines): ${missing.join(', ')}`)
    process.exit(1)
  }
  if (!specDataOnly && !changed.some((f) => inPaths.some((re) => re.test(f)) && marked(f))) {
    console.error(`core card ${id} has no marked mutation target inside its Paths (changed: ${changed.join(', ') || 'none'})`)
    process.exit(1)
  }
}

if (changed.length === 0) {
  console.log('no mutation targets changed')
  process.exit(0)
}
const targets = changed.filter(marked)
if (targets.length === 0) {
  console.log('no marked mutation targets among the changed files')
  process.exit(0)
}
const bad = targets.filter((f) => !/^[\w./-]+$/.test(f))
if (bad.length > 0) {
  console.error(`refusing mutation target with unsafe characters: ${bad.join(', ')}`)
  process.exit(1)
}

// A Stryker disable comment must say why: `// Stryker disable next-line <mutators>: <reason>`.
const noReason = []
for (const f of targets) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    const m = l.match(/\/\/\s*Stryker disable\b[^:]*(?::(.*))?$/)
    if (m && !(m[1] ?? '').trim()) noReason.push(`${f}:${i + 1}`)
  })
}
if (noReason.length > 0) {
  console.error(`Stryker disable comment with no reason: ${noReason.join(', ')}`)
  process.exit(1)
}
console.log(`mutating: ${targets.join(', ')}`)
const stryker = 'node_modules/@stryker-mutator/core/bin/stryker.js'
const reportFile = path.join('reports', 'mutation', 'mutation.json')
fs.rmSync(reportFile, { force: true })
const r = spawnSync(process.execPath, [stryker, 'run', '--incremental', '--mutate', targets.join(',')], {
  stdio: 'inherit',
  shell:false,
})
if (!fs.existsSync(reportFile)) {
  console.error(`Stryker wrote no ${reportFile} (exit ${r.status ?? 'none'})`)
  process.exit(1)
}

// Per-file break (ARC-15): every marked file scores 100; survived and no-coverage both count against it.
// The overall break in the Stryker config no longer decides a pass.
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
const below = []
for (const f of targets) {
  const mutants = (report.files?.[f]?.mutants ?? []).filter((m) => ['Killed', 'Timeout', 'Survived', 'NoCoverage'].includes(m.status))
  const survivors = mutants.filter((m) => m.status === 'Survived' || m.status === 'NoCoverage')
  if (survivors.length === 0) continue
  const score = Math.round(((mutants.length - survivors.length) / mutants.length) * 10000) / 100
  const list = survivors.map((m) => `line ${m.location?.start?.line} ${m.mutatorName} (${m.status})`).join('; ')
  below.push(`${f}: score ${score}, must be 100; survivors: ${list}`)
}
if (below.length > 0) {
  console.error(`mutation score below 100 per file:\n${below.join('\n')}`)
  process.exit(1)
}
process.exit(0)

function harnessImports() {
  // vitest setup files (setupFiles, globalSetup in the vitest configs) run only under test, so they count as tests.
  const setup = new Set()
  for (const cfg of ['vitest.config.ts', 'vitest.mutate.config.ts']) {
    const p = path.join(ROOT, cfg)
    if (!fs.existsSync(p)) continue
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/(?:setupFiles|globalSetup)\s*:\s*\[([^\]]*)\]/g)) {
      for (const q of m[1].matchAll(/['"]([^'"]+)['"]/g)) setup.add(path.posix.normalize(q[1]))
    }
  }
  const isTest = (f) => /\.(test|acceptance)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)(__fixtures__|__golden__)\//.test(f) || setup.has(f)
  const noExt = (f) => f.replace(/\.[cm]?[jt]sx?$/, '')
  const targets = new Map(harness.map((h) => [noExt(h), h]))
  const out = []
  for (const f of walk(['src', 'testworld'])) {
    if (isHarness(f) || isTest(f)) continue
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8')
    const specs = [
      ...text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
      ...text.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
      ...text.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1])
    for (const spec of new Set(specs)) {
      if (!spec.startsWith('.')) continue
      const resolved = noExt(path.posix.normalize(path.posix.join(path.posix.dirname(f), spec)))
      const hit = targets.get(resolved) ?? targets.get(`${resolved}/index`)
      if (hit) out.push(`${f} imports ${hit}`)
    }
  }
  return out
}

function walk(dirs) {
  const files = []
  const visit = (rel) => {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.')) visit(r)
      } else if (/\.[cm]?[jt]sx?$/.test(e.name)) files.push(r)
    }
  }
  for (const d of dirs) if (fs.existsSync(path.join(ROOT, d))) visit(d)
  return files
}
