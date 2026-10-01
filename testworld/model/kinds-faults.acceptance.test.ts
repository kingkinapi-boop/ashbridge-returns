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
//                    expected: string; clause?: string }
//     Each entry has a client or a kind. Every flag in each sample client's answer key appears once, with
//     flagId equal to the answer key's flag id and client equal to that client; planted and expected are
//     non-empty (expected is the exact flag or exception the fault must raise). Ids are unique.
import { describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { faults, listKinds, loadKind } from '../index';
import { CLIENT_IDS, REPO_ROOT, SAMPLE_ROOT, readRaw } from '../__fixtures__/sample-copy';

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
    const kinds = await listKinds();
    expect(kinds.map((k: any) => k.id)).toEqual(Object.keys(KINDS_TABLE));
    for (const k of kinds) expect([k.id, k.startsFrom]).toEqual([k.id, KINDS_TABLE[k.id]]);
  });

  test('END-9 a kind is "built" only when its folder exists, otherwise "not built"', async () => {
    const kinds = await listKinds();
    for (const k of kinds) expect([k.id, k.status]).toEqual([k.id, existsSync(kindFolder(k.id)) ? 'built' : 'not built']);
  });

  test('END-9 asking for a kind that is not built fails with "not built", never skips or returns a stub', async () => {
    const notBuilt = (await listKinds()).filter((k: any) => k.status === 'not built').map((k: any) => k.id);
    // K13 needs a new sample client first, so it is the last to be built; while any kind is unbuilt this runs.
    expect(notBuilt.length + (await listKinds()).filter((k: any) => k.status === 'built').length).toBe(13);
    for (const id of notBuilt) {
      await expect((async () => loadKind(id))(), id).rejects.toThrow(/not built/);
    }
  });

  test('END-9 an id outside K01 to K13 is refused, naming the id', async () => {
    await expect((async () => loadKind('K14' as never))()).rejects.toThrow(/K14/);
    await expect((async () => loadKind('K1' as never))()).rejects.toThrow(/K1\b/);
  });
});

describe('W00 fault catalogue (card check 7)', () => {
  test.each(CLIENT_IDS)('ARC-8 every flag in the %s answer key is in the fault catalogue with a non-empty expected result', async (id) => {
    const key = readRaw(SAMPLE_ROOT, id, 'answer-key.json');
    const all = await faults();
    expect(key.flags.length).toBeGreaterThan(0);
    for (const flag of key.flags) {
      const hits = all.filter((f: any) => f.flagId === flag.id);
      expect(hits.length, `${flag.id} listed once`).toBe(1);
      expect(hits[0].client).toBe(id);
      expect(String(hits[0].expected ?? '').trim().length, `${flag.id} expected`).toBeGreaterThan(0);
      expect(String(hits[0].planted ?? '').trim().length, `${flag.id} planted`).toBeGreaterThan(0);
    }
  });

  test('ARC-8 the catalogue names no flag a sample client does not have, and every entry has an owner and a unique id', async () => {
    const all = await faults();
    const real = new Set(CLIENT_IDS.flatMap((id) => readRaw(SAMPLE_ROOT, id, 'answer-key.json').flags.map((f: any) => `${id} ${f.id}`)));
    for (const f of all) {
      expect(Boolean(f.client) || Boolean(f.kind), f.id).toBe(true);
      if (f.client && f.flagId) expect(real.has(`${f.client} ${f.flagId}`), `${f.client} ${f.flagId}`).toBe(true);
      if (f.clause !== undefined) expect(f.clause).toMatch(/^[A-Z]{2,4}-\d+[a-z]?$/);
    }
    expect(new Set(all.map((f: any) => f.id)).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(real.size);
  });
});
