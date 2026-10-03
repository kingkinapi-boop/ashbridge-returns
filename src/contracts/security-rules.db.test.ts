// SC3: security rules on a database (db project). Card plan/cards/SC3.md; clauses SEC-11, ARC-6, ARC-20, FLOW-1,
// ARC-15. R62 (the AUTH_ENGINE factory), R63 (stand-ins refuse a database holding a real row), R64 (@once), R65
// (@limit N) and R66 (free text in append-only tables). The settings rule for the adapters that need no database is
// tools/test/security-rules.test.mjs. Each rule is first shown catching a planted fault (tools/test/__fixtures__/
// security-rules/), then applied to the repo. Clock pinned; races assert an invariant that holds for every interleaving.
//
// JSDoc tags on product exports (an owning card adds its own line to the registries below):
//   `@standin <name>`   a stand-in factory that writes rows (R63)
//   `@once <name>`      an export that succeeds at most once however calls interleave (R64)
//   `@limit <N> <name>` an export that lets at most N of 2N parallel attempts through (R65)
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { listTestUsers, testCredentials } from '../modules/auth/testing'
import type { Clock } from '../core/clock'
import { cloneTestDb } from '../core/db'
import { createAuth } from '../modules/auth'

const ROOT = path.resolve(__dirname, '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__', 'security-rules')
const fix = (name: string): string => fs.readFileSync(path.join(FIX, name), 'utf8')
const START = new Date('2026-10-02T10:00:05-04:00').getTime()
const USER = listTestUsers().find((u) => u.displayName.includes('(Test)'))?.id ?? ''
const clockAt = (ms: number): Clock => ({ now: () => new Date(ms) })

// ---------- the tag scan (R63 to R65 registries stay equal to the tags in src) ----------
interface Tagged { key: string; n?: number }
const SKIP = new Set(['node_modules', '.next', '.git', '__fixtures__', '__golden__', 'coverage', '.stryker-tmp'])
function productFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) productFiles(p, out)
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}
const relOf = (p: string): string => path.relative(ROOT, p).split(path.sep).join('/')

/** Every JSDoc `@tag` line in the given sources: `@standin name`, `@once name`, `@limit N name`. */
export function taggedExports(tag: 'standin' | 'once' | 'limit', files: { name: string; text: string }[]): Tagged[] {
  const out: Tagged[] = []
  for (const f of files) {
    for (const block of f.text.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
      for (const line of block[0].split('\n')) {
        const m = new RegExp(`^\\s*\\*?\\s*@${tag}\\s+(?:(\\d+)\\s+)?([A-Za-z_$][\\w$]*)\\s*(?:\\*/)?\\s*$`).exec(line)
        if (!m) continue
        const key = `${f.name}#${m[2] ?? ''}`
        out.push(m[1] === undefined ? { key } : { key, n: Number(m[1]) })
      }
    }
  }
  return out
}
export function tagProblems(tagged: Tagged[], registry: { key: string; n?: number }[]): string[] {
  const out: string[] = []
  const reg = new Map(registry.map((r) => [r.key, r.n]))
  for (const t of tagged) {
    if (!reg.has(t.key)) out.push(`${t.key}: tagged but missing from the registry`)
    else if (reg.get(t.key) !== t.n) out.push(`${t.key}: the tag says limit ${String(t.n)} but the registry says ${String(reg.get(t.key))}`)
  }
  for (const r of registry) if (!tagged.some((t) => t.key === r.key)) out.push(`${r.key}: in the registry but its export lacks the tag`)
  return out
}
const SOURCES = (): { name: string; text: string }[] =>
  productFiles(path.join(ROOT, 'src')).map((p) => ({ name: relOf(p), text: fs.readFileSync(p, 'utf8') }))

// ---------- harnesses ----------
type Ctx = { db: PGlite } & Record<string, unknown>
interface Entry<T = Ctx> {
  key: string
  setup: (db: PGlite) => Promise<T>
  /** One attempt; true when it got through. A rejection counts as refused. */
  call: (ctx: T, i: number) => Promise<boolean>
}
const PARALLEL = 8

