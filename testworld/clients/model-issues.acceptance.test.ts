// W00c acceptance (A463 row 8, SC R35): the model check has a planted failing test, and an empty input says "nothing to
// check" instead of throwing. Spec-writer owned.
import { describe, expect, test } from 'vitest'
import { modelIssues } from '../model/checks'
import type { Client, LoadIssue } from '../model/schema'

type Line = Client['trialBalance']['opening']['rows'][number]
type Month = Client['accounts'][number]['months'][number]

const row = (account: string, debitCents: number, creditCents: number): Line => ({ account, gifi: 1000, gifiStatus: null, debitCents, creditCents })
const zero = (): Client['trialBalance']['opening'] => ({ rows: [row('Suspense (Test)', 0, 0)], totalDebitCents: 0, totalCreditCents: 0 })
const month = (m: string): Month => ({ month: m, openingCents: 0, closingCents: 0, activityCents: 0, rolls: true })

/** A quiet client (Test): one account that rolls 0 to 0 through Jan to Mar 2025, one owner, zero trial balances. */
function quiet(): Client {
  return {
    id: 'C01',
    corporation: { name: 'Quiet Corp (Test)', businessNumber: '', yearStart: '2025-01-01', yearEnd: '2025-03-31' },
    owners: [{ name: 'Owner (Test)' }],
    accounts: [
      { key: 'CHQ', role: 'bank', currency: 'CAD', glAccount: '1000', openingCents: 0, closingCents: 0, exportRows: 0, qboRows: 0, months: [month('2025-01'), month('2025-02'), month('2025-03')] },
    ],
    transactions: [],
    adjustingEntries: [],
    trialBalance: { opening: zero(), unadjusted: zero(), adjusted: zero() },
    flags: [],
    priorYear: null,
  }
}

describe('ARC-8 R35 modelIssues: a planted fault is named, and an empty input says nothing to check', () => {
  test('ARC-8 planted adjusting entry whose debits and credits differ by one cent is named by modelIssues', () => {
    expect(modelIssues(quiet(), [])).toEqual([])
    const c = quiet()
    c.adjustingEntries = [
      { id: 'C01-AJE-01', date: '2025-03-31', type: 'reclass', reason: 'planted (Test)', sources: ['planted (Test)'], lines: [row('Bank (Test)', 10_000, 0), row('Sales (Test)', 0, 9_999)] },
    ]
    const out = modelIssues(c, [])
    expect(out).toContainEqual({ client: 'C01', check: 'nets-to-zero', record: 'C01-AJE-01', reason: 'debits 100.00 and credits 99.99 differ' })
  })

  test('ARC-8 modelIssues([]) returns a "nothing to check" issue and does not throw (SC R35 calls it this way)', () => {
    // SC R35 calls every exported check with one empty array and no catalogue; this mirrors that call exactly.
    const call = modelIssues as unknown as (...args: unknown[]) => LoadIssue[]
    let out: LoadIssue[] | undefined
    expect(() => {
      out = call([])
    }).not.toThrow()
    expect(Array.isArray(out)).toBe(true)
    expect((out ?? []).some((i) => /nothing to check/i.test(i.reason))).toBe(true)
  })
})
