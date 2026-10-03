// GL3 acceptance tests, the database side (spec-writer; builders never edit this file). Card plan/cards/GL3.md.
// Each test clones the build's returns schema, applies the made-up client-app stand-in
// (db/bridge/__fixtures__/client-app-standin.sql: the base tables, the roles returns_app, client_app_reader,
// anon and authenticated, and a planted default privilege that hands every new object to the public-key
// roles), then applies the draft with applyDraft(db). The exports and file shapes are listed at the top of
// draft.acceptance.test.ts (the unit side, which holds the twins of every behaviour proven here).
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { BRIDGE_SHAPES, BridgeHandoffRowSchema } from '../../../contracts/bridge'
import { cloneTestDb } from '../../../core/db'
import { applyDraft, draftReads, findNeverRead, probeClientSchema, readViewsManifest, viewDependencies } from './index'
import { DRAFT_DIR, manifest, viewReads } from './__fixtures__/views-manifest'

const STANDIN_SQL = fs.readFileSync(path.join(DRAFT_DIR, '__fixtures__', 'client-app-standin.sql'), 'utf8')
const C1 = '00000000-0000-4000-8000-000000000101'
const C2 = '00000000-0000-4000-8000-000000000102'
const HANDOFF_KEYS = Object.keys(BridgeHandoffRowSchema.shape)
const VISIBLE_STATUSES = ['sent', 'withdrawn', 'closed']

async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

async function standIn(): Promise<PGlite> {
  const db = await cloneTestDb()
  await db.exec(STANDIN_SQL)
  return db
}

async function drafted(): Promise<PGlite> {
  const db = await standIn()
  await applyDraft(db)
  return db
}

async function asRole<T>(db: PGlite, role: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}

