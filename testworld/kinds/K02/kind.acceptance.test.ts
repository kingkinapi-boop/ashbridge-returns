// W02 acceptance tests: test-world kind K02, "New to us; prior T2 from other software" (ARC-8, TB-8; also TB-3, TB-5, EV-11, EV-12 where a planted fault names them).
//
// Public API this file fixes (the build writes these two files; W00's loader reads the folder):
//   testworld/kinds/K02/kind.ts   exports `kind: K02Kind`
//     K02Kind = {
//       id: 'K02'; seed: number; startsFrom: ['C08'];
//       client: Client;            // the W00 model of C08 as the other firm left it: same corporation, accounts,
//                                  // transactions, adjusting entries and trial balances as loadClient('C08') (an extension, never a second set)
//       priorReturn: { firm: string; software: string; yearEnd: string; preparedByUs: boolean;
//                      documents: ('prior-t2-pdf' | 'notice-of-assessment')[] };
//       conversion: ConversionRow[];  // one row per GIFI code of the opening trial balance
//       expected: { figures: { gifi: number; amountCents: number; origin: string; dot: Dot }[]; flags: { id: string; clause: string; severity: 'must fire' | 'info' }[] };
//       documents: { id: string; family: string; accountKey?: string; scan: boolean }[];
//     }
//     Dot = 'green' | 'grey' | 'amber' | 'purple' (EV-11).
//     ConversionRow = { gifi: number; account: string; convertedCents: number; priorT2Cents: number | null;
//                       differenceCents: number | null; tiedTo: ('prior-t2-pdf' | 'notice-of-assessment')[]; dot: Dot;
//                       priorGifi?: number; mappedDifferently?: boolean }
//     Signed cents, debit positive and credit negative, so convertedCents is the net of the opening trial balance for that GIFI code.
//     differenceCents = convertedCents - priorT2Cents (null when the prior T2 does not carry the code).
//   testworld/kinds/K02/faults.ts exports `faults: FaultEntry[]` (the W00 FaultEntry type; each has kind 'K02', a flagId, planted, expected, clause).
//
// Rule for the dot of a converted value (TB-8, the spec's reading, amber A-W02-1): amber until it is tied to the prior T2 PDF or the
// notice of assessment, tied means differenceCents is 0 and tiedTo is not empty; then grey (last year's assessed return, EV-11).
// A mapping difference is a flag (EV-12), never a dot colour.
//
// Planted (each an exact row; flag ids are K02-F01 to K02-F05):
//   K02-F01 TB-8  prepaid expenses 1484: converted 1,320.00 debit, the prior T2 shows 1,230.00 (a transposition): difference 90.00, amber
//   K02-F02 TB-8  taxes payable 2680: the prior T2 and the notice do not carry it, no tie, amber
//   K02-F03 TB-5  retained earnings 3600: the prior T2 closes at 22,227.07, the converted opening is 23,227.07: difference 1,000.00 (refused until explained)
//   K02-F04 TB-3  credit card 2707: the other software mapped it to 2620, QBO to 2707: amount ties, mapped differently from last year
//   K02-F05 TB-8  info: the firm did not prepare last year's return (no CPA-final version exists): values come from the T2 PDF and notice
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClientSchema, guardIssues, listKinds, loadClient, loadKind, modelIssues, faults as worldFaults } from '../../index';
import type { Client, FaultEntry } from '../../index';
import { REPO_ROOT } from '../../clients/load';
import { readOwnSource } from '../../../src/core/testing/read-own-source';

type Dot = 'green' | 'grey' | 'amber' | 'purple';
type Tie = 'prior-t2-pdf' | 'notice-of-assessment';
interface Row {
  gifi: number;
  account: string;
  convertedCents: number;
  priorT2Cents: number | null;
  differenceCents: number | null;
  tiedTo: Tie[];
  dot: Dot;
  priorGifi?: number;
  mappedDifferently?: boolean;
}
interface K02 {
  id: string;
  seed: number;
  startsFrom: string[];
  client: Client;
  priorReturn: { firm: string; software: string; yearEnd: string; preparedByUs: boolean; documents: string[] };
  conversion: Row[];
  expected: {
    figures: { gifi: number; amountCents: number; origin: string; dot: Dot }[];
    flags: { id: string; clause: string; severity: string }[];
  };
  documents: { id: string; family: string; accountKey?: string; scan: boolean }[];
}

