// @mutate
// The test database switch's guard (DB16, decision 0003): pure, no driver import. TEST_DB=pg16 points the
// db project at a local Postgres 16 cluster on 127.0.0.1 and refuses anything live.
export type TestDbTarget = { kind: 'pglite' } | { kind: 'pg16'; url: string }

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const LOCAL_USER = 'postgres'

/**
 * Which backend the db project uses (DB16, ARC-4). Pure: reads only the env it is given. The switch is
 * TEST_DB=pg16; it refuses a live database (DATABASE_URL, any SUPABASE variable, a non-local PGHOST) and
 * never prints a value.
 */
export function testDbTarget(env: Record<string, string | undefined>): TestDbTarget {
  const sw = env['TEST_DB']
  if (sw === undefined || sw === '') return { kind: 'pglite' }
  if (sw !== 'pg16') throw new Error('TEST_DB must be empty or pg16 (it is a switch, never a connection string)')
  if (env['DATABASE_URL'] !== undefined) throw new Error('TEST_DB=pg16 refuses to start: DATABASE_URL is set (decision 0003)')
  const supabase = Object.keys(env).find((k) => k.toUpperCase().includes('SUPABASE') && env[k] !== undefined)
  if (supabase !== undefined) throw new Error(`TEST_DB=pg16 refuses to start: ${supabase} is set (decision 0003)`)
  for (const name of ['PGHOST', 'PGHOSTADDR']) {
    const host = env[name]
    if (host !== undefined && host !== '' && !LOCAL_HOSTS.has(host)) {
      throw new Error(`TEST_DB=pg16 refuses to start: ${name} is not the local cluster`)
    }
  }
  const port = env['PGPORT'] !== undefined && env['PGPORT'] !== '' ? env['PGPORT'] : '5432'
  if (!/^\d{1,5}$/.test(port)) throw new Error('TEST_DB=pg16 refuses to start: PGPORT is not a port number')
  return { kind: 'pg16', url: `postgres://${LOCAL_USER}@127.0.0.1:${port}/postgres` }
}
