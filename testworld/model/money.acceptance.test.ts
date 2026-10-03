// W00 acceptance tests: money in integer cents (ARC-13, check 2), plus the schema keeping money integral.
//
// Public API this file fixes (round 2, A353: exported from src/core/money.ts, the one strict converter; testworld/model
// may re-export it but must not hold a second one):
//   decimalToCents(s: string): { ok: true; cents: number } | { ok: false; reason: string }
//     Turns a decimal string of dollars ("-1234.5", "0.29", "12") into integer cents without floating point.
//     Accepts an optional leading "-", digits, and at most two decimals. Refuses, with a non-empty reason,
//     three or more decimals, a thousands separator, exponent notation, blanks and anything else.
//   centsToDecimal(cents: number): string
//     The canonical string: optional "-", integer part without leading zeros, ".", exactly two digits
//     (1234 -> "12.34", -5 -> "-0.05", 0 -> "0.00"). Refuses (throws) a non-integer or unsafe integer.
//   ClientSchema: the zod schema of a loaded client (see testworld/clients/clients.acceptance.test.ts).
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { centsToDecimal, decimalToCents } from '../../src/core/money';
import * as model from './index';

const SEED = 20261001;
const RUNS = 1000;
// Integer parts up to 13 digits keep every value inside Number.MAX_SAFE_INTEGER cents.
const MAX_INT_PART = 9_999_999_999_999n;

const intPart = fc.bigInt({ min: 0n, max: MAX_INT_PART }).map((b) => b.toString());
const twoDigits = fc.integer({ min: 0, max: 99 }).map((n) => String(n).padStart(2, '0'));

describe('W00 money converter', () => {
  test('ARC-13 property: any canonical two-decimal string converts to cents and back to the same string', () => {
    fc.assert(
      fc.property(fc.boolean(), intPart, twoDigits, (neg, int, frac) => {
        const zero = int === '0' && frac === '00';
        const s = `${neg && !zero ? '-' : ''}${int}.${frac}`;
        const expected = (BigInt(int) * 100n + BigInt(frac)) * (neg && !zero ? -1n : 1n);
        const r = decimalToCents(s);
        expect(r).toEqual({ ok: true, cents: Number(expected) });
        expect(Number.isSafeInteger((r as { cents: number }).cents)).toBe(true);
        expect(centsToDecimal(Number(expected))).toBe(s);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test('ARC-13 property: strings with no or one decimal convert exactly (up to two decimals are accepted)', () => {
    fc.assert(
      fc.property(fc.boolean(), intPart, fc.option(fc.integer({ min: 0, max: 9 }), { nil: undefined }), (neg, int, d) => {
        const s = `${neg ? '-' : ''}${int}${d === undefined ? '' : `.${String(d)}`}`;
        const abs = BigInt(int) * 100n + BigInt((d ?? 0) * 10);
        const expected = neg ? -abs : abs;
        const r = decimalToCents(s);
        expect(r.ok).toBe(true);
        // compare as numbers but avoid the -0 / 0 distinction
        expect((r as { cents: number }).cents + 0).toBe(Number(expected) + 0);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test('ARC-13 property: any safe integer of cents goes to a string and back unchanged', () => {
    fc.assert(
      fc.property(fc.integer({ min: -999_999_999_999_999, max: 999_999_999_999_999 }), (c) => {
        const s = centsToDecimal(c);
        expect(s).toMatch(/^-?(0|[1-9][0-9]*)\.[0-9]{2}$/);
        expect(decimalToCents(s)).toEqual({ ok: true, cents: c });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test('ARC-13 property: a third decimal or a thousands separator is always refused with a reason', () => {
    fc.assert(
      fc.property(intPart, twoDigits, fc.integer({ min: 0, max: 9 }), (int, frac, extra) => {
        const three = decimalToCents(`${int}.${frac}${String(extra)}`);
        expect(three.ok).toBe(false);
        expect((three as { reason: string }).reason.length).toBeGreaterThan(0);
        const grouped = decimalToCents(`1,${int.padStart(3, '0').slice(-3)}.${frac}`);
        expect(grouped.ok).toBe(false);
        expect((grouped as { reason: string }).reason.length).toBeGreaterThan(0);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  test.each(['1,234.56', '1.234', '1e3'])('ARC-13 "%s" is refused with a reason (card check 2)', (s) => {
    const r = decimalToCents(s);
    expect(r.ok).toBe(false);
    expect(r).toHaveProperty('reason');
    expect(typeof (r as { reason: string }).reason).toBe('string');
    expect((r as { reason: string }).reason.trim().length).toBeGreaterThan(0);
  });

  test.each(['', ' ', 'abc', '12.3.4', '1E3', 'NaN', 'Infinity', '$12.00', '12.00 ', '--1.00', '1 234.56'])(
    'ARC-13 "%s" is not a decimal amount and is refused with a reason',
    (s) => {
      const r = decimalToCents(s);
      expect(r.ok).toBe(false);
      expect((r as { reason: string }).reason.trim().length).toBeGreaterThan(0);
    },
  );

  // Fixed examples where floating point goes wrong (0.29 * 100 = 28.999..., 4.35 * 100 = 434.999...).
  test.each([
    ['0.29', 29],
    ['4.35', 435],
    ['1.13', 113],
    ['-0.05', -5],
    ['8011.69', 801169],
    ['131184.97', 13118497],
    ['12', 1200],
    ['12.5', 1250],
    ['0.00', 0],
    ['9007199254740.99', 900719925474099],
  ])('ARC-13 "%s" is exactly %i cents with no floating-point drift', (s, cents) => {
    const r = decimalToCents(s);
    expect(r.ok).toBe(true);
    expect((r as { cents: number }).cents + 0).toBe(cents);
  });

  test.each([
    [29, '0.29'],
    [-5, '-0.05'],
    [0, '0.00'],
    [1200, '12.00'],
    [-13118497, '-131184.97'],
  ])('ARC-13 %i cents prints as "%s"', (c, s) => {
    expect(centsToDecimal(c)).toBe(s);
  });

  test.each([1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])('ARC-13 centsToDecimal refuses %s (not a safe integer of cents)', (c) => {
    expect(() => centsToDecimal(c)).toThrow();
  });

  test('ARC-13 there is one strict converter: testworld/model re-exports the one in src/core/money.ts or none', () => {
    const m = model as Record<string, unknown>;
    for (const name of ['decimalToCents', 'centsToDecimal', 'dollarsToCents']) {
      if (m[name] === undefined) continue;
      expect(m[name], name).toBe(name === 'centsToDecimal' ? centsToDecimal : decimalToCents);
    }
  });
});
