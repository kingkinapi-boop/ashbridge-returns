// FX5 acceptance tests, database part: the F02 move inside a caller's transaction (spec-writer;
// builders never edit this file). Round 2 (A402, reports/FX5-spec-review.md gaps 1 to 7).
//
// The surface these tests fix (amber in reports/FX5-spec.md):
// - move(returnId, to, actor, why, tx?) takes the caller's PGlite Transaction as an optional fifth
//   argument. Given one, every read and write of the move (the state read, the lock, the state event,
//   the update) goes through it; the move opens no transaction of its own and never touches `db`; it
//   neither commits nor rolls back. Given none, it behaves exactly as F02 built it.
// - A rule refusal (blank who or why, unknown return, a move the table does not hold, a guard not
//   built, a guard that says no) comes back as { ok: false, reason }, with the same reason the move
//   gives without a transaction; it writes nothing and leaves the caller's transaction usable.
// - A database error inside the caller's transaction is thrown, never returned as { ok: false }:
//   Postgres has aborted the transaction, and a caller that carried on would get its COMMIT turned
//   into a silent ROLLBACK (T08 would believe its approval was saved).
//
// Fail fast (gap 1): the lifecycle gets a guarded db. While the test is inside its own transaction,
// any query, exec, sql or transaction on the guarded db rejects with FX5_MISUSE and is recorded, so a
// move that ignores the caller's transaction fails in milliseconds by name instead of hanging on
// PGlite's transaction lock. The test itself always uses the raw db.
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import type { Clock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import { ReturnIdSchema, type ReturnId } from '../../contracts/ids'
import type { Guard } from '../../contracts/lifecycle'
import { pathTo, type State } from './__fixtures__/blueprint-moves'
import { MOVES, createLifecycle } from './index'

const PREPARER = 'Pat Preparer (Test)'
const NOW = '2026-03-16T13:00:00.000Z'
const clock: Clock = { now: () => new Date(NOW) }
const FX5_MISUSE = 'FX5: the move used db, not the caller transaction'
const pass: Guard = () => ({ ok: true })
const allPass = (): Record<string, Guard> => Object.fromEntries(MOVES.map((m) => [m.guard, pass]))

type MoveResult = { ok: true } | { ok: false; reason: string }
type MoveInTx = (returnId: ReturnId, to: State, actor: string, why: string, tx?: Transaction) => Promise<MoveResult>

class Rollback extends Error {}

const GUARDED = new Set<PropertyKey>(['query', 'exec', 'sql', 'transaction'])

/** A PGlite seen through a guard: while `inCaller` is set, any use rejects with FX5_MISUSE and is recorded. */
function guardDb(raw: PGlite) {
  const state = { inCaller: false, misuses: [] as string[] }
  const guarded = new Proxy(raw, {
    get(target, prop) {
      const v: unknown = Reflect.get(target, prop, target)
      if (typeof v !== 'function') return v
      const fn = v as (...args: unknown[]) => unknown
      if (!GUARDED.has(prop)) return fn.bind(target)
      return (...args: unknown[]) => {
        if (state.inCaller) {
          state.misuses.push(String(prop))
          return Promise.reject(new Error(FX5_MISUSE))
        }
        return fn.apply(target, args)
      }
    },
  })
  return { guarded, state }
}

let n = 0
async function newReturn(q: PGlite | Transaction): Promise<ReturnId> {
  n += 1
  const id = ReturnIdSchema.parse(`ret-fx5-${String(n)}`)
  await q.query(`insert into returns.returns (id, entity_name, year_end, state) values ($1, $2, '2025-12-31', 'intake')`, [
    id,
    'Quillfeather Sample Widgets Inc. (Test)',
  ])
  return id
}
async function stateOf(db: PGlite, id: ReturnId): Promise<string> {
  const r = await db.query<{ state: string }>('select state from returns.returns where id = $1', [id])
  return r.rows[0]?.state ?? '(no return)'
}
async function eventRows(db: PGlite, id: ReturnId): Promise<number> {
  const r = await db.query<{ n: number }>('select count(*)::int as n from returns.state_events where return_id = $1', [id])
  return r.rows[0]?.n ?? -1
}
interface EventRow {
  from_state: string
  to_state: string
  actor: string
  reason: string
  occurred_at: string
}
async function events(db: PGlite, id: ReturnId): Promise<EventRow[]> {
  const r = await db.query<{ from_state: string; to_state: string; actor: string; reason: string; occurred_at: Date }>(
    'select from_state, to_state, actor, reason, occurred_at from returns.state_events where return_id = $1 order by seq',
    [id],
  )
  return r.rows.map((e) => ({ ...e, occurred_at: new Date(e.occurred_at).toISOString() }))
}
async function nameOf(db: PGlite, id: ReturnId): Promise<string> {
  const r = await db.query<{ entity_name: string }>('select entity_name from returns.returns where id = $1', [id])
  return r.rows[0]?.entity_name ?? '(no return)'
}
const rename = (tx: Transaction, id: ReturnId, name: string) =>
  tx.query('update returns.returns set entity_name = $2 where id = $1', [id, name])

/** Message and causes of a thrown value, joined, so a wrapped database error still names itself. */
function errorText(e: unknown): string {
  const parts: string[] = []
  let cur: unknown = e
  for (let i = 0; i < 5 && cur !== undefined && cur !== null; i += 1) {
    parts.push(cur instanceof Error ? cur.message : typeof cur === 'string' ? cur : JSON.stringify(cur))
    cur = cur instanceof Error ? cur.cause : undefined
  }
  return parts.join(' <- ')
}

async function setup(guards: Record<string, Guard> = allPass()) {
  const db = await cloneTestDb()
  const { guarded, state } = guardDb(db)
  const lc = createLifecycle({ db: guarded, clock, guards })
  const move: MoveInTx = lc.move
  /** The caller's own transaction on the raw db; the lifecycle's db is guarded for its whole length. */
  async function callerTx<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    state.inCaller = true
    try {
      return await db.transaction(work)
    } finally {
      state.inCaller = false
    }
  }
  /** Walks a fresh return to `s` through the move with no transaction (F02's own path). */
  async function returnIn(s: State): Promise<ReturnId> {
    const id = await newReturn(db)
    for (const step of pathTo(s)) {
      const r = await move(id, step, PREPARER, `fixture walk to ${s}`)
      if (!r.ok) throw new Error(`fixture walk refused at ${step}: ${r.reason}`)
    }
    return id
  }
  return { db, move, callerTx, returnIn, misuses: state.misuses }
}

