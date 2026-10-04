import { expect, test } from 'vitest'
import { cloneTestDb } from './index'

// FX14 (A504): one database per test. The old test also opened a second clone to show it was apart from the first;
// that two-worlds-at-once check lives in pg16.acceptance.db.test.ts (isolation, on either backend), and the test
// below shows it across tests.
test('ARC-4 a database is created from the schema folder and cloned per test', async () => {
  const a = await cloneTestDb()
  await a.exec('create table t (n int); insert into t values (1);')
  const r = await a.query<{ n: number }>('select n from t')
  expect(r.rows[0]?.n).toBe(1)
})

test('ARC-4 the previous test left no table behind (clones are closed after each test)', async () => {
  const c = await cloneTestDb()
  await expect(c.query('select * from t')).rejects.toThrow(/relation "t" does not exist/)
})
