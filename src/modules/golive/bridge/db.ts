// GL3 (ARC-2, U9): the database side of the bridge draft: apply it to a database (tests and the go-live run), read the
// view dependencies from the catalog, and probe the client app's schema. The probe issues only selects on the catalog.
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { DRAFT_DIR, readViewsManifest } from './manifest'
import { draftReads, missingColumns, neverReadFindings, type ColumnRef, type ViewDependency } from './scan'

export const DRAFT_SQL_FILES = ['0001_bridge_views.sql', '0002_grants.sql'] as const

type Queryable = Pick<PGlite, 'query'>

/** Applies 0001 then 0002 (the client app's tables and the roles are the caller's). */
export async function applyDraft(db: PGlite): Promise<void> {
  for (const f of DRAFT_SQL_FILES) await db.exec(fs.readFileSync(path.join(DRAFT_DIR, f), 'utf8'))
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
