// W00c acceptance tests (round 3), RC-A: the parse layer never drops a written fact without a word
// (reports/W00c-findings-3.md, fixes 1 to 3; Lead directive A450).
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-r3-walk.ts), never from a typed list of values. Each plants one change in a temp copy and loads through the
// public loader.
//
// What the W00c round 3 build does:
//   Fix 2: every object the loader describes is strict. A key that is not declared (a misspelt "dup_of", an added
//   key) is refused as a 'schema' issue whose record is "<file> <dotted path of the object>" (or a longer record
//   starting with it) and whose record or reason names the key. Keys written but not read stay declared as carried.
//   Fix 1: "__proto__", "constructor" or "prototype" written as a key of any object of either file is a 'file' issue
//   naming the file and the key, beside the repeated-key check.
//   Fix 3: each written twin is compared with the loader's own value and a difference is a 'trial-balance', 'roll' or
//   'schema' issue naming the record: each trial balance's totalDebit and totalCredit, each month's rolls and
//   exportActivity, each account's rowsInExport (against its transactions with missingFromExport false, never the
//   CSV lines) and rowsMissingFromExport, fiscalYear.days, each adjusting entry's amount. Account.exportRows takes the
//   written rowsInExport.
//
// The objects the loader describes are DESCRIBED in w00c-r3-walk.ts (amber, spec round 3; spec review 4 adds the
// evidence objects flags[].evidence, t2Inputs.schedule1, its addBacks[] and their source). Objects only W00c's later
// cards read (cra_program_accounts, related_entities, t2Inputs.schedule50) are not listed: the builder may describe or
// carry them.
//
// Spec review 4 (reports/W00c-spec-review-4.md): gap 3 plants "prototype" too, and each name at the deepest object of
// each folder's answer key; gap 4 adds the evidence objects and renames their "onboarding" key.
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, cents, dollars, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import {
  DESCRIBED,
  JSON_FILES,
  READ,
  READ_ONBOARDING,
  SEED,
  addKey,
  expectSome,
  jsonOf,
  leaves,
  load,
  mentions,
  namesPath,
  objects,
  oneCharOff,
  pattern,
  pick,
  refused,
  renameKey,
  setLeaf,
  show,
  writeRawKey,
  genericOf,
  type JsonFile,
  type Path,
} from '../model/__fixtures__/w00c-r3-walk'

const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clients = walkClients()
const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const SLOW = 120_000
/** The prototype names fix 1 refuses as keys (spec review 4, gap 3, adds prototype to the plants). */
const NAMES = ['__proto__', 'constructor', 'prototype'] as const

/** For each described object path: the first folder that has it, its first node there, and every key written at that path in any folder. */
function describedNodes(): { label: string; c: WalkClient; file: JsonFile; path: Path; keys: string[]; allKeys: Set<string> }[] {
  return DESCRIBED.map(({ file, generic }) => {
    let first: { c: WalkClient; path: Path; keys: string[] } | undefined
    const allKeys = new Set<string>()
    for (const c of clients) {
      for (const o of objects(jsonOf(c, file))) {
        if (pattern(genericOf(o.path)) !== generic) continue
        for (const k of Object.keys(o.node)) allKeys.add(k)
        if (first === undefined && Object.keys(o.node).length > 0) first = { c, path: o.path, keys: Object.keys(o.node) }
      }
    }
    if (first === undefined) throw new Error(`fixture: no folder has a non-empty object at ${file} ${generic}`)
    return { label: `${file} ${generic === '' ? '(top)' : generic}`, ...first, file, allKeys }
  })
}
const nodes = describedNodes()
const freshName = (allKeys: Set<string>, base: string): string => {
  let n = base
  while (allKeys.has(n)) n = `${n}_`
  return n
}

