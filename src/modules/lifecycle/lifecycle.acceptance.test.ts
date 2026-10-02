// F02 acceptance tests, unit part: the move table, due dates and the hold constant (spec-writer;
// builders never edit this file). The database part is lifecycle.acceptance.db.test.ts.
//
// The public surface these tests fix (src/modules/lifecycle/index.ts):
// - MOVES: readonly { from: ReturnState; to: ReturnState; guard: string }[]: exactly the moves of
//   blueprint 02's table, each with its own named guard (FLOW-2).
// - HOLD_IDLE_MS: a hold expires after this much idle time; 4 hours (FLOW-10, amber A11).
// - dueDates(yearEnd: 'YYYY-MM-DD', { ccpcConditionsMet: boolean }): { filing, balance } as
//   'YYYY-MM-DD' text (FLOW-7, FLOW-12); an invalid date is refused with a throw.
//
// Source for the dates: CRA T4012 (T2 Corporation Income Tax Guide), chapter 1, "Filing deadline":
// a return is due six months after the end of the tax year; when the tax year ends on the last
// day of a month, it is due by the last day of the sixth month after (a 28 Feb year end is due
// 31 Aug). T4012 "Balance-due day" (and CRA's page "Balance-due day", reference/sources.md): two
// months after the end of the tax year, three for a CCPC that meets CRA's conditions.
// Amber (reports/F02-spec.md): neither the card nor the CRA text gives a month-end rule for the
// balance-due day, so these tests count months as the federal Interpretation Act, s. 28 does (the
// same day number, or the last day of the month when that day does not exist): a 30 Jun year end
// owes its balance by 30 Aug. That is never later than a month-end reading, so it cannot make a
// payment late. Reverse: change the four rows marked "s. 28" and balanceOracle below.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { RETURN_STATES } from '../../contracts/records'
import { isBlank } from '../../contracts/text'
import { BLUEPRINT_MOVES } from './__fixtures__/blueprint-moves'
import { HOLD_IDLE_MS, MOVES, dueDates } from './index'

const key = (from: string, to: string): string => `${from}->${to}`

describe('F02 the move table (FLOW-2)', () => {
  test('FLOW-2 MOVES holds exactly the moves of blueprint 02, no more and no fewer', () => {
    const got = MOVES.map((m) => key(m.from, m.to)).sort()
    const want = BLUEPRINT_MOVES.map(([f, t]) => key(f, t)).sort()
    expect(got).toEqual(want)
  })

  test('FLOW-2 each move has its own named guard (non-blank, no two moves share one)', () => {
    const names = MOVES.map((m) => m.guard)
    for (const n of names) expect(isBlank(n), `a blank guard name ${JSON.stringify(n)}`).toBe(false)
    expect(new Set(names).size).toBe(MOVES.length)
  })

  test('FLOW-2 no move leaves closed, and approved never goes back to trace through the table (only FLOW-5 does)', () => {
    expect(MOVES.filter((m) => m.from === 'closed')).toEqual([])
    expect(MOVES.some((m) => m.from === 'approved' && m.to === 'trace')).toBe(false)
  })

  test('FLOW-3 no state is named waiting: "waiting on the client" is a flag, not a state', () => {
    for (const s of RETURN_STATES) expect(s).not.toMatch(/wait/i)
    for (const m of MOVES) {
      expect(m.from).not.toMatch(/wait/i)
      expect(m.to).not.toMatch(/wait/i)
    }
  })
})

describe('F02 holds (FLOW-10)', () => {
  test('FLOW-10 a hold expires after 4 hours idle (a named constant, amber A11)', () => {
    expect(HOLD_IDLE_MS).toBe(4 * 60 * 60 * 1000)
  })
})

// ---- due dates -------------------------------------------------------------------------------

interface DueCase {
  name: string
  yearEnd: string
  ccpc: boolean
  filing: string
  balance: string
}

/** CRA T4012 examples worked by hand. */
const CASES: readonly DueCase[] = [
  { name: '31 Dec year end', yearEnd: '2025-12-31', ccpc: false, filing: '2026-06-30', balance: '2026-02-28' },
  { name: '31 Dec year end, CCPC that meets the conditions (three months)', yearEnd: '2025-12-31', ccpc: true, filing: '2026-06-30', balance: '2026-03-31' },
  { name: '31 Dec year end before a leap year (balance on 29 Feb)', yearEnd: '2027-12-31', ccpc: false, filing: '2028-06-30', balance: '2028-02-29' },
  // s. 28 (balance-due day): 30 Aug, not 31 Aug
  { name: '30 Jun year end', yearEnd: '2026-06-30', ccpc: false, filing: '2026-12-31', balance: '2026-08-30' },
  { name: '30 Jun year end, CCPC (three months)', yearEnd: '2026-06-30', ccpc: true, filing: '2026-12-31', balance: '2026-09-30' },
  // s. 28 (balance-due day)
  { name: '28 Feb year end in a non-leap year (a month end: filing 31 Aug)', yearEnd: '2026-02-28', ccpc: false, filing: '2026-08-31', balance: '2026-04-28' },
  // s. 28 (balance-due day)
  { name: '28 Feb year end in a non-leap year, CCPC (three months)', yearEnd: '2026-02-28', ccpc: true, filing: '2026-08-31', balance: '2026-05-28' },
  // s. 28 (balance-due day)
  { name: '29 Feb year end in a leap year (a month end: filing 31 Aug)', yearEnd: '2028-02-29', ccpc: false, filing: '2028-08-31', balance: '2028-04-29' },
  { name: '28 Feb year end in a leap year is not a month end (filing 28 Aug)', yearEnd: '2028-02-28', ccpc: false, filing: '2028-08-28', balance: '2028-04-28' },
  { name: 'short first year (incorporated 3 Mar 2025, first year end 15 Oct 2025): only the year end counts', yearEnd: '2025-10-15', ccpc: false, filing: '2026-04-15', balance: '2025-12-15' },
  { name: 'short first year, CCPC (three months, into the next calendar year)', yearEnd: '2025-10-15', ccpc: true, filing: '2026-04-15', balance: '2026-01-15' },
  { name: '31 Aug year end: filing on the last day of February (non-leap)', yearEnd: '2026-08-31', ccpc: false, filing: '2027-02-28', balance: '2026-10-31' },
  { name: '31 Aug year end: filing on 29 Feb in a leap year', yearEnd: '2027-08-31', ccpc: false, filing: '2028-02-29', balance: '2027-10-31' },
  { name: '31 Aug year end, CCPC: 30 Nov (November has no 31st)', yearEnd: '2026-08-31', ccpc: true, filing: '2027-02-28', balance: '2026-11-30' },
  { name: '15 Mar year end (mid-month: same day)', yearEnd: '2026-03-15', ccpc: false, filing: '2026-09-15', balance: '2026-05-15' },
]

