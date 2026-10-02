// W03 acceptance tests: test world kind K03, first-year corporation with a short first year (ARC-8, CK-19, FLOW-7).
//
// Public API this file fixes (the builder writes it; tests await every call, so sync or async both work):
//   testworld/kinds/K03/kind.ts
//     export const kind: K03Kind        the whole kind, built from sample client C09 (startsFrom ['C09'])
//     export function checkKind(k: K03Kind): KindIssue[]   the kind's own self-check; [] for the shipped kind
//       KindIssue = { check: KindCheck; reason: string }
//       KindCheck = 'balance' | 'proration' | 'due-dates' | 'no-prior-year' | 'made-up' | 'year-end' | 'origins' | 'faults'
//     K03Kind = {
//       id: 'K03';
//       client: Client;                        passes ClientSchema and modelIssues (W00); C09's books and flags
//       onboarding: { corporation: { legal_name; business_number; fiscal_year_start; financial_year_end;
//                       incorporation_date; client_type: 'ccpc'; first_taxation_year: true;
//                       year_end_confirmed: false }; owners: { name; approximate_share_percent }[] };
//       priorYear: null;                       no prior year: no last-year figure, no prior T2, no assessment
//       documents: string[];                   document kinds (DOCUMENT_KINDS of src/contracts/facts.ts) this kind has
//       figures: Figure[]                      Figure = { gifi: number; label: string; cents: number;
//                                                origin: Origin; sources: Source[]; dot: Dot; agreesWith?: string }
//       facts: Fact[]                          Fact = { key: string; value: string | number | boolean;
//                                                origin: Origin; sourceKind: string; dot: Dot }
//       expected: {
//         days: number; shortYear: true;
//         businessLimit: { annualCents: number; numeratorDays: number; denominatorDays: number; line410Cents: number };
//         dueDates: { filing: string; balanceDue: string; balanceDueBasis: 'ccpc-three-months' };   (ISO dates)
//         yearEndConfirmed: false;
//         flags: { id: string; clause?: string }[];   every flag a person must see on this kind
//       };
//     }
//     Origin = 'third-party' | 'client-filed' | 'client-prepared' | 'client-said' | 'judgment'    (EV-10)
//     Dot = 'green' | 'grey' | 'amber' | 'purple'                                                  (EV-11)
//     Source = { kind: string; origin: Origin }
//     figures: cents = debit minus credit of the client's adjusted trial balance, summed by GIFI code (null codes left out).
//   testworld/kinds/K03/faults.ts
//     export const faults: FaultEntry[]        K03's planted faults (kind 'K03'); testworld/model/faults.ts registers them,
//                                              so faults() from testworld/index returns them too. Ids start "K03-".
//   Planted entries the card must hold (planted text and expected result both non-empty; expected names the exact flag):
//     CK-19  business limit not prorated for the 261-day year        FLOW-7  balance-due date taken as two months
//     FLOW-7 filing date counted from the incorporation date          END-1   year end never confirmed
//     ARC-8  a prior-year figure appearing on a first-year kind
import { describe, expect, test, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { ClientSchema, faults, listKinds, loadKind, modelIssues, passesCheckDigit } from '../../index';
import type { FaultEntry } from '../../index';
import { DOCUMENT_KINDS } from '../../../src/contracts/facts';
import { readOwnSource } from '../../../src/core/testing/read-own-source';
import { checkKind, kind } from './kind';
import type { K03Kind } from './kind';
import { faults as k03Faults } from './faults';

const ORIGINS = ['third-party', 'client-filed', 'client-prepared', 'client-said', 'judgment'];
const DOTS = ['green', 'grey', 'amber', 'purple'];
const DAY_MS = 86_400_000;
const days = (start: string, end: string): number => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
/** Half up on integer cents: the arithmetic the card pins (500,000.00 x 261 / 365 = 357,534.25). */
const prorate = (annualCents: number, num: number, den: number): number => Math.floor((annualCents * num * 2 + den) / (den * 2));
const loadKindFolder = (): string => join(dirname(fileURLToPath(import.meta.url)));
const fresh = (): K03Kind => structuredClone(kind);
const checks = (k: K03Kind): string[] => checkKind(k).map((i) => i.check);

describe('W03 K03 is built and registered (END-9)', () => {
  test('END-9 listKinds shows K03 as built, starting from sample client C09', async () => {
    const entry = (await Promise.resolve(listKinds())).find((k) => k.id === 'K03');
    expect(entry).toEqual({ id: 'K03', startsFrom: ['C09'], status: 'built' });
    expect(existsSync(loadKindFolder())).toBe(true);
  });

  test('END-9 loadKind("K03") returns the built kind and never a stub', async () => {
    const k = await Promise.resolve(loadKind('K03'));
    expect(k.id).toBe('K03');
    expect(k.status).toBe('built');
    expect(kind.id).toBe('K03');
    expect(kind.client.corporation.name.length).toBeGreaterThan(0);
  });
});

describe('W03 the kind loads through the W00 model (card checks 1, 2, 4)', () => {
  test('ARC-8 the client parses with ClientSchema and has no model issues against the fault catalogue', async () => {
    expect(ClientSchema.safeParse(kind.client).success).toBe(true);
    const catalogue: FaultEntry[] = await Promise.resolve(faults());
    expect(modelIssues(kind.client, catalogue)).toEqual([]);
  });

  test('ARC-8 the books balance: opening, unadjusted and adjusted trial balances each net to zero and agree with their totals', () => {
    for (const name of ['opening', 'unadjusted', 'adjusted'] as const) {
      const tb = kind.client.trialBalance[name];
      const debit = tb.rows.reduce((s, r) => s + r.debitCents, 0);
      const credit = tb.rows.reduce((s, r) => s + r.creditCents, 0);
      expect([name, debit, credit]).toEqual([name, tb.totalDebitCents, tb.totalCreditCents]);
      expect([name, debit - credit]).toEqual([name, 0]);
    }
  });

  test('ARC-8 every account rolls month to month (no waiver is owed by K03)', () => {
    for (const a of kind.client.accounts) for (const m of a.months) expect([a.key, m.month, m.rolls]).toEqual([a.key, m.month, true]);
  });

  test('ARC-8 made-up data only: names end in "(Test)", the business number fails its check digit, no SIN is held', () => {
    expect(kind.client.corporation.name).toMatch(/\(Test\)$/);
    expect(kind.onboarding.corporation.legal_name).toMatch(/\(Test\)$/);
    expect(kind.onboarding.corporation.legal_name).toBe(kind.client.corporation.name);
    expect(kind.client.owners.length).toBeGreaterThanOrEqual(2);
    for (const o of kind.client.owners) expect(o.name).toMatch(/\(Test\)$/);
    expect(kind.onboarding.corporation.business_number).toMatch(/^\d{9}$/);
    expect(passesCheckDigit(kind.onboarding.corporation.business_number)).toBe(false);
    expect(JSON.stringify(kind)).not.toMatch(/\b\d{3}[- ]\d{3}[- ]\d{3}\b/);
  });

  test('ARC-8 the owners hold 100% between them', () => {
    expect(kind.onboarding.owners.map((o) => o.name)).toEqual(kind.client.owners.map((o) => o.name));
    expect(kind.onboarding.owners.reduce((s, o) => s + o.approximate_share_percent, 0)).toBe(100);
  });
});

describe('W03 the short first year (CK-19)', () => {
  test('CK-19 the first year is 15 Apr 2025 to 31 Dec 2025: 261 days, under 51 weeks (357 days)', () => {
    const c = kind.onboarding.corporation;
    expect([c.fiscal_year_start, c.financial_year_end]).toEqual(['2025-04-15', '2025-12-31']);
    expect([kind.client.corporation.yearStart, kind.client.corporation.yearEnd]).toEqual(['2025-04-15', '2025-12-31']);
    expect(c.incorporation_date).toBe('2025-04-15');
    expect(c.first_taxation_year).toBe(true);
    expect(days(c.fiscal_year_start, c.financial_year_end)).toBe(261);
    expect(kind.expected.days).toBe(261);
    expect(kind.expected.shortYear).toBe(true);
    expect(kind.expected.days).toBeLessThan(51 * 7);
  });

  test('CK-19 line 410 is the $500,000.00 business limit prorated by 261 over 365: 35,753,425 cents', () => {
    const b = kind.expected.businessLimit;
    expect([b.annualCents, b.numeratorDays, b.denominatorDays]).toEqual([50_000_000, 261, 365]);
    expect(b.line410Cents).toBe(35_753_425);
    expect(b.line410Cents).toBe(prorate(b.annualCents, b.numeratorDays, b.denominatorDays));
    expect(b.line410Cents).toBeLessThan(b.annualCents);
  });

  test('CK-19 the proration rule is monotonic and never exceeds the annual limit (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 365 }), fc.integer({ min: 1, max: 365 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const p = (d: number): number => prorate(50_000_000, d, 365);
        expect(p(lo)).toBeLessThanOrEqual(p(hi));
        expect(p(hi)).toBeLessThanOrEqual(50_000_000);
        expect(Math.abs(p(hi) * 365 - 50_000_000 * hi)).toBeLessThanOrEqual(365 / 2);
      }),
    );
  });

  test('CK-19 no associated company: the two shareholders are people, so no Schedule 23 partner is expected', () => {
    expect(kind.client.owners.every((o) => !/Inc\.|Ltd\.|Corp/.test(o.name))).toBe(true);
    expect(kind.expected.flags.some((f) => f.clause === 'CK-19')).toBe(true);
  });
});

