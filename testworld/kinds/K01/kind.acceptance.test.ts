// W01 acceptance: test world kind K01, "Returning client, clean books, full evidence" (ARC-8, END-2).
// The kind is built on sample client 11 (Humber Bay Software Ltd. (Test), W14) through the W00 model.
// Public surface the build must provide:
//   testworld/kinds/K01/kind.ts   exports `k01: KindWorld`   (shape below)
//   testworld/kinds/K01/faults.ts exports `K01_FAULTS: FaultEntry[]`, registered so `faults()` returns them.
import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { ClientSchema, faults, guardIssues, listKinds, loadClient, loadKind, modelIssues, type Client } from '../../index'
import { k01 } from './kind'
import { K01_FAULTS } from './faults'

type Dot = 'green' | 'grey' | 'amber' | 'purple'
type SourceKind = 'third party' | 'client filed' | 'client prepared' | 'client said' | 'judgment'
type Figure = { key: string; gifi: number | null; schedule: string | null; cents: number; dot: Dot; sources: string[] }
type Fact = { key: string; value: string; sourceKind: SourceKind; origin: string }
type ExpectedFlag = { id: string; clause: string; severity: 'info' | 'must fire'; expected: string }
type Doc = { family: string; file: string; count: number }
type KindWorld = {
  id: 'K01'
  startsFrom: 'C11'
  client: Client
  corporation: { name: string; businessNumber: string; yearStart: string; yearEnd: string }
  shareholders: { name: string; percentCommon: number }[]
  onboarding: Record<string, unknown>
  /** The .GFI mapping: each QBO account to one GIFI code (TB-3), and the file's lines (code, positive cents, ascending, no zero lines). */
  gfiMapping: { account: string; gifi: number }[]
  gfiLines: { gifi: number; cents: number }[]
  priorYear: { yearEnd: string; retainedEarningsClosingCents: number; taxCents: number; filedByUs: boolean }
  documents: Doc[]
  expected: { figures: Figure[]; facts: Fact[]; flags: ExpectedFlag[] }
}
const world = k01 as unknown as KindWorld
const C11_FLAGS = ['11-F01', '11-F02', '11-F03', '11-F04', '11-F05']

const tbSum = (rows: Client['trialBalance']['adjusted']['rows'], side: 'debitCents' | 'creditCents'): number => rows.reduce((s, r) => s + r[side], 0)

describe('W01 K01 loads through the W00 model (check 1)', () => {
  test('ARC-8 K01 is registered as built, starts from the new sample client 11, and loadKind finds its folder', () => {
    const entry = listKinds().find((k) => k.id === 'K01')
    expect(entry?.status).toBe('built')
    expect(loadKind('K01').id).toBe('K01')
    expect(world.id).toBe('K01')
    expect(world.startsFrom).toBe('C11')
  })

  test('ARC-8 the books are exactly sample client 11, read through the model, with no validation errors', () => {
    expect(world.client).toEqual(loadClient('C11'))
    expect(ClientSchema.safeParse(world.client).success).toBe(true)
    expect(modelIssues(world.client, faults())).toEqual([])
  })

  test('ARC-8 corporation, shareholders and the onboarding answers agree with the sample client', () => {
    expect(world.corporation.name).toBe('Humber Bay Software Ltd. (Test)')
    expect(world.corporation).toEqual(world.client.corporation)
    expect(world.corporation.yearEnd).toBe('2025-12-31')
    expect(world.shareholders).toEqual([{ name: 'Elliot Barrow (Test)', percentCommon: 100 }])
    const corp = world.onboarding['corporation'] as Record<string, unknown>
    expect(corp['legal_name']).toBe(world.corporation.name)
    expect(corp['financial_year_end']).toBe('2025-12-31')
  })

  test('ARC-16 the kind is deterministic: its expected results and faults do not change between reads', () => {
    expect(JSON.parse(JSON.stringify(world.expected)) as unknown).toEqual(world.expected)
    expect(loadKind('K01')).toEqual(loadKind('K01'))
    expect(loadClient('C11')).toEqual(loadClient('C11'))
  })
})