async function plantFailure(db: PGlite, on: 'update' | 'event', target: State): Promise<void> {
  if (on === 'update') {
    await db.exec(`
      create function returns.fx5_planted_update() returns trigger language plpgsql as $$
      begin raise exception 'planted: the return update fails'; end $$;
      create trigger fx5_planted before update on returns.returns
        for each row when (new.state = '${target}') execute function returns.fx5_planted_update();
    `)
  } else {
    await db.exec(`
      create function returns.fx5_planted_event() returns trigger language plpgsql as $$
      begin raise exception 'planted: the state event insert fails'; end $$;
      create trigger fx5_planted before insert on returns.state_events
        for each row when (new.to_state = '${target}') execute function returns.fx5_planted_event();
    `)
  }
}

describe('FX5 the move inside a caller transaction: committed and rolled back together (FLOW-4)', () => {
  test('FLOW-4 a move given the caller transaction commits with it: the state and exactly one state event are kept, and db is never touched', async () => {
    const { db, move, callerTx, misuses } = await setup()
    const id = await newReturn(db)
    const r = await callerTx((tx) => move(id, 'evidence', PREPARER, 'start the evidence', tx))
    expect(misuses).toEqual([])
    expect(r).toEqual({ ok: true })
    expect(await stateOf(db, id)).toBe('evidence')
    expect(await eventRows(db, id)).toBe(1)
  })

  test('FLOW-4 a caller that rolls back after an ok move leaves the return in its old state and writes no event row', async () => {
    const { db, move, callerTx, misuses } = await setup()
    const id = await newReturn(db)
    let moved: MoveResult | undefined
    await expect(
      callerTx(async (tx) => {
        moved = await move(id, 'evidence', PREPARER, 'start the evidence', tx)
        throw new Rollback('caller changed its mind')
      }),
    ).rejects.toBeInstanceOf(Rollback)
    expect(misuses).toEqual([])
    expect(moved).toEqual({ ok: true })
    expect(await stateOf(db, id)).toBe('intake')
    expect(await eventRows(db, id)).toBe(0)
  })

  test("FLOW-4 the move sees the caller's own uncommitted return, and a rollback takes the return and its event with it", async () => {
    const { db, move, callerTx, misuses } = await setup()
    let id: ReturnId | undefined
    let moved: MoveResult | undefined
    await expect(
      callerTx(async (tx) => {
        id = await newReturn(tx)
        moved = await move(id, 'evidence', PREPARER, 'start the evidence', tx)
        throw new Rollback('caller changed its mind')
      }),
    ).rejects.toBeInstanceOf(Rollback)
    expect(misuses).toEqual([])
    expect(moved).toEqual({ ok: true })
    expect(id).toBeDefined()
    if (id) {
      expect(await stateOf(db, id)).toBe('(no return)')
      expect(await eventRows(db, id)).toBe(0)
    }
  })

  test('FLOW-4 two moves in one committed caller transaction are both kept: the return is in gaps with exactly 2 events', async () => {
    const { db, move, callerTx, misuses } = await setup()
    const id = await newReturn(db)
    const r = await callerTx(async (tx) => [
      await move(id, 'evidence', PREPARER, 'one', tx),
      await move(id, 'gaps', PREPARER, 'two', tx),
    ])
    expect(misuses).toEqual([])
    expect(r).toEqual([{ ok: true }, { ok: true }])
    expect(await stateOf(db, id)).toBe('gaps')
    expect((await events(db, id)).map((e) => `${e.from_state}->${e.to_state}`)).toEqual(['intake->evidence', 'evidence->gaps'])
  })

  test('FLOW-4 two moves in one rolled-back caller transaction are both lost: the return is in intake with 0 events', async () => {
    const { db, move, callerTx, misuses } = await setup()
    const id = await newReturn(db)
    const moved: MoveResult[] = []
    await expect(
      callerTx(async (tx) => {
        moved.push(await move(id, 'evidence', PREPARER, 'one', tx))
        moved.push(await move(id, 'gaps', PREPARER, 'two', tx))
        throw new Rollback('lost together')
      }),
    ).rejects.toBeInstanceOf(Rollback)
    expect(misuses).toEqual([])
    expect(moved).toEqual([{ ok: true }, { ok: true }])
    expect(await stateOf(db, id)).toBe('intake')
    expect(await eventRows(db, id)).toBe(0)
  })
})

