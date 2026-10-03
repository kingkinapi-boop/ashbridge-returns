// Builder unit tests for the W00a roll, month-sequence and marker checks: the whole issue list is compared (ARC-8).
import { describe, expect, it } from 'vitest'
import { modelIssues } from '../model/checks'
import type { FaultEntry } from '../model/faults'
import type { Client, LoadIssue } from '../model/schema'

type Tx = Client['transactions'][number]
type Month = Client['accounts'][number]['months'][number]

const month = (m: string, openingCents: number, closingCents: number): Month => ({ month: m, openingCents, closingCents, activityCents: 0, rolls: true })
const tx = (id: string, date: string, amountCents: number, over: Partial<Tx> = {}): Tx => ({
  id,
  accountKey: 'CHQ',
  date,
  amountCents,
  account: 'Bank',
  glAccount: '1000',
  missingFromExport: false,
  postings: [],
  ...over,
})

/** A client with one bank account over Jan to Mar 2025 and no trial balance rows, so only the roll checks speak. */
function client(months: Month[], transactions: Tx[], role = 'bank', balances: [number, number] = [0, 600]): Client {
  const empty = { rows: [], totalDebitCents: 0, totalCreditCents: 0 }
  return {
    id: 'C01',
    corporation: { name: 'X (Test)', businessNumber: '', yearStart: '2025-01-01', yearEnd: '2025-03-31' },
    owners: [],
    accounts: [{ key: 'CHQ', role, currency: 'CAD', glAccount: '1000', openingCents: balances[0], closingCents: balances[1], exportRows: 0, qboRows: 0, months }],
    transactions,
    adjustingEntries: [],
    trialBalance: { opening: empty, unadjusted: empty, adjusted: empty },
    flags: [],
    priorYear: null,
  }
}
const clean = (): Client =>
  client([month('2025-01', 0, 100), month('2025-02', 100, 300), month('2025-03', 300, 600)], [tx('T1', '2025-01-05', 100), tx('T2', '2025-02-05', 200), tx('T3', '2025-03-05', 300)])

const issue = (check: LoadIssue['check'], record: string, reason: string): LoadIssue => ({ client: 'C01', check, record, reason })
const entry = (over: Partial<FaultEntry>): FaultEntry => ({ id: 'E1', client: 'C01', planted: 'p', expected: 'e', ...over })
type Marker = NonNullable<FaultEntry['marker']>
/** W00c fix 2: a marker entry carries its hand-written row count and signed total (a variable, so the W00a type takes it too). */
const pins = (m: Marker, rows: number, totalCents: number): Marker => {
  const pinnedMarker = { ...m, rows, totalCents }
  return pinnedMarker
}
const run = (c: Client, cat: FaultEntry[] = []): LoadIssue[] => {
  c.flags = cat.flatMap((f) => (f.flagId === undefined ? [] : [{ id: f.flagId, rule: 'r', detail: 'd', severity: null, action: null }]))
  return modelIssues(c, cat)
}

