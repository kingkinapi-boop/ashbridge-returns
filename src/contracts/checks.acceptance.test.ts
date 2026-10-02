/**
 * F05 Check contract: acceptance tests (spec-writer; builders never edit this file).
 *
 * The contract these tests pin (src/contracts/checks.ts). Money is integer cents (ARC-13,
 * `Cents` from src/core/money.ts); every function below refuses a non-integer amount by throwing.
 *
 *   CHECK_KINDS = ['tie', 'reconciliation', 'flag', 'ai'] as const; type CheckKind
 *   type CheckRecord<R = unknown> = {                                         (CK-1)
 *     id: string                      the clause, for example 'CK-20'
 *     kind: CheckKind
 *     appliesTo: (ret: R) => boolean  when it applies, a function of the return
 *     inputs: readonly string[]
 *     rule: string
 *     sourceLink: string              non-empty after trimming
 *     raises: string                  what it raises
 *   }
 *   type Validation = { ok: true } | { ok: false; reason: string }   (reason non-empty, plain words)
 *   validateCheckRecord(x: unknown): Validation
 *
 *   type CheckResult =
 *     | { status: 'pass' }
 *     | { status: 'fail'; left: Cents; right: Cents }                 fail with both amounts
 *     | { status: 'not_checked'; label: 'not checked: no evidence' }   (CK-2)
 *     | { status: 'flag'; reason: string }                            (CK-5)
 *   pass(), fail(left, right), notChecked(), flag(reason)   constructors; each result is frozen
 *   summarizeResults(results): { pass: number; fail: number; notChecked: number; flag: number; total: number }
 *   allPassed(results): boolean          true only when the list is non-empty and every result is 'pass'
 *   validateResultForCheck(record, result): Validation
 *                                        refuses 'pass' or 'fail' from a check of kind 'flag' (CK-5)
 *
 *   tie(left: Cents, right: Cents): CheckResult     pass iff |left - right| < 100, else fail(left, right) (CK-3)
 *   roundStatementToDollars(lines: Cents[]): {
 *     lines: Cents[]             each line rounded to whole dollars by roundCentsToDollars, in cents
 *     total: Cents               sum of the rounded lines
 *     exactTotal: Cents          sum of the unrounded lines
 *     roundedExactTotal: Cents   roundCentsToDollars(exactTotal) * 100 (the GIFI total line)
 *     roundingItem: ReconcilingItem | null
 *                                null iff total === roundedExactTotal; otherwise code 'R21',
 *                                amount = roundedExactTotal - total, a non-empty source
 *   }
 *
 *   RECONCILING_ITEM_CODES: readonly string[]   the fixed list; holds at least R01 to R29 (CK-48 table)
 *   type ReconcilingItem = { code: string; amount: Cents; source: string; acceptedBy?: string; note?: string }
 *   validateReconcilingItem(x: unknown): Validation   refuses a code off the list or an empty source
 *   reconcile({ left, right, items }): Reconciliation
 *   type Reconciliation = {
 *     left: Cents; right: Cents; difference: Cents (left - right);
 *     items: ReconcilingItem[]; itemsTotal: Cents; unexplained: Cents (difference - itemsTotal);
 *     raisesException: boolean  (unexplained !== 0; the explained remainder must be zero)
 *   }
 *
 *   type CheckException = { checkId: string; amount: Cents; estimatedTaxEffect: Cents }   (CK-6)
 *   validateException(x: unknown): Validation   refuses a missing or non-integer amount or tax effect
 */
import fc from 'fast-check'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { roundCentsToDollars, type Cents } from '../core/money'
import {
  CHECK_KINDS,
  RECONCILING_ITEM_CODES,
  allPassed,
  fail,
  flag,
  notChecked,
  pass,
  reconcile,
  roundStatementToDollars,
  summarizeResults,
  tie,
  validateCheckRecord,
  validateException,
  validateReconcilingItem,
  validateResultForCheck,
  type CheckException,
  type CheckRecord,
  type CheckResult,
  type ReconcilingItem,
} from './checks'

const SEED = 20261001
const RUNS = { seed: SEED, numRuns: 500 }

