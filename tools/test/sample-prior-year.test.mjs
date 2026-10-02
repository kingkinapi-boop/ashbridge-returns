// W14 fix round 3 (findings review W14 round 2, reports/findings-W14-r2.md; amber A307): the prior-year engine for the
// sample clients. Prior-year tax is an output, never typed. The spec job wrote this file; the builder never edits it.
//
// The module under test is reference/sample-clients/lib/prior-year.mjs (built in round 3), two pure functions:
//
//   priorYear(inputs) -> last year's return, derived. Every amount is integer cents.
//     inputs: {
//       fiscalYear: { start, end },              // ISO dates; the year the prior return covers
//       retainedEarningsOpening,                 // retained earnings at the start of that year
//       netIncomeBeforeTax,                      // book income before tax for that year (negative for a loss)
//       dividends,                               // dividends declared in that year
//       instalmentsPaid,                         // tax instalments paid for that year
//       otherAddBacks?,                          // other Schedule 1 add-backs net of deductions; default 0 (none)
//       rates: { federal, ontario },             // small-business rates as data (2024: 0.09 and 0.032)
//       assets: [{ description, class, cost, availableForUse,
//                  book: { method: 'straight-line', years, convention: 'monthly' | 'half-year' },
//                  cca: { firstYear: 'half-year' | 'aii' } }],
//     }
//     returns: {
//       schedule1: { amortization, otherAddBacks, cca },   // the prior year's book amortization, other add-backs, CCA
//       taxableIncome, nonCapitalLoss,                       // taxable = income + amortization + other add-backs - CCA; a negative is the loss
//       federalTax, ontarioTax, incomeTax,                   // rate x taxable income, half away from zero, in cents
//       netIncomeAfterTax,
//       retainedEarnings: { opening, dividends, closing },   // closing = opening + income - tax - dividends (CK-11)
//       instalmentsPaid, balanceOwing,                       // balance owing = tax - instalments paid (negative is a refund)
//       nextYearInstalments,                                 // four whole-cent amounts summing to the tax, or [] when tax is $3,000 or less
//       assets: [{ amortizationByYear: [{ end, amount }], accumulated }],   // same order as inputs.assets
//       ucc: [{ class, rate, years: [{ end, opening, additions, cca, closing }], closing }],  // one per class
//     }
//
//   gifiStatement(rows) -> one row per GIFI code, ascending by code: { gifi, gifiName, debit, credit } in dollars (the answer
//     key's convention), the net on one side, the total kept to the cent. Input rows are account rows of the same shape.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LIB = path.join(ROOT, 'reference', 'sample-clients', 'lib', 'prior-year.mjs')
// Loaded inside each test, so a missing module fails every test by name with the reason.
const loaded = await import(LIB).catch((e) => ({ loadError: e }))
const lib = () => {
  if (loaded.loadError) throw new Error(`reference/sample-clients/lib/prior-year.mjs does not load: ${loaded.loadError.message.split('\n')[0]}`)
  return loaded
}

const SEED = { seed: 20261002, numRuns: 300 }
// The test's own oracle, kept apart from the module: CCA class rates, the first-year factor, exact half-away-from-zero rounding.
const CCA_RATE = { 8: 0.2, 10: 0.3, 50: 0.55 }
const firstYearFactor = (rule, d) => (rule === 'half-year' ? 0.5 : d <= '2018-11-20' ? 0.5 : d < '2024-01-01' ? 1.5 : d <= '2027-12-31' ? 1 : 0.5)
// cents x rate, half away from zero, done in integers (rate to basis points, the base doubled so factor halves stay whole)
const bp = (rate) => Math.round(rate * 10000)
const halfAway = (num, den) => Math.sign(num) * Math.floor((2 * Math.abs(num) + den) / (2 * den))
const rateCents = (cents, rate) => halfAway(cents * bp(rate), 10000)
const sum = (xs) => xs.reduce((a, b) => a + b, 0)
const monthsIncl = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1

