// Sortable ids: 12 hex digits of milliseconds, 4 of a counter, then random hex.
import { randomBytes } from 'node:crypto'
import { now } from './clock'

let lastMs = 0
let counter = 0

export function newId(): string {
  const ms = now().getTime()
  if (ms === lastMs) counter += 1
  else {
    lastMs = ms
    counter = 0
  }
  return (
    ms.toString(16).padStart(12, '0') +
    counter.toString(16).padStart(4, '0') +
    randomBytes(4).toString('hex')
  )
}
