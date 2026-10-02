// W00 acceptance tests: the kinds register (END-9, check 6) and the fault catalogue (ARC-8, check 7).
//
// Public API this file fixes (testworld/index.ts; the tests await every call, so sync or async both work):
//   listKinds(): KindEntry[]
//     KindEntry = { id: KindId; startsFrom: 'new' | ClientId[]; status: 'built' | 'not built' }
//     KindId is 'K01' to 'K13' (blueprint 00's K1 is K01), in order. startsFrom lists the sample clients the
//     blueprint 00 kinds table names, in the order it names them ("04, with 03's bonus" is ['C04', 'C03']).
//     status is 'built' only when testworld/kinds/<id>/ exists.
//   loadKind(id: KindId): Kind | Promise<Kind>
//     Throws (or rejects) with a message containing "not built" for a kind with no folder yet, and with a
//     message containing the id for an id that is not K01 to K13. It never returns undefined or a stub.
//   faults(): FaultEntry[]
//     FaultEntry = { id: string; client?: ClientId; kind?: KindId; flagId?: string; planted: string;
//                    expected: string; clause?: string; roll?: { account: string; month: string } }
//     Each entry has a client or a kind. Every flag in each sample client's answer key appears once, with
//     flagId equal to the answer key's flag id and client equal to that client; planted and expected are
//     non-empty (expected is the exact flag or exception the fault must raise). Ids are unique.
//     Round 2 (findings W00 r1 RC4, A353): the catalogue is a hand-written typed list in
//     testworld/model/faults.ts (W01 to W13 add theirs through testworld/kinds/<kind>/faults.ts). It is never
//     built from the answer keys or the loader, so comparing it with the answer keys (both ways) is not circular.
//     An entry with roll is the waiver that lets that client's account and month not roll (YYYY-MM); the
//     sample clients have exactly two: C10 CHQ 2025-03 (duplicates) and C10 CHQ 2025-05 (the missing May).
import { describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { faults, listKinds, loadKind } from '../index';
import { CLIENT_IDS, REPO_ROOT, SAMPLE_ROOT, readKey } from '../__fixtures__/sample-copy';
import { readOwnSource } from '../../src/core/testing/read-own-source';

// The fields of the register and the catalogue these tests read (the shapes in the header above).
interface KindView {
  id: string;
  startsFrom: 'new' | string[];
  status: string;
}
interface FaultView {
  id: string;
  client?: string;
  kind?: string;
  flagId?: string;
  planted?: unknown;
  expected?: unknown;
  clause?: string;
  roll?: { account?: unknown; month?: unknown };
}
async function kindsNow(): Promise<KindView[]> {
  const k: unknown = await Promise.resolve(listKinds());
  return k as KindView[];
}
async function faultsNow(): Promise<FaultView[]> {
  const f: unknown = await Promise.resolve(faults());
  return f as FaultView[];
}
/** String(v ?? '') without lint's base-to-string complaint: a non-string value still counts as present. */
const text = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : JSON.stringify(v));
/** Calls loadKind so that a synchronous throw and a rejection both arrive as a rejected promise. */
const askKind = (id: string): Promise<unknown> => Promise.resolve().then(() => loadKind(id as never));

// blueprint/00-end-state.md, "The thirteen return kinds", column "Starts from sample client".
const KINDS_TABLE: Record<string, 'new' | string[]> = {
  K01: 'new',
  K02: ['C08'],
  K03: ['C09'],
  K04: ['C02'],
  K05: 'new',
  K06: 'new',
  K07: ['C05', 'C06'],
  K08: ['C01'],
  K09: ['C04', 'C03'],
  K10: ['C05'],
  K11: ['C08', 'C10'],
  K12: ['C10'],
  K13: 'new',
};
const kindFolder = (id: string) => join(REPO_ROOT, 'testworld', 'kinds', id);

