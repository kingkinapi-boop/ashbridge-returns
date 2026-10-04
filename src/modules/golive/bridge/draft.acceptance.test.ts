// GL3 acceptance tests, the unit side (spec-writer; builders never edit this file). Card plan/cards/GL3.md.
// The database side (the views, the grants, the policy, the catalog scans and the probe on the stand-in) is
// draft.acceptance.db.test.ts; every behaviour of the module's code proven there has a twin here (A391),
// because mutation testing runs the unit project only.
//
// The shapes these tests fix (the builder matches them; amber, listed in the spec report):
// - db/bridge/: 0001_bridge_views.sql (schema bridge, one view per contract view), 0002_grants.sql (grants and
//   the client_handoff policy), views.json (shape in __fixtures__/views-manifest.ts), README.md.
// - src/modules/golive/bridge/index.ts exports:
//     applyDraft(db: PGlite): Promise<void>         applies 0001 then 0002 (the stand-in is the test's)
//     parseViewsManifest(raw: unknown): ViewsManifest   strict: an unknown key anywhere throws
//     readViewsManifest(): ViewsManifest             db/bridge/views.json through parseViewsManifest
//     NEVER_READ: { tables: readonly string[]; columns: readonly { table: string; column: string }[] }
//     neverReadFindings(deps: readonly ViewDependency[]): ViewDependency[]
//         ViewDependency = { view: string; table: string; column: string | null } (column null: the whole
//         table is referenced); returns the deps on a never-read table (any column) or a never-read column,
//         in input order
//     viewDependencies(db): Promise<ViewDependency[]>   every view in schema bridge, from the catalog
//     findNeverRead(db): Promise<ViewDependency[]>      neverReadFindings(await viewDependencies(db))
//     draftReads(m: ViewsManifest): { table, column }[]  every source and alsoReads entry of every view,
//         deduplicated, sorted by table then column in plain string order
//     missingColumns(reads, present): { table, column }[]  the reads not present, in the order of reads
//     probeClientSchema(db): Promise<{ reads, missing, clean }>  reads = draftReads(readViewsManifest());
//         present from information_schema (schema public); select statements on the catalog only
//     findSentenceLiterals(sql: string, file: string): { file, line, literal }[]  every string literal
//         (single-quoted, '' unescaped, or dollar-quoted) holding whitespace (a space, tab or line break);
//         comments and "quoted identifiers" are not literals; line is 1-based, of the literal's opening quote;
//         literal is the value
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { BRIDGE_CONTRACT, BRIDGE_SHAPES } from '../../../contracts/bridge'
import {
  NEVER_READ,
  draftReads,
  findSentenceLiterals,
  missingColumns,
  neverReadFindings,
  parseViewsManifest,
  readViewsManifest,
  type ViewDependency,
} from './index'
import {
  REPO_ROOT,
  contractCites,
  contractHasCite,
  contractV1Tables,
  contractViewNames,
  neverReadPairs,
  neverReadTables,
} from './__fixtures__/contract'
import { DRAFT_DIR, DRAFT_SQL_FILES, allReads, byTableThenColumn, manifest, rawManifest, viewReads, type Manifest } from './__fixtures__/views-manifest'

const SEED = 20261003
const KEY_COLUMNS = ['id', 'corporation_id']

function viewOf(m: Manifest, name: string): Manifest['views'][number] {
  const v = m.views.find((x) => x.name === name)
  if (v === undefined) throw new Error(`views.json has no view ${name}`)
  return v
}

