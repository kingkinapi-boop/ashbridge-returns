// FX3 acceptance tests, the job queue's order (spec-writer; builders never edit this file).
// Card plan/cards/FX3.md defect 5: src/modules/jobs/queue.ts ordered jobs by created_at then id, so jobs
// written at one instant came out in id order, not the order they were written (FLOW-1: the order of
// records is an identity seq the database sets, never a time or an id; SC R16 is the source scan, these
// are its behaviour tests). Unit project: PGlite is booted here by createTemplate (the real schema), so
// mutation testing reaches queue.ts (findings A04, A391); the db project twin is
// fx3-order.acceptance.db.test.ts. Also the R23 behaviour: a row the queue reads, plus a stray key, is
// refused by JobSchema.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { JobSchema } from '../../contracts/jobs'
import { createTemplate, type DbTemplate } from '../../core/db'
import { createJobQueue } from './index'
import { addReturn, CLOCK, RETURN_ID, WRITTEN, writeJobs } from './__fixtures__/fx3-order'

const BOOT_MS = 60_000
let template: DbTemplate | undefined
const open: PGlite[] = []

beforeAll(async () => {
  template = await createTemplate()
}, BOOT_MS)
afterAll(async () => {
  await Promise.all(open.map((d) => d.close()))
  await template?.close()
}, BOOT_MS)

async function fresh(): Promise<PGlite> {
  if (template === undefined) throw new Error('the template did not boot')
  const db = await template.clone()
  open.push(db)
  await addReturn(db)
  return db
}

test('FLOW-1 the fixture: the ids sort the other way from the order they are written', () => {
  expect(WRITTEN.length).toBeGreaterThan(1)
  expect([...WRITTEN].sort()).toEqual([...WRITTEN].reverse())
})

describe('FX3 defect 5: the queue keeps the order jobs were written (FLOW-1; SC R16)', () => {
  test('FLOW-1 R16 jobs written at one instant are claimed in the order they were written, not in id order', async () => {
    const db = await fresh()
    await writeJobs(db, 'queued')
    const queue = createJobQueue(db, CLOCK)
    const claimed: string[] = []
    for (let i = 0; i < WRITTEN.length; i += 1) claimed.push((await queue.claim('worker-1 (Test)'))?.id ?? '(none)')
    expect(claimed).toEqual([...WRITTEN])
    expect(await queue.claim('worker-1 (Test)')).toBeNull()
  }, BOOT_MS)

  test('FLOW-1 R16 the dead jobs of a return are listed in the order they were written, not in id order', async () => {
    const db = await fresh()
    await writeJobs(db, 'dead')
    const status = await createJobQueue(db, CLOCK).statusForReturn(RETURN_ID)
    expect(status.dead.map((d) => d.id)).toEqual([...WRITTEN])
  }, BOOT_MS)
})

describe('FX3 defect 5: JobSchema refuses a stray key on a row the queue reads (EV-5; SC R23)', () => {
  test('EV-5 R23 a job row as stored parses; the same row with one stray key is refused', async () => {
    const db = await fresh()
    const queue = createJobQueue(db, CLOCK)
    const job = await queue.enqueue('fx3:strict', 'fx3-strict-1 (Test)', { n: 1 }, RETURN_ID)
    expect(JobSchema.safeParse(job).success, 'the stored job does not parse').toBe(true)
    expect(JobSchema.safeParse({ ...job, strayKeyTest: 'x' }).success).toBe(false)
  }, BOOT_MS)
})