async function gotThrough<T>(entry: Entry<T>, ctx: T, attempts: number): Promise<number> {
  const results = await Promise.allSettled(Array.from({ length: attempts }, (_, i) => entry.call(ctx, i)))
  return results.filter((r) => r.status === 'fulfilled' && r.value).length
}

/** R64: 8 parallel calls on one clone; exactly one gets through (none means the entry's setup is wrong). */
export async function onceProblems<T>(entry: Entry<T>, db: PGlite): Promise<string[]> {
  const n = await gotThrough(entry, await entry.setup(db), PARALLEL)
  if (n > 1) return [`${entry.key}: ${String(n)} of ${String(PARALLEL)} parallel calls got through, at most 1 allowed`]
  if (n === 0) return [`${entry.key}: no call got through, so the entry proves nothing`]
  return []
}
/** R65: 2N parallel attempts; at most N are let through. */
export async function limitProblems<T>(entry: Entry<T>, n: number, db: PGlite, count?: (db: PGlite) => Promise<number>): Promise<string[]> {
  const ctx = await entry.setup(db)
  const returned = await gotThrough(entry, ctx, 2 * n)
  const through = count ? await count(db) : returned
  if (through > n) return [`${entry.key}: ${String(through)} of ${String(2 * n)} parallel attempts got through, at most ${String(n)} allowed`]
  if (through === 0) return [`${entry.key}: no attempt got through, so the entry proves nothing`]
  return []
}

// ---------- planted faults ----------
const plantedOnce = (clean: boolean): Entry => ({
  key: 'planted-r64#claim',
  setup: async (db) => {
    await db.exec(fix(clean ? 'clean-r64-once.sql' : 'planted-r64-once.sql'))
    return { db }
  },
  call: async ({ db }, i) => {
    if (clean) {
      const r = await db.query('insert into returns.planted_claims (id, who) values ($1, $2) on conflict do nothing returning id', ['c1', `w${String(i)}`])
      return r.rows.length === 1
    }
    const seen = await db.query<{ n: number }>("select count(*)::int as n from returns.planted_claims where id = 'c1'")
    if (Number(seen.rows[0]?.n) > 0) return false
    await db.query('insert into returns.planted_claims (id, who) values ($1, $2)', ['c1', `w${String(i)}`])
    return true
  },
})
const plantedLimit = (clean: boolean): Entry => ({
  key: 'planted-r65#attempt',
  setup: async (db) => {
    await db.exec(fix('planted-r65-limit.sql'))
    return { db }
  },
  call: async ({ db }, i) => {
    const run = async (q: Pick<PGlite, 'query'>): Promise<boolean> => {
      const seen = await q.query<{ n: number }>('select count(*)::int as n from returns.planted_attempts')
      if (Number(seen.rows[0]?.n) >= 3) return false
      await q.query('insert into returns.planted_attempts (who) values ($1)', [`w${String(i)}`])
      return true
    }
    return clean ? db.transaction(run) : run(db)
  },
})

// ---------- the registries (first entries: A06) ----------
const AUTH_FILE = 'src/modules/auth/testusers/engine.ts'
const finishSignIn: Entry<Ctx & { challenges: string[]; code: string }> = {
  key: `${AUTH_FILE}#finishSignIn`,
  setup: async (db) => {
    const auth = await createAuth({ db, env: {}, clock: clockAt(START) })
    const c = testCredentials(USER)
    const challenges: string[] = []
    for (let i = 0; i < PARALLEL; i += 1) {
      const s = await auth.startSignIn(USER, c.password)
      if (!s.ok) throw new Error('setup: sign-in refused')
      challenges.push(s.challenge)
    }
    return { db, auth, challenges, code: c.codeAt(new Date(START)) }
  },
  call: async (ctx, i) => {
    const auth = ctx['auth'] as Awaited<ReturnType<typeof createAuth>>
    return (await auth.finishSignIn(ctx.challenges[i] ?? '', ctx.code)).ok
  },
}
const ONCE: Entry<never>[] = [finishSignIn as unknown as Entry<never>]

