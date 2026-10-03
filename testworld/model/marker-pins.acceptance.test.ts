// W00c acceptance tests, part 1 of 3: RC1, marked rows are pinned by facts outside themselves
// (reports/W00a-findings.md, fix 2 and "Tests to add"; W00a check class 1).
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plants one fault in a temp copy and loads through the public loader.
//
// What the W00c build adds (the W00a rules stay):
//   Pinned markers. FaultEntry.marker gains two hand-written numbers:
//     marker?: { field; account; month; rows: number; totalCents: number }
//   rows is how many transactions of the client carry `field` in that account and month; totalCents is the sum of
//   their amounts in integer cents, signed as written in the answer key. The golden
//   testworld/model/__golden__/faults-catalogue.json holds the reviewed values (C10: 56 rows 1686665, 4 rows
//   316494, 8 rows 569501). A marker entry with no rows or no totalCents, or whose group's rows do not match both,
//   is a 'fault-catalogue' issue whose record is the entry id.
//   dupOf. A row's dupOf names a different transaction of the same client (not itself, not "", not missing) that
//   carries no marker and has the same account, date and amount; an original has at most one duplicate. A broken
//   dupOf is a 'fault-catalogue' issue whose record or reason names the duplicate row's id (for a second duplicate
//   of one original: names the original's id).
//   priorYear. A priorYear row is dated before the fiscal year's start. One dated inside the year is a
//   'fault-catalogue' issue whose record or reason names the row id.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { faults } from '../index'
import { Sandbox, catalogue, cents, dollars, expectIssue, expectLoads, markersOf, monthOf, monthsIn, refusal, shiftFrom, sign, walkClients, type MarkerGroup, type RawTx, type WalkClient } from './__fixtures__/sample-walk'
import {
  allGroups,
  bumpPins,
  entryFor,
  expectNamed,
  freeFlagEntry,
  groupRows,
  markedRows,
  pinned,
  plantRow,
  txIn,
  type MarkedRow,
} from './__fixtures__/w00c-walk'

const clients = walkClients()
const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__golden__', 'faults-catalogue.json'), 'utf8')) as unknown[]
const rows = markedRows(clients)
const rowCases: [string, MarkedRow][] = rows.map((r): [string, MarkedRow] => [`${r.c.id} ${r.t.id} ${r.field}`, r])
const groupCases = allGroups(clients).map(({ c, g }): [string, { c: WalkClient; g: MarkerGroup }] => [`${c.id} ${g.field} ${g.account} ${g.month}`, { c, g }])
const dupCases = rowCases.filter(([, r]) => r.field === 'dupOf')
const priorCases = rowCases.filter(([, r]) => r.field === 'priorYear')
const clientOf = (id: string): WalkClient => {
  const c = clients.find((x) => x.id === id)
  if (c === undefined) throw new Error(`fixture: no client ${id}`)
  return c
}
const originalOf = (r: MarkedRow): RawTx => txIn(r.c.key, String(r.t.dupOf))

/** Another account of the client whose statement has the month of `date`, or undefined when there is none. */
function otherAccount(c: WalkClient, account: string, date: string): { key: string; role: string; index: number } | undefined {
  for (const a of c.key.accounts) {
    if (a.key === account) continue
    const index = (c.key.statementBalances[a.key] ?? []).findIndex((m) => m.month === monthOf(date))
    if (index >= 0) return { key: a.key, role: a.role, index }
  }
  return undefined
}
const crossCases = dupCases.filter(([, r]) => otherAccount(r.c, r.t.acct, r.t.date) !== undefined)

