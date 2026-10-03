// F07 acceptance tests, the database side (spec-writer; builders never edit this file).
// Card plan/cards/F07.md. The pure side (shapes, the never-read list, client_ref formatting, the
// year-end rule) is bridge.acceptance.test.ts.
//
// The shapes these tests fix (the builder matches them; amber, listed in the spec report):
// - src/modules/bridge/index.ts exports, taking a PGlite handle first:
//     runBridge(db, snapshot: unknown) -> { created, items, skipped }  (parses with BridgeSnapshotSchema;
//       a snapshot that does not parse throws and writes nothing; a second run over the same snapshot
//       creates and reports nothing new)
//       created: { returnId, corporationId, taxYear, clientRef }[]
//       items:   { id, kind, corporationId, taxYear: number | null, engagementIds: string[] }[]  (new ones)
//       kind:    'year_end_unconfirmed' | 'unfiled_years_text' | 'duplicate_year' | 'books_source_unclear'
//       skipped: { entityId, reason: 't1_only' | 'no_t2' }[]
//     listBridgeReturns(db) -> { returnId, corporationId, taxYear, yearEnd, clientRef, incorporationDate,
//       booksSource, groupId, linkedReturnIds }[]  ordered by client_ref number, then tax year
//     listOpsItems(db) -> every item ever raised (same shape as runBridge's items), in raise order
//     listClientRefs(db) -> { corporationId, clientRef }[] in order of minting
// - A return is a row of returns.returns (entity_name = legal name, year_end, state 'intake').
//   A corporation with any open ops-confirms item gets no return until ops resolves it (resolving is
//   the ops screen's card, not this one); it still gets its client_ref, minted the first time the
//   bridge sees it as a T2 company. Skipped corporations get none.
// - returns.client_refs (corporation_id uuid, client_ref text, created_at, is_test): unique both ways,
//   append-only, client_ref must be ASH- and at least four digits from 0001.
// - Schema files: 05_bridge.sql (client_refs, client_handoff: nothing there needs returns.returns) and a
//   second file sorting after 50_returns.sql (for example 55_bridge_returns.sql) for the tables that
//   point at a return; every table of the bridge is named client_refs, client_handoff or bridge_*.
//   The existing catalog rules apply to them (records.acceptance.db.test.ts: every table has id,
//   created_at and is_test default true; records-repairs: a version column such as
//   client_handoff.list_version has a BEFORE UPDATE guard). So client_refs and the other bridge tables
//   carry an id column with a default, which the inserts below leave out; client_handoff has
//   created_at with a default.
// - returns.client_handoff: contract section 4 (columns named there), schema returns, row-level
//   security on, no policies, text columns hold ids only. Hand-off rows are written by later cards;
//   this card makes the table and the guards.
import type { PGlite } from '@electric-sql/pglite'
import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { fixedClock, setClock, systemClock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import { listBridgeReturns, listClientRefs, listOpsItems, runBridge } from './index'
import { neverReadNames } from './__fixtures__/never-read'
import { company, personal, snapshot, uuid, type FixtureEntity } from './__fixtures__/snapshot'

beforeAll(() => {
  setClock(fixedClock('2026-03-15T14:00:00-04:00'))
})
afterAll(() => {
  setClock(systemClock)
})

async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}
async function count(db: PGlite, table: string): Promise<number> {
  const r = await rows<{ n: number }>(db, `select count(*)::int as n from returns.${table}`)
  return r[0]?.n ?? -1
}