describe('W00c RC-A every described object refuses a key it does not declare', () => {
  test('ARC-8 the walk finds every described object path in some folder', () => {
    expect(nodes.map((n) => n.label)).toHaveLength(DESCRIBED.length)
  })

  test.each(nodes.map((n, i): [string, string, (typeof nodes)[number], number] => [n.label, n.c.id, n, i]))(
    'ARC-8 %s (first in %s): one key renamed by one character is refused, naming the object path and the new key',
    (_l, _c, n, i) => {
      const from = n.keys[pick(n.keys.length, SEED + i)] as string
      const to = freshName(n.allKeys, oneCharOff(from))
      renameKey(sb, n.c, n.file, n.path, from, to)
      const issues = refused(sb, n.c, `${n.file} ${n.path.join('.')} with "${from}" written "${to}"`)
      expectSome(issues, (x) => x.check === 'schema' && namesPath(x, n.file, n.path) && mentions(x, to), `a 'schema' issue naming ${n.file} ${n.path.join('.')} and "${to}"`)
    },
    SLOW,
  )

  test.each(nodes.map((n): [string, string, (typeof nodes)[number]] => [n.label, n.c.id, n]))(
    'ARC-8 %s (first in %s): an added key is refused, naming the object path and the key',
    (_l, _c, n) => {
      const key = freshName(n.allKeys, 'unread_key_test')
      addKey(sb, n.c, n.file, n.path, key, 'made up (Test)')
      const issues = refused(sb, n.c, `${n.file} ${n.path.join('.')} with an added "${key}"`)
      expectSome(issues, (x) => x.check === 'schema' && namesPath(x, n.file, n.path) && mentions(x, key), `a 'schema' issue naming ${n.file} ${n.path.join('.')} and "${key}"`)
    },
    SLOW,
  )

  test('END-9 the round 2 misspellings are refused in the folder that carries the marker: dup_of, prior_year, accountNo and post', () => {
    const c10 = clients.find((c) => c.id === 'C10') as WalkClient
    const dup = c10.key.transactions.findIndex((t) => typeof t.dupOf === 'string')
    const prior = c10.key.transactions.findIndex((t) => t.priorYear === true)
    const posted = c10.key.transactions.findIndex((t) => Array.isArray(t['post']) && typeof t.accountNo === 'string')
    expect([dup, prior, posted].every((x) => x >= 0), 'fixture: C10 has a dupOf, a priorYear and a posted row').toBe(true)
    for (const [index, from, to] of [
      [dup, 'dupOf', 'dup_of'],
      [prior, 'priorYear', 'prior_year'],
      [posted, 'accountNo', 'accountNumber'],
      [posted, 'post', 'posts'],
    ] as const) {
      renameKey(sb, c10, 'answer-key.json', ['transactions', index], from, to)
      const issues = refused(sb, c10, `transactions.${String(index)} with "${from}" written "${to}"`)
      expectSome(issues, (x) => x.check === 'schema' && namesPath(x, 'answer-key.json', ['transactions', index]) && mentions(x, to), `a 'schema' issue naming transactions.${String(index)} and "${to}"`)
      sb.restore()
    }
  })

  // Spec review 4, gap 4: the evidence objects round 3 starts reading (fix 5). Carried as z.unknown and read raw, a
  // misspelt "onboarding" key would drop the evidence without a word (RC-A inside RC-C).
  const EVIDENCE_PLACES = ['flags[].evidence', 't2Inputs.schedule1.addBacks[].source', 'adjustingEntries[].source'] as const
  test.each(EVIDENCE_PLACES.map((g): [string] => [g]))(
    'ARC-8 %s: in the first folder whose object there writes an onboarding key, that key renamed by one character is refused, naming the object path and the new key',
    (generic) => {
      const hit = clients
        .flatMap((c) => objects(c.key).map((o) => ({ c, ...o })))
        .find((o) => pattern(genericOf(o.path)) === generic && Object.hasOwn(o.node, 'onboarding'))
      if (hit === undefined) throw new Error(`fixture: no folder writes an onboarding key at ${generic}`)
      const allKeys = new Set(clients.flatMap((c) => objects(c.key).filter((o) => pattern(genericOf(o.path)) === generic).flatMap((o) => Object.keys(o.node))))
      const to = freshName(allKeys, oneCharOff('onboarding'))
      renameKey(sb, hit.c, 'answer-key.json', hit.path, 'onboarding', to)
      const issues = refused(sb, hit.c, `answer-key.json ${hit.path.join('.')} with "onboarding" written "${to}"`)
      expectSome(issues, (x) => x.check === 'schema' && namesPath(x, 'answer-key.json', hit.path) && mentions(x, to), `${hit.c.id}: a 'schema' issue naming answer-key.json ${hit.path.join('.')} and "${to}"`)
    },
    SLOW,
  )
})

