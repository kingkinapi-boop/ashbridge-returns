// W05 acceptance: test world kind K05, "Onboarding answers only" (ARC-8, END-6, EV-11).
// The kind is built on sample client 12 (Kensington Market Crafts Inc. (Test), W14) through the W00 model.
// Public surface the build must provide:
//   testworld/kinds/K05/kind.ts   exports `k05: KindWorld`   (shape below)
//   testworld/kinds/K05/faults.ts exports `K05_FAULTS: FaultEntry[]`, registered so `faults()` returns them.
import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { ClientSchema, faults, guardIssues, listKinds, loadClient, loadKind, modelIssues, type Client } from '../../index'
import { k05 } from './kind'
import { K05_FAULTS } from './faults'

type Dot = 'green' | 'grey' | 'amber' | 'purple'
type SourceKind = 'third party' | 'client filed' | 'client prepared' | 'client said' | 'judgment'
type Figure = { key: string; gifi: number | null; schedule: string | null; cents: number; dot: Dot; sources: string[] }
type Fact = { key: string; value: string; sourceKind: SourceKind; origin: string }
type ExpectedFlag = { id: string; clause: string; severity: 'info' | 'must fire'; expected: string }
type Doc = { family: string; file: string; count: number }
type KindWorld = {
  id: 'K05'
  startsFrom: 'C12'
  client: Client
  corporation: { name: string; businessNumber: string; yearStart: string; yearEnd: string }
  shareholders: { name: string; percentCommon: number }[]
  /** The answers exactly as the client app stores them: money as text with commas and two decimals. */
  onboarding: Record<string, unknown>
  /** The books as the QBO stand-in serves them: for this kind, the one summarised entry built from the answers (no account files, no QBO file). */
  gfiMapping: { account: string; gifi: number }[]
  gfiLines: { gifi: number; cents: number }[]
  priorYear: { yearEnd: string; retainedEarningsClosingCents: number; filedByUs: boolean }
  /** Always empty for K05: no account files, no QBO files, no documents. */
  documents: Doc[]
  expected: { figures: Figure[]; facts: Fact[]; flags: ExpectedFlag[] }
}
const world = k05 as unknown as KindWorld
const C12_FLAGS = ['12-F01', '12-F02', '12-F03', '12-F04', '12-F05']

const tbSum = (rows: Client['trialBalance']['adjusted']['rows'], side: 'debitCents' | 'creditCents'): number => rows.reduce((s, r) => s + r[side], 0)

describe('W05 K05 loads through the W00 model (check 1)', () => {
  test('ARC-8 K05 is registered as built, starts from the new sample client 12, and loadKind finds its folder', () => {
    const entry = listKinds().find((k) => k.id === 'K05')
    expect(entry?.status).toBe('built')
    expect(loadKind('K05').id).toBe('K05')
    expect(world.id).toBe('K05')
    expect(world.startsFrom).toBe('C12')
  })

  test('ARC-8 the books are exactly sample client 12, read through the model, with no validation errors', () => {
    expect(world.client).toEqual(loadClient('C12'))
    expect(ClientSchema.safeParse(world.client).success).toBe(true)
    expect(modelIssues(world.client, faults())).toEqual([])
  })

  test('ARC-8 corporation, shareholder and the onboarding answers agree with the sample client', () => {
    expect(world.corporation.name).toBe('Kensington Market Crafts Inc. (Test)')
    expect(world.corporation).toEqual(world.client.corporation)
    expect(world.corporation.yearEnd).toBe('2025-12-31')
    expect(world.shareholders).toEqual([{ name: 'Tamsin Reyes (Test)', percentCommon: 100 }])
    const corp = world.onboarding['corporation'] as Record<string, unknown>
    expect(corp['legal_name']).toBe(world.corporation.name)
    expect(corp['financial_year_end']).toBe('2025-12-31')
  })

  test('END-6 the answers are kept as the client app stores them: money as text with commas and two decimals', () => {
    const answers = world.onboarding['answers'] as { question_asked: string; answer_verbatim: string }[]
    const byQuestion = new Map(answers.map((a) => [a.question_asked, a.answer_verbatim]))
    expect(byQuestion.get('BQ2.earn')).toBe('28,640.00')
    expect(byQuestion.get('FL:107')).toBe('11,480.00')
    expect(byQuestion.get('FL:96')).toBe('6,215.80')
    expect(byQuestion.get('YE1.pcost')).toBe('16,800.00')
    expect(byQuestion.get('YE1.vbkm')).toBe('4,100')
    for (const a of answers) expect(typeof a.answer_verbatim).toBe('string')
  })

  test('ARC-16 the kind is deterministic: its expected results and faults do not change between reads', () => {
    expect(JSON.parse(JSON.stringify(world.expected)) as unknown).toEqual(world.expected)
    expect(loadKind('K05')).toEqual(loadKind('K05'))
    expect(loadClient('C12')).toEqual(loadClient('C12'))
  })
})