describe('W01 K01 books balance and retained earnings roll (check 2)', () => {
  test('ARC-13 opening, unadjusted and adjusted trial balances: debits equal credits in cents, and the totals equal the row sums', () => {
    for (const name of ['opening', 'unadjusted', 'adjusted'] as const) {
      const tb = world.client.trialBalance[name]
      expect(tbSum(tb.rows, 'debitCents')).toBe(tb.totalDebitCents)
      expect(tbSum(tb.rows, 'creditCents')).toBe(tb.totalCreditCents)
      expect(tb.totalDebitCents).toBe(tb.totalCreditCents)
      expect(tb.totalDebitCents).toBeGreaterThan(0)
    }
  })

  test('ARC-13 every adjusting entry has a reason and a source, and nets to zero in cents', () => {
    expect(world.client.adjustingEntries.length).toBeGreaterThan(0)
    for (const e of world.client.adjustingEntries) {
      expect(e.reason.length).toBeGreaterThan(0)
      expect(e.sources.length).toBeGreaterThan(0)
      expect(tbSum(e.lines, 'debitCents')).toBe(tbSum(e.lines, 'creditCents'))
    }
  })

  test('ARC-13 property: any selection of adjusting entries nets to zero, in any order', () => {
    fc.assert(
      fc.property(fc.subarray(world.client.adjustingEntries), (picked) => {
        const lines = picked.flatMap((e) => e.lines)
        expect(tbSum(lines, 'debitCents') - tbSum(lines, 'creditCents')).toBe(0)
        const reversed = [...lines].reverse()
        expect(tbSum(reversed, 'debitCents')).toBe(tbSum(lines, 'debitCents'))
      }),
      { seed: 20261002, numRuns: 100 },
    )
  })

  test('ARC-13 retained earnings roll: opening equals last year closing, and the year income before tax is the profit and loss rows of the adjusted balance', () => {
    const re = world.client.trialBalance.opening.rows.find((r) => r.gifi === 3600)
    expect(re?.creditCents).toBe(world.priorYear.retainedEarningsClosingCents)
    expect(world.priorYear.retainedEarningsClosingCents).toBe(11809260)
    const income = world.client.trialBalance.adjusted.rows.filter((r) => (r.gifi ?? 0) >= 8000).reduce((s, r) => s + r.creditCents - r.debitCents, 0)
    expect(income).toBe(6175478)
    const fig = world.expected.figures.find((f) => f.key === 'netIncomeLossPerBooksBeforeTax')
    expect(fig?.cents).toBe(income)
  })

  test('TB-3 the .GFI mapping covers every trial balance account once, with the code the row carries, and each file line is the sum of its accounts', () => {
    const rows = world.client.trialBalance.adjusted.rows
    const accounts = world.gfiMapping.map((m) => m.account)
    expect(new Set(accounts).size).toBe(accounts.length)
    for (const r of rows) {
      const m = world.gfiMapping.find((x) => x.account === r.account)
      expect(m, `account ${r.account} is mapped`).toBeDefined()
      expect(m?.gifi).toBe(r.gifi)
    }
    const codes = world.gfiLines.map((l) => l.gifi)
    expect(codes).toEqual([...codes].sort((a, b) => a - b))
    for (const l of world.gfiLines) {
      const sum = rows.filter((r) => r.gifi === l.gifi).reduce((s, r) => s + r.debitCents - r.creditCents, 0)
      expect(l.cents).toBe(Math.abs(sum))
      expect(l.cents).toBeGreaterThan(0)
    }
  })
})

