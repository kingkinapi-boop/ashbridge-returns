/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- the casts adapt to whatever types jobs.ts chooses for handler input and queue results */
// F06 acceptance tests: jobs table and worker (spec-writer; builders never edit this file).
//
// The shape these tests fix (the builder matches it; extra columns are fine if nullable or defaulted):
// - Table `returns.jobs` (file 80_jobs.sql in the schema folder), columns as the card lists them, snake_case:
//   id, kind, return_id, idempotency_key (unique), input, status, attempts, max_attempts (default 3),
//   run_after, lease_holder, lease_until, result, last_error, version_stamp (jsonb, nullable until
//   done), created_at, finished_at, is_test (default true). Row-level security on, no policies.
// - `src/modules/jobs/index.ts` exports (the card's "queue, runners"):
//     createJobQueue(db: PGlite, clock: Clock): JobQueue
//     createRunner({ queue, handlers, clock, workerId? }): Runner        in-process runner
//     createSyncRunner({ queue, handlers, clock, workerId? }): Runner    test runner, one job at a time
//   `handlers` is a map from kind to Handler. Types come from `src/contracts/jobs.ts`.
// - JobQueue (async): enqueue(kind, key, input, returnId?) -> Job (the existing job when the key
//   exists, and nothing is written); claim(workerId, kinds?, leaseMsFor?) -> Job | null, where
//   leaseMsFor(kind) names a handler's own lease (undefined gives the 10 minute default); the
//   claim counts the attempt (attempts + 1), sets status running, lease_holder and lease_until from
//   the injected clock; complete(id, workerId, result, versions) -> Job; fail(id, workerId, error,
//   { retry?: boolean }) -> Job, each from the worker holding the lease (FX15, A449; its tests are in
//   lease.acceptance.db.test.ts) (retry defaults to true: queued again with the fixed backoff, or dead at max attempts;
//   retry false is the terminal status `failed`); statusForReturn(returnId) ->
//   { counts: { [kind]: { queued, running, done, failed, dead } (all five, zeros included) },
//     dead: { id, kind, last_error }[],
//     oldestOpen: { [kind]: Date } (queued or running jobs only; a kind with none has no key) }.
// - Handler (contracts): { kind, input: ZodType, result: ZodType, leaseMs?: number,
//   versions: stamp, run(input, ctx) } where versions is the stamp of what produces the result
//   (ARC-10) that the runner hands to complete, and ctx is { jobId, attempt, now: Date, returnId }.
// - Runner: runOnce() -> Promise<boolean> (true when it ran one due job); runUntilIdle() ->
//   Promise<number> (how many runs; stops when nothing is due at the clock's now, never advances it).
// - created_at and finished_at are written from the injected clock, never from now() in SQL.
// - Backoff after a failed attempt n (n = attempts so far): run_after = now + 1, 4, 16 minutes for
//   n = 1, 2, 3 and 16 minutes after that. A job is dead when attempts reaches max_attempts.
// - A lease that has run out makes the job claimable again; its attempts are kept (the re-claim
//   counts one more). A DELETE or TRUNCATE on returns.jobs is refused with "append-only" (F01's
//   refuse_change); UPDATE is allowed. A constraint on a done row needing a version stamp has
//   "stamp" in its name. The kind is `<module>:<step>`, refused otherwise.
// Amber choices are listed in reports/F06-spec.md.
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import type { Clock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import type { Handler, Job, JobQueue, VersionStamp } from '../../contracts/jobs'
import { createJobQueue, createRunner, createSyncRunner } from './index'

const T0 = '2026-03-02T15:00:00.000Z'
const MIN = 60_000
const HOUR = 60 * MIN

function mutableClock(iso: string): Clock & { advance(ms: number): void; set(iso: string): void } {
  let t = new Date(iso).getTime()
  return {
    now: () => new Date(t),
    advance: (ms) => {
      t += ms
    },
    set: (s) => {
      t = new Date(s).getTime()
    },
  }
}

/** FX15 (A449): complete and fail take the lease holder; the cast keeps typecheck green before that build. */
interface LeaseWrites {
  complete(id: string, workerId: string, result: unknown, versions: VersionStamp): Promise<Job>
  fail(id: string, workerId: string, error: string, options?: { retry?: boolean }): Promise<Job>
}
const lease = (queue: JobQueue): LeaseWrites => queue as unknown as LeaseWrites

const ms = (x: unknown): number => new Date(x as string | Date).getTime()
const STAMP = { handler: 'jobs-test', version: 1 }

type Row = {
  id: string
  kind: string
  return_id: string | null
  idempotency_key: string
  input: unknown
  status: string
  attempts: number
  max_attempts: number
  run_after: Date
  lease_holder: string | null
  lease_until: Date | null
  result: unknown
  last_error: string | null
  version_stamp: unknown
  created_at: Date
  finished_at: Date | null
  is_test: boolean
}

async function row(db: PGlite, id: string): Promise<Row> {
  const r = await db.query<Row>('select * from returns.jobs where id = $1', [id])
  const found = r.rows[0]
  if (!found) throw new Error(`no job ${id}`)
  return found
}

async function world(startIso = T0) {
  const db = await cloneTestDb()
  const clock = mutableClock(startIso)
  const queue = createJobQueue(db, clock)
  return { db, clock, queue }
}

async function addReturn(db: PGlite, id: string): Promise<void> {
  await db.query(
    `insert into returns.returns (id, entity_name, year_end, state) values ($1, $2, '2025-12-31', 'intake')`,
    [id, 'Cedar Hollow Bakery Ltd (Test)'],
  )
}

const anyIn = z.object({ n: z.number().int() })
const anyOut = z.object({ ok: z.boolean() })

function handler(kind: string, run: Handler['run'], extra: Partial<Handler> = {}): Handler {
  return { kind, input: anyIn, result: anyOut, versions: STAMP, run, ...extra } as Handler
}

async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  return ''
}