/** The error message of a statement, or null when it runs. */
async function refusal(db: PGlite, sql: string): Promise<string | null> {
  try {
    await db.query(sql)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

async function relations(db: PGlite, schema: string): Promise<{ oid: number; name: string; kind: string }[]> {
  return rows(
    db,
    `select c.oid::int as oid, c.relname as name, c.relkind::text as kind from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1 and c.relkind in ('r', 'p', 'v', 'm', 'f') order by c.relname`,
    [schema],
  )
}

async function viewColumns(db: PGlite, view: string): Promise<string[]> {
  const r = await rows<{ attname: string }>(
    db,
    `select a.attname from pg_attribute a where a.attrelid = ($1::text)::regclass and a.attnum > 0 and not a.attisdropped order by a.attnum`,
    [`bridge.${view}`],
  )
  return r.map((x) => x.attname)
}

/** The spec's own catalog read of what each bridge view depends on in the client app's schema (public). */
async function catalogDeps(db: PGlite): Promise<{ view: string; table: string; column: string | null }[]> {
  return rows(
    db,
    `select distinct v.relname as view, t.relname as table, a.attname as column
     from pg_rewrite r
     join pg_class v on v.oid = r.ev_class
     join pg_namespace vn on vn.oid = v.relnamespace and vn.nspname = 'bridge'
     join pg_depend d on d.classid = 'pg_rewrite'::regclass and d.objid = r.oid and d.refclassid = 'pg_class'::regclass
     join pg_class t on t.oid = d.refobjid and t.oid <> v.oid
     join pg_namespace tn on tn.oid = t.relnamespace and tn.nspname = 'public'
     left join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid and d.refobjsubid > 0`,
  )
}

/** Read-only rule (ARC-2): returns_app selects every bridge view, writes none, and reads no base table. */
async function readOnlyProblems(db: PGlite): Promise<string[]> {
  const out: string[] = []
  for (const v of await relations(db, 'bridge')) {
    const p = (await rows<Record<string, boolean>>(
      db,
      `select has_table_privilege('returns_app', $1::int::oid, 'select') as sel,
              has_any_column_privilege('returns_app', $1::int::oid, 'insert') or has_table_privilege('returns_app', $1::int::oid, 'insert') as ins,
              has_any_column_privilege('returns_app', $1::int::oid, 'update') or has_table_privilege('returns_app', $1::int::oid, 'update') as upd,
              has_table_privilege('returns_app', $1::int::oid, 'delete') as del,
              has_table_privilege('returns_app', $1::int::oid, 'truncate') as tru`,
      [v.oid],
    ))[0]
    if (p?.['sel'] !== true) out.push(`returns_app cannot select bridge.${v.name}`)
    for (const [k, word] of [['ins', 'insert'], ['upd', 'update'], ['del', 'delete'], ['tru', 'truncate']] as const) {
      if (p?.[k] !== false) out.push(`returns_app can ${word} bridge.${v.name}`)
    }
  }
  for (const t of await relations(db, 'public')) {
    const r = (await rows<{ sel: boolean }>(db, `select has_any_column_privilege('returns_app', $1::int::oid, 'select') as sel`, [t.oid]))[0]
    if (r?.sel !== false) out.push(`returns_app can select public.${t.name}`)
  }
  return out
}

/** SEC-6: the public-key roles and PUBLIC have no usage on schema bridge and read or run nothing in it. */
async function publicKeyProblems(db: PGlite): Promise<string[]> {
  const out: string[] = []
  for (const role of ['anon', 'authenticated']) {
    const u = (await rows<{ u: boolean }>(db, `select has_schema_privilege($1::name, 'bridge'::text, 'usage') as u`, [role]))[0]
    if (u?.u !== false) out.push(`${role} has usage on schema bridge`)
    for (const v of await relations(db, 'bridge')) {
      const s = (await rows<{ s: boolean }>(db, `select has_any_column_privilege($1::name, $2::int::oid, 'select') as s`, [role, v.oid]))[0]
      if (s?.s !== false) out.push(`${role} can select bridge.${v.name}`)
    }
  }
  const ns = await rows(
    db,
    `select 1 from pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
     where n.nspname = 'bridge' and a.grantee = 0 and a.privilege_type = 'USAGE'`,
  )
  if (ns.length > 0) out.push('PUBLIC has usage on schema bridge')
  const rels = await rows<{ name: string }>(
    db,
    `select distinct c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace,
       aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     where n.nspname = 'bridge' and a.grantee = 0 order by 1`,
  )
  for (const r of rels) out.push(`PUBLIC can select bridge.${r.name}`)
  const fns = await rows<{ name: string; anon: boolean; auth: boolean; pub: boolean }>(
    db,
    `select p.proname as name, has_function_privilege('anon', p.oid, 'execute') as anon,
            has_function_privilege('authenticated', p.oid, 'execute') as auth,
            exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0) as pub
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'bridge'`,
  )
  for (const f of fns) {
    if (f.anon) out.push(`anon can execute bridge.${f.name}`)
    if (f.auth) out.push(`authenticated can execute bridge.${f.name}`)
    if (f.pub) out.push(`PUBLIC can execute bridge.${f.name}`)
  }
  return out
}

/** Shared table (ARC-2, END-7): client_app_reader reads the keys of BridgeHandoffRowSchema on client_handoff only. */
async function sharedTableProblems(db: PGlite): Promise<string[]> {
  const out: string[] = []
  const R = 'client_app_reader'
  const role = (await rows<{ bypass: boolean }>(db, `select rolbypassrls as bypass from pg_roles where rolname = $1`, [R]))[0]
  if (role?.bypass !== false) out.push('client_app_reader bypasses row-level security')
  const rls = (await rows<{ rls: boolean }>(db, `select relrowsecurity as rls from pg_class where oid = 'returns.client_handoff'::regclass`))[0]
  if (rls?.rls !== true) out.push('row-level security is off on client_handoff')
  const usage = (await rows<{ u: boolean }>(db, `select has_schema_privilege($1::name, 'returns'::text, 'usage') as u`, [R]))[0]
  if (usage?.u !== true) out.push('client_app_reader has no usage on schema returns')

  const cols = await rows<{ name: string; type: string; checked: boolean }>(
    db,
    `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
            exists (select 1 from pg_constraint k where k.conrelid = a.attrelid and k.contype = 'c' and a.attnum = any (k.conkey)) as checked
     from pg_attribute a where a.attrelid = 'returns.client_handoff'::regclass and a.attnum > 0 and not a.attisdropped order by a.attnum`,
  )
  for (const c of cols) {
    const can = (await rows<{ s: boolean }>(db, `select has_column_privilege($1::name, 'returns.client_handoff'::text, $2::text, 'select') as s`, [R, c.name]))[0]?.s === true
    if (can && !HANDOFF_KEYS.includes(c.name)) out.push(`client_app_reader reads ${c.name}`)
    if (!can && HANDOFF_KEYS.includes(c.name)) out.push(`client_app_reader cannot read ${c.name}`)
    if (can && /^(text|character|json|.*\[\])/.test(c.type) && !c.checked) out.push(`client_app_reader reads free text ${c.name}`)
  }
  const w = (await rows<Record<string, boolean>>(
    db,
    `select has_any_column_privilege($1::name, 'returns.client_handoff'::text, 'insert') or has_table_privilege($1::name, 'returns.client_handoff'::text, 'insert') as insert,
            has_any_column_privilege($1::name, 'returns.client_handoff'::text, 'update') or has_table_privilege($1::name, 'returns.client_handoff'::text, 'update') as update,
            has_table_privilege($1::name, 'returns.client_handoff'::text, 'delete') as delete,
            has_table_privilege($1::name, 'returns.client_handoff'::text, 'truncate') as truncate`,
    [R],
  ))[0]
  for (const p of ['insert', 'update', 'delete', 'truncate']) if (w?.[p] !== false) out.push(`client_app_reader can ${p} client_handoff`)

  for (const t of await relations(db, 'returns')) {
    if (t.name === 'client_handoff') continue
    const p = (await rows<Record<string, boolean>>(
      db,
      `select has_any_column_privilege($1::name, $2::int::oid, 'select') as select,
              has_any_column_privilege($1::name, $2::int::oid, 'insert') as insert,
              has_any_column_privilege($1::name, $2::int::oid, 'update') as update,
              has_table_privilege($1::name, $2::int::oid, 'delete') as delete,
              has_table_privilege($1::name, $2::int::oid, 'truncate') as truncate`,
      [R, t.oid],
    ))[0]
    for (const k of ['select', 'insert', 'update', 'delete', 'truncate']) if (p?.[k] !== false) out.push(`client_app_reader can ${k} returns.${t.name}`)
  }
  const seqs = await rows<{ name: string; any: boolean }>(
    db,
    `select c.relname as name, has_sequence_privilege($1::name, c.oid, 'usage') or has_sequence_privilege($1::name, c.oid, 'select') or has_sequence_privilege($1::name, c.oid, 'update') as any
     from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'returns' and c.relkind = 'S'`,
    [R],
  )
  for (const s of seqs) if (s.any) out.push(`client_app_reader can use returns.${s.name}`)
  const fns = await rows<{ name: string; x: boolean }>(
    db,
    `select p.proname as name, has_function_privilege($1::name, p.oid, 'execute') as x
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'returns'`,
    [R],
  )
  for (const f of fns) if (f.x) out.push(`client_app_reader can execute returns.${f.name}`)

  const seen = await visibleStatuses(db)
  if (seen.includes('draft')) out.push('client_app_reader reads draft rows')
  for (const s of VISIBLE_STATUSES) if (!seen.includes(s)) out.push(`client_app_reader cannot read ${s} rows`)
  return out
}

/** Four made-up question rows of one list, one per status (written as the superuser, who owns the table). */
async function seedHandoff(db: PGlite): Promise<void> {
  const statuses = ['draft', 'sent', 'withdrawn', 'closed']
  for (const [i, status] of statuses.entries()) {
    await db.query(
      `insert into returns.client_handoff (corporation_id, engagement_id, tax_year, list_kind, list_version, position, status, sent_at,
         item_id, primitive, fact_id, answer_shape)
       values ($1, '00000000-0000-4000-8000-000000009001', 2025, 'questions', 1, $2, $3, $4, 'BQ1.bn', 'ask', 'FL:102', 'free_text')`,
      [C1, i + 1, status, status === 'draft' ? null : '2026-02-10T10:00:00-05:00'],
    )
  }
}

/** The statuses client_app_reader sees, reading only the columns it is granted. */
async function visibleStatuses(db: PGlite): Promise<string[]> {
  return asRole(db, 'client_app_reader', async () =>
    (await rows<{ status: string }>(db, `select status from returns.client_handoff order by position`)).map((r) => r.status),
  )
}

describe('GL3 the views (ARC-2)', () => {
  test('ARC-2 every view in views.json exists in schema bridge as a view, and schema bridge holds no other relation', async () => {
    const db = await drafted()
    const rels = await relations(db, 'bridge')
    expect(rels.map((r) => r.name)).toEqual(manifest().views.map((v) => v.name).sort())
    for (const r of rels) expect(r.kind, `bridge.${r.name}`).toBe('v')
  })

  test("ARC-2 each view's columns equal views.json's list exactly, in order, and every view has is_test", async () => {
    const db = await drafted()
    for (const v of manifest().views) {
      const cols = await viewColumns(db, v.name)
      expect(cols, `bridge.${v.name}`).toEqual(v.columns.map((c) => c.name))
      expect(cols, `bridge.${v.name}`).toContain('is_test')
    }
  })

  test('ARC-2 every client-app column a view depends on (catalog) is listed for that view in views.json, and views.json lists nothing no view reads', async () => {
    const db = await drafted()
    const deps = await catalogDeps(db)
    expect(deps).toContainEqual({ view: 'corporation', table: 'corporations', column: 'legal_name' })
    const m = manifest()
    const problems: string[] = []
    for (const d of deps) {
      if (d.column === null) continue
      const view = m.views.find((v) => v.name === d.view)
      const listed = view !== undefined && viewReads(view).some((r) => r.table === d.table && r.column === d.column)
      if (!listed) problems.push(`bridge.${d.view} reads ${d.table}.${d.column}, not in views.json`)
    }
    for (const r of draftReads(readViewsManifest())) {
      if (!deps.some((d) => d.table === r.table && d.column === r.column)) problems.push(`views.json lists ${r.table}.${r.column}, read by no view`)
    }
    expect(problems).toEqual([])
  })

  test('ARC-2 the stand-in rows: bridge.corporation holds the two company corporations, by corporation id, made-up', async () => {
    const db = await drafted()
    const r = await rows<{ id: string; is_test: boolean }>(db, 'select id::text as id, is_test from bridge.corporation order by id')
    expect(r).toEqual([
      { id: C1, is_test: true },
      { id: C2, is_test: true },
    ])
  })

  test("ARC-2 rows of bridge.corporation and bridge.t2_return parse with F07's strict schemas once the derived fields are added", async () => {
    const db = await drafted()
    const m = manifest()
    const corpView = m.views.find((v) => v.name === 'corporation')
    const corps = (await rows<{ r: Record<string, unknown> }>(db, 'select row_to_json(v) as r from bridge.corporation v')).map((x) => x.r)
    const engs = (await rows<{ r: Record<string, unknown> }>(db, 'select row_to_json(v) as r from bridge.t2_return v')).map((x) => x.r)
    expect(corps.length).toBe(2)

    // the test helper standing in for the live reader's derivations (go-live): values for the made-up rows
    const derivedValue = (field: string, corp: Record<string, unknown>): unknown => {
      if (field === 'services') {
        const s = engs.filter((e) => e['corporation_id'] === corp['id']).map((e) => String(e['service']))
        return s.length === 0 ? null : [...new Set(s)].sort()
      }
      if (field === 'financial_year_end_confirmed') return false
      if (field === 'associated_corporation_ids') return []
      throw new Error(`no test value for derived field ${field}`)
    }
    const pick = (row: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
      Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]))

    const corpKeys = Object.keys(BRIDGE_SHAPES.corporation.shape)
    for (const c of corps) {
      const withDerived = { ...c, ...Object.fromEntries((corpView?.derived ?? []).map((d) => [d.field, derivedValue(d.field, c)])) }
      const parsed = BRIDGE_SHAPES.corporation.safeParse(pick(withDerived, corpKeys))
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
    }
    const c1 = BRIDGE_SHAPES.corporation.parse(pick({ ...corps.find((c) => c['id'] === C1), services: ['bookkeeping', 't2'], financial_year_end_confirmed: false, associated_corporation_ids: [] }, corpKeys))
    expect(c1).toMatchObject({ legal_name: 'Maple Ridge Carpentry Ltd. (Test)', business_number: '100000001', financial_year_end: '2025-12-31', incorporation_date: '2019-04-01', all_prior_years_filed: 'yes' })

    const engKeys = Object.keys(BRIDGE_SHAPES.t2_return.shape)
    const companyEngs = engs.filter((e) => e['corporation_id'] === C1 || e['corporation_id'] === C2)
    expect(companyEngs.map((e) => e['id']).sort()).toEqual([
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009002',
      '00000000-0000-4000-8000-000000009003',
    ])
    for (const e of companyEngs) {
      const parsed = BRIDGE_SHAPES.t2_return.safeParse(pick(e, engKeys))
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
    }
  })
})

