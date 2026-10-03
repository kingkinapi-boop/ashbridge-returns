// SC3: security rules, file side (unit project). Card plan/cards/SC3.md; clauses SEC-11, ARC-6, ARC-20, FLOW-1,
// ARC-15. R62 lives here (settings and production refusal); R63 to R66 run on a database in
// src/contracts/security-rules.db.test.ts. Each rule is first shown catching a planted fault under
// tools/test/__fixtures__/security-rules/, then applied to the repo.
//
// KNOWN (A407): an entry names one rule, one file, the exact problem strings (no regex) and an open owner card.
// A problem not listed fails; a listed string no longer produced fails as stale. Every file scan asserts it read at
// least one file and a named sentinel.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__', 'security-rules')
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8')
const load = (p) => import(pathToFileURL(p).href)

// FX2 landed (A443): the OCR and storage settings are declared and refuse production silence, so the list is empty.
// A new entry names one rule, one file, exact problem strings and an open owner card.
const KNOWN = []

/** problems: [{ file, text }]. Returns the problems no KNOWN entry covers, plus a line per stale listed string. */
export function applyKnown(rule, problems, known = KNOWN) {
  const entries = known.filter((k) => k.rule === rule)
  const listed = new Set(entries.flatMap((k) => k.problems.map((p) => `${k.file}\n${p}`)))
  const seen = new Set(problems.map((p) => `${p.file}\n${p.text}`))
  const unlisted = problems.filter((p) => !listed.has(`${p.file}\n${p.text}`)).map((p) => `${p.file}: ${p.text}`)
  const stale = [...listed].filter((l) => !seen.has(l)).map((l) => `stale KNOWN entry ${rule} ${l.replace('\n', ': ')}: it no longer fails, remove it`)
  return [...unlisted, ...stale]
}

const SKIP = new Set(['node_modules', '.next', '.git', '__fixtures__', '__golden__', 'coverage', '.stryker-tmp'])
function productFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) productFiles(p, out)
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')