describe('ARC-8 W00a month sequences', () => {
  it('a clean year has no issue', () => {
    expect(run(clean())).toEqual([])
  })
  it('a month listed twice in a row says so once', () => {
    const c = clean()
    c.accounts[0]?.months.splice(1, 0, month('2025-01', 100, 100))
    expect(run(c)).toContainEqual(issue('roll', 'CHQ 2025-01', 'the month is listed twice'))
    expect(run(c).filter((i) => i.reason.includes('out of order'))).toEqual([])
  })
  it('months out of order are named', () => {
    const c = clean()
    const ms = c.accounts[0]?.months
    if (ms === undefined) throw new Error('fixture')
    ms.reverse()
    expect(run(c)).toContainEqual(issue('roll', 'CHQ 2025-02', 'the months are out of order'))
  })
  it('a missing month names the month', () => {
    const c = clean()
    c.accounts[0]?.months.splice(1, 1)
    c.transactions = c.transactions.filter((t) => t.id !== 'T2')
    expect(run(c)).toContainEqual(issue('roll', 'CHQ 2025-02', 'the month of the fiscal year has no statement balances'))
  })
  it('a month after the year is outside the fiscal year', () => {
    const c = clean()
    c.accounts[0]?.months.push(month('2025-04', 600, 600))
    expect(run(c)).toEqual([issue('roll', 'CHQ 2025-04', 'the month is outside the fiscal year 2025-01-01 to 2025-03-31')])
  })
  it('the year runs across a new year (Nov to Feb)', () => {
    const c = client(
      [month('2024-11', 0, 0), month('2024-12', 0, 100), month('2025-01', 100, 100), month('2025-02', 100, 300)],
      [tx('T1', '2024-12-05', 100), tx('T2', '2025-02-05', 200)],
      'bank',
      [0, 300],
    )
    c.corporation.yearStart = '2024-11-01'
    c.corporation.yearEnd = '2025-02-28'
    expect(run(c)).toEqual([])
    c.corporation.yearEnd = '2025-01-31'
    expect(run(c)).toEqual([issue('roll', 'CHQ 2025-02', 'the month is outside the fiscal year 2024-11-01 to 2025-01-31')])
  })
  it('a closing that is not the next opening names the month that opens wrong, with both figures', () => {
    const c = clean()
    c.accounts[0]?.months.splice(1, 1, month('2025-02', 101, 301))
    expect(run(c)).toContainEqual(issue('roll', 'CHQ 2025-02', 'it opens at 1.01 but the month before closed at 1.00'))
  })
  it('the first opening and the last closing must be the account balances', () => {
    const c = clean()
    c.accounts[0] = { ...(c.accounts[0] as Client['accounts'][number]), openingCents: 5, closingCents: 7 }
    expect(run(c)).toEqual([
      issue('roll', 'CHQ 2025-01', 'the first month opens at 0.00 but the account opens at 0.05'),
      issue('roll', 'CHQ 2025-03', 'the last month closes at 6.00 but the account closes at 0.07'),
    ])
  })
  it('a transaction dated in no month of its account is named', () => {
    const c = clean()
    c.transactions.push(tx('T9', '2025-07-01', 0))
    expect(run(c)).toEqual([issue('roll', 'T9', 'it is dated 2025-07-01, in no month of CHQ')])
  })
  it('an account with transactions and no months says there is nothing to roll', () => {
    const c = client([], [tx('T1', '2025-01-05', 100)])
    // W00c fix 4: the coverage check also names each month of the year, so these two are among the issues.
    expect(run(c)).toEqual(
      expect.arrayContaining([
        issue('roll', 'CHQ', 'it has transactions but no statement balances, so there is nothing to roll'),
        issue('roll', 'T1', 'it is dated 2025-01-05, in no month of CHQ'),
      ]),
    )
  })
})