describe('GL3 never read (ARC-2, contract section 3)', () => {
  test('ARC-2 the catalog scan finds no bridge view that uses restricted_data or a never-read column', async () => {
    const db = await drafted()
    const deps = await viewDependencies(db)
    expect(deps).toContainEqual({ view: 'corporation', table: 'corporations', column: 'legal_name' })
    expect(await findNeverRead(db)).toEqual([])
  })

  test('ARC-2 viewDependencies reads every bridge view from the catalog, the same column dependencies the spec reads', async () => {
    const db = await drafted()
    const key = (d: { view: string; table: string; column: string | null }): string => `${d.view}|${d.table}|${String(d.column)}`
    const mine = new Set((await catalogDeps(db)).filter((d) => d.column !== null).map(key))
    const theirs = new Set((await viewDependencies(db)).filter((d) => d.column !== null).map(key))
    expect([...theirs].filter((k) => !mine.has(k))).toEqual([])
    expect([...mine].filter((k) => !theirs.has(k))).toEqual([])
  })

  test('ARC-2 rule: planted views that join restricted_data, select people.email, filter on links.token_hash or test restricted_data exists each fail naming the view and the column', async () => {
    const db = await drafted()
    await db.exec(`
      create view bridge.planted_join as select c.id, c.is_test from public.corporations c join public.restricted_data r on r.corporation_id = c.id;
      create view bridge.planted_email as select p.id, p.email, p.is_test from public.people p;
      create view bridge.planted_token as select l.id from public.links l where l.token_hash is not null;
      create view bridge.planted_exists as select c.id from public.corporations c where exists (select from public.restricted_data);
    `)
    const found = await findNeverRead(db)
    expect(found).toContainEqual({ view: 'planted_join', table: 'restricted_data', column: 'corporation_id' })
    expect(found).toContainEqual({ view: 'planted_email', table: 'people', column: 'email' })
    expect(found).toContainEqual({ view: 'planted_token', table: 'links', column: 'token_hash' })
    expect(found.some((f) => f.view === 'planted_exists' && f.table === 'restricted_data')).toBe(true)
    expect(found.filter((f) => !f.view.startsWith('planted_'))).toEqual([])
  })
})

