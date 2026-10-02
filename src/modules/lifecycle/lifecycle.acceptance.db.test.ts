// F02 acceptance tests, database part: moves, events, voiding approval, the waiting flag and holds
// (spec-writer; builders never edit this file). Runs on PGlite clones of F01's schema.
//
// The public surface these tests fix (amber choices in reports/F02-spec.md):
// - src/contracts/lifecycle.ts (zod v4):
//   - GuardResult = { ok: true } | { ok: false; reason: string }
//   - Guard = (ctx: { returnId: ReturnId; from: ReturnState; to: ReturnState; actor: string })
//       => GuardResult | Promise<GuardResult>
//   - ApprovalFingerprintSchema / ApprovalFingerprint (FLOW-4): { cells: { cellId, value: string |
//     null }[] (every lock-export value, review lines included), facts, entries, judgmentInputs:
//     { id, version }[] }. T06 computes it; F02 only reads it.
//   - ChangedItem = { kind: 'cell'; cellId } | { kind: 'fact' | 'entry' | 'judgmentInput'; id }
//   - ApprovalFingerprintSource = { current(returnId): Promise<{ approvalId: string;
//       fingerprint: ApprovalFingerprint } | null> } (T06 implements it; tests pass a fixture)
// - src/modules/lifecycle/index.ts: createLifecycle({ db, clock, guards?, approvals? }) returning
//   - move(returnId, to, actor, why) -> { ok: true } | { ok: false; reason } (FLOW-1, FLOW-2).
//     guards is keyed by MOVES[i].guard; a guard not passed in is "not built yet" and refuses.
//     A refused move writes nothing.
//   - voidApproval(returnId, changedItems) -> { voided: true; items: ChangedItem[] } | { voided:
//     false } (FLOW-5): items are the changed items that were in the fingerprint; the return goes
//     to trace with one state event, and one row in returns.events names the approval
//     (record_table 'approvals', record_id the approval id). Guards do not apply (FLOW-5 is not a
//     table move).
//   - setWaiting / clearWaiting(returnId, actor, why) and waitingOnClient(returnId) -> { since:
//     Date | null; periods: { from: Date; to: Date | null }[] } (FLOW-3): one returns.events row
//     each, no state event, no state change.
//   - takeHold(returnId, holder) -> { ok: true } | { ok: false; reason; heldBy };
//     releaseHold(returnId, holder) -> { ok: boolean }; holder(returnId) -> string | null
//     (FLOW-10). Idle time counts from the last take; the holder taking it again renews it.
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import type { Clock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import { ReturnIdSchema, type ReturnId } from '../../contracts/ids'
import { RETURN_STATES } from '../../contracts/records'
import {
  ApprovalFingerprintSchema,
  type ApprovalFingerprint,
  type ApprovalFingerprintSource,
  type ChangedItem,
  type Guard,
  type GuardResult,
} from '../../contracts/lifecycle'
import { BLUEPRINT_MOVES, pathTo, type State } from './__fixtures__/blueprint-moves'
import { MOVES, createLifecycle } from './index'

const T0 = '2026-03-16T09:00:00-04:00'
const PREPARER = 'Pat Preparer (Test)'
const OTHER = 'Robin Second (Test)'
const OPS = 'Ops Desk (Test)'
const HOUR = 60 * 60 * 1000

/** A clock the test moves forward by hand. */
function steppingClock(iso: string): Clock & { advance(ms: number): void; set(iso: string): void } {
  let at = new Date(iso).getTime()
  return {
    now: () => new Date(at),
    advance: (ms: number) => {
      at += ms
    },
    set: (s: string) => {
      at = new Date(s).getTime()
    },
  }
}

const pass: Guard = () => ({ ok: true })
/** Every guard of the table passes. */
function allPass(): Record<string, Guard> {
  return Object.fromEntries(MOVES.map((m) => [m.guard, pass]))
}
function guardOf(from: State, to: State): string {
  const m = MOVES.find((x) => x.from === from && x.to === to)
  if (!m) throw new Error(`no move ${from}->${to} in MOVES`)
  return m.guard
}

let n = 0
async function newReturn(db: PGlite): Promise<ReturnId> {
  n += 1
  const id = ReturnIdSchema.parse(`ret-f02-${String(n)}`)
  await db.query(
    `insert into returns.returns (id, entity_name, year_end, state) values ($1, $2, '2025-12-31', 'intake')`,
    [id, 'Quillfeather Sample Widgets Inc. (Test)'],
  )
  return id
}

async function stateOf(db: PGlite, id: ReturnId): Promise<string> {
  const r = await db.query<{ state: string }>('select state from returns.returns where id = $1', [id])
  return r.rows[0]?.state ?? '(no return)'
}

interface StateEventRow {
  from_state: string
  to_state: string
  actor: string
  occurred_at: Date
  reason: string
}
async function stateEvents(db: PGlite, id: ReturnId): Promise<StateEventRow[]> {
  const r = await db.query<StateEventRow>(
    'select from_state, to_state, actor, occurred_at, reason from returns.state_events where return_id = $1 order by seq',
    [id],
  )
  return r.rows
}

interface EventRow {
  record_table: string
  record_id: string
  actor: string
  occurred_at: Date
  reason: string
}
async function genericEvents(db: PGlite, recordId: string): Promise<EventRow[]> {
  const r = await db.query<EventRow>(
    'select record_table, record_id, actor, occurred_at, reason from returns.events where record_id = $1 order by occurred_at, created_at',
    [recordId],
  )
  return r.rows
}

/** Every event about this return, in both event tables. */
async function eventCount(db: PGlite, id: ReturnId): Promise<number> {
  return (await stateEvents(db, id)).length + (await genericEvents(db, id)).length
}

type Lifecycle = ReturnType<typeof createLifecycle>

/** Walks a new return from intake to `to` through table moves, every guard passing. */
async function returnIn(db: PGlite, lc: Lifecycle, to: State): Promise<ReturnId> {
  const id = await newReturn(db)
  for (const s of pathTo(to)) {
    const r = await lc.move(id, s, PREPARER, `fixture walk to ${to}`)
    if (!r.ok) throw new Error(`fixture walk refused at ${s}: ${r.reason}`)
  }
  expect(await stateOf(db, id)).toBe(to)
  return id
}

const allowedFrom = (s: State): Set<State> =>
  new Set(BLUEPRINT_MOVES.filter(([f]) => f === s).map(([, t]) => t))

// ---- FLOW-2: the table ---------------------------------------------------------------------------

describe('F02 moves (FLOW-2)', () => {
  for (const from of RETURN_STATES) {
    test(`FLOW-2 from ${from}: every move not in blueprint 02's table is refused and writes nothing`, async () => {
      const db = await cloneTestDb()
      const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass() })
      const id = await returnIn(db, lc, from)
      const before = await eventCount(db, id)
      const allowed = allowedFrom(from)
      for (const to of RETURN_STATES) {
        if (allowed.has(to)) continue
        const r = await lc.move(id, to, PREPARER, 'planted: a move the table does not hold')
        expect(r.ok, `${from}->${to} must be refused`).toBe(false)
        if (!r.ok) expect(r.reason.trim(), `${from}->${to} needs a reason`).not.toBe('')
        expect(await stateOf(db, id)).toBe(from)
      }
      expect(await eventCount(db, id)).toBe(before)
    })
  }

  for (const [from, to] of BLUEPRINT_MOVES) {
    test(`FLOW-2 ${from} -> ${to} is allowed when its guard passes`, async () => {
      const db = await cloneTestDb()
      const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass() })
      const id = await returnIn(db, lc, from)
      const r = await lc.move(id, to, PREPARER, `${from} done`)
      expect(r).toMatchObject({ ok: true })
      expect(await stateOf(db, id)).toBe(to)
    })
  }

  test('FLOW-2 planted fault: a guard that refuses stops its move with the guard\'s reason, and nothing is written', async () => {
    const db = await cloneTestDb()
    const seen: { from: string; to: string; actor: string; returnId: string }[] = []
    const refuse: Guard = (ctx) => {
      seen.push({ from: ctx.from, to: ctx.to, actor: ctx.actor, returnId: ctx.returnId })
      return { ok: false, reason: 'planted: lock export not uploaded' } satisfies GuardResult
    }
    const guards = { ...allPass(), [guardOf('prepare', 'trace')]: refuse }
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards })
    const id = await returnIn(db, lc, 'prepare')
    const before = await eventCount(db, id)
    const r = await lc.move(id, 'trace', PREPARER, 'Ready pressed')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('planted: lock export not uploaded')
    expect(seen).toEqual([{ from: 'prepare', to: 'trace', actor: PREPARER, returnId: id }])
    expect(await stateOf(db, id)).toBe('prepare')
    expect(await eventCount(db, id)).toBe(before)
  })

  test('FLOW-2 a guard a later card owns starts as "not built yet" and refuses', async () => {
    const db = await cloneTestDb()
    const missing = guardOf('trace', 'respond')
    const guards = Object.fromEntries(Object.entries(allPass()).filter(([name]) => name !== missing))
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards })
    const id = await returnIn(db, lc, 'trace')
    const r = await lc.move(id, 'respond', PREPARER, 'signed the trace')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/not built yet/i)
    expect(await stateOf(db, id)).toBe('trace')
  })

  test('FLOW-2 a move of a return that does not exist is refused', async () => {
    const db = await cloneTestDb()
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass() })
    const r = await lc.move(ReturnIdSchema.parse('ret-f02-missing'), 'evidence', PREPARER, 'created')
    expect(r.ok).toBe(false)
  })
})

