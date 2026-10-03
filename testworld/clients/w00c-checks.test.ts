// Builder unit tests for W00c's model checks: repeats, prototype names, resolved duplicates, pinned markers, empty lists (ARC-8, ARC-13, TB-3).
import { describe, expect, it } from 'vitest'
import { modelIssues } from '../model/checks'
import type { FaultEntry } from '../model/faults'
import type { Client, LoadIssue } from '../model/schema'

type Tx = Client['transactions'][number]
type Month = Client['accounts'][number]['months'][number]
type Account = Client['accounts'][number]
type Line = Client['trialBalance']['opening']['rows'][number]

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
const account = (key: string, months: Month[], closingCents = 0): Account => ({ key, role: 'bank', currency: 'CAD', glAccount: '1000', openingCents: 0, closingCents, exportRows: 0, qboRows: 0, months })
const row = (name: string, debitCents: number, creditCents: number): Line => ({ account: name, gifi: 1000, gifiStatus: null, debitCents, creditCents })
const empty = { rows: [], totalDebitCents: 0, totalCreditCents: 0 }

/** A client whose one account CHQ rolls 0 to 0 through Jan to Mar 2025 with no rows: nothing to report. */
function base(): Client {
  return {
    id: 'C01',
    corporation: { name: 'X (Test)', businessNumber: '', yearStart: '2025-01-01', yearEnd: '2025-03-31' },
    owners: [],
    accounts: [account('CHQ', [month('2025-01', 0, 0), month('2025-02', 0, 0), month('2025-03', 0, 0)])],
    transactions: [],
    adjustingEntries: [],
    trialBalance: { opening: empty, unadjusted: empty, adjusted: empty },
    flags: [],
    priorYear: null,
  }
}
const issue = (check: LoadIssue['check'], record: string, reason: string): LoadIssue => ({ client: 'C01', check, record, reason })
type Marker = NonNullable<FaultEntry['marker']>
const entry = (id: string, marker: Marker): FaultEntry => ({ id, client: 'C01', flagId: id, planted: 'p', expected: 'e', marker })
const run = (c: Client, cat: FaultEntry[] = []): LoadIssue[] => {
  c.flags = cat.flatMap((f) => (f.flagId === undefined ? [] : [{ id: f.flagId, rule: 'r', detail: 'd', severity: null, action: null }]))
  return modelIssues(c, cat)
}
const dupMarker = (rows: number, totalCents: number): Marker => ({ field: 'dupOf', account: 'CHQ', month: '2025-02', rows, totalCents })

describe('ARC-8 W00c repeats and inherited names', () => {
  it('a clean client has no issue', () => {
    expect(run(base())).toEqual([])
  })
  it('two accounts with one key are named once', () => {
    const c = base()
    c.accounts.push(account('CHQ', [month('2025-01', 0, 0), month('2025-02', 0, 0), month('2025-03', 0, 0)]), account('CHQ', []))
    expect(run(c).filter((i) => i.check === 'schema')).toEqual([issue('schema', 'CHQ', 'two accounts have this key')])
  })
  it.each(['toString', '__proto__', 'constructor', 'hasOwnProperty'])('an account keyed %s is refused, naming the key', (key) => {
    const c = base()
    c.accounts = [account(key, [])]
    expect(run(c)).toContainEqual(
      issue('schema', key, 'the account key is the name of an Object.prototype member, which a lookup would find without it being declared'),
    )
  })
  it('an ordinary account key is not an Object.prototype name', () => {
    expect(run(base()).filter((i) => i.check === 'schema')).toEqual([])
  })
  it('two transactions with one id are named', () => {
    const c = base()
    c.transactions = [tx('T1', '2025-01-05', 0), tx('T1', '2025-01-06', 0), tx('T2', '2025-01-06', 0)]
    expect(run(c)).toEqual([issue('schema', 'T1', 'two transactions have this id')])
  })
  it('two adjusting entries with one id are named', () => {
    const c = base()
    const j = { id: 'J1', date: '2025-03-31', type: 't', reason: 'r', sources: ['s'], lines: [row('A', 100, 0), row('B', 0, 100)] }
    c.adjustingEntries = [j, { ...j }, { ...j, id: 'J2' }]
    const out = run(c).filter((i) => i.reason.includes('two adjusting entries'))
    expect(out).toEqual([issue('adjusting-entry', 'J1', 'two adjusting entries have this id')])
  })
  it('two flags with one id are named', () => {
    const c = base()
    const cat: FaultEntry[] = [{ id: 'F1', client: 'C01', flagId: 'F1', planted: 'p', expected: 'e' }]
    c.flags = [1, 2].map(() => ({ id: 'F1', rule: 'r', detail: 'd', severity: null, action: null }))
    expect(modelIssues(c, cat)).toEqual([issue('schema', 'F1', 'two flags have this id')])
  })
  it('TB-3 two rows of one account in one trial balance are named with the trial balance', () => {
    const c = base()
    c.trialBalance = {
      opening: { rows: [row('A', 100, 0), row('A', 0, 0), row('B', 0, 100)], totalDebitCents: 0, totalCreditCents: 0 },
      unadjusted: empty,
      adjusted: empty,
    }
    expect(run(c).filter((i) => i.reason.includes('two rows'))).toEqual([issue('trial-balance', 'opening A', 'the trial balance has two rows for this account')])
  })
  it('TB-3 a trial-balance line is tied out against the sum of its rows for the account', () => {
    const c = base()
    c.transactions = [tx('T1', '2025-01-05', 0, { postings: [{ account: 'A', debitCents: 100, creditCents: 0 }, { account: 'B', debitCents: 0, creditCents: 100 }] })]
    const split = { rows: [row('A', 60, 0), row('A', 40, 0), row('B', 0, 100)], totalDebitCents: 100, totalCreditCents: 100 }
    c.trialBalance = { opening: empty, unadjusted: split, adjusted: split }
    expect(run(c).filter((i) => i.check === 'trial-balance' && !i.reason.includes('two rows'))).toEqual([])
  })
})

