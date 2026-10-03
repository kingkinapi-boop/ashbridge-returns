// PLANT (SC11, spec-owned): src/core/db/index.ts exactly as DB16's round 4 check found it (commit 36672c88),
// the version whose pooled connections leaked a role and settings and whose cleanup swallowed failures.
// Only three edits so it can live here: the import of ./target (now ../target), REPO_ROOT one level deeper,
// and the database name kinds (otpl, odb) so its names never collide with the real index.ts in one run.
// The rules in rules.acceptance.db.test.ts (R90, R92) must fail on this file; R92's scan of the real
// src/core/db skips __fixtures__. Never imported by product code, never edited.
// PGlite for tests (ARC-4). The db project boots one template per worker in its setup file
// (vitest-setup.ts); a test only clones it. A test body never pays a cold start.
// DB16: with TEST_DB=pg16 the same template and clone calls run on a local Postgres 16 cluster
// (127.0.0.1 only; a fresh database per template, cloned with CREATE DATABASE ... TEMPLATE).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'
import { testDbTarget } from '../target'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
export const DEFAULT_SCHEMA_DIR = path.join(REPO_ROOT, 'db', 'schema')

export interface DbTemplate {
  clone(): Promise<PGlite>
  close(): Promise<void>
}

export { testDbTarget, type TestDbTarget } from '../target'

// A throwaway test cluster on this box: the default credentials guard nothing real (decision 0003).
// The url never carries a password; the driver gets it from PGPASSWORD, else this default.
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

// A JS Date goes to the server by its UTC clock, as PGlite sends it (not the box's local time).
pg.defaults.parseInputDatesAsUTC = true

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

  private readonly ownedRoles = new Set<string>()
  private readonly customSettings = new Set<string>()

  private async roleNames(c: { query: pg.Client['query'] }): Promise<Set<string>> {
    const r = await c.query<{ rolname: string }>('select rolname from pg_roles')
    return new Set(r.rows.map((x) => x.rolname))
  }

  /** Runs a statement; when it creates a role, remembers which one, so close drops only this handle's roles. */
  private async tracked<R>(c: pg.Client | pg.PoolClient, sql: string, run: () => Promise<R>): Promise<R> {
    // Custom settings (app.x) are not listed in pg_settings: remember the names a statement sets.
    for (const m of sql.matchAll(/set_config\(\s*'([\w]+\.[\w.]+)'|\bset\s+(?:session\s+)?([\w]+\.[\w.]+)\s*(?:=|\bto\b)/gi)) {
      this.customSettings.add((m[1] ?? m[2]) as string)
    }
    if (!/\bcreate\s+(role|user)\b/i.test(sql)) return run()
    const before = await this.roleNames(c)
    const out = await run()
    for (const n of await this.roleNames(c)) if (!before.has(n)) this.ownedRoles.add(n)
    return out
  }

  async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const c = await this.session()
    const r = await this.tracked(c, sql, () => c.query<Record<string, unknown>>(sql, params))
    return { rows: r.rows as T[], affectedRows: r.rowCount ?? 0 }
  }

  async exec(sql: string): Promise<void> {
    const c = await this.session()
    await this.tracked(c, sql, () => c.query(sql))
  }

  /** A transaction connection starts with the handle's role and settings (set in the main session) and is wiped when it is returned. */
  private async inheritSession(client: pg.PoolClient): Promise<void> {
    await client.query('reset role')
    const main = await this.session()
    const r = await main.query<{ name: string; setting: string }>(
      `select name, setting from pg_settings where source = 'session'`,
    )
    for (const { name, setting } of r.rows) {
      if (name !== 'role') await client.query('select set_config($1, $2, false)', [name, setting])
    }
    for (const name of this.customSettings) {
      const v = await main.query<{ v: string | null }>('select current_setting($1, true) as v', [name])
      const value = v.rows[0]?.v
      if (value !== undefined && value !== null) await client.query('select set_config($1, $2, false)', [name, value])
    }
    const who = await main.query<{ u: string; s: string }>('select current_user as u, session_user as s')
    const row = who.rows[0]
    if (row !== undefined && row.u !== row.s) await client.query(`set role "${row.u.replaceAll('"', '""')}"`)
  }

  async transaction<T>(fn: (tx: PgTx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    const state = { rolledBack: false }
    const tx: PgTx = {
      query: async <R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
        const r = await this.tracked(client, sql, () => client.query<Record<string, unknown>>(sql, params))
        return { rows: r.rows as R[], affectedRows: r.rowCount ?? 0 }
      },
      exec: async (sql: string): Promise<void> => {
        await this.tracked(client, sql, () => client.query(sql))
      },
      rollback: async (): Promise<void> => {
        state.rolledBack = true
        await client.query('rollback')
      },
    }
    try {
      await this.inheritSession(client)
      await client.query('begin')
      const out = await fn(tx)
      if (!state.rolledBack) await client.query('commit')
      return out
    } catch (e) {
      if (!state.rolledBack) await client.query('rollback').catch(() => undefined)
      throw e
    } finally {
      // Nothing set in this transaction's connection may reach the next one.
      await client.query('reset role; reset all').catch(() => undefined)
      client.release()
    }
  }

  private async dropOwnedRoles(): Promise<void> {
    await this.main.query('reset role')
    for (const rolname of this.ownedRoles) {
      await this.main.query(`drop owned by "${rolname}"`).catch(() => undefined)
      await this.main.query(`drop role if exists "${rolname}"`).catch(() => undefined)
    }
  }

  async close(): Promise<void> {
    if (this.closed_) return
    this.closed_ = true
    // Roles belong to the cluster, not to a database: drop the ones this handle made, and only those.
    if (this.connected !== undefined) {
      await this.dropOwnedRoles().catch(() => undefined)
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
  const tplName = freshDbName('otpl')
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
      const name = freshDbName('odb')
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