describe('FX5 every move of the table inside a caller transaction (FLOW-1, FLOW-4)', () => {
  test.each(MOVES.map((m) => [`${m.from} -> ${m.to}`, m] as const))(
    'FLOW-1 FLOW-4 %s: committed with the caller it gives the new state and one event; rolled back it gives the old state and none',
    async (_name, m) => {
      const { db, move, callerTx, returnIn, misuses } = await setup()
      const kept = await returnIn(m.from)
      const lost = await returnIn(m.from)
      const keptBefore = await eventRows(db, kept)
      const lostBefore = await eventRows(db, lost)

      const r = await callerTx((tx) => move(kept, m.to, PREPARER, `move to ${m.to}`, tx))
      let moved: MoveResult | undefined
      await expect(
        callerTx(async (tx) => {
          moved = await move(lost, m.to, PREPARER, `move to ${m.to}`, tx)
          throw new Rollback('caller changed its mind')
        }),
      ).rejects.toBeInstanceOf(Rollback)

      expect(misuses).toEqual([])
      expect(r).toEqual({ ok: true })
      expect(moved).toEqual({ ok: true })
      expect(await stateOf(db, kept)).toBe(m.to)
      expect(await eventRows(db, kept)).toBe(keptBefore + 1)
      expect((await events(db, kept)).at(-1)).toEqual({
        from_state: m.from,
        to_state: m.to,
        actor: PREPARER,
        reason: `move to ${m.to}`,
        occurred_at: NOW,
      })
      expect(await stateOf(db, lost)).toBe(m.from)
      expect(await eventRows(db, lost)).toBe(lostBefore)
    },
  )
})