const lockOut: Entry = {
  key: `${AUTH_FILE}#startSignIn`,
  setup: async (db) => ({ db, auth: await createAuth({ db, env: {}, clock: clockAt(START) }) }),
  // Attempts let through are counted by `evaluated` below, from the database: a password that reached the comparison is recorded as `wrong password`.
  call: async (ctx, i) => {
    const auth = ctx['auth'] as Awaited<ReturnType<typeof createAuth>>
    await auth.startSignIn(USER, `PLANTED-wrong-${String(i)}`)
    return true
  },
}
const LIMIT: { entry: Entry; n: number; evaluated: (db: PGlite) => Promise<number> }[] = [
  {
    entry: lockOut,
    n: 5,
    evaluated: async (db) =>
      Number((await db.query<{ n: number }>("select count(*)::int as n from returns.sign_in_events where reason = 'wrong password'")).rows[0]?.n),
  },
]

const STANDINS = [
  {
    key: `${AUTH_FILE}#createTestUsersAuth`,
    table: 'staff_users',
    realRow: "insert into returns.staff_users (id, display_name, roles, is_test) values ('REAL-1', 'Real Person', array['owner'], false)",
    start: (db: PGlite) => createAuth({ db, env: {}, clock: clockAt(START) }),
  },
]

async function rowCount(db: PGlite, table: string): Promise<number> {
  return Number((await db.query<{ n: number }>(`select count(*)::int as n from returns.${table}`)).rows[0]?.n)
}
/** R63: a stand-in that writes rows refuses a database holding any is_test = false row, and writes nothing. */
export async function standinProblems(key: string, table: string, realRow: string, start: (db: PGlite) => Promise<unknown>, db: PGlite): Promise<string[]> {
  await db.query(realRow)
  const before = await rowCount(db, table)
  let refused = false
  try {
    await start(db)
  } catch {
    refused = true
  }
  const out: string[] = []
  if (!refused) out.push(`${key}: started on a database holding a real row in ${table}`)
  if ((await rowCount(db, table)) !== before) out.push(`${key}: wrote rows into ${table} next to a real row`)
  return out
}

// ---------- R66 ----------
const R66_SQL = `
select c.relname as t, a.attname as col
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'returns'
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where c.relkind = 'r'
  and a.atttypid in ('text'::regtype, 'varchar'::regtype, 'text[]'::regtype)
  and exists (select 1 from pg_trigger g join pg_proc p on p.oid = g.tgfoid
              where g.tgrelid = c.oid and not g.tgisinternal and p.proname = 'refuse_change')
  and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'f' and a.attnum = any (k.conkey))
  and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'p' and k.conkey = array[a.attnum])
  and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'c' and a.attnum = any (k.conkey)
                  and pg_get_constraintdef(k.oid) ~ '(= ANY|~|<@)')
order by 1, 2`
/** Text columns of append-only tables with no key, no list or format check and no reviewed free-text line. */
export async function freeTextColumns(db: PGlite): Promise<string[]> {
  return (await db.query<{ t: string; col: string }>(R66_SQL)).rows.map((r) => `${r.t}.${r.col}`)
}
const APPEND_ONLY_SQL = `select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'returns'
  where c.relkind = 'r' and exists (select 1 from pg_trigger g join pg_proc p on p.oid = g.tgfoid
  where g.tgrelid = c.oid and not g.tgisinternal and p.proname = 'refuse_change') order by 1`
// The reviewed free-text list: `table.column` and why free text is right there. A line is added only in a card that is reviewed.
// A single-column primary key counts as keyed (amber: ids are generated by code, never typed).
const FREE_TEXT: Record<string, string> = {
  'approvals.fingerprint': 'a sha256 of the approved content, computed by code (FLOW-1); the value has no fixed list',
  'entry_lines.qbo_account_id': 'the id QuickBooks gave the account; opaque to us and not ours to constrain',
  'events.reason': 'the reason a person or the system gave for the change (FLOW-1); free by nature, non-blank is checked',
  'events.record_id': 'the id of the record the event is about, in the table named beside it; a pointer across tables cannot be one key',
  'events.record_table': 'the name of the table the event is about; the set grows with each card, so the owning card lists it',
  'jobs.idempotency_key': 'built by code from the work it names (ARC-14), never typed; no fixed list',
  'jobs.last_error': 'the error text of the last failed attempt, already redacted by the logger (SEC-10); free by nature',
  'jobs.lease_holder': 'the name of the worker holding the lease, set by code; no fixed list',
  'sign_in_events.reason': 'one of the fixed sentences the auth engine writes, never typed text (SEC-10); non-blank is checked',
  'state_events.reason': 'the reason a person or the system gave for the transition (FLOW-1); free by nature, non-blank is checked',
  'version_cells.cell_id': 'the Taxprep cell identifier, kept as the export spelled it (RT-13); the cell list lives in data, not in a check',
  'version_cells.value': 'the cell value as exported, kept exactly as read (RT-3); any text is valid',
}