describe('F07 one clean company becomes one return (END-1)', () => {
  test('END-1 a snapshot with one company and one T2 year creates one return with no typing', async () => {
    const db = await cloneTestDb()
    const entity = company(1)
    const res = await runBridge(db, snapshot(entity))
    expect(res.items).toEqual([])
    expect(res.skipped).toEqual([])
    expect(res.created).toHaveLength(1)
    const list = await listBridgeReturns(db)
    expect(list).toHaveLength(1)
    const r = list[0]
    expect(r).toMatchObject({
      corporationId: entity.corporation?.id,
      taxYear: 2025,
      yearEnd: '2025-12-31',
      clientRef: 'ASH-0001',
      incorporationDate: '2019-03-04',
      booksSource: 'firm-books',
      groupId: null,
      linkedReturnIds: [],
    })
    expect(res.created[0]).toMatchObject({ returnId: r?.returnId, corporationId: entity.corporation?.id, taxYear: 2025, clientRef: 'ASH-0001' })
    const stored = await rows<{ entity_name: string; year_end: string; state: string; is_test: boolean }>(
      db,
      'select entity_name, year_end::text as year_end, state, is_test from returns.returns where id = $1',
      [r?.returnId],
    )
    expect(stored).toEqual([
      { entity_name: entity.corporation?.legal_name, year_end: '2025-12-31', state: 'intake', is_test: true },
    ])
  })

  test('END-1 one company that bought T2 for two years creates two returns that share one client_ref', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, {}, [2024, 2025])))
    const list = await listBridgeReturns(db)
    expect(list.map((r) => [r.taxYear, r.yearEnd, r.clientRef])).toEqual([
      [2024, '2024-12-31', 'ASH-0001'],
      [2025, '2025-12-31', 'ASH-0001'],
    ])
    expect(await count(db, 'returns')).toBe(2)
  })

  test('END-1 a non-calendar year end lands in the tax year, on the last day of the month', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { financial_year_end: '2025-03-31' }, [2026]), company(2, { financial_year_end: '2024-02-29' }, [2025])))
    const list = await listBridgeReturns(db)
    expect(list.map((r) => r.yearEnd)).toEqual(['2026-03-31', '2025-02-28'])
  })

  test('END-1 a second run over the same snapshot creates nothing and changes nothing', async () => {
    const db = await cloneTestDb()
    const snap = snapshot(company(1), company(2, { financial_year_end_confirmed: false }))
    const first = await runBridge(db, snap)
    const before = { returns: await listBridgeReturns(db), items: await listOpsItems(db), refs: await listClientRefs(db) }
    expect(first.created).toHaveLength(1)
    expect(first.items).toHaveLength(1)
    const second = await runBridge(db, snap)
    expect(second.created).toEqual([])
    expect(second.items).toEqual([])
    expect({ returns: await listBridgeReturns(db), items: await listOpsItems(db), refs: await listClientRefs(db) }).toEqual(before)
    expect(await count(db, 'returns')).toBe(1)
  })

  test('END-1 a snapshot that is not made-up data, or does not parse, is refused and writes nothing', async () => {
    const db = await cloneTestDb()
    await expect(runBridge(db, { ...snapshot(company(1)), is_test: false })).rejects.toThrow()
    await expect(runBridge(db, { is_test: true, entities: [{ nope: 1 }] })).rejects.toThrow()
    await expect(runBridge(db, null)).rejects.toThrow()
    expect(await count(db, 'returns')).toBe(0)
    expect(await count(db, 'client_refs')).toBe(0)
    expect(await listOpsItems(db)).toEqual([])
  })
})