describe('W00c RC1 the walk and the golden', () => {
  test('ARC-8 the walk finds marked rows of all three fields, dup rows with a second account to point at, and the sample data already meets the stricter marker rules', () => {
    expect(new Set(rows.map((r) => r.field))).toEqual(new Set(['missingFromExport', 'dupOf', 'priorYear']))
    expect(crossCases.length).toBeGreaterThan(0)
    const originals = new Map<string, number>()
    for (const [label, r] of dupCases) {
      const o = originalOf(r)
      expect(o.id, label).not.toBe(r.t.id)
      expect(markersOf(o), label).toEqual([])
      expect([o.acct, o.date, cents(o.amount)], label).toEqual([r.t.acct, r.t.date, cents(r.t.amount)])
      originals.set(`${r.c.id} ${o.id}`, (originals.get(`${r.c.id} ${o.id}`) ?? 0) + 1)
    }
    expect([...originals.values()].every((n) => n === 1)).toBe(true)
    for (const [label, r] of priorCases) expect(r.t.date < r.c.key.fiscalYear.start, label).toBe(true)
  })

  test("ARC-8 the reviewed golden's pinned markers equal the count and cent total of each group's rows in the walk (the golden is hand-checked, never generated)", () => {
    const listed = (golden as { client?: string; marker?: { field: string; account: string; month: string; rows: number; totalCents: number } }[]).filter((e) => e.marker !== undefined)
    expect(listed.map((e) => `${String(e.client)} ${String(e.marker?.field)} ${String(e.marker?.account)} ${String(e.marker?.month)}`).sort()).toEqual(
      groupCases.map(([label]) => label).sort(),
    )
    for (const e of listed) {
      const m = e.marker
      if (m === undefined) continue
      const { count, totalCents } = groupRows(clientOf(String(e.client)), { client: String(e.client), field: m.field as 'dupOf', account: m.account, month: m.month })
      expect([m.rows, m.totalCents], `${String(e.client)} ${m.field} ${m.account} ${m.month}`).toEqual([count, totalCents])
    }
  })

  test('ARC-8 the fault catalogue equals the reviewed golden in full, roll causes and pinned markers (rows, totalCents) included', () => {
    expect(JSON.parse(JSON.stringify(faults())) as unknown).toEqual(golden)
  })

  test.each(groupCases)('ARC-13 %s: the catalogue entry carries rows and totalCents as integers equal to what the walk counts and sums', (_l, { c, g }) => {
    const m = pinned(entryFor(catalogue(), g))
    const { count, totalCents } = groupRows(c, g)
    expect(Number.isSafeInteger(m?.rows) && Number.isSafeInteger(m?.totalCents), `${g.field} ${g.account} ${g.month} pins rows and totalCents`).toBe(true)
    expect([m?.rows, m?.totalCents]).toEqual([count, totalCents])
  })
})

describe('W00c RC1 a marked row is pinned: one cent or one extra row is refused (every marked row of every folder)', () => {
  test.each(rowCases)('ARC-13 %s: its amount moved up one cent is refused, naming the marker entry', async (_l, r) => {
    const e = entryFor(catalogue(), r.group)
    sb.editKey(r.c, (k) => {
      const t = txIn(k, r.t.id)
      t.amount = dollars(cents(t.amount) + 1)
    })
    expectIssue(await refusal(sb, r.c.id), 'fault-catalogue', e.id)
  })

  test.each(rowCases)('ARC-13 %s: its amount moved down one cent is refused, naming the marker entry', async (_l, r) => {
    const e = entryFor(catalogue(), r.group)
    sb.editKey(r.c, (k) => {
      const t = txIn(k, r.t.id)
      t.amount = dollars(cents(t.amount) - 1)
    })
    expectIssue(await refusal(sb, r.c.id), 'fault-catalogue', e.id)
  })

  test.each(rowCases)('ARC-8 %s: an extra row carrying the same marker in the same account and month is refused, naming the marker entry', async (_l, r) => {
    const e = entryFor(catalogue(), r.group)
    sb.editKey(r.c, (k) => {
      k.transactions.push(plantRow(r.t, `${r.t.id}-EXTRA-(Test)`, {}))
    })
    expectIssue(await refusal(sb, r.c.id), 'fault-catalogue', e.id)
  })

  test('ARC-13 property (fast-check, seed 20261002): any marked row of any client moved by any non-zero number of cents is refused, naming its marker entry', async () => {
    expect(rows.length).toBeGreaterThan(0)
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...rows),
        fc.integer({ min: -100_000_000, max: 100_000_000 }).filter((d) => d !== 0),
        async (r, d) => {
          sb.restore()
          const e = entryFor(catalogue(), r.group)
          sb.editKey(r.c, (k) => {
            const t = txIn(k, r.t.id)
            t.amount = dollars(cents(t.amount) + d)
          })
          expectIssue(await refusal(sb, r.c.id), 'fault-catalogue', e.id)
        },
      ),
      { seed: 20261002, numRuns: 40 },
    )
  }, 120_000)
})

