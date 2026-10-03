// @mutate
// Stryker disable all: database glue; the db project covers it and Stryker runs unit tests only (vitest.mutate.config.ts). The decisions it makes live in logic.ts, which is mutation-tested.
// F02 lifecycle: one function moves a return and refuses what blueprint 02's table does not allow.
import type { PGlite, Transaction } from '@electric-sql/pglite'
import type { Clock } from '../../core/clock'
import { newId } from '../../core/ids'
import type { ReturnId } from '../../contracts/ids'
import { isBlank } from '../../contracts/text'
import type { ApprovalFingerprintSource, ChangedItem, Guard, ReturnState } from '../../contracts/lifecycle'
import { blankWho, changedInFingerprint, findMove, foldWaiting, holdExpired, hasBlankId, type WaitRow } from './logic'
import { HOLD_IDLE_MS } from './moves'

export { MOVES, HOLD_IDLE_MS } from './moves'
export type { Move } from './moves'
export { dueDates } from './dates'

type Refused = { ok: false; reason: string }
type Ok = { ok: true }
export type VoidResult = { voided: true; items: ChangedItem[] } | { voided: false; reason?: string }

/** States in which an approval stands (FLOW-5): from approval until the return is filed. */
const APPROVED_STATES: readonly ReturnState[] = ['approved', 'client_sign', 'ready_to_file']

class Refusal extends Error {}

export interface LifecycleOptions {
  db: PGlite
  clock: Clock
  guards?: Record<string, Guard>
  approvals?: ApprovalFingerprintSource
}

const refuse = (reason: string): Refused => ({ ok: false, reason })