describe('GL3 read-only (ARC-2)', () => {
  test('ARC-2 returns_app selects every bridge view', async () => {
    const db = await drafted()
    const counts = await asRole(db, 'returns_app', async () => {
      const out: Record<string, number> = {}
      for (const v of manifest().views) out[v.name] = (await rows<{ n: number }>(db, `select count(*)::int as n from bridge.${v.name}`))[0]?.n ?? -1
      return out
    })
    for (const v of manifest().views) expect(counts[v.name], `bridge.${v.name}`).toBeGreaterThanOrEqual(0)
    expect(counts['corporation']).toBe(2)
  })

  test('ARC-2 insert, update and delete through each bridge view are refused for returns_app', async () => {
    const db = await drafted()
    for (const v of manifest().views) {
      const results = await asRole(db, 'returns_app', async () => [
        await refusal(db, `insert into bridge.${v.name} default values`),
        await refusal(db, `update bridge.${v.name} set is_test = is_test`),
        await refusal(db, `delete from bridge.${v.name}`),
      ])
      for (const r of results) expect(r, `bridge.${v.name}`).not.toBeNull()
    }
    expect((await rows<{ n: number }>(db, 'select count(*)::int as n from public.corporations'))[0]?.n).toBe(2)
  })

  test('ARC-2 selecting any client-app base table directly is refused for returns_app, for each table in the stand-in', async () => {
    const db = await drafted()
    const tables = await relations(db, 'public')
    expect(tables.map((t) => t.name)).toContain('corporations')
    expect(tables.map((t) => t.name)).toContain('restricted_data')
    expect(tables.length).toBeGreaterThan(20)
    for (const t of tables) {
      const r = await asRole(db, 'returns_app', () => refusal(db, `select 1 from public.${t.name} limit 1`))
      expect(r, `public.${t.name}`).toMatch(/permission denied/i)
    }
  })

  test('ARC-2 the catalog agrees: returns_app holds select on every view, no write on any, nothing on a base table', async () => {
    const db = await drafted()
    expect(await readOnlyProblems(db)).toEqual([])
  })

  test('ARC-2 rule: a planted write grant on a view and a planted base-table grant are caught by name', async () => {
    const db = await drafted()
    await db.exec(`grant update on bridge.corporation to returns_app; grant select on public.people to returns_app;`)
    const p = await readOnlyProblems(db)
    expect(p).toContain('returns_app can update bridge.corporation')
    expect(p).toContain('returns_app can select public.people')
  })
})

