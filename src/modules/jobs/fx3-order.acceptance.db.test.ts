// FX3 acceptance tests, the job queue's order, db project (spec-writer; builders never edit this file).
// Card plan/cards/FX3.md defect 5 (FLOW-1; SC R16). The same cases as fx3-order.acceptance.test.ts (the
// unit-project twin mutation testing reaches), run here on the db project's database, so they also run on
// Postgres 16 in cloud checks (TEST_DB=pg16).
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { cloneTestDb } from '../../core/db'
import { createJobQueue } from './index'
import { addReturn, CLOCK, RETURN_ID, WRITTEN, writeJobs } from './__fixtures__/fx3-order'

async function fresh(): Promise<PGlite> {
  const db = await cloneTestDb()
  await addReturn(db)
  return db
}

describe('FX3 defect 5: the queue keeps the order jobs were written (FLOW-1; SC R16)', () => {
  test('FLOW-1 R16 jobs written at one instant are claimed in the order they were written, not in id order', async () => {
    const db = await fresh()
    await writeJobs(db, 'queued')
    const queue = createJobQueue(db, CLOCK)
    const claimed: string[] = []
    for (let i = 0; i < WRITTEN.length; i += 1) claimed.push((await queue.claim('worker-1 (Test)'))?.id ?? '(none)')
    expect(claimed).toEqual([...WRITTEN])
    expect(await queue.claim('worker-1 (Test)')).toBeNull()
  })

  test('FLOW-1 R16 the dead jobs of a return are listed in the order they were written, not in id order', async () => {
    const db = await fresh()
    await writeJobs(db, 'dead')
    const status = await createJobQueue(db, CLOCK).statusForReturn(RETURN_ID)
    expect(status.dead.map((d) => d.id)).toEqual([...WRITTEN])
  })
})