describe('W03 due dates (FLOW-7, FLOW-12)', () => {
  test('FLOW-7 filing due 30 Jun 2026 (sixth month, last day because the year end is 31 Dec); balance due 31 Mar 2026 (CCPC, three months)', () => {
    expect(kind.expected.dueDates).toEqual({ filing: '2026-06-30', balanceDue: '2026-03-31', balanceDueBasis: 'ccpc-three-months' });
    expect(kind.onboarding.corporation.client_type).toBe('ccpc');
  });

  test('FLOW-7 neither date is counted from the incorporation date or the year start', () => {
    const d = kind.expected.dueDates;
    expect(d.filing > '2026-01-01').toBe(true);
    expect(d.filing).not.toBe('2025-10-15');
    expect(d.balanceDue).not.toBe('2026-02-28');
  });
});

describe('W03 no prior year (END-6)', () => {
  test('ARC-8 the kind has no prior year: priorYear is null and C09 carries none', () => {
    expect(kind.priorYear).toBeNull();
    expect(kind.client.priorYear == null || (typeof kind.client.priorYear === 'object' && Object.keys(kind.client.priorYear).length === 0)).toBe(true);
  });

  test('ARC-8 no figure or fact rests on a prior return, and no prior-year document exists', () => {
    expect(JSON.stringify(kind.figures.map((f) => f.sources))).not.toMatch(/prior/);
    expect(kind.facts.every((f) => f.sourceKind !== 'prior_return' && f.sourceKind !== 'prior-t2' && f.sourceKind !== 'noa')).toBe(true);
    expect(kind.documents).not.toContain('prior-t2');
    expect(kind.documents).not.toContain('noa');
  });
});

