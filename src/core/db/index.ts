// PGlite for tests (ARC-4). The db project boots one template per worker in its setup file
// (vitest-setup.ts); a test only clones it. A test body never pays a cold start.
// DB16: with TEST_DB=pg16 the same template and clone calls run on a local Postgres 16 cluster
// (127.0.0.1 only; a fresh database per template, cloned with CREATE DATABASE ... TEMPLATE).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const DEFAULT_SCHEMA_DIR = path.join(REPO_ROOT, 'db', 'schema')

export interface DbTemplate {
  clone(): Promise<PGlite>
  close(): Promise<void>
}

export type TestDbTarget = { kind: 'pglite' } | { kind: 'pg16'; url: string }

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
// A throwaway test cluster on this box: the default credentials guard nothing real (decision 0003).
// The url never carries a password; the driver gets it from PGPASSWORD, else this default.
const LOCAL_USER = 'postgres'
const LOCAL_PASSWORD = 'postgres'

function connOpts(connectionString: string): pg.ClientConfig {
  // Fields, not the url: a url without a password would overwrite the password given beside it.
  const u = new URL(connectionString)
  const password = process.env['PGPASSWORD']
  return {
    host: u.hostname,
    port: Number(u.port),
    user: decodeURIComponent(u.username),
    database: decodeURIComponent(u.pathname.slice(1)),
    password: password !== undefined && password !== '' ? password : LOCAL_PASSWORD,
    // Session settings pinned to what PGlite gives every db test today (fixed UTC-5, no daylight time).
    options: '-c TimeZone=Etc/GMT+5 -c DateStyle=ISO,MDY -c IntervalStyle=postgres -c standard_conforming_strings=on',
    types: typeParsers,
  }
}

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

function schemaFiles(schemaDir: string): string[] {
  return fs.existsSync(schemaDir)
    ? fs.readdirSync(schemaDir).filter((f) => f.endsWith('.sql')).sort()
    : []
}

const RUN_ID_ENV = 'DB16_RUN_ID'
const DB_PREFIX = 'ashbridge_t_'
let dbCounter = 0

/** The id of this run's databases: set once by the global setup, read by every worker. */
export function pg16RunId(): string {
  const id = process.env[RUN_ID_ENV]
  if (id !== undefined && id !== '') return id
  const fresh = `${String(process.pid)}_${Math.random().toString(36).slice(2, 8)}`
  process.env[RUN_ID_ENV] = fresh
  return fresh
}

function freshDbName(kind: string): string {
  dbCounter += 1
  return `${DB_PREFIX}${pg16RunId()}_${kind}${String(dbCounter)}_${String(process.pid)}`
}

const typeParsers = {
  getTypeParser: (oid: number, format?: 'text' | 'binary'): ((v: string) => unknown) => {
    // PGlite gives int8 as a number when it is safe, else a bigint; keep the two backends alike.
    if (oid === 20) {
      return (v: string) => {
        const n = BigInt(v)
        return n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER) ? n : Number(n)
      }
    }
    // A date is a Date at UTC midnight, as PGlite gives it.
    if (oid === 1082) return (v: string) => new Date(`${v}T00:00:00.000Z`)
    return pg.types.getTypeParser(oid, format) as (v: string) => unknown
  },
}

function withDatabase(url: string, name: string): string {
  const u = new URL(url)
  u.pathname = `/${name}`
  return u.toString()
}

interface QueryResult<T> {
  rows: T[]
  affectedRows: number
}

/**
 * A PGlite-shaped handle (query, exec, transaction, close) on one database of the local cluster.
 * query and exec share one session (so `set role` holds, as on PGlite); each transaction takes its own
 * connection, so two transactions really overlap.
 */
class PgDb {
  private closed_ = false
  private readonly main: pg.Client
  private connected: Promise<unknown> | undefined
  constructor(
    private readonly pool: pg.Pool,
    private readonly adminUrl: string,
    private readonly name: string,
    dbUrl: string,
  ) {
    this.main = new pg.Client(connOpts(dbUrl))
  }

  private session(): Promise<pg.Client> {
    this.connected ??= this.main.connect()
    return (this.connected).then(() => this.main)
  }

  get closed(): boolean {
    return this.closed_
  }

