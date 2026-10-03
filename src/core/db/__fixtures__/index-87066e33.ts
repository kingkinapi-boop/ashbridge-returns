// PLANT (SC11 round 2, spec-owned): src/core/db/index.ts exactly as SC11's build round 1 left it (commit 87066e33),
// the version whose 8 pg.Pool and pg.Client sites have no error listener and whose three pool ends resolve
// before any socket has closed (R116, R117). Only two edits so it can live here: the import of ./target (now
// ../target) and REPO_ROOT one level deeper. Scanned as text only, never imported by product code, never edited.
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

const RUN_ID_SHAPE = /^[0-9a-z_]+$/

/** The id of this run's databases: set once by the global setup, read by every worker. */
export function pg16RunId(): string {
  const id = process.env[RUN_ID_ENV]
  if (id !== undefined && id !== '') {
    if (!RUN_ID_SHAPE.test(id)) throw new Error(`${RUN_ID_ENV} must use only lowercase letters, digits and underscores`)
    return id
  }
  return mintPg16RunId()
}

/** A new run id, put in DB16_RUN_ID for the workers; the global setup always mints one and never reuses an inherited id. */
export function mintPg16RunId(): string {
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

const ISOLATION_LEVELS = ['read uncommitted', 'read committed', 'repeatable read', 'serializable']

// A custom setting name: dotted parts, each plain (letters, digits, _ and $) or double-quoted.
const NAME_PART = String.raw`(?:"(?:[^"]|"")+"|[\w$]+)`
const SET_CONFIG_LITERAL = /set_config\s*\(\s*'([^']*\.[^']*)'/gi
const SET_STATEMENT = new RegExp(String.raw`\bset\s+(?:session\s+)?(${NAME_PART}(?:\.${NAME_PART})+)\s*(?:=|\bto\b)`, 'gi')
const CREATE_ROLE = new RegExp(String.raw`\bcreate\s+(?:role|user|group)\s+(?!mapping\b)(${NAME_PART})`, 'gi')

function unquoteName(name: string): string {
  return name.replace(/"((?:[^"]|"")+)"/g, (_m, inner: string) => inner.replaceAll('""', '"'))
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
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
    readonly pool: pg.Pool,
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
  readonly customSettings = new Set<string>()

  private opaque: string | undefined
  // Counts custom-setting statements: a connection that ran one is destroyed, because RESET leaves the name behind as ''.
  private customSeen = 0

  /** Runs a statement; remembers the custom settings it sets and the roles it creates, so close drops only this handle's roles. */
  private async tracked<R>(c: pg.Client | pg.PoolClient, sql: string, params: unknown[] | undefined, run: () => Promise<R>): Promise<R> {
    // Custom settings (app.x) are not listed in pg_settings: remember the names a statement sets.
    for (const m of sql.matchAll(SET_CONFIG_LITERAL)) {
      this.customSettings.add(m[1] as string)
      this.customSeen += 1
    }
    for (const m of sql.matchAll(SET_STATEMENT)) {
      this.customSettings.add(unquoteName(m[1] as string))
      this.customSeen += 1
    }
    // set_config($n, ...): the name comes from the parameters.
    for (const m of sql.matchAll(/set_config\s*\(\s*\$(\d+)/gi)) {
      const v = params?.[Number(m[1]) - 1]
      this.customSeen += 1
      if (typeof v === 'string' && /^[\w$]+\.[\w$.]+$/.test(v)) this.customSettings.add(v)
      else this.opaque = sql
    }
    // set_config(<anything but a literal or $n>, ...): a name this handle cannot carry.
    if (/set_config\s*\(\s*(?!'|\$\d)/i.test(sql)) this.opaque = sql
    // Roles are named in the text (also inside a DO block): this handle owns the ones that did not exist before and do after.
    const named = [...sql.matchAll(CREATE_ROLE)].map((m) => unquoteName(m[1] as string))
    if (named.length === 0) return run()
    const before = await this.rolesAmong(c, named)
    const out = await run()
    for (const n of await this.rolesAmong(c, named)) if (!before.has(n)) this.ownedRoles.add(n)
    return out
  }

  private async rolesAmong(c: { query: pg.Client['query'] }, names: string[]): Promise<Set<string>> {
    const r = await c.query<{ rolname: string }>('select rolname from pg_roles where rolname = any($1)', [names])
    return new Set(r.rows.map((x) => x.rolname))
  }

  async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const c = await this.session()
    const r = await this.tracked(c, sql, params, () => c.query<Record<string, unknown>>(sql, params))
    return { rows: r.rows as T[], affectedRows: r.rowCount ?? 0 }
  }

  async exec(sql: string): Promise<void> {
    const c = await this.session()
    await this.tracked(c, sql, undefined, () => c.query(sql))
  }

  /** The begin statement: the session's read-only, isolation and deferrable defaults apply to the transaction. */
  private async beginSql(): Promise<string> {
    const main = await this.session()
    const r = await main.query<{ ro: string; iso: string; d: string }>(
      `select current_setting('default_transaction_read_only') as ro, current_setting('default_transaction_isolation') as iso, current_setting('default_transaction_deferrable') as d`,
    )
    const row = r.rows[0]
    const iso = ISOLATION_LEVELS.find((l) => l === row?.iso) ?? 'read committed'
    return `begin isolation level ${iso} ${row?.ro === 'on' ? 'read only' : 'read write'}${row?.d === 'on' ? ' deferrable' : ''}`
  }

  /** Inside the open transaction: the handle's identity, role and settings, all transaction-local. */
  private async inheritSession(client: pg.PoolClient): Promise<void> {
    if (this.opaque !== undefined) {
      throw new Error(`transaction refused: this handle set a custom setting by a name it cannot carry: ${this.opaque}`)
    }
    const main = await this.session()
    const who = await main.query<{ u: string; s: string }>('select current_user as u, session_user as s')
    const row = who.rows[0]
    const login = await client.query<{ s: string }>('select session_user as s')
    if (row !== undefined && row.s !== login.rows[0]?.s) await client.query(`set local session authorization ${quoteIdent(row.s)}`)
    if (row !== undefined && row.u !== row.s) await client.query(`set local role ${quoteIdent(row.u)}`)
    const r = await main.query<{ name: string; setting: string }>(
      `select name, setting from pg_settings where source = 'session'`,
    )
    for (const { name, setting } of r.rows) {
      if (name !== 'role' && name !== 'session_authorization') await client.query('select set_config($1, $2, true)', [name, setting])
    }
    for (const name of this.customSettings) {
      const v = await main.query<{ v: string | null }>('select current_setting($1, true) as v', [name])
      const value = v.rows[0]?.v
      if (value !== undefined && value !== null) await client.query('select set_config($1, $2, true)', [name, value])
    }
  }

  async transaction<T>(fn: (tx: PgTx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    // ended: commit, rollback or failure has begun; a tx method called after it is refused, never sent to the pooled connection.
    const state = { rolledBack: false, ended: false }
    const seenBefore = this.customSeen
    const refuseWhenEnded = (): void => {
      if (state.ended) throw new Error('transaction already ended: this tx can no longer be used')
    }
    const tx: PgTx = {
      query: async <R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
        refuseWhenEnded()
        const r = await this.tracked(client, sql, params, () => client.query<Record<string, unknown>>(sql, params))
        return { rows: r.rows as R[], affectedRows: r.rowCount ?? 0 }
      },
      exec: async (sql: string): Promise<void> => {
        refuseWhenEnded()
        await this.tracked(client, sql, undefined, () => client.query(sql))
      },
      rollback: async (): Promise<void> => {
        refuseWhenEnded()
        state.rolledBack = true
        state.ended = true
        await client.query('rollback')
      },
    }
    try {
      await client.query(await this.beginSql())
      await this.inheritSession(client)
      const out = await fn(tx)
      state.ended = true
      if (!state.rolledBack) await client.query('commit')
      return out
    } catch (e) {
      state.ended = true
      // A failed rollback is caught by the wipe below, which then destroys the connection.
      if (!state.rolledBack) {
        try {
          await client.query('rollback')
        } catch {
          // the wipe below fails too, and destroys the connection
        }
      }
      throw e
    } finally {
      state.ended = true
      // Nothing set in this transaction's connection may reach the next one: wipe it, or destroy it.
      let failure: Error | boolean = this.customSeen !== seenBefore
      try {
        await client.query('rollback')
        await client.query('discard all')
      } catch (de) {
        failure = de instanceof Error ? de : new Error(String(de))
      }
      client.release(failure)
    }
  }

  private async dropOwnedRoles(): Promise<void> {
    // The session may sit in an open or aborted block: end it, or nothing below can run.
    await this.main.query('rollback')
    await this.main.query('reset session authorization')
    await this.main.query('reset role')
    const names = [...this.ownedRoles]
    // A role made in a transaction that rolled back is gone already.
    const present = names.length === 0 ? new Set<string>() : await this.rolesAmong(this.main, names)
    for (const rolname of names) {
      if (!present.has(rolname)) continue
      try {
        await this.main.query(`drop owned by ${quoteIdent(rolname)}`)
        await this.main.query(`drop role if exists ${quoteIdent(rolname)}`)
      } catch (e) {
        throw new Error(`could not drop role ${rolname}: ${e instanceof Error ? e.message : String(e)}`, { cause: e })
      }
    }
  }

  async close(): Promise<void> {
    if (this.closed_) return
    this.closed_ = true
    const failures: string[] = []
    const note = (e: unknown): void => {
      failures.push(e instanceof Error ? e.message : String(e))
    }
    // R90: a connection left dirty is named before its roles are dropped and before the pool ends.
    try {
      failures.push(...(await inspectIdle(this.pool, this.customSettings)))
    } catch (e) {
      note(e)
    }
    // Roles belong to the cluster, not to a database: drop the ones this handle made, and only those.
    if (this.connected !== undefined) {
      try {
        await this.dropOwnedRoles()
      } catch (e) {
        note(e)
      }
      await this.main.end()
    }
    await this.pool.end()
    await dropDatabase(this.adminUrl, this.name)
    if (failures.length > 0) throw new Error(`database handle closed with problems:\n${failures.join('\n')}`)
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

/** Problems of one idle pooled connection: what a test left on it. Ends any open block first, so an aborted block still shows its role. */
async function inspectClient(c: pg.PoolClient, login: string | undefined, customNames: string[]): Promise<string[]> {
  const out: string[] = []
  try {
    const r = await c.query<{ open: boolean }>('select now() <> statement_timestamp() as open')
    if (r.rows[0]?.open === true) out.push('an open transaction')
  } catch (e) {
    if ((e as { code?: string }).code !== '25P02') throw e
    out.push('an open transaction (aborted block)')
  }
  await c.query('rollback')
  const who = await c.query<{ u: string; s: string; names: string[] }>(
    `select current_user as u, session_user as s, coalesce((select json_agg(name order by name) from pg_settings where source = 'session' and name not in ('role', 'session_authorization')), '[]'::json) as names`,
  )
  const row = who.rows[0]
  if (row === undefined) return out
  if (login !== undefined && row.s !== login) out.push(`session authorization is set to ${quoteIdent(row.s)}`)
  if (row.u !== row.s) out.push(`role is set to ${quoteIdent(row.u)}`)
  for (const name of row.names) out.push(`session setting ${name} is set`)
  for (const name of customNames) {
    const v = await c.query<{ v: string | null }>('select current_setting($1, true) as v', [name])
    const value = v.rows[0]?.v
    if (value !== undefined && value !== null && value !== '') out.push(`custom setting ${name} is set to ${JSON.stringify(value)}`)
  }
  return out
}

/** Every idle connection of a pool, inspected; a dirty one is destroyed so it never serves another test. */
async function inspectIdle(pool: pg.Pool, customNames: Iterable<string>): Promise<string[]> {
  const login = pool.options.user
  const names = [...customNames]
  const clients: pg.PoolClient[] = []
  for (let i = pool.idleCount; i > 0; i -= 1) clients.push(await pool.connect())
  const problems: string[] = []
  const dirty = new Set<pg.PoolClient>()
  let failed = false
  try {
    for (const [n, c] of clients.entries()) {
      const found = await inspectClient(c, login, names)
      if (found.length > 0) dirty.add(c)
      problems.push(...found.map((p) => `idle connection ${String(n + 1)}: ${p}`))
    }
  } catch (e) {
    failed = true
    throw e
  } finally {
    for (const c of clients) c.release(failed || dirty.has(c))
  }
  return problems
}

/**
 * R90: what is left on the idle pooled connections of a handle (one string per problem); [] on PGlite, which has no pool,
 * and on a closed handle.
 */
export async function idleConnectionProblems(db: unknown): Promise<string[]> {
  const h = db as { pool?: pg.Pool; customSettings?: Set<string>; closed?: boolean }
  if (h.pool === undefined || h.closed === true) return []
  return inspectIdle(h.pool, h.customSettings ?? [])
}

/** R90: rejects naming every problem of every open clone made by cloneTestDb (the db project's afterEach, before the clones close). */
export async function assertCleanClones(): Promise<void> {
  const lines: string[] = []
  for (const [n, c] of clones.entries()) {
    for (const p of await idleConnectionProblems(c)) lines.push(`clone ${String(n + 1)}: ${p}`)
  }
  if (lines.length > 0) throw new Error(`a test left pooled connections dirty:\n${lines.join('\n')}`)
}

/** R91: the roles in after that were not in before, sorted. */
export function leftoverRoles(before: Iterable<string>, after: Iterable<string>): string[] {
  const had = new Set(before)
  return [...new Set(after)].filter((r) => !had.has(r)).sort()
}

/** R91: every role of the cluster (the global setup and its teardown compare two lists). */
export async function listRoles(url: string): Promise<string[]> {
  const admin = new pg.Client(connOpts(url))
  await admin.connect()
  try {
    const r = await admin.query<{ rolname: string }>('select rolname from pg_roles')
    return r.rows.map((x) => x.rolname)
  } finally {
    await admin.end()
  }
}
