// FX15 acceptance tests: complete and fail check the lease holder (spec-writer; builders never edit this file).
//
// The shape these tests fix (Lead directive A449, card FX15):
// - JobQueue (src/contracts/jobs.ts): complete(id, workerId, result, versions) -> Job and
//   fail(id, workerId, error, options?) -> Job. Each refuses (throws) unless workerId holds the job's
//   lease at the clock's now: status running, lease_holder = workerId and lease_until > now. The
//   refusal names the job id and says "lease"; the row stays exactly as the current holder left it.
// - An expired lease with no re-claim refuses its old holder too.
// - The runner passes its own workerId (default 'worker') to complete and fail.
// - A pure holdsLease(job, workerId, now) in queue.ts (its unit twin: lease.acceptance.test.ts).
// Known limit kept (A449): the same worker id re-claiming its own expired job is not told apart.
import type { PGlite } from '@electric-sql/pglite'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import type { Clock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import type { Handler, Job, JobQueue, VersionStamp } from '../../contracts/jobs'
import { createJobQueue, createRunner } from './index'

const T0 = '2026-03-02T15:00:00.000Z'
const MIN = 60_000
const HOUR = 60 * MIN
const STAMP = { handler: 'lease-test', version: 1 }
const SEED = 20261003

/** The card's signatures; the cast keeps typecheck green before the build changes the contract. */
interface LeaseQueue {
  claim: JobQueue['claim']
  enqueue: JobQueue['enqueue']
  complete(id: string, workerId: string, result: unknown, versions: VersionStamp): Promise<Job>
  fail(id: string, workerId: string, error: string, options?: { retry?: boolean }): Promise<Job>
}

function mutableClock(iso: string): Clock & { advance(ms: number): void } {
  let t = new Date(iso).getTime()
  return {
    now: () => new Date(t),
    advance: (ms) => {
      t += ms
    },
  }
}

const ms = (x: unknown): number => new Date(x as string | Date).getTime()

type Row = {
  id: string
  status: string
  attempts: number
  run_after: Date
  lease_holder: string | null
  lease_until: Date | null
  result: unknown
  last_error: string | null
  version_stamp: unknown
  finished_at: Date | null
}

async function row(db: PGlite, id: string): Promise<Row> {
  const r = await db.query<Row>(
    `select id, status, attempts, run_after, lease_holder, lease_until, result, last_error, version_stamp, finished_at
     from returns.jobs where id = $1`,
    [id],
  )
  const found = r.rows[0]
  if (!found) throw new Error(`no job ${id}`)
  return found
}

async function world() {
  const db = await cloneTestDb()
  const clock = mutableClock(T0)
  const raw = createJobQueue(db, clock)
  const queue = raw as unknown as LeaseQueue
  return { db, clock, raw, queue }
}

async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  return ''
}

function expectLeaseRefusal(msg: string, jobId: string): void {
  expect(msg, 'the write was not refused').not.toBe('')
  expect(msg).toContain(jobId)
  expect(msg).toMatch(/lease/i)
}

/** A claims at T0, its 10 minute lease runs out, B claims. */
async function reclaimed() {
  const w = await world()
  const j = await w.queue.enqueue('read:page', 'k-1', { n: 1 })
  expect((await w.queue.claim('w-a'))?.id).toBe(j.id)
  w.clock.advance(10 * MIN + 1)
  expect((await w.queue.claim('w-b'))?.id).toBe(j.id)
  const before = await row(w.db, j.id)
  expect([before.status, before.attempts, before.lease_holder]).toEqual(['running', 2, 'w-b'])
  return { ...w, j, before }
}