// ---- FLOW-1: one event per move ------------------------------------------------------------------

describe('F02 events (FLOW-1)', () => {
  test('FLOW-1 every move writes exactly one event with who, when, from, to and why', async () => {
    const db = await cloneTestDb()
    const clock = steppingClock(T0)
    const lc = createLifecycle({ db, clock, guards: allPass() })
    const id = await newReturn(db)
    const walk = pathTo('closed')
    let prev: State = 'intake'
    for (const [i, to] of walk.entries()) {
      clock.advance(HOUR)
      const actor = i % 2 === 0 ? PREPARER : OPS
      const why = `step ${String(i)}: ${prev} finished`
      const before = await eventCount(db, id)
      const r = await lc.move(id, to, actor, why)
      expect(r, `${prev}->${to}`).toMatchObject({ ok: true })
      expect(await eventCount(db, id), `${prev}->${to} writes one event`).toBe(before + 1)
      const last = (await stateEvents(db, id)).at(-1)
      expect(last).toEqual({ from_state: prev, to_state: to, actor, occurred_at: clock.now(), reason: why })
      prev = to
    }
    expect(await stateOf(db, id)).toBe('closed')
  })

  test('FLOW-1 a move with no who or no why is refused and writes nothing', async () => {
    const db = await cloneTestDb()
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass() })
    const id = await newReturn(db)
    for (const [actor, why] of [['', 'created'], ['   ', 'created'], [PREPARER, ''], [PREPARER, '  ']] as const) {
      const r = await lc.move(id, 'evidence', actor, why)
      expect(r.ok, `actor ${JSON.stringify(actor)} why ${JSON.stringify(why)}`).toBe(false)
    }
    expect(await stateOf(db, id)).toBe('intake')
    expect(await eventCount(db, id)).toBe(0)
  })
})