// ---------- 11 Humber Bay Software (Test): 2024 as typed inputs (the findings report's worked figures) ----------
const RATES_2024 = { federal: 0.09, ontario: 0.032 }
const INPUTS_11 = {
  fiscalYear: { start: '2024-01-01', end: '2024-12-31' },
  retainedEarningsOpening: 1425000,
  netIncomeBeforeTax: 11842000,
  dividends: 0,
  instalmentsPaid: 1200000,
  rates: RATES_2024,
  assets: [{ description: 'Computer equipment (Test)', class: '50', cost: 450000, availableForUse: '2023-06-01', book: { method: 'straight-line', years: 3, convention: 'monthly' }, cca: { firstYear: 'aii' } }],
}

describe('W14 round 3: 11 Humber Bay Software (Test), 2024 worked example', () => {
  test('END-2 11 schedule 1: amortization 1,500.00 added back, CCA 433.13 deducted, no other add-backs by default (CK-15)', () => {
    const r = lib().priorYear(structuredClone(INPUTS_11))
    expect(r.schedule1).toEqual({ amortization: 150000, otherAddBacks: 0, cca: 43313 })
  })

  test('END-2 11 taxable income 119,486.87 = 118,420.00 + 1,500.00 - 433.13, no loss', () => {
    const r = lib().priorYear(structuredClone(INPUTS_11))
    expect(r.taxableIncome).toBe(11948687)
    expect(r.nonCapitalLoss).toBe(0)
  })

  test('END-2 11 tax: federal 10,753.82 (9%), Ontario 3,823.58 (3.2%), total 14,577.40', () => {
    const r = lib().priorYear(structuredClone(INPUTS_11))
    expect([r.federalTax, r.ontarioTax, r.incomeTax]).toEqual([1075382, 382358, 1457740])
  })

  test('END-2 11 balance owing 2,577.40 after 12,000.00 of instalments; 2025 instalments 3,644.35 x 4', () => {
    const r = lib().priorYear(structuredClone(INPUTS_11))
    expect(r.instalmentsPaid).toBe(1200000)
    expect(r.balanceOwing).toBe(257740)
    expect(r.nextYearInstalments).toEqual([364435, 364435, 364435, 364435])
  })

  test('END-2 11 retained earnings: 14,250.00 + 118,420.00 - 14,577.40 - 0 = 118,092.60; after-tax income 103,842.60 (CK-11)', () => {
    const r = lib().priorYear(structuredClone(INPUTS_11))
    expect(r.netIncomeAfterTax).toBe(10384260)
    expect(r.retainedEarnings).toEqual({ opening: 1425000, dividends: 0, closing: 11809260 })
  })

  test('END-2 11 asset schedule: amortization 875.00 (2023, 7 months) and 1,500.00 (2024), accumulated 2,375.00', () => {
    const r = lib().priorYear(structuredClone(INPUTS_11))
    expect(r.assets).toHaveLength(1)
    expect(r.assets[0].amortizationByYear).toEqual([{ end: '2023-12-31', amount: 87500 }, { end: '2024-12-31', amount: 150000 }])
    expect(r.assets[0].accumulated).toBe(237500)
  })

  test('END-2 11 class 50 UCC: 2023 claims 55% x 1.5 x 4,500.00 = 3,712.50; 2024 claims 55% x 787.50 = 433.13; closing 354.37', () => {
    const r = lib().priorYear(structuredClone(INPUTS_11))
    expect(r.ucc).toEqual([{
      class: '50', rate: 0.55, closing: 35437,
      years: [
        { end: '2023-12-31', opening: 0, additions: 450000, cca: 371250, closing: 78750 },
        { end: '2024-12-31', opening: 78750, additions: 0, cca: 43313, closing: 35437 },
      ],
    }])
  })

  test('END-2 11 the 31 Dec 2024 GIFI balance sheet holds 2680 once: HST 4,380.00 and income tax 2,577.40 make 6,957.40', () => {
    const rows = [
      { gifi: 1002, gifiName: 'Deposits in Canadian banks and institutions - Canadian currency', debit: 125717.11, credit: 0 },
      { gifi: 1774, gifiName: 'Computer equipment/software', debit: 4500, credit: 0 },
      { gifi: 1775, gifiName: 'Accumulated amortization of computer equipment/software', debit: 0, credit: 2375 },
      { gifi: 2707, gifiName: 'Credit card loans', debit: 0, credit: 1121.79 },
      { gifi: 2627, gifiName: 'Employee deductions payable', debit: 0, credit: 698.62 },
      { gifi: 2628, gifiName: 'Withholding taxes payable', debit: 0, credit: 871.7 },
      { gifi: 2680, gifiName: 'Taxes payable', debit: 0, credit: 4380 },
      { gifi: 2680, gifiName: 'Taxes payable', debit: 0, credit: 2577.4 },
      { gifi: 3500, gifiName: 'Common shares', debit: 0, credit: 100 },
      { gifi: 3600, gifiName: 'Retained earnings/deficit', debit: 0, credit: 118092.6 },
    ]
    const out = lib().gifiStatement(structuredClone(rows))
    expect(out.map((r) => r.gifi)).toEqual([1002, 1774, 1775, 2627, 2628, 2680, 2707, 3500, 3600])
    expect(out.find((r) => r.gifi === 2680)).toEqual({ gifi: 2680, gifiName: 'Taxes payable', debit: 0, credit: 6957.4 })
    const c = (x) => Math.round(x * 100)
    expect(sum(out.map((r) => c(r.debit) - c(r.credit)))).toBe(0)
  })
})