describe('F07 what the client app leaves unclear is never guessed (END-1)', () => {
  test('END-1 a year end the client never confirmed becomes an ops-confirms item and no return', async () => {
    const db = await cloneTestDb()
    const entity = company(1, { financial_year_end_confirmed: false })
    const res = await runBridge(db, snapshot(entity))
    expect(res.created).toEqual([])
    expect(res.items).toHaveLength(1)
    expect(res.items[0]).toMatchObject({ kind: 'year_end_unconfirmed', corporationId: entity.corporation?.id, taxYear: 2025 })
    expect(await count(db, 'returns')).toBe(0)
    expect(await listBridgeReturns(db)).toEqual([])
    expect(await listOpsItems(db)).toHaveLength(1)
  })

  test('END-1 a year end that is missing becomes an ops-confirms item and no return', async () => {
    const db = await cloneTestDb()
    const entity = company(1, { financial_year_end: null })
    const res = await runBridge(db, snapshot(entity))
    expect(res.created).toEqual([])
    expect(res.items).toHaveLength(1)
    expect(res.items[0]).toMatchObject({ kind: 'year_end_unconfirmed', corporationId: entity.corporation?.id, taxYear: 2025 })
    expect(await count(db, 'returns')).toBe(0)
    expect(await listBridgeReturns(db)).toEqual([])
    expect(await listOpsItems(db)).toHaveLength(1)
  })

  test('END-1 unfiled years held only as text become an ops-confirms item, and no return is guessed for them', async () => {
    const db = await cloneTestDb()
    const entity = company(1, { all_prior_years_filed: 'no', outstanding_years: '2023 and 2024' })
    const res = await runBridge(db, snapshot(entity))
    expect(res.created).toEqual([])
    expect(res.items).toHaveLength(1)
    expect(res.items[0]).toMatchObject({ kind: 'unfiled_years_text', corporationId: entity.corporation?.id, taxYear: null })
    expect(await count(db, 'returns')).toBe(0)
  })

  test('END-1 outstanding years text with the filed answer unsure is an item too; "yes" with no text is not', async () => {
    const db = await cloneTestDb()
    const res = await runBridge(db, snapshot(company(1, { all_prior_years_filed: 'unsure' }), company(2, { all_prior_years_filed: 'yes' }), company(3, { all_prior_years_filed: null })))
    expect(res.items.map((i) => i.kind)).toEqual(['unfiled_years_text'])
    expect(res.created.map((c) => c.clientRef)).toEqual(['ASH-0002', 'ASH-0003'])
  })

  test('END-1 the same year bought twice becomes an ops-confirms item naming both engagements, and no return', async () => {
    const db = await cloneTestDb()
    const entity = company(1, {}, [2025, 2025])
    const res = await runBridge(db, snapshot(entity))
    expect(res.created).toEqual([])
    expect(res.items).toHaveLength(1)
    expect(res.items[0]).toMatchObject({ kind: 'duplicate_year', corporationId: entity.corporation?.id, taxYear: 2025 })
    expect([...(res.items[0]?.engagementIds ?? [])].sort()).toEqual(entity.engagements.map((e) => e.id).sort())
    expect(await count(db, 'returns')).toBe(0)
  })

  test('END-1 the Rouge Valley case: all three kinds on one corporation raise three items, no return, and the rest of the batch goes through', async () => {
    const db = await cloneTestDb()
    const messy = company(1, { financial_year_end_confirmed: false, all_prior_years_filed: 'no', outstanding_years: '2024 and 2025' }, [2025, 2025])
    const res = await runBridge(db, snapshot(messy, company(2)))
    expect(res.items.map((i) => i.kind).sort()).toEqual(['duplicate_year', 'unfiled_years_text', 'year_end_unconfirmed'])
    expect(res.created).toHaveLength(1)
    expect(res.created[0]?.corporationId).toBe(uuid(102))
    expect(await count(db, 'returns')).toBe(1)
  })

  test('END-1 an ops-confirms item holds no sentence: ids, a kind and a year only', async () => {
    const db = await cloneTestDb()
    const res = await runBridge(db, snapshot(company(1, { financial_year_end_confirmed: false })))
    const item = res.items[0]
    expect(Object.keys(item ?? {}).sort()).toEqual(['corporationId', 'engagementIds', 'id', 'kind', 'taxYear'])
  })
})

