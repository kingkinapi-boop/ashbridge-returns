// @mutate
// Blueprint 02's move table (FLOW-2): each move has its own named guard.
import type { ReturnState } from '../../contracts/lifecycle'

export interface Move {
  from: ReturnState
  to: ReturnState
  guard: string
}

const PAIRS: readonly (readonly [ReturnState, ReturnState])[] = [
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

export const MOVES: readonly Move[] = PAIRS.map(([from, to]) => ({ from, to, guard: `${from}_to_${to}` }))

/** FLOW-10 (amber A11): a hold expires after this much idle time. */
export const HOLD_IDLE_MS = 4 * 60 * 60 * 1000