// ---- FLOW-4, FLOW-5: voiding approval ------------------------------------------------------------

const FINGERPRINT: ApprovalFingerprint = {
  cells: [
    { cellId: 'IDENT.Ident121', value: '2025-12-31' },
    { cellId: 'GIFI100.Gifi1000', value: '15000' },
    // a review line (RT-10): net income for tax
    { cellId: 'FDONE.Ttwone66', value: '48210' },
    { cellId: 'GIFI100.Gifi2620', value: null },
  ],
  facts: [{ id: 'fact-f02-bank-close', version: 2 }],
  entries: [{ id: 'entry-f02-accrual', version: 1 }],
  judgmentInputs: [{ id: 'judgment-f02-cca', version: 1 }],
}
const APPROVAL_ID = 'approval-f02-1'
const fixtureApprovals: ApprovalFingerprintSource = {
  current: () => Promise.resolve({ approvalId: APPROVAL_ID, fingerprint: FINGERPRINT }),
}

describe('F02 voiding approval (FLOW-4, FLOW-5)', () => {
  test('FLOW-4 the fingerprint holds lock-export cells (review lines included) and fact, entry and judgment input ids with versions; a part missing is refused', () => {
    expect(ApprovalFingerprintSchema.parse(FINGERPRINT)).toEqual(FINGERPRINT)
    for (const part of ['cells', 'facts', 'entries', 'judgmentInputs'] as const) {
      const partial = Object.fromEntries(Object.entries(FINGERPRINT).filter(([k]) => k !== part))
      expect(ApprovalFingerprintSchema.safeParse(partial).success, `without ${part}`).toBe(false)
    }
    const noVersion = { ...FINGERPRINT, facts: [{ id: 'fact-f02-bank-close' }] }
    expect(ApprovalFingerprintSchema.safeParse(noVersion).success).toBe(false)
  })

  const fingerprinted: readonly [string, ChangedItem][] = [
    ['a lock-export cell', { kind: 'cell', cellId: 'GIFI100.Gifi1000' }],
    ['a review line', { kind: 'cell', cellId: 'FDONE.Ttwone66' }],
    ['a cell exported blank', { kind: 'cell', cellId: 'GIFI100.Gifi2620' }],
    ['a linked fact', { kind: 'fact', id: 'fact-f02-bank-close' }],
    ['a linked adjusting entry', { kind: 'entry', id: 'entry-f02-accrual' }],
    ['a linked judgment input', { kind: 'judgmentInput', id: 'judgment-f02-cca' }],
  ]
  for (const [what, item] of fingerprinted) {
    for (const from of ['approved', 'ready_to_file'] as const) {
      test(`FLOW-5 a change to ${what} in the fingerprint voids the approval and returns the state from ${from} to trace`, async () => {
        const db = await cloneTestDb()
        const clock = steppingClock(T0)
        const lc = createLifecycle({ db, clock, guards: allPass(), approvals: fixtureApprovals })
        const id = await returnIn(db, lc, from)
        clock.advance(HOUR)
        const before = (await stateEvents(db, id)).length
        const r = await lc.voidApproval(id, [item])
        expect(r).toEqual({ voided: true, items: [item] })
        expect(await stateOf(db, id)).toBe('trace')
        const events = await stateEvents(db, id)
        expect(events.length).toBe(before + 1)
        expect(events.at(-1)).toMatchObject({ from_state: from, to_state: 'trace', occurred_at: clock.now() })
        expect(events.at(-1)?.reason.trim()).not.toBe('')
        const voids = await genericEvents(db, APPROVAL_ID)
        expect(voids).toHaveLength(1)
        expect(voids[0]).toMatchObject({ record_table: 'approvals', record_id: APPROVAL_ID, occurred_at: clock.now() })
      })
    }
  }

  const unrelated: readonly [string, ChangedItem][] = [
    ['a cell not in the lock export', { kind: 'cell', cellId: 'GIFI100.Gifi9999' }],
    ['a fact no fingerprinted cell links to', { kind: 'fact', id: 'fact-f02-unlinked' }],
    ['an entry not in the fingerprint', { kind: 'entry', id: 'entry-f02-other' }],
    ['a judgment input not in the fingerprint', { kind: 'judgmentInput', id: 'judgment-f02-other' }],
    ['a fact whose id matches a fingerprinted entry (kinds differ)', { kind: 'fact', id: 'entry-f02-accrual' }],
    ['a cell whose id matches a fingerprinted fact (kinds differ)', { kind: 'cell', cellId: 'fact-f02-bank-close' }],
  ]
  for (const [what, item] of unrelated) {
    test(`FLOW-5 a change to ${what} does not void the approval: nothing changes`, async () => {
      const db = await cloneTestDb()
      const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass(), approvals: fixtureApprovals })
      const id = await returnIn(db, lc, 'approved')
      const before = await eventCount(db, id)
      const r = await lc.voidApproval(id, [item])
      expect(r).toEqual({ voided: false })
      expect(await stateOf(db, id)).toBe('approved')
      expect(await eventCount(db, id)).toBe(before)
      expect(await genericEvents(db, APPROVAL_ID)).toEqual([])
    })
  }

  test('FLOW-5 with related and unrelated changes together, only the fingerprinted ones are named (the CPA sees only those)', async () => {
    const db = await cloneTestDb()
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass(), approvals: fixtureApprovals })
    const id = await returnIn(db, lc, 'approved')
    const related: ChangedItem = { kind: 'cell', cellId: 'FDONE.Ttwone66' }
    const relatedFact: ChangedItem = { kind: 'fact', id: 'fact-f02-bank-close' }
    const r = await lc.voidApproval(id, [{ kind: 'cell', cellId: 'GIFI100.Gifi9999' }, related, { kind: 'fact', id: 'fact-f02-unlinked' }, relatedFact])
    expect(r.voided).toBe(true)
    if (r.voided) expect(r.items).toEqual([related, relatedFact])
    expect(await stateOf(db, id)).toBe('trace')
    expect((await stateEvents(db, id)).filter((e) => e.to_state === 'trace' && e.from_state === 'approved')).toHaveLength(1)
  })

  test('FLOW-5 an empty change list voids nothing', async () => {
    const db = await cloneTestDb()
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass(), approvals: fixtureApprovals })
    const id = await returnIn(db, lc, 'approved')
    expect(await lc.voidApproval(id, [])).toEqual({ voided: false })
    expect(await stateOf(db, id)).toBe('approved')
  })
})