describe('F07 personal returns and companies with no T2 are skipped (OUT-6)', () => {
  test('OUT-6 a T1-only client and a company with no T2 are skipped; the rest of the batch still goes through', async () => {
    const db = await cloneTestDb()
    const noT2: FixtureEntity = {
      ...company(2),
      engagements: company(2).engagements.map((e) => ({ ...e, service: 'hst' })),
    }
    const t1 = personal(1)
    const res = await runBridge(db, snapshot(t1, noT2, company(3)))
    expect(res.skipped).toEqual([
      { entityId: t1.id, reason: 't1_only' },
      { entityId: noT2.id, reason: 'no_t2' },
    ])
    expect(res.created).toHaveLength(1)
    expect(res.created[0]?.corporationId).toBe(uuid(103))
    expect(res.items).toEqual([])
    expect(await count(db, 'returns')).toBe(1)
  })

  test('OUT-6 a skipped corporation gets no client_ref and does not use up a number', async () => {
    const db = await cloneTestDb()
    const noT2: FixtureEntity = { ...company(2), engagements: [] }
    await runBridge(db, snapshot(personal(1), noT2, company(3)))
    const refs = await listClientRefs(db)
    expect(refs).toEqual([{ corporationId: uuid(103), clientRef: 'ASH-0001' }])
    expect(await count(db, 'client_refs')).toBe(1)
  })

  test('OUT-6 a batch of only skipped entities is not an error', async () => {
    const db = await cloneTestDb()
    const res = await runBridge(db, snapshot(personal(1), personal(2)))
    expect(res.created).toEqual([])
    expect(res.skipped).toHaveLength(2)
  })
})

describe('F07 associated companies become linked returns (FLOW-11)', () => {
  test('FLOW-11 two associated companies create linked returns, whichever side names the other', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { associated_corporation_ids: [uuid(102)] }), company(2), company(3)))
    const list = await listBridgeReturns(db)
    const byCorp = new Map(list.map((r) => [r.corporationId, r]))
    const a = byCorp.get(uuid(101))
    const b = byCorp.get(uuid(102))
    const c = byCorp.get(uuid(103))
    expect(a?.groupId).not.toBeNull()
    expect(a?.groupId).toBe(b?.groupId)
    expect(a?.linkedReturnIds).toEqual([b?.returnId])
    expect(b?.linkedReturnIds).toEqual([a?.returnId])
    expect(c?.groupId).toBeNull()
    expect(c?.linkedReturnIds).toEqual([])
  })

  test('FLOW-11 a group links every return of every member, not only same-year pairs', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { associated_corporation_ids: [uuid(102)] }, [2024, 2025]), company(2, {}, [2025])))
    const list = await listBridgeReturns(db)
    expect(list).toHaveLength(3)
    const ids = list.map((r) => r.returnId).sort()
    for (const r of list) {
      expect(r.groupId).toBe(list[0]?.groupId)
      expect([...r.linkedReturnIds].sort()).toEqual(ids.filter((x) => x !== r.returnId))
    }
  })

  test('FLOW-11 association chains join into one group (A with B, B with C)', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { associated_corporation_ids: [uuid(102)] }), company(2, { associated_corporation_ids: [uuid(103)] }), company(3)))
    const list = await listBridgeReturns(db)
    expect(new Set(list.map((r) => r.groupId)).size).toBe(1)
    expect(list[0]?.groupId).not.toBeNull()
  })

  test('FLOW-11 an associated corporation the snapshot does not hold, or one that is skipped, links nothing and breaks nothing', async () => {
    const db = await cloneTestDb()
    const noT2: FixtureEntity = { ...company(2), engagements: [] }
    const res = await runBridge(db, snapshot(company(1, { associated_corporation_ids: [uuid(102), uuid(999)] }), noT2))
    expect(res.created).toHaveLength(1)
    const list = await listBridgeReturns(db)
    expect(list[0]?.linkedReturnIds).toEqual([])
  })
})