describe('W00c RC-A prototype names written as keys are refused (fix 1)', () => {
  const places: { label: string; file: JsonFile; path: (c: WalkClient) => Path | undefined }[] = [
    { label: 'statementBalances', file: 'answer-key.json', path: () => ['statementBalances'] },
    { label: 'the first transaction', file: 'answer-key.json', path: (c) => (c.key.transactions.length > 0 ? ['transactions', 0] : undefined) },
    { label: 'the top of onboarding', file: 'onboarding.json', path: () => [] },
  ]
  const cases = clients.flatMap((c) =>
    places.flatMap((p) => {
      const path = p.path(c)
      return path === undefined ? [] : NAMES.map((name): [string, string, string, WalkClient, JsonFile, Path] => [c.id, name, p.label, c, p.file, path])
    }),
  )

  test('ARC-8 every folder gives at least two places (C12 has no transactions)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(clients.length * 2 * NAMES.length)
  })

  test.each(cases)('ARC-8 %s: "%s" written as a key of %s is a file issue naming the file and the key', (_id, name, _p, c, file, path) => {
    writeRawKey(sb, c, file, path, name)
    const issues = refused(sb, c, `"${name}" in ${file} ${path.join('.')}`)
    expectSome(issues, (x) => x.check === 'file' && mentions(x, file) && mentions(x, name), `a 'file' issue naming ${file} and "${name}"`)
  })

  // Spec review 4, gap 3: a depth-limited scan passes the places above (depth 0 to 2). The deepest object node of each
  // answer key (the first one in document order at the greatest depth) is found by this file's walk.
  const deepest = (c: WalkClient): Path => {
    let best: Path = []
    for (const o of objects(c.key)) if (o.path.length > best.length) best = o.path
    return best
  }
  const deepCases = clients.flatMap((c) => NAMES.map((name): [string, string, number, WalkClient, Path] => [c.id, name, deepest(c).length, c, deepest(c)]))

  test('ARC-8 the deepest answer-key object of every folder lies at depth 4 or more', () => {
    for (const c of clients) {
      const depth = deepest(c).length
      expect(depth, `${c.id} deepest object`).toBeGreaterThanOrEqual(4)
    }
  })

  test.each(deepCases)('ARC-8 %s: "%s" written as a key of the deepest answer-key object (path depth %i) is a file issue naming the file and the key', (_id, name, _d, c, path) => {
    writeRawKey(sb, c, 'answer-key.json', path, name)
    const issues = refused(sb, c, `"${name}" in answer-key.json ${path.join('.')}`)
    expectSome(issues, (x) => x.check === 'file' && mentions(x, 'answer-key.json') && mentions(x, name), `a 'file' issue naming answer-key.json and "${name}"`)
  })
})

// ---- written twins (fix 3) ----

type Twin = { label: string; file: JsonFile; path: Path; moved: unknown; checks: readonly string[]; names: string }
const TOTALS = ['trial-balance', 'roll', 'schema'] as const
const oneCent = (x: number): number => dollars(cents(x) + 1)

/** Every fix 3 twin a folder writes, the first of each kind (each trial balance total, the first account and month, the first adjusting entry). */
function twinsOf(c: WalkClient): Twin[] {
  const out: Twin[] = []
  const k = c.key as unknown as Record<string, unknown> & {
    trialBalance: Record<string, { totalDebit: number; totalCredit: number }>
    accounts: { key: string; rowsInExport: number; rowsMissingFromExport: number }[]
    statementBalances: Record<string, { month: string; rolls: boolean; exportActivity: number }[]>
    adjustingEntries: { id: string; amount: number }[]
    fiscalYear: { days: number }
  }
  for (const tb of ['opening', 'unadjusted', 'adjusted']) {
    for (const side of ['totalDebit', 'totalCredit'] as const) {
      const t = k.trialBalance[tb]
      if (t !== undefined) out.push({ label: `trialBalance.${tb}.${side}`, file: 'answer-key.json', path: ['trialBalance', tb, side], moved: oneCent(t[side]), checks: TOTALS, names: tb })
    }
  }
  const a = k.accounts[0]
  if (a !== undefined) {
    out.push({ label: `accounts.0.rowsInExport (${a.key})`, file: 'answer-key.json', path: ['accounts', 0, 'rowsInExport'], moved: a.rowsInExport + 1, checks: TOTALS, names: a.key })
    out.push({ label: `accounts.0.rowsMissingFromExport (${a.key})`, file: 'answer-key.json', path: ['accounts', 0, 'rowsMissingFromExport'], moved: a.rowsMissingFromExport + 1, checks: TOTALS, names: a.key })
    const m = k.statementBalances[a.key]?.[0]
    if (m !== undefined) {
      out.push({ label: `statementBalances.${a.key}.0.rolls`, file: 'answer-key.json', path: ['statementBalances', a.key, 0, 'rolls'], moved: !m.rolls, checks: TOTALS, names: a.key })
      out.push({ label: `statementBalances.${a.key}.0.exportActivity`, file: 'answer-key.json', path: ['statementBalances', a.key, 0, 'exportActivity'], moved: oneCent(m.exportActivity), checks: TOTALS, names: a.key })
    }
  }
  out.push({ label: 'fiscalYear.days', file: 'answer-key.json', path: ['fiscalYear', 'days'], moved: k.fiscalYear.days + 1, checks: TOTALS, names: 'days' })
  const j = k.adjustingEntries[0]
  if (j !== undefined) out.push({ label: `adjustingEntries.0.amount (${j.id})`, file: 'answer-key.json', path: ['adjustingEntries', 0, 'amount'], moved: oneCent(j.amount), checks: TOTALS, names: j.id })
  return out
}

