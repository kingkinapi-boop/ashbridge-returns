// SC3: security rules, file side and unit twins (unit project). Card plan/cards/SC3.md; clauses SEC-11, ARC-6, ARC-20,
// FLOW-1, ARC-15. R62 lives here (settings and production refusal), with the strict tag scan, the create* inventory,
// the KNOWN shape and a unit twin of every rule src/contracts/security-rules.db.test.ts applies on a database (R63 to
// R66, A391): the same harness function (tools/test/__fixtures__/security-rules/harness.ts) run on planted input.
// Each rule is first shown catching a planted fault under tools/test/__fixtures__/security-rules/, then applied to the repo.
//
// KNOWN (A407, R80 form): an entry names one rule, one file, the exact problem strings (no regex) and an open owner
// card whose Paths hold the file or the entry's `fix` file. A problem not listed fails; a listed string no longer
// produced fails as stale. Every file scan asserts it read at least one file and a named sentinel.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  FORMAT_FUNCTIONS,
  FREE_TEXT,
  INVENTORY,
  KNOWN,
  LANDING,
  NEVER_FORMAT,
  NOT_SETTINGS,
  REGISTRY,
  appendOnlyGuardProblems,
  appendOnlyTables,
  applyKnown,
  cardPaths,
  checkVouches,
  createExports,
  engineSettings,
  formatFunctionProblems,
  freeText,
  inventoryProblems,
  knownShapeProblems,
  landingProblems,
  limitProblems,
  onceProblems,
  pathMatches,
  postponedReasonProblems,
  productFiles,
  productionProblems,
  r66Problem,
  r66Problems,
  readSources,
  scanTags,
  standinProblems,
  tableFiles,
  tagProblems,
  taggedExports,
  undeclaredProblems,
} from './__fixtures__/security-rules/harness.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__', 'security-rules')
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8')
const load = (p) => import(pathToFileURL(p).href)
const SRC = () => readSources(ROOT, path.join(ROOT, 'src'))
const ENV_TEXT = () => fs.readFileSync(path.join(ROOT, 'src/core/env.ts'), 'utf8')
const tick = () => new Promise((r) => setTimeout(r, 0))

function cardsMap() {
  const slices = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'slices.json'), 'utf8'))
  const out = new Map()
  for (const c of slices.cards) {
    const p = path.join(ROOT, 'plan', 'cards', `${c.id}.md`)
    out.set(c.id, { status: c.status, paths: fs.existsSync(p) ? cardPaths(fs.readFileSync(p, 'utf8')) : [] })
  }
  return out
}

// ---------- the walker (A452 item 10) ----------
describe('the product-file walker reads every source kind and skips coverage only at the root (ARC-15)', () => {
  test('R62 R63 rule: planted .mts, .cts, .js, .mjs sources and a nested coverage folder are read; root coverage, tests and fixtures are not', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sc3-walk-'))
    const put = (rel, text = 'export const x = 1\n') => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
      fs.writeFileSync(path.join(root, rel), text)
    }
    for (const f of ['src/a.ts', 'src/b.tsx', 'src/c.mts', 'src/d.cts', 'src/e.js', 'src/f.mjs', 'src/deep/coverage/g.ts', 'coverage/h.ts', 'src/a.test.ts', 'src/a.spec.mts', 'src/__fixtures__/i.ts', 'src/j.md']) put(f)
    const got = productFiles(root, root).map((p) => path.relative(root, p).split(path.sep).join('/')).sort()
    fs.rmSync(root, { recursive: true, force: true })
    expect(got).toEqual(['src/a.ts', 'src/b.tsx', 'src/c.mts', 'src/d.cts', 'src/deep/coverage/g.ts', 'src/e.js', 'src/f.mjs'])
  })
  test('R62 the repo scan reads product files under src (sentinel: src/modules/auth/testusers/engine.ts)', () => {
    const files = SRC()
    expect(files.length).toBeGreaterThan(10)
    expect(files.map((f) => f.name)).toContain('src/modules/auth/testusers/engine.ts')
    expect(files.some((f) => /\.(test|spec)\./.test(f.name))).toBe(false)
  })
})