describe('FX5 the event a move writes inside a caller transaction (FLOW-1)', () => {
  test('FLOW-1 the event written with a caller transaction equals the one written without: from, to, who, why and when (the pinned clock)', async () => {
    const { db, move, callerTx, misuses } = await setup()
    const withTx = await newReturn(db)
    const without = await newReturn(db)
    expect(await callerTx((tx) => move(withTx, 'evidence', PREPARER, 'start the evidence', tx))).toEqual({ ok: true })
    expect(await move(without, 'evidence', PREPARER, 'start the evidence')).toEqual({ ok: true })
    expect(misuses).toEqual([])
    const expected: EventRow = { from_state: 'intake', to_state: 'evidence', actor: PREPARER, reason: 'start the evidence', occurred_at: NOW }
    expect(await events(db, withTx)).toEqual([expected])
    expect(await events(db, without)).toEqual([expected])
  })

  test('FLOW-1 a move given no transaction behaves as before: it commits on its own, and a refused one writes nothing', async () => {
    const { db, move } = await setup()
    const id = await newReturn(db)
    expect(await move(id, 'evidence', PREPARER, 'start the evidence')).toEqual({ ok: true })
    expect(await stateOf(db, id)).toBe('evidence')
    expect(await eventRows(db, id)).toBe(1)
    expect((await move(id, 'closed', PREPARER, 'not in the table')).ok).toBe(false)
    expect(await stateOf(db, id)).toBe('evidence')
    expect(await eventRows(db, id)).toBe(1)
  })
})

describe('FX5 every refusal inside a caller transaction (FLOW-1): refused, nothing written, the transaction still usable', () => {
  interface Case {
    name: string
    guards: () => Record<string, Guard>
    /** the move that is refused: return id (or 'unknown'), target state, who, why */
    to: State
    actor: string
    why: string
    unknown?: boolean
    reason?: string
  }
  const intakeToEvidence = MOVES.find((m) => m.from === 'intake' && m.to === 'evidence')?.guard ?? 'intake_to_evidence'
  const cases: Case[] = [
    { name: 'a blank actor', guards: allPass, to: 'evidence', actor: ' ', why: 'start the evidence' },
    { name: 'a blank reason', guards: allPass, to: 'evidence', actor: PREPARER, why: '\t' },
    { name: 'an unknown return id', guards: allPass, to: 'evidence', actor: PREPARER, why: 'start the evidence', unknown: true },
    { name: 'a move the table does not hold', guards: allPass, to: 'closed', actor: PREPARER, why: 'a jump the table does not hold' },
    {
      name: 'a guard not built',
      guards: () => Object.fromEntries(Object.entries(allPass()).filter(([k]) => k !== intakeToEvidence)),
      to: 'evidence',
      actor: PREPARER,
      why: 'start the evidence',
    },
    {
      name: 'a guard that says no',
      guards: () => ({ ...allPass(), [intakeToEvidence]: () => ({ ok: false, reason: 'planted: the guard says no' }) }),
      to: 'evidence',
      actor: PREPARER,
      why: 'start the evidence',
      reason: 'planted: the guard says no',
    },
  ]

  test.each(cases.map((c) => [c.name, c] as const))(
    "FLOW-1 %s: { ok: false } with the reason the move gives without a transaction, no state change, no event, and the caller's own write is kept",
    async (_name, c) => {
      const { db, move, callerTx, misuses } = await setup(c.guards())
      const known = await newReturn(db)
      const target = c.unknown ? ReturnIdSchema.parse('ret-fx5-no-such-return') : known

      const outside = await move(target, c.to, c.actor, c.why)
      expect(outside.ok, 'the same move with no transaction is refused too').toBe(false)

      const inside = await callerTx(async (tx) => {
        const r = await move(target, c.to, c.actor, c.why, tx)
        await rename(tx, known, 'Renamed in the caller (Test)')
        return r
      })

      expect(misuses).toEqual([])
      expect(inside.ok).toBe(false)
      expect(inside).toEqual(outside)
      if (!inside.ok) expect(inside.reason.trim().length).toBeGreaterThan(0)
      if (c.reason !== undefined) expect(inside).toEqual({ ok: false, reason: c.reason })
      expect(await stateOf(db, known)).toBe('intake')
      expect(await eventRows(db, known)).toBe(0)
      expect(await nameOf(db, known)).toBe('Renamed in the caller (Test)')
    },
  )

  test('FLOW-1 after a refused move the same caller transaction can still make an ok move, and both the move and its one event are kept', async () => {
    const { db, move, callerTx, misuses } = await setup()
    const id = await newReturn(db)
    const r = await callerTx(async (tx) => [
      await move(id, 'closed', PREPARER, 'a jump the table does not hold', tx),
      await move(id, 'evidence', PREPARER, 'start the evidence', tx),
    ])
    expect(misuses).toEqual([])
    expect(r[0]?.ok).toBe(false)
    expect(r[1]).toEqual({ ok: true })
    expect(await stateOf(db, id)).toBe('evidence')
    expect(await eventRows(db, id)).toBe(1)
  })
})

