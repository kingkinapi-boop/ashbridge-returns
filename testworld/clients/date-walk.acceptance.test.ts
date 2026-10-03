// W00c acceptance tests (round 3), RC-B: the calendar check is applied by type, to every date leaf of both files
// (reports/W00c-findings-3.md, fix 4; Lead directive A450).
//
// The date paths come from this file's walk over every leaf of both parsed files of every numbered folder: a leaf
// that holds a calendar date (YYYY-MM-DD), a month (YYYY-MM) or a timestamp today, carried subtrees included. For each
// path (a generic path: array indexes as [], statementBalances account keys literal) the first folder that has it
// and its first leaf there are planted with each of the four bad values of the findings.
//
// What the W00c round 3 build does: one walk over every string leaf of both parsed trees. A date-shaped value must be
// a strict YYYY-MM-DD date or a YYYY-MM month, else a 'schema' issue whose record is "<file> <dotted path>" (the
// path as load.ts joins zod paths, for example "answer-key.json ohip.raStatements.0.paymentDate"). The existing twin
// checks stay.
// Note for the builder (spec probe, reports/W00c-spec.md): the fix 4 shape as written also matches "10.1" (C10
// t2Inputs.schedule8.classes[].class, a CCA class) and "960.00" and "100.00" (C12 onboarding answers[].answer_verbatim,
// amounts). Those folders must keep loading (clients.acceptance), so the shape the walk uses must not take them for
// dates; the bad values below must still be refused.
//
// Spec review 4 (reports/W00c-spec-review-4.md, gap 1): a list of the 66 date paths would pass every test above, since
// each plant sits on a leaf that holds a date today. So each folder also gets 2025-02-30 and 2025.02.30 at seeded
// string leaves that hold no date today and that the loader does not read (one per file, one inside a carried block),
// and the date part of each timestamp path is planted too (fix 4: "the date part of a timestamp").
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import {
  BAD_DATES,
  JSON_FILES,
  NEW_DATES,
  SEED,
  dotted,
  expectSome,
  firstByGeneric,
  inCarriedBlock,
  isDateLeaf,
  isMadeUpName,
  isRead,
  isTimestamp,
  jsonOf,
  leaves,
  load,
  namesPath,
  pick,
  refused,
  setLeaf,
  show,
  type Leaf,
} from '../model/__fixtures__/w00c-r3-walk'

const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clients = walkClients()
const firsts = [...firstByGeneric(clients, isDateLeaf)].sort(([a], [b]) => (a < b ? -1 : 1))

describe('W00c RC-B the date walk finds the date paths', () => {
  test('ARC-8 the walk finds the date paths of both files (66 on the spec probe; a new folder may add more, never fewer)', () => {
    expect(firsts.length).toBeGreaterThanOrEqual(66)
    const labels = firsts.map(([l]) => l)
    for (const must of ['answer-key.json transactions[].date', 'answer-key.json statementBalances.CHQ[].month', 'answer-key.json prior_year.fiscalYear.start', 'answer-key.json t2Inputs.instalments.unmatchedPayment', 'onboarding.json loan.schedule[].date', 'onboarding.json engagements[].created_at']) {
      expect(labels, `the walk reaches ${must}`).toContain(must)
    }
  })
})

describe('W00c RC-B each date path refuses each bad value, naming the path', () => {
  test.each(firsts.map(([label, f]): [string, string, WalkClient, Leaf] => [label, f.c.id, f.c, f.leaf]))(
    'ARC-8 %s (first in %s): 2025-02-30, 2025-13, 2025-2-3, 03/02/2025 and 2025.02.30 are each refused as a schema issue naming the path',
    (_l, _c, c, leaf) => {
      for (const bad of BAD_DATES) {
        setLeaf(sb, c, leaf.file, leaf.path, bad)
        const issues = refused(sb, c, `${leaf.file} ${dotted(leaf.path)} = ${bad}`)
        expectSome(issues, (i) => i.check === 'schema' && namesPath(i, leaf.file, leaf.path), `${c.id} ${leaf.file} ${dotted(leaf.path)} = ${bad}: a 'schema' issue naming the path`)
        sb.restore()
      }
    },
    60_000,
  )
})

