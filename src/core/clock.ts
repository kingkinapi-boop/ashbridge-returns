// @mutate
// The injectable clock (code rule: time comes from here). Tests pin it.
export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }

export function fixedClock(iso: string): Clock {
  const at = new Date(iso)
  return { now: () => new Date(at.getTime()) }
}

let current: Clock = systemClock

export function getClock(): Clock {
  return current
}

export function setClock(clock: Clock): void {
  current = clock
}

export function now(): Date {
  return current.now()
}