describe('W00c RC-A each written twin moved by one unit is refused (fix 3)', () => {
  test.each(byId(clients))(
    'TB-3 %s: each trial balance total, the first account\'s rowsInExport, rowsMissingFromExport, rolls and exportActivity, fiscalYear.days and the first adjusting entry amount, each moved by one cent or one, is refused naming its record',
    (_id, c) => {
      const twins = twinsOf(c)
      expect(twins.length, `fixture: ${c.id} writes the trial balance totals and fiscalYear.days`).toBeGreaterThanOrEqual(7)
      for (const t of twins) {
        setLeaf(sb, c, t.file, t.path, t.moved)
        const issues = refused(sb, c, `${t.label} moved to ${String(t.moved)}`)
        expectSome(issues, (x) => t.checks.includes(x.check) && mentions(x, t.names), `${c.id} ${t.label}: a ${t.checks.join(' or ')} issue naming ${t.names}`)
        sb.restore()
      }
    },
    SLOW,
  )
})

describe('W00c RC-A exportRows is the written rowsInExport', () => {
  test.each(byId(clients))('END-9 %s: each account\'s exportRows equals its rowsInExport, and rowsInExport counts its transactions not missing from the export', (_id, c) => {
    const raw = c.key.accounts as unknown as { key: string; rowsInExport: number }[]
    for (const a of raw) {
      expect(a.rowsInExport, `fixture: ${c.id} ${a.key} rowsInExport counts its exported transactions`).toBe(
        c.key.transactions.filter((t) => t.acct === a.key && t.missingFromExport !== true).length,
      )
    }
    const r = load(sb, c)
    expect(r.ok, `${c.id} loads: ${r.ok ? '' : show(r.issues)}`).toBe(true)
    const model = r.ok ? (JSON.parse(r.model) as { accounts: { key: string; exportRows: number }[] }) : { accounts: [] }
    expect(model.accounts.map((a) => [a.key, a.exportRows])).toEqual(raw.map((a) => [a.key, a.rowsInExport]))
  })
})

// ---- the pinned-seed property ----

/** One unit of change: a letter added to a string, one cent (or one, for a whole number) added, a boolean flipped. */
function changed(v: unknown): unknown {
  if (typeof v === 'string') return `${v}Z`
  if (typeof v === 'boolean') return !v
  if (typeof v === 'number') return Number.isInteger(v) ? v + 1 : oneCent(v)
  return undefined
}

describe('W00c RC-A pinned-seed property: a read leaf never changes without a word', () => {
  test.each(byId(clients))(
    'ARC-8 %s: one leaf of each read path (seeded pick), changed by one unit, refuses the load or changes the model',
    (_id, c) => {
      const clean = load(sb, c)
      expect(clean.ok, `${c.id} loads clean`).toBe(true)
      const before = clean.ok ? clean.model : ''
      const groups = new Map<string, { file: JsonFile; path: Path; value: unknown }[]>()
      for (const file of JSON_FILES) {
        for (const l of leaves(file, jsonOf(c, file))) {
          const label = `${file} ${pattern(l.generic)}`
          if (!READ.has(label) && !READ_ONBOARDING.has(label)) continue
          if (changed(l.value) === undefined) continue
          const g = groups.get(label) ?? []
          g.push({ file, path: l.path, value: l.value })
          groups.set(label, g)
        }
      }
      expect(groups.size, `fixture: ${c.id} has read leaves`).toBeGreaterThan(5)
      let n = 0
      for (const [label, g] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const hit = g[pick(g.length, SEED + n++)] as (typeof g)[number]
        setLeaf(sb, c, hit.file, hit.path, changed(hit.value))
        const r = load(sb, c)
        expect(!r.ok || r.model !== before, `${c.id} ${label}: ${hit.path.join('.')} changed from ${JSON.stringify(hit.value)} to ${JSON.stringify(changed(hit.value))} loaded with no issue and the same model`).toBe(true)
        sb.restore()
      }
    },
    SLOW,
  )
})