/** Integer cents, far inside the safe range so differences and sums stay safe. */
const centsArb = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 })
const smallCentsArb = fc.integer({ min: -100_000_00, max: 100_000_00 })

type TestReturn = { corporation: string; hasGstAccount: boolean }
const RETURN: TestReturn = { corporation: 'Maple Ridge Dental (Test)', hasGstAccount: true }

const RECORD: CheckRecord<TestReturn> = {
  id: 'CK-20',
  kind: 'reconciliation',
  appliesTo: (ret) => ret.hasGstAccount,
  inputs: ['revenue by period (Test)', 'GST/HST line 101 by period (Test)'],
  rule: 'Revenue against GST/HST line 101 for the same periods',
  sourceLink: 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4058.html',
  raises: 'exception for the unexplained remainder',
}

const FLAG_RECORD: CheckRecord<TestReturn> = {
  ...RECORD,
  id: 'CK-34',
  kind: 'flag',
  rule: 'Specified investment business signs',
  raises: 'flag for a person',
}

const item = (code: string, amount: Cents, source = 'statement-2026-12 (Test).pdf p1'): ReconcilingItem => ({
  code,
  amount,
  source,
})

/** A copy of `obj` with `key` removed (a planted missing field). */
const without = <T extends object>(obj: T, key: keyof T & string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key))

const expectRefused = (v: { ok: boolean; reason?: string }, about?: RegExp) => {
  expect(v.ok).toBe(false)
  expect(typeof v.reason).toBe('string')
  expect((v.reason ?? '').trim().length).toBeGreaterThan(0)
  if (about) expect(v.reason).toMatch(about)
}

describe('CK-1 the check record', () => {
  test('CK-1 a complete check record passes validation', () => {
    expect(validateCheckRecord(RECORD)).toEqual({ ok: true })
    expect(CHECK_KINDS).toEqual(['tie', 'reconciliation', 'flag', 'ai'])
  })

  test('CK-1 when it applies is a function of the return', () => {
    expect(RECORD.appliesTo(RETURN)).toBe(true)
    expect(RECORD.appliesTo({ ...RETURN, hasGstAccount: false })).toBe(false)
    expectTypeOf<CheckRecord<TestReturn>['appliesTo']>().parameter(0).toEqualTypeOf<TestReturn>()
  })

  test('CK-1 a check record with no source link fails validation', () => {
    const noLink = without(RECORD, 'sourceLink')
    expectRefused(validateCheckRecord(noLink), /source/i)
  })

  test('CK-1 a check record with an empty or blank source link fails validation', () => {
    expectRefused(validateCheckRecord({ ...RECORD, sourceLink: '' }), /source/i)
    expectRefused(validateCheckRecord({ ...RECORD, sourceLink: '   ' }), /source/i)
  })

  test('CK-1 a check record with a kind off the list fails validation', () => {
    expectRefused(validateCheckRecord({ ...RECORD, kind: 'guess' }))
  })

  test('CK-1 a check record whose applies-to is not a function fails validation', () => {
    expectRefused(validateCheckRecord({ ...RECORD, appliesTo: true }))
  })
})

describe('CK-2 not checked: no evidence', () => {
  test('CK-2 the result reads "not checked: no evidence"', () => {
    const r = notChecked()
    expect(r.status).toBe('not_checked')
    expect(r).toMatchObject({ label: 'not checked: no evidence' })
  })

  test('CK-2 a list of only not-checked results is never all passed and counts no pass', () => {
    const results = [notChecked(), notChecked()]
    expect(allPassed(results)).toBe(false)
    expect(summarizeResults(results)).toEqual({ pass: 0, fail: 0, notChecked: 2, flag: 0, total: 2 })
  })

  test('CK-2 one not-checked result among passes stops all passed', () => {
    expect(allPassed([pass(), pass()])).toBe(true)
    expect(allPassed([pass(), notChecked(), pass()])).toBe(false)
  })

  test('CK-2 an empty list is not all passed', () => {
    expect(allPassed([])).toBe(false)
  })

  test('CK-2 property: the pass count equals the number of pass results, never more', () => {
    const resultArb: fc.Arbitrary<CheckResult> = fc.oneof(
      fc.constant(null).map(() => pass()),
      fc.tuple(centsArb, centsArb).map(([l, r]) => fail(l, r)),
      fc.constant(null).map(() => notChecked()),
      fc.string({ minLength: 1 }).map((s) => flag(`sign (Test) ${s}`)),
    )
    fc.assert(
      fc.property(fc.array(resultArb, { maxLength: 40 }), (results) => {
        const s = summarizeResults(results)
        const count = (status: CheckResult['status']) => results.filter((r) => r.status === status).length
        expect(s.pass).toBe(count('pass'))
        expect(s.notChecked).toBe(count('not_checked'))
        expect(s.flag).toBe(count('flag'))
        expect(s.fail).toBe(count('fail'))
        expect(s.total).toBe(results.length)
        expect(allPassed(results)).toBe(results.length > 0 && count('pass') === results.length)
      }),
      RUNS,
    )
  })
})

