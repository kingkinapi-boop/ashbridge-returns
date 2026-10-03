// W00c acceptance tests (round 2), RC1: every marked row is pinned row by row in the hand-written catalogue
// (reports/W00c-findings.md, fix 1 and "Acceptance tests for the spec writer"; Lead decision A400).
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plants one fault in a temp copy and loads through the public loader.
//
// What the W00c round 2 build does (the W00a dupOf original rules and both rolls stay):
//   FaultEntry.marker becomes { field, account, month, rows: [{ id, date, amountCents, dupOf? }] }, hand-written in
//   faults.ts (C10: 56 + 4 + 8 = 68 rows); the reviewed values are in testworld/model/__golden__/faults-catalogue.json,
//   rows in answer-key order, dupOf only on a dupOf marker's rows. The count-and-sum pins (rows: number,
//   totalCents) are gone.
//   Refused, as a 'fault-catalogue' issue: `rows: []` (naming the entry id); a listed id that is not a transaction
//   of the client, is listed twice in the catalogue, is not in marker.account, is not dated in marker.month, whose
//   date or amountCents differs from its pin, that lacks the marker field, or whose dupOf differs from its pin
//   (naming the row id); and any transaction carrying a marker field that no entry of that field lists by id
//   (naming the row id and the field). "Naming" is the issue's record or reason containing the text.
//   The priorYear exemption from "dated in no month of the account" is the id lookup: a priorYear row is excused
//   only when an entry lists it by id.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { faults } from '../index'
import {
  Sandbox,
  catalogue,
  cents,
  dollars,
  expectLoads,
  markersOf,
  monthOf,
  monthsIn,
  pinOf,
  refusal,
  shiftFrom,
  sign,
  walkClients,
  type CatalogueEntry,
  type MarkerGroup,
  type PinRow,
  type RawTx,
  type WalkClient,
} from './__fixtures__/sample-walk'
import {
  addPin,
  allGroups,
  dropPin,
  editPin,
  entryFor,
  expectNamed,
  freeFlagEntry,
  groupPins,
  groupRows,
  markedRows,
  pinsOf,
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

type GoldenEntry = { id: string; client?: string; empty?: string; marker?: { field: string; account: string; month: string; rows?: PinRow[] } }
const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__golden__', 'faults-catalogue.json'), 'utf8')) as GoldenEntry[]
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
const FIELD_TYPO: Record<string, string> = { missingFromExport: 'missingfromexport', dupOf: 'dupof', priorYear: 'prioryear' }

/** The other rows of the same group, in answer-key order. */
const groupMates = (r: MarkedRow): RawTx[] => groupRows(r.c, r.group).rows.filter((t) => t.id !== r.t.id)

/** Another day of the same month (the day before, or the 2nd when the row is on the 1st). */
const otherDay = (date: string): string => {
  const day = Number(date.slice(8, 10))
  return `${monthOf(date)}-${String(day === 1 ? 2 : day - 1).padStart(2, '0')}`
}

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

/** Pairs of two marked rows of one group (each row with the next one of its group), for the count-and-sum-neutral edits. */
const pairCases: [string, { r: MarkedRow; mate: RawTx }][] = rowCases.flatMap(([label, r]): [string, { r: MarkedRow; mate: RawTx }][] => {
  const mates = groupMates(r)
  const all = groupRows(r.c, r.group).rows
  const next = all[(all.findIndex((t) => t.id === r.t.id) + 1) % all.length]
  return mates.length === 0 || next === undefined || next.id === r.t.id ? [] : [[`${label} and ${next.id}`, { r, mate: next }]]
})

/**
 * Moves the marker from a listed row to a row of the same account and month that carries none. A dupOf marker swaps
 * with its own original (same account, date and amount, so both rolls and the dupOf rules still hold: only the pins
 * can tell). Another field moves to the first unmarked row of the month, when the month has one.
 */
const swapCases: [string, { r: MarkedRow; to: RawTx }][] = rowCases.flatMap(([label, r]): [string, { r: MarkedRow; to: RawTx }][] => {
  const to =
    r.field === 'dupOf'
      ? originalOf(r)
      : r.c.key.transactions.find((t) => t.acct === r.t.acct && monthOf(t.date) === monthOf(r.t.date) && markersOf(t).length === 0)
  return to === undefined ? [] : [[`${label} onto ${to.id}`, { r, to }]]
})

/** Sets or clears one marker field on a raw row. */
function setField(t: RawTx, field: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(t, field)
    return
  }
  if (field === 'dupOf') t.dupOf = value
  else if (field === 'missingFromExport') t.missingFromExport = true
  else t.priorYear = true
}

