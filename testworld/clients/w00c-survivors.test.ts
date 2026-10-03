// Builder unit tests that pin the cases a mutation run showed unpinned in W00c's checks and loader (ARC-8, ARC-13, ARC-15).
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { SAMPLE_ROOT, clientFolders, loadClient } from './load'
import { modelIssues } from '../model/checks'
import type { FaultEntry } from '../model/faults'
import { TestWorldLoadError, isCalendarDate, type Client, type LoadIssue } from '../model/schema'

type Obj = Record<string, unknown>
const roots: string[] = []
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

/** A copy of one sample client in a temporary root, with a way to edit its files and read the issues a load gives. */
function copy(client: 'C01' | 'C07'): { root: string; folder: string; edit: (file: string, f: (j: Obj) => void) => void; issues: () => LoadIssue[] } {
  const home = clientFolders().get(client)
  if (home === undefined) throw new Error('fixture: no client')
  const name = home.slice(home.lastIndexOf('/') + 1)
  const root = mkdtempSync(join(tmpdir(), 'w00c-surv-'))
  roots.push(root)
  cpSync(join(SAMPLE_ROOT, name), join(root, name), { recursive: true })
  const folder = join(root, name)
  return {
    root,
    folder,
    edit: (file, f) => {
      const p = join(folder, file)
      const j = JSON.parse(readFileSync(p, 'utf8')) as Obj
      f(j)
      writeFileSync(p, JSON.stringify(j))
    },
    issues: () => {
      try {
        loadClient(client, { root })
      } catch (e) {
        if (e instanceof TestWorldLoadError) return e.issues
        throw e
      }
      return []
    },
  }
}

describe('ARC-8 W00c an account file that is the folder above is refused as leading out', () => {
  it('a link to the parent folder is "leads out", not "not a regular file"', () => {
    const w = copy('C01')
    symlinkSync(w.root, join(w.folder, 'accounts/up.csv'))
    w.edit('answer-key.json', (j) => {
      ;((j['accounts'] as Obj[])[0] as Obj)['file'] = 'accounts/up.csv'
    })
    const key = JSON.parse(readFileSync(join(w.folder, 'answer-key.json'), 'utf8')) as { accounts: { key: string }[] }
    expect(w.issues()).toEqual([{ client: 'C01', check: 'file', record: `${String(key.accounts[0]?.key)} file`, reason: 'accounts/up.csv leads out of the client folder' }])
  })
})