describe('CK-3 ties agree to the dollar', () => {
  test('CK-3 examples: under one dollar apart ties; one dollar or more does not', () => {
    expect(tie(10049, 10051).status).toBe('pass')
    expect(tie(10000, 10099).status).toBe('pass')
    expect(tie(10000, 9901).status).toBe('pass')
    expect(tie(10000, 10100).status).toBe('fail')
    expect(tie(10100, 10000).status).toBe('fail')
    expect(tie(-5000, -5000).status).toBe('pass')
  })

  test('CK-3 a failed tie carries both amounts', () => {
    expect(tie(123456, 120000)).toEqual({ status: 'fail', left: 123456, right: 120000 })
  })

  test('CK-3 a tie refuses amounts that are not integer cents', () => {
    expect(() => tie(100.5, 100)).toThrow()
    expect(() => tie(100, Number.NaN)).toThrow()
  })

  test('CK-3 ARC-13 property: a tie passes if and only if the absolute difference is under 100 cents', () => {
    fc.assert(
      fc.property(centsArb, fc.integer({ min: -300, max: 300 }), centsArb, (a, near, far) => {
        for (const b of [a + near, far]) {
          const r = tie(a, b)
          const shouldPass = Math.abs(a - b) < 100
          expect(r.status).toBe(shouldPass ? 'pass' : 'fail')
          if (!shouldPass) expect(r).toEqual({ status: 'fail', left: a, right: b })
          expect(tie(b, a).status).toBe(r.status)
        }
      }),
      RUNS,
    )
  })

  test('CK-3 a statement rounded line by line uses the one rounding rule (halves away from zero)', () => {
    const s = roundStatementToDollars([50, -50, 149, 12345])
    expect(s.lines).toEqual([100, -100, 100, 12300])
    expect(s.total).toBe(12400)
    expect(s.exactTotal).toBe(12494)
    expect(s.roundedExactTotal).toBe(12500)
    expect(s.roundingItem).toMatchObject({ code: 'R21', amount: 100 })
  })

  test('CK-3 a rounded statement that still ties carries no rounding item', () => {
    const s = roundStatementToDollars([10000, 20000, 30049])
    expect(s.total).toBe(60000)
    expect(s.roundedExactTotal).toBe(60000)
    expect(s.roundingItem).toBeNull()
  })

  test('CK-3 ARC-13 property: rounded lines compare equal to the rounded total or carry a recorded rounding item', () => {
    fc.assert(
      fc.property(fc.array(smallCentsArb, { maxLength: 60 }), (raw) => {
        const s = roundStatementToDollars(raw)
        expect(s.lines).toHaveLength(raw.length)
        raw.forEach((c, i) => {
          expect(s.lines[i]).toBe(roundCentsToDollars(c) * 100)
        })
        expect(s.total).toBe(s.lines.reduce((x, y) => x + y, 0))
        expect(s.exactTotal).toBe(raw.reduce((x, y) => x + y, 0))
        expect(s.roundedExactTotal).toBe(roundCentsToDollars(s.exactTotal) * 100)
        if (s.total === s.roundedExactTotal) {
          expect(s.roundingItem).toBeNull()
        } else {
          expect(s.roundingItem).not.toBeNull()
          const ri = s.roundingItem as ReconcilingItem
          expect(ri.code).toBe('R21')
          expect(ri.source.trim().length).toBeGreaterThan(0)
          expect(s.total + ri.amount).toBe(s.roundedExactTotal)
          expect(validateReconcilingItem(ri)).toEqual({ ok: true })
        }
        for (const c of [...s.lines, s.total, s.exactTotal, s.roundedExactTotal]) {
          expect(Number.isSafeInteger(c)).toBe(true)
        }
      }),
      RUNS,
    )
  })
})