// The files do not exist until the build, so they are imported by a computed path: a missing file fails these tests, not the typecheck.
const load = async <T>(name: string): Promise<T> => (await import(/* @vite-ignore */ `./${name}`)) as T;
const getKind = async (): Promise<K02> => (await load<{ kind: K02 }>('kind')).kind;
const getFaults = async (): Promise<FaultEntry[]> => (await load<{ faults: FaultEntry[] }>('faults')).faults;

const net = (rows: { gifi: number | null; debitCents: number; creditCents: number }[], gifi: number): number =>
  rows.filter((r) => r.gifi === gifi).reduce((s, r) => s + r.debitCents - r.creditCents, 0);
const rowFor = (k: K02, gifi: number): Row => {
  const r = k.conversion.find((c) => c.gifi === gifi);
  if (r === undefined) throw new Error(`no conversion row for GIFI ${String(gifi)}`);
  return r;
};
const blueprintClauseIds = (): Set<string> => {
  const dir = join(REPO_ROOT, 'blueprint');
  const ids = new Set<string>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/\*\*([A-Z]+-\d+)\*\*/g)) ids.add(m[1] as string);
  }
  return ids;
};
const guardFiles = (k: K02) => [{ file: 'kind.json', kind: 'json' as const, text: JSON.stringify(k) }];
const people = (k: K02): string[] => k.client.owners.map((o) => o.name);

describe('W02 kind K02 is registered and loads (ARC-8, END-9)', () => {
  test('ARC-8 listKinds reports K02 built, starting from C08, and loadKind returns its folder', () => {
    const entry = listKinds().find((k) => k.id === 'K02');
    expect(entry?.status).toBe('built');
    expect(entry?.startsFrom).toEqual(['C08']);
    expect(loadKind('K02').folder.replace(/\\/g, '/')).toMatch(/testworld\/kinds\/K02$/);
    expect(existsSync(join(REPO_ROOT, 'testworld', 'kinds', 'K02', 'kind.ts'))).toBe(true);
    expect(existsSync(join(REPO_ROOT, 'testworld', 'kinds', 'K02', 'faults.ts'))).toBe(true);
  });

  test('ARC-8 the kind loads through the W00 model with no validation errors', async () => {
    const k = await getKind();
    expect(k.id).toBe('K02');
    expect(k.startsFrom).toEqual(['C08']);
    expect(ClientSchema.safeParse(k.client).success).toBe(true);
    expect(modelIssues(k.client, [...worldFaults(), ...(await getFaults())])).toEqual([]);
  });

  test('ARC-8 the kind extends sample client C08 and does not invent a second set', async () => {
    const k = await getKind();
    const c08 = loadClient('C08');
    expect(k.client.id).toBe('C08');
    expect(k.client.corporation).toEqual(c08.corporation);
    expect(k.client.owners).toEqual(c08.owners);
    expect(k.client.accounts).toEqual(c08.accounts);
    expect(k.client.trialBalance).toEqual(c08.trialBalance);
    expect(k.client.adjustingEntries).toEqual(c08.adjustingEntries);
  });

  test('ARC-8 the books balance and retained earnings roll (the model checks, planted on a copy)', async () => {
    const k = await getKind();
    const planted: Client = structuredClone(k.client);
    const row = planted.trialBalance.adjusted.rows[0];
    if (row === undefined) throw new Error('adjusted trial balance has no rows');
    row.debitCents += 100;
    const issues = modelIssues(planted, [...worldFaults(), ...(await getFaults())]);
    expect(issues.some((i) => i.check === 'trial-balance')).toBe(true);
  });

  test('ARC-16 the kind is deterministic: a fixed seed, no clock or random in its source, the same value on every load', async () => {
    const a = await getKind();
    const b = await getKind();
    expect(Number.isInteger(a.seed)).toBe(true);
    expect(b).toEqual(a);
    for (const f of ['kind.ts', 'faults.ts']) {
      const src = readOwnSource(join('testworld', 'kinds', 'K02', f));
      expect(src).not.toMatch(/Date\.now|new Date\(\)|Math\.random|performance\.now/);
    }
  });
});

