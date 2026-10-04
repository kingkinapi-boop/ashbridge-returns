// @mutate
// The decisions the lifecycle makes, apart from the database: kept pure so unit tests and mutation testing reach them.
import { isBlank } from '../../contracts/text'
import type { ApprovalFingerprint, ChangedItem, ReturnState } from '../../contracts/lifecycle'
import { HOLD_IDLE_MS, MOVES, type Move } from './moves'

export function findMove(from: ReturnState, to: ReturnState): Move | undefined {
  return MOVES.find((m) => m.from === from && m.to === to)
}

/** FLOW-1: who and why are always given; a refusal reason, or null when both are fine. */
export function blankWho(actor: string, why: string): string | null {
  if (isBlank(actor)) return 'who made this change is missing'
  if (isBlank(why)) return 'why is missing'
  return null
}

export function hasBlankId(i: ChangedItem): boolean {
  return isBlank(i.kind === 'cell' ? i.cellId : i.id)
}

function itemKey(i: ChangedItem): string {
  return i.kind === 'cell' ? `cell:${i.cellId}` : `${i.kind}:${i.id}`
}

/** FLOW-5: the changed items that are in the approval fingerprint, in the order given, each once. */
export function changedInFingerprint(fp: ApprovalFingerprint, changed: readonly ChangedItem[]): ChangedItem[] {
  const inFingerprint = new Set<string>([
    ...fp.cells.map((c) => `cell:${c.cellId}`),
    ...fp.facts.map((f) => `fact:${f.id}`),
    ...fp.entries.map((f) => `entry:${f.id}`),
    ...fp.judgmentInputs.map((f) => `judgmentInput:${f.id}`),
  ])
  const seen = new Set<string>()
  return changed.filter((i) => {
    const k = itemKey(i)
    if (!inFingerprint.has(k) || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export interface WaitRow {
  occurred_at: Date
  flag: boolean
}

/** FLOW-3: flag events in order become dated periods; an open period means waiting now. */
export function foldWaiting(rows: readonly WaitRow[]): { since: Date | null; periods: { from: Date; to: Date | null }[] } {
  const periods: { from: Date; to: Date | null }[] = []
  for (const row of rows) {
    const open = periods.at(-1)
    if (row.flag && (!open || open.to !== null)) periods.push({ from: row.occurred_at, to: null })
    else if (!row.flag && open && open.to === null) open.to = row.occurred_at
  }
  const last = periods.at(-1)
  return { since: last && last.to === null ? last.from : null, periods }
}

/** FLOW-10: a hold is expired once it has been idle for HOLD_IDLE_MS (exactly that long counts). */
export function holdExpired(takenAt: Date, now: Date): boolean {
  return now.getTime() - takenAt.getTime() >= HOLD_IDLE_MS
}