describe('W00 kinds register (card check 6)', () => {
  test('END-9 listKinds returns K01 to K13 in order with the starting sample clients blueprint 00 names', async () => {
    const kinds = await kindsNow();
    expect(kinds.map((k) => k.id)).toEqual(Object.keys(KINDS_TABLE));
    for (const k of kinds) expect([k.id, k.startsFrom]).toEqual([k.id, KINDS_TABLE[k.id]]);
  });

  test('END-9 a kind is "built" only when its folder exists, otherwise "not built"', async () => {
    const kinds = await kindsNow();
    for (const k of kinds) expect([k.id, k.status]).toEqual([k.id, existsSync(kindFolder(k.id)) ? 'built' : 'not built']);
  });

  test('END-9 asking for a kind that is not built fails with "not built", never skips or returns a stub', async () => {
    const notBuilt = (await kindsNow()).filter((k) => k.status === 'not built').map((k) => k.id);
    // K13 needs a new sample client first, so it is the last to be built; while any kind is unbuilt this runs.
    expect(notBuilt.length + (await kindsNow()).filter((k) => k.status === 'built').length).toBe(13);
    for (const id of notBuilt) {
      await expect(askKind(id), id).rejects.toThrow(/not built/);
    }
  });

  test('END-9 an id outside K01 to K13 is refused, naming the id', async () => {
    await expect(askKind('K14')).rejects.toThrow(/K14/);
    await expect(askKind('K1')).rejects.toThrow(/K1\b/);
  });
});

describe('W00 fault catalogue (card check 7)', () => {
  test.each(CLIENT_IDS)('ARC-8 every flag in the %s answer key is in the fault catalogue with a non-empty expected result', async (id) => {
    const key = readKey(SAMPLE_ROOT, id);
    const all = await faultsNow();
    expect(key.flags.length).toBeGreaterThan(0);
    for (const flag of key.flags) {
      const hits = all.filter((f) => f.flagId === flag.id);
      expect(hits.length, `${flag.id} listed once`).toBe(1);
      expect(hits[0]?.client).toBe(id);
      expect(text(hits[0]?.expected).trim().length, `${flag.id} expected`).toBeGreaterThan(0);
      expect(text(hits[0]?.planted).trim().length, `${flag.id} planted`).toBeGreaterThan(0);
    }
  });

  test('ARC-8 the catalogue names no flag a sample client does not have, and every entry has an owner and a unique id', async () => {
    const all = await faultsNow();
    const real = new Set(CLIENT_IDS.flatMap((id) => readKey(SAMPLE_ROOT, id).flags.map((f) => `${id} ${f.id}`)));
    for (const f of all) {
      expect(Boolean(f.client) || Boolean(f.kind), f.id).toBe(true);
      if (f.client && f.flagId) expect(real.has(`${f.client} ${f.flagId}`), `${f.client} ${f.flagId}`).toBe(true);
      if (f.clause !== undefined) expect(f.clause).toMatch(/^[A-Z]{2,4}-\d+[a-z]?$/);
    }
    expect(new Set(all.map((f) => f.id)).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(real.size);
  });

  test('ARC-8 the catalogue holds the roll waivers by client, account and month: exactly C10 CHQ 2025-03 and 2025-05', async () => {
    const rolls = (await faultsNow()).filter((f) => f.roll !== undefined);
    expect(rolls.map((f) => `${text(f.client)} ${text(f.roll?.account)} ${text(f.roll?.month)}`).sort()).toEqual([
      'C10 CHQ 2025-03',
      'C10 CHQ 2025-05',
    ]);
    for (const f of rolls) {
      expect(text(f.expected).trim().length, f.id).toBeGreaterThan(0);
      expect(text(f.planted).trim().length, f.id).toBeGreaterThan(0);
    }
  });

  test('ARC-8 the catalogue is hand-written: testworld/model/faults.ts never reads the answer keys or the loader', () => {
    const src = readOwnSource('testworld/model/faults.ts');
    expect(src.length).toBeGreaterThan(0);
    for (const banned of ['answer-key', 'sample-clients', 'loadClient', 'clientFolders', '../clients', 'readFileSync', 'JSON.parse']) {
      expect(src.includes(banned), `faults.ts mentions ${banned}`).toBe(false);
    }
    // Every sample-client flag id is written out in the file itself.
    for (const id of CLIENT_IDS) for (const f of readKey(SAMPLE_ROOT, id).flags) expect(src.includes(`'${f.id}'`) || src.includes(`"${f.id}"`), f.id).toBe(true);
  });
});
