// Builder unit tests for the model checks: every branch is planted and the whole issue list is compared.
import { describe, expect, it } from 'vitest'
import { modelIssues } from './checks'
import type { FaultEntry } from './faults'
import type { Client, LoadIssue } from './schema'

type Line = Client['trialBalance']['opening']['rows'][number]
type Account = Client['accounts'][number]
type Entry = Client['adjustingEntries'][number]

const line = (account: string, debitCents: number, creditCents: number, gifi: number | null = 1000, gifiStatus: string | null = null): Line => ({
  account,
  gifi,
  gifiStatus,
  debitCents,
  creditCents,
})
const tb = (rows: Line[]): Client['trialBalance']['opening'] => ({ rows, totalDebitCents: 0, totalCreditCents: 0 })
const account = (key: string, role: string, months: Account['months']): Account => ({
  key,
  role,
  currency: 'CAD',
  glAccount: key,
  openingCents: 0,
  closingCents: 0,
  exportRows: 0,
  qboRows: 0,
  months,
})
const month = (m: string, openingCents: number, activityCents: number, closingCents: number): Account['months'][number] => ({
  month: m,
  openingCents,
  activityCents,
  closingCents,
  rolls: true,
})
const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 'J1',
  // W00c round 2 (RC3): an adjusting entry falls inside the fiscal year, here its last day.
  date: '2025-01-31',
  type: 'adjust',
  reason: 'because',
  sources: ['src'],
  lines: [line('Bank', 100, 0), line('Bank', 0, 100)],
  ...over,
})

function clean(): Client {
  const rows = [line('Bank', 1000, 0), line('Revenue', 0, 1000, 8000)]
  return {
    id: 'C01',
    corporation: { name: 'X (Test)', businessNumber: '', yearStart: '2025-01-01', yearEnd: '2025-01-31' },
    // W00c round 2 (RC2): a client has an owner, and its opening trial balance holds a row (a zero one here).
    owners: [{ name: 'Owner (Test)' }],
    // W00a spec (S5): a clean client's months are its whole year and its account closes where its last month does.
    accounts: [{ ...account('CHQ', 'bank', [month('2025-01', 0, 1000, 1000)]), closingCents: 1000 }],
    transactions: [
      {
        id: 'T1',
        accountKey: 'CHQ',
        date: '2025-01-05',
        amountCents: 1000,
        account: 'Bank',
        glAccount: '1000',
        missingFromExport: false,
        postings: [
          { account: 'Bank', debitCents: 1000, creditCents: 0 },
          { account: 'Revenue', debitCents: 0, creditCents: 1000 },
        ],
      },
    ],
    adjustingEntries: [],
    trialBalance: { opening: tb([line('Bank', 0, 0)]), unadjusted: tb(rows), adjusted: tb(rows.map((r) => ({ ...r }))) },
    flags: [],
    priorYear: null,
  }
}

const issue = (check: LoadIssue['check'], record: string, reason: string): LoadIssue => ({ client: 'C01', check, record, reason })
const run = (c: Client, cat: readonly FaultEntry[] = []): LoadIssue[] => modelIssues(c, cat)
const waiver = (account: string, m: string, over: Partial<FaultEntry> = {}): FaultEntry => ({
  id: `roll-${account}-${m}`,
  client: 'C01',
  planted: 'p',
  expected: 'e',
  roll: { account, month: m },
  ...over,
})

function first<T extends { transactions: unknown[] }>(c: T): T['transactions'][number] {
  const t = c.transactions[0]
  if (t === undefined) throw new Error('fixture has no transaction')
  return t
}

