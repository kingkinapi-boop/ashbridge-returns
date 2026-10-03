// FX15 acceptance tests, unit twin (spec-writer; builders never edit this file).
// The pure lease check the queue's complete and fail use (A449): holdsLease(job, workerId, now) is
// true only when job.lease_holder is workerId and job.lease_until is after now. An expired lease
// with no re-claim is held by nobody, the old holder included. Mutation testing runs the unit
// project only, so every behaviour lease.acceptance.db.test.ts proves on the queue has its pure
// twin here (spec-writer step 4b, A04, A391).
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { JobSchema } from '../../contracts/jobs'
import type { Job } from '../../contracts/jobs'
import * as queueModule from './queue'

type HoldsLease = (job: Job, workerId: string, now: Date) => boolean

/** The export the card names; a clear failure until the build adds it. */
function holdsLease(job: Job, workerId: string, now: Date): boolean {
  const f = (queueModule as unknown as { holdsLease?: unknown }).holdsLease
  if (typeof f !== 'function') throw new Error('queue.ts does not export holdsLease(job, workerId, now) (FX15)')
  return (f as HoldsLease)(job, workerId, now)
}

const T0 = new Date('2026-03-02T15:00:00.000Z').getTime()
const MIN = 60_000
const SEED = 20261003
const at = (ms: number): Date => new Date(T0 + ms)

function job(over: Partial<Job> = {}): Job {
  return JobSchema.parse({
    id: 'job-lease-1',
    kind: 'read:page',
    return_id: null,
    idempotency_key: 'k-lease-1',
    input: { n: 1 },
    status: 'running',
    attempts: 1,
    max_attempts: 3,
    run_after: at(0),
    lease_holder: 'w-a',
    lease_until: at(10 * MIN),
    result: null,
    last_error: null,
    version_stamp: null,
    created_at: at(0),
    finished_at: null,
    is_test: true,
    ...over,
  })
}

/** What claim writes (queue.ts): status running, attempts + 1, the holder and its lease end. */
const claimed = (j: Job, workerId: string, now: number, leaseMs = 10 * MIN): Job =>
  job({ ...j, status: 'running', attempts: j.attempts + 1, lease_holder: workerId, lease_until: at(now + leaseMs) })

describe('ARC-5 only the worker holding a live lease holds the job', () => {
  test('ARC-5 the holder holds its job up to 1 ms before lease_until, and not at or after it', () => {
    const j = job()
    expect(holdsLease(j, 'w-a', at(0))).toBe(true)
    expect(holdsLease(j, 'w-a', at(10 * MIN - 1))).toBe(true)
    expect(holdsLease(j, 'w-a', at(10 * MIN))).toBe(false)
    expect(holdsLease(j, 'w-a', at(10 * MIN + 1))).toBe(false)
    expect(holdsLease(j, 'w-a', at(24 * 60 * MIN))).toBe(false)
  })

  test('ARC-5 a worker that is not the lease holder never holds the job, even while the lease is live', () => {
    const j = job()
    expect(holdsLease(j, 'w-b', at(0))).toBe(false)
    expect(holdsLease(j, 'w-b', at(5 * MIN))).toBe(false)
    expect(holdsLease(j, '', at(5 * MIN))).toBe(false)
    expect(holdsLease(j, 'W-A', at(5 * MIN))).toBe(false)
    expect(holdsLease(j, 'w-a ', at(5 * MIN))).toBe(false)
  })

  test('ARC-5 a job with no lease (queued, done, failed or dead: holder and lease_until null) is held by nobody', () => {
    for (const status of ['queued', 'done', 'failed', 'dead'] as const) {
      const j = job({ status, lease_holder: null, lease_until: null })
      expect(holdsLease(j, 'w-a', at(0)), status).toBe(false)
      expect(holdsLease(j, 'w-b', at(0)), status).toBe(false)
    }
    // a holder with no lease end is not a live lease
    expect(holdsLease(job({ lease_until: null }), 'w-a', at(0))).toBe(false)
  })

  test('ARC-5 holdsLease reads the job and never changes it', () => {
    const j = job()
    const before = structuredClone(j)
    holdsLease(j, 'w-a', at(MIN))
    holdsLease(j, 'w-b', at(20 * MIN))
    expect(j).toEqual(before)
  })
})

