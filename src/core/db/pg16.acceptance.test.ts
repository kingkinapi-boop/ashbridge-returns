// DB16 acceptance tests, unit part (spec-writer; builders never edit this file): the switch that runs the
// db project on a local Postgres 16 cluster, read without a database. The db part is
// pg16.acceptance.db.test.ts.
//
// The surface these tests fix (amber in reports/DB16-spec.md):
// - src/core/db/index.ts exports testDbTarget(env: Record<string, string | undefined>):
//     { kind: 'pglite' } | { kind: 'pg16'; url: string }
//   It is pure (reads only the env it is given; no connection, no process.env).
//   - TEST_DB unset or '' is the switch off: { kind: 'pglite' }, whatever else the env holds.
//   - TEST_DB 'pg16' is the switch on. Any other value is refused (the switch is a switch, never a
//     connection string), and the refusal never prints the value.
//   - Switch on: the url is built for the local cluster: postgres: or postgresql: on host 127.0.0.1,
//     port PGPORT when given (else 5432). PGHOST or PGHOSTADDR naming any host other than 127.0.0.1 or
//     localhost is refused.
//   - Switch on with DATABASE_URL set, or any variable whose name contains SUPABASE set (even empty),
//     is refused (decision 0003); the refusal names the variable and never prints its value.
// - src/core/db/global-setup.ts (the db project's global setup) refuses to start the same way, before
//   it connects to anything.
// - .claude/agents/checker.md and .claude/cloud-worker-run.md carry the command that runs the tests with
//   the switch on (TEST_DB=pg16).
// Until the build, testDbTarget does not exist: each test fails naming that.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'

type Env = Record<string, string | undefined>
type Target = { kind: 'pglite' } | { kind: 'pg16'; url: string }

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
// Planted values (gitleaks allowlists PLANTED- lines); none of them is real.
const SECRET = 'PLANTED-db16-pw'
const LIVE_HOST = 'db.live-host.example.com'
const LIVE_URL = 'postgres://owner:PLANTED-db16-pw@db.live-host.example.com:5432/live'
const BOOT_MS = 30_000

async function target(env: Env): Promise<Target> {
  const mod = (await import('./index')) as unknown as { testDbTarget?: (env: Env) => Target }
  if (typeof mod.testDbTarget !== 'function') throw new Error('DB16: src/core/db/index.ts exports no testDbTarget(env)')
  return mod.testDbTarget(env)
}