describe('R62 the AUTH_ENGINE factory refuses production silence (SEC-11, ARC-6, ARC-20)', () => {
  test('R62 createAuth with NODE_ENV=production and AUTH_ENGINE unset or blank rejects naming the setting and seeds nothing', async () => {
    for (const AUTH_ENGINE of [undefined, '']) {
      const db = await cloneTestDb()
      await expect(createAuth({ db, env: { NODE_ENV: 'production', ...(AUTH_ENGINE === undefined ? {} : { AUTH_ENGINE }) } })).rejects.toThrow(/AUTH_ENGINE/)
      expect(await rowCount(db, 'staff_users')).toBe(0)
    }
  })
  test('R62 createAuth works in production when AUTH_ENGINE is set, and unset outside production', async () => {
    const db = await cloneTestDb()
    await expect(createAuth({ db, env: { NODE_ENV: 'production', AUTH_ENGINE: 'testusers' }, clock: clockAt(START) })).resolves.toBeDefined()
    for (const NODE_ENV of ['development', 'test']) {
      await expect(createAuth({ db: await cloneTestDb(), env: { NODE_ENV }, clock: clockAt(START) })).resolves.toBeDefined()
    }
  })
})

describe('the tags in src equal the registries (R63 to R65, ARC-15 style: the tag set is never silently empty)', () => {
  test('R63 R64 R65 rule: a planted file with one tag of each kind is read, and a registry gap in either direction is caught', () => {
    const files = [{ name: 'planted-tags.ts', text: fix('planted-tags.ts.txt') }]
    expect(taggedExports('once', files)).toEqual([{ key: 'planted-tags.ts#claimOnce' }])
    expect(taggedExports('limit', files)).toEqual([{ key: 'planted-tags.ts#tryThree', n: 3 }])
    expect(taggedExports('standin', files)).toEqual([{ key: 'planted-tags.ts#seedPlanted' }])
    expect(tagProblems(taggedExports('once', files), [])).toEqual(['planted-tags.ts#claimOnce: tagged but missing from the registry'])
    expect(tagProblems([], [{ key: 'x.ts#f' }])).toEqual(['x.ts#f: in the registry but its export lacks the tag'])
    expect(tagProblems(taggedExports('limit', files), [{ key: 'planted-tags.ts#tryThree', n: 4 }])).toEqual([
      'planted-tags.ts#tryThree: the tag says limit 3 but the registry says 4',
    ])
    expect(tagProblems(taggedExports('limit', files), [{ key: 'planted-tags.ts#tryThree', n: 3 }])).toEqual([])
  })
  test('R63 every @standin export is in the stand-in registry and the other way round', () => {
    const files = SOURCES()
    expect(files.map((f) => f.name)).toContain('src/modules/auth/index.ts')
    expect(tagProblems(taggedExports('standin', files), STANDINS.map((s) => ({ key: s.key })))).toEqual([])
  })
  test('R64 every @once export is in the once registry and the other way round', () => {
    expect(tagProblems(taggedExports('once', SOURCES()), ONCE.map((e) => ({ key: e.key })))).toEqual([])
  })
  test('R65 every @limit N export is in the limit registry with the same N, and the other way round', () => {
    expect(tagProblems(taggedExports('limit', SOURCES()), LIMIT.map((l) => ({ key: l.entry.key, n: l.n })))).toEqual([])
  })
})