// ---------- properties (fast-check, seed pinned) ----------
const isoDay = fc.integer({ min: Date.UTC(2015, 0, 1), max: Date.UTC(2024, 11, 31) }).map((t) => new Date(t - (t % 86400000)).toISOString().slice(0, 10))
const assetArb = fc.record({
  description: fc.constant('Equipment (Test)'),
  class: fc.constantFrom('8', '10', '50'),
  cost: fc.integer({ min: 1, max: 50_000_000 }),
  availableForUse: isoDay,
  book: fc.record({ method: fc.constant('straight-line'), years: fc.integer({ min: 1, max: 10 }), convention: fc.constantFrom('monthly', 'half-year') }),
  cca: fc.record({ firstYear: fc.constantFrom('half-year', 'aii') }),
})
// Income stays well under the $500,000 business limit, so only the small-business rates apply.
const inputsArb = fc.record({
  fiscalYear: fc.constant({ start: '2024-01-01', end: '2024-12-31' }),
  retainedEarningsOpening: fc.integer({ min: -20_000_000, max: 50_000_000 }),
  netIncomeBeforeTax: fc.integer({ min: -20_000_000, max: 40_000_000 }),
  dividends: fc.integer({ min: 0, max: 5_000_000 }),
  instalmentsPaid: fc.integer({ min: 0, max: 6_000_000 }),
  otherAddBacks: fc.integer({ min: -500_000, max: 500_000 }),
  // The rates are data: the 2024 pair and two other made-up pairs, so a hard-coded 9% and 3.2% fails.
  rates: fc.constantFrom(RATES_2024, { federal: 0.1, ontario: 0.035 }, { federal: 0.105, ontario: 0.045 }),
  assets: fc.array(assetArb, { maxLength: 4 }),
})
const run = (inputs) => lib().priorYear(structuredClone(inputs))