describe('ARC-8 W00a both rolls', () => {
  it('a card subtracts the month', () => {
    const c = client([month('2025-01', 0, -100), month('2025-02', -100, -300), month('2025-03', -300, -600)], clean().transactions, 'card', [0, -600])
    expect(run(c)).toEqual([])
  })
  it('a statement that does not roll names both figures even when a waiver lists the month', () => {
    const c = clean()
    c.accounts[0]?.months.splice(1, 1, month('2025-02', 100, 301), month('2025-02', 301, 301))
    c.accounts[0]?.months.splice(2, 1)
    const cat = [entry({ roll: { account: 'CHQ', month: '2025-02', cause: 'missing' } })]
    expect(run(c, cat).filter((i) => i.reason.startsWith('the statement roll'))).toEqual([
      issue('roll', 'CHQ 2025-02', "the statement roll: opening 1.00 with the month's rows gives 3.00, not the closing 3.01; a fault marker never excuses it"),
    ])
  })
  it('a dupOf row is off the statement and a priorYear row is off the statement', () => {
    // W00c fix 2: a dupOf row copies its original (same account, date and amount) and a priorYear row is dated before
    // the fiscal year, so the prior-year row can no longer sit in the duplicate's month.
    const c = clean()
    c.transactions.push(tx('D1', '2025-02-05', 200, { dupOf: 'T2' }), tx('P1', '2024-12-20', 70, { priorYear: true }))
    const cat = [
      entry({ id: 'F1', flagId: 'F1', marker: pins({ field: 'dupOf', account: 'CHQ', month: '2025-02' }, 1, 200) }),
      entry({ id: 'F2', flagId: 'F2', marker: pins({ field: 'priorYear', account: 'CHQ', month: '2024-12' }, 1, 70) }),
      entry({ id: 'R1', roll: { account: 'CHQ', month: '2025-02', cause: 'duplicate' } }),
    ]
    expect(run(c, cat)).toEqual([])
  })
  it('a waived duplicate month explains its gap exactly', () => {
    const c = clean()
    c.transactions.push(tx('D1', '2025-02-05', 200, { dupOf: 'T2' }))
    const marker = entry({ id: 'F1', flagId: 'F1', marker: pins({ field: 'dupOf', account: 'CHQ', month: '2025-02' }, 1, 200) })
    const waiver = entry({ id: 'R1', roll: { account: 'CHQ', month: '2025-02', cause: 'duplicate' } })
    expect(run(c, [marker, waiver])).toEqual([])
  })
  it('a waiver with no cause explains nothing, even when the gap is exactly the duplicate rows', () => {
    const c = clean()
    c.transactions.push(tx('D1', '2025-02-05', 200, { dupOf: 'T2' }))
    const marker = entry({ id: 'F1', flagId: 'F1', marker: pins({ field: 'dupOf', account: 'CHQ', month: '2025-02' }, 1, 200) })
    const waiver = entry({ id: 'R1', roll: { account: 'CHQ', month: '2025-02' } })
    expect(run(c, [marker, waiver])).toEqual([issue('roll', 'CHQ 2025-02', "the export gap -2.00 is not explained exactly by the catalogue's cause undefined")])
  })
  it('a waived missing month explains its gap exactly, and only the missing rows count', () => {
    const c = clean()
    c.transactions.push(tx('M1', '2025-02-06', 0, { missingFromExport: true }))
    c.transactions = c.transactions.map((t) => (t.id === 'T2' ? { ...t, missingFromExport: true } : t))
    const marker = entry({ id: 'F1', flagId: 'F1', marker: pins({ field: 'missingFromExport', account: 'CHQ', month: '2025-02' }, 2, 200) })
    const waiver = entry({ id: 'R1', roll: { account: 'CHQ', month: '2025-02', cause: 'missing' } })
    expect(run(c, [marker, waiver])).toEqual([])
    // The same gap blamed on duplicates, or on nothing, is refused.
    for (const cause of ['duplicate', undefined] as const) {
      const bad = entry({ id: 'R1', roll: cause === undefined ? { account: 'CHQ', month: '2025-02' } : { account: 'CHQ', month: '2025-02', cause } })
      expect(run(c, [marker, bad])).toEqual([issue('roll', 'CHQ 2025-02', `the export gap 2.00 is not explained exactly by the catalogue's cause ${String(cause)}`)])
    }
  })
  it('missing rows that do not make up the gap do not explain it', () => {
    const c = clean()
    c.transactions.push(tx('M1', '2025-02-06', 0, { missingFromExport: true }))
    c.transactions = c.transactions.map((t) => (t.id === 'T2' ? { ...t, missingFromExport: true } : t))
    c.transactions.push(tx('X1', '2025-02-08', 5))
    c.accounts[0]?.months.splice(1, 1, month('2025-02', 100, 305))
    c.accounts[0]?.months.splice(2, 1, month('2025-03', 305, 605))
    c.accounts[0] = { ...(c.accounts[0] as Client['accounts'][number]), closingCents: 605 }
    const marker = entry({ id: 'F1', flagId: 'F1', marker: pins({ field: 'missingFromExport', account: 'CHQ', month: '2025-02' }, 2, 200) })
    const waiver = entry({ id: 'R1', roll: { account: 'CHQ', month: '2025-02', cause: 'missing' } })
    expect(run(c, [marker, waiver])).toEqual([])
    c.accounts[0].months.splice(1, 1, month('2025-02', 100, 306))
    expect(run(c, [marker, waiver]).map((i) => i.reason.slice(0, 30))).toContain('the export gap 2.01 is not exp')
  })
  it('an unlisted export gap says what the export gives', () => {
    const c = clean()
    c.transactions = c.transactions.map((t) => (t.id === 'T2' ? { ...t, missingFromExport: true } : t))
    const out = run(c, [entry({ id: 'F1', flagId: 'F1', marker: pins({ field: 'missingFromExport', account: 'CHQ', month: '2025-02' }, 1, 200) })])
    expect(out).toEqual([issue('roll', 'CHQ 2025-02', 'the export gives 1.00, not the closing 3.00, and the fault catalogue lists no planted fault for it')])
  })
  it('a waiver on a month that rolls, or on a month the client lacks, is refused', () => {
    expect(run(clean(), [entry({ roll: { account: 'CHQ', month: '2025-02', cause: 'missing' } })])).toEqual([
      issue('roll', 'CHQ 2025-02', 'the fault catalogue lists it as a planted fault but the month rolls'),
    ])
    expect(run(clean(), [entry({ roll: { account: 'CHQ', month: '2026-02', cause: 'missing' } })])).toEqual([
      issue('fault-catalogue', 'E1', 'the catalogue waives CHQ 2026-02, which this client does not have'),
    ])
    expect(run(clean(), [entry({ roll: { account: 'SAV', month: '2025-02', cause: 'missing' } })])).toEqual([
      issue('fault-catalogue', 'E1', 'the catalogue waives SAV 2025-02, which this client does not have'),
    ])
  })
  it("another client's waiver does not apply", () => {
    const c = clean()
    c.transactions = c.transactions.map((t) => (t.id === 'T2' ? { ...t, missingFromExport: true } : t))
    const other = entry({ client: 'C02', roll: { account: 'CHQ', month: '2025-02', cause: 'missing' } })
    expect(run(c, [other]).map((i) => i.reason.slice(0, 14))).toContain('the export giv')
  })
})