describe('ARC-8 W00c a duplicate names a real, plain original of the same account, date and amount', () => {
  const dups = (over: Partial<Tx>, extra: Tx[] = [], originalOver: Partial<Tx> = {}): Client => {
    const c = base()
    c.transactions = [tx('O1', '2025-02-06', 5, originalOver), tx('D1', '2025-02-06', 5, { dupOf: 'O1', ...over }), ...extra]
    return c
  }
  // The statement roll leaves a duplicate out; the export roll is waived by the catalogue's cause (the duplicates' own total).
  const fix = (c: Client): Client => {
    c.accounts = [account('CHQ', [month('2025-01', 0, 0), month('2025-02', 0, 5), month('2025-03', 5, 5)], 5)]
    return c
  }
  const waiver: FaultEntry = { id: 'W', client: 'C01', planted: 'p', expected: 'e', roll: { account: 'CHQ', month: '2025-02', cause: 'duplicate' } }
  const cat = (rows = 1, total = 5): FaultEntry[] => [entry('M', dupMarker(rows, total)), waiver]
  const only = (c: Client, rows = 1, total = 5): LoadIssue[] => run(fix(c), cat(rows, total)).filter((i) => i.check === 'fault-catalogue')

  it('a good pair passes', () => {
    expect(only(dups({}))).toEqual([])
  })
  it('a duplicate of nothing is named with its dangling original', () => {
    expect(only(dups({ dupOf: 'GONE' }))).toEqual([issue('fault-catalogue', 'D1', 'its original "GONE" is not a transaction of this client')])
  })
  it('an empty dupOf names no transaction', () => {
    expect(only(dups({ dupOf: '' }))).toEqual([issue('fault-catalogue', 'D1', 'its original "" is not a transaction of this client')])
  })
  it('a duplicate of itself is named', () => {
    expect(only(dups({ dupOf: 'D1' }))).toEqual([issue('fault-catalogue', 'D1', 'it is its own original')])
  })
  it('an original that carries a marker itself is named', () => {
    const c = dups({}, [], { priorYear: true })
    expect(only(c).filter((i) => i.record === 'D1')).toEqual([issue('fault-catalogue', 'D1', 'its original O1 carries a fault marker itself')])
  })
  it.each([
    ['account', { accountKey: 'SAV' }],
    ['date', { date: '2025-02-07' }],
    ['amount', { amountCents: 6 }],
  ] as [string, Partial<Tx>][])('a duplicate differing from its original in %s is named', (_w, over) => {
    const c = dups({}, [], over)
    expect(only(c).filter((i) => i.record === 'D1')).toEqual([issue('fault-catalogue', 'D1', 'it does not match its original O1 in account, date and amount')])
  })
  it('a second duplicate of one original is named with the original and the first duplicate', () => {
    const c = dups({}, [tx('D2', '2025-02-06', 5, { dupOf: 'O1' })])
    expect(only(c, 2, 10)).toEqual([issue('fault-catalogue', 'D2', 'its original O1 already has a duplicate, D1')])
  })
  it('ARC-13 the pinned rows and cents must equal the marked rows', () => {
    expect(only(dups({}), 2, 5)).toEqual([
      issue('fault-catalogue', 'M', "its pinned 2 row(s) totalling 5 cents do not match the answer key's 1 row(s) totalling 5 cents"),
    ])
    expect(only(dups({}), 1, 6)).toEqual([
      issue('fault-catalogue', 'M', "its pinned 1 row(s) totalling 6 cents do not match the answer key's 1 row(s) totalling 5 cents"),
    ])
  })
  it('ARC-13 a marker entry with no pins is refused', () => {
    const noPins: FaultEntry = { id: 'M', client: 'C01', flagId: 'M', planted: 'p', expected: 'e', marker: { field: 'dupOf', account: 'CHQ', month: '2025-02' } }
    const out = run(fix(dups({})), [noPins, waiver]).filter((i) => i.check === 'fault-catalogue')
    expect(out).toEqual([
      issue('fault-catalogue', 'M', "its pinned undefined row(s) totalling undefined cents do not match the answer key's 1 row(s) totalling 5 cents"),
    ])
  })
  it('ARC-13 rows of another account or another month are not counted for the pins', () => {
    const c = dups({}, [tx('X1', '2025-02-06', 7, { accountKey: 'SAV', dupOf: 'O1' })])
    const out = run(fix(c), cat()).filter((i) => i.record === 'M')
    expect(out).toEqual([])
  })
})

