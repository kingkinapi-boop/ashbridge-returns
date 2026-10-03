// DB16 builder's own tests for the pure switch (the acceptance tests are in pg16.acceptance.test.ts).
import { describe, expect, test } from 'vitest'
import { testDbTarget } from './target'

const on = { TEST_DB: 'pg16' }

describe('DB16 testDbTarget details', () => {
  test('ARC-4 an undefined or empty switch is off', () => {
    expect(testDbTarget({ TEST_DB: undefined })).toEqual({ kind: 'pglite' })
    expect(testDbTarget({ TEST_DB: '' })).toEqual({ kind: 'pglite' })
  })

  test('ARC-4 the default url is the postgres user on 127.0.0.1:5432', () => {
    expect(testDbTarget(on)).toEqual({ kind: 'pg16', url: 'postgres://postgres@127.0.0.1:5432/postgres' })
  })

  test('ARC-4 PGUSER and PGPORT are used; empty ones fall back to the defaults', () => {
    expect(testDbTarget({ ...on, PGUSER: 'ashbridge_test', PGPORT: '5544' })).toEqual({
      kind: 'pg16',
      url: 'postgres://ashbridge_test@127.0.0.1:5544/postgres',
    })
    expect(testDbTarget({ ...on, PGUSER: '', PGPORT: '' })).toEqual({ kind: 'pg16', url: 'postgres://postgres@127.0.0.1:5432/postgres' })
  })

  test('ARC-4 PGUSER is url-encoded and the password never enters the url', () => {
    const t = testDbTarget({ ...on, PGUSER: 'a@b/c', PGPASSWORD: 'PLANTED-never-in-url' })
    expect(t).toEqual({ kind: 'pg16', url: 'postgres://a%40b%2Fc@127.0.0.1:5432/postgres' })
  })

  test('ARC-4 an empty or local PGHOST and PGHOSTADDR pass, a non-local one names the variable', () => {
    expect(testDbTarget({ ...on, PGHOST: '', PGHOSTADDR: '' }).kind).toBe('pg16')
    expect(testDbTarget({ ...on, PGHOSTADDR: 'localhost' }).kind).toBe('pg16')
    expect(() => testDbTarget({ ...on, PGHOST: '10.1.1.1' })).toThrow(/PGHOST is not the local cluster/)
    expect(() => testDbTarget({ ...on, PGHOSTADDR: '10.1.1.1' })).toThrow(/PGHOSTADDR is not the local cluster/)
  })

  test('decision 0003 DATABASE_URL and SUPABASE variables are refused by name; an undefined entry is not set', () => {
    expect(() => testDbTarget({ ...on, DATABASE_URL: 'x' })).toThrow(/DATABASE_URL is set/)
    expect(() => testDbTarget({ ...on, NEXT_PUBLIC_SUPABASE_URL: '' })).toThrow(/NEXT_PUBLIC_SUPABASE_URL is set/)
    expect(testDbTarget({ ...on, DATABASE_URL: undefined, SUPABASE_URL: undefined }).kind).toBe('pg16')
  })

  test('ARC-4 a switch value other than pg16 is refused with the rule, not the value', () => {
    expect(() => testDbTarget({ TEST_DB: 'PG16-secret' })).toThrow(/TEST_DB must be unset or exactly pg16/)
    expect(() => testDbTarget({ TEST_DB: 'PG16-secret' })).not.toThrow(/secret/)
  })
})
