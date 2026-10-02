// The Postgres job queue (ARC-5, ARC-10, ARC-16). Time is the injected clock's; the backoff is fixed.
import type { PGlite } from '@electric-sql/pglite'
import type { Clock } from '../../core/clock'
import { newId } from '../../core/ids'
import { VersionStampSchema } from '../../contracts/records'
import { JOB_STATUSES, JobSchema } from '../../contracts/jobs'
import type { Job, JobQueue, JobStatus, ReturnJobStatus, StatusCounts, VersionStamp } from '../../contracts/jobs'

const MINUTE = 60_000
export const DEFAULT_LEASE_MS = 10 * MINUTE
/** After attempt n fails: 1, 4, 16 minutes, then 16 again. */
const BACKOFF_MS = [1 * MINUTE, 4 * MINUTE, 16 * MINUTE]
export const backoffMs = (attempts: number): number => BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1] ?? 16 * MINUTE

const parseJob = (row: unknown): Job => JobSchema.parse(row)

export function createJobQueue(db: PGlite, clock: Clock): JobQueue {
  const iso = (ms = 0): string => new Date(clock.now().getTime() + ms).toISOString()

  async function get(id: string): Promise<Job> {
    const r = await db.query('select * from returns.jobs where id = $1', [id])
    if (!r.rows[0]) throw new Error(`no job ${id}`)
    return parseJob(r.rows[0])
  }

  async function running(id: string): Promise<Job> {
    const job = await get(id)
    if (job.status !== 'running') throw new Error(`job ${id} is ${job.status}, not running`)
    return job
  }

  return {
    async enqueue(kind, key, input, returnId) {
      const now = iso()
      const made = await db.query(
        `insert into returns.jobs (id, kind, return_id, idempotency_key, input, run_after, created_at)
         values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $6::timestamptz)
         on conflict (idempotency_key) do nothing returning *`,
        [newId(), kind, returnId ?? null, key, JSON.stringify(input), now],
      )
      if (made.rows[0]) return parseJob(made.rows[0])
      const existing = await db.query('select * from returns.jobs where idempotency_key = $1', [key])
      return parseJob(existing.rows[0])
    },

    async claim(workerId, kinds, leaseMsFor) {
      return db.transaction(async (tx) => {
        for (;;) {
          const now = iso()
          const next = await tx.query<{ id: string; kind: string; status: JobStatus; attempts: number; max_attempts: number }>(
            `select id, kind, status, attempts, max_attempts from returns.jobs
             where ($2::text[] is null or kind = any($2::text[]))
               and ((status = 'queued' and run_after <= $1::timestamptz)
                 or (status = 'running' and lease_until <= $1::timestamptz))
             order by created_at, id
             limit 1
             for update skip locked`,
            [now, kinds ? [...kinds] : null],
          )
          const c = next.rows[0]
          if (!c) return null
          if (c.status === 'running' && c.attempts >= c.max_attempts) {
            // the lease ran out on the last attempt: the job ends dead, never claimed forever
            await tx.query(
              `update returns.jobs set status = 'dead', lease_holder = null, lease_until = null,
                 last_error = 'lease expired on the last attempt', finished_at = $2::timestamptz where id = $1`,
              [c.id, now],
            )
            continue
          }
          const leaseMs = leaseMsFor?.(c.kind) ?? DEFAULT_LEASE_MS
          const claimed = await tx.query(
            `update returns.jobs set status = 'running', attempts = attempts + 1, lease_holder = $2,
               lease_until = $3::timestamptz where id = $1 returning *`,
            [c.id, workerId, iso(leaseMs)],
          )
          return parseJob(claimed.rows[0])
        }
      })
    },

    async complete(id, result, versions: VersionStamp) {
      const stamp = VersionStampSchema.safeParse(versions)
      if (!stamp.success) throw new Error('ARC-10: a done job needs a version stamp of non-blank values')
      await running(id)
      const done = await db.query(
        `update returns.jobs set status = 'done', result = $2::jsonb, version_stamp = $3::jsonb,
           finished_at = $4::timestamptz, lease_holder = null, lease_until = null where id = $1 returning *`,
        [id, JSON.stringify(result ?? null), JSON.stringify(stamp.data), iso()],
      )
      return parseJob(done.rows[0])
    },

    async fail(id, error, options) {
      const job = await running(id)
      const now = iso()
      if (options?.retry === false) {
        const r = await db.query(
          `update returns.jobs set status = 'failed', last_error = $2, lease_holder = null, lease_until = null,
             finished_at = $3::timestamptz where id = $1 returning *`,
          [id, error, now],
        )
        return parseJob(r.rows[0])
      }
      if (job.attempts >= job.max_attempts) {
        const r = await db.query(
          `update returns.jobs set status = 'dead', last_error = $2, lease_holder = null, lease_until = null,
             finished_at = $3::timestamptz where id = $1 returning *`,
          [id, error, now],
        )
        return parseJob(r.rows[0])
      }
      const r = await db.query(
        `update returns.jobs set status = 'queued', last_error = $2, lease_holder = null, lease_until = null,
           run_after = $3::timestamptz where id = $1 returning *`,
        [id, error, iso(backoffMs(job.attempts))],
      )
      return parseJob(r.rows[0])
    },

    async statusForReturn(returnId): Promise<ReturnJobStatus> {
      const counted = await db.query<{ kind: string; status: JobStatus; n: number }>(
        `select kind, status, count(*)::int as n from returns.jobs where return_id = $1 group by kind, status`,
        [returnId],
      )
      const counts: Record<string, StatusCounts> = {}
      for (const r of counted.rows) {
        const c = (counts[r.kind] ??= Object.fromEntries(JOB_STATUSES.map((s) => [s, 0])) as unknown as StatusCounts)
        c[r.status] = r.n
      }
      const dead = await db.query<{ id: string; kind: string; last_error: string | null }>(
        `select id, kind, last_error from returns.jobs where return_id = $1 and status = 'dead' order by created_at, id`,
        [returnId],
      )
      const open = await db.query<{ kind: string; oldest: Date }>(
        `select kind, min(created_at) as oldest from returns.jobs
         where return_id = $1 and status in ('queued', 'running') group by kind`,
        [returnId],
      )
      const oldestOpen: Record<string, Date> = {}
      for (const r of open.rows) oldestOpen[r.kind] = new Date(r.oldest)
      return { counts, dead: dead.rows, oldestOpen }
    },
  }
}
