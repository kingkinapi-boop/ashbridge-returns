// @mutate
// Stryker disable all: database glue (catalog SQL and the one-transaction apply); Stryker runs unit tests only (vitest.mutate.config.ts), and the db project covers every line on PGlite and TEST_DB=pg16 (reach.acceptance.db.test.ts S3, S4, G1; draft.acceptance.db.test.ts). The verdicts it feeds (reachDiff, neverReadFindings, missingColumns) live in scan.ts, which scores 100.
// GL3 (ARC-2, U9): the database side of the bridge draft: apply it to a database (tests and the go-live run), read the
// view dependencies from the catalog, and probe the client app's schema. The probe issues only selects on the catalog.
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { DRAFT_DIR, readViewsManifest } from './manifest'
import { draftReads, missingColumns, neverReadFindings, type ColumnRef, type ViewDependency } from './scan'

export const DRAFT_SQL_FILES = ['0001_bridge_views.sql', '0002_grants.sql'] as const

type Queryable = Pick<PGlite, 'query'>

/** Applies 0001 then 0002 as one transaction (the client app's tables and the roles are the caller's): a failure leaves nothing. */
export async function applyDraft(db: PGlite): Promise<void> {
  const files = DRAFT_SQL_FILES.map((f) => fs.readFileSync(path.join(DRAFT_DIR, f), 'utf8'))
  await db.transaction(async (tx) => {
    for (const sql of files) await tx.exec(sql)
  })
}

/** Every column (or whole table) each view in schema bridge depends on, from the catalog. */
export async function viewDependencies(db: Queryable): Promise<ViewDependency[]> {
  const r = await db.query<ViewDependency>(
    `select distinct v.relname as view, t.relname as "table", a.attname as "column"
     from pg_catalog.pg_rewrite r
     join pg_catalog.pg_class v on v.oid = r.ev_class
     join pg_catalog.pg_namespace vn on vn.oid = v.relnamespace and vn.nspname = 'bridge'
     join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_rewrite'::regclass and d.objid = r.oid
       and d.refclassid = 'pg_catalog.pg_class'::regclass
     join pg_catalog.pg_class t on t.oid = d.refobjid and t.oid <> v.oid
     join pg_catalog.pg_namespace tn on tn.oid = t.relnamespace and tn.nspname not in ('bridge', 'pg_catalog', 'information_schema')
     left join pg_catalog.pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid and d.refobjsubid > 0
     order by 1, 2, 3`,
  )
  return r.rows
}

export async function findNeverRead(db: Queryable): Promise<ViewDependency[]> {
  return neverReadFindings(await viewDependencies(db))
}

/** U9: lists every table and column the drafts read and names each one the database lacks. */
export async function probeClientSchema(db: Queryable): Promise<{ reads: ColumnRef[]; missing: ColumnRef[]; clean: boolean }> {
  const reads = draftReads(readViewsManifest())
  const present = await db.query<ColumnRef>(
    `select table_name as "table", column_name as "column" from information_schema.columns where table_schema = 'public'`,
  )
  const missing = missingColumns(reads, present.rows)
  return { reads, missing, clean: missing.length === 0 }
}

// What the reach rule leaves out: the system schemas, toast and temp schemas.
const SYSTEM_SCHEMA = `n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_toast%' and n.nspname not like 'pg\\_temp\\_%'`

/**
 * LIVE-6, ARC-2: every right a role holds in this database, as plain-text keys (usage and create on schemas; the seven table
 * rights; column rights held without the table one; sequence rights; execute on functions, marked security definer; role
 * memberships), each once, in plain string order. PUBLIC's rights count, as they are every role's. Catalog selects only.
 */
export async function probeReach(db: Queryable, role: string): Promise<string[]> {
  const q = async (sql: string): Promise<string[]> => (await db.query<{ k: string }>(sql, [role])).rows.map((r) => r.k)
  const keys = [
    ...(await q(
      `select p.priv || ' on schema ' || n.nspname as k from pg_catalog.pg_namespace n cross join (values ('usage'), ('create')) p (priv)
       where ${SYSTEM_SCHEMA} and pg_catalog.has_schema_privilege($1::name, n.oid, p.priv)`,
    )),
    ...(await q(
      `select p.priv || ' on ' || n.nspname || '.' || c.relname as k
       from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p (priv)
       where ${SYSTEM_SCHEMA} and c.relkind in ('r', 'p', 'v', 'm', 'f') and pg_catalog.has_table_privilege($1::name, c.oid, p.priv)`,
    )),
    ...(await q(
      `select p.priv || ' (' || a.attname || ') on ' || n.nspname || '.' || c.relname as k
       from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
       cross join (values ('select'), ('insert'), ('update'), ('references')) p (priv)
       where ${SYSTEM_SCHEMA} and c.relkind in ('r', 'p', 'v', 'm', 'f')
         and pg_catalog.has_column_privilege($1::name, c.oid, a.attname::text, p.priv) and not pg_catalog.has_table_privilege($1::name, c.oid, p.priv)`,
    )),
    ...(await q(
      `select p.priv || ' on ' || n.nspname || '.' || c.relname as k
       from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       cross join (values ('usage'), ('select'), ('update')) p (priv)
       where ${SYSTEM_SCHEMA} and c.relkind = 'S' and pg_catalog.has_sequence_privilege($1::name, c.oid, p.priv)`,
    )),
    ...(await q(
      `select 'execute on ' || n.nspname || '.' || f.proname || '(' || pg_catalog.pg_get_function_identity_arguments(f.oid) || ')'
              || case when f.prosecdef then ' security definer' else '' end as k
       from pg_catalog.pg_proc f join pg_catalog.pg_namespace n on n.oid = f.pronamespace
       where ${SYSTEM_SCHEMA} and pg_catalog.has_function_privilege($1::name, f.oid, 'execute')`,
    )),
    ...(await q(
      `select 'member of ' || r.rolname as k from pg_catalog.pg_roles r
       where r.rolname <> $1::name and pg_catalog.pg_has_role($1::name, r.oid, 'MEMBER')`,
    )),
  ]
  return [...new Set(keys)].sort()
}