describe('W00c RC1 the walk and the golden', () => {
  test('ARC-8 the walk finds marked rows of all three fields, groups with two or more rows, dup rows with a second account, and swap cases for dupOf', () => {
    expect(new Set(rows.map((r) => r.field))).toEqual(new Set(['missingFromExport', 'dupOf', 'priorYear']))
    expect(new Set(pairCases.map(([, x]) => x.r.field))).toEqual(new Set(['missingFromExport', 'dupOf', 'priorYear']))
    expect(crossCases.length).toBeGreaterThan(0)
    expect(swapCases.some(([, x]) => x.r.field === 'dupOf')).toBe(true)
    const ids = clients.flatMap((c) => c.key.transactions.map((t) => `${c.id} ${t.id}`))
    expect(new Set(ids).size, 'transaction ids are unique within each client').toBe(ids.length)
  })

  test("ARC-8 the reviewed golden pins exactly the walk's marked rows, group by group, in answer-key order (id, date, amount in cents, dupOf on dupOf rows only)", () => {
    const listed = golden.filter((e) => e.marker !== undefined)
    expect(listed.map((e) => `${String(e.client)} ${String(e.marker?.field)} ${String(e.marker?.account)} ${String(e.marker?.month)}`).sort()).toEqual(
      groupCases.map(([label]) => label).sort(),
    )
    for (const e of listed) {
      const m = e.marker
      if (m === undefined) continue
      const g: MarkerGroup = { client: String(e.client), field: m.field as MarkerGroup['field'], account: m.account, month: m.month }
      expect(Object.keys(m).sort(), e.id).toEqual(['account', 'field', 'month', 'rows'])
      expect(m.rows, `${e.id} ${m.field} ${m.account} ${m.month}`).toEqual(groupPins(clientOf(String(e.client)), g))
    }
  })

  test("ARC-8 the reviewed golden declares 'empty: accounts' on exactly the clients the walk finds with no accounts (C12 today, on 12-F02)", () => {
    const declared = golden.filter((e) => e.empty !== undefined)
    expect(declared.every((e) => e.empty === 'accounts')).toBe(true)
    expect(declared.map((e) => String(e.client)).sort()).toEqual(clients.filter((c) => c.key.accounts.length === 0).map((c) => c.id))
    expect(declared.map((e) => e.id)).toContain('12-F02')
  })

  test('ARC-8 the fault catalogue equals the reviewed golden in full: roll causes, pinned marker rows and the empty declaration included', () => {
    expect(JSON.parse(JSON.stringify(faults())) as unknown).toEqual(golden)
  })

  test.each(groupCases)('ARC-13 %s: the catalogue lists every marked row by id, date and integer cents, each row once', (_l, { c, g }) => {
    const pins = pinsOf(entryFor(catalogue(), g))
    for (const p of pins) expect(Number.isSafeInteger(p.amountCents), p.id).toBe(true)
    expect(new Set(pins.map((p) => p.id)).size).toBe(pins.length)
    expect(pins).toEqual(groupPins(c, g))
  })
})

