// GL3 round 4 acceptance tests, the database side (spec-writer; builders never edit this file). Card
// plan/cards/GL3.md, Lead directive A498 (S2 to S5). Each test clones the build's returns schema and applies the
// made-up client-app stand-in (db/bridge/__fixtures__/client-app-standin.sql, which since S1 holds a canary in
// every never-read column, one restricted_data row per kind and the marker answers), then the draft.
// The shapes these tests fix are listed at the top of reach.acceptance.test.ts (the unit side, which holds the
// twin of probeReach's pure part).
//
// Reach (S3): a role's reach is every right it holds in this database, from the catalog, as plain-text keys:
//   "<usage|create> on schema <schema>"
//   "<select|insert|update|delete|truncate|references|trigger> on <schema>.<relation>"   (tables, views,
//       materialized views, foreign and partitioned tables: the table-level right, by any route)
//   "<select|insert|update|references> (<column>) on <schema>.<relation>"   (a column right the role holds
//       without the table-level one)
//   "<usage|select|update> on <schema>.<sequence>"
//   "execute on <schema>.<function>(<identity arguments>)", with " security definer" appended for a
//       security definer function
//   "member of <role>"   (every other role it is a member of, directly or not)
// over every schema except pg_catalog, information_schema and the toast and temp schemas; PUBLIC's rights count
// (they are every role's). Roles are cluster-wide on Postgres 16, so roles are compared by name, and a planted
// membership is always taken back.
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { BridgeHandoffRowSchema } from '../../../contracts/bridge'
import { cloneTestDb } from '../../../core/db'
import * as bridge from './index'
import { applyDraft } from './index'
import { neverReadItems } from './__fixtures__/contract'
import { DRAFT_DIR, manifest } from './__fixtures__/views-manifest'

const STANDIN_SQL = fs.readFileSync(path.join(DRAFT_DIR, '__fixtures__', 'client-app-standin.sql'), 'utf8')
const VIEWS_SQL = fs.readFileSync(path.join(DRAFT_DIR, '0001_bridge_views.sql'), 'utf8')
const HANDOFF_KEYS = Object.keys(BridgeHandoffRowSchema.shape)
const C1 = '00000000-0000-4000-8000-000000000101'
const NOBODY = 'gl3_nobody'
/** What a view must never show: a canary planted in a never-read column, or a marker answer's raw value. */
const LEAK = /canary|restricted-provided/i
/** PUBLIC's built-in right on schema public, every role's: set aside, never part of an allow-list (A498 S3). */
const ASIDE = ['usage on schema public']

type Queryable = Pick<PGlite, 'query'>
type ProbeReach = (db: Queryable, role: string) => Promise<string[]>

/** The export the card names (B5); a clear failure until the build adds it. */
async function probeReach(db: Queryable, role: string): Promise<string[]> {
  const f = (bridge as unknown as { probeReach?: unknown }).probeReach
  if (typeof f !== 'function') throw new Error('src/modules/golive/bridge/index.ts does not export probeReach(db, role) (GL3 B5)')
  return (f as ProbeReach)(db, role)
}

async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

