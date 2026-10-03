// FX3 fixture (spec-writer): jobs that tie on created_at, written in a known order with ids that sort the
// other way, so an order by created_at then id gives the wrong answer and an order by an identity seq the
// right one (FLOW-1, SC R16). Shared by fx3-order.acceptance.test.ts (unit project, PGlite booted there)
// and fx3-order.acceptance.db.test.ts (db project, PGlite or Postgres 16).
import type { PGlite } from '@electric-sql/pglite'
import { fixedClock, type Clock } from '../../../core/clock'

/** Every job is created at the same instant; the clock reads one hour later, so all are due. */
export const CREATED = '2026-03-02T15:00:00.000Z'
export const CLOCK: Clock = fixedClock('2026-03-02T16:00:00.000Z')
export const RETURN_ID = 'fx3-return-1 (Test)'
/** Written in this order; each id sorts before the one written before it. */
export const WRITTEN = ['fx3-job-z (Test)', 'fx3-job-m (Test)', 'fx3-job-a (Test)'] as const

export async function addReturn(db: PGlite): Promise<void> {
  await db.query(`insert into returns.returns (id, entity_name, year_end, state) values ($1, $2, '2025-12-31', 'intake')`, [
    RETURN_ID,
    'Cedar Hollow Bakery Ltd (Test)',
  ])
}

/** Writes the WRITTEN jobs in order, one statement each, all with one created_at and status as given. */
export async function writeJobs(db: PGlite, status: 'queued' | 'dead'): Promise<void> {
  for (const [i, id] of WRITTEN.entries()) {
    await db.query(
      `insert into returns.jobs (id, kind, return_id, idempotency_key, input, status, attempts, run_after, created_at, last_error, finished_at)
       values ($1, 'fx3:order', $2, $3, '{}'::jsonb, $4, $5, $6::timestamptz, $6::timestamptz, $7, $8::timestamptz)`,
      [
        id,
        RETURN_ID,
        `fx3-order-${String(i)} (Test)`,
        status,
        status === 'dead' ? 3 : 0,
        CREATED,
        status === 'dead' ? 'boom (Test)' : null,
        status === 'dead' ? CREATED : null,
      ],
    )
  }
}
