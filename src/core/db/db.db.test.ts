import { expect, test } from 'vitest'
import { cloneTestDb } from './index'

test('ARC-4 a database is created from the schema folder and cloned per test', async () => {
  const a = await cloneTestDb()
  await a.exec('create table t (n int); insert into t values (1);')
  const b = await cloneTestDb()
  await expect(b.query('select * from t')).rejects.toThrow(/relation "t" does not exist/)
  const r = await a.query<{ n: number }>('select n from t')
  expect(r.rows[0]?.n).toBe(1)
})

test('ARC-4 the previous test left no table behind (clones are closed after each test)', async () => {
  const c = await cloneTestDb()
  await expect(c.query('select * from t')).rejects.toThrow(/relation "t" does not exist/)
})
