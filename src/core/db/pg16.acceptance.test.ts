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
//
// Round 2 (reports/DB16-spec-review.md, A411):
// - Fail closed: with the switch on and nothing listening on the port, the global setup and
//   createTemplate() both reject (never fall back to PGlite). Env is read at call time.
// - Refusals happen before any socket is opened; with the switch off the setup connects nowhere, even
//   with DATABASE_URL or a SUPABASE variable set. A SUPABASE name in lower case counts too.
// - The pg16 url never carries PGPASSWORD; no planted value reaches an error or the console.
// - Rule scan: no db test file (the db include of tools/test-homes.json) and no non-test file under
//   src/ outside src/core/db/ builds a database (new PGlite(, PGlite.create(, a value import of
//   PGlite), so every path goes through src/core/db and honours the switch.
// - The cloud orders name the steps: the cluster start, the switch with the db project command on one
//   line, when it runs, and the identity test that must pass, not be skipped.
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { readOwnSource } from '../testing/read-own-source'

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
    ['supabase_url', 'a live url, the name in lower case', `https://${LIVE_HOST}`],
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

// The env names the switch reads; each test stubs every one of them, so a box that runs the whole suite
// with TEST_DB=pg16 (or a stray PGHOST) set cannot change what a test here sees.
const SWITCH_ENV = ['TEST_DB', 'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGPASSWORD', 'DATABASE_URL'] as const
const PW = 'PLANTED-db16-pass'

function cleanSwitchEnv(): void {
  for (const name of SWITCH_ENV) vi.stubEnv(name, undefined)
  for (const name of Object.keys(process.env)) if (/supabase/i.test(name)) vi.stubEnv(name, undefined)
}

async function runSetup(): Promise<Error | undefined> {
  const { default: setup } = (await import('./global-setup')) as { default: () => Promise<unknown> }
  return setup().then(
    () => undefined,
    (x: unknown) => (x instanceof Error ? x : new Error(String(x))),
  )
}

/** A loopback port nothing listens on: opened by us, then closed. */
async function closedPort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve()
    })
  })
  return address.port
}

/** Counts every socket connect (net.connect, new Socket().connect, a driver's pool) from here on. */
function socketConnects(): { calls: () => number } {
  const spy = vi.spyOn(net.Socket.prototype, 'connect')
  return { calls: () => spy.mock.calls.length }
}

/** Collects everything written through console during a step. */
function consoleText(): () => string {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined))
  return () => spies.flatMap((s) => s.mock.calls.map((args) => args.map((a) => (a instanceof Error ? `${a.message} ${String(a.stack)}` : String(a))).join(' '))).join('\n')
}

describe('DB16 the global setup refuses before it connects', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  test.each([
    ['DATABASE_URL', LIVE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', SECRET],
    ['PGHOST', LIVE_HOST],
  ])(
    'ARC-4 with TEST_DB=pg16 and %s set, the db project global setup rejects naming it, before any socket is opened, and never prints a secret',
    async (name, value) => {
      cleanSwitchEnv()
      vi.stubEnv('TEST_DB', 'pg16')
      vi.stubEnv(name, value)
      const sockets = socketConnects()
      const e = await runSetup()
      expect(e, 'the global setup must refuse to start').toBeInstanceOf(Error)
      expect(e?.message).toContain(name)
      expect(e?.message).not.toContain(SECRET)
      expect(e?.message).not.toMatch(/network blocked in tests/)
      expect(sockets.calls(), 'the refusal comes before any connection is tried').toBe(0)
    },
    BOOT_MS,
  )

  test(
    'ARC-4 with the switch off, DATABASE_URL and a SUPABASE variable set do not block the run: the global setup resolves on PGlite and opens no socket at all',
    async () => {
      cleanSwitchEnv()
      vi.stubEnv('TEST_DB', '')
      vi.stubEnv('DATABASE_URL', LIVE_URL)
      vi.stubEnv('SUPABASE_URL', `https://${LIVE_HOST}`)
      const sockets = socketConnects()
      const said = consoleText()
      const e = await runSetup()
      expect(e, 'the switch off never refuses').toBeUndefined()
      expect(sockets.calls(), 'PGlite connects nowhere').toBe(0)
      expect(said(), 'the setup never prints the planted live url').not.toContain('PLANTED')
    },
    BOOT_MS,
  )
})