describe('GL3 the public key reads nothing in bridge (SEC-6)', () => {
  test('SEC-6 with the planted default privilege, anon, authenticated and PUBLIC have no usage on bridge and read nothing in it', async () => {
    const db = await drafted()
    const planted = await rows(db, `select 1 from pg_default_acl`)
    expect(planted.length).toBeGreaterThan(0)
    expect(await publicKeyProblems(db)).toEqual([])
  })

  test('SEC-6 selecting any bridge view as anon, as authenticated, or as a role with only PUBLIC rights is refused', async () => {
    const db = await drafted()
    await db.exec(`do $$ begin create role gl3_nobody nologin; exception when duplicate_object or unique_violation then null; end $$;`)
    for (const role of ['anon', 'authenticated', 'gl3_nobody']) {
      for (const v of manifest().views) {
        const r = await asRole(db, role, () => refusal(db, `select * from bridge.${v.name} limit 1`))
        expect(r, `${role} on bridge.${v.name}`).toMatch(/permission denied/i)
      }
    }
  })

  test('SEC-6 rule: planted usage and select grants to anon and to PUBLIC are caught by name', async () => {
    const db = await drafted()
    await db.exec(`grant usage on schema bridge to anon; grant select on bridge.corporation to anon;
                   grant usage on schema bridge to public; grant select on bridge.flag to public;`)
    const p = await publicKeyProblems(db)
    expect(p).toContain('anon has usage on schema bridge')
    expect(p).toContain('anon can select bridge.corporation')
    expect(p).toContain('PUBLIC has usage on schema bridge')
    expect(p).toContain('PUBLIC can select bridge.flag')
  })
})