describe('W00c RC1 a marked row is pinned row by row in the answer key (every listed row of every folder)', () => {
  test.each(rowCases)('ARC-13 %s: its amount moved up one cent is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      const t = txIn(k, r.t.id)
      t.amount = dollars(cents(t.amount) + 1)
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(rowCases)('ARC-13 %s: its amount moved down one cent is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      const t = txIn(k, r.t.id)
      t.amount = dollars(cents(t.amount) - 1)
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(pairCases)('ARC-13 %s: one cent up on the first and one down on the second (count and sum unchanged) is refused, naming both rows', async (_l, { r, mate }) => {
    sb.editKey(r.c, (k) => {
      const a = txIn(k, r.t.id)
      a.amount = dollars(cents(a.amount) + 1)
      const b = txIn(k, mate.id)
      b.amount = dollars(cents(b.amount) - 1)
      // A dupOf row's original moves with it, so the dupOf rule (same amount) still holds and only the pins can tell.
      if (r.field === 'dupOf') {
        const oa = txIn(k, String(r.t.dupOf))
        oa.amount = dollars(cents(oa.amount) + 1)
        const ob = txIn(k, String(mate.dupOf))
        ob.amount = dollars(cents(ob.amount) - 1)
      }
    })
    const issues = await refusal(sb, r.c.id)
    expectNamed(issues, 'fault-catalogue', [r.t.id])
    expectNamed(issues, 'fault-catalogue', [mate.id])
  })

  test.each(rowCases)('ARC-8 %s: moved to another day of the same month (a dupOf row with its original) is refused, naming the row', async (_l, r) => {
    const day = otherDay(r.t.date)
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).date = day
      if (r.field === 'dupOf') txIn(k, String(r.t.dupOf)).date = day
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(swapCases)('ARC-8 %s: the marker moved to an unmarked row of the same account and month is refused, naming the newly marked row', async (_l, { r, to }) => {
    sb.editKey(r.c, (k) => {
      const from = txIn(k, r.t.id)
      setField(from, r.field, undefined)
      setField(txIn(k, to.id), r.field, r.field === 'dupOf' ? r.t.id : 'true')
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [to.id, r.field])
  })

  test.each(rowCases)('ARC-8 %s: an extra row carrying the same marker in the same account and month is refused, naming the extra row', async (_l, r) => {
    const extra = `${r.t.id}-EXTRA-(Test)`
    sb.editKey(r.c, (k) => {
      k.transactions.push(plantRow(r.t, extra, {}))
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [extra])
  })

  test.each(rowCases)('ARC-8 %s: the listed row losing its marker field is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      setField(txIn(k, r.t.id), r.field, undefined)
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test.each(rowCases)('ARC-8 %s: the marker field misspelled in lower case on the listed row is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      const t = txIn(k, r.t.id)
      const value = t[r.field]
      Reflect.deleteProperty(t, r.field)
      t[FIELD_TYPO[r.field] ?? 'x'] = value
    })
    expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
  })

  test('ARC-13 property (fast-check, seed 20261003): any listed row of any client moved by any non-zero number of cents is refused, naming the row', async () => {
    expect(rows.length).toBeGreaterThan(0)
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...rows),
        fc.integer({ min: -100_000_000, max: 100_000_000 }).filter((d) => d !== 0),
        async (r, d) => {
          sb.restore()
          sb.editKey(r.c, (k) => {
            const t = txIn(k, r.t.id)
            t.amount = dollars(cents(t.amount) + d)
          })
          expectNamed(await refusal(sb, r.c.id), 'fault-catalogue', [r.t.id])
        },
      ),
      { seed: 20261003, numRuns: 40 },
    )
  }, 120_000)

  test('ARC-13 property (fast-check, seed 20261003): any two rows of one group moved by +d and -d cents (count and sum unchanged) are refused, naming both', async () => {
    const pairs = pairCases.map(([, x]) => x).filter((x) => x.r.field !== 'dupOf')
    expect(pairs.length).toBeGreaterThan(0)
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...pairs),
        fc.integer({ min: 1, max: 100_000_000 }),
        async ({ r, mate }, d) => {
          sb.restore()
          sb.editKey(r.c, (k) => {
            const a = txIn(k, r.t.id)
            a.amount = dollars(cents(a.amount) + d)
            const b = txIn(k, mate.id)
            b.amount = dollars(cents(b.amount) - d)
          })
          const issues = await refusal(sb, r.c.id)
          expectNamed(issues, 'fault-catalogue', [r.t.id])
          expectNamed(issues, 'fault-catalogue', [mate.id])
        },
      ),
      { seed: 20261003, numRuns: 30 },
    )
  }, 120_000)
})