// ---- FLOW-3: the waiting flag --------------------------------------------------------------------

describe('F02 waiting on the client (FLOW-3)', () => {
  test('FLOW-3 setting "waiting on the client" writes a dated flag with one event and leaves the state as it was', async () => {
    const db = await cloneTestDb()
    const clock = steppingClock(T0)
    const lc = createLifecycle({ db, clock, guards: allPass() })
    const id = await returnIn(db, lc, 'qa')
    const statesBefore = await stateEvents(db, id)
    const before = await eventCount(db, id)
    clock.set('2026-03-17T10:00:00-04:00')
    await lc.setWaiting(id, PREPARER, 'questions sent to the client')
    expect(await stateOf(db, id)).toBe('qa')
    expect(await stateEvents(db, id)).toEqual(statesBefore)
    expect(await eventCount(db, id)).toBe(before + 1)
    const ev = (await genericEvents(db, id)).at(-1)
    expect(ev).toMatchObject({ actor: PREPARER, occurred_at: new Date('2026-03-17T10:00:00-04:00'), reason: 'questions sent to the client' })
    expect(await lc.waitingOnClient(id)).toEqual({
      since: new Date('2026-03-17T10:00:00-04:00'),
      periods: [{ from: new Date('2026-03-17T10:00:00-04:00'), to: null }],
    })
  })

  test('FLOW-3 clearing it writes an event and keeps the earlier dates', async () => {
    const db = await cloneTestDb()
    const clock = steppingClock(T0)
    const lc = createLifecycle({ db, clock, guards: allPass() })
    const id = await returnIn(db, lc, 'qa')
    const d1 = new Date('2026-03-17T10:00:00-04:00')
    const d2 = new Date('2026-03-24T15:30:00-04:00')
    const d3 = new Date('2026-04-02T09:15:00-04:00')
    const d4 = new Date('2026-04-06T11:45:00-04:00')
    clock.set(d1.toISOString())
    await lc.setWaiting(id, PREPARER, 'questions sent')
    clock.set(d2.toISOString())
    const before = await eventCount(db, id)
    await lc.clearWaiting(id, PREPARER, 'all answered')
    expect(await eventCount(db, id)).toBe(before + 1)
    expect(await stateOf(db, id)).toBe('qa')
    expect(await lc.waitingOnClient(id)).toEqual({ since: null, periods: [{ from: d1, to: d2 }] })
    clock.set(d3.toISOString())
    await lc.setWaiting(id, PREPARER, 'a follow-up question')
    clock.set(d4.toISOString())
    await lc.clearWaiting(id, OPS, 'answered')
    expect(await lc.waitingOnClient(id)).toEqual({
      since: null,
      periods: [
        { from: d1, to: d2 },
        { from: d3, to: d4 },
      ],
    })
    expect(await stateOf(db, id)).toBe('qa')
    expect((await genericEvents(db, id)).map((e) => e.occurred_at)).toEqual([d1, d2, d3, d4])
  })

  test('FLOW-3 a return never flagged is not waiting', async () => {
    const db = await cloneTestDb()
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass() })
    const id = await returnIn(db, lc, 'gaps')
    expect(await lc.waitingOnClient(id)).toEqual({ since: null, periods: [] })
  })
})

