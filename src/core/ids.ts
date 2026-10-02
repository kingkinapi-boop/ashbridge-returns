// @mutate
// Sortable ids: 12 hex digits of milliseconds, 4 of a counter, then random hex.
import { randomBytes } from 'node:crypto'
import { now } from './clock'

type RandomSource = (byteCount: number) => Uint8Array

let random: RandomSource = (n) => randomBytes(n)

/** Tests pin the random part of ids here (ARC-16); resetIdRandom puts the real source back. */
export function setIdRandom(source: RandomSource): void {
  random = source
}

export function resetIdRandom(): void {
  random = (n) => randomBytes(n)
}

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
    Buffer.from(random(4)).toString('hex')
  )
}