describe('W14 round 3: priorYear properties', () => {
  test('END-2 property: every amount is a safe integer number of cents', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp)
      const money = [r.schedule1.amortization, r.schedule1.otherAddBacks, r.schedule1.cca, r.taxableIncome, r.nonCapitalLoss, r.federalTax, r.ontarioTax, r.incomeTax,
        r.netIncomeAfterTax, r.retainedEarnings.opening, r.retainedEarnings.dividends, r.retainedEarnings.closing, r.instalmentsPaid, r.balanceOwing, ...r.nextYearInstalments,
        ...r.assets.flatMap((a) => [a.accumulated, ...a.amortizationByYear.map((y) => y.amount)]),
        ...r.ucc.flatMap((u) => [u.closing, ...u.years.flatMap((y) => [y.opening, y.additions, y.cca, y.closing])])]
      for (const m of money) expect(Number.isSafeInteger(m)).toBe(true)
    }), SEED)
  })

  test('END-2 property: each asset\'s amortization by year sums to its accumulated amortization, never above cost', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp)
      expect(r.assets).toHaveLength(inp.assets.length)
      r.assets.forEach((a, i) => {
        const cost = inp.assets[i].cost, years = a.amortizationByYear
        expect(sum(years.map((y) => y.amount))).toBe(a.accumulated)
        expect(a.accumulated).toBeLessThanOrEqual(cost)
        for (const y of years) expect(y.amount).toBeGreaterThanOrEqual(0)
        // one entry per fiscal year from the year it came into use to the prior year's end, in order
        expect(years[years.length - 1]?.end).toBe(inp.fiscalYear.end)
        expect(years[0]?.end).toBe(`${inp.assets[i].availableForUse.slice(0, 4)}-12-31`)
        years.forEach((y, k) => k && expect(Number(y.end.slice(0, 4))).toBe(Number(years[k - 1].end.slice(0, 4)) + 1))
      })
    }), SEED)
  })

  test('END-2 property: accumulated amortization follows the straight-line method and convention (one cent per year of rounding)', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp)
      r.assets.forEach((a, i) => {
        const { cost, availableForUse, book } = inp.assets[i], n = a.amortizationByYear.length
        const exact = book.convention === 'monthly'
          ? (cost * monthsIncl(availableForUse, inp.fiscalYear.end)) / (book.years * 12)
          : (cost / book.years) * (n - 0.5)
        expect(Math.abs(a.accumulated - Math.min(cost, exact))).toBeLessThanOrEqual(n)
      })
    }), SEED)
  })

  test('END-2 property: CCA each year = class rate x (opening UCC + first-year factor x additions), at most the UCC; UCC never negative and rolls', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp)
      expect(r.ucc.map((u) => u.class).sort()).toEqual([...new Set(inp.assets.map((a) => a.class))].sort())
      for (const u of r.ucc) {
        expect(u.rate).toBe(CCA_RATE[u.class])
        const mine = inp.assets.filter((a) => a.class === u.class)
        expect(sum(u.years.map((y) => y.additions))).toBe(sum(mine.map((a) => a.cost)))
        expect(u.years[u.years.length - 1].end).toBe(inp.fiscalYear.end)
        u.years.forEach((y, k) => {
          expect(y.opening).toBe(k ? u.years[k - 1].closing : 0)
          const adds = mine.filter((a) => a.availableForUse.slice(0, 4) === y.end.slice(0, 4))
          expect(y.additions).toBe(sum(adds.map((a) => a.cost)))
          const base2 = 2 * y.opening + sum(adds.map((a) => 2 * firstYearFactor(a.cca.firstYear, a.availableForUse) * a.cost))
          const want = Math.min(halfAway(base2 * bp(u.rate), 20000), y.opening + y.additions)
          expect(Math.abs(y.cca - want)).toBeLessThanOrEqual(1)
          expect(y.cca).toBeLessThanOrEqual(y.opening + y.additions)
          expect(y.closing).toBe(y.opening + y.additions - y.cca)
          expect(y.closing).toBeGreaterThanOrEqual(0)
        })
        expect(u.closing).toBe(u.years[u.years.length - 1].closing)
      }
    }), SEED)
  })

  test('END-2 property: Schedule 1 takes the prior year\'s amortization and CCA from the schedules (CK-15)', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp), end = inp.fiscalYear.end
      expect(r.schedule1.amortization).toBe(sum(r.assets.map((a) => a.amortizationByYear.find((y) => y.end === end)?.amount ?? 0)))
      expect(r.schedule1.cca).toBe(sum(r.ucc.map((u) => u.years.find((y) => y.end === end)?.cca ?? 0)))
      expect(r.schedule1.otherAddBacks).toBe(inp.otherAddBacks)
    }), SEED)
  })

  test('END-2 property: taxable income = income + amortization + other add-backs - CCA; a negative goes to the non-capital loss (CK-15)', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp), s = r.schedule1
      const x = inp.netIncomeBeforeTax + s.amortization + s.otherAddBacks - s.cca
      expect(r.taxableIncome).toBe(Math.max(0, x))
      expect(r.nonCapitalLoss).toBe(Math.max(0, -x))
    }), SEED)
  })

  test('END-2 property: each tax = its rate x taxable income, half away from zero, in cents; income tax = federal + Ontario', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp)
      expect(r.federalTax).toBe(rateCents(r.taxableIncome, inp.rates.federal))
      expect(r.ontarioTax).toBe(rateCents(r.taxableIncome, inp.rates.ontario))
      expect(r.incomeTax).toBe(r.federalTax + r.ontarioTax)
    }), SEED)
  })

  test('END-2 rounding at the half cent goes away from zero: taxable 0.50 at 9% is 0.05 federal, at 3.2% is 0.02 Ontario', () => {
    const r = run({ ...INPUTS_11, netIncomeBeforeTax: 50, instalmentsPaid: 0, assets: [], rates: { federal: 0.09, ontario: 0.032 } })
    expect(r.taxableIncome).toBe(50)
    expect(r.federalTax).toBe(5)
    expect(r.ontarioTax).toBe(2)
  })

  test('END-2 property: retained earnings close at opening + income - tax - dividends; after-tax income = income - tax (CK-11)', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp)
      expect(r.netIncomeAfterTax).toBe(inp.netIncomeBeforeTax - r.incomeTax)
      expect(r.retainedEarnings).toEqual({ opening: inp.retainedEarningsOpening, dividends: inp.dividends, closing: inp.retainedEarningsOpening + inp.netIncomeBeforeTax - r.incomeTax - inp.dividends })
    }), SEED)
  })

  test('END-2 property: balance owing = tax - instalments paid (negative is a refund)', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp)
      expect(r.instalmentsPaid).toBe(inp.instalmentsPaid)
      expect(r.balanceOwing).toBe(r.incomeTax - inp.instalmentsPaid)
    }), SEED)
  })

  test('END-2 property: next year\'s instalments are four whole-cent amounts summing to the tax, none when the tax is $3,000 or less', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const r = run(inp), q = r.nextYearInstalments
      if (r.incomeTax <= 300000) { expect(q).toEqual([]); return }
      expect(q).toHaveLength(4)
      expect(sum(q)).toBe(r.incomeTax)
      expect(Math.max(...q) - Math.min(...q)).toBeLessThanOrEqual(1)
    }), SEED)
  })

  test('END-2 the $3,000 instalment threshold is exact (300,000 cents of tax: no instalments; 300,001: four)', () => {
    const at = (taxable) => run({ ...INPUTS_11, netIncomeBeforeTax: taxable, assets: [], rates: { federal: 0.1, ontario: 0 } })
    expect(at(3_000_000).incomeTax).toBe(300000)
    expect(at(3_000_000).nextYearInstalments).toEqual([])
    expect(at(3_000_010).incomeTax).toBe(300001)
    expect(sum(at(3_000_010).nextYearInstalments)).toBe(300001)
    expect(at(3_000_010).nextYearInstalments).toHaveLength(4)
  })

  test('END-2 property: priorYear is pure (same inputs, same result; inputs unchanged)', () => {
    fc.assert(fc.property(inputsArb, (inp) => {
      const copy = structuredClone(inp), a = lib().priorYear(copy)
      expect(copy).toEqual(inp)
      expect(lib().priorYear(structuredClone(inp))).toEqual(a)
    }), { ...SEED, numRuns: 100 })
  })
})