describe('F02 due dates (FLOW-7, FLOW-12; CRA T4012)', () => {
  for (const c of CASES) {
    test(`FLOW-12 FLOW-7 ${c.name}: filing ${c.filing}, balance ${c.balance} (CRA T4012)`, () => {
      expect(dueDates(c.yearEnd, { ccpcConditionsMet: c.ccpc })).toEqual({ filing: c.filing, balance: c.balance })
    })
  }

  test('FLOW-7 the CCPC flag moves only the balance-due date, never the filing date (CRA T4012)', () => {
    const plain = dueDates('2025-12-31', { ccpcConditionsMet: false })
    const ccpc = dueDates('2025-12-31', { ccpcConditionsMet: true })
    expect(ccpc.filing).toBe(plain.filing)
    expect(ccpc.balance).not.toBe(plain.balance)
  })

  test('FLOW-12 an invalid year end is refused, never guessed', () => {
    for (const bad of ['2026-02-30', '2025-02-29', '31/12/2025', '2025-13-01', '', '2025-12-31T00:00:00Z']) {
      expect(() => dueDates(bad, { ccpcConditionsMet: false }), bad).toThrow()
    }
  })
})

// Independent oracle for the properties: plain UTC calendar arithmetic, written here.
const lastDay = (y: number, m0: number): number => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()
const iso = (y: number, m0: number, d: number): string =>
  `${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
function parts(s: string): { y: number; m0: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y: y ?? NaN, m0: (m ?? NaN) - 1, d: d ?? NaN }
}
function addMonths(y: number, m0: number, k: number): { y: number; m0: number } {
  const t = y * 12 + m0 + k
  return { y: Math.floor(t / 12), m0: t % 12 }
}
/** Interpretation Act s. 28 counting (see the amber at the top). */
function balanceOracle(yearEnd: string, months: number): string {
  const { y, m0, d } = parts(yearEnd)
  const t = addMonths(y, m0, months)
  return iso(t.y, t.m0, Math.min(d, lastDay(t.y, t.m0)))
}

/** Any day from 2000-01-01 to 2099-12-31, as 'YYYY-MM-DD'. */
const anyYearEnd = fc
  .integer({ min: Date.UTC(2000, 0, 1) / 86_400_000, max: Date.UTC(2099, 11, 31) / 86_400_000 })
  .map((day) => new Date(day * 86_400_000).toISOString().slice(0, 10))

describe('F02 due-date properties (FLOW-7, FLOW-12)', () => {
  test('FLOW-12 property (seed 20261002): filing falls in the sixth month after; a month-end year end files on that month\'s last day, any other on the same day number when it exists', () => {
    fc.assert(
      fc.property(anyYearEnd, (ye) => {
        const { y, m0, d } = parts(ye)
        const t = addMonths(y, m0, 6)
        const f = parts(dueDates(ye, { ccpcConditionsMet: false }).filing)
        expect(f.y).toBe(t.y)
        expect(f.m0).toBe(t.m0)
        if (d === lastDay(y, m0)) expect(f.d).toBe(lastDay(t.y, t.m0))
        else if (d <= lastDay(t.y, t.m0)) expect(f.d).toBe(d)
      }),
      { seed: 20261002, numRuns: 1000 },
    )
  })

  test('FLOW-7 property (seed 20261003): balance due two months after year end, three for a CCPC that meets the conditions (s. 28 counting)', () => {
    fc.assert(
      fc.property(anyYearEnd, fc.boolean(), (ye, ccpc) => {
        expect(dueDates(ye, { ccpcConditionsMet: ccpc }).balance).toBe(balanceOracle(ye, ccpc ? 3 : 2))
      }),
      { seed: 20261003, numRuns: 1000 },
    )
  })

  test('FLOW-7 property (seed 20261004): balance due comes before filing, and the CCPC balance date is later than the plain one', () => {
    fc.assert(
      fc.property(anyYearEnd, (ye) => {
        const plain = dueDates(ye, { ccpcConditionsMet: false })
        const ccpc = dueDates(ye, { ccpcConditionsMet: true })
        expect(plain.balance < plain.filing).toBe(true)
        expect(ccpc.balance < ccpc.filing).toBe(true)
        expect(plain.balance < ccpc.balance).toBe(true)
        expect(ye < plain.balance).toBe(true)
      }),
      { seed: 20261004, numRuns: 500 },
    )
  })
})
