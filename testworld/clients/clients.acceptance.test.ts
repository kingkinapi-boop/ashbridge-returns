// W00 acceptance tests: every sample client loaded through the model (ARC-8, ARC-13, ARC-16, SEC-11).
//
// Public API this file fixes:
//
// testworld/index.ts
//   loadClient(id: ClientId, opts?: { root?: string }): Client | Promise<Client>
//     ClientId is 'C01' upward, one per numbered folder (C01 to C15 today). root is the sample-clients folder
//     (default reference/sample-clients/); the client is read from <root>/<NN-name>/ (answer-key.json,
//     onboarding.json, profile.md, accounts/*.csv, qbo/*.csv) in place, never copied or rewritten. The tests
//     always await the result, so the loader may be sync or async. A client that fails any model check or the
//     made-up-data guard is refused: the call throws (or rejects with) a TestWorldLoadError.
//
// testworld/model (testworld/model/index.ts)
//   class TestWorldLoadError extends Error { issues: LoadIssue[] }   message names the client id
//   type LoadIssue = { client: ClientId; check: LoadCheck; record: string; reason: string }   (reason non-empty)
//   type LoadCheck =
//     | 'schema'               the file does not fit the zod schema
//     | 'nets-to-zero'         an adjusting entry's debits differ from its credits      record: the entry id ("01-AJE-01")
//     | 'trial-balance'        a trial balance's debits differ from its credits         record: names the balance ("adjusted")
//     | 'roll'                 an account's month does not roll and no planted fault says so
//                                                                                       record: "<account key> <YYYY-MM>" ("CHQ 2025-03")
//     | 'transaction-account'  a transaction has a blank account                       record: the transaction id
//     | 'gifi'                 a GIFI code that is not four digits                      record: names the GL account ("1010")
//     | 'adjusting-entry'      an adjusting entry without a type, a reason or a source  record: the entry id
//     | 'made-up-data'         the SEC-11 guard: a name without "(Test)" (reason contains "(Test)"), a business
//                              number or SIN that passes its check digit (reason contains "check digit"), an e-mail
//                              outside a reserved test domain (reason contains "e-mail"), a phone number outside
//                              555-0100 to 555-0199 (reason contains "phone")
//   ClientSchema: zod schema; ClientSchema.safeParse(loadedClient).success is true.
//   Client (the fields these tests read; the builder may add more):
//     id: ClientId
//     corporation: { name: string; businessNumber: string; yearStart: string; yearEnd: string }   dates YYYY-MM-DD
//     accounts: Array<{ key: string; glAccount: string; months: Array<{ month: string; openingCents: number;
//                        closingCents: number; rolls: boolean }> }>          (empty for a client with no account files: 12)
//     transactions: Array<{ id: string; accountKey: string; date: string; amountCents: number; glAccount: string;
//                           postings: Array<{ account: string; debitCents: number; creditCents: number }> }>
//                   every answer-key transaction, including those missing from the export
//     adjustingEntries: Array<{ id: string; type: string; reason: string; sources: string[];
//                               lines: Array<{ account: string; gifi: number | null; debitCents: number; creditCents: number }> }>
//     trialBalance: Record<'opening' | 'unadjusted' | 'adjusted', { rows: Array<{ account: string; gifi: number | null;
//                   debitCents: number; creditCents: number }>; totalDebitCents: number; totalCreditCents: number }>
//     flags: Array<{ id: string; rule: string }>
//     priorYear: the answer key's prior_year block when it has one (11, 15), otherwise null or absent
//   Money is integer cents everywhere (ARC-13).
//
// The fault that lets a month not roll is read from the client's own data: the answer key's statement
// balance for that month says rolls: false (C10's March duplicates and missing May). Flip it to true and
// the loader must refuse the client.
import { afterAll, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadClient, faults } from '../index';
import { ClientSchema, TestWorldLoadError } from '../model/index';
import {
  CLIENT_IDS,
  FOLDERS,
  SAMPLE_ROOT,
  copySamples,
  editKey,
  editOnboarding,
  editText,
  luhnValid,
  rawCents,
  readKey,
  readOnboarding,
  removeCopies,
  type FixtureClientId,
} from '../__fixtures__/sample-copy';