describe('W00c RC-B leap days', () => {
  /** The eight dates the loader read before round 3; every other date leaf is reached by the walk alone. */
  const before = /^(answer-key\.json (fiscalYear\.(start|end)|transactions\[\]\.date|adjustingEntries\[\]\.date)|onboarding\.json (corporation\.(financial_year_end|fiscal_year_start|incorporation_date)|prior_year_closing_balances\.as_of))$/
  /** The first leaf of each date path of a folder that only the walk reaches and that holds a whole date (or a timestamp). */
  const walkOnly = (c: WalkClient): Leaf[] => {
    const seen = new Set<string>()
    return JSON_FILES.flatMap((f) => leaves(f, jsonOf(c, f))).filter((l) => {
      const label = `${l.file} ${l.generic}`
      if (!isDateLeaf(l) || l.value.length < 10 || before.test(label) || seen.has(label)) return false
      seen.add(label)
      return true
    })
  }

  test("END-9 C14 (its fiscal year holds 29 February 2024): each date path only the walk reaches, set to 2024-02-29, still loads", () => {
    const c14 = clients.find((c) => c.id === 'C14') as WalkClient
    expect(c14.key.fiscalYear.start <= '2024-02-29' && c14.key.fiscalYear.end >= '2024-02-29', 'fixture: C14 holds 29 February 2024').toBe(true)
    const plants = walkOnly(c14)
    expect(plants.length, 'fixture: C14 has date leaves only the walk reaches').toBeGreaterThan(0)
    for (const leaf of plants) {
      setLeaf(sb, c14, leaf.file, leaf.path, '2024-02-29')
      const r = load(sb, c14)
      expect(r.ok, `C14 ${leaf.file} ${dotted(leaf.path)} = 2024-02-29 loads: ${r.ok ? '' : show(r.issues)}`).toBe(true)
      sb.restore()
    }
  }, 60_000)

  test('END-9 each folder: its first date leaf only the walk reaches, set to 29 February of a non-leap year, is refused naming the path', () => {
    let planted = 0
    for (const c of clients) {
      const leaf = walkOnly(c)[0]
      if (leaf === undefined) continue
      planted++
      setLeaf(sb, c, leaf.file, leaf.path, '2025-02-29')
      const issues = refused(sb, c, `${leaf.file} ${dotted(leaf.path)} = 2025-02-29`)
      expectSome(issues, (i) => i.check === 'schema' && namesPath(i, leaf.file, leaf.path), `${c.id} ${leaf.file} ${dotted(leaf.path)} = 2025-02-29: a 'schema' issue naming the path`)
      sb.restore()
    }
    expect(planted).toBeGreaterThan(0)
  }, 60_000)
})

describe('W00c RC-B the walk is by type, not by a list of date paths (spec review 4, gap 1)', () => {
  /** String leaves that hold no date, month or timestamp today, that the loader does not read and that are no made-up name. */
  const quiet = (c: WalkClient): Leaf[] =>
    JSON_FILES.flatMap((f) => leaves(f, jsonOf(c, f))).filter((l) => typeof l.value === 'string' && !isDateLeaf(l) && !isRead(l) && !isMadeUpName(l))
  /** Per folder, seeded: one quiet leaf of each file and one quiet leaf inside a carried block. */
  const plantsOf = (c: WalkClient, n: number): Leaf[] => {
    const all = quiet(c)
    const groups = [...JSON_FILES.map((f) => all.filter((l) => l.file === f)), all.filter(inCarriedBlock)]
    return groups.map((g, k) => {
      if (g.length === 0) throw new Error(`fixture: ${c.id} has no quiet string leaf in group ${String(k)}`)
      return g[pick(g.length, SEED + 100 * n + k)] as Leaf
    })
  }
  const cases = clients.map((c, n): [string, WalkClient, Leaf[]] => [c.id, c, plantsOf(c, n)])

  test('ARC-8 every folder gives a quiet leaf in each file and one inside a carried block', () => {
    for (const [id, , plants] of cases) {
      expect(plants.slice(0, 2).map((l) => l.file), id).toEqual([...JSON_FILES])
      expect(plants[2] !== undefined && inCarriedBlock(plants[2]), `${id}: the third plant is inside a carried block`).toBe(true)
    }
  })

  test.each(cases)(
    'ARC-8 %s: a seeded string leaf of each file and one inside a carried block, none holding a date today, set to 2025-02-30 and to 2025.02.30, are each refused as a schema issue naming the path',
    (_id, c, plants) => {
      for (const leaf of plants) {
        for (const bad of NEW_DATES) {
          setLeaf(sb, c, leaf.file, leaf.path, bad)
          const where = `${leaf.file} ${dotted(leaf.path)}`
          const issues = refused(sb, c, `${where} (held ${JSON.stringify(leaf.value)}) = ${bad}`)
          expectSome(issues, (i) => i.check === 'schema' && namesPath(i, leaf.file, leaf.path), `${c.id} ${where} (held ${JSON.stringify(leaf.value)}) = ${bad}: a 'schema' issue naming the path`)
          sb.restore()
        }
      }
    },
    120_000,
  )

  const stamps = [...firstByGeneric(clients, (l) => typeof l.value === 'string' && isTimestamp(l.value))].sort(([a], [b]) => (a < b ? -1 : 1))

  test('ARC-8 the walk finds the timestamp paths (1 on the spec probe: onboarding.json engagements[].created_at)', () => {
    expect(stamps.map(([l]) => l)).toContain('onboarding.json engagements[].created_at')
  })

  test.each(stamps.map(([label, f]): [string, string, WalkClient, Leaf] => [label, f.c.id, f.c, f.leaf]))(
    'ARC-8 %s (first in %s): a timestamp whose date part is 2025-02-30 is refused as a schema issue naming the path',
    (_l, _c, c, leaf) => {
      const bad = '2025-02-30T09:00:00Z'
      setLeaf(sb, c, leaf.file, leaf.path, bad)
      const issues = refused(sb, c, `${leaf.file} ${dotted(leaf.path)} = ${bad}`)
      expectSome(issues, (i) => i.check === 'schema' && namesPath(i, leaf.file, leaf.path), `${c.id} ${leaf.file} ${dotted(leaf.path)} = ${bad}: a 'schema' issue naming the path`)
    },
    60_000,
  )
})