describe('GL3 the shared table (ARC-2, END-7)', () => {
  test('ARC-2 client_app_reader reads exactly the keys of BridgeHandoffRowSchema on client_handoff, only sent, withdrawn and closed rows, and nothing else in returns', async () => {
    const db = await drafted()
    await seedHandoff(db)
    expect(await sharedTableProblems(db)).toEqual([])
  })

  test('ARC-2 a planted draft row is never returned; the other statuses are, in position order', async () => {
    const db = await drafted()
    await seedHandoff(db)
    expect((await rows<{ n: number }>(db, 'select count(*)::int as n from returns.client_handoff'))[0]?.n).toBe(4)
    expect(await visibleStatuses(db)).toEqual(VISIBLE_STATUSES)
  })

  test('ARC-2 client_app_reader selects the granted columns; select *, created_at, insert, update, delete and any other returns table are refused', async () => {
    const db = await drafted()
    await seedHandoff(db)
    const cols = HANDOFF_KEYS.join(', ')
    const got = await asRole(db, 'client_app_reader', async () => rows(db, `select ${cols} from returns.client_handoff order by position`))
    expect(got.length).toBe(3)
    const refusals = await asRole(db, 'client_app_reader', async () => [
      await refusal(db, 'select * from returns.client_handoff'),
      await refusal(db, 'select created_at from returns.client_handoff'),
      await refusal(db, `insert into returns.client_handoff (corporation_id, engagement_id, tax_year, list_kind, list_version, position, item_id, primitive, fact_id, answer_shape)
                         values ('${C1}', '00000000-0000-4000-8000-000000009001', 2025, 'questions', 1, 9, 'BQ1.bn', 'ask', 'FL:102', 'free_text')`),
      await refusal(db, `update returns.client_handoff set status = 'closed'`),
      await refusal(db, 'delete from returns.client_handoff'),
      await refusal(db, 'select 1 from returns.client_refs'),
      await refusal(db, 'select 1 from returns.bridge_ops_items'),
    ])
    for (const r of refusals) expect(r).toMatch(/permission denied/i)
  })

  test('ARC-2 rule: a planted policy that shows drafts, a planted extra column, a planted write grant and a planted grant on another table are each caught', async () => {
    const db = await drafted()
    await seedHandoff(db)
    await db.exec(`
      create policy gl3_planted on returns.client_handoff for select to client_app_reader using (true);
      grant select (created_at) on returns.client_handoff to client_app_reader;
      grant insert on returns.client_handoff to client_app_reader;
      grant select on returns.client_refs to client_app_reader;
      alter table returns.client_handoff add column gl3_note text;
      grant select (gl3_note) on returns.client_handoff to client_app_reader;
    `)
    const p = await sharedTableProblems(db)
    expect(p).toContain('client_app_reader reads draft rows')
    expect(p).toContain('client_app_reader reads created_at')
    expect(p).toContain('client_app_reader can insert client_handoff')
    expect(p).toContain('client_app_reader can select returns.client_refs')
    expect(p).toContain('client_app_reader reads free text gl3_note')
  })

  test('ARC-2 rule: a reader that bypasses row-level security is caught', async () => {
    const db = await drafted()
    await seedHandoff(db)
    await db.exec('alter role client_app_reader bypassrls')
    try {
      const p = await sharedTableProblems(db)
      expect(p).toContain('client_app_reader bypasses row-level security')
    } finally {
      await db.exec('alter role client_app_reader nobypassrls')
    }
  })
})

