// @mutate
// The Postgres 16 backend of the db test project (ARC-4, DB16): the switch (testDbTarget) and a
// PGlite-shaped handle over a local cluster. Only reached with TEST_DB=pg16, on a cloud box.
import pg from 'pg'
import type { PGlite, Transaction } from '@electric-sql/pglite'

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

// PGlite hands back int8 as a number when it is safe, else a bigint; match it.
pg.types.setTypeParser(20, (v) => {
  const n = BigInt(v)
  return n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n
})

interface Queryable {
  query(text: string, params?: unknown[]): Promise<pg.QueryResult>
}

function shape(r: pg.QueryResult | pg.QueryResult[]): { rows: unknown[]; affectedRows: number; fields: { name: string; dataTypeID: number }[] } {
  const last = Array.isArray(r) ? r[r.length - 1] : r
  return {
    rows: last?.rows ?? [],
    affectedRows: last?.rowCount ?? 0,
    fields: (last?.fields ?? []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
  }
}

function methods(q: Queryable): { query: (text: string, params?: unknown[]) => Promise<unknown>; exec: (text: string) => Promise<unknown[]> } {
  return {
    query: async (text, params) => shape(await q.query(text, params ?? [])),
    exec: async (text) => {
      const r = (await q.query(text)) as pg.QueryResult | pg.QueryResult[]
      return (Array.isArray(r) ? r : [r]).map(shape)
    },
  }
}

function adminPool(url: string, database: string): pg.Pool {
  const u = new URL(url)
  u.pathname = `/${database}`
  const pool = new pg.Pool({ connectionString: u.toString(), max: 4 })
  pool.on('error', () => undefined) // an idle backend going away is not a test failure
  return pool
}

function quoteIdent(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error('unsafe database name')
  return `"${name}"`
}

/** Plain drop, retried while the ended backends exit; force only as the last resort (it fires 57P01 at a closing client). */
async function dropDatabase(admin: pg.Pool, name: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      await admin.query(`drop database if exists ${quoteIdent(name)}`)
      return
    } catch (e) {
      if ((e as { code?: string }).code !== '55006') throw e
      await new Promise((r) => setTimeout(r, 50))
    }
  }
  await admin.query(`drop database if exists ${quoteIdent(name)} with (force)`)
}

/** Roles are cluster-wide, so a test that makes one must not leave it for the next run: everything but the
 *  system roles and the connecting role is test-made and is dropped (the cluster is a test cluster). */
async function dropTestRoles(admin: pg.Pool): Promise<void> {
  const r = await admin.query<{ rolname: string }>(`select rolname from pg_roles where rolname !~ '^pg_' and rolname <> current_user and rolname <> 'postgres'`)
  for (const { rolname } of r.rows) await admin.query(`drop role if exists "${rolname.replace(/"/g, '""')}"`).catch(() => undefined)
}

function uniqueName(prefix: string): string {
  return `${prefix}_${String(process.pid)}_${Math.random().toString(36).slice(2, 10)}`
}

export interface Pg16Template {
  name: string
  clone(): Promise<PGlite>
  /** Drops the template and every clone of it, on every worker. */
  drop(): Promise<void>
  close(): Promise<void>
}

/** Creates a fresh template database on the local cluster and loads the schema into it. */
export async function createPg16Template(url: string, schemaSql: { file: string; sql: string }[]): Promise<Pg16Template> {
  const name = uniqueName('ashbridge_tpl')
  return openPg16Template(url, name, schemaSql)
}

async function openPg16Template(url: string, name: string, schemaSql: { file: string; sql: string }[] | undefined): Promise<Pg16Template> {
  const admin = adminPool(url, 'postgres')
  if (schemaSql !== undefined) await dropTestRoles(admin)
  const databases: string[] = []
  const handles: pg.Pool[] = []
  const dropAll = async (): Promise<void> => {
    await Promise.all(handles.splice(0).map((p) => p.end().catch(() => undefined)))
    for (const d of databases.splice(0)) await dropDatabase(admin, d)
  }
  try {
    if (schemaSql !== undefined) {
      await admin.query(`create database ${quoteIdent(name)}`)
      databases.push(name)
      const pool = adminPool(url, name)
      try {
        for (const { file, sql } of schemaSql) {
          try {
            await pool.query(sql)
          } catch (e) {
            throw new Error(`schema file ${file} failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e })
          }
        }
      } finally {
        await pool.end()
      }
    }
  } catch (e) {
    await dropAll()
    await admin.end()
    throw e
  }
  const owned = schemaSql !== undefined
  return {
    name,
    clone: async () => {
      const db = `${name}_c_${Math.random().toString(36).slice(2, 10)}`
      await admin.query(`create database ${quoteIdent(db)} template ${quoteIdent(name)}`)
      databases.push(db)
      const pool = adminPool(url, db)
      handles.push(pool)
      return handleFor(pool, async () => {
        await dropDatabase(admin, db)
        await dropTestRoles(admin)
      }) as PGlite
    },
    drop: async () => {
      // Used by the global setup: the template and every clone any worker left behind.
      await Promise.all(handles.splice(0).map((p) => p.end().catch(() => undefined)))
      const left = await admin.query<{ datname: string }>('select datname from pg_database where datname = $1 or datname like $2', [name, `${name.replace(/_/g, '\\_')}\\_c\\_%`])
      for (const { datname } of left.rows) await dropDatabase(admin, datname)
      await dropTestRoles(admin)
      databases.splice(0)
    },
    close: async () => {
      // A borrowed template (named by the global setup) is dropped by the global setup, not here.
      if (!owned) databases.splice(databases.indexOf(name), 1)
      await dropAll()
      await admin.end()
    },
  }
}

/** A worker's view of the template the global setup made: clones from it, never drops it. */
export function borrowPg16Template(url: string, name: string): Promise<Pg16Template> {
  return openPg16Template(url, name, undefined)
}

function handleFor(pool: pg.Pool, drop: () => Promise<void>): unknown {
  let closed = false
  // PGlite is one session: `set role` and friends must stick between calls, so plain query and exec share
  // one connection; each transaction takes another, which is what lets two of them overlap.
  let session: Promise<pg.PoolClient> | undefined
  const sessionClient = (): Promise<pg.PoolClient> => (session ??= pool.connect())
  let turn: Promise<unknown> = Promise.resolve()
  const base = methods({
    // One statement at a time, in order, as PGlite does.
    query: (text, params) => {
      const run = turn.then(async () => (await sessionClient()).query(text, params))
      turn = run.catch(() => undefined)
      return run
    },
  })
  return {
    ...base,
    get closed(): boolean {
      return closed
    },
    transaction: async <T>(work: (tx: Transaction) => Promise<T>): Promise<T> => {
      const client = await pool.connect()
      const state = { done: false }
      try {
        await client.query('begin')
        const tx = {
          ...methods(client),
          rollback: async (): Promise<void> => {
            if (!state.done) {
              done = true
              await client.query('rollback')
            }
          },
        }
        const out = await work(tx as unknown as Transaction)
        if (!state.done) {
          done = true
          await client.query('commit')
        }
        return out
      } catch (e) {
        if (!state.done) {
          done = true
          await client.query('rollback').catch(() => undefined)
        }
        throw e
      } finally {
        client.release()
      }
    },
    close: async (): Promise<void> => {
      if (!closed) {
        closed = true
        if (session !== undefined) (await session).release()
        await pool.end()
        await drop()
      }
    },
  }
}
