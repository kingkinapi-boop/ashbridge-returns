// SC11 round 2 acceptance tests, the source rules (A500; spec-writer; builders never edit this file). Unit project:
// they read source text only, so they run on both backends and need no database.
// - R116: every `new Pool(` / `new Client(` from pg in a non-test file under src/ is assigned to a named variable
//   (`const x =`, `let x =`, `this.x =`) and has an `error` listener that records the error: `x.on('error', h)`
//   in the next 40 lines (up to the next such site), or a call to a helper whose name has listen, record, track or
//   watch in it with x as an argument (the file holding the site then has a non-empty `.on('error', ...)`). An empty
//   listener (`() => {}`, `() => undefined`, `() => null`, `noop`) is a swallow (R92) and does not count.
// - R117: a pool is ended only through the exported helper `endPool` (index.ts), so src/core/db has no raw
//   `<pool>.end()` outside the body of `function endPool`. The helper's runtime behaviour is in
//   rules.acceptance.db.test.ts (pg16).
// - Plant: __fixtures__/index-87066e33.ts is index.ts at 87066e33 (8 sites, no listener, three raw pool.end()).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../testing/read-own-source'

const SRC = 'src'
const DB_DIR = 'src/core/db'
const SITE = /new\s+(?:pg\.)?(?:Pool|Client)\s*\(/g
const SWALLOW = String.raw`(?:\(\s*\w*\s*\)\s*=>\s*(?:undefined|void 0|null|\{\s*\})|noop)`
const HELPER = /\b\w*(?:listen|record|track|watch)\w*\s*\(/i

interface Src {
  file: string
  src: string
}

function sources(dir: string, onlyThisDir = false): Src[] {
  const out: Src[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__fixtures__' || e.name === 'node_modules' || onlyThisDir) continue
      out.push(...sources(p))
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push({ file: p, src: readOwnSource(p) })
    }
  }
  return out
}

/** One string per pg.Pool or pg.Client site without a recording error listener, naming file and line. */
function unlistened(files: Src[]): string[] {
  const bad: string[] = []
  for (const { file, src } of files) {
    const sites = [...src.matchAll(SITE)]
    const hasListener = new RegExp(String.raw`\.on\(\s*['"]error['"]\s*,\s*(?!${SWALLOW}\s*\))`).test(src)
    sites.forEach((m, i) => {
      const line = src.slice(0, m.index).split('\n').length
      const where = `${file}:${String(line)}`
      const before = src.slice(src.lastIndexOf('\n', m.index) + 1, m.index)
      const v = /(?:(?:const|let)\s+|this\.)(\w+)\s*(?::[^=]+)?=\s*$/.exec(before)?.[1]
      if (v === undefined) return void bad.push(`${where} not assigned to a named variable`)
      const end = i + 1 < sites.length ? (sites[i + 1]?.index ?? src.length) : src.length
      const after = src
        .slice(m.index, Math.min(end, m.index + 4000))
        .split('\n')
        .slice(0, 41)
        .join('\n')
      const direct = new RegExp(String.raw`\b${v}\.on\(\s*['"]error['"]\s*,\s*(?!${SWALLOW}\s*\))\S`).test(after)
      const viaHelper = new RegExp(`${HELPER.source.replace(/\\s\*\\\($/, '')}\\s*\\([^)]*\\b${v}\\b`, 'i').test(after)
      if (!direct && !(viaHelper && hasListener)) bad.push(`${where} ${v} has no recording error listener`)
    })
  }
  return bad
}

/** One string per raw `<pool>.end()` call outside the body of `function endPool`. */
function rawPoolEnds(files: Src[]): string[] {
  const bad: string[] = []
  for (const { file, src } of files) {
    const helper = /(?:export\s+)?(?:async\s+)?function\s+endPool\b[\s\S]*?\n\}/.exec(src)
    const [from, to] = helper ? [helper.index, helper.index + helper[0].length] : [-1, -1]
    for (const m of src.matchAll(/\b\w*[pP]ool\.end\s*\(\s*\)/g)) {
      if (m.index >= from && m.index < to) continue
      bad.push(`${file}:${String(src.slice(0, m.index).split('\n').length)} raw ${m[0]}`)
    }
  }
  return bad
}