describe('DB16 fail closed: the switch on with no cluster never falls back to PGlite (ARC-4)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  test(
    'ARC-4 TEST_DB=pg16 with nothing listening on PGPORT: the db project global setup rejects (it does not resolve on PGlite)',
    async () => {
      cleanSwitchEnv()
      vi.stubEnv('TEST_DB', 'pg16')
      vi.stubEnv('PGPORT', String(await closedPort()))
      const e = await runSetup()
      expect(e, 'the global setup must fail when the cluster is down').toBeInstanceOf(Error)
      expect(e?.message).not.toMatch(/network blocked in tests/)
    },
    BOOT_MS,
  )

  test(
    'ARC-4 TEST_DB=pg16 with nothing listening on PGPORT: createTemplate() rejects; it never returns a PGlite template (the worker path honours the switch)',
    async () => {
      cleanSwitchEnv()
      vi.stubEnv('TEST_DB', 'pg16')
      vi.stubEnv('PGPORT', String(await closedPort()))
      const { createTemplate } = await import('./index')
      const outcome = await createTemplate().then(
        async (t) => {
          const db = await t.clone()
          const v = await db.query<{ v: string }>('select version() as v')
          await db.close()
          await t.close()
          return `resolved on ${v.rows[0]?.v ?? 'an unknown backend'}`
        },
        (x: unknown) => (x instanceof Error ? x : new Error(String(x))),
      )
      expect(outcome, 'createTemplate() must reject when the cluster is down').toBeInstanceOf(Error)
      expect(outcome instanceof Error ? outcome.message : outcome).not.toMatch(/network blocked in tests/)
    },
    BOOT_MS,
  )
})

describe('DB16 no secret on the Postgres 16 path (SEC-10)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  test('SEC-10 TEST_DB=pg16 with PGPASSWORD set: the url the switch builds carries no password and no planted value', async () => {
    const u = await pgUrl({ TEST_DB: 'pg16', PGPASSWORD: PW })
    expect(u.password).toBe('')
    expect(u.href).not.toContain(PW)
    expect(u.href).not.toContain('PLANTED')
  })

  test(
    'SEC-10 TEST_DB=pg16 with PGPASSWORD set and the cluster down: neither the setup rejection nor anything it logs holds the password',
    async () => {
      cleanSwitchEnv()
      vi.stubEnv('TEST_DB', 'pg16')
      vi.stubEnv('PGPASSWORD', PW)
      vi.stubEnv('PGPORT', String(await closedPort()))
      const said = consoleText()
      const e = await runSetup()
      expect(e, 'the global setup must fail when the cluster is down').toBeInstanceOf(Error)
      expect(`${e?.message ?? ''} ${String(e?.stack)} ${String((e?.cause as Error | undefined)?.message)}`).not.toContain('PLANTED')
      expect(said()).not.toContain('PLANTED')
    },
    BOOT_MS,
  )
})

// ---- The rule scan: only src/core/db builds a database (ARC-4) ----

const PGLITE_IMPORT = /import\s+(?!type\b)([^'";]*?)\s*from\s*['"]@electric-sql\/pglite(?:\/[^'"]*)?['"]/g
const DYNAMIC_PGLITE = /(?:import|require)\s*\(\s*['"]@electric-sql\/pglite(?:\/[^'"]*)?['"]\s*\)/

/** The ways a file can build a database without going through src/core/db, as problem strings. */
function databaseBuilds(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const found: string[] = []
  if (/\bnew\s+PGlite\s*\(/.test(code)) found.push('new PGlite(')
  if (/\bPGlite\s*\.\s*create\s*\(/.test(code)) found.push('PGlite.create(')
  if (DYNAMIC_PGLITE.test(code)) found.push('a dynamic import of @electric-sql/pglite')
  for (const m of code.matchAll(PGLITE_IMPORT)) {
    const clause = m[1] ?? ''
    const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? ''
    const outside = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim()
    const valueNames = named
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '' && !s.startsWith('type '))
      .map((s) => s.split(/\s+as\s+/)[0]?.trim())
    if (outside !== '' || valueNames.includes('PGlite')) found.push('a value import of PGlite')
  }
  return found
}

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  return fs.readdirSync(abs, { recursive: true, encoding: 'utf8' }).map((f) => `${dir}/${f.replace(/\\/g, '/')}`)
}

function globToRegExp(glob: string): RegExp {
  const body = glob
    .split('**/')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('(?:.*/)?')
  return new RegExp(`^${body}$`)
}

function scannedFiles(): { db: string[]; code: string[] } {
  const homes = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'test-homes.json'), 'utf8')) as { db: { include: string[] } }
  const dbGlobs = homes.db.include.map(globToRegExp)
  const all = [...walk('src'), ...walk('testworld')].filter((f) => !f.includes('node_modules/'))
  const db = all.filter((f) => dbGlobs.some((g) => g.test(f)))
  const code = all.filter(
    (f) => f.startsWith('src/') && !f.startsWith('src/core/db/') && /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(f) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(f),
  )
  return { db, code }
}

