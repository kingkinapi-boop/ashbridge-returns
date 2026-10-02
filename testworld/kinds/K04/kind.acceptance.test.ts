// W04 acceptance tests: test world kind K04, bank statements only (END-9, ARC-8, TB-4).
//
// Public API this file fixes (the card leaves the module shape open; amber A-W04-1):
//
// testworld/kinds/K04/kind.ts
//   export const kind: {
//     id: 'K04'
//     startsFrom: ['C02']                          the sample client blueprint 00 names for K4
//     seed: number                                 the fixed seed (no clock, no random)
//     client: Client                               Halton Haulage's books as the QBO stand-in serves them, in the W00 model
//                                                  shape (ClientSchema-valid, id 'C02', flags exactly C02's own flags)
//     documents: Array<{ family: 'bank-statement' | 'card-statement'; accountKey: string; months: string[] }>
//                                                  the documents this kind has, by family; statements only, one per account
//                                                  covering every month (YYYY-MM) of the fiscal year
//     qboTransactions: Array<{ id; accountKey; date (YYYY-MM-DD); amountCents }>      the firm's bank and card lines in QBO
//     statementLines:  Array<{ id; accountKey; date (YYYY-MM-DD); amountCents }>      the lines the statements show
//     expectedFlags: Array<{ id: 'K04-F01'...; rule: string; clause: 'TB-4'; unmatchedQbo: string[]; unmatchedStatement: string[] }>
//                                                  each planted fault, with the ids of the lines it leaves unmatched
//     expected: {
//       adjustedTrialBalance: Client['trialBalance']['adjusted']   what the books say once the faults are read
//       coverage: Record<string, string[]>         clause id -> the ids ('trialBalance', 'documents' or an expectedFlags id)
//                                                  that name it; ARC-8 and TB-4 are both present and non-empty
//     }
//   }
//   Money is integer cents (ARC-13). Every id is unique within its list.
//
// testworld/kinds/K04/faults.ts
//   export const faults: FaultEntry[]              K04-F01 to K04-F05, each { id, kind: 'K04', flagId, planted, expected, clause: 'TB-4' }
//                                                  faults() in testworld/model/faults.ts is NOT changed by this card (amber A-W04-2: W00's
//                                                  unit tests pin it at 107 entries, one per sample-client flag; adding 13 kinds' entries
//                                                  there is a Lead decision, e.g. a later kindFaults()). K04 ids never collide with it.
//
// TB-4 matching used here (the test's own reference, written independently of any product code): one QBO line matches
// one statement line when account, date and amount are all equal, one to one; what is left over on either side is
// unmatched. Planted faults (each also a flag the later matcher must raise):
//   K04-F01 a QBO transaction with no statement line                      1 unmatched QBO
//   K04-F02 a statement line the firm never booked                        1 unmatched statement
//   K04-F03 amount differs by cents between QBO and the statement          1 unmatched QBO + 1 unmatched statement
//   K04-F04 date differs between QBO and the statement                     1 unmatched QBO + 1 unmatched statement
//   K04-F05 two identical statement lines the same day, QBO booked one     1 unmatched statement
//   so the kind has 3 unmatched QBO lines and 4 unmatched statement lines in all.
import { describe, expect, test, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { faults as allFaults, listKinds, loadClient, loadKind, ClientSchema, modelIssues, passesCheckDigit } from '../../index';
import { REPO_ROOT } from '../../__fixtures__/sample-copy';

interface Line {
  id: string;
  accountKey: string;
  date: string;
  amountCents: number;
}
interface Flag {
  id: string;
  rule: string;
  clause: string;
  unmatchedQbo: string[];
  unmatchedStatement: string[];
}
interface Tb {
  rows: { account: string; gifi: number | null; debitCents: number; creditCents: number }[];
  totalDebitCents: number;
  totalCreditCents: number;
}
interface K04 {
  id: string;
  startsFrom: string[];
  seed: number;
  client: {
    id: string;
    corporation: { name: string; businessNumber: string };
    flags: { id: string }[];
    accounts: { key: string }[];
    trialBalance: { adjusted: Tb };
  };
  documents: { family: string; accountKey: string; months: string[] }[];
  qboTransactions: Line[];
  statementLines: Line[];
  expectedFlags: Flag[];
  expected: { adjustedTrialBalance: Tb; coverage: Record<string, string[]> };
}
interface FaultView {
  id: string;
  kind?: string;
  flagId?: string;
  planted: string;
  expected: string;
  clause?: string;
}

async function loadK04(): Promise<K04> {
  const mod = (await import('./kind')) as { kind: K04 };
  return mod.kind;
}
async function loadK04Faults(): Promise<FaultView[]> {
  const mod = (await import('./faults')) as { faults: FaultView[] };
  return mod.faults;
}

const FLAG_IDS = ['K04-F01', 'K04-F02', 'K04-F03', 'K04-F04', 'K04-F05'];
const MONTHS = [
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
];

const keyOf = (l: Line): string => `${l.accountKey}|${l.date}|${String(l.amountCents)}`;

/** The test's own TB-4 reference matcher: account, date and amount equal, one to one. */
function reference(qbo: Line[], stmt: Line[]): { unmatchedQbo: string[]; unmatchedStatement: string[]; matched: number } {
  const pool = new Map<string, string[]>();
  for (const s of stmt) pool.set(keyOf(s), [...(pool.get(keyOf(s)) ?? []), s.id]);
  const unmatchedQbo: string[] = [];
  let matched = 0;
  for (const q of qbo) {
    const ids = pool.get(keyOf(q));
    if (ids !== undefined && ids.length > 0) {
      ids.shift();
      matched++;
    } else unmatchedQbo.push(q.id);
  }
  const unmatchedStatement = [...pool.values()].flat();
  return { unmatchedQbo: unmatchedQbo.sort(), unmatchedStatement: unmatchedStatement.sort(), matched };
}

describe('W04 K04 bank statements only: loads and balances (card checks 1 and 2)', () => {
  test('END-9 K04 reports built once its folder exists, and loadKind returns it', () => {
    for (const f of ['kind.ts', 'faults.ts']) expect(existsSync(join(REPO_ROOT, 'testworld', 'kinds', 'K04', f))).toBe(true);
    const entry = listKinds().find((k) => k.id === 'K04');
    expect(entry?.status).toBe('built');
    expect(entry?.startsFrom).toEqual(['C02']);
    expect(loadKind('K04').id).toBe('K04');
  });

  test('ARC-8 the kind starts from sample client 02 and its client passes the W00 schema and every model check', async () => {
    const k = await loadK04();
    expect(k.id).toBe('K04');
    expect(k.startsFrom).toEqual(['C02']);
    expect(ClientSchema.safeParse(k.client).success).toBe(true);
    expect(modelIssues(k.client as never, allFaults())).toEqual([]);
    expect(k.client.flags.map((f) => f.id)).toEqual(loadClient('C02').flags.map((f) => f.id));
  });

  test('ARC-8 the books balance: adjusted debits equal credits and the trial balance equals sample client 02', async () => {
    const k = await loadK04();
    const tb = k.expected.adjustedTrialBalance;
    expect(tb.totalDebitCents).toBe(tb.totalCreditCents);
    expect(tb.rows.reduce((s, r) => s + r.debitCents, 0)).toBe(tb.totalDebitCents);
    expect(tb.rows.reduce((s, r) => s + r.creditCents, 0)).toBe(tb.totalCreditCents);
    expect(tb).toEqual(loadClient('C02').trialBalance.adjusted);
    expect(k.client.trialBalance.adjusted).toEqual(tb);
  });

  test('ARC-16 loading the kind twice gives deep-equal results and the seed is fixed', async () => {
    const a = await loadK04();
    vi.resetModules();
    const b = await loadK04();
    expect(b).toEqual(a);
    expect(Number.isInteger(a.seed)).toBe(true);
  });
});

describe('W04 K04 documents: bank statements only (END-9)', () => {
  test('END-9 the documents are bank and card statements only, one per account, covering every month of the year', async () => {
    const k = await loadK04();
    expect(k.documents.length).toBe(2);
    for (const d of k.documents) {
      expect(['bank-statement', 'card-statement']).toContain(d.family);
      expect(d.months).toEqual(MONTHS);
    }
    expect(k.documents.map((d) => `${d.accountKey}:${d.family}`).sort()).toEqual(['BCD:card-statement', 'CHQ:bank-statement']);
    expect(k.documents.map((d) => d.accountKey).sort()).toEqual(k.client.accounts.map((a) => a.key).sort());
  });
});

describe('W04 K04 TB-4 matching: expected results and planted faults (card check 3)', () => {
  test('TB-4 every line has a unique id, a known account, a valid date and integer cents', async () => {
    const k = await loadK04();
    const keys = new Set(k.client.accounts.map((a) => a.key));
    for (const list of [k.qboTransactions, k.statementLines]) {
      expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
      for (const l of list) {
        expect(keys.has(l.accountKey)).toBe(true);
        expect(l.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isInteger(l.amountCents)).toBe(true);
      }
    }
    expect(k.qboTransactions.length).toBeGreaterThan(800);
    expect(k.statementLines.length).toBeGreaterThan(800);
  });

  test('TB-4 the independent reference matcher leaves exactly the lines the planted faults name, 3 in QBO and 4 on statements', async () => {
    const k = await loadK04();
    const r = reference(k.qboTransactions, k.statementLines);
    expect(r.unmatchedQbo).toEqual(k.expectedFlags.flatMap((f) => f.unmatchedQbo).sort());
    expect(r.unmatchedStatement).toEqual(k.expectedFlags.flatMap((f) => f.unmatchedStatement).sort());
    expect(r.unmatchedQbo.length).toBe(3);
    expect(r.unmatchedStatement.length).toBe(4);
    expect(r.matched + r.unmatchedQbo.length).toBe(k.qboTransactions.length);
    expect(r.matched + r.unmatchedStatement.length).toBe(k.statementLines.length);
  });

  test('TB-4 the five planted faults K04-F01 to K04-F05 each leave the unmatched lines their description says', async () => {
    const k = await loadK04();
    expect(k.expectedFlags.map((f) => f.id)).toEqual(FLAG_IDS);
    const counts = Object.fromEntries(k.expectedFlags.map((f) => [f.id, [f.unmatchedQbo.length, f.unmatchedStatement.length]]));
    expect(counts).toEqual({ 'K04-F01': [1, 0], 'K04-F02': [0, 1], 'K04-F03': [1, 1], 'K04-F04': [1, 1], 'K04-F05': [0, 1] });
    for (const f of k.expectedFlags) {
      expect(f.clause).toBe('TB-4');
      expect(f.rule.length).toBeGreaterThan(0);
    }
    const byId = new Map<string, Line>([...k.qboTransactions, ...k.statementLines].map((l) => [l.id, l]));
    // F03: same account and date, amount off by cents (more than zero, under a hundred dollars).
    const q3 = byId.get(k.expectedFlags[2].unmatchedQbo[0]);
    const s3 = byId.get(k.expectedFlags[2].unmatchedStatement[0]);
    expect([q3?.accountKey, q3?.date]).toEqual([s3?.accountKey, s3?.date]);
    const gap = Math.abs((q3?.amountCents ?? 0) - (s3?.amountCents ?? 0));
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(10000);
    // F04: same account and amount, different date.
    const q4 = byId.get(k.expectedFlags[3].unmatchedQbo[0]);
    const s4 = byId.get(k.expectedFlags[3].unmatchedStatement[0]);
    expect([q4?.accountKey, q4?.amountCents]).toEqual([s4?.accountKey, s4?.amountCents]);
    expect(q4?.date).not.toBe(s4?.date);
    // F05: two identical statement lines, one QBO line.
    const dup = byId.get(k.expectedFlags[4].unmatchedStatement[0]);
    expect(dup).toBeDefined();
    const same = (l: Line): boolean => dup !== undefined && keyOf(l) === keyOf(dup);
    expect(k.statementLines.filter(same).length).toBe(2);
    expect(k.qboTransactions.filter(same).length).toBe(1);
  });

  test('TB-4 a planted fault is caught: drop one matched QBO line and the reference matcher no longer agrees with the expected lists', async () => {
    const k = await loadK04();
    const unmatched = new Set(k.expectedFlags.flatMap((f) => f.unmatchedQbo));
    const victim = k.qboTransactions.find((q) => !unmatched.has(q.id));
    expect(victim).toBeDefined();
    const r = reference(
      k.qboTransactions.filter((q) => q.id !== victim?.id),
      k.statementLines,
    );
    expect(r.unmatchedStatement).not.toEqual(k.expectedFlags.flatMap((f) => f.unmatchedStatement).sort());
  });

  test('TB-4 a fault-free copy matches completely: identical lines on both sides leave nothing unmatched', async () => {
    const k = await loadK04();
    const r = reference(k.statementLines, k.statementLines);
    expect(r.unmatchedQbo).toEqual([]);
    expect(r.unmatchedStatement).toEqual([]);
  });
});

describe('W04 K04 fault catalogue (card check 3, ARC-8)', () => {
  test('ARC-8 faults.ts lists K04-F01 to K04-F05 with kind K04, clause TB-4, a planted text and an exact expected result', async () => {
    const list = await loadK04Faults();
    expect(list.map((f) => f.id)).toEqual(FLAG_IDS);
    for (const f of list) {
      expect(f.kind).toBe('K04');
      expect(f.flagId).toBe(f.id);
      expect(f.clause).toBe('TB-4');
      expect(f.planted.length).toBeGreaterThan(0);
      expect(f.expected).toContain(f.id);
    }
  });

  test('ARC-8 K04 fault ids do not collide with the W00 catalogue and match the expectedFlags entries', async () => {
    const k = await loadK04();
    const list = await loadK04Faults();
    expect(list.map((f) => f.flagId)).toEqual(k.expectedFlags.map((f) => f.id));
    const taken = new Set(allFaults().map((f) => f.id));
    for (const f of list) expect(taken.has(f.id)).toBe(false);
    expect(allFaults().filter((f) => f.client === 'C02').length).toBeGreaterThan(0);
  });

  test('ARC-8 every clause on the card (ARC-8, TB-4) is named by at least one existing expected result', async () => {
    const k = await loadK04();
    const known = new Set(['trialBalance', 'documents', ...k.expectedFlags.map((f) => f.id)]);
    for (const clause of ['ARC-8', 'TB-4']) {
      const ids = k.expected.coverage[clause];
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(known.has(id)).toBe(true);
    }
    expect(k.expected.coverage['TB-4']).toEqual(FLAG_IDS);
  });
});

describe('W04 K04 made-up data only (card check 4, SEC-11)', () => {
  test('SEC-11 the corporation name ends in (Test), the business number fails its check digit, and no e-mail or phone appears', async () => {
    const k = await loadK04();
    expect(k.client.corporation.name.endsWith('(Test)')).toBe(true);
    const nine = /\d{9}/.exec(k.client.corporation.businessNumber.replace(/[\s-]/g, ''));
    expect(nine).not.toBeNull();
    expect(passesCheckDigit(nine?.[0] ?? '')).toBe(false);
    const text = JSON.stringify(k);
    expect(text).not.toContain('@');
    expect(text).not.toMatch(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/);
  });
});