/** F07 fit: every field of a shape is a view column or a derived field of the same-named view. */
function fitProblems(m: Manifest): string[] {
  const problems: string[] = []
  for (const shape of ['corporation', 't2_return'] as const) {
    const view = m.views.find((v) => v.name === shape)
    const have = new Set([...(view?.columns.map((c) => c.name) ?? []), ...(view?.derived.map((d) => d.field) ?? [])])
    for (const field of Object.keys(BRIDGE_SHAPES[shape].shape)) {
      if (!have.has(field)) problems.push(`${shape}.${field} is neither a view column nor derived`)
    }
  }
  return problems
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

describe('GL3 views.json (ARC-2)', () => {
  test('ARC-2 views.json parses with the strict shape and names the contract each view comes from', () => {
    const m = manifest()
    expect(m.views.length).toBeGreaterThan(0)
    expect(new Set(m.views.map((v) => v.name)).size).toBe(m.views.length)
    for (const v of m.views) expect(new Set(v.columns.map((c) => c.name)).size, `${v.name} repeats a column`).toBe(v.columns.length)
  })

  test('ARC-2 the build reads views.json strictly: the file round-trips, and an unknown key at any level is refused', () => {
    expect(readViewsManifest()).toEqual(manifest())
    expect(parseViewsManifest(rawManifest())).toEqual(manifest())
    const top = { ...clone(manifest()), note: 'x' }
    expect(() => parseViewsManifest(top)).toThrow()
    const inView = clone(manifest())
    ;(inView.views[0] as unknown as Record<string, unknown>)['note'] = 'x'
    expect(() => parseViewsManifest(inView)).toThrow()
    const inColumn = clone(manifest())
    ;(inColumn.views[0]?.columns[0] as unknown as Record<string, unknown>)['note'] = 'x'
    expect(() => parseViewsManifest(inColumn)).toThrow()
  })

  test('ARC-2 every view the contract heads in section 1 is in views.json, and every v1 table is read by a v1_ view', () => {
    const m = manifest()
    const names = m.views.map((v) => v.name)
    const { exact, prefixes } = contractViewNames()
    for (const n of exact) expect(names, `bridge.${n}`).toContain(n)
    for (const p of prefixes) {
      const read = new Set(m.views.filter((v) => v.name.startsWith(p)).flatMap(viewReads).map((r) => r.table))
      for (const t of contractV1Tables()) expect([...read], `no ${p}* view reads ${t}`).toContain(t)
    }
  })

  test('ARC-2 every view has is_test', () => {
    for (const v of manifest().views) expect(v.columns.map((c) => c.name), `bridge.${v.name}`).toContain('is_test')
  })

  test('ARC-2 every source names its contract cite ("legal_name M0002:50"); only an uncited key column may have none', () => {
    const problems: string[] = []
    for (const v of manifest().views) {
      for (const s of [...v.columns.flatMap((c) => c.sources), ...v.alsoReads]) {
        const column = s.source.split('.')[1] ?? ''
        if (s.cite === null) {
          if (!KEY_COLUMNS.includes(column)) problems.push(`${v.name}: ${s.source} has no cite`)
        } else if (!contractCites(column, s.cite)) {
          problems.push(`${v.name}: ${s.source} ${s.cite} is not in the contract`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  test('ARC-2 rule: a planted source with a cite the contract does not hold, and an uncited non-key column, are caught', () => {
    expect(contractCites('legal_name', 'M0002:50')).toBe(true)
    expect(contractCites('legal_name', 'M0002:5')).toBe(false)
    expect(contractCites('legal_name', 'M0002:51')).toBe(false)
    expect(contractCites('full_name', 'M0002:50')).toBe(false)
  })
})

describe('GL3 fit with F07 (ARC-2)', () => {
  test('ARC-2 every field of BRIDGE_SHAPES.corporation and BRIDGE_SHAPES.t2_return is a view column or derived', () => {
    expect(Object.keys(BRIDGE_SHAPES.corporation.shape)).toContain('legal_name')
    expect(Object.keys(BRIDGE_SHAPES.t2_return.shape)).toContain('tax_year')
    expect(fitProblems(manifest())).toEqual([])
  })

  test('ARC-2 rule: a planted views.json without corporation.legal_name fails naming the field', () => {
    const m = clone(manifest())
    const corp = viewOf(m, 'corporation')
    corp.columns = corp.columns.filter((c) => c.name !== 'legal_name')
    corp.derived = corp.derived.filter((d) => d.field !== 'legal_name')
    expect(fitProblems(m)).toEqual(['corporation.legal_name is neither a view column nor derived'])
  })

  test('ARC-2 each derived field has its rule, a cite the contract holds, and reads only columns of bridge views', () => {
    const m = manifest()
    const columns = new Set(m.views.flatMap((v) => v.columns.map((c) => `${v.name}.${c.name}`)))
    const derived = m.views.flatMap((v) => v.derived.map((d) => ({ view: v.name, ...d })))
    expect(derived.map((d) => `${d.view}.${d.field}`)).toContain('corporation.services')
    for (const d of derived) {
      expect(d.rule.trim(), `${d.view}.${d.field} rule`).not.toBe('')
      expect(contractHasCite(d.cite), `${d.view}.${d.field} cite ${d.cite}`).toBe(true)
      for (const f of d.from) expect([...columns], `${d.view}.${d.field} from ${f}`).toContain(f)
    }
  })

  test('ARC-2 services is derived from the corporation engagements (t2_return.service), as the contract says', () => {
    const services = viewOf(manifest(), 'corporation').derived.find((d) => d.field === 'services')
    expect(services?.from).toContain('t2_return.service')
    expect(viewOf(manifest(), 't2_return').columns.map((c) => c.name)).toContain('corporation_id')
  })
})

describe('GL3 never read (ARC-2, contract section 3)', () => {
  test('ARC-2 NEVER_READ holds every never-read table and every never-read column the contract lists', () => {
    for (const t of neverReadTables()) expect(NEVER_READ.tables).toContain(t)
    for (const p of neverReadPairs()) expect(NEVER_READ.columns, `${p.table}.${p.column}`).toContainEqual(p)
  })

  test('ARC-2 neverReadFindings flags every contract never-read pair and the restricted table with any column or none', () => {
    const deps: ViewDependency[] = [
      ...neverReadPairs().map((p) => ({ view: 'v_pairs', table: p.table, column: p.column })),
      { view: 'v_join', table: 'restricted_data', column: 'corporation_id' },
      { view: 'v_exists', table: 'restricted_data', column: null },
    ]
    expect(neverReadFindings(deps)).toEqual(deps)
  })

  test('ARC-2 neverReadFindings passes columns the contract allows, on never-read tables too, and keeps input order', () => {
    const clean: ViewDependency[] = [
      { view: 'client', table: 'people', column: 'full_name' },
      { view: 'client', table: 'people', column: 'id' },
      { view: 'client', table: 'people', column: null },
      { view: 'flag', table: 'intakes', column: 'quote_reference' },
      { view: 'corporation', table: 'corporations', column: 'business_number' },
    ]
    expect(neverReadFindings(clean)).toEqual([])
    const mixed: ViewDependency[] = [
      { view: 'b', table: 'people', column: 'email' },
      { view: 'a', table: 'people', column: 'full_name' },
      { view: 'a', table: 'links', column: 'token_hash' },
    ]
    expect(neverReadFindings(mixed)).toEqual([mixed[0], mixed[2]])
  })

  test('ARC-2 rule: a column named like a never-read one on another table is not flagged (pairs, not bare names)', () => {
    expect(neverReadFindings([{ view: 'answer', table: 'answers', column: 'email' }])).toEqual([])
    expect(neverReadFindings([{ view: 'flag', table: 'flags', column: 'token_hash' }])).toEqual([])
  })

  test('ARC-2 no view in views.json reads a never-read table or column', () => {
    const tables = neverReadTables()
    const pairs = neverReadPairs()
    const bad = manifest().views.flatMap((v) =>
      viewReads(v)
        .filter((r) => tables.includes(r.table) || pairs.some((p) => p.table === r.table && p.column === r.column))
        .map((r) => `${v.name}: ${r.table}.${r.column}`),
    )
    expect(bad).toEqual([])
  })
})

describe('GL3 the probe, pure side (U9)', () => {
  test('ARC-2 draftReads lists every source and alsoReads column of every view, once, sorted by table then column', () => {
    const m = manifest()
    const reads = draftReads(m)
    expect(reads).toEqual(allReads(m))
    expect(reads).toContainEqual({ table: 'corporations', column: 'financial_year_end' })
  })

  test('ARC-2 draftReads on a small manifest: duplicates across views and branches collapse, alsoReads count', () => {
    const m: Manifest = {
      contract: { ...BRIDGE_CONTRACT },
      views: [
        {
          name: 'b',
          columns: [
            { name: 'x', sources: [{ source: 'zeta.x', cite: null }, { source: 'alpha.x', cite: null }] },
            { name: 'is_test', sources: [{ source: 'alpha.is_test', cite: null }] },
          ],
          alsoReads: [{ source: 'alpha_b.kind', cite: null }],
          derived: [],
        },
        { name: 'a', columns: [{ name: 'x', sources: [{ source: 'alpha.x', cite: null }] }], alsoReads: [], derived: [] },
      ],
    }
    expect(draftReads(m)).toEqual([
      { table: 'alpha', column: 'is_test' },
      { table: 'alpha', column: 'x' },
      { table: 'alpha_b', column: 'kind' },
      { table: 'zeta', column: 'x' },
    ])
  })

  test('ARC-2 missingColumns names each read not present, in the order of reads; a dropped table names all its columns', () => {
    const reads = [
      { table: 'corporations', column: 'financial_year_end' },
      { table: 'corporations', column: 'legal_name' },
      { table: 'flags', column: 'flag' },
      { table: 'flags', column: 'raised_at' },
    ]
    const full = [...reads, { table: 'people', column: 'email' }]
    expect(missingColumns(reads, full)).toEqual([])
    expect(missingColumns(reads, full.filter((c) => c.column !== 'financial_year_end'))).toEqual([reads[0]])
    expect(missingColumns(reads, full.filter((c) => c.table !== 'flags'))).toEqual([reads[2], reads[3]])
    expect(missingColumns(reads, [{ table: 'flags', column: 'legal_name' }, { table: 'corporations', column: 'flag' }])).toEqual(reads)
  })

  test('ARC-2 property (fixed seed): missingColumns is exactly the reads not present, order kept', () => {
    const col = fc.record({ table: fc.constantFrom('a', 'b', 'c'), column: fc.constantFrom('x', 'y', 'z') })
    fc.assert(
      fc.property(fc.uniqueArray(col, { selector: (c) => `${c.table}.${c.column}` }), fc.array(col), (reads, present) => {
        const has = (c: { table: string; column: string }): boolean => present.some((p) => p.table === c.table && p.column === c.column)
        expect(missingColumns(reads, present)).toEqual(reads.filter((r) => !has(r)))
      }),
      { seed: SEED, numRuns: 200 },
    )
  })

  test('ARC-2 the sort the probe reports in is plain string order (corporation_people before corporations)', () => {
    const sorted = [{ table: 'corporations', column: 'id' }, { table: 'corporation_people', column: 'role' }].sort(byTableThenColumn)
    expect(sorted[0]?.table).toBe('corporation_people')
    const reads = draftReads(manifest())
    expect(reads).toEqual([...reads].sort(byTableThenColumn))
  })
})

describe('GL3 contract base (ARC-2, LIVE-6)', () => {
  test('ARC-2 views.json names the client-app commit and last migration equal to BRIDGE_CONTRACT', () => {
    expect(manifest().contract).toEqual({ ...BRIDGE_CONTRACT })
  })

  test('LIVE-6 db/bridge/README.md names the commit and last migration, the apply order after GL2, the probe, the EXPLAIN step and the reader that never bypasses row-level security', () => {
    const readme = fs.readFileSync(path.join(DRAFT_DIR, 'README.md'), 'utf8')
    expect(readme).toContain(BRIDGE_CONTRACT.clientAppCommit)
    expect(readme).toMatch(new RegExp(`last migration[^0-9\\n]{0,20}0*${String(BRIDGE_CONTRACT.lastMigration)}\\b`, 'i'))
    expect(readme).toContain('GL2')
    const first = readme.indexOf('0001_bridge_views.sql')
    const second = readme.indexOf('0002_grants.sql')
    expect(first).toBeGreaterThanOrEqual(0)
    expect(second).toBeGreaterThan(first)
    expect(readme).toContain('probeClientSchema')
    expect(readme).toContain('explainAll')
    expect(readme).toContain('client_app_reader')
    expect(readme).toMatch(/bypass/i)
    expect(readme).toMatch(/row-level security/i)
  })
})

describe('GL3 no client sentence in the draft SQL (END-7)', () => {
  test('END-7 neither draft SQL file holds a string literal with a space', () => {
    for (const f of DRAFT_SQL_FILES) {
      const sql = fs.readFileSync(path.join(DRAFT_DIR, f), 'utf8')
      expect(sql.length, f).toBeGreaterThan(0)
      expect(findSentenceLiterals(sql, f), f).toEqual([])
    }
  })

  test('END-7 the grants file holds the statuses the client app may read, as ids', () => {
    const sql = fs.readFileSync(path.join(DRAFT_DIR, '0002_grants.sql'), 'utf8')
    for (const s of ['sent', 'withdrawn', 'closed']) expect(sql).toContain(`'${s}'`)
  })

  test('END-7 rule: a planted literal sentence is caught by file and line', () => {
    const sql = "grant select on bridge.client to returns_app;\ncomment on view bridge.client is 'The client view';\n"
    expect(findSentenceLiterals(sql, 'planted.sql')).toEqual([{ file: 'planted.sql', line: 2, literal: 'The client view' }])
  })

  test('END-7 rule: status values and ids pass; a doubled quote is unescaped; a literal over lines reports its first line', () => {
    expect(findSentenceLiterals("select 1 where status in ('sent', 'withdrawn', 'closed') and id = 'CRA.confirmed';", 'a.sql')).toEqual([])
    expect(findSentenceLiterals("select 'it''s';", 'a.sql')).toEqual([])
    expect(findSentenceLiterals("select 1;\n\nselect 'it''s here';", 'b.sql')).toEqual([{ file: 'b.sql', line: 3, literal: "it's here" }])
    expect(findSentenceLiterals("select 1,\n  'two\nlines';", 'c.sql')).toEqual([{ file: 'c.sql', line: 2, literal: 'two\nlines' }])
  })

  test('END-7 rule: a dollar-quoted sentence is caught; comments and quoted identifiers are not literals', () => {
    expect(findSentenceLiterals('do $$ begin perform 1; end $$;', 'd.sql')).toEqual([{ file: 'd.sql', line: 1, literal: ' begin perform 1; end ' }])
    expect(findSentenceLiterals('select $t$a b$t$;', 'd.sql')).toEqual([{ file: 'd.sql', line: 1, literal: 'a b' }])
    expect(findSentenceLiterals("-- the client's view, a comment\nselect 1;", 'e.sql')).toEqual([])
    expect(findSentenceLiterals("/* it's a note */ select 'ok';", 'e.sql')).toEqual([])
    expect(findSentenceLiterals('select 1 as "Display Name";', 'e.sql')).toEqual([])
    expect(findSentenceLiterals("-- it's\nselect 'a b';", 'f.sql')).toEqual([{ file: 'f.sql', line: 2, literal: 'a b' }])
  })
})

describe('GL3 draft only (ARC-2, LIVE-6)', () => {
  const MODULE_DIR = 'src/modules/golive/bridge/'
  const READS_DRAFT = /db[\\/]+bridge\b|['"`]db['"`]\s*,\s*['"`]bridge['"`]/
  const IMPORTS_MODULE = /golive[\\/]bridge/

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', '.stryker-tmp'].includes(e.name)) continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, out)
      else if (/\.(ts|tsx|mts|mjs|js|cjs|json)$/.test(e.name)) out.push(p)
    }
    return out
  }

  /** Each line of a file outside the module that reads db/bridge, or (outside tests) imports the module. */
  function draftUses(files: { file: string; text: string }[]): string[] {
    const out: string[] = []
    for (const { file, text } of files) {
      if (file.startsWith(MODULE_DIR)) continue
      const isTest = /\.test\.[cm]?[jt]sx?$/.test(file)
      text.split('\n').forEach((line, i) => {
        if (READS_DRAFT.test(line)) out.push(`${file}:${String(i + 1)} reads db/bridge`)
        else if (!isTest && IMPORTS_MODULE.test(line)) out.push(`${file}:${String(i + 1)} imports the draft module`)
      })
    }
    return out
  }

  test('ARC-2 rule: planted reads of db/bridge and a planted runtime import of the module are caught by file and line', () => {
    const planted = [
      { file: 'src/app/planted.ts', text: "import fs from 'node:fs'\nconst sql = fs.readFileSync(path.join(ROOT, 'db', 'bridge', '0001_bridge_views.sql'))" },
      { file: 'src/core/planted.ts', text: "const p = 'db/bridge/0002_grants.sql'" },
      { file: 'src/pipeline/planted.ts', text: "\n\nimport { applyDraft } from '../modules/golive/bridge'" },
      { file: 'src/modules/golive/bridge/ok.ts', text: "const p = 'db/bridge/views.json'" },
    ]
    expect(draftUses(planted)).toEqual([
      'src/app/planted.ts:2 reads db/bridge',
      'src/core/planted.ts:1 reads db/bridge',
      'src/pipeline/planted.ts:3 imports the draft module',
    ])
  })

  test('ARC-2 no file in src outside the module reads db/bridge, and nothing outside tests imports the module', () => {
    const files = walk(path.join(REPO_ROOT, 'src')).map((f) => ({
      file: path.relative(REPO_ROOT, f).split(path.sep).join('/'),
      text: fs.readFileSync(f, 'utf8'),
    }))
    expect(files.length).toBeGreaterThan(50)
    expect(files.map((f) => f.file)).toContain('src/contracts/bridge.ts')
    expect(files.map((f) => f.file)).toContain(`${MODULE_DIR}index.ts`)
    expect(draftUses(files)).toEqual([])
  })
})
