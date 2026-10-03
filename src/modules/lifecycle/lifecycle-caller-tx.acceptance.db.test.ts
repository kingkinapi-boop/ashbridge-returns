// FX5 acceptance tests: the F02 move inside a caller's transaction (spec-writer; builders never edit this file).
//
// The surface these tests fix (amber choice in reports/FX5-spec.md): move(returnId, to, actor, why, tx?)
// takes the caller's PGlite Transaction as an optional fifth argument. Given one, every read and write of
// the move (the state read, the guard's verdict, the lock, the state event, the update) goes through it and
// the move opens no transaction of its own; it neither commits nor rolls back. Given none, it behaves as before.
// A refusal comes back as { ok: false, reason } and writes nothing; it never throws, and the caller's
// transaction stays usable. Today the fifth argument is ignored and the move opens a second transaction
// while the caller's holds the connection, so these tests fail (they hang until the test timeout).
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import type { Clock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import { ReturnIdSchema, type ReturnId } from '../../contracts/ids'
import type { Guard } from '../../contracts/lifecycle'
import { MOVES, createLifecycle } from './index'

const PREPARER = 'Pat Preparer (Test)'
const clock: Clock = { now: () => new Date('2026-03-16T13:00:00Z') }
const pass: Guard = () => ({ ok: true })
const allPass = (): Record<string, Guard> => Object.fromEntries(MOVES.map((m) => [m.guard, pass]))

type MoveResult = { ok: true } | { ok: false; reason: string }
type MoveInTx = (returnId: ReturnId, to: string, actor: string, why: string, tx?: Transaction) => Promise<MoveResult>
const moveOf = (lc: ReturnType<typeof createLifecycle>): MoveInTx => lc.move as unknown as MoveInTx

class Rollback extends Error {}

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
async function setup(guards: Record<string, Guard> = allPass()) {
  const db = await cloneTestDb()
  const lc = createLifecycle({ db, clock, guards })
  return { db, move: moveOf(lc), lc }
}

describe('FX5 the move inside a caller transaction', () => {
  test('FLOW-4 a move given the caller transaction commits with it: the state and one state event are kept', async () => {
    const { db, move } = await setup()
    const id = await newReturn(db)
    const r = await db.transaction((tx) => move(id, 'evidence', PREPARER, 'start the evidence', tx))
    expect(r).toEqual({ ok: true })
    expect(await stateOf(db, id)).toBe('evidence')
    expect(await eventRows(db, id)).toBe(1)
  })

  test('FLOW-4 a caller that rolls back after an ok move leaves the return in its old state and writes no event row', async () => {
    const { db, move } = await setup()
    const id = await newReturn(db)
    await expect(
      db.transaction(async (tx) => {
        expect(await move(id, 'evidence', PREPARER, 'start the evidence', tx)).toEqual({ ok: true })
        throw new Rollback('caller changed its mind')
      }),
    ).rejects.toBeInstanceOf(Rollback)
    expect(await stateOf(db, id)).toBe('intake')
    expect(await eventRows(db, id)).toBe(0)
  })

  test('FLOW-4 the move sees the caller\'s own uncommitted writes, and a rollback takes the return and its event with it', async () => {
    const { db, move } = await setup()
    let id: ReturnId | undefined
    await expect(
      db.transaction(async (tx) => {
        id = await newReturn(tx)
        expect(await move(id, 'evidence', PREPARER, 'start the evidence', tx)).toEqual({ ok: true })
        throw new Rollback('caller changed its mind')
      }),
    ).rejects.toBeInstanceOf(Rollback)
    expect(id).toBeDefined()
    if (id) {
      expect(await stateOf(db, id)).toBe('(no return)')
      expect(await eventRows(db, id)).toBe(0)
    }
  })

  test('FLOW-4 two moves in one caller transaction are kept or lost together', async () => {
    const { db, move } = await setup()
    const keep = await newReturn(db)
    const lose = await newReturn(db)
    await db.transaction(async (tx) => {
      expect(await move(keep, 'evidence', PREPARER, 'one', tx)).toEqual({ ok: true })
      expect((await move(keep, 'gaps', PREPARER, 'two', tx)).ok).toBe(true)
    })
    expect(await eventRows(db, keep)).toBeGreaterThanOrEqual(1)
    await expect(
      db.transaction(async (tx) => {
        expect(await move(lose, 'evidence', PREPARER, 'one', tx)).toEqual({ ok: true })
        throw new Rollback('lost together')
      }),
    ).rejects.toBeInstanceOf(Rollback)
    expect(await stateOf(db, lose)).toBe('intake')
    expect(await eventRows(db, lose)).toBe(0)
  })

  test('FLOW-2 a move the table does not allow, given the caller transaction, comes back refused, throws nothing and writes nothing', async () => {
    const { db, move } = await setup()
    const id = await newReturn(db)
    await db.transaction(async (tx) => {
      const r = await move(id, 'closed', PREPARER, 'a jump the table does not hold', tx)
      expect(r.ok).toBe(false)
      // the caller's transaction is still usable and its own write is kept
      await tx.query(`update returns.returns set entity_name = $2 where id = $1`, [id, 'Renamed in the caller (Test)'])
    })
    expect(await stateOf(db, id)).toBe('intake')
    expect(await eventRows(db, id)).toBe(0)
    const name = await db.query<{ entity_name: string }>('select entity_name from returns.returns where id = $1', [id])
    expect(name.rows[0]?.entity_name).toBe('Renamed in the caller (Test)')
  })

  test('FLOW-2 a guard that refuses, given the caller transaction, comes back refused with the guard\'s reason and writes nothing', async () => {
    const guards = allPass()
    const g = MOVES.find((m) => m.from === 'intake' && m.to === 'evidence')?.guard
    if (!g) throw new Error('no intake->evidence move in MOVES')
    guards[g] = () => ({ ok: false, reason: 'planted: the guard says no' })
    const { db, move } = await setup(guards)
    const id = await newReturn(db)
    const r = await db.transaction((tx) => move(id, 'evidence', PREPARER, 'start the evidence', tx))
    expect(r).toEqual({ ok: false, reason: 'planted: the guard says no' })
    expect(await stateOf(db, id)).toBe('intake')
    expect(await eventRows(db, id)).toBe(0)
  })

  test('EV-1 a blank actor or reason, given the caller transaction, is refused before anything is written', async () => {
    const { db, move } = await setup()
    const id = await newReturn(db)
    const r = await db.transaction(async (tx) => ({
      actor: await move(id, 'evidence', ' ', 'start the evidence', tx),
      why: await move(id, 'evidence', PREPARER, '\t', tx),
    }))
    expect(r.actor.ok).toBe(false)
    expect(r.why.ok).toBe(false)
    expect(await stateOf(db, id)).toBe('intake')
    expect(await eventRows(db, id)).toBe(0)
  })

  test('LL-1 a move given no transaction behaves as before: it commits on its own', async () => {
    const { db, move } = await setup()
    const id = await newReturn(db)
    expect(await move(id, 'evidence', PREPARER, 'start the evidence')).toEqual({ ok: true })
    expect(await stateOf(db, id)).toBe('evidence')
    expect(await eventRows(db, id)).toBe(1)
    expect((await move(id, 'closed', PREPARER, 'not in the table')).ok).toBe(false)
    expect(await eventRows(db, id)).toBe(1)
  })
})