describe('ARC-8 W00c a priorYear row is dated before the fiscal year starts', () => {
  const prior = (date: string): LoadIssue[] => {
    const c = base()
    c.transactions = [tx('P1', date, 5, { priorYear: true })]
    const m: Marker = { field: 'priorYear', account: 'CHQ', month: date.slice(0, 7), rows: 1, totalCents: 5 }
    return run(c, [entry('P', m)])
  }
  it('the day before the year starts passes', () => {
    expect(prior('2024-12-31')).toEqual([])
  })
  it('the first day of the year is refused, naming the row and both dates', () => {
    expect(prior('2025-01-01')).toContainEqual(issue('fault-catalogue', 'P1', 'it is marked priorYear but dated 2025-01-01, not before the fiscal year starts on 2025-01-01'))
  })
  it('a later day of the year is refused', () => {
    expect(prior('2025-02-10').map((i) => i.record)).toContain('P1')
  })
})

describe('ARC-8 W00c every account is checked when its month list is empty', () => {
  it('an account with no months and no rows has each month of the year named', () => {
    const c = base()
    c.accounts = [account('CHQ', [])]
    expect(run(c)).toEqual(['2025-01', '2025-02', '2025-03'].map((m) => issue('roll', `CHQ ${m}`, 'the month of the fiscal year has no statement balances')))
  })
  it('an account with rows and no months is named for both', () => {
    const c = base()
    c.accounts = [account('CHQ', [])]
    c.transactions = [tx('T1', '2025-01-05', 0)]
    const out = run(c).map((i) => i.reason)
    expect(out).toContain('it has transactions but no statement balances, so there is nothing to roll')
    expect(out).toContain('the month of the fiscal year has no statement balances')
  })
  it('the first month must open at the account opening and the last close at its closing, and months are matched on the YYYY-MM slice', () => {
    const c = base()
    c.accounts = [{ ...account('CHQ', [month('2025-01', 1, 0), month('2025-02', 0, 0), month('2025-03', 0, 2)]) }]
    expect(run(c).filter((i) => i.reason.startsWith('the first') || i.reason.startsWith('the last'))).toEqual([
      issue('roll', 'CHQ 2025-01', 'the first month opens at 0.01 but the account opens at 0.00'),
      issue('roll', 'CHQ 2025-03', 'the last month closes at 0.02 but the account closes at 0.00'),
    ])
  })
  it('a row dated on the last day of a month belongs to that month only', () => {
    const c = base()
    c.accounts = [account('CHQ', [month('2025-01', 0, 5), month('2025-02', 5, 5), month('2025-03', 5, 5)], 5)]
    c.transactions = [tx('T1', '2025-01-31', 5)]
    expect(run(c)).toEqual([])
  })
})