describe('W01 K01 expected results and planted faults (check 3)', () => {
  test('END-2 every expected figure and fact names its source kind and origin, and every figure has a dot and at least one source', () => {
    expect(world.expected.figures.length).toBeGreaterThan(0)
    expect(world.expected.facts.length).toBeGreaterThan(0)
    for (const f of world.expected.figures) {
      expect(Number.isSafeInteger(f.cents), f.key).toBe(true)
      expect(['green', 'grey', 'amber', 'purple']).toContain(f.dot)
      expect(f.sources.length, f.key).toBeGreaterThan(0)
    }
    for (const f of world.expected.facts) {
      expect(['third party', 'client filed', 'client prepared', 'client said', 'judgment']).toContain(f.sourceKind)
      expect(f.origin.length, f.key).toBeGreaterThan(0)
    }
  })

  test('END-2 the control client has a full file: no figure rests on judgment or only on the client, every dot is green or grey', () => {
    for (const f of world.expected.figures) expect(['green', 'grey'], f.key).toContain(f.dot)
  })

  test('ARC-8 the expected flags are the five of sample client 11, all information only, each with the clause that raises it', () => {
    expect(world.expected.flags.map((f) => f.id)).toEqual(C11_FLAGS)
    expect(world.client.flags.map((f) => f.id)).toEqual(C11_FLAGS)
    for (const f of world.expected.flags) {
      expect(f.severity).toBe('info')
      expect(f.clause).toMatch(/^[A-Z]+-\d+$/)
      expect(f.expected.length).toBeGreaterThan(0)
    }
  })

  test('ARC-8 faults.ts lists one fault per expected flag, each with a non-empty expected result, and the catalogue returns them for K01', () => {
    expect(K01_FAULTS.map((f) => f.flagId)).toEqual(C11_FLAGS)
    for (const f of K01_FAULTS) {
      expect(f.kind).toBe('K01')
      expect(f.planted.length).toBeGreaterThan(0)
      expect(f.expected.length).toBeGreaterThan(0)
      expect(f.clause).toBeDefined()
    }
    expect(faults().filter((f) => f.kind === 'K01')).toEqual(K01_FAULTS)
  })

  test('ARC-8 and END-2 each clause on the card is named by at least one fault or expected result', () => {
    const named = new Set([...K01_FAULTS.map((f) => f.clause), ...world.expected.flags.map((f) => f.clause)])
    expect(named.has('ARC-8')).toBe(true)
    expect(named.has('END-2')).toBe(true)
  })

  test('END-2 the control client plants no roll waiver, and every month of every account rolls', () => {
    expect(K01_FAULTS.every((f) => f.roll === undefined)).toBe(true)
    expect(world.client.accounts.every((a) => a.months.every((m) => m.rolls))).toBe(true)
  })

  test('END-2 last year is ours: the prior-year block says filed by us, year end 2024-12-31, tax $14,577.40', () => {
    expect(world.priorYear.filedByUs).toBe(true)
    expect(world.priorYear.yearEnd).toBe('2024-12-31')
    expect(world.priorYear.taxCents).toBe(1457740)
  })

  test('ARC-8 the kind lists the documents it has by family, so renderers produce them', () => {
    const families = world.documents.map((d) => d.family)
    for (const f of ['bank statement', 'card statement', 'payroll', 'HST return', 'prior year return']) expect(families).toContain(f)
    for (const d of world.documents) expect(d.count).toBeGreaterThan(0)
  })
})

describe('W01 K01 holds only made-up data (check 4)', () => {
  test('ARC-8 no real person, business or number: every name ends in (Test) and the guard finds nothing', () => {
    const names = [world.corporation.name, ...world.shareholders.map((s) => s.name)]
    for (const n of names) expect(n.endsWith('(Test)'), n).toBe(true)
    const text = JSON.stringify({ corporation: world.onboarding['corporation'], owners: world.onboarding['owners'], facts: world.expected.facts })
    expect(guardIssues('C11', [{ file: 'kind.json', kind: 'json', text }], names)).toEqual([])
  })

  test('ARC-8 a corporation name without (Test) is refused by the guard with the reason', () => {
    const bad = JSON.stringify({ corporation: { legal_name: 'Humber Bay Software Ltd.' } })
    const issues = guardIssues('C11', [{ file: 'kind.json', kind: 'json', text: bad }], [])
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]?.reason).toContain('(Test)')
  })
})