// ---- FLOW-10: holds ------------------------------------------------------------------------------

describe('F02 holds (FLOW-10)', () => {
  test('FLOW-10 a second preparer cannot take a held return; the refusal names the holder', async () => {
    const db = await cloneTestDb()
    const clock = steppingClock(T0)
    const lc = createLifecycle({ db, clock, guards: allPass() })
    const id = await returnIn(db, lc, 'prepare')
    expect(await lc.takeHold(id, PREPARER)).toMatchObject({ ok: true })
    expect(await lc.holder(id)).toBe(PREPARER)
    clock.advance(4 * HOUR - 60_000)
    const r = await lc.takeHold(id, OTHER)
    expect(r).toMatchObject({ ok: false, heldBy: PREPARER })
    if (!r.ok) expect(r.reason.trim()).not.toBe('')
    expect(await lc.holder(id)).toBe(PREPARER)
  })

  test('FLOW-10 an expired hold (4 hours idle) can be taken, and then only the new holder holds it', async () => {
    const db = await cloneTestDb()
    const clock = steppingClock(T0)
    const lc = createLifecycle({ db, clock, guards: allPass() })
    const id = await returnIn(db, lc, 'prepare')
    await lc.takeHold(id, PREPARER)
    clock.advance(4 * HOUR + 1000)
    expect(await lc.holder(id)).toBeNull()
    expect(await lc.takeHold(id, OTHER)).toMatchObject({ ok: true })
    expect(await lc.holder(id)).toBe(OTHER)
    expect(await lc.takeHold(id, PREPARER)).toMatchObject({ ok: false, heldBy: OTHER })
  })

  test('FLOW-10 the holder taking it again renews the idle time', async () => {
    const db = await cloneTestDb()
    const clock = steppingClock(T0)
    const lc = createLifecycle({ db, clock, guards: allPass() })
    const id = await returnIn(db, lc, 'prepare')
    await lc.takeHold(id, PREPARER)
    clock.advance(3 * HOUR)
    expect(await lc.takeHold(id, PREPARER)).toMatchObject({ ok: true })
    clock.advance(3 * HOUR)
    expect(await lc.takeHold(id, OTHER)).toMatchObject({ ok: false, heldBy: PREPARER })
    clock.advance(HOUR + 1000)
    expect(await lc.takeHold(id, OTHER)).toMatchObject({ ok: true })
  })

  test('FLOW-10 only the holder can release; after release another preparer can take it at once', async () => {
    const db = await cloneTestDb()
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass() })
    const id = await returnIn(db, lc, 'prepare')
    await lc.takeHold(id, PREPARER)
    expect(await lc.releaseHold(id, OTHER)).toMatchObject({ ok: false })
    expect(await lc.holder(id)).toBe(PREPARER)
    expect(await lc.releaseHold(id, PREPARER)).toMatchObject({ ok: true })
    expect(await lc.holder(id)).toBeNull()
    expect(await lc.takeHold(id, OTHER)).toMatchObject({ ok: true })
    expect(await lc.holder(id)).toBe(OTHER)
  })

  test('FLOW-10 holds of different returns are independent', async () => {
    const db = await cloneTestDb()
    const lc = createLifecycle({ db, clock: steppingClock(T0), guards: allPass() })
    const a = await returnIn(db, lc, 'prepare')
    const b = await returnIn(db, lc, 'prepare')
    expect(await lc.takeHold(a, PREPARER)).toMatchObject({ ok: true })
    expect(await lc.takeHold(b, OTHER)).toMatchObject({ ok: true })
    expect(await lc.holder(a)).toBe(PREPARER)
    expect(await lc.holder(b)).toBe(OTHER)
  })
})
