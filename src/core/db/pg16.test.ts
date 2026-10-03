import { describe, expect, it } from 'vitest'
import { testDbTarget } from './target'

describe('ARC-4 DB16 testDbTarget', () => {
  it('ARC-4: no switch means PGlite', () => {
    expect(testDbTarget({})).toEqual({ kind: 'pglite' })
    expect(testDbTarget({ TEST_DB: '' })).toEqual({ kind: 'pglite' })
    expect(testDbTarget({ TEST_DB: undefined, DATABASE_URL: 'x' })).toEqual({ kind: 'pglite' })
  })

  it('SEC-7: the switch is pg16 only, never a connection string', () => {
    expect(() => testDbTarget({ TEST_DB: 'postgres://h/db' })).toThrow('TEST_DB must be empty or pg16')
    expect(() => testDbTarget({ TEST_DB: 'PG16' })).toThrow('TEST_DB must be empty or pg16')
  })

  it('SEC-7: pg16 builds a local url with no password, default port 5432', () => {
    expect(testDbTarget({ TEST_DB: 'pg16' })).toEqual({ kind: 'pg16', url: 'postgres://postgres@127.0.0.1:5432/postgres' })
    expect(testDbTarget({ TEST_DB: 'pg16', PGPORT: '5433' })).toEqual({ kind: 'pg16', url: 'postgres://postgres@127.0.0.1:5433/postgres' })
    expect(testDbTarget({ TEST_DB: 'pg16', PGPORT: '' })).toEqual({ kind: 'pg16', url: 'postgres://postgres@127.0.0.1:5432/postgres' })
    expect(testDbTarget({ TEST_DB: 'pg16', PGHOST: '', PGHOSTADDR: '' }).kind).toBe('pg16')
    expect(testDbTarget({ TEST_DB: 'pg16', PGHOST: 'localhost', PGHOSTADDR: '127.0.0.1' }).kind).toBe('pg16')
  })

  it('SEC-7: DATABASE_URL refuses, even empty, naming the variable not its value', () => {
    expect(() => testDbTarget({ TEST_DB: 'pg16', DATABASE_URL: 'postgres://u:secretpw@h/db' })).toThrow(
      'DATABASE_URL is set (decision 0003)',
    )
    expect(() => testDbTarget({ TEST_DB: 'pg16', DATABASE_URL: 'postgres://u:secretpw@h/db' })).not.toThrow(/secretpw/)
    expect(() => testDbTarget({ TEST_DB: 'pg16', DATABASE_URL: '' })).toThrow('DATABASE_URL is set')
  })

  it('SEC-7: any SUPABASE variable refuses, in any case, and names only the variable', () => {
    expect(() => testDbTarget({ TEST_DB: 'pg16', SUPABASE_URL: 'https://x' })).toThrow('SUPABASE_URL is set (decision 0003)')
    expect(() => testDbTarget({ TEST_DB: 'pg16', next_public_supabase_key: 'k' })).toThrow('next_public_supabase_key is set')
    expect(testDbTarget({ TEST_DB: 'pg16', SUPABASE_URL: undefined }).kind).toBe('pg16')
    expect(testDbTarget({ TEST_DB: 'pg16', OTHER: 'supabase' }).kind).toBe('pg16')
  })

  it('SEC-7: a non-local PGHOST or PGHOSTADDR refuses', () => {
    expect(() => testDbTarget({ TEST_DB: 'pg16', PGHOST: 'db.example.com' })).toThrow('PGHOST is not the local cluster')
    expect(() => testDbTarget({ TEST_DB: 'pg16', PGHOSTADDR: '10.0.0.5' })).toThrow('PGHOSTADDR is not the local cluster')
    expect(() => testDbTarget({ TEST_DB: 'pg16', PGHOST: '::1' })).toThrow('PGHOST is not the local cluster')
  })

  it('SEC-7: PGPORT must be 1 to 5 digits', () => {
    for (const bad of ['abc', '5432x', ' 5432', '123456', '-1', '54.3']) {
      expect(() => testDbTarget({ TEST_DB: 'pg16', PGPORT: bad })).toThrow('PGPORT is not a port number')
    }
    expect(testDbTarget({ TEST_DB: 'pg16', PGPORT: '1' }).kind).toBe('pg16')
    expect(testDbTarget({ TEST_DB: 'pg16', PGPORT: '65535' }).kind).toBe('pg16')
  })
})