describe('model checks', () => {
  it('a clean client has no issues', () => {
    expect(run(clean())).toEqual([])
  })

  describe('adjusting entries', () => {
    it('an entry with no lines is refused', () => {
      const c = clean()
      c.adjustingEntries = [entry({ lines: [] })]
      expect(run(c)).toEqual([issue('adjusting-entry', 'J1', 'it has no lines')])
    })
    it('an unbalanced entry names both totals, and the adjusted balance follows the entry', () => {
      const c = clean()
      c.adjustingEntries = [entry({ lines: [line('Bank', 500, 0), line('Bank', 0, 200)] })]
      c.trialBalance.adjusted.rows[0] = line('Bank', 1300, 0)
      expect(run(c)).toEqual([
        issue('nets-to-zero', 'J1', 'debits 5.00 and credits 2.00 differ'),
        issue('trial-balance', 'adjusted', 'debits 13.00 and credits 10.00 differ'),
      ])
    })
    it('a blank reason is refused, a real one passes', () => {
      const c = clean()
      c.adjustingEntries = [entry({ reason: '   ' })]
      expect(run(c)).toEqual([issue('adjusting-entry', 'J1', 'it has no reason')])
    })
    it('an entry with no source is refused', () => {
      const c = clean()
      c.adjustingEntries = [entry({ sources: [] })]
      expect(run(c)).toEqual([issue('adjusting-entry', 'J1', 'it has no source')])
    })
    it('a balanced entry with a reason and a source passes', () => {
      const c = clean()
      c.adjustingEntries = [entry()]
      expect(run(c)).toEqual([])
    })
  })

  describe('trial balances', () => {
    it('an unbalanced opening trial balance is refused, with the line it leaves out', () => {
      const c = clean()
      c.trialBalance.opening = tb([line('X', 300, 0)])
      expect(run(c)).toEqual([
        issue('trial-balance', 'opening', 'debits 3.00 and credits 0.00 differ'),
        issue('trial-balance', 'unadjusted X', 'the line is 0.00 but the books give 3.00'),
        issue('trial-balance', 'adjusted X', 'the line is 0.00 but the books give 3.00'),
      ])
    })
    it('an unbalanced unadjusted trial balance is refused, the adjusted one is not touched', () => {
      const c = clean()
      c.trialBalance.unadjusted.rows[0] = line('Bank', 1200, 0)
      expect(run(c)).toEqual([
        issue('trial-balance', 'unadjusted', 'debits 12.00 and credits 10.00 differ'),
        issue('trial-balance', 'unadjusted Bank', 'the line is 12.00 but the books give 10.00'),
      ])
    })
    it('an unbalanced adjusted trial balance is refused, with a credit line shown negative', () => {
      const c = clean()
      c.trialBalance.adjusted.rows[1] = line('Revenue', 0, 900, 8000)
      expect(run(c)).toEqual([
        issue('trial-balance', 'adjusted', 'debits 10.00 and credits 9.00 differ'),
        issue('trial-balance', 'adjusted Revenue', 'the line is -9.00 but the books give -10.00'),
      ])
    })
    it('lines the books do not have are refused', () => {
      const c = clean()
      c.trialBalance.unadjusted.rows.push(line('Z', 100, 0), line('W', 0, 100))
      expect(run(c)).toEqual([
        issue('trial-balance', 'unadjusted Z', 'the line is 1.00 but the books give 0.00'),
        issue('trial-balance', 'unadjusted W', 'the line is -1.00 but the books give 0.00'),
      ])
    })
    it('adjusting entries are counted in the adjusted tie-out only', () => {
      const c = clean()
      c.adjustingEntries = [entry({ lines: [line('Bank', 400, 0), line('Revenue', 0, 400, 8000)] })]
      c.trialBalance.adjusted.rows = [line('Bank', 1400, 0), line('Revenue', 0, 1400, 8000)]
      expect(run(c)).toEqual([])
    })
  })

  describe('roll', () => {
    it('a waived month that rolls is refused', () => {
      expect(run(clean(), [waiver('CHQ', '2025-01')])).toEqual([
        issue('roll', 'CHQ 2025-01', 'the fault catalogue lists it as a planted fault but the month rolls'),
      ])
    })
    it('a waiver for an account or a month the client does not have is refused', () => {
      const c = clean()
      expect(run(c, [waiver('ZZZ', '2025-01')])).toEqual([
        issue('fault-catalogue', 'roll-ZZZ-2025-01', 'the catalogue waives ZZZ 2025-01, which this client does not have'),
      ])
      expect(run(c, [waiver('CHQ', '2025-09')])).toEqual([
        issue('fault-catalogue', 'roll-CHQ-2025-09', 'the catalogue waives CHQ 2025-09, which this client does not have'),
      ])
      c.accounts.push(account('EMPTY', 'bank', []))
      // W00c fix 4: EMPTY's missing months are named too, so the waiver issue is one of the issues.
      expect(run(c, [waiver('EMPTY', '2025-01')])).toContainEqual(
        issue('fault-catalogue', 'roll-EMPTY-2025-01', 'the catalogue waives EMPTY 2025-01, which this client does not have'),
      )
    })
    it('an account with transactions but no statement balances is refused', () => {
      const c = clean()
      c.accounts.push(account('EMPTY', 'bank', []))
      // W00c fix 4 retires "an empty account is quiet": the coverage check names its months (acceptance RC3).
      c.transactions.push({ ...first(c), id: 'T2', accountKey: 'EMPTY', postings: [] })
      // W00a spec (S5): the row also falls in no month of its account, so the list holds this issue among others.
      expect(run(c)).toContainEqual(issue('roll', 'EMPTY', 'it has transactions but no statement balances, so there is nothing to roll'))
    })
  })

  describe('transactions', () => {
    it('a transaction with a blank account name is refused', () => {
      const c = clean()
      first(c).account = '  '
      expect(run(c)).toEqual([issue('transaction-account', 'T1', 'it has no account')])
    })
    it('a transaction on an undeclared account is refused', () => {
      const c = clean()
      first(c).accountKey = 'NOPE'
      // W00a spec (S5): the row also falls in no month of its account, so the list holds this issue among others.
      expect(run(c)).toContainEqual(issue('transaction-account', 'T1', 'its account "NOPE" is not one the client declares'))
    })
  })

  describe('GIFI codes', () => {
    const withLine = (l: Line): Client => {
      const c = clean()
      c.adjustingEntries = [entry({ lines: [l] })]
      return c
    }
    it('a line with no code that is not marked confirm is refused', () => {
      expect(run(withLine(line('Susp', 0, 0, null, null)))).toEqual([
        issue('gifi', 'Susp', 'it has no GIFI code and is not marked "confirm" for a person to decide'),
      ])
      expect(run(withLine(line('Susp', 0, 0, null, 'other')))).toEqual([
        issue('gifi', 'Susp', 'it has no GIFI code and is not marked "confirm" for a person to decide'),
      ])
    })
    it('a line with no code marked confirm passes', () => {
      expect(run(withLine(line('Susp', 0, 0, null, 'confirm')))).toEqual([])
    })
    it('a code that is not exactly four digits is refused', () => {
      for (const code of [123, 12345, -1234]) {
        expect(run(withLine(line('Susp', 0, 0, code, null)))).toEqual([
          issue('gifi', 'Susp', `the GIFI code ${String(code)} is not four digits`),
        ])
      }
      expect(run(withLine(line('Susp', 0, 0, 1234, null)))).toEqual([])
    })
    it('trial balance rows are checked as well', () => {
      const c = clean()
      c.trialBalance.unadjusted.rows[0] = line('Bank', 1000, 0, 99)
      expect(run(c)).toEqual([issue('gifi', 'Bank', 'the GIFI code 99 is not four digits')])
    })
  })

  describe('flags and the fault catalogue', () => {
    const flag = (id: string): Client['flags'][number] => ({ id, rule: 'r', detail: 'd', severity: null, action: null })
    const listed = (flagId: string, over: Partial<FaultEntry> = {}): FaultEntry => ({
      id: flagId,
      client: 'C01',
      flagId,
      planted: 'p',
      expected: 'e',
      ...over,
    })
    it('a flag in the answer key and the catalogue passes', () => {
      const c = clean()
      c.flags = [flag('F1')]
      expect(run(c, [listed('F1'), waiver('CHQ', '2025-09', { client: 'C99' })])).toEqual([])
    })
    it('a flag the catalogue does not list is refused', () => {
      const c = clean()
      c.flags = [flag('F1')]
      expect(run(c, [listed('F1', { client: 'C99' })])).toEqual([
        issue('fault-catalogue', 'F1', 'the answer key has this flag and the fault catalogue does not list it'),
      ])
    })
    it('a catalogue flag the answer key does not have is refused; a roll-only entry is not a flag', () => {
      const c = clean()
      expect(run(c, [listed('F2'), listed('F9', { client: 'C99' })])).toEqual([
        issue('fault-catalogue', 'F2', 'the fault catalogue lists this flag and the answer key does not have it'),
      ])
      expect(run(c, [waiver('CHQ', '2025-01', { id: 'W' }), { id: 'x', client: 'C01', planted: 'p', expected: 'e' }])).toEqual([
        issue('roll', 'CHQ 2025-01', 'the fault catalogue lists it as a planted fault but the month rolls'),
      ])
    })
  })
})