// ---------- ARC-5: idempotent enqueue ----------

describe('ARC-5 enqueue is idempotent by key', () => {
  test('ARC-5 the same key twice gives one row and the same job id; a different key gives a second row', async () => {
    const { db, queue, clock } = await world()
    const a = await queue.enqueue('read:page', 'k-1', { n: 1 })
    clock.advance(5 * MIN)
    const again = await queue.enqueue('read:page', 'k-1', { n: 999 })
    expect(again.id).toBe(a.id)
    const rows = await db.query<{ n: number }>('select count(*)::int as n from returns.jobs')
    expect(rows.rows[0]?.n).toBe(1)
    const stored = await row(db, a.id)
    expect(stored.input).toEqual({ n: 1 })
    expect(ms(stored.created_at)).toBe(ms(T0))
    const b = await queue.enqueue('read:page', 'k-2', { n: 2 })
    expect(b.id).not.toBe(a.id)
    const rows2 = await db.query<{ n: number }>('select count(*)::int as n from returns.jobs')
    expect(rows2.rows[0]?.n).toBe(2)
  })

  test('ARC-5 a new job is queued, has no attempts, is runnable now, is a test row and is stamped from the injected clock', async () => {
    const { db, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    const r = await row(db, j.id)
    expect(r.status).toBe('queued')
    expect(r.attempts).toBe(0)
    expect(r.max_attempts).toBe(3)
    expect(r.is_test).toBe(true)
    expect(r.return_id).toBeNull()
    expect(ms(r.created_at)).toBe(ms(T0))
    expect(ms(r.run_after)).toBeLessThanOrEqual(ms(T0))
  })

  test('ARC-5 a kind that is not <module>:<step> is refused', async () => {
    const { queue } = await world()
    expect(await refusal(queue.enqueue('nokind', 'k-1', { n: 1 }))).not.toBe('')
    expect(await refusal(queue.enqueue('', 'k-2', { n: 1 }))).not.toBe('')
  })

  test('ARC-5 claim takes the oldest due job, skips jobs not yet due, and honours the kinds filter', async () => {
    const { db, queue, clock } = await world()
    const first = await queue.enqueue('read:page', 'k-1', { n: 1 })
    clock.advance(1000)
    const second = await queue.enqueue('ai:read', 'k-2', { n: 2 })
    clock.advance(1000)
    await queue.enqueue('read:page', 'k-3', { n: 3 })
    const onlyAi = await queue.claim('w1', ['ai:read'])
    expect(onlyAi?.id).toBe(second.id)
    const oldest = await queue.claim('w1')
    expect(oldest?.id).toBe(first.id)
    await lease(queue).complete(first.id, 'w1', { ok: true }, STAMP)
    await lease(queue).complete(second.id, 'w1', { ok: true }, STAMP)
    await db.query(`update returns.jobs set run_after = $1 where idempotency_key = 'k-3'`, [
      new Date(ms(T0) + HOUR).toISOString(),
    ])
    expect(await queue.claim('w1')).toBeNull()
    clock.advance(HOUR)
    const due = await queue.claim('w1')
    expect([due?.attempts, due?.status]).toEqual([1, 'running'])
  })
})

// ---------- ARC-5: retries, backoff, dead ----------

describe('ARC-5 retries follow a fixed backoff and end dead, never deleted', () => {
  test('ARC-5 a handler that throws twice then succeeds ends done after three attempts, with the backoff from the pinned clock', async () => {
    const { db, queue, clock } = await world()
    let calls = 0
    const runner = createRunner({
      queue,
      clock,
      handlers: {
        'read:page': handler('read:page', () => {
          calls += 1
          if (calls < 3) throw new Error(`transient ${String(calls)}`)
          return { ok: true }
        }),
      },
    })
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    expect(await runner.runOnce()).toBe(true)
    let r = await row(db, j.id)
    expect([r.status, r.attempts, r.last_error]).toEqual(['queued', 1, 'transient 1'])
    expect(ms(r.run_after)).toBe(ms(T0) + 1 * MIN)
    expect(await runner.runOnce()).toBe(false)
    clock.advance(1 * MIN)
    expect(await runner.runOnce()).toBe(true)
    r = await row(db, j.id)
    expect([r.status, r.attempts, r.last_error]).toEqual(['queued', 2, 'transient 2'])
    expect(ms(r.run_after)).toBe(ms(T0) + 1 * MIN + 4 * MIN)
    clock.advance(4 * MIN - 1)
    expect(await runner.runOnce()).toBe(false)
    clock.advance(1)
    expect(await runner.runOnce()).toBe(true)
    r = await row(db, j.id)
    expect([r.status, r.attempts]).toEqual(['done', 3])
    expect(r.result).toEqual({ ok: true })
    expect(r.version_stamp).toEqual(STAMP)
    expect(ms(r.finished_at)).toBe(ms(T0) + 5 * MIN)
    expect(calls).toBe(3)
  })

  test('ARC-5 the backoff is 1, 4, 16 minutes and stays at 16 after that', async () => {
    const { db, queue, clock } = await world()
    const runner = createRunner({
      queue,
      clock,
      handlers: {
        'read:page': handler('read:page', () => {
          throw new Error('still down')
        }),
      },
    })
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await db.query('update returns.jobs set max_attempts = 5 where id = $1', [j.id])
    const waits: number[] = []
    for (let i = 0; i < 4; i++) {
      const before = ms(clock.now())
      expect(await runner.runOnce()).toBe(true)
      const r = await row(db, j.id)
      expect(r.status).toBe('queued')
      waits.push(ms(r.run_after) - before)
      clock.set(new Date(ms(r.run_after)).toISOString())
    }
    expect(waits).toEqual([1 * MIN, 4 * MIN, 16 * MIN, 16 * MIN])
    expect(await runner.runOnce()).toBe(true)
    expect((await row(db, j.id)).status).toBe('dead')
  })

  test('ARC-5 a handler that always throws ends dead after max attempts with its last error, and statusForReturn lists it', async () => {
    const { db, queue, clock } = await world()
    await addReturn(db, 'r-1')
    const runner = createRunner({
      queue,
      clock,
      handlers: {
        'read:page': handler('read:page', () => {
          throw new Error('scanner offline')
        }),
      },
    })
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 }, 'r-1')
    for (let i = 0; i < 3; i++) {
      expect(await runner.runOnce()).toBe(true)
      clock.advance(20 * MIN)
    }
    const r = await row(db, j.id)
    expect([r.status, r.attempts, r.last_error]).toEqual(['dead', 3, 'scanner offline'])
    expect(await runner.runOnce()).toBe(false)
    clock.advance(24 * HOUR)
    expect(await runner.runOnce()).toBe(false)
    const status = await queue.statusForReturn('r-1')
    expect(status.dead).toEqual([{ id: j.id, kind: 'read:page', last_error: 'scanner offline' }])
    expect(status.counts['read:page']).toEqual({ queued: 0, running: 0, done: 0, failed: 0, dead: 1 })
    expect(Object.keys(status.oldestOpen)).toEqual([])
  })

  test('ARC-5 queue.fail requeues with the backoff, and with retry false ends failed', async () => {
    const { db, queue, clock } = await world()
    const a = await queue.enqueue('read:page', 'k-1', { n: 1 })
    const b = await queue.enqueue('read:page', 'k-2', { n: 2 })
    await queue.claim('w1')
    await queue.claim('w1')
    await lease(queue).fail(a.id, 'w1', 'boom')
    await lease(queue).fail(b.id, 'w1', 'never retry', { retry: false })
    const ra = await row(db, a.id)
    expect([ra.status, ra.last_error, ms(ra.run_after)]).toEqual(['queued', 'boom', ms(clock.now()) + MIN])
    expect(ra.lease_holder).toBeNull()
    const rb = await row(db, b.id)
    expect([rb.status, rb.last_error]).toEqual(['failed', 'never retry'])
  })

  test('ARC-5 a job is never deleted: DELETE and TRUNCATE on returns.jobs are refused, UPDATE is allowed, dead jobs stay listed', async () => {
    const { db, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    expect(await refusal(db.query('delete from returns.jobs where id = $1', [j.id]))).toMatch(/append-only/)
    expect(await refusal(db.exec('truncate returns.jobs'))).toMatch(/append-only/)
    await db.query(`update returns.jobs set status = 'dead', last_error = 'x' where id = $1`, [j.id])
    expect((await row(db, j.id)).status).toBe('dead')
  })
})