describe('ARC-22 a stale worker loses the job to the worker that re-claimed it', () => {
  test('ARC-22 planted: A claims, its lease runs out, B claims; A no longer holds the job and B does', () => {
    const queued = job({ status: 'queued', attempts: 0, lease_holder: null, lease_until: null })
    const byA = claimed(queued, 'w-a', 0)
    expect(holdsLease(byA, 'w-a', at(MIN))).toBe(true)
    const byB = claimed(byA, 'w-b', 10 * MIN + 1)
    expect(holdsLease(byB, 'w-a', at(10 * MIN + 2))).toBe(false)
    expect(holdsLease(byB, 'w-b', at(10 * MIN + 2))).toBe(true)
    // B's lease runs out in turn: nobody holds it until the next claim
    expect(holdsLease(byB, 'w-b', at(20 * MIN + 1))).toBe(false)
    expect(holdsLease(byB, 'w-a', at(20 * MIN + 1))).toBe(false)
  })

  test('ARC-22 planted: an expired lease with no re-claim refuses its old holder too', () => {
    const byA = claimed(job({ status: 'queued', attempts: 0, lease_holder: null, lease_until: null }), 'w-a', 0)
    expect(holdsLease(byA, 'w-a', at(10 * MIN + 1))).toBe(false)
  })

  test('ARC-22 an AI job\'s 24 hour lease holds at 23 hours and is lost after 24', () => {
    const byA = claimed(job({ kind: 'ai:read', status: 'queued', attempts: 0, lease_holder: null, lease_until: null }), 'w-a', 0, 24 * 60 * MIN)
    expect(holdsLease(byA, 'w-a', at(23 * 60 * MIN))).toBe(true)
    expect(holdsLease(byA, 'w-a', at(24 * 60 * MIN))).toBe(false)
  })
})

describe('ARC-5 property: the lease check is exactly "holder is this worker and the lease has not run out"', () => {
  const worker = fc.constantFrom('w-a', 'w-b', 'w-c')
  const offset = fc.integer({ min: -48 * 60 * MIN, max: 48 * 60 * MIN })

  test('ARC-5 for any holder, lease end, asking worker and moment, holdsLease is true exactly when the holder asks before the lease end', () => {
    fc.assert(
      fc.property(fc.option(worker, { nil: null }), fc.option(offset, { nil: null }), worker, offset, (holder, until, asker, now) => {
        const j = job({ lease_holder: holder, lease_until: until === null ? null : at(until) })
        const expected = holder !== null && holder === asker && until !== null && until > now
        expect(holdsLease(j, asker, at(now))).toBe(expected)
      }),
      { seed: SEED, numRuns: 500 },
    )
  })

  test('ARC-5 at any moment at most one worker holds a job', () => {
    fc.assert(
      fc.property(fc.option(worker, { nil: null }), fc.option(offset, { nil: null }), offset, (holder, until, now) => {
        const j = job({ lease_holder: holder, lease_until: until === null ? null : at(until) })
        const holders = ['w-a', 'w-b', 'w-c'].filter((w) => holdsLease(j, w, at(now)))
        expect(holders.length).toBeLessThanOrEqual(1)
      }),
      { seed: SEED + 1, numRuns: 300 },
    )
  })

  test('ARC-22 over random claim and expiry orders on two workers, only the last claimer holds the job, and only before its lease runs out', () => {
    const step = fc.record({
      worker: fc.constantFrom('w-a', 'w-b'),
      wait: fc.constantFrom(MIN, 5 * MIN, 10 * MIN, 10 * MIN + 1, 30 * MIN),
      claims: fc.boolean(),
    })
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 20 }), (steps) => {
        let now = 0
        let j = job({ status: 'queued', attempts: 0, lease_holder: null, lease_until: null })
        let last: { worker: string; until: number } | null = null
        for (const s of steps) {
          now += s.wait
          const free = last === null || last.until <= now
          if (s.claims && free) {
            j = claimed(j, s.worker, now)
            last = { worker: s.worker, until: now + 10 * MIN }
          }
          for (const w of ['w-a', 'w-b']) {
            const expected = last !== null && last.worker === w && last.until > now
            expect(holdsLease(j, w, at(now)), `${w} at +${String(now)}`).toBe(expected)
          }
        }
      }),
      { seed: SEED + 2, numRuns: 300 },
    )
  })
})