describe('F07 return facts later cards read (END-1)', () => {
  test('END-1 bookkeeping among the services gives firm-books; without it, client-qbo', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { services: ['t2', 'bookkeeping'] }), company(2, { services: ['t2', 'hst'] }), company(3, { services: ['t2'] })))
    const list = await listBridgeReturns(db)
    expect(list.map((r) => r.booksSource)).toEqual(['firm-books', 'client-qbo', 'client-qbo'])
  })

  test('END-1 services the client app does not say become an ops-confirms item, never a guessed books source', async () => {
    const db = await cloneTestDb()
    const entity = company(1, { services: null })
    const res = await runBridge(db, snapshot(entity))
    expect(res.created).toEqual([])
    expect(res.items).toHaveLength(1)
    expect(res.items[0]).toMatchObject({ kind: 'books_source_unclear', corporationId: entity.corporation?.id })
    expect(await count(db, 'returns')).toBe(0)
  })

  test('END-1 the incorporation date is carried to the return, and a missing one stays missing', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { incorporation_date: '2025-04-15' }), company(2, { incorporation_date: null })))
    const list = await listBridgeReturns(db)
    expect(list.map((r) => r.incorporationDate)).toEqual(['2025-04-15', null])
  })
})

describe('F07 client_ref (RT-5, onboarding contract U6)', () => {
  test('RT-5 the first run mints ASH-0001, ASH-0002 in snapshot order; the second run keeps them and mints only for the new corporation', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1), company(2)))
    expect(await listClientRefs(db)).toEqual([
      { corporationId: uuid(101), clientRef: 'ASH-0001' },
      { corporationId: uuid(102), clientRef: 'ASH-0002' },
    ])
    // the new corporation comes first in the snapshot and still gets the next number
    await runBridge(db, snapshot(company(3), company(1), company(2)))
    expect(await listClientRefs(db)).toEqual([
      { corporationId: uuid(101), clientRef: 'ASH-0001' },
      { corporationId: uuid(102), clientRef: 'ASH-0002' },
      { corporationId: uuid(103), clientRef: 'ASH-0003' },
    ])
    const list = await listBridgeReturns(db)
    expect(list.map((r) => [r.corporationId, r.clientRef])).toEqual([
      [uuid(101), 'ASH-0001'],
      [uuid(102), 'ASH-0002'],
      [uuid(103), 'ASH-0003'],
    ])
  })

  test('RT-5 a corporation held by an ops-confirms item still gets its client_ref, and keeps it when ops later clears the item', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { financial_year_end_confirmed: false }), company(2)))
    expect(await listClientRefs(db)).toEqual([
      { corporationId: uuid(101), clientRef: 'ASH-0001' },
      { corporationId: uuid(102), clientRef: 'ASH-0002' },
    ])
    await runBridge(db, snapshot(company(1, { financial_year_end_confirmed: true }), company(2)))
    expect((await listClientRefs(db))[0]).toEqual({ corporationId: uuid(101), clientRef: 'ASH-0001' })
    expect((await listBridgeReturns(db)).map((r) => r.clientRef)).toEqual(['ASH-0001', 'ASH-0002'])
  })

  test('RT-5 the number is never built from client data: a name with digits and a business number change nothing', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { legal_name: 'Alpha 123456789 Inc. (Test)', business_number: '123456789' })))
    expect((await listClientRefs(db))[0]?.clientRef).toBe('ASH-0001')
  })

  test('RT-5 the number is never built from client data: a different name and business number give the same first number', async () => {
    const db = await cloneTestDb()
    await runBridge(db, snapshot(company(1, { legal_name: 'Zeta Inc. (Test)', business_number: '987654321' })))
    expect((await listClientRefs(db))[0]?.clientRef).toBe('ASH-0001')
  })

  test('RT-5 numbering goes on past 9999 with more digits', async () => {
    const db = await cloneTestDb()
    await db.query(
      `insert into returns.client_refs (corporation_id, client_ref)
       select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'ASH-' || lpad(g::text, 4, '0')
       from generate_series(1, 9999) g`,
    )
    await runBridge(db, snapshot(company(20000)))
    const refs = await listClientRefs(db)
    expect(refs).toHaveLength(10000)
    expect(refs[9999]).toEqual({ corporationId: uuid(20100), clientRef: 'ASH-10000' })
  }, 60_000)

  test('RT-5 the mapping table refuses a second client_ref for a corporation, a client_ref used twice, and a malformed one', async () => {
    const db = await cloneTestDb()
    await db.query('insert into returns.client_refs (corporation_id, client_ref) values ($1, $2)', [uuid(1), 'ASH-0001'])
    await expect(db.query('insert into returns.client_refs (corporation_id, client_ref) values ($1, $2)', [uuid(1), 'ASH-0002'])).rejects.toThrow()
    await expect(db.query('insert into returns.client_refs (corporation_id, client_ref) values ($1, $2)', [uuid(2), 'ASH-0001'])).rejects.toThrow()
    for (const bad of ['ASH-1', 'ASH-001', 'ash-0002', 'ASH-0000', 'X-0002', 'ASH-0002 ', 'ASH-0002; drop table x']) {
      await expect(db.query('insert into returns.client_refs (corporation_id, client_ref) values ($1, $2)', [uuid(3), bad])).rejects.toThrow()
    }
    expect(await count(db, 'client_refs')).toBe(1)
  })

  test('RT-5 a client_ref is never changed and never reused: update, delete and truncate are refused', async () => {
    const db = await cloneTestDb()
    await db.query('insert into returns.client_refs (corporation_id, client_ref) values ($1, $2)', [uuid(1), 'ASH-0001'])
    await expect(db.query("update returns.client_refs set client_ref = 'ASH-0009'")).rejects.toThrow(/append-only/)
    await expect(db.query('update returns.client_refs set corporation_id = $1', [uuid(2)])).rejects.toThrow(/append-only/)
    await expect(db.query('delete from returns.client_refs')).rejects.toThrow(/append-only/)
    await expect(db.query('truncate returns.client_refs')).rejects.toThrow(/append-only/)
    expect(await rows(db, 'select client_ref from returns.client_refs')).toEqual([{ client_ref: 'ASH-0001' }])
  })

  // FX14: the old property ran 8 cases of a fixed seed in one test (4506 ms of a 6000 ms budget). The same 8 cases of the
  // same seed are now drawn once and each runs as its own test with its own world, so none is near the budget.
  const RT5_RUNS = fc.array(fc.shuffledSubarray([1, 2, 3, 4, 5, 6], { minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 4 })
  const RT5_CASES = fc.sample(RT5_RUNS, { seed: 20261002, numRuns: 8 })

  async function checkRefsInOrderOfFirstSight(runs: number[][]): Promise<void> {
    expect(runs.length, 'the pinned seed gave a case').toBeGreaterThan(0)
    const db = await cloneTestDb()
    try {
      const expected = new Map<string, string>()
      for (const run of runs) {
        await runBridge(db, snapshot(...run.map((n) => company(n))))
        for (const n of run) {
          if (!expected.has(uuid(100 + n))) expected.set(uuid(100 + n), `ASH-${String(expected.size + 1).padStart(4, '0')}`)
        }
        const refs = await listClientRefs(db)
        // stable: every ref seen so far equals what first sight gave it
        expect(new Map(refs.map((r) => [r.corporationId, r.clientRef]))).toEqual(expected)
        expect(new Set(refs.map((r) => r.clientRef)).size).toBe(refs.length)
      }
      // two returns of one corporation share its ref: here one return per corporation, carrying that ref
      const list = await listBridgeReturns(db)
      expect(list).toHaveLength(expected.size)
      for (const r of list) expect(r.clientRef).toBe(expected.get(r.corporationId))
    } finally {
      await db.close()
    }
  }

  test('RT-5 property (fixed seed) case 1 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[0] ?? [])
  })

  test('RT-5 property (fixed seed) case 2 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[1] ?? [])
  })

  test('RT-5 property (fixed seed) case 3 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[2] ?? [])
  })

  test('RT-5 property (fixed seed) case 4 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[3] ?? [])
  })

  test('RT-5 property (fixed seed) case 5 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[4] ?? [])
  })

  test('RT-5 property (fixed seed) case 6 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[5] ?? [])
  })

  test('RT-5 property (fixed seed) case 7 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[6] ?? [])
  })

  test('RT-5 property (fixed seed) case 8 of 8: any order of runs gives unique, stable, contiguous refs numbered in order of first sight', async () => {
    await checkRefsInOrderOfFirstSight(RT5_CASES[7] ?? [])
  })

})

