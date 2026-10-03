// @mutate
// The pure half of the Postgres 16 switch (ARC-4, DB16): reads only the env it is given, connects to nothing.
export type TestDbTarget = { kind: 'pglite' } | { kind: 'pg16'; url: string }

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** Pure: reads only the env it is given. Names are refused, values are never printed (decision 0003). */
export function testDbTarget(env: Record<string, string | undefined>): TestDbTarget {
  const sw = env['TEST_DB']
  if (sw === undefined || sw === '') return { kind: 'pglite' }
  if (sw !== 'pg16') throw new Error('TEST_DB must be unset or exactly pg16 (a switch, never a connection string)')
  if (env['DATABASE_URL'] !== undefined) throw new Error('TEST_DB=pg16 refused: DATABASE_URL is set (decision 0003)')
  const supabase = Object.keys(env).find((k) => k.includes('SUPABASE') && env[k] !== undefined)
  if (supabase !== undefined) throw new Error(`TEST_DB=pg16 refused: ${supabase} is set (decision 0003)`)
  for (const name of ['PGHOST', 'PGHOSTADDR']) {
    const host = env[name]
    if (host !== undefined && host !== '' && !LOCAL_HOSTS.has(host)) {
      throw new Error(`TEST_DB=pg16 refused: ${name} is not the local cluster (127.0.0.1 only)`)
    }
  }
  const port = env['PGPORT'] !== undefined && env['PGPORT'] !== '' ? env['PGPORT'] : '5432'
  const user = env['PGUSER'] !== undefined && env['PGUSER'] !== '' ? encodeURIComponent(env['PGUSER']) : 'postgres'
  // The password, if any, is read by the driver from PGPASSWORD and never enters the url.
  return { kind: 'pg16', url: `postgres://${user}@127.0.0.1:${port}/postgres` }
}
