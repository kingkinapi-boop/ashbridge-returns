// FX5 acceptance tests, unit part (spec-writer; builders never edit this file): the unit-project twin of
// lifecycle-caller-tx.acceptance.db.test.ts (testing rule for core cards: what a db test proves also has a
// unit twin). No database: the lifecycle gets a db whose every use is refused and recorded, and the
// caller's transaction is a small fake that answers the state read and records every write.
//
// The surface (amber in reports/FX5-spec.md): move(returnId, to, actor, why, tx?). Given tx, the move
// reads and writes only through it and never touches db; a rule refusal is { ok: false, reason } with no
// write; a database error from tx is thrown (never returned as { ok: false }).
// The fake reads SQL loosely (any select on returns.returns is the state read; an insert into
// returns.state_events is the event; an update of returns.returns is the move); it pins no column order.
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import type { Clock } from '../../core/clock'
import { ReturnIdSchema } from '../../contracts/ids'
import type { Guard, ReturnState } from '../../contracts/lifecycle'
import { MOVES, createLifecycle } from './index'

const PREPARER = 'Pat Preparer (Test)'
const NOW = '2026-03-16T13:00:00.000Z'
const clock: Clock = { now: () => new Date(NOW) }
const ID = ReturnIdSchema.parse('ret-fx5-unit-1')
const pass: Guard = () => ({ ok: true })
const allPass = (): Record<string, Guard> => Object.fromEntries(MOVES.map((m) => [m.guard, pass]))
const intakeToEvidence = MOVES.find((m) => m.from === 'intake' && m.to === 'evidence')?.guard ?? 'intake_to_evidence'

type MoveResult = { ok: true } | { ok: false; reason: string }
type MoveInTx = (returnId: typeof ID, to: ReturnState, actor: string, why: string, tx?: Transaction) => Promise<MoveResult>

function refusedDb() {
  const misuses: string[] = []
  const no = (what: string) => () => {
    misuses.push(what)
    return Promise.reject(new Error('FX5: the move used db, not the caller transaction'))
  }
  const db = { query: no('query'), exec: no('exec'), sql: no('sql'), transaction: no('transaction') }
  return { db: db as unknown as PGlite, misuses }
}

interface Write {
  sql: string
  params: unknown[]
}

function fakeTx(opts: { state: ReturnState | null; failOn?: 'update' | 'event' }) {
  const writes: Write[] = []
  let state = opts.state
  const run = (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (/^select\b/.test(s) && s.includes('returns.returns')) {
      return Promise.resolve({ rows: state === null ? [] : [{ state }], fields: [], affectedRows: 0 })
    }
    if (/^insert into returns\.state_events\b/.test(s)) {
      if (opts.failOn === 'event') return Promise.reject(new Error('planted: the state event insert fails'))
      writes.push({ sql: s, params })
      return Promise.resolve({ rows: [], fields: [], affectedRows: 1 })
    }
    if (/^update returns\.returns\b/.test(s)) {
      if (opts.failOn === 'update') return Promise.reject(new Error('planted: the return update fails'))
      writes.push({ sql: s, params })
      const to = params.find((p) => typeof p === 'string' && MOVES.some((m) => m.to === p))
      if (typeof to === 'string') state = to as ReturnState
      return Promise.resolve({ rows: [], fields: [], affectedRows: 1 })
    }
    if (/^(insert|update|delete)\b/.test(s)) writes.push({ sql: s, params })
    return Promise.resolve({ rows: [], fields: [], affectedRows: 0 })
  }
  const tx = {
    query: (sql: string, params?: unknown[]) => run(sql, params),
    exec: (sql: string) => run(sql).then((r) => [r]),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
      run(strings.reduce((acc, part, i) => acc + (i > 0 ? `$${String(i)}` : '') + part, ''), values),
    rollback: () => Promise.resolve(),
    closed: false,
  }
  return { tx: tx as unknown as Transaction, writes, stateNow: () => state }
}

const has = (params: unknown[], v: string): boolean =>
  params.some((p) => p === v || (p instanceof Date && p.toISOString() === v))

function setup(guards: Record<string, Guard> = allPass()) {
  const { db, misuses } = refusedDb()
  const lc = createLifecycle({ db, clock, guards })
  const move: MoveInTx = lc.move
  return { move, misuses }
}