// ---------- ARC-5: leases ----------

describe('ARC-5 leases', () => {
  test('ARC-5 a claimed job is not claimed again while its lease holds; after the lease it is claimable and keeps its attempts', async () => {
    const { db, queue, clock } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    const claimed = await queue.claim('w1')
    expect(claimed?.id).toBe(j.id)
    let r = await row(db, j.id)
    expect([r.status, r.attempts, r.lease_holder]).toEqual(['running', 1, 'w1'])
    expect(ms(r.lease_until)).toBe(ms(T0) + 10 * MIN)
    expect(await queue.claim('w2')).toBeNull()
    clock.advance(10 * MIN - 1)
    expect(await queue.claim('w2')).toBeNull()
    clock.advance(2)
    r = await row(db, j.id)
    expect(r.attempts).toBe(1)
    const again = await queue.claim('w2')
    expect(again?.id).toBe(j.id)
    r = await row(db, j.id)
    expect([r.attempts, r.lease_holder, r.status]).toEqual([2, 'w2', 'running'])
  })

  test('ARC-5 a handler that names a 24 hour lease keeps its job leased at 10 minutes and 23 hours, claimable after 24 hours', async () => {
    const { db, queue, clock } = await world()
    const j = await queue.enqueue('ai:read', 'k-1', { n: 1 })
    const lease = (kind: string): number | undefined => (kind.startsWith('ai:') ? 24 * HOUR : undefined)
    expect((await queue.claim('w1', undefined, lease))?.id).toBe(j.id)
    expect(ms((await row(db, j.id)).lease_until)).toBe(ms(T0) + 24 * HOUR)
    clock.advance(10 * MIN)
    expect(await queue.claim('w2', undefined, lease)).toBeNull()
    clock.advance(23 * HOUR - 10 * MIN)
    expect(await queue.claim('w2', undefined, lease)).toBeNull()
    clock.advance(HOUR + 1)
    expect((await queue.claim('w2', undefined, lease))?.id).toBe(j.id)
  })

  test('ARC-5 the runner leases for the handler\'s own length, and 10 minutes when the handler names none', async () => {
    const { db, queue, clock } = await world()
    const seen: Record<string, { lease: number; status: string; holder: string | null }> = {}
    const probe =
      (kind: string): Handler['run'] =>
      async (_input, ctx) => {
        const r = await row(db, ctx.jobId)
        seen[kind] = { lease: ms(r.lease_until) - ms(clock.now()), status: r.status, holder: r.lease_holder }
        return { ok: true }
      }
    const runner = createRunner({
      queue,
      clock,
      workerId: 'w-main',
      handlers: {
        'ai:read': handler('ai:read', probe('ai:read'), { leaseMs: 24 * HOUR }),
        'read:page': handler('read:page', probe('read:page')),
      },
    })
    await queue.enqueue('ai:read', 'k-1', { n: 1 })
    await queue.enqueue('read:page', 'k-2', { n: 2 })
    expect(await runner.runUntilIdle()).toBe(2)
    expect(seen['ai:read']).toEqual({ lease: 24 * HOUR, status: 'running', holder: 'w-main' })
    expect(seen['read:page']).toEqual({ lease: 10 * MIN, status: 'running', holder: 'w-main' })
  })
})

