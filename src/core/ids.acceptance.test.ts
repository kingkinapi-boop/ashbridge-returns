// F00T (spec job): ids.ts tests by a worker who did not build it (reviews/REVIEW.md 2 Oct 01:50Z, findings 1 and 2).
// Ids: 12 hex digits of milliseconds, 4 of a same-millisecond counter, then 8 of random hex (4 bytes).
// The clock is pinned (clock.ts) and the random part is pinned through the injection point the build adds:
//   setIdRandom(source: (byteCount: number) => Uint8Array): void   and   resetIdRandom(): void
// (exported from ids.ts; name chosen by the spec job, amber).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { afterEach, describe, expect, test } from 'vitest'
import { fixedClock, setClock, systemClock } from './clock'
import * as ids from './ids'
import { readOwnSource } from './testing/read-own-source'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

type RandomSource = (byteCount: number) => Uint8Array
interface IdRandomInjection {
  setIdRandom?: (source: RandomSource) => void
  resetIdRandom?: () => void
}
const injection = ids as unknown as IdRandomInjection

/** Pins the random part of ids; fails by name until ids.ts exports the injection point. */
function pinRandom(source: RandomSource): void {
  expect(typeof injection.setIdRandom, 'ids.ts exports setIdRandom(source) (ARC-16)').toBe('function')
  expect(typeof injection.resetIdRandom, 'ids.ts exports resetIdRandom() (ARC-16)').toBe('function')
  injection.setIdRandom?.(source)
}

/** Bytes a0 a1 a2 a3 ... and a record of each request. */
function countingSource(requests: number[]): RandomSource {
  return (n) => {
    requests.push(n)
    return Uint8Array.from({ length: n }, (_, i) => 0xa0 + i)
  }
}

function at(iso: string): void {
  setClock(fixedClock(iso))
}

afterEach(() => {
  injection.resetIdRandom?.()
  setClock(systemClock)
})

describe('F00T ids.ts (ARC-16)', () => {
  test('ARC-16 the random part of an id is injectable: a pinned source gives the exact id on a pinned clock', () => {
    const requests: number[] = []
    pinRandom(countingSource(requests))
    at('2026-01-15T12:00:00.000Z') // 1768478400000 ms = 0x19bc186de00
    expect(ids.newId()).toBe('019bc186de00' + '0000' + 'a0a1a2a3')
    expect(requests).toEqual([4])
  })

  test('ARC-16 a second pinned source replaces the first', () => {
    pinRandom(() => Uint8Array.from([0xde, 0xad, 0xbe, 0xef]))
    at('2026-02-01T00:00:00.000Z')
    expect(ids.newId().slice(16)).toBe('deadbeef')
    pinRandom(() => Uint8Array.from([0x00, 0x01, 0x0f, 0xff]))
    at('2026-02-01T00:00:00.001Z')
    expect(ids.newId().slice(16)).toBe('00010fff')
  })

  test('ARC-16 an id is 24 lower-case hex digits; milliseconds padded to 12 and the counter to 4 (survivors ids.ts:17, 18)', () => {
    pinRandom(countingSource([]))
    at('1970-01-01T00:00:00.001Z')
    expect(ids.newId()).toBe('000000000001' + '0000' + 'a0a1a2a3')
    at('1970-01-01T00:00:00.255Z')
    const id = ids.newId()
    expect(id).toBe('0000000000ff' + '0000' + 'a0a1a2a3')
    expect(id).toMatch(/^[0-9a-f]{24}$/)
  })

  test('ARC-16 ids in the same millisecond count up from 0000; a new millisecond starts again at 0000 (survivors ids.ts:11, 12)', () => {
    pinRandom(countingSource([]))
    at('2026-03-01T09:30:00.000Z')
    const ms = Date.UTC(2026, 2, 1, 9, 30).toString(16).padStart(12, '0')
    const first = ids.newId()
    const second = ids.newId()
    const third = ids.newId()
    expect(first.slice(0, 16)).toBe(ms + '0000')
    expect(second.slice(0, 16)).toBe(ms + '0001')
    expect(third.slice(0, 16)).toBe(ms + '0002')
    at('2026-03-01T09:30:00.001Z')
    const next = Date.UTC(2026, 2, 1, 9, 30, 0, 1).toString(16).padStart(12, '0')
    expect(ids.newId().slice(0, 16)).toBe(next + '0000')
    expect(ids.newId().slice(0, 16)).toBe(next + '0001')
  })

  test('ARC-16 seventeen ids in one millisecond carry counters 0000 to 0010 in hex', () => {
    pinRandom(countingSource([]))
    at('2026-04-01T00:00:00.000Z')
    const counters = Array.from({ length: 17 }, () => ids.newId().slice(12, 16))
    expect(counters[0]).toBe('0000')
    expect(counters[9]).toBe('0009')
    expect(counters[10]).toBe('000a')
    expect(counters[16]).toBe('0010')
  })

  test('ARC-16 property (seed 20261006): ids made in order on a pinned clock sort in that order and are unique', () => {
    pinRandom(() => Uint8Array.from([0xff, 0xff, 0xff, 0xff]))
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 1, max: 2 ** 48 - 1 }), fc.integer({ min: 1, max: 5 })), { minLength: 1, maxLength: 20 }),
        (steps) => {
          // strictly increasing milliseconds, each used 1 to 5 times
          const times = [...new Set(steps.map(([ms]) => ms))].sort((a, b) => a - b)
          const made: string[] = []
          times.forEach((ms, i) => {
            setClock({ now: () => new Date(ms) })
            const repeats = steps[i]?.[1] ?? 1
            for (let r = 0; r < repeats; r++) made.push(ids.newId())
          })
          for (const id of made) expect(id).toMatch(/^[0-9a-f]{24}$/)
          expect([...made].sort()).toEqual(made)
          expect(new Set(made).size).toBe(made.length)
        },
      ),
      { seed: 20261006, numRuns: 200 },
    )
  })

  test('ARC-15 ids.ts is a mutation target (// @mutate in its first 5 lines)', () => {
    const head = readOwnSource(path.join(ROOT, 'src', 'core', 'ids.ts')).split('\n').slice(0, 5).join('\n')
    expect(head).toMatch(/\/\/ @mutate/)
  })
})