describe('W05 K05 books balance and retained earnings roll (check 2)', () => {
  test('ARC-8 opening, unadjusted and adjusted trial balances: debits equal credits in cents, and the totals equal the row sums', () => {
    for (const name of ['opening', 'unadjusted', 'adjusted'] as const) {
      const tb = world.client.trialBalance[name]
      expect(tbSum(tb.rows, 'debitCents')).toBe(tb.totalDebitCents)
      expect(tbSum(tb.rows, 'creditCents')).toBe(tb.totalCreditCents)
      expect(tb.totalDebitCents).toBe(tb.totalCreditCents)
      expect(tb.totalDebitCents).toBeGreaterThan(0)
    }
    expect(world.client.trialBalance.adjusted.totalDebitCents).toBe(3124000)
  })

  test('ARC-8 the one adjusting entry is the answers entry: a reason, a source, debits and credits both 28,640.00 in cents', () => {
    expect(world.client.adjustingEntries).toHaveLength(1)
    const e = world.client.adjustingEntries[0]!
    expect(e.reason.length).toBeGreaterThan(0)
    expect(e.sources.length).toBeGreaterThan(0)
    expect(tbSum(e.lines, 'debitCents')).toBe(2864000)
    expect(tbSum(e.lines, 'creditCents')).toBe(2864000)
  })

  test('ARC-8 property: any selection of adjusting entry lines nets to zero when the whole entry is taken, in any order', () => {
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

  test('ARC-8 retained earnings roll: the balancing figure at 31 Dec 2024 is zero, and the year income before tax is the profit and loss rows of the adjusted balance, $3,615.80', () => {
    expect(world.client.trialBalance.opening.rows.find((r) => r.gifi === 3600)).toBeUndefined()
    expect(world.priorYear.retainedEarningsClosingCents).toBe(0)
    const income = world.client.trialBalance.adjusted.rows.filter((r) => (r.gifi ?? 0) >= 8000).reduce((s, r) => s + r.creditCents - r.debitCents, 0)
    expect(income).toBe(361580)
    const fig = world.expected.figures.find((f) => f.key === 'netIncomeLossPerBooksBeforeTax')
    expect(fig?.cents).toBe(income)
  })

  test('TB-3 the mapping covers every trial balance account once, with the code the row carries, and each file line is the sum of its accounts', () => {
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

describe('W05 K05 expected results and planted faults (check 3)', () => {
  test('END-6 every expected figure and fact names its source kind and origin, and every figure has a dot and at least one source', () => {
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

  test('EV-11 every figure rests only on the client, so every dot is amber, and no fact has a third-party source', () => {
    for (const f of world.expected.figures) expect(f.dot, f.key).toBe('amber')
    for (const f of world.expected.facts) expect(f.sourceKind, f.key).not.toBe('third party')
  })

  test('EV-11 the sales figure is 28,640.00, amber, and cites the answer BQ2.earn', () => {
    const sales = world.expected.figures.find((f) => f.gifi === 8000)
    expect(sales?.cents).toBe(2864000)
    expect(sales?.dot).toBe('amber')
    expect(sales?.sources).toContain('BQ2.earn')
  })

  test('END-6 nothing blocks: the five expected flags are the five of sample client 12, all "must fire" for a person to decide, none a blocker', () => {
    expect(world.expected.flags.map((f) => f.id)).toEqual(C12_FLAGS)
    expect(world.client.flags.map((f) => f.id)).toEqual(C12_FLAGS)
    for (const f of world.expected.flags) {
      expect(f.severity).toBe('must fire')
      expect(f.clause).toMatch(/^[A-Z]+-\d+$/)
      expect(f.expected.length).toBeGreaterThan(0)
      expect(f.expected).not.toMatch(/block/i)
    }
  })

  test('ARC-8 faults.ts lists one fault per expected flag, each with a non-empty expected result, and the catalogue returns them for K05', () => {
    expect(K05_FAULTS.map((f) => f.flagId)).toEqual(C12_FLAGS)
    for (const f of K05_FAULTS) {
      expect(f.kind).toBe('K05')
      expect(f.planted.length).toBeGreaterThan(0)
      expect(f.expected.length).toBeGreaterThan(0)
      expect(f.clause).toBeDefined()
    }
    expect(faults().filter((f) => f.kind === 'K05')).toEqual(K05_FAULTS)
  })

  test('ARC-8 fault ids are unique across the whole catalogue (the kind entries do not reuse the sample client ids)', () => {
    const ids = faults().map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of K05_FAULTS) expect(f.client).toBeUndefined()
  })

  test('ARC-8, END-6 and EV-11 each clause on the card is named by at least one fault or expected result', () => {
    const named = new Set([...K05_FAULTS.map((f) => f.clause), ...world.expected.flags.map((f) => f.clause)])
    for (const c of ['ARC-8', 'END-6', 'EV-11']) expect(named.has(c), c).toBe(true)
  })

  test('END-6 the first flag is the missing evidence for revenue and the second the bank balance with no statement', () => {
    expect(K05_FAULTS[0]?.planted).toMatch(/revenue/i)
    expect(K05_FAULTS[1]?.planted).toMatch(/bank/i)
  })

  test('END-6 no account files and no documents: there are no accounts or transactions, and the kind lists no document families', () => {
    expect(world.client.accounts).toEqual([])
    expect(world.client.transactions).toEqual([])
    expect(world.documents).toEqual([])
  })

  test('END-6 last year was filed by another firm: the prior-year block says not filed by us, year end 2024-12-31, and the expected facts say the 2024 balances are the client answers', () => {
    expect(world.priorYear.filedByUs).toBe(false)
    expect(world.priorYear.yearEnd).toBe('2024-12-31')
    const opening = world.expected.facts.filter((f) => /2024|opening|prior/i.test(f.key))
    expect(opening.length).toBeGreaterThan(0)
    for (const f of opening) expect(f.sourceKind).toBe('client said')
  })

  test('END-6 the home office and vehicle answers are kept as facts: 10 percent of $16,800.00, and 4,100 of 12,400 kilometres', () => {
    const values = world.expected.facts.map((f) => f.value).join('|')
    for (const v of ['16,800.00', '10', '12,400', '4,100']) expect(values).toContain(v)
  })
})

describe('W05 K05 holds only made-up data (check 4)', () => {
  test('ARC-8 no real person, business or number: every name ends in (Test) and the guard finds nothing', () => {
    const names = [world.corporation.name, ...world.shareholders.map((s) => s.name)]
    for (const n of names) expect(n.endsWith('(Test)'), n).toBe(true)
    const text = JSON.stringify({ corporation: world.onboarding['corporation'], owners: world.onboarding['owners'], facts: world.expected.facts })
    expect(guardIssues('C12', [{ file: 'kind.json', kind: 'json', text }], names)).toEqual([])
  })

  test('ARC-8 a corporation name without (Test) is refused by the guard with the reason', () => {
    const bad = JSON.stringify({ corporation: { legal_name: 'Kensington Market Crafts Inc.' } })
    const issues = guardIssues('C12', [{ file: 'kind.json', kind: 'json', text: bad }], [])
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]?.reason).toContain('(Test)')
  })
})