const rowArb = fc.record({
  gifi: fc.constantFrom(1002, 1774, 1775, 2627, 2680, 2707, 3500, 3600),
  cents: fc.integer({ min: -100_000_000, max: 100_000_000 }),
}).map(({ gifi, cents }) => ({ gifi, gifiName: `GIFI ${gifi} (Test)`, debit: cents > 0 ? cents / 100 : 0, credit: cents < 0 ? -cents / 100 : 0 }))
const c = (x) => Math.round(x * 100)
const netOf = (r) => c(r.debit) - c(r.credit)

describe('W14 round 3: gifiStatement properties', () => {
  test('END-2 property: one row per GIFI code, ascending, each row\'s net equals its account rows summed by code (to the cent)', () => {
    fc.assert(fc.property(fc.array(rowArb, { maxLength: 20 }), (rows) => {
      const out = lib().gifiStatement(structuredClone(rows))
      const codes = out.map((r) => r.gifi)
      codes.forEach((g, k) => k && expect(g).toBeGreaterThan(codes[k - 1]))
      const want = new Map()
      for (const r of rows) want.set(r.gifi, (want.get(r.gifi) ?? 0) + netOf(r))
      for (const [g, n] of want) if (n !== 0) expect(netOf(out.find((r) => r.gifi === g) ?? { debit: 0, credit: 0 })).toBe(n)
      for (const r of out) {
        expect(want.has(r.gifi)).toBe(true)
        expect(netOf(r)).toBe(want.get(r.gifi))
        expect(r.gifiName).toBe(`GIFI ${r.gifi} (Test)`)
      }
    }), SEED)
  })

  test('END-2 property: each row carries its net on one side only, and the statement total is kept to the cent', () => {
    fc.assert(fc.property(fc.array(rowArb, { maxLength: 20 }), (rows) => {
      const out = lib().gifiStatement(structuredClone(rows))
      for (const r of out) {
        expect(r.debit).toBeGreaterThanOrEqual(0)
        expect(r.credit).toBeGreaterThanOrEqual(0)
        expect(r.debit === 0 || r.credit === 0).toBe(true)
        expect(Math.abs(r.debit * 100 - c(r.debit))).toBeLessThan(1e-6)
        expect(Math.abs(r.credit * 100 - c(r.credit))).toBeLessThan(1e-6)
      }
      expect(sum(out.map(netOf))).toBe(sum(rows.map(netOf)))
    }), SEED)
  })
})

// ---------- where the engine is used, and where it must not be ----------
describe('W14 round 3: the engine is the only source of prior-year figures', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

  test('END-2 c11_12.mjs derives prior_year through priorYear and gifiStatement and types no tax figure', () => {
    const src = read('reference/sample-clients/clients/c11_12.mjs')
    expect(src).toMatch(/import\s*\{[^}]*\bpriorYear\b[^}]*\}\s*from\s*['"]\.\.\/lib\/prior-year\.mjs['"]/)
    expect(src).toMatch(/import\s*\{[^}]*\bgifiStatement\b[^}]*\}\s*from\s*['"]\.\.\/lib\/prior-year\.mjs['"]/)
    expect(src).not.toMatch(/\b(federalTax|ontarioTax|taxable_?[iI]ncome|incomeTax)\s*:\s*-?[0-9]/)
  })

  test('END-2 verify.mjs never imports prior-year.mjs (it recomputes on its own)', () => {
    expect(read('reference/sample-clients/verify.mjs')).not.toMatch(/prior-year(\.mjs)?['"]/)
  })
})