const plant = (): Src[] => [
  {
    file: 'plant',
    src: fs.readFileSync(`${DB_DIR}/__fixtures__/index-87066e33.ts`, 'utf8'),
  },
]

describe('SC11 R116 every pg Pool and Client has a recording error listener (ARC-6, ARC-15)', () => {
  test('ARC-15 the scan accepts a direct listener and a helper, and flags a site with none, a swallowing one, or no variable', () => {
    const ok = [
      "const p = new pg.Pool(o)\np.on('error', (e) => problems.push(e))",
      "this.main = new pg.Client(o)\nthis.main.on('error', (err) => { record(err) })",
      "const c = new Client(o)\nlistenForErrors(c)\nfunction listenForErrors(x) { x.on('error', (e) => seen.push(e)) }",
    ]
    for (const src of ok) expect(unlistened([{ file: 'f.ts', src }]), src).toEqual([])
    const bad = [
      'const p = new pg.Pool(o)\nawait p.end()',
      "const p = new pg.Pool(o)\np.on('error', () => {})",
      "const p = new pg.Pool(o)\np.on('error', () => undefined)",
      "const p = new pg.Pool(o)\np.on('error', noop)",
      "return new pg.Pool(o)\n// p.on('error', (e) => seen.push(e))",
    ]
    for (const src of bad) expect(unlistened([{ file: 'f.ts', src }]), src).toHaveLength(1)
  })

  test('ARC-15 PLANT: index.ts at 87066e33 is flagged once for each of its 8 sites, with its line', () => {
    const src = plant()[0]?.src ?? ''
    const sites = src.split('\n').flatMap((l, n) => (/new\s+pg\.(?:Pool|Client)\(/.test(l) ? [n + 1] : []))
    expect(sites, 'sentinel: the plant really has 8 sites').toHaveLength(8)
    const found = unlistened(plant())
    expect(found).toHaveLength(8)
    for (const n of sites) expect(found.join('\n')).toContain(`plant:${String(n)} `)
  })

  test('ARC-15 the real src/** has no pg Pool or Client without a recording error listener', () => {
    const files = sources(SRC)
    expect(
      files.some((f) => f.file === `${DB_DIR}/index.ts`),
      'sentinel: the scan reads index.ts',
    ).toBe(true)
    expect(unlistened(files)).toEqual([])
  })
})

describe('SC11 R117 a pool is ended only by endPool (ARC-6, ARC-15)', () => {
  test('ARC-15 the scan allows pool.end() inside function endPool only', () => {
    const inHelper = 'export async function endPool(pool) {\n  await pool.end()\n  await settled(pool)\n}\n'
    expect(rawPoolEnds([{ file: 'f.ts', src: inHelper }])).toEqual([])
    expect(
      rawPoolEnds([
        {
          file: 'f.ts',
          src: `${inHelper}async function other() {\n  await pool.end()\n}\n`,
        },
      ]),
    ).toHaveLength(1)
    expect(
      rawPoolEnds([
        { file: 'f.ts', src: 'await this.pool.end()' },
        { file: 'g.ts', src: 'await schemaPool.end()' },
      ]),
    ).toHaveLength(2)
  })

  test('ARC-15 PLANT: index.ts at 87066e33 has its three raw pool.end() calls flagged', () => {
    expect(rawPoolEnds(plant())).toHaveLength(3)
  })

  test('ARC-15 src/core/db has no raw pool.end() outside endPool, and index.ts defines and exports endPool', () => {
    const files = sources(DB_DIR, true)
    expect(rawPoolEnds(files)).toEqual([])
    expect(readOwnSource(`${DB_DIR}/index.ts`)).toMatch(/export\s+(?:async\s+)?function\s+endPool\b/)
  })
})