describe('W03 the year end was never confirmed (END-1)', () => {
  test('END-1 the onboarding year end is marked unconfirmed and the expected result is an ops confirmation, not a guess', () => {
    expect(kind.onboarding.corporation.year_end_confirmed).toBe(false);
    expect(kind.expected.yearEndConfirmed).toBe(false);
    expect(kind.expected.flags.some((f) => f.clause === 'END-1')).toBe(true);
  });
});

describe('W03 expected figures, facts, documents (card "Build")', () => {
  test('ARC-8 each GIFI figure equals the adjusted trial balance net for its code, and the figures net to zero', () => {
    const expected = new Map<number, number>();
    for (const r of kind.client.trialBalance.adjusted.rows) {
      if (r.gifi === null) continue;
      expected.set(r.gifi, (expected.get(r.gifi) ?? 0) + r.debitCents - r.creditCents);
    }
    expect(kind.figures.length).toBe(expected.size);
    for (const f of kind.figures) {
      expect([f.gifi, f.cents]).toEqual([f.gifi, expected.get(f.gifi)]);
      expect(Number.isInteger(f.cents)).toBe(true);
      expect(f.label.length).toBeGreaterThan(0);
    }
    expect(new Set(kind.figures.map((f) => f.gifi)).size).toBe(kind.figures.length);
    expect(kind.figures.reduce((s, f) => s + f.cents, 0)).toBe(0);
  });

  test('EV-10 every figure and fact has one origin from the five, and a dot from the four', () => {
    for (const f of kind.figures) {
      expect(ORIGINS, `figure ${String(f.gifi)}`).toContain(f.origin);
      expect(DOTS).toContain(f.dot);
      expect(f.sources.length).toBeGreaterThan(0);
      for (const s of f.sources) expect(ORIGINS).toContain(s.origin);
    }
    expect(kind.facts.length).toBeGreaterThan(0);
    for (const f of kind.facts) {
      expect(f.key).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
      expect(ORIGINS).toContain(f.origin);
      expect(DOTS).toContain(f.dot);
    }
    expect(new Set(kind.facts.map((f) => f.key)).size).toBe(kind.facts.length);
  });

  test('EV-11 the dot follows the weakest source; green needs a third party and a written agreement rule (EV-13)', () => {
    for (const f of kind.figures) {
      const origins = f.sources.map((s) => s.origin);
      if (origins.includes('judgment')) expect(f.dot).toBe('purple');
      else if (origins.some((o) => o === 'client-prepared' || o === 'client-filed' || o === 'client-said') && !origins.includes('third-party')) expect(f.dot).toBe('amber');
      if (f.dot === 'green') {
        expect(origins).toContain('third-party');
        expect((f.agreesWith ?? '').trim().length).toBeGreaterThan(0);
      }
    }
    const onboardingFacts = kind.facts.filter((f) => f.sourceKind === 'onboarding');
    expect(onboardingFacts.length).toBeGreaterThan(0);
    for (const f of onboardingFacts) expect([f.key, f.origin, f.dot]).toEqual([f.key, 'client-said', 'amber']);
  });

  test('END-9 the documents list uses real document kinds, holds the two statements and the books, and no prior-year kind', () => {
    expect(kind.documents.length).toBeGreaterThan(0);
    for (const d of kind.documents) expect(DOCUMENT_KINDS as readonly string[], d).toContain(d);
    for (const need of ['bank', 'card']) expect(kind.documents).toContain(need);
    expect(new Set(kind.documents).size).toBe(kind.documents.length);
  });
});

