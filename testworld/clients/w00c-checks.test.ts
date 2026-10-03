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
/** W00c round 2 (RC2): a trial balance needs a row, so the quiet one holds a single zero row. */
const zero = (): Client['trialBalance']['opening'] => ({ rows: [row('Suspense (Test)', 0, 0)], totalDebitCents: 0, totalCreditCents: 0 })

/** A client whose one account CHQ rolls 0 to 0 through Jan to Mar 2025 with no rows, one owner and zero trial balances: nothing to report. */
function base(): Client {
  return {
    id: 'C01',
    corporation: { name: 'X (Test)', businessNumber: '', yearStart: '2025-01-01', yearEnd: '2025-03-31' },
    owners: [{ name: 'Owner (Test)' }],
    accounts: [account('CHQ', [month('2025-01', 0, 0), month('2025-02', 0, 0), month('2025-03', 0, 0)])],
    transactions: [],
    adjustingEntries: [],
    trialBalance: { opening: zero(), unadjusted: zero(), adjusted: zero() },
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
/** W00c round 2 (RC1): a pin is one listed row; cast through unknown so the file type-checks before and after the build. */
type Pin = { id: string; date: string; amountCents: number; dupOf?: string }
const pinOf = (t: Tx, field: Marker['field']): Pin => ({ id: t.id, date: t.date, amountCents: t.amountCents, ...(field === 'dupOf' && t.dupOf !== undefined ? { dupOf: t.dupOf } : {}) })
const marker = (field: Marker['field'], m: string, rows: Pin[]): Marker => ({ field, account: 'CHQ', month: m, rows }) as unknown as Marker
const dupMarker = (rows: Pin[]): Marker => marker('dupOf', '2025-02', rows)
/** True when one issue of the check names every word in its record or reason. */
const names = (out: LoadIssue[], check: LoadIssue['check'], words: string[]): boolean => out.some((i) => i.check === check && words.every((w) => `${i.record} ${i.reason}`.includes(w)))

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
      unadjusted: zero(),
      adjusted: zero(),
    }
    expect(run(c).filter((i) => i.reason.includes('two rows'))).toEqual([issue('trial-balance', 'opening A', 'the trial balance has two rows for this account')])
  })
  it('TB-3 a trial-balance line is tied out against the sum of its rows for the account', () => {
    const c = base()
    c.transactions = [tx('T1', '2025-01-05', 0, { postings: [{ account: 'A', debitCents: 100, creditCents: 0 }, { account: 'B', debitCents: 0, creditCents: 100 }] })]
    const split = { rows: [row('A', 60, 0), row('A', 40, 0), row('B', 0, 100)], totalDebitCents: 100, totalCreditCents: 100 }
    c.trialBalance = { opening: zero(), unadjusted: split, adjusted: split }
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
  /** The marker entry lists every dupOf row of CHQ in February, unless the test hands it other pins. */
  const listedDups = (c: Client): Pin[] => c.transactions.filter((t) => t.dupOf !== undefined && t.accountKey === 'CHQ' && t.date.startsWith('2025-02')).map((t) => pinOf(t, 'dupOf'))
  const cat = (pins: Pin[]): FaultEntry[] => [entry('M', dupMarker(pins)), waiver]
  const only = (c: Client, pins?: Pin[]): LoadIssue[] => run(fix(c), cat(pins ?? listedDups(c))).filter((i) => i.check === 'fault-catalogue')

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
    expect(only(c)).toEqual([issue('fault-catalogue', 'D2', 'its original O1 already has a duplicate, D1')])
  })
  // W00c round 2 (RC1) retires the row count and signed total: each listed row is pinned by id, date, cents and original.
  const d1 = (): Pin => pinOf(tx('D1', '2025-02-06', 5, { dupOf: 'O1' }), 'dupOf')
  it('ARC-13 the listed rows must be the marked rows, each with its own date, cents and original', () => {
    expect(only(dups({}), [d1()])).toEqual([])
    const ghost = only(dups({}), [d1(), { id: 'GHOST', date: '2025-02-06', amountCents: 0, dupOf: 'O1' }])
    expect(ghost.length).toBeGreaterThan(0)
    expect(names(ghost, 'fault-catalogue', ['GHOST'])).toBe(true)
    for (const wrong of [{ ...d1(), amountCents: 6 }, { ...d1(), date: '2025-02-07' }, { ...d1(), dupOf: 'X9' }]) {
      const out = only(dups({}), [wrong])
      expect(out.map((i) => i.record), JSON.stringify(wrong)).toContain('M')
      expect(names(out, 'fault-catalogue', ['D1']), JSON.stringify(wrong)).toBe(true)
    }
  })
  it('ARC-13 a marked row the entry does not list is named with its id and the field', () => {
    expect(names(only(dups({}), [{ ...d1(), id: 'D9' }]), 'fault-catalogue', ['D1', 'dupOf'])).toBe(true)
  })
  it('ARC-13 a marker entry with no rows listed is refused', () => {
    const noPins: FaultEntry = { id: 'M', client: 'C01', flagId: 'M', planted: 'p', expected: 'e', marker: { field: 'dupOf', account: 'CHQ', month: '2025-02' } }
    const out = run(fix(dups({})), [noPins, waiver]).filter((i) => i.check === 'fault-catalogue')
    expect(out.map((i) => i.record)).toContain('M')
    expect(only(dups({}), []).map((i) => i.record)).toContain('M')
  })
  it('ARC-13 rows of another account are not the entry\'s to list', () => {
    const c = dups({}, [tx('X1', '2025-02-06', 7, { accountKey: 'SAV', dupOf: 'O1' })])
    const out = run(fix(c), cat([d1()])).filter((i) => i.record === 'M')
    expect(out).toEqual([])
  })
})

describe('ARC-8 W00c a priorYear row is dated before the fiscal year starts', () => {
  const prior = (date: string): LoadIssue[] => {
    const c = base()
    c.transactions = [tx('P1', date, 5, { priorYear: true })]
    const p1 = c.transactions[0]
    if (p1 === undefined) throw new Error('fixture')
    return run(c, [entry('P', marker('priorYear', date.slice(0, 7), [pinOf(p1, 'priorYear')]))])
  }
  it('the day before the year starts passes', () => {
    expect(prior('2024-12-31')).toEqual([])
  })
  it('the first day of the year is refused, naming the row and the date', () => {
    expect(names(prior('2025-01-01'), 'fault-catalogue', ['P1', '2025-01-01'])).toBe(true)
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