// ---------- ARC-5: result checks, unknown kinds ----------

describe('ARC-5 results and inputs are checked, unknown kinds fail', () => {
  test('ARC-5 a result that fails the handler\'s result schema leaves the job not done, with the schema problem in the error', async () => {
    const { db, queue, clock } = await world()
    const runner = createRunner({
      queue,
      clock,
      handlers: {
        'read:page': handler('read:page', () => ({ total: 'seven' }) as never, {
          result: z.object({ total: z.number().int() }),
        }),
      },
    })
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    expect(await runner.runOnce()).toBe(true)
    const r = await row(db, j.id)
    expect(r.status).toBe('queued')
    expect(r.last_error ?? '').toMatch(/total/)
    expect(r.result).toBeNull()
    expect(r.version_stamp).toBeNull()
  })

  test('ARC-5 an input that fails the handler\'s input schema is a failed run with the problem in the error, and the handler never runs', async () => {
    const { db, queue, clock } = await world()
    let ran = false
    const runner = createRunner({
      queue,
      clock,
      handlers: {
        'read:page': handler('read:page', () => {
          ran = true
          return { ok: true }
        }),
      },
    })
    const j = await queue.enqueue('read:page', 'k-1', { n: 'not a number' })
    await runner.runOnce()
    const r = await row(db, j.id)
    expect(r.status).toBe('queued')
    expect(r.last_error ?? '').toMatch(/\bn\b/)
    expect(ran).toBe(false)
  })

  test('ARC-5 an unknown kind ends failed with "no handler for <kind>" and is never claimed again', async () => {
    const { db, queue, clock } = await world()
    const runner = createRunner({ queue, clock, handlers: {} })
    const j = await queue.enqueue('mystery:step', 'k-1', { n: 1 })
    expect(await runner.runOnce()).toBe(true)
    const r = await row(db, j.id)
    expect(r.status).toBe('failed')
    expect(r.last_error).toBe('no handler for mystery:step')
    clock.advance(24 * HOUR)
    expect(await runner.runOnce()).toBe(false)
    expect((await row(db, j.id)).attempts).toBe(r.attempts)
  })

  test('ARC-5 runUntilIdle runs every due job, returns how many, and does not move the clock', async () => {
    const { queue, clock } = await world()
    const runner = createRunner({
      queue,
      clock,
      handlers: { 'read:page': handler('read:page', () => ({ ok: true })) },
    })
    for (const k of ['k-1', 'k-2', 'k-3']) await queue.enqueue('read:page', k, { n: 1 })
    expect(await runner.runUntilIdle()).toBe(3)
    expect(await runner.runUntilIdle()).toBe(0)
    expect(ms(clock.now())).toBe(ms(T0))
  })
})