// ---------- R62 ----------
describe('R62 every *_ENGINE setting is declared and no stand-in is chosen by silence in production (SEC-11, ARC-6, ARC-20)', () => {
  test('R62 rule: a planted file reading an undeclared engine setting is caught, and its declared twin passes', () => {
    const planted = [{ name: 'planted.ts', text: fix('planted-r62-undeclared.ts.txt') }]
    expect(undeclaredProblems(planted, 'const schema = z.object({})')).toEqual([
      { file: 'planted.ts', text: 'PLANTED_ENGINE is read but not declared in src/core/env.ts' },
    ])
    expect(undeclaredProblems(planted, fix('clean-r62-env.ts.txt'))).toEqual([])
  })

  test('R62 rule (A452 item 7): a destructured read and a name built in a template literal or by concatenation are caught', () => {
    const planted = [{ name: 'planted.ts', text: fix('planted-r62-escapes.ts.txt') }]
    expect(undeclaredProblems(planted, fix('clean-r62-env.ts.txt'))).toEqual([
      { file: 'planted.ts', text: 'DESTRUCTURED_ENGINE is read but not declared in src/core/env.ts' },
      { file: 'planted.ts', text: 'an *_ENGINE name is built from parts (return env[`${kind}_ENGINE`]): read the setting by its full name' },
      { file: 'planted.ts', text: "an *_ENGINE name is built from parts (return env[kind + '_ENGINE']): read the setting by its full name" },
    ])
  })

  test('R62 rule (A452 item 7): a NOT_SETTINGS line excuses only its own file and name, and goes stale when the name is gone', () => {
    const files = [{ name: 'src/x.ts', text: 'const STAMP_ENGINE = { name: "x" }\n' }]
    const ok = { 'src/x.ts#STAMP_ENGINE': 'an engine stamp constant, not a setting' }
    expect(undeclaredProblems(files, '', ok)).toEqual([])
    expect(undeclaredProblems([{ name: 'src/y.ts', text: files[0].text }], '', ok)).toEqual([
      { file: 'src/y.ts', text: 'STAMP_ENGINE is read but not declared in src/core/env.ts' },
      { file: 'src/x.ts', text: 'NOT_SETTINGS src/x.ts#STAMP_ENGINE is no longer read there: remove the line' },
    ])
  })

  test('R62 every *_ENGINE token in a product file is a setting declared in src/core/env.ts or a reviewed NOT_SETTINGS line', () => {
    const files = SRC()
    expect(engineSettings(files, ENV_TEXT()).declared.has('AUTH_ENGINE')).toBe(true)
    expect(engineSettings(files, ENV_TEXT()).read.map((r) => r.setting)).toContain('AUTH_ENGINE')
    expect(Object.keys(NOT_SETTINGS)).toEqual(['src/modules/sheets/index.ts#CSV_ENGINE'])
    expect(applyKnown('R62-declared', undeclaredProblems(files, ENV_TEXT(), NOT_SETTINGS), KNOWN)).toEqual([])
  })

  test('R62 rule: a planted factory with ?? standin accepts production silence and is caught; the clean twin refuses naming the setting', async () => {
    const planted = await load(path.join(FIX, 'planted-r62-factory.mjs'))
    const clean = await load(path.join(FIX, 'clean-r62-factory.mjs'))
    expect(await productionProblems('PLANTED_ENGINE', 'planted-r62-factory.mjs', planted.createPlantedAdapter)).toEqual([
      { file: 'planted-r62-factory.mjs', text: 'PLANTED_ENGINE: with NODE_ENV=production and the setting unset the factory did not refuse' },
      { file: 'planted-r62-factory.mjs', text: 'PLANTED_ENGINE: with NODE_ENV=production and the setting blank the factory did not refuse' },
    ])
    expect(await productionProblems('CLEAN_ENGINE', 'clean-r62-factory.mjs', clean.createCleanAdapter)).toEqual([])
    expect(await productionProblems('CLEAN_ENGINE', 'x.mjs', () => { throw new Error('refused') })).toEqual([
      { file: 'x.mjs', text: 'CLEAN_ENGINE: the factory refused production (setting unset) without naming the setting' },
      { file: 'x.mjs', text: 'CLEAN_ENGINE: the factory refused production (setting blank) without naming the setting' },
    ])
  })

  test("R62 rule (A452 item 9, L3): a planted factory that refuses an unset setting but takes a blank '' is caught", async () => {
    const planted = await load(path.join(FIX, 'planted-r62-blank.mjs'))
    expect(await productionProblems('BLANK_ENGINE', 'planted-r62-blank.mjs', planted.createBlankAdapter)).toEqual([
      { file: 'planted-r62-blank.mjs', text: 'BLANK_ENGINE: with NODE_ENV=production and the setting blank the factory did not refuse' },
    ])
  })

  // One entry per factory in INVENTORY.factories. createAuth outside production needs a database: security-rules.db.test.ts.
  const FACTORIES = [
    {
      name: 'createAuth',
      file: 'src/modules/auth/index.ts',
      // production refuses before the database is touched, so no database is given (the unit twin of the db test)
      make: async (env) => (await load(path.join(ROOT, 'src/modules/auth/index.ts'))).createAuth({ db: undefined, env }),
      productionOnly: true,
    },
    {
      name: 'createReadingAdapter',
      file: 'src/modules/ocr/index.ts',
      make: async (env) => (await load(path.join(ROOT, 'src/modules/ocr/index.ts'))).createReadingAdapter({ env }),
    },
    {
      name: 'createDriveStandIn',
      file: 'src/modules/storage/drive/index.ts',
      make: async (env) => (await load(path.join(ROOT, 'src/modules/storage/drive/index.ts'))).createDriveStandIn({ root: os.tmpdir(), env }),
    },
    {
      name: 'createFileStore',
      file: 'src/modules/storage/files/index.ts',
      make: async (env) => (await load(path.join(ROOT, 'src/modules/storage/files/index.ts'))).createFileStore({ root: os.tmpdir(), env }),
    },
  ].map((f) => ({ ...f, setting: INVENTORY.factories[f.name] }))

  test('R62 the factory list here equals INVENTORY.factories, every setting read in src has a factory, and every factory still reads its setting', () => {
    expect(FACTORIES.map((f) => f.name).sort()).toEqual(Object.keys(INVENTORY.factories).sort())
    const files = SRC()
    const read = new Set(engineSettings(files, '').read.filter((r) => !(`${r.file}#${r.setting}` in NOT_SETTINGS)).map((r) => r.setting))
    const registered = new Set(Object.values(INVENTORY.factories))
    expect([...read].filter((s) => !registered.has(s)).sort()).toEqual([])
    expect([...registered].filter((s) => !read.has(s)).sort()).toEqual([])
    for (const f of FACTORIES) expect(files.find((x) => x.name === f.file)?.text, f.file).toMatch(new RegExp(`\\b${f.setting}\\b`))
    for (const f of FACTORIES) expect(createExports(files).some((e) => e.name === f.name && e.file === f.file && e.declared), f.name).toBe(true)
  })

  test("R62 with NODE_ENV=production and the setting unset or blank '' every adapter factory refuses naming it", async () => {
    const problems = []
    for (const f of FACTORIES) problems.push(...(await productionProblems(f.setting, f.file, f.make)))
    expect(applyKnown('R62-production', problems, KNOWN)).toEqual([])
  })

  test('R62 outside production an unset setting still selects the stand-in (development, test)', async () => {
    for (const f of FACTORIES.filter((x) => !x.productionOnly)) {
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
})

// ---------- tags (A452 item 6) ----------
describe('R63 R64 R65 tags parse strictly and equal the registries', () => {
  test('R63 R64 R65 rule: a planted file with one tag of each kind is read, and a registry gap in either direction is caught', () => {
    const files = [{ name: 'planted-tags.ts', text: fix('planted-tags.ts.txt') }]
    expect(scanTags(files).problems).toEqual([])
    expect(taggedExports('once', files)).toEqual([{ key: 'planted-tags.ts#claimOnce' }])
    expect(taggedExports('limit', files)).toEqual([{ key: 'planted-tags.ts#tryThree', n: 3 }])
    expect(taggedExports('standin', files)).toEqual([{ key: 'planted-tags.ts#seedPlanted' }])
    expect(tagProblems(taggedExports('once', files), [])).toEqual(['planted-tags.ts#claimOnce: tagged but missing from the registry'])
    expect(tagProblems([], [{ key: 'x.ts#f' }])).toEqual(['x.ts#f: in the registry but its export lacks the tag'])
    expect(tagProblems(taggedExports('limit', files), [{ key: 'planted-tags.ts#tryThree', n: 4 }])).toEqual([
      'planted-tags.ts#tryThree: the tag says limit 3 but the registry says 4',
    ])
    expect(tagProblems(taggedExports('limit', files), [{ key: 'planted-tags.ts#tryThree', n: 3 }])).toEqual([])
  })

  test('R63 R64 R65 rule (A452 item 6): a one-line JSDoc, trailing text, a bare tag, a // tag and a plain block tag are each a problem and read as no tag', () => {
    const files = [{ name: 'planted.ts', text: fix('planted-tags-malformed.ts.txt') }]
    const { tagged, problems } = scanTags(files)
    expect(tagged).toEqual({ standin: [], once: [], limit: [] })
    expect(problems).toEqual([
      { file: 'planted.ts', text: 'a @once mention that is not a strict tag line: "/** @once oneLine */"' },
      { file: 'planted.ts', text: 'a @once mention that is not a strict tag line: "* @once trailing and more"' },
      { file: 'planted.ts', text: 'a @limit mention that is not a strict tag line: "* @limit bare"' },
      { file: 'planted.ts', text: 'a @standin mention that is not a strict tag line: "// @standin slashed"' },
      { file: 'planted.ts', text: 'a @once mention that is not a strict tag line: "* @once plainBlock"' },
    ])
  })

  test('R63 R64 R65 every mention of @standin, @once or @limit in a product file is a strict tag line', () => {
    const files = SRC()
    expect(taggedExports('once', files).length).toBeGreaterThan(0)
    expect(applyKnown('R63-tags', scanTags(files).problems, KNOWN)).toEqual([])
  })

  test('R63 R64 R65 the tags in src equal REGISTRY in both directions (the db file runs each registry entry)', () => {
    const files = SRC()
    for (const kind of ['standin', 'once', 'limit']) expect(tagProblems(taggedExports(kind, files), REGISTRY[kind]), kind).toEqual([])
  })

  test('R64 rule (A452 item 9): a LANDING card whose folder exists with no once entry under it is caught', () => {
    const landing = [{ rule: 'R64', card: 'T08', dir: 'src/modules/approval', what: 'approve, tagged @once' }]
    expect(landingProblems(landing, [], () => true)).toEqual(['T08: landed (src/modules/approval, approve, tagged @once) with no R64 registry entry under it'])
    expect(landingProblems(landing, [{ key: 'src/modules/approval/approve.ts#approve' }], () => true)).toEqual([])
    expect(landingProblems(landing, [], () => false)).toEqual([])
  })

  test('R64 the LANDING list names T08 approve and E00 intake, and every landed folder has its once entry', () => {
    expect(LANDING.map((l) => `${l.rule} ${l.card} ${l.dir}`)).toEqual(['R64 T08 src/modules/approval', 'R64 E00 src/modules/documents/intake'])
    expect(landingProblems(LANDING, REGISTRY.once, (d) => fs.existsSync(path.join(ROOT, d)))).toEqual([])
  })
})

// ---------- the create* inventory (A452 item 8) ----------
describe('R62 R63 every exported create* under src/modules is a factory, not an adapter, or a stand-in behind its factory', () => {
  test('R62 R63 rule: an unlisted create*, a stand-in named outside its module, and an untagged stand-in that takes a database are caught', () => {
    const inv = {
      factories: { createPlantedAdapter: 'PLANTED_ENGINE' },
      notAdapter: {},
      behindFactory: { createPlantedStandIn: { factory: 'createPlantedAdapter', module: 'src/modules/planted' } },
    }
    const files = [
      { name: 'src/modules/planted/index.ts', text: 'export function createPlantedAdapter(env: Env) { return createPlantedStandIn({ db }) }\nexport function createStray() {}\n' },
      { name: 'src/modules/planted/standin.ts', text: fix('planted-untagged-standin.ts.txt') },
      { name: 'src/app/page.ts', text: fix('planted-import-standin.ts.txt') },
    ]
    expect(inventoryProblems(files, inv)).toEqual([
      { file: 'src/modules/planted/index.ts', text: 'exports createStray, which is on no list (FACTORY, NOT_ADAPTER or BEHIND_FACTORY)' },
      { file: 'src/app/page.ts', text: 'names createPlantedStandIn, a stand-in reached only through createPlantedAdapter inside src/modules/planted' },
      { file: 'src/modules/planted/standin.ts', text: 'createPlantedStandIn takes a database but carries no @standin tag' },
    ])
    const tagged = fix('planted-untagged-standin.ts.txt').replace('export function createPlantedStandIn', '/**\n * @standin createPlantedStandIn\n */\nexport function createPlantedStandIn')
    expect(inventoryProblems([files[0], { name: files[1].name, text: tagged }], { ...inv, notAdapter: { createStray: 'planted' } })).toEqual([])
  })

  test('R62 R63 rule: a listed name nobody exports is stale, and a stand-in naming an unlisted factory is caught', () => {
    const inv = { factories: {}, notAdapter: { createGone: 'x' }, behindFactory: { createLost: { factory: 'createNowhere', module: 'src/modules/l' } } }
    expect(inventoryProblems([{ name: 'src/modules/l/a.ts', text: 'export const createLost = () => 1\n' }], inv)).toEqual([
      { file: 'src/modules', text: 'createGone is listed but no file under src/modules exports it: remove the line' },
      { file: 'src/modules/l', text: 'createLost names createNowhere, which is not a listed factory' },
    ])
  })

  test('R62 R63 the inventory covers every exported create* in src/modules (sentinels: createAuth, createTestUsersAuth, createRecordedEngine)', () => {
    const files = SRC()
    const names = createExports(files.filter((f) => f.name.startsWith('src/modules/'))).map((e) => e.name)
    for (const s of ['createAuth', 'createTestUsersAuth', 'createRecordedEngine']) expect(names).toContain(s)
    expect(Object.keys(INVENTORY.behindFactory).sort()).toEqual(['createRecordedEngine', 'createTestUsersAuth', 'createTextLayerEngine'])
    expect(applyKnown('R62-inventory', inventoryProblems(files), KNOWN)).toEqual([])
  })
})

// ---------- R63 to R65 twins (the db file runs the same harness on a database) ----------
describe('R63 R64 R65 unit twins of the race and stand-in harnesses (A391)', () => {
  const store = () => {
    const rows = []
    return { rows, addRealRow: async () => { rows.push({ is_test: false }) }, count: async () => rows.length }
  }
  test('R63 rule twin: a planted seeder that does not look is caught, and one that refuses passes', async () => {
    const a = store()
    expect(await standinProblems('planted#seed', 'planted_people', a, async () => { a.rows.push({ is_test: true }) })).toEqual([
      'planted#seed: started on a database holding a real row in planted_people',
      'planted#seed: wrote rows into planted_people next to a real row',
    ])
    const b = store()
    const clean = async () => {
      if (b.rows.some((r) => !r.is_test)) throw new Error('refuses to start: the database holds a real row')
      b.rows.push({ is_test: true })
    }
    expect(await standinProblems('planted#seed', 'planted_people', b, clean)).toEqual([])
  })

  test('R63 createAuth (testusers) on a database reporting a real staff user refuses before any write', async () => {
    const queries = []
    const db = {
      query: async (sql) => {
        queries.push(sql)
        return { rows: [{ n: 1 }] }
      },
      exec: async (sql) => { queries.push(sql) },
      transaction: async () => { throw new Error('no transaction expected') },
    }
    const { createAuth } = await load(path.join(ROOT, 'src/modules/auth/index.ts'))
    await expect(createAuth({ db, env: {}, clock: { now: () => new Date('2026-10-02T14:00:05Z') } })).rejects.toThrow(/real staff user/)
    expect(queries.filter((q) => /\b(insert|update|delete)\b/i.test(q))).toEqual([])
    expect(queries.length).toBeGreaterThan(0)
  })

  test('R64 rule twin: a read-then-insert lets many of 8 through, a check-and-set exactly one, and none is "proves nothing"', async () => {
    const planted = {
      key: 'planted#claim',
      setup: async () => ({ claimed: new Set() }),
      call: async (ctx) => {
        const seen = ctx.claimed.has('c1')
        await tick()
        if (seen) return false
        ctx.claimed.add('c1')
        return true
      },
    }
    expect(await onceProblems(planted, null)).toEqual(['planted#claim: 8 of 8 parallel calls got through, at most 1 allowed'])
    const clean = { ...planted, call: async (ctx) => { if (ctx.claimed.has('c1')) return false; ctx.claimed.add('c1'); await tick(); return true } }
    expect(await onceProblems(clean, null)).toEqual([])
    expect(await onceProblems({ ...planted, call: async () => false }, null)).toEqual(['planted#claim: no call got through, so the entry proves nothing'])
  })

  test('R65 rule twin: a check-then-record counter lets all 6 through, the serialised one exactly 3, and a count from the store wins over returns', async () => {
    const planted = {
      key: 'planted#attempt',
      setup: async (db) => db,
      call: async (ctx) => {
        const n = ctx.attempts.length
        await tick()
        if (n >= 3) return false
        ctx.attempts.push(1)
        return true
      },
    }
    expect(await limitProblems(planted, 3, { attempts: [] })).toEqual(['planted#attempt: 6 of 6 parallel attempts got through, at most 3 allowed'])
    const clean = { ...planted, call: async (ctx) => { if (ctx.attempts.length >= 3) return false; ctx.attempts.push(1); await tick(); return true } }
    expect(await limitProblems(clean, 3, { attempts: [] })).toEqual([])
    // the calls claim nothing got through, but the store counts 6
    const liar = { ...planted, call: async (ctx) => { ctx.attempts.push(1); return false } }
    expect(await limitProblems(liar, 3, { attempts: [] }, async (db) => db.attempts.length)).toEqual(['planted#attempt: 6 of 6 parallel attempts got through, at most 3 allowed'])
    expect(await limitProblems({ ...planted, call: async () => false }, 3, { attempts: [] })).toEqual(['planted#attempt: no attempt got through, so the entry proves nothing'])
  })
})

// ---------- R66 twins (A452 items 1 to 5) ----------
const T = { ROW: 1, BEFORE: 2, DELETE: 8, UPDATE: 16, TRUNCATE: 32 }
const rowGuard = (table, fn) => ({ table, fn, tgtype: T.ROW | T.BEFORE | T.UPDATE | T.DELETE })
const truncGuard = (table, fn) => ({ table, fn, tgtype: T.BEFORE | T.TRUNCATE })
const GUARD_SRC = "begin raise exception 'append-only: % on returns.% is refused', tg_op, tg_table_name; end"
const cols = (table, list) => list.map(([col, text], i) => ({ table, col, attnum: i + 1, text }))

describe('R66 unit twins: append-only by behaviour, per-column checks, string types, the reviewed lists (FLOW-1, SEC-11)', () => {
  test('R66 rule twin (item 1): a table guarded by any function on BEFORE ROW DELETE and BEFORE TRUNCATE is append-only; row-only, AFTER and INSERT guards are not', () => {
    const cat = {
      triggers: [
        rowGuard('planted_ledger', 'planted_guard'), truncGuard('planted_ledger', 'planted_guard'),
        rowGuard('planted_notes', 'refuse_change'),
        { table: 'planted_after', fn: 'f', tgtype: T.ROW | T.DELETE }, truncGuard('planted_after', 'f'),
        { table: 'planted_insert', fn: 'f', tgtype: T.ROW | T.BEFORE | T.UPDATE }, truncGuard('planted_insert', 'f'),
      ],
      functions: [{ name: 'refuse_change', src: GUARD_SRC }, { name: 'planted_guard', src: "begin raise exception 'planted guard'; end" }, { name: 'f', src: 'begin return old; end' }],
      columns: [...cols('planted_ledger', [['id', true], ['author', true]]), ...cols('planted_notes', [['id', true], ['note', true]])],
      constraints: [{ table: 'planted_ledger', type: 'p', cols: [1], def: 'PRIMARY KEY (id)' }],
    }
    expect(appendOnlyTables(cat)).toEqual(['planted_ledger'])
    expect(freeText(cat)).toEqual(['planted_ledger.author'])
    expect(appendOnlyGuardProblems(cat)).toEqual(['planted_notes: guarded by refuse_change but not found append-only (no BEFORE ROW DELETE and BEFORE TRUNCATE pair)'])
    expect(appendOnlyGuardProblems({ ...cat, functions: [...cat.functions, { name: 'idle_guard', src: GUARD_SRC }] })).toContain('idle_guard: raises append-only but guards no table')
  })

  test('R66 rule twin (item 2): only a list, a match or a format function on the column itself vouches for it', () => {
    // definitions as pg_get_constraintdef prints them
    expect(checkVouches("CHECK ((status = ANY (ARRAY['a'::text, 'b'::text])))", 'status')).toBe(true)
    expect(checkVouches("CHECK (((kind)::text = ANY ((ARRAY['a'::character varying])::text[])))", 'kind')).toBe(true)
    expect(checkVouches("CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))", 'token_hash')).toBe(true)
    expect(checkVouches("CHECK ((roles <@ ARRAY['preparer'::text]))", 'roles')).toBe(true)
    expect(checkVouches('CHECK (((fact_id IS NULL) OR returns.is_handoff_id(fact_id)))', 'fact_id')).toBe(true)
    expect(checkVouches('CHECK (returns.handoff_ids_ok(choice_ids))', 'choice_ids')).toBe(true)
    // the plants
    expect(checkVouches("CHECK (((listed = ANY (ARRAY['a'::text, 'b'::text])) AND (neighbour IS NOT NULL)))", 'neighbour')).toBe(false)
    expect(checkVouches("CHECK (((listed = ANY (ARRAY['a'::text, 'b'::text])) AND (neighbour IS NOT NULL)))", 'listed')).toBe(true)
    expect(checkVouches("CHECK ((not_match !~ '^$'::text))", 'not_match')).toBe(false)
    expect(checkVouches("CHECK ((NOT (negated ~ '^x'::text)))", 'negated')).toBe(false)
    expect(checkVouches('CHECK ((NOT returns.is_blank(blank_only)))', 'blank_only')).toBe(false)
    expect(checkVouches('CHECK ((NOT returns.is_handoff_id(not_format)))', 'not_format')).toBe(false)
    expect(checkVouches("CHECK ((name ~~ 'a%'::text))", 'name')).toBe(false)
    expect(checkVouches("CHECK ((source_actor ~ '^x'::text))", 'actor')).toBe(false)
    expect(checkVouches('CHECK ((num_nonnulls(a, actor) = 1))', 'actor')).toBe(false)
    expect(checkVouches('CHECK (returns.is_blank(x))', 'x', ['is_blank'])).toBe(false)
  })

  test('R66 rule twin (item 2): a format function must hold a match or a list, or call one that does; is_blank is never one', () => {
    const cat = {
      triggers: [],
      columns: [],
      constraints: [],
      functions: [
        { name: 'is_handoff_id', src: "select s ~ '^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,79}$'" },
        { name: 'handoff_ids_ok', src: 'select a is not null and not exists (select 1 from unnest(a) x where not returns.is_handoff_id(x))' },
        { name: 'is_blank', src: "select s ~ '^[ ]*$'" },
        { name: 'looks_ok', src: 'select length(s) < 80' },
        { name: 'not_match', src: "select s !~ '^$'" },
      ],
    }
    expect(formatFunctionProblems(cat, ['is_handoff_id', 'handoff_ids_ok'])).toEqual([])
    expect(formatFunctionProblems(cat, ['is_blank', 'looks_ok', 'not_match', 'gone'])).toEqual([
      'is_blank: never a format function',
      'gone: no such function in the database',
      'looks_ok: its source holds no ~ match or = ANY list and calls no format function that does',
      'not_match: its source holds no ~ match or = ANY list and calls no format function that does',
    ])
    expect(Object.keys(FORMAT_FUNCTIONS).sort()).toEqual(['handoff_ids_ok', 'is_handoff_id'])
    expect(NEVER_FORMAT).toEqual(['is_blank'])
  })

  test('R66 rule twin (items 1 to 3): text columns of an append-only table are free unless keyed, a single-column primary key, or vouched; non-text never', () => {
    const cat = {
      triggers: [rowGuard('planted_x', 'refuse_change'), truncGuard('planted_x', 'refuse_change'), rowGuard('open_y', 'g')],
      functions: [{ name: 'refuse_change', src: GUARD_SRC }],
      columns: [
        ...cols('planted_x', [['id', true], ['parent_id', true], ['kind', true], ['n', false], ['note', true], ['pair_a', true], ['pair_b', true]]),
        ...cols('open_y', [['note', true]]),
      ],
      constraints: [
        { table: 'planted_x', type: 'p', cols: [1], def: 'PRIMARY KEY (id)' },
        { table: 'planted_x', type: 'f', cols: [2], def: 'FOREIGN KEY (parent_id) REFERENCES returns.p(id)' },
        { table: 'planted_x', type: 'c', cols: [3], def: "CHECK ((kind = ANY (ARRAY['a'::text])))" },
        { table: 'planted_x', type: 'c', cols: [5], def: 'CHECK ((NOT returns.is_blank(note)))' },
        { table: 'planted_x', type: 'u', cols: [6, 7], def: 'UNIQUE (pair_a, pair_b)' },
        { table: 'planted_x', type: 'p', cols: [6, 7], def: 'PRIMARY KEY (pair_a, pair_b)' },
      ],
    }
    expect(freeText(cat)).toEqual(['planted_x.note', 'planted_x.pair_a', 'planted_x.pair_b'])
  })

  test('R66 rule (item 4): a reviewed free-text line whose reason postpones the work is refused', () => {
    expect(postponedReasonProblems({ 'events.actor': 'a staff user id; a key to staff_users waits on V00', 'a.b': 'free by nature, typed by a person' })).toEqual([
      'events.actor: the reason postpones ("waits on"): a deferred column is a KNOWN entry with an owner card',
    ])
    for (const word of ['until V00', 'later', 'a candidate for a key']) expect(postponedReasonProblems({ 'a.b': `the value is free ${word}` })).toHaveLength(1)
    expect(postponedReasonProblems({ 'a.b': 'short' })).toEqual(['a.b: the reason is too short to review'])
  })

  test('R66 every FREE_TEXT reason names why the value is free, and no FREE_TEXT column is also an R66 KNOWN entry', () => {
    expect(Object.keys(FREE_TEXT).length).toBeGreaterThan(0)
    expect(postponedReasonProblems(FREE_TEXT)).toEqual([])
    const known = KNOWN.filter((k) => k.rule === 'R66').flatMap((k) => k.problems)
    expect(Object.keys(FREE_TEXT).filter((c) => known.includes(r66Problem(c)))).toEqual([])
  })

  test('R66 rule twin: problems are filed under the schema file that creates the table, and KNOWN covers them exactly', () => {
    const files = tableFiles([{ name: 'sql/20_x.sql', text: 'create table returns.facts (\n  id text primary key\n);\ncreate table if not exists returns.events (id text);' }])
    expect(files).toEqual(new Map([['facts', 'sql/20_x.sql'], ['events', 'sql/20_x.sql']]))
    const problems = r66Problems(['facts.fact_key', 'events.reason'], files, { 'events.reason': 'why it is free by nature' })
    expect(problems).toEqual([{ file: 'sql/20_x.sql', text: 'facts.fact_key is text in an append-only table with no key, list or format' }])
    expect(applyKnown('R66', problems, [{ rule: 'R66', file: 'sql/20_x.sql', owner: 'L00', problems: [r66Problem('facts.fact_key')] }])).toEqual([])
  })

  test('R66 the R66 KNOWN entries are the deferred columns of A452 item 5, by owner (L00, B05, FX17)', () => {
    const byOwner = {}
    for (const k of KNOWN.filter((x) => x.rule === 'R66')) byOwner[k.owner] = [...(byOwner[k.owner] ?? []), ...k.problems.map((p) => p.split(' ')[0])].sort()
    expect(byOwner).toEqual({
      B05: ['adjusting_entries.qbo_snapshot_id', 'gifi_mappings.gifi_code'],
      FX17: ['adjusting_entries.author', 'approvals.approved_by', 'events.actor', 'judgment_inputs.author', 'state_events.actor'],
      L00: ['facts.fact_key', 'facts.method', 'facts.source_client_answer_id', 'facts.source_column', 'facts.source_cra_capture_id', 'facts.source_prior_return_id', 'facts.source_qbo_snapshot_id'],
    })
  })
})

// ---------- KNOWN ----------
describe('KNOWN entries (A407, R80 form)', () => {
  test('R62 KNOWN entries are one rule, one file, exact strings and an open owner card whose Paths hold the file or the fix', () => {
    expect(knownShapeProblems(KNOWN, cardsMap(), (f) => fs.existsSync(path.join(ROOT, f)))).toEqual([])
  })

  test('R62 rule: a KNOWN entry with a done owner, a file outside its owner Paths, an unknown owner or no problems is refused; a named fix in the Paths is accepted', () => {
    const cards = new Map([
      ['A06', { status: 'done', paths: ['src/modules/auth/**'] }],
      ['L00', { status: 'carded', paths: ['src/modules/ledger/core/**', 'sql/20_ledger.sql'] }],
      ['FX17', { status: 'carded', paths: ['sql/94_actor_keys.sql'] }],
    ])
    const exists = () => true
    expect(knownShapeProblems([{ rule: 'R62-production', file: 'src/modules/auth/index.ts', owner: 'A06', problems: ['x'] }], cards, exists)).toEqual([
      'R62-production src/modules/auth/index.ts: owner A06 is done, so nothing will clear the entry',
    ])
    expect(knownShapeProblems([{ rule: 'R66', file: 'sql/30_books.sql', owner: 'L00', problems: ['x'] }], cards, exists)).toEqual([
      'R66 sql/30_books.sql: sql/30_books.sql is outside the Paths of owner L00',
    ])
    expect(knownShapeProblems([{ rule: 'R66', file: 'sql/20_ledger.sql', owner: 'FX17', problems: ['x'] }], cards, exists)).toEqual([
      'R66 sql/20_ledger.sql: sql/20_ledger.sql is outside the Paths of owner FX17',
    ])
    expect(knownShapeProblems([{ rule: 'R66', file: 'sql/20_ledger.sql', owner: 'FX17', fix: 'sql/94_actor_keys.sql', problems: ['x'] }], cards, exists)).toEqual([])
    expect(knownShapeProblems([{ rule: 'R66', file: 'sql/20_ledger.sql', owner: 'L00', problems: ['x'] }], cards, exists)).toEqual([])
    expect(knownShapeProblems([{ rule: 'R99', file: 'a', owner: 'ZZ9', problems: [] }], cards, () => false)).toEqual([
      'R99 a: the rule is not one of R62 to R66',
      'R99 a: the file does not exist',
      'R99 a: lists no problem',
      'R99 a: owner ZZ9 is not a card in plan/slices.json',
    ])
    expect(knownShapeProblems([{ rule: 'R66', file: 'sql/20_ledger.sql', owner: 'L00', problems: ['x', 'x'] }], cards, exists)).toEqual([
      'R66 sql/20_ledger.sql: "x" is listed twice',
    ])
  })

  test('R62 rule: card Paths parse with notes dropped, and globs match whole paths only', () => {
    expect(cardPaths('# X\nPaths: src/a/**, sql/20_ledger.sql (adds a column), tools/x.mjs\n')).toEqual(['src/a/**', 'sql/20_ledger.sql', 'tools/x.mjs'])
    expect(pathMatches('src/a/**', 'src/a/b/c.ts')).toBe(true)
    expect(pathMatches('src/a/*.ts', 'src/a/b/c.ts')).toBe(false)
    expect(pathMatches('sql/20_ledger.sql', 'sql/20_ledger.sqlx')).toBe(false)
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
    expect(applyKnown('R62-declared', [], KNOWN)).toEqual([])
  })
})