// ---------- R62 ----------
const ENGINE_NAME = /(?:['"]|\.)([A-Z][A-Z0-9_]*_ENGINE)\b/g

/** Every `*_ENGINE` setting a product file reads by name, with the names src/core/env.ts declares. */
export function engineSettings(files, envText) {
  const declared = new Set([...envText.matchAll(/^\s*([A-Z][A-Z0-9_]*_ENGINE)\s*:/gm)].map((m) => m[1]))
  const read = []
  for (const f of files) {
    if (f.name === 'src/core/env.ts') continue
    for (const m of f.text.matchAll(ENGINE_NAME)) read.push({ file: f.name, setting: m[1] })
  }
  return { declared, read }
}
export function undeclaredProblems(files, envText) {
  const { declared, read } = engineSettings(files, envText)
  const seen = new Set()
  const out = []
  for (const r of read) {
    const text = `${r.setting} is read but not declared in src/core/env.ts`
    if (declared.has(r.setting) || seen.has(`${r.file}\n${text}`)) continue
    seen.add(`${r.file}\n${text}`)
    out.push({ file: r.file, text })
  }
  return out
}

/** The factory, called with NODE_ENV=production and its setting unset, must refuse naming the setting. */
export async function productionProblems(setting, file, factory) {
  const out = []
  let refused = false
  try {
    await factory({ NODE_ENV: 'production' })
  } catch (e) {
    refused = e instanceof Error && e.message.includes(setting)
    if (!refused) out.push({ file, text: `${setting}: the factory refused production without naming the setting` })
    else return out
  }
  if (!refused && out.length === 0) out.push({ file, text: `${setting}: with NODE_ENV=production and the setting unset the factory did not refuse` })
  return out
}

describe('R62 every *_ENGINE setting is declared and no stand-in is chosen by silence in production (SEC-11, ARC-6, ARC-20)', () => {
  test('R62 rule: a planted file reading an undeclared engine setting is caught, and its declared twin passes', () => {
    const planted = [{ name: 'planted.ts', text: fix('planted-r62-undeclared.ts.txt') }]
    expect(undeclaredProblems(planted, 'const schema = z.object({})')).toEqual([
      { file: 'planted.ts', text: 'PLANTED_ENGINE is read but not declared in src/core/env.ts' },
    ])
    expect(undeclaredProblems(planted, fix('clean-r62-env.ts.txt'))).toEqual([])
  })

  test('R62 rule: a planted factory with ?? standin accepts production silence and is caught; the clean twin refuses naming the setting', async () => {
    const planted = await load(path.join(FIX, 'planted-r62-factory.mjs'))
    const clean = await load(path.join(FIX, 'clean-r62-factory.mjs'))
    expect(await productionProblems('PLANTED_ENGINE', 'planted-r62-factory.mjs', planted.createPlantedAdapter)).toEqual([
      { file: 'planted-r62-factory.mjs', text: 'PLANTED_ENGINE: with NODE_ENV=production and the setting unset the factory did not refuse' },
    ])
    expect(await productionProblems('CLEAN_ENGINE', 'clean-r62-factory.mjs', clean.createCleanAdapter)).toEqual([])
    // a refusal that does not name the setting is not enough
    expect(await productionProblems('CLEAN_ENGINE', 'x.mjs', () => { throw new Error('refused') })).toEqual([
      { file: 'x.mjs', text: 'CLEAN_ENGINE: the factory refused production without naming the setting' },
    ])
  })

  test('R62 every *_ENGINE setting a product file reads is declared in src/core/env.ts ', () => {
    const files = productFiles(path.join(ROOT, 'src')).map((p) => ({ name: rel(p), text: fs.readFileSync(p, 'utf8') }))
    expect(files.length).toBeGreaterThan(0)
    expect(files.map((f) => f.name)).toContain('src/modules/auth/index.ts')
    const envText = fs.readFileSync(path.join(ROOT, 'src/core/env.ts'), 'utf8')
    expect(engineSettings(files, envText).declared.has('AUTH_ENGINE')).toBe(true)
    expect(engineSettings(files, envText).read.map((r) => r.setting)).toContain('AUTH_ENGINE')
    expect(applyKnown('R62-declared', undeclaredProblems(files, envText))).toEqual([])
  })

  // One entry per factory that reads an engine setting. AUTH_ENGINE needs a database: security-rules.db.test.ts.
  const DB_FACTORIES = ['AUTH_ENGINE']
  const FACTORIES = [
    {
      setting: 'OCR_ENGINE',
      file: 'src/modules/ocr/index.ts',
      make: async (env) => (await load(path.join(ROOT, 'src/modules/ocr/index.ts'))).createReadingAdapter({ env }),
    },
    {
      setting: 'STORAGE_DRIVE_ENGINE',
      file: 'src/modules/storage/drive/index.ts',
      make: async (env) => (await load(path.join(ROOT, 'src/modules/storage/drive/index.ts'))).createDriveStandIn({ root: os.tmpdir(), env }),
    },
    {
      setting: 'STORAGE_FILES_ENGINE',
      file: 'src/modules/storage/files/index.ts',
      make: async (env) => (await load(path.join(ROOT, 'src/modules/storage/files/index.ts'))).createFileStore({ root: os.tmpdir(), env }),
    },
  ]

  test('R62 every setting read in src has a factory entry here or in the db rules file, and every entry still reads its setting', () => {
    const files = productFiles(path.join(ROOT, 'src')).map((p) => ({ name: rel(p), text: fs.readFileSync(p, 'utf8') }))
    const read = new Set(engineSettings(files, '').read.map((r) => r.setting))
    const registered = new Set([...DB_FACTORIES, ...FACTORIES.map((f) => f.setting)])
    expect([...read].filter((s) => !registered.has(s)).sort()).toEqual([])
    expect([...registered].filter((s) => !read.has(s)).sort()).toEqual([])
    for (const f of FACTORIES) expect(files.find((x) => x.name === f.file)?.text).toMatch(new RegExp(`[.'"]${f.setting}\\b`))
  })

  test('R62 with NODE_ENV=production and the setting unset every adapter factory refuses naming it ', async () => {
    const problems = []
    for (const f of FACTORIES) problems.push(...(await productionProblems(f.setting, f.file, f.make)))
    expect(applyKnown('R62-production', problems)).toEqual([])
  })

  test('R62 outside production an unset setting still selects the stand-in (development, test)', async () => {
    for (const f of FACTORIES) {
      for (const NODE_ENV of ['development', 'test']) {
        let error
        try {
          await f.make({ NODE_ENV })
        } catch (e) {
          error = e
        }
        expect(error, `${f.setting} with NODE_ENV=${NODE_ENV}`).toBeUndefined()
      }
    }
  })

  test('R62 KNOWN entries are one rule, one file, exact strings and an owner card that is not done', () => {
    const slices = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'slices.json'), 'utf8'))
    const cards = new Map(slices.cards.map((c) => [c.id, c.status]))
    for (const k of KNOWN) {
      expect(k.rule, JSON.stringify(k)).toMatch(/^R6[2-6](-\w+)?$/)
      expect(fs.existsSync(path.join(ROOT, k.file)), k.file).toBe(true)
      expect(k.problems.length).toBeGreaterThan(0)
      for (const p of k.problems) expect(typeof p).toBe('string')
      expect(cards.has(k.owner), `owner ${k.owner}`).toBe(true)
      expect(cards.get(k.owner), `owner ${k.owner} must be open`).not.toBe('done')
    }
  })

  test('R62 KNOWN: an unlisted problem fails and a listed string no longer produced fails as stale', () => {
    const planted = [
      { rule: 'R62-declared', file: 'src/a.ts', problems: ['A_ENGINE is read but not declared in src/core/env.ts'], owner: 'FX2' },
      { rule: 'R62-declared', file: 'src/b.ts', problems: ['B_ENGINE is read but not declared in src/core/env.ts'], owner: 'FX2' },
    ]
    expect(applyKnown('R62-declared', [{ file: 'src/x.ts', text: 'FOO_ENGINE is read but not declared in src/core/env.ts' }], planted)).toHaveLength(3)
    const everything = planted.flatMap((k) => k.problems.map((text) => ({ file: k.file, text })))
    expect(applyKnown('R62-declared', everything, planted)).toEqual([])
    expect(applyKnown('R62-declared', everything.slice(1), planted)).toEqual([
      'stale KNOWN entry R62-declared src/a.ts: A_ENGINE is read but not declared in src/core/env.ts: it no longer fails, remove it',
    ])
    expect(applyKnown('R62-declared', [])).toEqual([])
  })
})