describe('GL3 the probe (U9)', () => {
  test('ARC-2 on the full stand-in the probe lists every table and column the drafts read and is clean', async () => {
    const db = await standIn()
    const r = await probeClientSchema(db)
    expect(r.reads).toEqual(draftReads(readViewsManifest()))
    expect(r.reads).toContainEqual({ table: 'corporations', column: 'financial_year_end' })
    expect(r.missing).toEqual([])
    expect(r.clean).toBe(true)
  })

  test('ARC-2 with corporations.financial_year_end dropped the probe names that column, and only it', async () => {
    const db = await standIn()
    await db.exec('alter table public.corporations drop column financial_year_end')
    const r = await probeClientSchema(db)
    expect(r.missing).toEqual([{ table: 'corporations', column: 'financial_year_end' }])
    expect(r.clean).toBe(false)
  })

  test('ARC-2 with a whole table missing the probe names every column the drafts read from it', async () => {
    const db = await standIn()
    await db.exec('drop table public.flags')
    const r = await probeClientSchema(db)
    const expected = draftReads(readViewsManifest()).filter((c) => c.table === 'flags')
    expect(expected.length).toBeGreaterThan(0)
    expect(r.missing).toEqual(expected)
    expect(r.clean).toBe(false)
  })

  test('ARC-2 the probe issues only single select statements on the catalog (every statement recorded)', async () => {
    const db = await standIn()
    const calls: { method: string; sql: string }[] = []
    const RECORDED = new Set(['query', 'exec', 'sql', 'transaction', 'execProtocol', 'execProtocolRaw', 'listen', 'dumpDataDir'])
    const recorder = new Proxy(db, {
      get(target, prop) {
        const v: unknown = Reflect.get(target, prop)
        if (typeof v !== 'function') return v
        const fn = v as (...a: unknown[]) => unknown
        if (!RECORDED.has(String(prop))) return fn.bind(target)
        return (...args: unknown[]) => {
          const first = args[0]
          calls.push({ method: String(prop), sql: Array.isArray(first) ? first.join('?') : typeof first === 'string' ? first : '<not text>' })
          return fn.apply(target, args)
        }
      },
    })
    const r = await probeClientSchema(recorder)
    expect(r.clean).toBe(true)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) {
      expect(c.method, c.sql).toBe('query')
      expect(c.sql, c.sql).toMatch(/^\s*select\b/i)
      expect(c.sql, c.sql).toMatch(/\binformation_schema\.|\bpg_catalog\.|\bpg_[a-z_]+\b/i)
      expect(c.sql.replace(/;\s*$/, ''), c.sql).not.toContain(';')
      expect(c.sql, c.sql).not.toMatch(/\b(public|bridge|returns)\.[a-z]/i)
    }
  })
})
