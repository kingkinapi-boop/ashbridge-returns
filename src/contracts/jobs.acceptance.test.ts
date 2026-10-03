// F06 acceptance tests, unit side: the jobs contract and the module's source rules (spec-writer;
// builders never edit this file). The database behaviour is in src/modules/jobs/jobs.acceptance.db.test.ts.
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../core/testing/read-own-source'
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
})