describe('W03 planted faults (card check 3, ARC-8)', () => {
  test('ARC-8 every sample-client flag C09 raises is an expected flag of the kind', () => {
    const ids = kind.expected.flags.map((f) => f.id);
    for (const f of kind.client.flags) expect(ids, f.id).toContain(f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('ARC-8 testworld/kinds/K03/faults.ts lists K03 faults, each owned by kind K03 with non-empty planted and expected', () => {
    expect(k03Faults.length).toBeGreaterThanOrEqual(5);
    for (const f of k03Faults) {
      expect(f.kind).toBe('K03');
      expect(f.id).toMatch(/^K03-/);
      expect(f.planted.trim().length).toBeGreaterThan(0);
      expect(f.expected.trim().length).toBeGreaterThan(0);
      expect(f.clause).toMatch(/^[A-Z]{2,4}-\d+[a-z]?$/);
    }
    expect(new Set(k03Faults.map((f) => f.id)).size).toBe(k03Faults.length);
  });

  test('ARC-8 the W00 catalogue returns every K03 fault, once', async () => {
    const all: FaultEntry[] = await Promise.resolve(faults());
    for (const f of k03Faults) expect(all.filter((a) => a.id === f.id), f.id).toHaveLength(1);
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
  });

  test('ARC-8 every clause on the card (ARC-8, CK-19, FLOW-7) and END-1 is named by a planted fault', () => {
    const named = new Set(k03Faults.map((f) => f.clause));
    for (const c of ['ARC-8', 'CK-19', 'FLOW-7', 'END-1']) expect(named.has(c), c).toBe(true);
    const text = k03Faults.map((f) => `${f.planted} ${f.expected}`).join('\n');
    expect(text).toMatch(/261/);
    expect(text).toMatch(/31 Mar 2026|2026-03-31/);
    expect(text).toMatch(/30 Jun 2026|2026-06-30/);
  });

  test('ARC-8 the kind carries no client sentence and no live source (names, dates and seeds fixed)', () => {
    const src = ['kind.ts', 'faults.ts'].map((f) => readOwnSource(`testworld/kinds/K03/${f}`)).join('\n');
    for (const banned of ['Math.random', 'Date.now', 'new Date()', 'process.env', 'fetch(', 'https://']) expect(src.includes(banned), banned).toBe(false);
  });

  test('ARC-8 the kind is deterministic: two loads are identical', async () => {
    vi.resetModules();
    const again = (await import('./kind')) as { kind: K03Kind };
    expect(again.kind).not.toBe(kind);
    expect(JSON.stringify(again.kind)).toBe(JSON.stringify(kind));
  });
});

describe('W03 the kind checks itself: one planted fault per rule is caught', () => {
  test('the shipped kind has no issues', () => {
    expect(checkKind(kind)).toEqual([]);
  });

  test('balance: an unbalanced adjusted trial balance is caught', () => {
    const k = fresh();
    const row = k.client.trialBalance.adjusted.rows[0];
    if (row === undefined) throw new Error('no rows');
    row.debitCents += 1;
    expect(checks(k)).toContain('balance');
  });

  test('CK-19 proration: line 410 left at the full $500,000.00 is caught', () => {
    const k = fresh();
    k.expected.businessLimit.line410Cents = 50_000_000;
    expect(checks(k)).toContain('proration');
  });

  test('CK-19 proration: line 410 one cent off is caught', () => {
    const k = fresh();
    k.expected.businessLimit.line410Cents += 1;
    expect(checks(k)).toContain('proration');
  });

  test('FLOW-7 due dates: a two-month balance-due date is caught', () => {
    const k = fresh();
    k.expected.dueDates.balanceDue = '2026-02-28';
    expect(checks(k)).toContain('due-dates');
  });

  test('FLOW-7 due dates: a filing date counted from the incorporation date is caught', () => {
    const k = fresh();
    k.expected.dueDates.filing = '2025-10-15';
    expect(checks(k)).toContain('due-dates');
  });

  test('ARC-8 no prior year: a prior-year value on a first-year kind is caught', () => {
    const k = fresh();
    (k as { priorYear: unknown }).priorYear = { closing: 1 };
    expect(checks(k)).toContain('no-prior-year');
  });

  test('ARC-8 no prior year: a figure resting on the prior return is caught', () => {
    const k = fresh();
    const f = k.figures[0];
    if (f === undefined) throw new Error('no figures');
    f.sources.push({ kind: 'prior_return', origin: 'third-party' });
    expect(checks(k)).toContain('no-prior-year');
  });

  test('ARC-8 made-up data: a name without "(Test)" is caught', () => {
    const k = fresh();
    k.client.corporation.name = 'Scarborough Robotics Labs Inc.';
    expect(checks(k)).toContain('made-up');
  });

  test('END-1 year end: a confirmed year end on this kind is caught', () => {
    const k = fresh();
    (k.onboarding.corporation as { year_end_confirmed: boolean }).year_end_confirmed = true;
    expect(checks(k)).toContain('year-end');
  });

  test('EV-11 origins: a green dot with no third-party source is caught', () => {
    const k = fresh();
    const f = k.figures[0];
    if (f === undefined) throw new Error('no figures');
    f.sources = [{ kind: 'qbo', origin: 'client-prepared' }];
    f.origin = 'client-prepared';
    f.dot = 'green';
    expect(checks(k)).toContain('origins');
  });

  test('ARC-8 faults: an expected flag with no fault behind it, or a removed CK-19 fault, is caught', () => {
    const k = fresh();
    k.expected.flags = k.expected.flags.filter((f) => f.clause !== 'CK-19');
    expect(checks(k)).toContain('faults');
  });
});