  async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const r = await (await this.session()).query<Record<string, unknown>>(sql, params)
    return { rows: r.rows as T[], affectedRows: r.rowCount ?? 0 }
  }

  async exec(sql: string): Promise<void> {
    await (await this.session()).query(sql)
  }

  async transaction<T>(fn: (tx: PgTx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    const state = { rolledBack: false }
    const tx: PgTx = {
      query: async <R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
        const r = await client.query<Record<string, unknown>>(sql, params)
        return { rows: r.rows as R[], affectedRows: r.rowCount ?? 0 }
      },
      exec: async (sql: string): Promise<void> => {
        await client.query(sql)
      },
      rollback: async (): Promise<void> => {
        state.rolledBack = true
        await client.query('rollback')
      },
    }
    try {
      await client.query('begin')
      const out = await fn(tx)
      if (!state.rolledBack) await client.query('commit')
      return out
    } catch (e) {
      if (!state.rolledBack) await client.query('rollback').catch(() => undefined)
      throw e
    } finally {
      client.release()
    }
  }

  private async dropTestRoles(): Promise<void> {
    await this.main.query('reset role')
    const r = await this.main.query<{ rolname: string }>(
      `select rolname from pg_roles where rolname not like 'pg\\_%' and rolname <> 'postgres'`,
    )
    for (const { rolname } of r.rows) {
      await this.main.query(`drop owned by "${rolname}"`)
      await this.main.query(`drop role if exists "${rolname}"`)
    }
  }

  async close(): Promise<void> {
    if (this.closed_) return
    this.closed_ = true
    // Roles belong to the cluster, not to a database: drop the ones this test made, so the next test can make them again.
    if (this.connected !== undefined) {
      await this.dropTestRoles().catch(() => undefined)
      await this.main.end()
    }
    await this.pool.end()
    await dropDatabase(this.adminUrl, this.name)
  }
}

interface PgTx {
  query<R>(sql: string, params?: unknown[]): Promise<QueryResult<R>>
  exec(sql: string): Promise<void>
  rollback(): Promise<void>
}

async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  const admin = new pg.Client(connOpts(adminUrl))
  await admin.connect()
  try {
    await admin.query(`drop database if exists "${name}" with (force)`)
  } finally {
    await admin.end()
  }
}

/** Drops every database this run made (the global setup's teardown). */
export async function dropRunDatabases(url: string): Promise<void> {
  const admin = new pg.Client(connOpts(url))
  await admin.connect()
  try {
    const r = await admin.query<{ datname: string }>('select datname from pg_database where datname like $1', [
      `${DB_PREFIX}${pg16RunId().replaceAll('_', '\\_')}\\_%`,
    ])
    for (const { datname } of r.rows) await admin.query(`drop database if exists "${datname}" with (force)`)
  } finally {
    await admin.end()
  }
}

async function createPg16Template(url: string, schemaDir: string): Promise<DbTemplate> {
  const tplName = freshDbName('tpl')
  const admin = new pg.Client(connOpts(url))
  await admin.connect()
  try {
    await admin.query(`create database "${tplName}" template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C.UTF-8'`)
  } finally {
    await admin.end()
  }
  const schemaPool = new pg.Pool({ ...connOpts(withDatabase(url, tplName)), max: 1 })
  try {
    for (const f of schemaFiles(schemaDir)) {
      try {
        await schemaPool.query(fs.readFileSync(path.join(schemaDir, f), 'utf8'))
      } catch (e) {
        throw new Error(`schema file ${f} failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e })
      }
    }
  } catch (e) {
    await schemaPool.end()
    await dropDatabase(url, tplName)
    throw e
  }
  await schemaPool.end()
  return {
    clone: async () => {
      const name = freshDbName('db')
      const c = new pg.Client(connOpts(url))
      await c.connect()
      try {
        await c.query(`create database "${name}" template "${tplName}"`)
      } finally {
        await c.end()
      }
      const pool = new pg.Pool({ ...connOpts(withDatabase(url, name)), max: 4 })
      return new PgDb(pool, url, name, withDatabase(url, name)) as unknown as PGlite
    },
    close: () => dropDatabase(url, tplName),
  }
}

/** Boots the template once (PGlite, or Postgres 16 with TEST_DB=pg16) and applies every *.sql file in name order. */
export async function createTemplate(schemaDir: string = DEFAULT_SCHEMA_DIR): Promise<DbTemplate> {
  const target = testDbTarget(process.env)
  if (target.kind === 'pg16') return createPg16Template(target.url, schemaDir)
  return createPgliteTemplate(schemaDir)
}

async function createPgliteTemplate(schemaDir: string): Promise<DbTemplate> {
  const db = new PGlite()
  try {
    for (const f of schemaFiles(schemaDir)) {
      try {
        await db.exec(fs.readFileSync(path.join(schemaDir, f), 'utf8'))
      } catch (e) {
        throw new Error(`schema file ${f} failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e })
      }
    }
  } catch (e) {
    await db.close()
    throw e
  }
  const template: DbTemplate = {
    clone: async () => (await db.clone()) as PGlite,
    close: () => db.close(),
  }
  // The first clone pays a one-off cost (seconds); pay it here, in the warm-up, not in a test.
  await (await template.clone()).close()
  return template
}

let active: DbTemplate | undefined
const clones: PGlite[] = []

/** Used by the db project's setup file only. */
export function setActiveTemplate(template: DbTemplate | undefined): void {
  active = template
}

export function hasActiveTemplate(): boolean {
  return active !== undefined
}

export async function cloneTestDb(): Promise<PGlite> {
  if (!active) throw new Error('db warm-up did not run')
  const db = await active.clone()
  clones.push(db)
  return db
}

/** Closes every clone made since the last call (the db project's afterEach). */
export async function closeClones(): Promise<void> {
  const open = clones.splice(0)
  await Promise.all(open.filter((c) => !c.closed).map((c) => c.close()))
}