describe('F07 the hand-off table (ARC-2)', () => {
  const HANDOFF_TEXT_COLUMNS = ['list_kind', 'status', 'item_id', 'primitive', 'fact_id', 'answer_shape', 'recommendation_id', 'reason_id']
  const ALLOWED_TYPES = ['uuid', 'integer', 'bigint', 'smallint', 'text', 'ARRAY', 'jsonb', 'boolean', 'timestamp with time zone']

  const question = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: uuid(1),
    corporation_id: uuid(101),
    engagement_id: uuid(9001),
    tax_year: 2025,
    list_kind: 'questions',
    list_version: 1,
    position: 1,
    status: 'draft',
    item_id: 'BQ1.bn',
    primitive: 'ask',
    fact_id: 'FL:102',
    answer_shape: 'free_text',
    choice_ids: [],
    slots: {},
    ...over,
  })

  async function insertHandoff(db: PGlite, row: Record<string, unknown>): Promise<void> {
    const cols = Object.keys(row)
    const ph = cols.map((c, i) => (c === 'slots' ? `$${String(i + 1)}::jsonb` : c === 'choice_ids' ? `$${String(i + 1)}::text[]` : `$${String(i + 1)}`))
    const vals = cols.map((c) => (c === 'slots' ? JSON.stringify(row[c]) : row[c]))
    await db.query(`insert into returns.client_handoff (${cols.join(', ')}) values (${ph.join(', ')})`, vals)
  }

  test('ARC-2 the hand-off table is in schema returns, row-level security is on, and no policy exists', async () => {
    const db = await cloneTestDb()
    const t = await rows<{ schemaname: string; rowsecurity: boolean }>(db, "select schemaname, rowsecurity from pg_tables where tablename = 'client_handoff'")
    expect(t).toEqual([{ schemaname: 'returns', rowsecurity: true }])
    const policies = await rows(db, "select policyname from pg_policies where schemaname = 'returns' and tablename = 'client_handoff'")
    expect(policies).toEqual([])
  })

  test('ARC-2 the hand-off table holds no free-text column: every column and its type, listed from the catalog', async () => {
    const db = await cloneTestDb()
    const cols = await rows<{ column_name: string; data_type: string; column_default: string | null }>(
      db,
      "select column_name, data_type, column_default from information_schema.columns where table_schema = 'returns' and table_name = 'client_handoff'",
    )
    const names = cols.map((c) => c.column_name)
    for (const must of ['id', 'corporation_id', 'engagement_id', 'tax_year', 'list_kind', 'list_version', 'position', 'status', 'sent_at', 'is_test', 'item_id', 'primitive', 'fact_id', 'answer_shape', 'choice_ids', 'slots', 'recommendation_id', 'reason_id', 'value_cents', 'prior_value_cents']) {
      expect(names).toContain(must)
    }
    for (const c of cols) {
      expect(ALLOWED_TYPES, `${c.column_name} is ${c.data_type}`).toContain(c.data_type)
      if (c.data_type === 'text') expect(HANDOFF_TEXT_COLUMNS, `${c.column_name} is a text column that is not an id column`).toContain(c.column_name)
      expect(c.column_name).not.toMatch(/(^|_)(message|body|wording|sentence|prose|comment|note|description|question_text|answer_text)$/)
    }
    expect(cols.find((c) => c.column_name === 'is_test')?.column_default).toMatch(/true/)
    expect(cols.find((c) => c.column_name === 'value_cents')?.data_type).toBe('bigint')
    expect(cols.find((c) => c.column_name === 'prior_value_cents')?.data_type).toBe('bigint')
  })

  test('ARC-2 no bridge table holds a column from the contract never-read list', async () => {
    const db = await cloneTestDb()
    const never = neverReadNames()
    const cols = await rows<{ table_name: string; column_name: string }>(
      db,
      `select table_name, column_name from information_schema.columns
       where table_schema = 'returns' and (table_name in ('client_refs', 'client_handoff') or table_name like 'bridge\\_%')`,
    )
    expect(cols.length).toBeGreaterThan(10)
    expect(cols.filter((c) => never.includes(c.column_name))).toEqual([])
  })

  test('ARC-2 a question row and an approval row are accepted; a DECIDE row carries ids, not words', async () => {
    const db = await cloneTestDb()
    await insertHandoff(db, question())
    await insertHandoff(db, question({ id: uuid(2), position: 2, primitive: 'confirm', answer_shape: 'choice', choice_ids: ['yes', 'no', 'unsure'], slots: { amount_cents: 12345, as_of: '2025-12-31', percent: 25, label: 'x'.repeat(60) } }))
    await insertHandoff(db, question({ id: uuid(3), position: 3, primitive: 'decide', recommendation_id: 'REC-12', reason_id: 'RSN-3' }))
    await insertHandoff(db, {
      id: uuid(4), corporation_id: uuid(101), engagement_id: uuid(9001), tax_year: 2025, list_kind: 'approval',
      list_version: 1, position: 1, status: 'draft', item_id: 'net_income', value_cents: 123456789012, prior_value_cents: -500,
    })
    expect(await count(db, 'client_handoff')).toBe(4)
  })

  test('ARC-2 a sentence in any id column is refused', async () => {
    const db = await cloneTestDb()
    const sentence = 'Please send your bank statements for March'
    for (const col of ['item_id', 'fact_id', 'recommendation_id', 'reason_id']) {
      await expect(insertHandoff(db, question({ id: uuid(50), [col]: sentence })), col).rejects.toThrow()
    }
    await expect(insertHandoff(db, question({ id: uuid(51), choice_ids: ['yes', sentence] }))).rejects.toThrow()
    expect(await count(db, 'client_handoff')).toBe(0)
  })

  test('ARC-2 a slot holds an id, a number, a date or a label of 60 characters at most: a longer label, a nested object and an array are refused', async () => {
    const db = await cloneTestDb()
    await expect(insertHandoff(db, question({ slots: { label: 'x'.repeat(61) } }))).rejects.toThrow()
    await expect(insertHandoff(db, question({ slots: { label: { deeper: 'x' } } }))).rejects.toThrow()
    await expect(insertHandoff(db, question({ slots: { labels: ['a', 'b'] } }))).rejects.toThrow()
    await expect(insertHandoff(db, question({ slots: ['a'] }))).rejects.toThrow()
    expect(await count(db, 'client_handoff')).toBe(0)
  })

  test('ARC-2 unknown list kinds, statuses, primitives, answer shapes and approval items are refused; position and version start at 1', async () => {
    const db = await cloneTestDb()
    const bad: Record<string, unknown>[] = [
      { list_kind: 'newsletter' },
      { status: 'queued' },
      { primitive: 'shout' },
      { answer_shape: 'essay' },
      { position: 0 },
      { list_version: 0 },
    ]
    for (const b of bad) await expect(insertHandoff(db, question({ id: uuid(60), ...b })), JSON.stringify(b)).rejects.toThrow()
    await expect(
      insertHandoff(db, { id: uuid(61), corporation_id: uuid(101), engagement_id: uuid(9001), tax_year: 2025, list_kind: 'approval', list_version: 1, position: 1, status: 'draft', item_id: 'gross_profit', value_cents: 1, prior_value_cents: 1 }),
    ).rejects.toThrow()
    expect(await count(db, 'client_handoff')).toBe(0)
  })
})