describe("W00c RC1 the catalogue's pinned numbers are checked against the rows (every marker group of every folder)", () => {
  const edits: [string, (m: { rows?: unknown; totalCents?: unknown }) => void][] = [
    ['rows one more', (m) => {
      m.rows = Number(m.rows) + 1
    }],
    ['rows one fewer', (m) => {
      m.rows = Number(m.rows) - 1
    }],
    ['totalCents one cent more', (m) => {
      m.totalCents = Number(m.totalCents) + 1
    }],
    ['totalCents one cent less', (m) => {
      m.totalCents = Number(m.totalCents) - 1
    }],
    ['rows left out', (m) => {
      delete m.rows
    }],
    ['totalCents left out', (m) => {
      delete m.totalCents
    }],
  ]
  const cases = groupCases.flatMap(([label, x]) => edits.map(([what, edit]): [string, string, typeof x, typeof edit] => [label, what, x, edit]))

  test.each(cases)('ARC-8 %s with the entry\'s %s is refused, naming the entry', async (_l, _w, { g }, edit) => {
    const cat = catalogue()
    const e = entryFor(cat, g)
    edit(e.marker)
    expectIssue(await refusal(sb, g.client, cat), 'fault-catalogue', e.id)
  })
})

describe('W00c RC1 dupOf names a real, unmarked original with the same account, date and amount (every dup row of every folder)', () => {
  test.each(dupCases)('ARC-8 %s pointing at no transaction is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).dupOf = `${String(r.t.dupOf)}-GONE-(Test)`
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s pointing at itself is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).dupOf = r.t.id
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s with dupOf "" is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).dupOf = ''
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(crossCases)('ARC-8 %s pointing at a twin of its original in another account (same date and amount, that roll kept) is refused, naming the row', async (_l, r) => {
    const other = otherAccount(r.c, r.t.acct, r.t.date)
    if (other === undefined) throw new Error('fixture: no other account')
    const o = originalOf(r)
    const twin = `${o.id}-TWIN-(Test)`
    sb.editKey(r.c, (k) => {
      k.transactions.push(plantRow(o, twin, { acct: other.key }))
      // The other account's statement takes the twin, so its months still roll and link.
      shiftFrom(k, other.key, other.index, sign(other.role) * cents(o.amount), false)
      txIn(k, r.t.id).dupOf = twin
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s moved to another day of the same month (its original keeps its date) is refused, naming the row', async (_l, r) => {
    const day = Number(r.t.date.slice(8, 10))
    const moved = `${monthOf(r.t.date)}-${String(day === 1 ? 2 : day - 1).padStart(2, '0')}`
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).date = moved
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-13 %s one cent away from its original, with the pinned total moved to match, is refused, naming the row', async (_l, r) => {
    const cat = catalogue()
    bumpPins(entryFor(cat, r.group), 0, 1)
    sb.editKey(r.c, (k) => {
      const t = txIn(k, r.t.id)
      t.amount = dollars(cents(t.amount) + 1)
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s: a planted duplicate of this duplicate (its original is itself marked), pins moved to match, is refused, naming the planted row', async (_l, r) => {
    const planted = `${r.t.id}-CHAIN-(Test)`
    const cat = catalogue()
    bumpPins(entryFor(cat, r.group), 1, cents(r.t.amount))
    sb.editKey(r.c, (k) => {
      k.transactions.push(plantRow(r.t, planted, { dupOf: r.t.id }))
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [planted])
  })

  test.each(dupCases)('ARC-8 %s: a second duplicate of the same original, pins moved to match, is refused, naming the original', async (_l, r) => {
    const cat = catalogue()
    bumpPins(entryFor(cat, r.group), 1, cents(r.t.amount))
    sb.editKey(r.c, (k) => {
      k.transactions.push(plantRow(r.t, `${r.t.id}-SECOND-(Test)`, { dupOf: String(r.t.dupOf) }))
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [String(r.t.dupOf)])
  })
})

describe('W00c RC1 a priorYear row is dated before the fiscal year (every priorYear row of every folder)', () => {
  test.each(priorCases)('ARC-8 %s dated on the first day of the fiscal year, its marker moved there in the catalogue (pins kept true), is refused, naming the row', async (_l, r) => {
    const start = r.c.key.fiscalYear.start
    const cat = catalogue()
    const e = entryFor(cat, r.group)
    if (groupRows(r.c, r.group).count === 1) Reflect.deleteProperty(e, 'marker')
    else bumpPins(e, -1, -cents(r.t.amount))
    freeFlagEntry(cat, r.c.id).marker = { field: 'priorYear', account: r.t.acct, month: monthOf(start), rows: 1, totalCents: cents(r.t.amount) } as never
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).date = start
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(clients.filter((c) => c.key.accounts.length > 0).map((c): [string, WalkClient] => [c.id, c]))(
    'ARC-8 %s still loads with the real catalogue under the pinned-marker rules',
    async (_l, c) => {
      expect(monthsIn(c.key, String(c.key.accounts[0]?.key)).length).toBeGreaterThan(0)
      await expectLoads(sb, c.id)
    },
  )
})