// ---------- ARC-5: the runner can be swapped ----------

async function scenario(make: typeof createRunner) {
  const { db, queue, clock } = await world()
  await addReturn(db, 'r-1')
  let flaky = 0
  const runner = make({
    queue,
    clock,
    handlers: {
      'read:page': handler('read:page', (input) => ({ ok: (input as { n: number }).n > 0 })),
      'diff:run': handler('diff:run', () => {
        flaky += 1
        if (flaky < 2) throw new Error('first try fails')
        return { ok: true }
      }),
      'ai:read': handler('ai:read', () => {
        throw new Error('model unavailable')
      }),
    },
  })
  await queue.enqueue('read:page', 'a', { n: 1 }, 'r-1')
  await queue.enqueue('read:page', 'b', { n: 0 }, 'r-1')
  await queue.enqueue('diff:run', 'c', { n: 3 }, 'r-1')
  await queue.enqueue('ai:read', 'd', { n: 4 })
  await queue.enqueue('mystery:step', 'e', { n: 5 })
  for (let i = 0; i < 5; i++) {
    await runner.runUntilIdle()
    clock.advance(20 * MIN)
  }
  const rows = await db.query<Row>('select * from returns.jobs order by idempotency_key')
  return rows.rows.map((r) => ({
    key: r.idempotency_key,
    kind: r.kind,
    status: r.status,
    attempts: r.attempts,
    result: r.result,
    error: r.last_error,
    stamp: r.version_stamp,
    runAfter: ms(r.run_after),
    finished: r.finished_at ? ms(r.finished_at) : null,
  }))
}