async function refusal(env: Env): Promise<Error | undefined> {
  return target(env).then(
    () => undefined,
    (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
  )
}

function expectRefused(e: Error | undefined, name: RegExp, value: string): void {
  expect(e, 'the switch must refuse').toBeInstanceOf(Error)
  expect(e?.message).not.toMatch(/exports no testDbTarget/)
  expect(e?.message).toMatch(name)
  expect(e?.message, 'a refusal never prints the value').not.toContain(value)
}

const pgUrl = async (env: Env): Promise<URL> => {
  const t = await target(env)
  expect(t.kind).toBe('pg16')
  if (t.kind !== 'pg16') throw new Error('not pg16')
  return new URL(t.url)
}

describe('DB16 the switch, off (ARC-4: tests use PGlite)', () => {
  test.each([
    ['an empty env', {}],
    ['TEST_DB empty', { TEST_DB: '' }],
    ['DATABASE_URL set but the switch off', { DATABASE_URL: LIVE_URL }],
    ['a SUPABASE variable set but the switch off', { SUPABASE_SERVICE_ROLE_KEY: SECRET }],
    ['PGHOST non-local but the switch off', { PGHOST: LIVE_HOST }],
  ] as const)('ARC-4 %s: the db project stays on PGlite', async (_name, env) => {
    expect(await target(env)).toEqual({ kind: 'pglite' })
  })
})

describe('DB16 the switch, on (ARC-4: Postgres 16 in cloud checks)', () => {
  test('ARC-4 TEST_DB=pg16 gives a postgres url for the local cluster on 127.0.0.1, port 5432 by default', async () => {
    const u = await pgUrl({ TEST_DB: 'pg16' })
    expect(['postgres:', 'postgresql:']).toContain(u.protocol)
    expect(u.hostname).toBe('127.0.0.1')
    expect(['', '5432']).toContain(u.port)
  })

  test('ARC-4 TEST_DB=pg16 with PGPORT=5433 uses port 5433, still on 127.0.0.1', async () => {
    const u = await pgUrl({ TEST_DB: 'pg16', PGPORT: '5433' })
    expect(u.hostname).toBe('127.0.0.1')
    expect(u.port).toBe('5433')
  })

  test.each([['127.0.0.1'], ['localhost']])('ARC-4 TEST_DB=pg16 with PGHOST=%s is local: the url is on 127.0.0.1', async (host) => {
    const u = await pgUrl({ TEST_DB: 'pg16', PGHOST: host })
    expect(u.hostname).toBe('127.0.0.1')
  })

  test.each([
    ['PGHOST', LIVE_HOST],
    ['PGHOST', '10.0.0.5'],
    ['PGHOST', 'aws-0-ca-central-1.pooler.supabase.com'],
    ['PGHOSTADDR', '10.0.0.5'],
  ])('ARC-4 TEST_DB=pg16 with %s=%s (not local) is refused', async (name, host) => {
    const e = await refusal({ TEST_DB: 'pg16', [name]: host })
    expect(e, 'the switch must refuse').toBeInstanceOf(Error)
    expect(e?.message).not.toMatch(/exports no testDbTarget/)
    expect(e?.message).toContain(name)
  })

  test.each([['PG16'], ['true'], ['1'], ['postgres']])('ARC-4 TEST_DB=%s is not the switch value: refused, naming TEST_DB', async (value) => {
    const e = await refusal({ TEST_DB: value })
    expect(e, 'the switch must refuse').toBeInstanceOf(Error)
    expect(e?.message).not.toMatch(/exports no testDbTarget/)
    expect(e?.message).toMatch(/TEST_DB/)
  })

  test('ARC-4 TEST_DB holding a connection string is refused, naming TEST_DB and printing neither its password nor its host', async () => {
    const e = await refusal({ TEST_DB: LIVE_URL })
    expectRefused(e, /TEST_DB/, SECRET)
    expect(e?.message).not.toContain(LIVE_HOST)
  })
})

describe('DB16 the switch refuses a live database (decision 0003; SEC-7 is proven only on a test cluster)', () => {
  test.each([
    ['DATABASE_URL', 'a live url', LIVE_URL],
    ['DATABASE_URL', 'empty', ''],
    ['SUPABASE_URL', 'a live url', `https://${LIVE_HOST}`],
    ['SUPABASE_SERVICE_ROLE_KEY', 'a key', SECRET],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'a key', SECRET],
    ['SUPABASE_DB_PASSWORD', 'empty', ''],
  ])('ARC-4 TEST_DB=pg16 with %s set (%s) is refused, naming it and never printing its value', async (name, _kind, value) => {
    const e = await refusal({ TEST_DB: 'pg16', [name]: value })
    expect(e, 'the switch must refuse').toBeInstanceOf(Error)
    expect(e?.message).not.toMatch(/exports no testDbTarget/)
    expect(e?.message).toContain(name)
    if (value !== '') {
      expect(e?.message).not.toContain(SECRET)
      expect(e?.message).not.toContain(LIVE_HOST)
    }
  })
})

describe('DB16 the global setup refuses before it connects', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test.each([
    ['DATABASE_URL', LIVE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', SECRET],
    ['PGHOST', LIVE_HOST],
  ])(
    'ARC-4 with TEST_DB=pg16 and %s set, the db project global setup rejects naming it, and never prints a secret',
    async (name, value) => {
      vi.stubEnv('TEST_DB', 'pg16')
      vi.stubEnv(name, value)
      const { default: setup } = (await import('./global-setup')) as { default: () => Promise<unknown> }
      const e = await setup().then(
        () => undefined,
        (x: unknown) => (x instanceof Error ? x : new Error(String(x))),
      )
      expect(e, 'the global setup must refuse to start').toBeInstanceOf(Error)
      expect(e?.message).toContain(name)
      expect(e?.message).not.toContain(SECRET)
      expect(e?.message).not.toMatch(/network blocked in tests/)
    },
    BOOT_MS,
  )
})

describe('DB16 the cloud orders carry the switch', () => {
  test.each([['.claude/agents/checker.md'], ['.claude/cloud-worker-run.md']])(
    'ARC-4 %s gives the command that runs the tests with TEST_DB=pg16',
    (file) => {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
      expect(text).toMatch(/TEST_DB=pg16/)
    },
  )
})