async function standIn(): Promise<PGlite> {
  const db = await cloneTestDb()
  await db.exec(STANDIN_SQL)
  await db.exec(`do $$ begin create role ${NOBODY} nologin; exception when duplicate_object or unique_violation then null; end $$;`)
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

const SYSTEM_SCHEMA = `n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_toast%' and n.nspname not like 'pg\\_temp\\_%'`

/** The spec's own catalog read of a role's reach (the key forms at the top of this file), sorted in plain string order. */
async function specReach(db: PGlite, role: string): Promise<string[]> {
  const q = async (sql: string): Promise<string[]> => (await rows<{ k: string }>(db, sql, [role])).map((r) => r.k)
  const keys = [
    ...(await q(
      `select p.priv || ' on schema ' || n.nspname as k from pg_namespace n cross join (values ('usage'), ('create')) p (priv)
       where ${SYSTEM_SCHEMA} and has_schema_privilege($1::name, n.oid, p.priv)`,
    )),
    ...(await q(
      `select p.priv || ' on ' || n.nspname || '.' || c.relname as k
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p (priv)
       where ${SYSTEM_SCHEMA} and c.relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege($1::name, c.oid, p.priv)`,
    )),
    ...(await q(
      `select p.priv || ' (' || a.attname || ') on ' || n.nspname || '.' || c.relname as k
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
       cross join (values ('select'), ('insert'), ('update'), ('references')) p (priv)
       where ${SYSTEM_SCHEMA} and c.relkind in ('r', 'p', 'v', 'm', 'f')
         and has_column_privilege($1::name, c.oid, a.attname::text, p.priv) and not has_table_privilege($1::name, c.oid, p.priv)`,
    )),
    ...(await q(
      `select p.priv || ' on ' || n.nspname || '.' || c.relname as k
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       cross join (values ('usage'), ('select'), ('update')) p (priv)
       where ${SYSTEM_SCHEMA} and c.relkind = 'S' and has_sequence_privilege($1::name, c.oid, p.priv)`,
    )),
    ...(await q(
      `select 'execute on ' || n.nspname || '.' || f.proname || '(' || pg_get_function_identity_arguments(f.oid) || ')'
              || case when f.prosecdef then ' security definer' else '' end as k
       from pg_proc f join pg_namespace n on n.oid = f.pronamespace
       where ${SYSTEM_SCHEMA} and has_function_privilege($1::name, f.oid, 'execute')`,
    )),
    ...(await q(
      `select 'member of ' || r.rolname as k from pg_roles r
       where r.rolname <> $1::name and pg_has_role($1::name, r.oid, 'MEMBER')`,
    )),
  ]
  return [...new Set(keys)].sort()
}

/** Every role the reach rule covers: each role in pg_roles but the superusers and the built-in pg_* roles, by name. */
async function subjects(db: PGlite): Promise<string[]> {
  const r = await rows<{ name: string }>(db, `select rolname as name from pg_roles where not rolsuper and rolname !~ '^pg_' order by 1`)
  return r.map((x) => x.name)
}

/** The allow-list (A498 S3), from the contract's shapes: views from views.json, the hand-off columns from BridgeHandoffRowSchema. */
function allowList(role: string): string[] | null {
  if (role === 'returns_app') return ['usage on schema bridge', ...manifest().views.map((v) => `select on bridge.${v.name}`)]
  if (role === 'client_app_reader') return ['usage on schema returns', ...HANDOFF_KEYS.map((k) => `select (${k}) on returns.client_handoff`)]
  return null
}

const IN_DRAFT_SCHEMAS = /\bon (schema )?(bridge|returns)(\.|$)/
const DEFINER = / security definer$/

/** Reach-by-class problems for one role, each naming the role and the right. */
function reachProblems(role: string, reach: string[]): string[] {
  const allowed = allowList(role)
  const seen = reach.filter((k) => !ASIDE.includes(k))
  const out: string[] = []
  for (const k of seen) {
    if (DEFINER.test(k)) out.push(`${role} reaches ${k}`)
    else if (allowed !== null && !allowed.includes(k)) out.push(`${role} reaches ${k}`)
    else if (allowed === null && (IN_DRAFT_SCHEMAS.test(k) || /^member of (returns_app|client_app_reader)$/.test(k))) out.push(`${role} reaches ${k}`)
  }
  for (const k of allowed ?? []) if (!seen.includes(k)) out.push(`${role} lacks ${k}`)
  return out
}

async function allReachProblems(db: PGlite): Promise<{ problems: string[]; roles: string[] }> {
  const roles = await subjects(db)
  const problems: string[] = []
  for (const role of roles) problems.push(...reachProblems(role, await specReach(db, role)))
  return { problems, roles }
}

describe('GL3 round 4: the canary sweep (A498 S2; ARC-2, contract section 3)', () => {
  /** Every bridge view, from the catalog (planted views included). */
  async function bridgeViews(db: PGlite): Promise<string[]> {
    return (await rows<{ name: string }>(db, `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'bridge' and c.relkind = 'v' order by 1`)).map((r) => r.name)
  }

  async function columnsOf(db: PGlite, view: string): Promise<string[]> {
    return (await rows<{ name: string }>(db, `select attname as name from pg_attribute where attrelid = ($1::text)::regclass and attnum > 0 and not attisdropped order by attnum`, [`bridge.${view}`])).map((r) => r.name)
  }

  /**
   * As returns_app: every column of every bridge view, read plainly and through a near-zero-cost pg_temp function
   * in the qual (it records every value it is handed, so a view that lets it run before its own filter shows rows
   * the filter hides). Each problem names the view and the column.
   */
  async function canaryProblems(db: PGlite): Promise<string[]> {
    const views = await bridgeViews(db)
    const out = new Set<string>()
    await asRole(db, 'returns_app', async () => {
      await db.exec(`create temp table if not exists gl3_seen (view text, col text, v text);
        create or replace function pg_temp.gl3_leak(view text, col text, v anyelement) returns boolean language plpgsql cost 0.0000001 as $f$
        begin insert into gl3_seen values (view, col, v::text); return true; end $f$;`)
      for (const view of views) {
        const cols = await columnsOf(db, view)
        for (const r of await rows(db, `select * from bridge.${view}`)) {
          for (const c of cols) {
            const v = r[c]
            if (v !== null && v !== undefined && LEAK.test(typeof v === 'string' ? v : JSON.stringify(v))) out.add(`bridge.${view}.${c} shows a canary`)
          }
        }
        const qual = cols.map((c) => `pg_temp.gl3_leak('${view}', '${c}', "${c}")`).join(' and ')
        await rows(db, `select count(*) from bridge.${view} where ${qual}`)
      }
      for (const s of await rows<{ view: string; col: string; v: string | null }>(db, 'select view, col, v from gl3_seen')) {
        if (s.v !== null && LEAK.test(s.v)) out.add(`bridge.${s.view}.${s.col} leaks a canary under a pg_temp function`)
      }
    })
    return [...out].sort()
  }

  async function barrierProblems(db: PGlite): Promise<string[]> {
    const r = await rows<{ name: string; opts: string[] | null }>(
      db,
      `select c.relname as name, c.reloptions as opts from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'bridge' and c.relkind = 'v' order by 1`,
    )
    return r.filter((x) => !(x.opts ?? []).some((o) => /^security_barrier=(true|on|yes|1)$/i.test(o))).map((x) => `bridge.${x.name} has no security_barrier`)
  }

  /** Fixture check (S1): the stand-in holds every section 3 item the sweep needs, and obeys contract line 73. */
  async function standInHoldsEveryItem(db: PGlite): Promise<void> {
    const items = neverReadItems()
    for (const p of items.pairs) {
      const n = (await rows<{ n: number }>(db, `select count(*)::int as n from public.${p.table} where ${p.column}::text like '%CANARY%'`))[0]?.n
      expect(n, `stand-in canary in ${p.table}.${p.column}`).toBeGreaterThan(0)
    }
    for (const t of items.tables) {
      const kinds = (await rows<{ kind: string }>(db, `select kind from public.${t} where value_encrypted like 'CANARY%' and last_four like 'CANARY%' order by kind`)).map((r) => r.kind)
      expect(kinds, `stand-in ${t} rows`).toEqual([...items.restrictedKinds].sort())
    }
    for (const id of items.markerIds) {
      const r = await rows<{ asked: string; v: string | null; status: string }>(
        db,
        `select question_asked as asked, answer_verbatim as v, status from public.answers where split_part(question_asked, ':', 1) = $1`,
        [id],
      )
      expect(r.some((x) => x.asked === id), `${id} bare`).toBe(true)
      expect(r.some((x) => x.asked.startsWith(`${id}: `) && !/\s/.test(x.asked.slice(id.length + 2))), `${id}: <label token>`).toBe(true)
      expect(r.some((x) => x.v === null), `${id} null`).toBe(true)
      expect(r.some((x) => x.v !== null && x.status === 'current'), `${id} current`).toBe(true)
      expect(r.some((x) => x.v !== null && x.status === 'superseded'), `${id} superseded`).toBe(true)
      if (id !== 'BQ1.bn') {
        expect(r.some((x) => x.v === 'restricted-provided'), `${id} restricted-provided`).toBe(true)
        expect(r.some((x) => x.v !== null && /^restricted-provided\D?\d{4}$/.test(x.v)), `${id} restricted-provided plus 4 digits`).toBe(true)
      } else {
        expect(r.some((x) => x.v !== null && x.v.includes('CANARY')), 'BQ1.bn holds a canary, not given').toBe(true)
      }
    }
    const digits = await rows<{ v: string }>(
      db,
      `select answer_verbatim as v from public.answers where answer_verbatim ~ '[0-9]{5,}'
       union all select filename from public.documents where filename ~ '[0-9]{5,}'
       union all select body from public.qa_transcript where body ~ '[0-9]{5,}'`,
    )
    expect(digits, 'digit runs of 5 or more (contract line 73)').toEqual([])
  }

  test('ARC-2 as returns_app, no column of any bridge view shows a canary or a marker value, read plainly or under a near-zero-cost pg_temp function in the qual', async () => {
    const db = await drafted()
    await standInHoldsEveryItem(db)
    const views = await bridgeViews(db)
    expect(views).toEqual(manifest().views.map((v) => v.name).sort())
    expect(await canaryProblems(db)).toEqual([])
  })

  test('ARC-2 each marker answer row reads exactly "given" in bridge.answer (bare or "<id>: <label>", either status, or a value starting restricted-provided); null stays null; other answers read as written', async () => {
    const db = await drafted()
    const markers = neverReadItems().markerIds
    const source = await rows<{ id: string; asked: string; v: string | null }>(
      db,
      `select id::text as id, question_asked as asked, answer_verbatim as v from public.answers order by id`,
    )
    const isMarker = (x: { asked: string; v: string | null }): boolean =>
      markers.includes(x.asked.split(':')[0] ?? '') || (x.v !== null && x.v.startsWith('restricted-provided'))
    const marked = source.filter(isMarker)
    expect(marked.length).toBeGreaterThanOrEqual(markers.length * 6)
    expect(source.filter((x) => !isMarker(x)).length).toBeGreaterThan(0)
    const seen = new Map(
      (await asRole(db, 'returns_app', () => rows<{ id: string; v: string | null }>(db, `select id::text as id, answer_verbatim as v from bridge.answer`))).map((r) => [r.id, r.v]),
    )
    const problems: string[] = []
    for (const x of source) {
      const want = isMarker(x) ? (x.v === null ? null : 'given') : x.v
      if (!seen.has(x.id)) problems.push(`bridge.answer lacks answer ${x.id}`)
      else if (seen.get(x.id) !== want) problems.push(`bridge.answer ${x.id} (${x.asked}) reads ${String(seen.get(x.id))}, not ${String(want)}`)
    }
    expect(problems).toEqual([])
  })

  test('ARC-2 every bridge view is created with security_barrier (pg_class.reloptions)', async () => {
    const db = await drafted()
    expect((await bridgeViews(db)).length).toBe(manifest().views.length)
    expect(await barrierProblems(db)).toEqual([])
  })

  test('ARC-2 rule: a planted filtered plain-column view without security_barrier fails the sweep and the barrier check, by name; the draft views fail neither', async () => {
    const db = await drafted()
    await db.exec(`create view bridge.planted_leaky as select a.id, a.question_asked, a.answer_verbatim, a.is_test from public.answers a where a.channel = 'internal';
                   grant select on bridge.planted_leaky to returns_app;`)
    const plain = await asRole(db, 'returns_app', () => rows<{ v: string }>(db, 'select answer_verbatim as v from bridge.planted_leaky'))
    expect(plain.map((r) => r.v)).toEqual(['yes'])
    const swept = await canaryProblems(db)
    expect(swept).toContain('bridge.planted_leaky.answer_verbatim leaks a canary under a pg_temp function')
    expect(swept.filter((p) => !p.startsWith('bridge.planted_leaky.'))).toEqual([])
    const barrier = await barrierProblems(db)
    expect(barrier).toEqual(['bridge.planted_leaky has no security_barrier'])
  })
})

describe('GL3 round 4: reach by class (A498 S3; ARC-2, SEC-6, END-7)', () => {
  test('ARC-2 every role (superusers and built-in pg_ roles aside) plus a no-grant role reaches exactly its allow-list, by the spec catalog read and by probeReach alike', async () => {
    const db = await drafted()
    const { problems, roles } = await allReachProblems(db)
    for (const r of ['returns_app', 'client_app_reader', 'anon', 'authenticated', NOBODY]) expect(roles).toContain(r)
    expect(await specReach(db, 'returns_app')).toContain('select on bridge.corporation')
    expect(await specReach(db, 'client_app_reader')).toContain('select (status) on returns.client_handoff')
    expect(problems).toEqual([])
    for (const role of roles) expect(await probeReach(db, role), role).toEqual(await specReach(db, role))
  })

  test('ARC-2 rule: planted membership, write grant, definer function and public-key grant are each caught by name, by the spec read and by probeReach alike', async () => {
    const db = await drafted()
    await db.exec(`grant insert on public.people to returns_app;
      grant select on returns.client_handoff to anon;
      create function public.gl3_planted_definer() returns integer language sql security definer as $f$ select 1 $f$;`)
    // roles are cluster-wide on Postgres 16: the planted membership is always taken back
    await db.exec('grant client_app_reader to authenticated')
    try {
      const { problems } = await allReachProblems(db)
      expect(problems).toContain('authenticated reaches member of client_app_reader')
      expect(problems).toContain('authenticated reaches select (status) on returns.client_handoff')
      expect(problems).toContain('returns_app reaches insert on public.people')
      expect(problems).toContain('returns_app reaches execute on public.gl3_planted_definer() security definer')
      expect(problems).toContain(`${NOBODY} reaches execute on public.gl3_planted_definer() security definer`)
      expect(problems).toContain('anon reaches select on returns.client_handoff')
      for (const role of ['returns_app', 'authenticated', 'anon', NOBODY]) expect(await probeReach(db, role), role).toEqual(await specReach(db, role))
      expect(await probeReach(db, 'authenticated')).toContain('member of client_app_reader')
      expect(await probeReach(db, 'returns_app')).toContain('execute on public.gl3_planted_definer() security definer')
    } finally {
      await db.exec('revoke client_app_reader from authenticated')
    }
  })

  test('ARC-2 probeReach issues only single select statements on the catalog (every statement recorded)', async () => {
    const db = await drafted()
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
    const reach = await probeReach(recorder, 'returns_app')
    expect(reach).toContain('usage on schema bridge')
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

describe('GL3 round 4: the draft applies as one unit (A498 S4; SEC-6)', () => {
  /** What anon, authenticated and a role with only PUBLIC's rights reach in schema bridge. */
  async function publicKeyBridgeReach(db: PGlite): Promise<string[]> {
    const out: string[] = []
    for (const role of ['anon', 'authenticated', NOBODY]) {
      for (const k of await specReach(db, role)) if (/\bon (schema )?bridge(\.|$)/.test(k)) out.push(`${role} reaches ${k}`)
    }
    return out
  }

  test('SEC-6 after 0001_bridge_views.sql alone, anon, authenticated and PUBLIC reach nothing in schema bridge', async () => {
    const db = await standIn()
    expect((await rows(db, 'select 1 from pg_default_acl')).length).toBeGreaterThan(0)
    await db.exec(VIEWS_SQL)
    expect((await rows(db, `select 1 from pg_namespace where nspname = 'bridge'`)).length).toBe(1)
    expect(await publicKeyBridgeReach(db)).toEqual([])
  })

  test('SEC-6 when 0002 fails inside this database (returns.client_handoff dropped first), applyDraft fails, leaves no schema bridge, and the public-key roles reach nothing in bridge', async () => {
    const db = await standIn()
    await db.exec('drop table returns.client_handoff cascade')
    let failed = false
    try {
      await applyDraft(db)
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
    expect(await rows(db, `select nspname from pg_namespace where nspname = 'bridge'`)).toEqual([])
    expect(await publicKeyBridgeReach(db)).toEqual([])
  })
})

describe('GL3 round 4: the shared table policy walk (A498 S5; ARC-2, END-7)', () => {
  const STATUSES = ['draft', 'sent', 'withdrawn', 'closed'] as const
  const SENT_AT = [null, '2026-02-10T10:00:00-05:00'] as const
  const STATES = STATUSES.flatMap((status) => SENT_AT.map((sentAt) => ({ status, sentAt })))
  const visible = (s: { status: string; sentAt: string | null }): boolean => s.status !== 'draft' && s.sentAt !== null
  const label = (s: { status: string; sentAt: string | null }): string => `${s.status}, sent_at ${s.sentAt === null ? 'null' : 'set'}`

  async function seen(db: PGlite): Promise<Set<number>> {
    const r = await asRole(db, 'client_app_reader', () => rows<{ position: number }>(db, 'select position from returns.client_handoff'))
    return new Set(r.map((x) => x.position))
  }

  test('END-7 every status with sent_at null or set, inserted by the owner: client_app_reader sees a row only when its status is not draft and sent_at is set', async () => {
    const db = await drafted()
    for (const [i, s] of STATES.entries()) {
      await db.query(
        `insert into returns.client_handoff (corporation_id, engagement_id, tax_year, list_kind, list_version, position, status, sent_at,
           item_id, primitive, fact_id, answer_shape)
         values ($1, '00000000-0000-4000-8000-000000009001', 2025, 'questions', 1, $2, $3, $4, 'BQ1.bn', 'ask', 'FL:102', 'free_text')`,
        [C1, i + 1, s.status, s.sentAt],
      )
    }
    expect(STATES).toHaveLength(8)
    const got = await seen(db)
    const problems = STATES.flatMap((s, i) => (got.has(i + 1) === visible(s) ? [] : [`${label(s)}: ${got.has(i + 1) ? 'seen' : 'hidden'}`]))
    expect(problems).toEqual([])
  })

  test('END-7 every row moved by the owner from each status and sent_at to every other: client_app_reader sees it only when its status is not draft and sent_at is set', async () => {
    const db = await drafted()
    await db.query(
      `insert into returns.client_handoff (corporation_id, engagement_id, tax_year, list_kind, list_version, position, status, sent_at,
         item_id, primitive, fact_id, answer_shape)
       values ($1, '00000000-0000-4000-8000-000000009001', 2025, 'questions', 1, 1, 'draft', null, 'BQ1.bn', 'ask', 'FL:102', 'free_text')`,
      [C1],
    )
    const problems: string[] = []
    let moves = 0
    for (const from of STATES) {
      for (const to of STATES) {
        if (from === to) continue
        await db.query('update returns.client_handoff set status = $1, sent_at = $2 where position = 1', [from.status, from.sentAt])
        await db.query('update returns.client_handoff set status = $1, sent_at = $2 where position = 1', [to.status, to.sentAt])
        moves += 1
        const isSeen = (await seen(db)).has(1)
        if (isSeen !== visible(to)) problems.push(`${label(from)} -> ${label(to)}: ${isSeen ? 'seen' : 'hidden'}`)
      }
    }
    expect(moves).toBe(56)
    expect(problems).toEqual([])
  })
})