describe('R63 a stand-in that writes rows refuses a database holding a real row (SEC-11)', () => {
  test('R63 rule: a planted seeder that does not look is caught, and one that refuses passes', async () => {
    const planted = async (db: PGlite): Promise<void> => {
      await db.query("insert into returns.planted_people (id) values ('seeded-1')")
    }
    const clean = async (db: PGlite): Promise<void> => {
      const real = await db.query<{ n: number }>('select count(*)::int as n from returns.planted_people where is_test = false')
      if (Number(real.rows[0]?.n) > 0) throw new Error('refuses to start: the database holds a real row')
      await planted(db)
    }
    const row = "insert into returns.planted_people (id, is_test) values ('real-1', false)"
    const a = await cloneTestDb()
    await a.exec(fix('planted-r63-seeder.sql'))
    expect(await standinProblems('planted#seed', 'planted_people', row, planted, a)).toEqual([
      'planted#seed: started on a database holding a real row in planted_people',
      'planted#seed: wrote rows into planted_people next to a real row',
    ])
    const b = await cloneTestDb()
    await b.exec(fix('planted-r63-seeder.sql'))
    expect(await standinProblems('planted#seed', 'planted_people', row, clean, b)).toEqual([])
  })
  test.each(STANDINS)('R63 $key refuses a database holding one is_test = false row and writes nothing', async (s) => {
    expect(await standinProblems(s.key, s.table, s.realRow, s.start, await cloneTestDb())).toEqual([])
  })
})

describe('R64 an export tagged @once lets at most one of 8 parallel calls through (SEC-1, ARC-6)', () => {
  test('R64 rule: a planted read-then-insert with no unique index lets many through, and the unique-index twin exactly one', async () => {
    const planted = await onceProblems(plantedOnce(false), await cloneTestDb())
    expect(planted).toHaveLength(1)
    expect(planted[0]).toMatch(/^planted-r64#claim: [2-8] of 8 parallel calls got through, at most 1 allowed$/)
    expect(await onceProblems(plantedOnce(true), await cloneTestDb())).toEqual([])
  })
  test.each(ONCE)('R64 $key', async (entry) => {
    expect(await onceProblems(entry, await cloneTestDb())).toEqual([])
  })
})

describe('R65 an export tagged @limit N lets at most N of 2N parallel attempts through (SEC-1)', () => {
  test('R65 rule: a planted check-then-record counter lets all through, and the serialised twin exactly 3', async () => {
    const planted = await limitProblems(plantedLimit(false), 3, await cloneTestDb())
    expect(planted).toHaveLength(1)
    expect(planted[0]).toMatch(/^planted-r65#attempt: ([4-6]) of 6 parallel attempts got through, at most 3 allowed$/)
    expect(await limitProblems(plantedLimit(true), 3, await cloneTestDb())).toEqual([])
  })
  test.each(LIMIT)('R65 $entry.key evaluates at most $n of twice as many parallel attempts', async ({ entry, n, evaluated }) => {
    const db = await cloneTestDb()
    expect(await limitProblems(entry, n, db, evaluated)).toEqual([])
  })
})

describe('R66 every text column of an append-only table has a key, a list or format check, or a reviewed free-text line (FLOW-1, SEC-11)', () => {
  test('R66 rule: a planted append-only user_id text with none is caught, and the keyed twin passes', async () => {
    const a = await cloneTestDb()
    await a.exec(fix('planted-r66-append-only.sql'))
    expect((await freeTextColumns(a)).filter((c) => c.startsWith('planted_'))).toEqual(['planted_events.user_id'])
    const b = await cloneTestDb()
    await b.exec(fix('clean-r66-append-only.sql'))
    expect((await freeTextColumns(b)).filter((c) => c.startsWith('planted_'))).toEqual([])
  })
  test('R66 every append-only table is found (sentinel: sign_in_events), and each of its free-text columns is on the reviewed list', async () => {
    const db = await cloneTestDb()
    const tables = (await db.query<{ t: string }>(APPEND_ONLY_SQL)).rows.map((r) => r.t)
    expect(tables).toContain('sign_in_events')
    const free = await freeTextColumns(db)
    expect(free.filter((c) => !(c in FREE_TEXT))).toEqual([])
    expect(Object.keys(FREE_TEXT).filter((c) => !free.includes(c))).toEqual([])
    for (const [col, reason] of Object.entries(FREE_TEXT)) expect(reason.trim().length, col).toBeGreaterThan(10)
  })
})
