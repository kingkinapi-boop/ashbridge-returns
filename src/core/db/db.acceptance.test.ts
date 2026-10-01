// F00 fix round 1 (ARC-4): acceptance tests for the database helper, written by the spec job.
// API the builder must export from ./index:
//   createTemplate(schemaDir?: string): Promise<DbTemplate>
//     - boots PGlite once, applies every *.sql file in schemaDir in name order, rejects with an
//       error whose message names the failing file; schemaDir defaults to <repo root>/db/schema.
//     - it is pure: it does NOT register the template that cloneTestDb() uses (only the db
//       project's setup file does that).
//   DbTemplate: { clone(): Promise<PGlite>; close(): Promise<void> }
//   cloneTestDb(): Promise<PGlite>
//     - clones the template made by the db project's warm-up; never boots PGlite itself; when no
//       warm-up ran it throws an Error whose message contains "db warm-up did not run".
// These files are named *.acceptance.test.ts, so they run in the unit project, where no
// warm-up exists; each test that boots PGlite sets its own timeout.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { cloneTestDb, createTemplate } from './index'

const here = path.dirname(fileURLToPath(import.meta.url))
const OK = path.join(here, '__fixtures__', 'schema-ok')
const BAD = path.join(here, '__fixtures__', 'schema-bad')
const BOOT_MS = 60_000
const DB_TEST_TIMEOUT_MS = 15_000

test('ARC-4 cloneTestDb throws "db warm-up did not run" when no template is ready', async () => {
  await expect(cloneTestDb()).rejects.toThrow(/db warm-up did not run/)
})

test(
  'ARC-4 the template applies the schema files in name order and every clone has their tables',
  async () => {
    const template = await createTemplate(OK)
    const a = await template.clone()
    const b = await template.clone()
    for (const db of [a, b]) {
      await db.exec("insert into a values (1, 'x'); insert into b values (1, 1);")
      const r = await db.query<{ n: number }>('select count(*)::int as n from b join a on a.id = b.a_id')
      expect(r.rows[0]?.n).toBe(1)
    }
    await a.close()
    await b.close()
    await template.close()
  },
  BOOT_MS,
)

test(
  'ARC-4 a table made in one clone does not exist in another',
  async () => {
    const template = await createTemplate(OK)
    const a = await template.clone()
    const b = await template.clone()
    await a.exec('create table t (n int); insert into t values (1);')
    await expect(b.query('select * from t')).rejects.toThrow(/relation "t" does not exist/)
    const r = await a.query<{ n: number }>('select n from t')
    expect(r.rows[0]?.n).toBe(1)
    await a.close()
    await b.close()
    await template.close()
  },
  BOOT_MS,
)

test(
  'ARC-4 a bad schema file fails the warm-up with its file name',
  async () => {
    await expect(createTemplate(BAD)).rejects.toThrow(/01_broken\.sql/)
  },
  BOOT_MS,
)

test(
  'ARC-4 50 clones in one file each stay under the db testTimeout',
  async () => {
    const template = await createTemplate(OK)
    const slowest = { ms: 0 }
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now()
      const db = await template.clone()
      await db.query('select 1')
      slowest.ms = Math.max(slowest.ms, performance.now() - t0)
      await db.close()
    }
    expect(slowest.ms).toBeLessThan(DB_TEST_TIMEOUT_MS)
    await template.close()
  },
  BOOT_MS * 2,
)