describe('FX5 a database error inside a caller transaction is thrown, never returned (FLOW-4)', () => {
  test.each([
    ['the return update', 'update'],
    ['the state event insert', 'event'],
  ] as const)(
    "FLOW-4 planted fault on %s: the move throws, the caller's transaction rolls back, and nothing is kept, the caller's own write included",
    async (_name, on) => {
      const { db, move, callerTx, misuses } = await setup()
      const id = await newReturn(db)
      await plantFailure(db, on, 'evidence')
      let returned: MoveResult | undefined
      let thrown: unknown
      let callerFinished = false
      const outcome = await callerTx(async (tx) => {
        await rename(tx, id, 'Renamed in the caller (Test)')
        try {
          returned = await move(id, 'evidence', PREPARER, 'start the evidence', tx)
        } catch (e) {
          thrown = e
          throw e
        }
        callerFinished = true
        return 'the caller returned normally'
      }).then(
        (v) => ({ settled: 'resolved' as const, v }),
        (e: unknown) => ({ settled: 'rejected' as const, e }),
      )

      expect(misuses).toEqual([])
      expect(returned, 'a database error must never come back as a result').toBeUndefined()
      expect(callerFinished).toBe(false)
      expect(errorText(thrown)).toMatch(/planted: the (return update|state event insert) fails/)
      expect(outcome.settled).toBe('rejected')
      expect(await stateOf(db, id)).toBe('intake')
      expect(await eventRows(db, id), 'no partial event row survives').toBe(0)
      expect(await nameOf(db, id), "the caller's own write is rolled back too").toBe('Quillfeather Sample Widgets Inc. (Test)')
    },
  )

  test('FLOW-4 after the planted fault is removed, the same return moves with one event: the failed move left nothing pending', async () => {
    const { db, move, callerTx, misuses } = await setup()
    const id = await newReturn(db)
    await plantFailure(db, 'update', 'evidence')
    await expect(callerTx((tx) => move(id, 'evidence', PREPARER, 'start the evidence', tx))).rejects.toThrow()
    await db.exec('drop trigger fx5_planted on returns.returns')
    expect(await callerTx((tx) => move(id, 'evidence', PREPARER, 'start the evidence again', tx))).toEqual({ ok: true })
    expect(misuses).toEqual([])
    expect(await events(db, id)).toEqual([
      { from_state: 'intake', to_state: 'evidence', actor: PREPARER, reason: 'start the evidence again', occurred_at: NOW },
    ])
  })
})