afterAll(() => {
  removeCopies();
});

// From the README table "The clients" (company, year end, number of accounts) and the 09 first-year start.
const README: Record<FixtureClientId, { name: string; yearStart: string; yearEnd: string; accounts: number }> = {
  C01: { name: 'Maple Ridge Consulting Inc. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 3 },
  C02: { name: 'Halton Haulage Ltd. (Test)', yearStart: '2025-04-01', yearEnd: '2026-03-31', accounts: 2 },
  C03: { name: 'Bluewater Renovations Inc. (Test)', yearStart: '2024-07-01', yearEnd: '2025-06-30', accounts: 2 },
  C04: { name: 'Lakeshore Eats Inc. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 2 },
  C05: { name: 'Eglinton Holdings Inc. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 2 },
  C06: { name: 'Eglinton Retail Ltd. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 3 },
  C07: { name: 'Riverdale Rentals Inc. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 1 },
  C08: { name: 'Queen West Design Studio Inc. (Test)', yearStart: '2024-10-01', yearEnd: '2025-09-30', accounts: 4 },
  C09: { name: 'Scarborough Robotics Labs Inc. (Test)', yearStart: '2025-04-15', yearEnd: '2025-12-31', accounts: 2 },
  C10: { name: 'Danforth Cleaning Co. Ltd. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 2 },
  // W14 and W15 (card Build and fix round 1: folders 11 to 15 load with no change to the loader; 12 has no account files).
  C11: { name: 'Humber Bay Software Ltd. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 2 },
  C12: { name: 'Kensington Market Crafts Inc. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 0 },
  C13: { name: 'Sharma Medicine Professional Corporation (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 2 },
  C14: { name: 'Rouge Valley Landscaping Inc. (Test)', yearStart: '2024-01-01', yearEnd: '2024-12-31', accounts: 2 },
  C15: { name: 'Rouge Valley Landscaping Inc. (Test)', yearStart: '2025-01-01', yearEnd: '2025-12-31', accounts: 2 },
};

// The fields of a loaded client these tests read (the shape in the header above).
interface Amounts {
  debitCents: number;
  creditCents: number;
}
interface TbRow extends Amounts {
  account: string;
  gifi: number | null;
}
interface Tb {
  rows: TbRow[];
  totalDebitCents: number;
  totalCreditCents: number;
}
interface LoadedClient {
  id: string;
  corporation: { name: string; businessNumber: string; yearStart: string; yearEnd: string };
  accounts: { key: string; glAccount: string; months: { month: string; openingCents: number; closingCents: number; rolls: boolean }[] }[];
  transactions: { id: string; accountKey: string; date: string; amountCents: number; glAccount: string; postings: (Amounts & { account: string })[] }[];
  adjustingEntries: { id: string; type: string; reason: string; sources: string[]; lines: TbRow[] }[];
  trialBalance: Record<'opening' | 'unadjusted' | 'adjusted', Tb>;
  flags: { id: string; rule: string }[];
  priorYear?: unknown;
}
interface FaultView {
  client?: string;
  flagId?: string;
}
type Issue = { client: string; check: string; record: string; reason: string };

/** Loads through the public loader (sync or async) and reads the result through the fields above. */
async function load(id: FixtureClientId, root?: string): Promise<LoadedClient> {
  const c: unknown = await Promise.resolve(root === undefined ? loadClient(id) : loadClient(id, { root }));
  return c as LoadedClient;
}

/** Fixture guard: the value the test needs is there. */
function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`fixture: ${what} not found`);
  return v;
}

/** Expects the loader to refuse the client; returns the issues it gave. */
async function refusal(id: FixtureClientId, root: string): Promise<Issue[]> {
  let caught: unknown;
  try {
    await Promise.resolve(loadClient(id, { root }));
  } catch (e) {
    caught = e;
  }
  expect(caught, `${id} should have been refused`).toBeInstanceOf(TestWorldLoadError);
  const err = caught as { message: string; issues: unknown };
  expect(err.message).toContain(id);
  expect(Array.isArray(err.issues)).toBe(true);
  const issues = err.issues as Issue[];
  expect(issues.length).toBeGreaterThan(0);
  for (const i of issues) {
    expect(i.client).toBe(id);
    expect(typeof i.record).toBe('string');
    expect(i.reason.trim().length).toBeGreaterThan(0);
  }
  return issues;
}

const issue = (check: string, client: string, ...recordParts: string[]): unknown =>
  expect.objectContaining({
    client,
    check,
    record: expect.stringMatching(new RegExp(recordParts.map((p) => `(?=.*${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join(''))) as unknown,
  });

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

describe('W00 sample clients load (card check 1)', () => {
  test.each(CLIENT_IDS)('ARC-8 %s loads with no validation errors and matches the README table', async (id) => {
    const c = await load(id);
    expect(ClientSchema.safeParse(c).success).toBe(true);
    expect(c.id).toBe(id);
    expect(c.corporation.name).toBe(README[id].name);
    expect(c.corporation.yearStart).toBe(README[id].yearStart);
    expect(c.corporation.yearEnd).toBe(README[id].yearEnd);
    expect(c.accounts).toHaveLength(README[id].accounts);
  });

  test.each(CLIENT_IDS)('ARC-8 %s is read in place: every answer-key transaction and account is in the model', async (id) => {
    const c = await load(id);
    const key = readKey(SAMPLE_ROOT, id);
    expect(c.accounts.map((a) => a.key)).toEqual(key.accounts.map((a) => a.key));
    expect(c.transactions.map((t) => t.id)).toEqual(key.transactions.map((t) => t.id));
    expect(c.adjustingEntries.map((j) => j.id)).toEqual(key.adjustingEntries.map((j) => j.id));
    expect(c.flags.map((f) => f.id)).toEqual(key.flags.map((f) => f.id));
  });

  test.each(CLIENT_IDS)("ARC-8 %s: an answer key's prior_year block loads when present, and only then", async (id) => {
    const c = await load(id);
    const key = readKey(SAMPLE_ROOT, id);
    expect(c.priorYear !== undefined && c.priorYear !== null).toBe(key.prior_year !== undefined);
  });
});

describe('W00 the books in cents (card check 3)', () => {
  test.each(CLIENT_IDS)('ARC-13 %s: every amount is a safe integer of cents and equals the answer key', async (id) => {
    const c = await load(id);
    const key = readKey(SAMPLE_ROOT, id);
    const byId = new Map(key.transactions.map((t) => [t.id, t]));
    for (const t of c.transactions) {
      expect(Number.isSafeInteger(t.amountCents)).toBe(true);
      expect(t.amountCents).toBe(rawCents(byId.get(t.id)?.amount));
      for (const p of t.postings) {
        expect(Number.isSafeInteger(p.debitCents) && Number.isSafeInteger(p.creditCents)).toBe(true);
      }
    }
    for (const nm of ['opening', 'unadjusted', 'adjusted'] as const) {
      const rows = c.trialBalance[nm].rows;
      expect(rows.map((r) => [r.account, r.debitCents, r.creditCents])).toEqual(
        key.trialBalance[nm].rows.map((r) => [r.account, rawCents(r.debit), rawCents(r.credit)]),
      );
    }
  });

  test.each(CLIENT_IDS)('ARC-13 %s: the adjusted trial balance debits equal its credits in cents', async (id) => {
    const c = await load(id);
    for (const nm of ['opening', 'unadjusted', 'adjusted'] as const) {
      const tb = c.trialBalance[nm];
      const dr = sum(tb.rows.map((r) => r.debitCents));
      const cr = sum(tb.rows.map((r) => r.creditCents));
      expect(dr, `${id} ${nm}`).toBe(cr);
      expect(tb.totalDebitCents).toBe(dr);
      expect(tb.totalCreditCents).toBe(cr);
    }
  });

  test.each(CLIENT_IDS)('ARC-13 %s: every adjusting entry nets to zero and has a type, a reason and a source', async (id) => {
    const c = await load(id);
    const key = readKey(SAMPLE_ROOT, id);
    expect(c.adjustingEntries).toHaveLength(key.adjustingEntries.length);
    for (const j of c.adjustingEntries) {
      const dr = sum(j.lines.map((l) => l.debitCents));
      const cr = sum(j.lines.map((l) => l.creditCents));
      expect(dr, j.id).toBe(cr);
      expect(j.type.trim().length).toBeGreaterThan(0);
      expect(j.reason.trim().length).toBeGreaterThan(0);
      expect(j.sources.length).toBeGreaterThan(0);
    }
  });

  test.each(CLIENT_IDS)(
    'ARC-13 %s: opening balance plus every posting plus the adjusting entries equals each adjusted trial balance line',
    async (id) => {
      const c = await load(id);
      const net = new Map<string, number>();
      const bump = (a: string, v: number): void => {
        net.set(a, (net.get(a) ?? 0) + v);
      };
      for (const r of c.trialBalance.opening.rows) bump(r.account, r.debitCents - r.creditCents);
      for (const t of c.transactions) for (const p of t.postings) bump(p.account, p.debitCents - p.creditCents);
      for (const j of c.adjustingEntries) for (const l of j.lines) bump(l.account, l.debitCents - l.creditCents);
      const adjusted = new Map<string, number>(c.trialBalance.adjusted.rows.map((r) => [r.account, r.debitCents - r.creditCents]));
      const accounts = new Set([...net.keys(), ...adjusted.keys()]);
      const off = [...accounts].filter((a) => (net.get(a) ?? 0) !== (adjusted.get(a) ?? 0));
      expect(off).toEqual([]);
      expect(accounts.size).toBeGreaterThan(0);
    },
  );
});

describe('W00 the roll check (card check 4)', () => {
  test('ARC-8 C04 with one March chequing transaction removed fails the roll check for CHQ 2025-03 with the reason', async () => {
    const root = copySamples();
    const key = readKey(root, 'C04');
    const chq = must(
      key.accounts.find((a) => a.key === 'CHQ'),
      'C04 chequing account',
    );
    const victim = key.transactions.find((t) => t.acct === 'CHQ' && t.date.startsWith('2025-03') && (t.line ?? 0) > 0 && !t.pair);
    expect(victim, 'fixture: a March chequing transaction to remove').toBeTruthy();
    const v = must(victim, 'a March chequing transaction');
    const dropLine =
      (n: number) =>
      (t: string): string => {
        const lines = t.split('\n');
        lines.splice(n - 1, 1);
        return lines.join('\n');
      };
    // The same row leaves the bank export, the QBO export and the answer key.
    editText(root, 'C04', must(chq.file, 'C04 chequing file'), dropLine(must(v.line, 'victim line')));
    editText(root, 'C04', must(chq.qboFile, 'C04 chequing QBO file'), dropLine(must(v.qboLine, 'victim QBO line')));
    editKey(root, 'C04', (j) => {
      j.transactions = j.transactions.filter((t) => t.id !== v.id);
    });
    const issues = await refusal('C04', root);
    expect(issues).toEqual(expect.arrayContaining([issue('roll', 'C04', 'CHQ', '2025-03')]));
    const rolls = issues.filter((i) => i.check === 'roll');
    expect(rolls.every((i) => i.record.includes('CHQ') && i.record.includes('2025-03'))).toBe(true);
  });

  test('ARC-8 C10 loads although March and May do not roll, because both are planted faults it lists', async () => {
    const c = await load('C10');
    const chq = must(
      c.accounts.find((a) => a.key === 'CHQ'),
      'C10 chequing account in the model',
    );
    const notRolling = chq.months.filter((m) => !m.rolls).map((m) => m.month);
    expect(notRolling).toEqual(['2025-03', '2025-05']);
    const may = must(
      chq.months.find((m) => m.month === '2025-05'),
      'C10 May in the model',
    );
    expect([may.openingCents, may.closingCents]).toEqual([2604901, 4291566]);
    const listedFaults: unknown = await Promise.resolve(faults());
    const all = listedFaults as FaultView[];
    const listed = all.filter((f) => f.client === 'C10').map((f) => f.flagId);
    expect(listed).toEqual(expect.arrayContaining(['10-F01']));
  });

  test('ARC-8 C10 with the missing May no longer listed as a planted fault is refused for CHQ 2025-05', async () => {
    const root = copySamples();
    editKey(root, 'C10', (j) => {
      const m = must(
        j.statementBalances['CHQ']?.find((s) => s.month === '2025-05'),
        'C10 May statement balance',
      );
      m.rolls = true;
      delete m.note;
    });
    const issues = await refusal('C10', root);
    expect(issues).toEqual(expect.arrayContaining([issue('roll', 'C10', 'CHQ', '2025-05')]));
  });

  test.each(CLIENT_IDS.filter((id) => id !== 'C10'))('ARC-8 %s has no planted roll fault: every month of every account rolls', async (id) => {
    const c = await load(id);
    const bad = c.accounts.flatMap((a) => a.months.filter((m) => !m.rolls).map((m) => `${a.key} ${m.month}`));
    expect(bad).toEqual([]);
  });
});

describe('W00 each model check catches its planted fault', () => {
  test('ARC-8 an adjusting entry off by one cent is refused as not netting to zero', async () => {
    const root = copySamples();
    editKey(root, 'C01', (j) => {
      const l = must(j.adjustingEntries[0]?.lines[0], 'C01 first adjusting entry line');
      l.debit = Math.round(l.debit * 100 + 1) / 100;
    });
    expect(await refusal('C01', root)).toEqual(expect.arrayContaining([issue('nets-to-zero', 'C01', '01-AJE-01')]));
  });

  test('ARC-8 an adjusted trial balance off by one cent is refused', async () => {
    const root = copySamples();
    editKey(root, 'C01', (j) => {
      const r = must(
        j.trialBalance.adjusted.rows.find((x) => x.debit > 0),
        'C01 adjusted debit row',
      );
      r.debit = Math.round(r.debit * 100 + 1) / 100;
    });
    expect(await refusal('C01', root)).toEqual(expect.arrayContaining([issue('trial-balance', 'C01', 'adjusted')]));
  });

  test('ARC-8 a transaction with no account is refused, naming the transaction', async () => {
    const root = copySamples();
    editKey(root, 'C01', (j) => {
      const t = must(j.transactions[0], 'C01 first transaction');
      t.account = '';
      t.accountNo = '';
    });
    expect(await refusal('C01', root)).toEqual(expect.arrayContaining([issue('transaction-account', 'C01', '01-CHQ-2025-01-0001')]));
  });

  test('ARC-8 a GIFI code that is not four digits is refused, naming the account', async () => {
    const root = copySamples();
    editKey(root, 'C01', (j) => {
      const r = must(
        j.trialBalance.adjusted.rows.find((x) => x.account === '1010'),
        'C01 adjusted 1010 row',
      );
      r.gifi = 100;
    });
    expect(await refusal('C01', root)).toEqual(expect.arrayContaining([issue('gifi', 'C01', '1010')]));
  });

  test('ARC-8 an adjusting entry with no reason is refused', async () => {
    const root = copySamples();
    editKey(root, 'C01', (j) => {
      must(j.adjustingEntries[0], 'C01 first adjusting entry').reason = '';
    });
    expect(await refusal('C01', root)).toEqual(expect.arrayContaining([issue('adjusting-entry', 'C01', '01-AJE-01')]));
  });

  test('ARC-8 an adjusting entry with no source is refused', async () => {
    const root = copySamples();
    editKey(root, 'C01', (j) => {
      must(j.adjustingEntries[0], 'C01 first adjusting entry').source = { transactions: [], onboarding: [] };
    });
    expect(await refusal('C01', root)).toEqual(expect.arrayContaining([issue('adjusting-entry', 'C01', '01-AJE-01')]));
  });
});

describe('W00 made-up data guard (card check 5)', () => {
  test.each(CLIENT_IDS)('SEC-11 %s passes the made-up data guard', async (id) => {
    const c = await load(id);
    expect(c.corporation.name.endsWith('(Test)')).toBe(true);
    expect(luhnValid(c.corporation.businessNumber)).toBe(false);
  });

  test('SEC-11 an owner name without "(Test)" is refused with the reason', async () => {
    const root = copySamples();
    editOnboarding(root, 'C01', (j) => {
      must(j.owners[0], 'C01 owner').name = 'Priya Nair';
    });
    const issues = await refusal('C01', root);
    const guard = issues.filter((i) => i.check === 'made-up-data');
    expect(guard.length).toBeGreaterThan(0);
    expect(guard.some((i) => i.reason.includes('(Test)') && `${i.record} ${i.reason}`.includes('Priya Nair'))).toBe(true);
  });

  test('SEC-11 a business number that passes its check digit is refused with the reason', async () => {
    const root = copySamples();
    const onb = readOnboarding(root, 'C01');
    const bn: string = onb.corporation.business_number;
    expect(luhnValid(bn), 'fixture: the sample BN fails its check digit').toBe(false);
    const valid = must(
      Array.from({ length: 10 }, (_, d) => bn.slice(0, 8) + String(d)).find((x) => luhnValid(x)),
      'a business number that passes its check digit',
    );
    editOnboarding(root, 'C01', (j) => {
      j.corporation.business_number = valid;
    });
    const issues = await refusal('C01', root);
    expect(issues.some((i) => i.check === 'made-up-data' && /check digit/i.test(i.reason))).toBe(true);
  });

  test('SEC-11 an e-mail address outside a reserved test domain is refused', async () => {
    const root = copySamples();
    editOnboarding(root, 'C01', (j) => {
      j.client_notes[0] = `${must(j.client_notes[0], 'C01 first client note')} Reach me at priya.nair@gmail.com.`;
    });
    const issues = await refusal('C01', root);
    expect(issues.some((i) => i.check === 'made-up-data' && /e-?mail/i.test(i.reason))).toBe(true);
  });

  test('SEC-11 a phone number outside 555-0100 to 555-0199 is refused', async () => {
    const root = copySamples();
    editOnboarding(root, 'C01', (j) => {
      j.client_notes[0] = `${must(j.client_notes[0], 'C01 first client note')} Call 416-555-2368.`;
    });
    const issues = await refusal('C01', root);
    expect(issues.some((i) => i.check === 'made-up-data' && /phone/i.test(i.reason))).toBe(true);
  });

  test('SEC-11 no false alarm: an example.com e-mail and a 555-01xx phone number are accepted', async () => {
    const root = copySamples();
    editOnboarding(root, 'C01', (j) => {
      j.client_notes[0] = `${must(j.client_notes[0], 'C01 first client note')} Reach me at priya.nair@example.com or 416-555-0142.`;
    });
    const c = await load('C01', root);
    expect(c.corporation.name).toBe(README.C01.name);
  });
});

describe('W00 determinism (card check 8, first half)', () => {
  test.each(CLIENT_IDS)('ARC-16 %s loads to deep-equal results twice, whatever the clock says', async (id) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-01T09:00:00-04:00'));
      const a = await load(id);
      vi.setSystemTime(new Date('2031-03-15T23:59:00-04:00'));
      const b = await load(id);
      expect(b).toEqual(a);
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    } finally {
      vi.useRealTimers();
    }
  });

  test('ARC-16 the loader reads the sample files in place and leaves them byte-identical', async () => {
    const files = Object.values(FOLDERS).flatMap((f) => ['answer-key.json', 'onboarding.json', 'profile.md'].map((n) => join(SAMPLE_ROOT, f, n)));
    const before = files.map((p) => readFileSync(p, 'utf8'));
    for (const id of CLIENT_IDS) await load(id);
    expect(files.map((p) => readFileSync(p, 'utf8'))).toEqual(before);
  });
});