describe("W00c RC1 the catalogue's pinned rows are checked against the answer key (every marker group and listed row of every folder)", () => {
  test.each(groupCases)("ARC-8 %s with the entry's rows emptied (rows: []) is refused, naming the entry", async (_l, { g }) => {
    const cat = catalogue()
    const e = entryFor(cat, g)
    e.marker.rows = []
    expectNamed(await refusal(sb, g.client, cat), 'fault-catalogue', [e.id])
  })

  test.each(groupCases)('ARC-8 %s with an id the answer key does not have added to its rows is refused, naming that id', async (_l, { c, g }) => {
    const cat = catalogue()
    const first = groupRows(c, g).rows[0]
    if (first === undefined) throw new Error('fixture: empty group')
    const ghost = `${first.id}-GHOST-(Test)`
    addPin(entryFor(cat, g), { ...pinOf(first, g.field), id: ghost })
    expectNamed(await refusal(sb, g.client, cat), 'fault-catalogue', [ghost])
  })

  test.each(rowCases)('ARC-8 %s listed twice in its entry is refused, naming the row', async (_l, r) => {
    const cat = catalogue()
    addPin(entryFor(cat, r.group), pinOf(r.t, r.field))
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(rowCases)('ARC-8 %s listed again by a second flag entry with the same marker is refused, naming the row', async (_l, r) => {
    const cat = catalogue()
    freeFlagEntry(cat, r.c.id).marker = { field: r.field, account: r.t.acct, month: monthOf(r.t.date), rows: [pinOf(r.t, r.field)] }
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(rowCases)('ARC-13 %s with its pinned amountCents one cent off is refused, naming the row', async (_l, r) => {
    const cat = catalogue()
    editPin(entryFor(cat, r.group), r.t.id, (p) => {
      p.amountCents += 1
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(rowCases)('ARC-8 %s with its pinned date another day of the month is refused, naming the row', async (_l, r) => {
    const cat = catalogue()
    editPin(entryFor(cat, r.group), r.t.id, (p) => {
      p.date = otherDay(r.t.date)
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s with its pinned dupOf naming another transaction is refused, naming the row', async (_l, r) => {
    const cat = catalogue()
    const other = r.c.key.transactions.find((t) => t.id !== r.t.dupOf && t.id !== r.t.id)
    if (other === undefined) throw new Error('fixture: no other transaction')
    editPin(entryFor(cat, r.group), r.t.id, (p) => {
      p.dupOf = other.id
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(groupCases)("ARC-8 %s with the entry's account changed to another account of the client is refused, naming the entry or its rows", async (_l, { c, g }) => {
    const other = c.key.accounts.find((a) => a.key !== g.account)
    if (other === undefined) throw new Error('fixture: the client has one account')
    const cat = catalogue()
    const e = entryFor(cat, g)
    e.marker.account = other.key
    const issues = await refusal(sb, g.client, cat)
    const first = groupRows(c, g).rows[0]
    expect(
      issues.some((i) => i.check === 'fault-catalogue' && [e.id, String(first?.id)].some((p) => `${i.record} ${i.reason}`.includes(p))),
      JSON.stringify(issues),
    ).toBe(true)
  })
})

describe('W00c RC1 dupOf names a real, unmarked original with the same account, date and amount (every dup row of every folder; pins kept true)', () => {
  /** The catalogue with this dup row's pinned dupOf changed too, so only the dupOf rule can refuse. */
  const withPinnedDupOf = (r: MarkedRow, dupOf: string): CatalogueEntry[] => {
    const cat = catalogue()
    editPin(entryFor(cat, r.group), r.t.id, (p) => {
      p.dupOf = dupOf
    })
    return cat
  }

  test.each(dupCases)('ARC-8 %s pointing at no transaction is refused, naming the row', async (_l, r) => {
    const gone = `${String(r.t.dupOf)}-GONE-(Test)`
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).dupOf = gone
    })
    expectNamed(await refusal(sb, r.c.id, withPinnedDupOf(r, gone)), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s pointing at itself is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).dupOf = r.t.id
    })
    expectNamed(await refusal(sb, r.c.id, withPinnedDupOf(r, r.t.id)), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s with dupOf "" is refused, naming the row', async (_l, r) => {
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).dupOf = ''
    })
    expectNamed(await refusal(sb, r.c.id, withPinnedDupOf(r, '')), 'fault-catalogue', [r.t.id])
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
    expectNamed(await refusal(sb, r.c.id, withPinnedDupOf(r, twin)), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s moved to another day of the same month, its pin moved with it (its original keeps its date), is refused, naming the row', async (_l, r) => {
    const day = otherDay(r.t.date)
    const cat = catalogue()
    editPin(entryFor(cat, r.group), r.t.id, (p) => {
      p.date = day
    })
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).date = day
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-13 %s one cent away from its original, its pin moved to match, is refused, naming the row', async (_l, r) => {
    const cat = catalogue()
    editPin(entryFor(cat, r.group), r.t.id, (p) => {
      p.amountCents += 1
    })
    sb.editKey(r.c, (k) => {
      const t = txIn(k, r.t.id)
      t.amount = dollars(cents(t.amount) + 1)
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id])
  })

  test.each(dupCases)('ARC-8 %s: a planted duplicate of this duplicate (its original is itself marked), pinned, is refused, naming the planted row', async (_l, r) => {
    const planted = `${r.t.id}-CHAIN-(Test)`
    const cat = catalogue()
    addPin(entryFor(cat, r.group), { ...pinOf(r.t, 'dupOf'), id: planted, dupOf: r.t.id })
    sb.editKey(r.c, (k) => {
      k.transactions.push(plantRow(r.t, planted, { dupOf: r.t.id }))
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [planted])
  })

  test.each(dupCases)('ARC-8 %s: a second duplicate of the same original, pinned, is refused, naming the original', async (_l, r) => {
    const second = `${r.t.id}-SECOND-(Test)`
    const cat = catalogue()
    addPin(entryFor(cat, r.group), { ...pinOf(r.t, 'dupOf'), id: second })
    sb.editKey(r.c, (k) => {
      k.transactions.push(plantRow(r.t, second, { dupOf: String(r.t.dupOf) }))
    })
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [String(r.t.dupOf)])
  })
})

describe('W00c RC1 a priorYear row is dated before the fiscal year and listed by id (every priorYear row of every folder)', () => {
  /** The catalogue with this row's pin moved to a new priorYear entry for the month of `date`. */
  const movedPin = (r: MarkedRow, date: string): CatalogueEntry[] => {
    const cat = catalogue()
    dropPin(entryFor(cat, r.group), r.t.id)
    freeFlagEntry(cat, r.c.id).marker = { field: 'priorYear', account: r.t.acct, month: monthOf(date), rows: [{ ...pinOf(r.t, 'priorYear'), date }] }
    return cat
  }

  test.each(priorCases)('ARC-8 %s dated on the first day of the fiscal year, its pin moved there, is refused, naming the row', async (_l, r) => {
    const start = r.c.key.fiscalYear.start
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).date = start
    })
    expectNamed(await refusal(sb, r.c.id, movedPin(r, start)), 'fault-catalogue', [r.t.id])
  })

  test.each(priorCases)('ARC-8 %s with its pin taken off the catalogue (row unchanged) is refused, naming the row and the field', async (_l, r) => {
    const cat = catalogue()
    dropPin(entryFor(cat, r.group), r.t.id)
    expectNamed(await refusal(sb, r.c.id, cat), 'fault-catalogue', [r.t.id, 'priorYear'])
  })

  test.each(clients.filter((c) => c.key.accounts.length > 0).map((c): [string, WalkClient] => [c.id, c]))(
    'END-9 %s still loads with the real catalogue under the row-by-row marker rules',
    async (_l, c) => {
      expect(monthsIn(c.key, String(c.key.accounts[0]?.key)).length).toBeGreaterThan(0)
      await expectLoads(sb, c.id)
    },
  )
})