describe('CK-4 reconciliations', () => {
  test('CK-4 items that explain the difference exactly raise nothing', () => {
    const rec = reconcile({
      left: 500_000_00,
      right: 488_750_00,
      items: [item('R02', 10_000_00), item('R07', 1_250_00)],
    })
    expect(rec.left).toBe(500_000_00)
    expect(rec.right).toBe(488_750_00)
    expect(rec.difference).toBe(11_250_00)
    expect(rec.itemsTotal).toBe(11_250_00)
    expect(rec.unexplained).toBe(0)
    expect(rec.items).toHaveLength(2)
    expect(rec.raisesException).toBe(false)
  })

  test('CK-4 one dollar unexplained raises an exception', () => {
    const rec = reconcile({
      left: 500_000_00,
      right: 488_750_00,
      items: [item('R02', 10_000_00), item('R07', 1_249_00)],
    })
    expect(rec.unexplained).toBe(100)
    expect(rec.raisesException).toBe(true)
  })

  test('CK-4 a reconciliation with no items raises its whole difference', () => {
    const rec = reconcile({ left: 1000, right: 1000, items: [] })
    expect(rec.raisesException).toBe(false)
    const off = reconcile({ left: 1000, right: 2000, items: [] })
    expect(off.difference).toBe(-1000)
    expect(off.unexplained).toBe(-1000)
    expect(off.raisesException).toBe(true)
  })

  test('CK-4 ARC-13 a reconciliation refuses amounts that are not integer cents', () => {
    expect(() => reconcile({ left: 10.5, right: 0, items: [] })).toThrow()
    expect(() => reconcile({ left: 0, right: 0, items: [item('R04', 0.25)] })).toThrow()
  })

  test('CK-4 ARC-13 property: difference and unexplained remainder are exact in integer cents', () => {
    const codes = ['R01', 'R02', 'R04', 'R07', 'R21', 'R22']
    const itemArb = fc
      .tuple(fc.constantFrom(...codes), smallCentsArb)
      .map(([code, amount]) => item(code, amount))
    fc.assert(
      fc.property(centsArb, centsArb, fc.array(itemArb, { maxLength: 20 }), (left, right, items) => {
        const rec = reconcile({ left, right, items })
        const sum = items.reduce((t, i) => t + i.amount, 0)
        expect(rec.left).toBe(left)
        expect(rec.right).toBe(right)
        expect(rec.difference).toBe(left - right)
        expect(rec.itemsTotal).toBe(sum)
        expect(rec.unexplained).toBe(left - right - sum)
        expect(rec.raisesException).toBe(left - right - sum !== 0)
        expect(Number.isSafeInteger(rec.unexplained)).toBe(true)
      }),
      RUNS,
    )
  })

  test('CK-4 property: items built to explain the difference exactly never raise', () => {
    fc.assert(
      fc.property(centsArb, fc.array(smallCentsArb, { maxLength: 10 }), (left, parts) => {
        const items = parts.map((p) => item('R22', p))
        const right = left - parts.reduce((t, p) => t + p, 0)
        const rec = reconcile({ left, right, items })
        expect(rec.unexplained).toBe(0)
        expect(rec.raisesException).toBe(false)
      }),
      RUNS,
    )
  })
})