describe('ARC-5 complete refuses a worker that no longer holds the lease', () => {
  test('ARC-5 planted: A claims, its lease expires, B claims, A completes: refused naming the job, the row unchanged; B completes: done', async () => {
    const { db, queue, j, before } = await reclaimed()
    expectLeaseRefusal(await refusal(queue.complete(j.id, 'w-a', { ok: false }, { handler: 'stale', version: 9 })), j.id)
    expect(await row(db, j.id)).toEqual(before)
    const done = await queue.complete(j.id, 'w-b', { ok: true }, STAMP)
    expect(done.status).toBe('done')
    const r = await row(db, j.id)
    expect([r.status, r.result, r.version_stamp, r.lease_holder]).toEqual(['done', { ok: true }, STAMP, null])
  })

  test('ARC-5 an expired lease with no re-claim refuses its old holder: the job stays running and claimable', async () => {
    const { db, clock, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await queue.claim('w-a')
    clock.advance(10 * MIN)
    const before = await row(db, j.id)
    expectLeaseRefusal(await refusal(queue.complete(j.id, 'w-a', { ok: true }, STAMP)), j.id)
    expect(await row(db, j.id)).toEqual(before)
    expect((await queue.claim('w-b'))?.id).toBe(j.id)
  })

  test('ARC-5 the holder completes 1 ms before lease_until; another worker is refused while the lease is live', async () => {
    const { db, clock, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await queue.claim('w-a')
    clock.advance(5 * MIN)
    const before = await row(db, j.id)
    expectLeaseRefusal(await refusal(queue.complete(j.id, 'w-b', { ok: true }, STAMP)), j.id)
    expect(await row(db, j.id)).toEqual(before)
    clock.advance(5 * MIN - 1)
    expect((await queue.complete(j.id, 'w-a', { ok: true }, STAMP)).status).toBe('done')
  })

  test('ARC-5 a done job cannot be completed again, by its finisher or anyone else', async () => {
    const { db, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await queue.claim('w-a')
    await queue.complete(j.id, 'w-a', { ok: true }, STAMP)
    const before = await row(db, j.id)
    for (const w of ['w-a', 'w-b']) {
      expect(await refusal(queue.complete(j.id, w, { ok: false }, { handler: 'again', version: 2 })), w).toContain(j.id)
      expect(await row(db, j.id)).toEqual(before)
    }
  })
})

describe('ARC-5 fail refuses a worker that no longer holds the lease', () => {
  const failOptions = [
    { name: 'no options', options: undefined },
    { name: 'retry true', options: { retry: true } },
    { name: 'retry false', options: { retry: false } },
  ] as const
  for (const { name, options } of failOptions) {
    test(`ARC-5 planted: A claims, its lease expires, B claims, A fails (${name}): refused naming the job, the row unchanged; B fails: done`, async () => {
      const { db, queue, j, before } = await reclaimed()
      expectLeaseRefusal(await refusal(queue.fail(j.id, 'w-a', 'stale error', options)), j.id)
      expect(await row(db, j.id)).toEqual(before)
      await queue.fail(j.id, 'w-b', 'real error', options)
      const r = await row(db, j.id)
      expect(r.status).toBe(options?.retry === false ? 'failed' : 'queued')
      expect([r.last_error, r.lease_holder]).toEqual(['real error', null])
    })
  }

  test('ARC-5 an expired lease with no re-claim refuses the old holder\'s fail, and another worker\'s fail on a live lease', async () => {
    const { db, clock, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await queue.claim('w-a')
    const live = await row(db, j.id)
    expectLeaseRefusal(await refusal(queue.fail(j.id, 'w-b', 'not mine', { retry: false })), j.id)
    expect(await row(db, j.id)).toEqual(live)
    clock.advance(10 * MIN)
    const expired = await row(db, j.id)
    expectLeaseRefusal(await refusal(queue.fail(j.id, 'w-a', 'too late')), j.id)
    expect(await row(db, j.id)).toEqual(expired)
  })

  test('ARC-5 a stale fail cannot push a job to dead: the last-attempt holder\'s fail is refused once its lease is gone', async () => {
    const { db, clock, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await db.query('update returns.jobs set max_attempts = 2 where id = $1', [j.id])
    await queue.claim('w-a')
    clock.advance(10 * MIN + 1)
    await queue.claim('w-b')
    const before = await row(db, j.id)
    expectLeaseRefusal(await refusal(queue.fail(j.id, 'w-a', 'stale')), j.id)
    expect((await row(db, j.id)).status).toBe('running')
    expect(await row(db, j.id)).toEqual(before)
  })
})

const anyIn = z.object({ n: z.number().int() })
const anyOut = z.object({ ok: z.boolean() })
const handler = (kind: string, run: Handler['run'], extra: Partial<Handler> = {}): Handler =>
  ({ kind, input: anyIn, result: anyOut, versions: STAMP, run, ...extra })

describe('ARC-22 a stale runner cannot finish or fail a job another worker re-claimed', () => {
  test('ARC-22 an AI handler that outlives its 24 hour lease: the runner\'s complete is refused and the re-claimer finishes the job', async () => {
    const { db, clock, raw, queue } = await world()
    const runner = createRunner({
      queue: raw,
      clock,
      workerId: 'w-main',
      handlers: {
        'ai:read': handler(
          'ai:read',
          async () => {
            clock.advance(24 * HOUR + 1)
            expect((await queue.claim('w-other', ['ai:read'], () => 24 * HOUR))?.lease_holder).toBe('w-other')
            return { ok: true }
          },
          { leaseMs: 24 * HOUR },
        ),
      },
    })
    const j = await queue.enqueue('ai:read', 'k-1', { n: 1 })
    await runner.runOnce().catch(() => undefined)
    const r = await row(db, j.id)
    expect([r.status, r.lease_holder, r.attempts, r.result, r.version_stamp, r.last_error]).toEqual([
      'running',
      'w-other',
      2,
      null,
      null,
      null,
    ])
    expect((await queue.complete(j.id, 'w-other', { ok: true }, STAMP)).status).toBe('done')
  })

  test('ARC-22 a handler that throws after its lease was re-claimed: the runner\'s fail is refused and the job stays with the re-claimer', async () => {
    const { db, clock, raw, queue } = await world()
    const runner = createRunner({
      queue: raw,
      clock,
      workerId: 'w-main',
      handlers: {
        'read:page': handler('read:page', async () => {
          clock.advance(10 * MIN + 1)
          await queue.claim('w-other')
          throw new Error('stale handler error')
        }),
      },
    })
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await runner.runOnce().catch(() => undefined)
    const r = await row(db, j.id)
    expect([r.status, r.lease_holder, r.last_error]).toEqual(['running', 'w-other', null])
  })

  test('ARC-5 the runner passes its own workerId: a runner named w-main completes the job it claimed', async () => {
    const { db, clock, raw, queue } = await world()
    const runner = createRunner({ queue: raw, clock, workerId: 'w-main', handlers: { 'read:page': handler('read:page', () => ({ ok: true })) } })
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    expect(await runner.runOnce()).toBe(true)
    expect((await row(db, j.id)).status).toBe('done')
  })
})

// ---------- the property ----------

type Op =
  | { t: 'claim'; w: string }
  | { t: 'wait'; ms: number }
  | { t: 'complete'; w: string }
  | { t: 'fail'; w: string; retry: boolean }

const worker = fc.constantFrom('w-a', 'w-b')
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ t: fc.constant('claim' as const), w: worker }),
  fc.record({ t: fc.constant('wait' as const), ms: fc.constantFrom(MIN, 5 * MIN, 10 * MIN, 10 * MIN + 1, 20 * MIN) }),
  fc.record({ t: fc.constant('complete' as const), w: worker }),
  fc.record({ t: fc.constant('fail' as const), w: worker, retry: fc.boolean() }),
)

describe('ARC-5 property: no job is ever finished by a worker that did not hold its lease at that moment', () => {
  test(
    'ARC-5 over random claim, expire, complete and fail orders on two workers, a write lands only from the live lease holder and every other write is refused with the row unchanged',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(op, { minLength: 1, maxLength: 14 }), async (ops) => {
          const { db, clock, queue } = await world()
          const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
          for (const o of ops) {
            if (o.t === 'wait') {
              clock.advance(o.ms)
              continue
            }
            if (o.t === 'claim') {
              const got = await queue.claim(o.w)
              if (got) expect(got.lease_holder).toBe(o.w)
              continue
            }
            const before = await row(db, j.id)
            const holds = before.status === 'running' && before.lease_holder === o.w && ms(before.lease_until) > ms(clock.now())
            const msg = await refusal(
              o.t === 'complete' ? queue.complete(j.id, o.w, { ok: true }, STAMP) : queue.fail(j.id, o.w, `error by ${o.w}`, { retry: o.retry }),
            )
            const after = await row(db, j.id)
            if (holds) {
              expect(msg, `${o.t} by the holder ${o.w}`).toBe('')
              if (o.t === 'complete') expect(after.status).toBe('done')
              else expect(after.last_error).toBe(`error by ${o.w}`)
            } else {
              expect(msg, `${o.t} by ${o.w}, who does not hold the lease`).not.toBe('')
              expect(msg).toContain(j.id)
              expect(after).toEqual(before)
            }
          }
        }),
        { seed: SEED, numRuns: 25 },
      )
    },
    60_000,
  )
})