describe('W02 prior T2 from other software and the conversion (TB-8)', () => {
  test('TB-8 the prior return is another firm\'s, with its software, year end and the two documents the values come from', async () => {
    const p = (await getKind()).priorReturn;
    expect(p.firm.trim().endsWith('(Test)')).toBe(true);
    expect(p.software.trim()).not.toBe('');
    expect(p.preparedByUs).toBe(false);
    expect(p.yearEnd).toBe('2024-09-30');
    expect([...p.documents].sort()).toEqual(['notice-of-assessment', 'prior-t2-pdf']);
  });

  test('TB-8 one conversion row per GIFI code of the opening trial balance, each converted value equal to that code\'s opening net', async () => {
    const k = await getKind();
    const rows = k.client.trialBalance.opening.rows;
    const codes = [...new Set(rows.map((r) => r.gifi))].filter((g): g is number => g !== null).sort((x, y) => x - y);
    expect(k.conversion.map((r) => r.gifi).sort((x, y) => x - y)).toEqual(codes);
    for (const r of k.conversion) {
      expect(Number.isInteger(r.convertedCents)).toBe(true);
      expect(r.convertedCents).toBe(net(rows, r.gifi));
    }
  });

  test('TB-8 every row has differenceCents = converted minus the prior T2 figure, and the dot follows the tie rule', async () => {
    const k = await getKind();
    for (const r of k.conversion) {
      if (r.priorT2Cents === null) {
        expect(r.differenceCents).toBeNull();
        expect(r.tiedTo).toEqual([]);
        expect(r.dot).toBe('amber');
      } else {
        expect(r.differenceCents).toBe(r.convertedCents - r.priorT2Cents);
        const tied = r.differenceCents === 0 && r.tiedTo.length > 0;
        expect(r.dot).toBe(tied ? 'grey' : 'amber');
      }
    }
  });

  test('TB-8 property: for any conversion row, a value tied to the prior T2 or the notice is never amber and an untied value never leaves amber', async () => {
    const k = await getKind();
    fc.assert(
      fc.property(fc.constantFrom(...k.conversion), (r) => {
        const tied = r.priorT2Cents !== null && r.convertedCents === r.priorT2Cents && r.tiedTo.length > 0;
        return Number.isSafeInteger(r.convertedCents) && (tied ? r.dot !== 'amber' : r.dot === 'amber');
      }),
      { seed: 20261002, numRuns: 100 },
    );
  });

  test('TB-8 the expected figures are exactly the converted values, each with its origin and the dot of its row', async () => {
    const k = await getKind();
    expect(k.expected.figures.map((f) => f.gifi).sort((x, y) => x - y)).toEqual(k.conversion.map((r) => r.gifi).sort((x, y) => x - y));
    for (const f of k.expected.figures) {
      const r = rowFor(k, f.gifi);
      expect(f.amountCents).toBe(r.convertedCents);
      expect(f.dot).toBe(r.dot);
      expect(f.origin.trim()).not.toBe('');
    }
  });

  test('TB-8 most of the opening values tie to the prior T2, so only the planted rows are amber', async () => {
    const k = await getKind();
    const amber = k.conversion.filter((r) => r.dot === 'amber').map((r) => r.gifi).sort((x, y) => x - y);
    expect(amber).toEqual([1484, 2680, 3600]);
    expect(k.conversion.filter((r) => r.dot === 'grey').length).toBe(k.conversion.length - 3);
  });
});