describe('CK-4 reconciling items', () => {
  test('CK-4 the fixed list holds the CK-48 codes R01 to R29', () => {
    for (let n = 1; n <= 29; n++) {
      expect(RECONCILING_ITEM_CODES).toContain(`R${String(n).padStart(2, '0')}`)
    }
  })

  test('CK-4 a typed, sourced item passes validation', () => {
    expect(validateReconcilingItem(item('R04', 2_500_00))).toEqual({ ok: true })
  })

  test('CK-4 an item whose type is not on the fixed list fails validation', () => {
    expectRefused(validateReconcilingItem(item('R99', 100)))
    expectRefused(validateReconcilingItem(item('rounding', 100)))
    expectRefused(validateReconcilingItem(item('', 100)))
  })

  test('CK-4 an item with no source fails validation', () => {
    const noSource = without(item('R04', 100), 'source')
    expectRefused(validateReconcilingItem(noSource), /source/i)
    expectRefused(validateReconcilingItem(item('R04', 100, '')), /source/i)
    expectRefused(validateReconcilingItem(item('R04', 100, '  ')), /source/i)
  })

  test('CK-4 ARC-13 an item whose amount is not integer cents fails validation', () => {
    expectRefused(validateReconcilingItem(item('R04', 12.5)))
  })
})

describe('CK-5 flags go to a person', () => {
  test('CK-5 a flag result is a flag in every summary, never a pass', () => {
    const r = flag('one client gives 92% of revenue (Test)')
    expect(r.status).toBe('flag')
    expect(summarizeResults([r])).toEqual({ pass: 0, fail: 0, notChecked: 0, flag: 1, total: 1 })
    expect(allPassed([pass(), r])).toBe(false)
  })

  test('CK-5 code cannot turn a flag result into a pass', () => {
    const r = flag('possible personal services business (Test)')
    expect(Object.isFrozen(r)).toBe(true)
    expect(() => {
      ;(r as { status: string }).status = 'pass'
    }).toThrow(TypeError)
    expect(r.status).toBe('flag')
  })

  test('CK-5 a check of kind flag may not return pass or fail', () => {
    expectRefused(validateResultForCheck(FLAG_RECORD, pass()))
    expectRefused(validateResultForCheck(FLAG_RECORD, fail(100, 0)))
    expect(validateResultForCheck(FLAG_RECORD, flag('sign seen (Test)'))).toEqual({ ok: true })
    expect(validateResultForCheck(FLAG_RECORD, notChecked())).toEqual({ ok: true })
  })

  test('CK-5 a tie check may return pass or fail', () => {
    const tieRecord: CheckRecord<TestReturn> = { ...RECORD, id: 'CK-10', kind: 'tie' }
    expect(validateResultForCheck(tieRecord, pass())).toEqual({ ok: true })
    expect(validateResultForCheck(tieRecord, fail(100, 0))).toEqual({ ok: true })
  })

  test('CK-5 every result constructor returns a frozen result', () => {
    for (const r of [pass(), fail(1, 2), notChecked(), flag('x (Test)')]) {
      expect(Object.isFrozen(r)).toBe(true)
    }
  })
})

describe('CK-6 exceptions', () => {
  const EXC: CheckException = { checkId: 'CK-22', amount: 1_234_56, estimatedTaxEffect: 154_32 }

  test('CK-6 an exception with its dollar amount and estimated tax effect passes validation', () => {
    expect(validateException(EXC)).toEqual({ ok: true })
    expectTypeOf<CheckException['amount']>().toEqualTypeOf<Cents>()
    expectTypeOf<CheckException['estimatedTaxEffect']>().toEqualTypeOf<Cents>()
  })

  test('CK-6 an exception with no dollar amount fails validation', () => {
    const noAmount = without(EXC, 'amount')
    expectRefused(validateException(noAmount))
  })

  test('CK-6 an exception with no estimated tax effect fails validation', () => {
    const noEffect = without(EXC, 'estimatedTaxEffect')
    expectRefused(validateException(noEffect))
  })

  test('CK-6 ARC-13 an exception whose amounts are not integer cents fails validation', () => {
    expectRefused(validateException({ ...EXC, amount: 12.34 }))
    expectRefused(validateException({ ...EXC, estimatedTaxEffect: Number.NaN }))
    expectRefused(validateException({ ...EXC, amount: '1234' }))
  })
})