describe('ARC-8 W00c the exact shape of a "(...)" qualifier on an onboarding source', () => {
  const REAL = 'prior_year_closing_balances (1200 Prepaid expenses)'
  const use = (source: string, also?: (j: Obj) => void): LoadIssue[] => {
    const w = copy('C07')
    w.edit('answer-key.json', (j) => {
      for (const e of j['adjustingEntries'] as { source: { onboarding: string[] } }[]) e.source.onboarding = e.source.onboarding.map((s) => (s === REAL ? source : s))
    })
    if (also !== undefined) w.edit('onboarding.json', also)
    return w.issues().filter((i) => i.check === 'adjusting-entry')
  }
  it.each(['prior_year_closing_balances(1200 Prepaid expenses)', 'prior_year_closing_balances   (1200 Prepaid expenses)', `${REAL} `, `${REAL}\t`])('"%s" resolves', (source) => {
    expect(use(source)).toEqual([])
  })
  it.each([
    `first line\n${REAL}`,
    `${REAL} and more`,
    'prior_year_closing_balances (X1200 Prepaid expenses)',
    'prior_year_closing_balances (1200 Prepaid expenses\nmore)',
    'prior_year_closing_balances (1200 Prepaid expenses) (1200 Prepaid expenses)x',
  ])('%j is refused', (source) => {
    expect(use(source).map((i) => i.reason)).toEqual([`its source "${source}" is not in onboarding.json`])
  })
  it('a qualifier on a key whose value is null is refused, not a crash', () => {
    const source = 'nothing_here (1200 Prepaid expenses)'
    expect(use(source, (j) => (j['nothing_here'] = null)).map((i) => i.reason)).toEqual([`its source "${source}" is not in onboarding.json`])
  })
  it('a qualifier on a key whose value is plain text or a number is refused', () => {
    expect(use('t (1200 Prepaid expenses)', (j) => (j['t'] = 'text')).map((i) => i.reason)).toHaveLength(1)
    expect(use('n (1200 Prepaid expenses)', (j) => (j['n'] = 7)).map((i) => i.reason)).toHaveLength(1)
  })
})

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
const empty = { rows: [], totalDebitCents: 0, totalCreditCents: 0 }
function base(months: Month[], closing = 0): Client {
  return {
    id: 'C01',
    corporation: { name: 'X (Test)', businessNumber: '', yearStart: '2025-01-01', yearEnd: '2025-03-31' },
    owners: [],
    accounts: [{ key: 'CHQ', role: 'bank', currency: 'CAD', glAccount: '1000', openingCents: 0, closingCents: closing, exportRows: 0, qboRows: 0, months }],
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
const run = (c: Client, cat: FaultEntry[]): LoadIssue[] => {
  c.flags = cat.flatMap((f) => (f.flagId === undefined ? [] : [{ id: f.flagId, rule: 'r', detail: 'd', severity: null, action: null }]))
  return modelIssues(c, cat)
}
const zeroYear = (): Month[] => [month('2025-01', 0, 0), month('2025-02', 0, 0), month('2025-03', 0, 0)]

describe('ARC-8 W00c the statement roll leaves a duplicate and a priorYear row out', () => {
  it('a clean duplicate pair with its waiver and marker gives no issue at all, roll included', () => {
    const c = base([month('2025-01', 0, 0), month('2025-02', 0, 5), month('2025-03', 5, 5)], 5)
    c.transactions = [tx('O1', '2025-02-06', 5), tx('D1', '2025-02-06', 5, { dupOf: 'O1' })]
    const waiver: FaultEntry = { id: 'W', client: 'C01', planted: 'p', expected: 'e', roll: { account: 'CHQ', month: '2025-02', cause: 'duplicate' } }
    const dup: Marker = { field: 'dupOf', account: 'CHQ', month: '2025-02', rows: 1, totalCents: 5 }
    expect(run(c, [entry('M', dup), waiver])).toEqual([])
  })
  it('a priorYear row dated inside a listed month is not on that month\'s statement', () => {
    const c = base(zeroYear(), 0)
    c.transactions = [tx('P1', '2025-02-10', 5, { priorYear: true })]
    const m: Marker = { field: 'priorYear', account: 'CHQ', month: '2025-02', rows: 1, totalCents: 5 }
    expect(run(c, [entry('P', m)])).toEqual([
      issue('roll', 'CHQ 2025-02', 'the export gives 0.05, not the closing 0.00, and the fault catalogue lists no planted fault for it'),
      issue('fault-catalogue', 'P1', 'it is marked priorYear but dated 2025-02-10, not before the fiscal year starts on 2025-01-01'),
    ])
  })
})

describe('ARC-8 W00c a priorYear row is excused from "in no month" only when it is before the year and its month is marked', () => {
  const lone = (date: string, months: Month[]): LoadIssue[] => {
    const c = base(months, 0)
    c.transactions = [tx('P1', date, 0, { priorYear: true })]
    const m: Marker = { field: 'priorYear', account: 'CHQ', month: date.slice(0, 7), rows: 1, totalCents: 0 }
    return run(c, [entry('P', m)]).filter((i) => i.record === 'P1' && i.check === 'roll')
  }
  it('a row dated after the year ends, in a marked month, is still in no month', () => {
    expect(lone('2025-04-10', zeroYear())).toEqual([issue('roll', 'P1', 'it is dated 2025-04-10, in no month of CHQ')])
  })
  it('a row dated on the first day of the year, in a month the account lacks, is still in no month', () => {
    expect(lone('2025-01-01', [month('2025-02', 0, 0), month('2025-03', 0, 0)])).toEqual([issue('roll', 'P1', 'it is dated 2025-01-01, in no month of CHQ')])
  })
  it('a row dated the day before the year, in a marked month, is excused', () => {
    expect(lone('2024-12-31', zeroYear())).toEqual([])
  })
})

describe('ARC-8 W00c a repeated transaction id never lets a later row stand in for the first original', () => {
  it('a duplicate that matches the first row of a repeated id is not called a mismatch', () => {
    const c = base([month('2025-01', 0, 0), month('2025-02', 0, 5), month('2025-03', 5, 5)], 5)
    c.transactions = [tx('O1', '2025-02-06', 5), tx('O1', '2025-02-07', 99), tx('D1', '2025-02-06', 5, { dupOf: 'O1' })]
    const out = run(c, []).filter((i) => i.reason.includes('does not match its original'))
    expect(out).toEqual([])
  })
})

describe('ARC-8 W00c a calendar date is the whole text, nothing before or after', () => {
  it.each(['x2025-03-05', '2025-03-05x', ' 2025-03-05', '2025-03-05\n', '12025-03-05'])('%j is not a date', (d) => {
    expect(isCalendarDate(d)).toBe(false)
  })
  it('a plain date is one', () => {
    expect(isCalendarDate('2025-03-05')).toBe(true)
  })
})