export function createLifecycle(opts: LifecycleOptions) {
  const { db, clock } = opts

  const at = (): string => clock.now().toISOString()

  async function lockedState(tx: Transaction, returnId: string): Promise<ReturnState | null> {
    const r = await tx.query<{ state: ReturnState }>('select state from returns.returns where id = $1 for update', [returnId])
    return r.rows[0]?.state ?? null
  }

  async function stateEvent(tx: Transaction, returnId: string, from: ReturnState, to: ReturnState, actor: string, why: string): Promise<void> {
    await tx.query(
      `insert into returns.state_events (id, return_id, from_state, to_state, actor, occurred_at, reason)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [newId(), returnId, from, to, actor, at(), why],
    )
    await tx.query('update returns.returns set state = $2 where id = $1', [returnId, to])
  }

  async function atomically<T>(work: (tx: Transaction) => Promise<T>): Promise<T | Refused> {
    try {
      return await db.transaction(work)
    } catch (e) {
      return refuse(e instanceof Refusal ? e.message : `nothing was kept: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // FX5: given the caller's transaction (tx), the move runs inside it: rule refusals return { ok: false },
  // a database error throws so the caller's transaction rolls back. Without tx it opens its own, as before.
  async function move(returnId: ReturnId, to: ReturnState, actor: string, why: string, tx?: Transaction): Promise<Ok | Refused> {
    const blank = blankWho(actor, why)
    if (blank) return refuse(blank)
    const cur = await (tx ?? db).query<{ state: ReturnState }>('select state from returns.returns where id = $1', [returnId])
    const from = cur.rows[0]?.state
    if (from === undefined) return refuse(`no return ${returnId}`)
    const m = findMove(from, to)
    if (!m) return refuse(`blueprint 02 has no move from ${from} to ${to}`)
    const guard = opts.guards?.[m.guard]
    if (!guard) return refuse(`guard ${m.guard} is not built yet`)
    const verdict = await guard({ returnId, from, to, actor })
    if (!verdict.ok) return refuse(verdict.reason)
    const apply = async (t: Transaction): Promise<Ok | Refused> => {
      if ((await lockedState(t, returnId)) !== from) throw new Refusal(`return ${returnId} moved while the guard ran; try again`)
      await stateEvent(t, returnId, from, to, actor, why)
      return { ok: true }
    }
    if (!tx) return atomically<Ok | Refused>(apply)
    try {
      return await apply(tx)
    } catch (e) {
      if (e instanceof Refusal) return refuse(e.message)
      throw e
    }
  }

  async function voidApproval(returnId: ReturnId, changed: readonly ChangedItem[], actor: string, why: string): Promise<VoidResult> {
    const blank = blankWho(actor, why)
    if (blank) return { voided: false, reason: blank }
    if (changed.some(hasBlankId)) return { voided: false, reason: 'a changed item has a blank id' }
    if (changed.length === 0) return { voided: false }
    if (!opts.approvals) return { voided: false, reason: 'the approval fingerprint is not built yet' }
    const current = await opts.approvals.current(returnId)
    if (!current) return { voided: false }
    const items = changedInFingerprint(current.fingerprint, changed)
    if (items.length === 0) return { voided: false }
    const done = await atomically<VoidResult>(async (tx) => {
      const from = await lockedState(tx, returnId)
      if (from === null) throw new Refusal(`no return ${returnId}`)
      if (!APPROVED_STATES.includes(from)) throw new Refusal(`return ${returnId} is in ${from}, with no approval standing`)
      await stateEvent(tx, returnId, from, 'trace', actor, why)
      await tx.query(
        `insert into returns.events (id, record_table, record_id, actor, occurred_at, from_value, to_value, reason)
         values ($1, 'approvals', $2, $3, $4, null, $5::jsonb, $6)`,
        [newId(), current.approvalId, actor, at(), JSON.stringify({ voided: true, items }), why],
      )
      return { voided: true, items }
    })
    return 'voided' in done ? done : { voided: false, reason: done.reason }
  }

  // FLOW-3: "waiting on the client" is a dated flag in returns.events, never a state.
  async function waitRows(q: PGlite | Transaction, returnId: string): Promise<WaitRow[]> {
    const r = await q.query<WaitRow>(
      `select occurred_at, (to_value ->> 'waitingOnClient')::boolean as flag from returns.events
       where record_table = 'returns' and record_id = $1 and to_value ? 'waitingOnClient'
       order by occurred_at, id`,
      [returnId],
    )
    return r.rows
  }

  async function waitingOnClient(returnId: ReturnId): Promise<{ since: Date | null; periods: { from: Date; to: Date | null }[] }> {
    return foldWaiting(await waitRows(db, returnId))
  }

  async function setFlag(returnId: ReturnId, flag: boolean, actor: string, why: string): Promise<Ok | Refused> {
    const blank = blankWho(actor, why)
    if (blank) return refuse(blank)
    return atomically<Ok | Refused>(async (tx) => {
      if ((await lockedState(tx, returnId)) === null) throw new Refusal(`no return ${returnId}`)
      const rows = await waitRows(tx, returnId)
      const waiting = rows.at(-1)?.flag === true
      if (waiting === flag) throw new Refusal(flag ? 'already waiting on the client' : 'not waiting on the client')
      await tx.query(
        `insert into returns.events (id, record_table, record_id, actor, occurred_at, from_value, to_value, reason)
         values ($1, 'returns', $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [newId(), returnId, actor, at(), JSON.stringify({ waitingOnClient: waiting }), JSON.stringify({ waitingOnClient: flag }), why],
      )
      return { ok: true }
    })
  }

  // FLOW-10: one holder per return; idle time counts from the last take.
  interface HoldRow { id: string; holder: string; taken_at: Date }
  const expired = (h: HoldRow): boolean => holdExpired(h.taken_at, clock.now())

  async function openHold(q: PGlite | Transaction, returnId: string): Promise<HoldRow | null> {
    const r = await q.query<HoldRow>(
      'select id, holder, taken_at from returns.holds where return_id = $1 and released_at is null order by taken_at desc limit 1',
      [returnId],
    )
    return r.rows[0] ?? null
  }

  async function holder(returnId: ReturnId): Promise<string | null> {
    const h = await openHold(db, returnId)
    return h && !expired(h) ? h.holder : null
  }

  async function takeHold(returnId: ReturnId, who: string): Promise<Ok | (Refused & { heldBy?: string })> {
    if (isBlank(who)) return refuse('the holder is missing')
    const done = await atomically<Ok | (Refused & { heldBy?: string })>(async (tx) => {
      if ((await lockedState(tx, returnId)) === null) throw new Refusal(`no return ${returnId}`)
      const h = await openHold(tx, returnId)
      if (h && !expired(h)) {
        if (h.holder !== who) return { ok: false, reason: `${h.holder} holds this return`, heldBy: h.holder }
        await tx.query('update returns.holds set taken_at = $2 where id = $1', [h.id, at()])
        return { ok: true }
      }
      if (h) {
        await tx.query('update returns.holds set released_at = $2, reason = $3 where id = $1', [
          h.id, new Date(h.taken_at.getTime() + HOLD_IDLE_MS).toISOString(), 'expired after idle time',
        ])
      }
      await tx.query('insert into returns.holds (id, return_id, holder, taken_at) values ($1, $2, $3, $4)', [newId(), returnId, who, at()])
      return { ok: true }
    })
    return done
  }

  async function releaseHold(returnId: ReturnId, who: string): Promise<Ok | Refused> {
    if (isBlank(who)) return refuse('the holder is missing')
    return atomically<Ok | Refused>(async (tx) => {
      if ((await lockedState(tx, returnId)) === null) throw new Refusal(`no return ${returnId}`)
      const h = await openHold(tx, returnId)
      if (!h || expired(h) || h.holder !== who) throw new Refusal('you do not hold this return')
      await tx.query('update returns.holds set released_at = $2 where id = $1', [h.id, at()])
      return { ok: true }
    })
  }

  return {
    move,
    voidApproval,
    setWaiting: (returnId: ReturnId, actor: string, why: string) => setFlag(returnId, true, actor, why),
    clearWaiting: (returnId: ReturnId, actor: string, why: string) => setFlag(returnId, false, actor, why),
    waitingOnClient,
    takeHold,
    releaseHold,
    holder,
  }
}

export type Lifecycle = ReturnType<typeof createLifecycle>