describe('FX5 unit twin: the move given a caller transaction', () => {
  test('FLOW-4 the move takes the caller transaction as its fifth parameter', () => {
    const { move } = setup()
    expect(move.length).toBe(5)
  })

  test('FLOW-1 FLOW-4 an ok move reads and writes only through the caller transaction: one event (from, to, who, why, when) and the state update, db never touched', async () => {
    const { move, misuses } = setup()
    const { tx, writes, stateNow } = fakeTx({ state: 'intake' })
    expect(await move(ID, 'evidence', PREPARER, 'start the evidence', tx)).toEqual({ ok: true })
    expect(misuses).toEqual([])
    const events = writes.filter((w) => w.sql.startsWith('insert into returns.state_events'))
    expect(events).toHaveLength(1)
    const p = events[0]?.params ?? []
    for (const v of [ID, 'intake', 'evidence', PREPARER, 'start the evidence', NOW]) expect(has(p, v), `event carries ${v}`).toBe(true)
    expect(writes.filter((w) => w.sql.startsWith('update returns.returns'))).toHaveLength(1)
    expect(stateNow()).toBe('evidence')
  })

  test.each(MOVES.map((m) => [`${m.from} -> ${m.to}`, m] as const))(
    'FLOW-1 FLOW-4 %s inside the caller transaction writes exactly one event and one update through it, and never touches db',
    async (_name, m) => {
      const { move, misuses } = setup()
      const { tx, writes, stateNow } = fakeTx({ state: m.from })
      expect(await move(ID, m.to, PREPARER, `move to ${m.to}`, tx)).toEqual({ ok: true })
      expect(misuses).toEqual([])
      expect(writes.filter((w) => w.sql.startsWith('insert into returns.state_events'))).toHaveLength(1)
      expect(writes.filter((w) => w.sql.startsWith('update returns.returns'))).toHaveLength(1)
      expect(stateNow()).toBe(m.to)
    },
  )

  const refusals: [string, Record<string, Guard>, ReturnState | null, ReturnState, string, string, string | undefined][] = [
    ['a blank actor', allPass(), 'intake', 'evidence', ' ', 'start the evidence', undefined],
    ['a blank reason', allPass(), 'intake', 'evidence', PREPARER, '\t', undefined],
    ['an unknown return id', allPass(), null, 'evidence', PREPARER, 'start the evidence', undefined],
    ['a move the table does not hold', allPass(), 'intake', 'closed', PREPARER, 'a jump', undefined],
    [
      'a guard not built',
      Object.fromEntries(Object.entries(allPass()).filter(([k]) => k !== intakeToEvidence)),
      'intake',
      'evidence',
      PREPARER,
      'start the evidence',
      undefined,
    ],
    [
      'a guard that says no',
      { ...allPass(), [intakeToEvidence]: () => ({ ok: false, reason: 'planted: the guard says no' }) },
      'intake',
      'evidence',
      PREPARER,
      'start the evidence',
      'planted: the guard says no',
    ],
  ]

  test.each(refusals)(
    'FLOW-1 %s inside the caller transaction is { ok: false } with a reason, writes nothing and never touches db',
    async (_name, guards, state, to, actor, why, reason) => {
      const { move, misuses } = setup(guards)
      const { tx, writes, stateNow } = fakeTx({ state })
      const r = await move(ID, to, actor, why, tx)
      expect(misuses).toEqual([])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason.trim().length).toBeGreaterThan(0)
      if (reason !== undefined) expect(r).toEqual({ ok: false, reason })
      expect(writes).toEqual([])
      expect(stateNow()).toBe(state)
    },
  )

  test.each([
    ['the return update', 'update', /planted: the return update fails/],
    ['the state event insert', 'event', /planted: the state event insert fails/],
  ] as const)('FLOW-4 a database error on %s inside the caller transaction is thrown, never returned as { ok: false }', async (_name, failOn, msg) => {
    const { move, misuses } = setup()
    const { tx } = fakeTx({ state: 'intake', failOn })
    let returned: MoveResult | undefined
    let thrown: unknown
    try {
      returned = await move(ID, 'evidence', PREPARER, 'start the evidence', tx)
    } catch (e) {
      thrown = e
    }
    expect(misuses).toEqual([])
    expect(returned).toBeUndefined()
    const text: string[] = []
    for (let e: unknown = thrown, i = 0; e instanceof Error && i < 5; e = e.cause, i += 1) text.push(e.message)
    expect(text.join(' <- ')).toMatch(msg)
  })
})