describe('DB16 only src/core/db builds a database (ARC-4: every path honours the switch)', () => {
  test.each([
    ["import { PGlite } from '@electric-sql/pglite'", 'a value import of PGlite'],
    ["import { PGlite as Db, type Transaction } from '@electric-sql/pglite'", 'a value import of PGlite'],
    ["import * as pglite from '@electric-sql/pglite'", 'a value import of PGlite'],
    ["import PGliteDefault from '@electric-sql/pglite'", 'a value import of PGlite'],
    ["const m = await import('@electric-sql/pglite')", 'a dynamic import of @electric-sql/pglite'],
    ['const db = new PGlite()', 'new PGlite('],
    ["const db = await PGlite.create({ dataDir: 'memory://' })", 'PGlite.create('],
  ])('ARC-4 planted: %s is flagged', (text, problem) => {
    expect(databaseBuilds(text)).toContain(problem)
  })

  test.each([
    ["import type { PGlite } from '@electric-sql/pglite'"],
    ["import { type PGlite, type Transaction } from '@electric-sql/pglite'"],
    ['async function f(db: PGlite): Promise<void> {}'],
    ['// a comment about new PGlite() is not code'],
  ])('ARC-4 clean: %s is not flagged', (text) => {
    expect(databaseBuilds(text)).toEqual([])
  })

  test('ARC-4 no db test file and no non-test file under src/ outside src/core/db builds a database', () => {
    const { db, code } = scannedFiles()
    expect(db.length, 'the db include must reach every db test file').toBeGreaterThanOrEqual(9)
    expect(db).toContain('src/modules/auth/auth.acceptance.db.test.ts')
    expect(db).toContain('src/core/db/pg16.acceptance.db.test.ts')
    expect(code).toContain('src/modules/auth/index.ts')
    expect(code.some((f) => f.startsWith('src/core/db/'))).toBe(false)
    const problems = [...db, ...code].flatMap((f) => databaseBuilds(readOwnSource(path.join(ROOT, f))).map((p) => `${f}: ${p}`))
    expect(problems).toEqual([])
  })
})

// ---- The cloud orders (tightened in round 2: the steps, not just the text) ----

const CLUSTER_START = /pg_ctlcluster\s+16\s+\S+\s+start|\bpg_ctl\b[^\n]*\bstart\b|service\s+postgresql\s+start|systemctl\s+start\s+postgresql/
const DB_PROJECT_RUN = /--project[ =]db\b|\bnpm\s+(?:run\s+)?test\b/
const IDENTITY_TEST = 'a test database is Postgres 16'

describe('DB16 the cloud orders carry the switch', () => {
  test.each([['.claude/agents/checker.md'], ['.claude/cloud-worker-run.md']])(
    'ARC-4 %s names the steps: the cluster start, TEST_DB=pg16 with the db project command on one line, when it runs, and the identity test that must pass, not be skipped',
    (file) => {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
      const lines = text.split(/\r?\n/)
      expect(text).toMatch(/TEST_DB=pg16/)
      expect(
        lines.some((l) => l.includes('TEST_DB=pg16') && DB_PROJECT_RUN.test(l)),
        'one line holds TEST_DB=pg16 and the command that runs the db project',
      ).toBe(true)
      expect(text, 'the command that starts the preinstalled Postgres 16 cluster').toMatch(CLUSTER_START)
      expect(text, 'when: every train').toMatch(/every train/i)
      expect(text, 'when: a card touching db/').toMatch(/\bdb\//)
      expect(text, 'when: a card touching a *.db.test.ts').toMatch(/\*\.db\.test\.ts/)
      expect(
        lines.some((l) => l.includes(IDENTITY_TEST) && /not skipped/i.test(l)),
        `one line names the identity test ("${IDENTITY_TEST}") and says it must pass, not be skipped`,
      ).toBe(true)
    },
  )
})
