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
// dates; the four values below must still be refused.
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import {
  BAD_DATES,
  JSON_FILES,
  dotted,
  expectSome,
  firstByGeneric,
  isDateLeaf,
  jsonOf,
  leaves,
  load,
  namesPath,
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
    'ARC-8 %s (first in %s): 2025-02-30, 2025-13, 2025-2-3 and 03/02/2025 are each refused as a schema issue naming the path',
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