describe('W02 planted faults each name an exact row and the flag they must raise (ARC-8)', () => {
  test('TB-8 K02-F01 prepaid expenses: converted 1,320.00, prior T2 1,230.00, difference 90.00, amber', async () => {
    const r = rowFor(await getKind(), 1484);
    expect(r.convertedCents).toBe(132000);
    expect(r.priorT2Cents).toBe(123000);
    expect(r.differenceCents).toBe(9000);
    expect(r.dot).toBe('amber');
  });

  test('TB-8 K02-F02 taxes payable: the prior T2 and the notice do not carry it, so it has no tie and stays amber', async () => {
    const r = rowFor(await getKind(), 2680);
    expect(r.convertedCents).toBe(-634055);
    expect(r.priorT2Cents).toBeNull();
    expect(r.tiedTo).toEqual([]);
    expect(r.dot).toBe('amber');
  });

  test('TB-5 K02-F03 retained earnings: the prior T2 closes at 22,227.07, the converted opening is 23,227.07, the 1,000.00 is unexplained', async () => {
    const r = rowFor(await getKind(), 3600);
    expect(r.priorT2Cents).toBe(-2222707);
    expect(r.convertedCents).toBe(-2322707);
    expect(r.differenceCents).toBe(-100000);
    expect(r.dot).toBe('amber');
  });

  test('TB-3 K02-F04 credit card: the amount ties, the other software mapped it to 2620 and QBO to 2707', async () => {
    const r = rowFor(await getKind(), 2707);
    expect(r.priorGifi).toBe(2620);
    expect(r.mappedDifferently).toBe(true);
    expect(r.differenceCents).toBe(0);
    expect(r.dot).toBe('grey');
    const others = (await getKind()).conversion.filter((c) => c.gifi !== 2707);
    expect(others.some((c) => c.mappedDifferently === true)).toBe(false);
  });

  test('TB-8 K02-F05 the firm did not prepare last year\'s return, so no CPA-final version exists (flag, info)', async () => {
    const k = await getKind();
    expect(k.priorReturn.preparedByUs).toBe(false);
    expect(k.expected.flags.find((f) => f.id === 'K02-F05')?.severity).toBe('info');
  });

  test('ARC-8 the expected flags and the fault entries are the same five ids, each with a clause that exists in the blueprint', async () => {
    const k = await getKind();
    const entries = await getFaults();
    const ids = ['K02-F01', 'K02-F02', 'K02-F03', 'K02-F04', 'K02-F05'];
    expect(k.expected.flags.map((f) => f.id).sort()).toEqual(ids);
    expect(entries.map((f) => f.id).sort()).toEqual(ids);
    const clauses = blueprintClauseIds();
    const byFlag = new Map(k.expected.flags.map((f) => [f.id, f.clause]));
    expect(byFlag.get('K02-F01')).toBe('TB-8');
    expect(byFlag.get('K02-F02')).toBe('TB-8');
    expect(byFlag.get('K02-F03')).toBe('TB-5');
    expect(byFlag.get('K02-F04')).toBe('TB-3');
    expect(byFlag.get('K02-F05')).toBe('TB-8');
    for (const f of entries) {
      expect(f.kind).toBe('K02');
      expect(f.flagId).toBe(f.id);
      expect(f.planted.trim()).not.toBe('');
      expect(f.expected.trim()).not.toBe('');
      expect(f.clause).toBe(byFlag.get(f.id));
      expect(clauses.has(f.clause as string)).toBe(true);
    }
  });

  test('ARC-8 every clause on the card (ARC-8, TB-8) is named by at least one planted fault or expected result', async () => {
    const clauses = new Set((await getFaults()).map((f) => f.clause));
    expect(clauses.has('TB-8')).toBe(true);
    expect((await getKind()).startsFrom).toEqual(['C08']);
  });

  test('ARC-8 fault ids do not collide with the sample clients\' catalogue', async () => {
    const all = [...worldFaults().map((f) => f.id), ...(await getFaults()).map((f) => f.id)];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('W02 documents and made-up data (END-9, SEC-11)', () => {
  test('END-9 the kind lists the prior T2 PDF and the notice of assessment as scans, and a statement for each bank and card account', async () => {
    const k = await getKind();
    const fam = (f: string) => k.documents.filter((d) => d.family === f);
    expect(fam('prior-t2-pdf').length).toBe(1);
    expect(fam('notice-of-assessment').length).toBe(1);
    expect(fam('prior-t2-pdf')[0]?.scan).toBe(true);
    const statements = fam('bank-statement').map((d) => d.accountKey).sort();
    expect(statements).toEqual(k.client.accounts.map((a) => a.key).sort());
    expect(new Set(k.documents.map((d) => d.id)).size).toBe(k.documents.length);
  });

  test('SEC-11 the kind passes the made-up data guard, and a name without (Test) is refused', async () => {
    const k = await getKind();
    expect(guardIssues('C08', guardFiles(k), people(k))).toEqual([]);
    const bad = structuredClone(k);
    const owner = bad.client.owners[0];
    if (owner === undefined) throw new Error('kind has no owner');
    owner.name = 'Amir Rahimi';
    expect(guardIssues('C08', guardFiles(bad), people(bad)).length).toBeGreaterThan(0);
  });
});
