// F06 acceptance tests, unit side: the jobs contract and the module's source rules (spec-writer;
// builders never edit this file). The database behaviour is in src/modules/jobs/jobs.acceptance.db.test.ts.
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { fixedClock } from '../core/clock'
import { readOwnSource } from '../core/testing/read-own-source'
import { createJobQueue } from '../modules/jobs/queue'
import { JobSchema, JobStatusSchema } from './jobs'

const rowOk = {
  id: 'j-1',
  kind: 'read:page',
  return_id: null,
  idempotency_key: 'k-1',
  input: { n: 1 },
  status: 'queued',
  attempts: 0,
  max_attempts: 3,
  run_after: new Date('2026-03-02T15:00:00.000Z'),
  lease_holder: null,
  lease_until: null,
  result: null,
  last_error: null,
  version_stamp: null,
  created_at: new Date('2026-03-02T15:00:00.000Z'),
  finished_at: null,
  is_test: true,
}

describe('ARC-5 the jobs contract', () => {
  test('ARC-5 the job statuses are exactly queued, running, done, failed and dead', () => {
    expect([...JobStatusSchema.options].sort()).toEqual(['dead', 'done', 'failed', 'queued', 'running'])
  })

  test('ARC-5 a database row is a Job; a status outside the five, a kind that is not <module>:<step> and negative attempts are refused', () => {
    expect(JobSchema.safeParse(rowOk).success).toBe(true)
    expect(JobSchema.safeParse({ ...rowOk, status: 'paused' }).success).toBe(false)
    expect(JobSchema.safeParse({ ...rowOk, kind: 'nokind' }).success).toBe(false)
    expect(JobSchema.safeParse({ ...rowOk, kind: '' }).success).toBe(false)
    expect(JobSchema.safeParse({ ...rowOk, attempts: -1 }).success).toBe(false)
    expect(JobSchema.safeParse({ ...rowOk, max_attempts: 0 }).success).toBe(false)
  })
})

describe('ARC-16 and ARC-5 the module source rules', () => {
  const files = ['src/modules/jobs/queue.ts', 'src/modules/jobs/runner.ts']

  test('ARC-16 the queue and the runners read time from the injected clock and use no randomness', () => {
    for (const f of files) {
      const src = readOwnSource(f)
      expect(src, f).not.toMatch(/Math\.random|randomUUID|Date\.now\s*\(|new Date\(\s*\)/)
    }
  })

  test('ARC-5 the claim query takes the oldest due job with FOR UPDATE SKIP LOCKED', () => {
    expect(readOwnSource('src/modules/jobs/queue.ts')).toMatch(/FOR UPDATE SKIP LOCKED/i)
  })

  test('ARC-5 the queue has no DELETE path', () => {
    expect(readOwnSource('src/modules/jobs/queue.ts')).not.toMatch(/\bdelete\s+from\b/i)
  })

  test('ARC-5 behaviour twin: every queue call (enqueue, claim, complete, fail both ways, status) sends no DELETE or TRUNCATE to the database', async () => {
    const sent: string[] = []
    const running = { ...rowOk, status: 'running', attempts: 1, lease_holder: 'w-1', lease_until: new Date('2026-03-02T15:10:00.000Z') }
    const candidate = { id: 'j-1', kind: 'read:page', status: 'queued', attempts: 0, max_attempts: 3 }
    const fake = {
      query: (sql: string) => {
        sent.push(sql)
        if (/for update skip locked/i.test(sql)) return Promise.resolve({ rows: [candidate] })
        if (/count\(\*\)|status = 'dead' order|min\(created_at\)/i.test(sql)) return Promise.resolve({ rows: [] })
        return Promise.resolve({ rows: [running] })
      },
      transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(fake),
    }
    const queue = createJobQueue(fake as unknown as PGlite, fixedClock('2026-03-02T15:00:00.000Z'))
    await queue.enqueue('read:page', 'k-1', { n: 1 }, 'r-1')
    expect((await queue.claim('w-1', ['read:page']))?.id).toBe('j-1')
    await queue.complete('j-1', 'w-1', { ok: true }, { handler: 'twin', version: 1 })
    await queue.fail('j-1', 'w-1', 'boom')
    await queue.fail('j-1', 'w-1', 'boom', { retry: false })
    await queue.statusForReturn('r-1')
    expect(sent.length).toBeGreaterThan(6)
    expect(sent.filter((q) => /\b(delete|truncate)\b/i.test(q))).toEqual([])
  })
})