describe('ARC-8 W00a markers', () => {
  // W00c fix 2: the duplicate copies its original (same account, date and amount), and the marker pins one row of 0.00.
  const dupClient = (): Client => {
    const c = clean()
    c.transactions.push(tx('O1', '2025-02-06', 0), tx('D1', '2025-02-06', 0, { dupOf: 'O1' }))
    return c
  }
  const dupMarker = pins({ field: 'dupOf', account: 'CHQ', month: '2025-02' }, 1, 0)
  it('a marker with no entry is named with the row and the field', () => {
    expect(run(dupClient())).toEqual([issue('fault-catalogue', 'CHQ 2025-02', 'D1 carries dupOf and the fault catalogue has no flag entry with that marker for this account and month')])
  })
  it('a marker entry with no flag does not cover the marker and is named', () => {
    expect(run(dupClient(), [entry({ id: 'M1', marker: dupMarker })])).toEqual([
      issue('fault-catalogue', 'CHQ 2025-02', 'D1 carries dupOf and the fault catalogue has no flag entry with that marker for this account and month'),
      issue('fault-catalogue', 'M1', 'a marker entry must be on the entry of the flag the planted fault raises'),
    ])
  })
  it('a covered marker passes', () => {
    expect(run(dupClient(), [entry({ id: 'M1', flagId: 'M1', marker: dupMarker })])).toEqual([])
  })
  it("another client's marker entry does not cover", () => {
    expect(run(dupClient(), [entry({ client: 'C02', flagId: 'M1', marker: dupMarker })]).map((i) => i.record)).toEqual(['CHQ 2025-02', 'M1'])
  })
  it('a marker entry that no row carries is named', () => {
    // W00c fix 2: its pins (one row) no longer match the rows either, so the entry may be named more than once.
    const out = run(clean(), [entry({ id: 'M1', flagId: 'M1', marker: dupMarker })])
    expect(out).toContainEqual(issue('fault-catalogue', 'M1', 'no transaction carries its marker dupOf CHQ 2025-02'))
    expect([...new Set(out.map((i) => `${i.check} ${i.record}`))]).toEqual(['fault-catalogue M1'])
  })
  it('a roll entry that is also a marker entry is refused', () => {
    const c = dupClient()
    const both = entry({ id: 'B1', flagId: 'B1', marker: dupMarker, roll: { account: 'CHQ', month: '2025-02', cause: 'duplicate' } })
    expect(run(c, [both]).filter((i) => i.record === 'B1' && i.reason === 'a roll entry is not a marker entry')).toEqual([issue('fault-catalogue', 'B1', 'a roll entry is not a marker entry')])
  })
  it('a priorYear row outside every month passes only when its marker is listed for its own account and month', () => {
    const c = clean()
    c.transactions.push(tx('P1', '2024-12-20', 5, { priorYear: true }))
    const listed = entry({ id: 'P', flagId: 'P', marker: pins({ field: 'priorYear', account: 'CHQ', month: '2024-12' }, 1, 5) })
    expect(run(c, [listed])).toEqual([])
    const elsewhere = entry({ id: 'P', flagId: 'P', marker: pins({ field: 'priorYear', account: 'CHQ', month: '2024-11' }, 0, 0) })
    expect(run(c, [elsewhere]).map((i) => `${i.check} ${i.record}`)).toEqual(['roll P1', 'fault-catalogue CHQ 2024-12', 'fault-catalogue P'])
  })
  it('a row outside every month that is not priorYear is refused even when a priorYear marker covers its month', () => {
    const c = clean()
    c.transactions.push(tx('P1', '2024-12-20', 0))
    const listed = entry({ id: 'P', flagId: 'P', marker: pins({ field: 'priorYear', account: 'CHQ', month: '2024-12' }, 0, 0) })
    expect(run(c, [listed]).map((i) => `${i.check} ${i.record}`)).toEqual(['roll P1', 'fault-catalogue P'])
  })
})
