// F02 spec fixture (spec-writer; builders never edit): blueprint 02's move table written out by
// hand, the "Next" column of each row. The tests compare the product's MOVES with this list.
import type { ReturnRecord } from '../../../contracts/records'

export type State = ReturnRecord['state']

export const BLUEPRINT_MOVES: readonly (readonly [State, State])[] = [
  ['intake', 'evidence'],
  ['evidence', 'gaps'],
  ['gaps', 'qa'],
  ['gaps', 'build'],
  ['qa', 'build'],
  ['build', 'prepare'],
  ['prepare', 'trace'],
  ['trace', 'respond'],
  ['respond', 'review'],
  ['review', 'approved'],
  ['review', 'rework'],
  ['rework', 'review'],
  ['approved', 'client_sign'],
  ['client_sign', 'ready_to_file'],
  ['ready_to_file', 'filed'],
  ['filed', 'assessed'],
  ['assessed', 'closed'],
]

/** The shortest path of table moves from intake to `to` (breadth first over BLUEPRINT_MOVES). */
export function pathTo(to: State): State[] {
  const prev = new Map<State, State>()
  const seen = new Set<State>(['intake'])
  const queue: State[] = ['intake']
  while (queue.length > 0) {
    const s = queue.shift() as State
    if (s === to) break
    for (const [f, t] of BLUEPRINT_MOVES) {
      if (f === s && !seen.has(t)) {
        seen.add(t)
        prev.set(t, s)
        queue.push(t)
      }
    }
  }
  if (!seen.has(to)) throw new Error(`fixture: ${to} cannot be reached from intake`)
  const path: State[] = []
  for (let s: State | undefined = to; s !== undefined && s !== 'intake'; s = prev.get(s)) path.unshift(s)
  return path
}