describe('ARC-5 the in-process runner and the test runner agree', () => {
  test('ARC-5 given the same jobs, handlers and clock both runners end with deep-equal statuses and results', async () => {
    const a = await scenario(createRunner)
    const b = await scenario(createSyncRunner)
    expect(b).toEqual(a)
    expect(a.map((r) => [r.key, r.status])).toEqual([
      ['a', 'done'],
      ['b', 'done'],
      ['c', 'done'],
      ['d', 'dead'],
      ['e', 'failed'],
    ])
  })

  test('ARC-16 two runs of the same scenario give identical rows (no randomness in the backoff)', async () => {
    const a = await scenario(createRunner)
    const b = await scenario(createRunner)
    expect(b).toEqual(a)
  })
})

// ---------- ARC-10: version stamps ----------

describe('ARC-10 a done job carries the version stamp of what produced it', () => {
  test('ARC-10 complete with no stamp, an empty stamp or a blank or null value is refused and leaves the job running', async () => {
    const { db, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await queue.claim('w1')
    for (const bad of [undefined, null, {}, { x: '' }, { x: '  ' }, { x: null }, { x: { y: 1 } }]) {
      const msg = await refusal(lease(queue).complete(j.id, 'w1', { ok: true }, bad as never))
      expect(msg, JSON.stringify(bad)).toMatch(/stamp/i)
      const r = await row(db, j.id)
      expect(r.status).toBe('running')
      expect(r.version_stamp).toBeNull()
    }
  })

  test('ARC-10 a done job stores the stamp, the result and the finish time it was given', async () => {
    const { db, queue, clock } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await queue.claim('w1')
    clock.advance(3 * MIN)
    const done = await lease(queue).complete(j.id, 'w1', { ok: true }, { reader: 'pdf-text', rules: 4, schema: '2026-03-01' })
    expect(done.status).toBe('done')
    const r = await row(db, j.id)
    expect(r.status).toBe('done')
    expect(r.version_stamp).toEqual({ reader: 'pdf-text', rules: 4, schema: '2026-03-01' })
    expect(r.result).toEqual({ ok: true })
    expect(ms(r.finished_at)).toBe(ms(T0) + 3 * MIN)
    expect(r.lease_holder).toBeNull()
  })

  test('ARC-10 the table itself refuses a done row with no stamp or a blank-valued stamp', async () => {
    const { db, queue } = await world()
    const j = await queue.enqueue('read:page', 'k-1', { n: 1 })
    await queue.claim('w1')
    for (const stamp of [null, '{}', '{"x":""}', '{"x":null}']) {
      const msg = await refusal(
        db.query(`update returns.jobs set status = 'done', version_stamp = $2::jsonb where id = $1`, [j.id, stamp]),
      )
      expect(msg, String(stamp)).toMatch(/stamp/i)
    }
    expect((await row(db, j.id)).status).toBe('running')
  })

  test('ARC-10 the runner hands the handler\'s stamp to complete, and a handler with a blank stamp cannot finish a job', async () => {
    const { db, queue, clock } = await world()
    const runner = createRunner({
      queue,
      clock,
      handlers: {
        'read:page': handler('read:page', () => ({ ok: true }), { versions: { reader: 'ocr', rules: 7 } }),
        'diff:run': handler('diff:run', () => ({ ok: true }), { versions: {} }),
      },
    })
    const good = await queue.enqueue('read:page', 'k-1', { n: 1 })
    const bad = await queue.enqueue('diff:run', 'k-2', { n: 1 })
    await runner.runUntilIdle()
    expect((await row(db, good.id)).version_stamp).toEqual({ reader: 'ocr', rules: 7 })
    const r = await row(db, bad.id)
    expect(r.status).not.toBe('done')
    expect(r.last_error ?? '').toMatch(/stamp/i)
  })
})

// ---------- ARC-5: statusForReturn ----------

describe('ARC-5 statusForReturn', () => {
  test('ARC-5 counts by status per kind for one return only, with the oldest open job per kind', async () => {
    const { db, queue, clock } = await world()
    await addReturn(db, 'r-1')
    await addReturn(db, 'r-2')
    const first = await queue.enqueue('ai:read', 'k-1', { n: 1 }, 'r-1')
    clock.advance(30 * MIN)
    await queue.enqueue('ai:read', 'k-2', { n: 2 }, 'r-1')
    await queue.enqueue('read:page', 'k-3', { n: 3 }, 'r-1')
    await queue.enqueue('read:page', 'k-4', { n: 4 }, 'r-2')
    await queue.enqueue('read:page', 'k-5', { n: 5 })
    await queue.claim('w1', ['ai:read'])
    const s = await queue.statusForReturn('r-1')
    expect(Object.keys(s.counts).sort()).toEqual(['ai:read', 'read:page'])
    expect(s.counts['ai:read']).toEqual({ queued: 1, running: 1, done: 0, failed: 0, dead: 0 })
    expect(s.counts['read:page']).toEqual({ queued: 1, running: 0, done: 0, failed: 0, dead: 0 })
    expect(s.dead).toEqual([])
    expect(ms(s.oldestOpen['ai:read'])).toBe(ms(T0))
    expect(ms(s.oldestOpen['read:page'])).toBe(ms(T0) + 30 * MIN)
    expect(first.id).toBeTruthy()
    expect(Object.keys((await queue.statusForReturn('r-none')).counts)).toEqual([])
  })

  test('ARC-5 with two ai: jobs enqueued at two pinned times, one queued and one leased, the earlier time is the oldest open job; once both are done the kind has none', async () => {
    const { db, queue, clock } = await world()
    await addReturn(db, 'r-1')
    const early = await queue.enqueue('ai:read', 'k-1', { n: 1 }, 'r-1')
    clock.advance(2 * HOUR)
    const late = await queue.enqueue('ai:read', 'k-2', { n: 2 }, 'r-1')
    // lease the later job only, so the earlier stays queued
    await db.query(
      `update returns.jobs set status = 'running', attempts = 1, lease_holder = 'w1', lease_until = $2 where id = $1`,
      [late.id, new Date(ms(clock.now()) + HOUR).toISOString()],
    )
    let s = await queue.statusForReturn('r-1')
    expect(ms(s.oldestOpen['ai:read'])).toBe(ms(T0))
    // the earlier one is leased and the later one queued: still the earlier time
    await db.query(`update returns.jobs set status = 'queued', lease_holder = null, lease_until = null where id = $1`, [late.id])
    await queue.claim('w2', ['ai:read'])
    s = await queue.statusForReturn('r-1')
    expect(ms(s.oldestOpen['ai:read'])).toBe(ms(T0))
    await lease(queue).complete(early.id, 'w2', { ok: true }, STAMP)
    s = await queue.statusForReturn('r-1')
    expect(ms(s.oldestOpen['ai:read'])).toBe(ms(T0) + 2 * HOUR)
    await queue.claim('w2', ['ai:read'])
    await lease(queue).complete(late.id, 'w2', { ok: true }, STAMP)
    s = await queue.statusForReturn('r-1')
    expect(s.oldestOpen['ai:read']).toBeUndefined()
    expect(s.counts['ai:read']?.done).toBe(2)
  })
})

// ---------- SEC-6 and the table's shape ----------

describe('SEC-6 returns.jobs follows F01\'s deny-all rules', () => {
  test('SEC-6 returns.jobs has row-level security on, no policy, an is_test column that defaults to true, and lives in schema returns', async () => {
    const db = await cloneTestDb()
    const t = await db.query<{ rls: boolean; schema: string }>(
      `select c.relrowsecurity as rls, n.nspname as schema from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relname = 'jobs' and c.relkind in ('r', 'p')`,
    )
    expect(t.rows).toEqual([{ rls: true, schema: 'returns' }])
    const p = await db.query<{ n: number }>(`select count(*)::int as n from pg_policies where tablename = 'jobs'`)
    expect(p.rows[0]?.n).toBe(0)
    const c = await db.query<{ column_default: string | null; is_nullable: string; data_type: string }>(
      `select column_default, is_nullable, data_type from information_schema.columns
       where table_schema = 'returns' and table_name = 'jobs' and column_name = 'is_test'`,
    )
    expect(c.rows[0]?.data_type).toBe('boolean')
    expect(c.rows[0]?.is_nullable).toBe('NO')
    expect(c.rows[0]?.column_default).toBe('true')
    const pub = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')`,
    )
    expect(pub.rows[0]?.n).toBe(0)
  })

  test('SEC-6 a role granted SELECT (the public key) and a role with no grants read zero rows from returns.jobs after a row is inserted', async () => {
    const { db, queue } = await world()
    await queue.enqueue('read:page', 'k-1', { n: 1 })
    const own = await db.query<{ n: number }>('select count(*)::int as n from returns.jobs')
    expect(own.rows[0]?.n).toBe(1)
    await db.exec(`create role anon_jobs nologin;
      grant usage on schema returns to anon_jobs;
      grant select on returns.jobs to anon_jobs;
      create role nobody_jobs nologin;`)
    for (const role of ['anon_jobs', 'nobody_jobs']) {
      await db.exec(`set role ${role}`)
      try {
        const msg = await refusal(db.query('select * from returns.jobs'))
        if (msg === '') {
          const r = await db.query<{ n: number }>('select count(*)::int as n from returns.jobs')
          expect(r.rows[0]?.n, `${role} leaked rows`).toBe(0)
        }
      } finally {
        await db.exec('reset role')
      }
    }
  })
})
