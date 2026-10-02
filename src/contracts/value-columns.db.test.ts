import { expect, test } from 'vitest'
import { cloneTestDb } from '../core/db'
import { VALUE_COLUMNS } from './text'

test('EV-1 RT-12 the schema marks exactly the columns text.ts VALUE_COLUMNS lists', async () => {
  const db = await cloneTestDb()
  const r = await db.query<{ k: string }>(
    `select c.relname || '.' || a.attname as k
     from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'returns' and a.attnum > 0 and not a.attisdropped
       and col_description(c.oid, a.attnum) like 'VALUE_COLUMN%'
     order by 1`,
  )
  expect(r.rows.map((x) => x.k)).toEqual(Object.keys(VALUE_COLUMNS).sort())
})
