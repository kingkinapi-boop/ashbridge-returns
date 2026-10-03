// SC3: security rules on a database (db project). Card plan/cards/SC3.md; clauses SEC-11, ARC-6, ARC-20, FLOW-1,
// ARC-15. R62 (the AUTH_ENGINE factory), R63 (stand-ins refuse a database holding a real row), R64 (@once), R65
// (@limit N) and R66 (free text in append-only tables). The rule functions and reviewed lists live in
// tools/test/__fixtures__/security-rules/harness.ts; tools/test/security-rules.test.mjs runs each on planted input in
// the unit project (the twin, A391). Each rule is first shown catching a planted fault (tools/test/__fixtures__/
// security-rules/), then applied to the repo. Clock pinned; races assert an invariant that holds for every interleaving.
//
// JSDoc tags on product exports (an owning card adds its tag, its key in harness.ts REGISTRY and its entry below):
//   `@standin <name>`   a stand-in factory that writes rows (R63)
//   `@once <name>`      an export that succeeds at most once however calls interleave (R64)
//   `@limit <N> <name>` an export that lets at most N of 2N parallel attempts through (R65)
// Each tag stands alone on its own line inside a multi-line JSDoc block; any other mention fails (A452 item 6).
//
// Round 3 (A504 S2, S3): PGlite runs one transaction at a time; Postgres 16 (TEST_DB=pg16) gives each transaction its
// own pooled connection. So a twin that passes on both must hold a lock (S2: the R65 clean twin opens with
// `select ... for update`, as A06's lockUser does), and a race inside transactions is proven in DB16's form
// (src/core/db/pg16.acceptance.db.test.ts, the planted race): a barrier between the read and the write, `ON ? test :
// test.fails`. Caught on Postgres 16; on PGlite the race cannot happen, a named blind spot (S3).
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import {
  APPEND_ONLY_SENTINEL,
  FORMAT_FUNCTIONS,
  FREE_TEXT,
  KNOWN,
  LANDING,
  PARALLEL,
  REGISTRY,
  appendOnlyGuardProblems,
  appendOnlyTables,
  applyKnown,
  checkVouches,
  formatFunctionProblems,
  freeText,
  landingProblems,
  limitProblems,
  onceProblems,
  r66Problems,
  readSchema,
  readSources,
  standinProblems,
  tableFiles,
  tagProblems,
  taggedExports,
  type Catalog,
  type Entry as HarnessEntry,
} from '../../tools/test/__fixtures__/security-rules/harness'
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
const SOURCES = (): { name: string; text: string }[] => readSources(ROOT, path.join(ROOT, 'src'))
const ON = process.env['TEST_DB'] === 'pg16'
const RACE_WAIT_MS = 500
// DB16's form: a race between transactions is proven on Postgres 16 and is a named blind spot on PGlite.
const race = ON ? test : test.fails

/**
 * DB16's barrier: each caller waits until `expected` callers have arrived, or `waitMs` at most. On Postgres 16 the
 * pooled transactions (4 connections) all read before any of them writes; on PGlite the first waits alone and carries on.
 */
function barrierFor(expected: number, waitMs: number): () => Promise<void> {
  let arrived = 0
  const waiting: (() => void)[] = []
  return () =>
    new Promise<void>((resolve) => {
      arrived += 1
      if (arrived >= expected) {
        for (const w of waiting.splice(0)) w()
        resolve()
        return
      }
      waiting.push(resolve)
      setTimeout(resolve, waitMs)
    })
}

// ---------- harnesses (harness.ts: onceProblems, limitProblems, standinProblems; the unit twin runs them on fakes) ----------
type Ctx = { db: PGlite } & Record<string, unknown>
type Entry<T = Ctx> = HarnessEntry<PGlite, T>

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
// A504 S3: the planted read-then-insert inside a transaction, still with no unique index; a barrier between the read
// and the write.
const plantedOnceInTransaction = (): Entry => {
  const barrier = barrierFor(PARALLEL, RACE_WAIT_MS)
  return {
    key: 'planted-r64#claim',
    setup: async (db) => {
      await db.exec(fix('planted-r64-once.sql'))
      return { db }
    },
    call: async ({ db }, i) =>
      db.transaction(async (tx) => {
        const seen = await tx.query<{ n: number }>("select count(*)::int as n from returns.planted_claims where id = 'c1'")
        if (Number(seen.rows[0]?.n) > 0) return false
        await barrier()
        await tx.query('insert into returns.planted_claims (id, who) values ($1, $2)', ['c1', `w${String(i)}`])
        return true
      }),
  }
}
// 'planted': check then record, no transaction. 'transaction' (A504 S3): the same inside a transaction, no lock, a
// barrier between the read and the write. 'locked' (A504 S2): the transaction first locks the planted_limits row
// (`select ... for update`, as A06's lockUser does), then checks and records, with the same kind of barrier.
const plantedLimit = (form: 'planted' | 'transaction' | 'locked'): Entry => {
  const barrier = barrierFor(6, form === 'locked' ? 50 : RACE_WAIT_MS)
  return {
    key: 'planted-r65#attempt',
    setup: async (db) => {
      await db.exec(fix('planted-r65-limit.sql'))
      return { db }
    },
    call: async ({ db }, i) => {
      const run = async (q: Pick<PGlite, 'query'>): Promise<boolean> => {
        if (form === 'locked') await q.query("select id from returns.planted_limits where id = 'l1' for update")
        const seen = await q.query<{ n: number }>('select count(*)::int as n from returns.planted_attempts')
        if (Number(seen.rows[0]?.n) >= 3) return false
        if (form !== 'planted') await barrier()
        await q.query('insert into returns.planted_attempts (who) values ($1)', [`w${String(i)}`])
        return true
      }
      return form === 'planted' ? run(db) : db.transaction(run)
    },
  }
}

// ---------- the registries (first entries: A06; their keys equal harness.ts REGISTRY) ----------
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
const onDb = (db: PGlite, table: string, realRow: string): { addRealRow: () => Promise<void>; count: () => Promise<number> } => ({
  addRealRow: async () => {
    await db.query(realRow)
  },
  count: () => rowCount(db, table),
})

// ---------- R66: the catalog, read once per clone; harness.ts decides ----------
const USER_SCHEMA = "n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_%'"
const TABLE_NAME = "case when n.nspname = 'returns' then c.relname else n.nspname || '.' || c.relname end"
const TRIGGERS_SQL = `
select ${TABLE_NAME} as "table", p.proname as fn, g.tgtype::int as tgtype
from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace join pg_proc p on p.oid = g.tgfoid
where not g.tgisinternal and ${USER_SCHEMA}`
const FUNCTIONS_SQL = `
select p.proname as name, p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where ${USER_SCHEMA}`
// A column is text when its type, through any domains and array layers, reaches a string type (category S: text,
// varchar, char, citext, name), so a domain over text or a varchar[] cannot escape (A452 item 3).
const COLUMNS_SQL = `
with recursive layers(rel, col, attnum, ty, depth) as (
  select c.oid, a.attname, a.attnum, a.atttypid, 0
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  where c.relkind in ('r', 'p') and ${USER_SCHEMA}
  union all
  select l.rel, l.col, l.attnum, case when y.typtype = 'd' then y.typbasetype else y.typelem end, l.depth + 1
  from layers l join pg_type y on y.oid = l.ty
  where (y.typtype = 'd' or (y.typcategory = 'A' and y.typelem <> 0)) and l.depth < 16
)
select ${TABLE_NAME} as "table", l.col, l.attnum::int as attnum, bool_or(y.typcategory = 'S') as text
from layers l join pg_type y on y.oid = l.ty join pg_class c on c.oid = l.rel join pg_namespace n on n.oid = c.relnamespace
group by 1, 2, 3`
const CONSTRAINTS_SQL = `
select ${TABLE_NAME} as "table", k.contype as type, coalesce(k.conkey::int[], '{}') as cols, pg_get_constraintdef(k.oid) as def
from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
where ${USER_SCHEMA}`

/** The catalog snapshot harness.ts reads (triggers, functions, columns, constraints). */
export async function readCatalog(db: PGlite): Promise<Catalog> {
  return {
    triggers: (await db.query<Catalog['triggers'][number]>(TRIGGERS_SQL)).rows,
    functions: (await db.query<Catalog['functions'][number]>(FUNCTIONS_SQL)).rows,
    columns: (await db.query<Catalog['columns'][number]>(COLUMNS_SQL)).rows,
    constraints: (await db.query<Catalog['constraints'][number]>(CONSTRAINTS_SQL)).rows,
  }
}
/** Text columns of append-only tables with no key, no list or format check on the column, as `table.col`. */
export async function freeTextColumns(db: PGlite): Promise<string[]> {
  return freeText(await readCatalog(db))
}
const planted = (cols: string[]): string[] => cols.filter((c) => c.startsWith('planted_'))
async function withFixture(...names: string[]): Promise<PGlite> {
  const db = await cloneTestDb()
  for (const n of names) await db.exec(fix(n))
  return db
}

describe('R62 the AUTH_ENGINE factory refuses production silence (SEC-11, ARC-6, ARC-20)', () => {
  test.each([undefined, ''])('R62 createAuth with NODE_ENV=production and AUTH_ENGINE %j rejects naming the setting and seeds nothing', async (AUTH_ENGINE) => {
    const db = await cloneTestDb()
    await expect(createAuth({ db, env: { NODE_ENV: 'production', ...(AUTH_ENGINE === undefined ? {} : { AUTH_ENGINE }) } })).rejects.toThrow(/AUTH_ENGINE/)
    expect(await rowCount(db, 'staff_users')).toBe(0)
  })
  test('R62 createAuth works in production when AUTH_ENGINE is set', async () => {
    const db = await cloneTestDb()
    await expect(createAuth({ db, env: { NODE_ENV: 'production', AUTH_ENGINE: 'testusers' }, clock: clockAt(START) })).resolves.toBeDefined()
  })
  test.each(['development', 'test'])('R62 createAuth works with AUTH_ENGINE unset when NODE_ENV is %s', async (NODE_ENV) => {
    await expect(createAuth({ db: await cloneTestDb(), env: { NODE_ENV }, clock: clockAt(START) })).resolves.toBeDefined()
  })
})

describe('the tags in src equal the registries (R63 to R65, ARC-15 style: the tag set is never silently empty)', () => {
  test('R63 R64 R65 the registries here hold exactly the keys of harness.ts REGISTRY', () => {
    expect(STANDINS.map((s) => ({ key: s.key }))).toEqual(REGISTRY.standin)
    expect(ONCE.map((e) => ({ key: e.key }))).toEqual(REGISTRY.once)
    expect(LIMIT.map((l) => ({ key: l.entry.key, n: l.n }))).toEqual(REGISTRY.limit)
  })
  test('R63 every @standin export is in the stand-in registry and the other way round', () => {
    const files = SOURCES()
    expect(files.map((f) => f.name)).toContain('src/modules/auth/index.ts')
    expect(tagProblems(taggedExports('standin', files), STANDINS.map((s) => ({ key: s.key })))).toEqual([])
  })
  test('R64 every @once export is in the once registry and the other way round', () => {
    expect(tagProblems(taggedExports('once', SOURCES()), ONCE.map((e) => ({ key: e.key })))).toEqual([])
  })
  test('R64 a card on the LANDING list that has landed its folder has a once entry under it (T08 approve, E00 intake)', () => {
    expect(LANDING.map((l) => l.card).sort()).toEqual(['E00', 'T08'])
    expect(landingProblems(LANDING, ONCE.map((e) => ({ key: e.key })), (d) => fs.existsSync(path.join(ROOT, d)))).toEqual([])
  })
  test('R65 every @limit N export is in the limit registry with the same N, and the other way round', () => {
    expect(tagProblems(taggedExports('limit', SOURCES()), LIMIT.map((l) => ({ key: l.entry.key, n: l.n })))).toEqual([])
  })
})

describe('R63 a stand-in that writes rows refuses a database holding a real row (SEC-11)', () => {
  test('R63 rule: a planted seeder that does not look is caught', async () => {
    const plantedSeed = async (db: PGlite): Promise<void> => {
      await db.query("insert into returns.planted_people (id) values ('seeded-1')")
    }
    const row = "insert into returns.planted_people (id, is_test) values ('real-1', false)"
    const a = await withFixture('planted-r63-seeder.sql')
    expect(await standinProblems('planted#seed', 'planted_people', onDb(a, 'planted_people', row), () => plantedSeed(a))).toEqual([
      'planted#seed: started on a database holding a real row in planted_people',
      'planted#seed: wrote rows into planted_people next to a real row',
    ])
  })
  test('R63 rule: a planted seeder that refuses passes', async () => {
    const plantedSeed = async (db: PGlite): Promise<void> => {
      await db.query("insert into returns.planted_people (id) values ('seeded-1')")
    }
    const clean = async (db: PGlite): Promise<void> => {
      const real = await db.query<{ n: number }>('select count(*)::int as n from returns.planted_people where is_test = false')
      if (Number(real.rows[0]?.n) > 0) throw new Error('refuses to start: the database holds a real row')
      await plantedSeed(db)
    }
    const row = "insert into returns.planted_people (id, is_test) values ('real-1', false)"
    const b = await withFixture('planted-r63-seeder.sql')
    expect(await standinProblems('planted#seed', 'planted_people', onDb(b, 'planted_people', row), () => clean(b))).toEqual([])
  })
  test.each(STANDINS)('R63 $key refuses a database holding one is_test = false row and writes nothing', async (s) => {
    const db = await cloneTestDb()
    expect(await standinProblems(s.key, s.table, onDb(db, s.table, s.realRow), () => s.start(db))).toEqual([])
  })
})

describe('R64 an export tagged @once lets at most one of 8 parallel calls through (SEC-1, ARC-6)', () => {
  test('R64 rule: a planted read-then-insert with no unique index lets many through', async () => {
    const found = await onceProblems(plantedOnce(false), await cloneTestDb())
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(/^planted-r64#claim: [2-8] of 8 parallel calls got through, at most 1 allowed$/)
  })
  test('R64 rule: the unique-index twin of the planted read-then-insert lets exactly one through', async () => {
    expect(await onceProblems(plantedOnce(true), await cloneTestDb())).toEqual([])
  })
  // A504 S3, DB16's form: caught on Postgres 16; PGlite serialises transactions, so there it is a named blind spot.
  race(
    'R64 rule (A504 S3): a planted read-then-insert in a transaction with no unique index, a barrier between read and write, lets many through on Postgres 16 (PGlite runs one transaction at a time: a named blind spot, test.fails there)',
    async () => {
      const found = await onceProblems(plantedOnceInTransaction(), await cloneTestDb())
      expect(found).toHaveLength(1)
      expect(found[0]).toMatch(/^planted-r64#claim: [2-8] of 8 parallel calls got through, at most 1 allowed$/)
    },
    RACE_WAIT_MS * 8,
  )
  test.each(ONCE)('R64 $key', async (entry) => {
    expect(await onceProblems(entry, await cloneTestDb())).toEqual([])
  })
})

describe('R65 an export tagged @limit N lets at most N of 2N parallel attempts through (SEC-1)', () => {
  test('R65 rule: a planted check-then-record counter lets all through', async () => {
    const found = await limitProblems(plantedLimit('planted'), 3, await cloneTestDb())
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(/^planted-r65#attempt: ([4-6]) of 6 parallel attempts got through, at most 3 allowed$/)
  })
  test('R65 rule (A504 S2): the locked twin of the planted check-then-record counter (select ... for update first, as lockUser does) lets exactly 3 through', async () => {
    expect(await limitProblems(plantedLimit('locked'), 3, await cloneTestDb())).toEqual([])
  })
  // A504 S3, DB16's form: caught on Postgres 16; PGlite serialises transactions, so there it is a named blind spot.
  race(
    'R65 rule (A504 S3): a planted check-then-record counter in a transaction with no lock, a barrier between read and write, lets more than 3 of 6 through on Postgres 16 (PGlite runs one transaction at a time: a named blind spot, test.fails there)',
    async () => {
      const found = await limitProblems(plantedLimit('transaction'), 3, await cloneTestDb())
      expect(found).toHaveLength(1)
      expect(found[0]).toMatch(/^planted-r65#attempt: [4-6] of 6 parallel attempts got through, at most 3 allowed$/)
    },
    RACE_WAIT_MS * 8,
  )
  test.each(LIMIT)('R65 $entry.key evaluates at most $n of twice as many parallel attempts', async ({ entry, n, evaluated }) => {
    const db = await cloneTestDb()
    expect(await limitProblems(entry, n, db, evaluated)).toEqual([])
  })
})

describe('R66 every text column of an append-only table has a key, a list or format check, or a reviewed free-text line (FLOW-1, SEC-11)', () => {
  test('R66 rule: a planted append-only user_id text with none is caught', async () => {
    expect(planted(await freeTextColumns(await withFixture('planted-r66-append-only.sql')))).toEqual(['planted_events.user_id'])
  })
  test('R66 rule: the keyed twin of the planted append-only user_id passes', async () => {
    expect(planted(await freeTextColumns(await withFixture('clean-r66-append-only.sql')))).toEqual([])
  })
  test('R66 rule (item 1): a table guarded by a new function (not refuse_change) is append-only by what its triggers refuse, so its author text is caught', async () => {
    const db = await withFixture('planted-r66-other-guard.sql')
    expect(appendOnlyTables(await readCatalog(db))).toContain('planted_ledger')
    expect(planted(await freeTextColumns(db))).toEqual(['planted_ledger.author'])
  })
  test('R66 rule (item 1 sentinel): a table guarded by refuse_change on rows but open to TRUNCATE is named by the guard check', async () => {
    const cat = await readCatalog(await withFixture('planted-r66-no-truncate.sql'))
    expect(appendOnlyTables(cat)).not.toContain('planted_notes')
    expect(appendOnlyGuardProblems(cat)).toEqual([
      'planted_notes: guarded by refuse_change but not found append-only (no BEFORE ROW DELETE and BEFORE TRUNCATE pair)',
    ])
  })
  test('R66 rule (item 2): a two-column CHECK, a !~ match, a negated match and a non-blank check do not vouch for a column; a format function does', async () => {
    const db = await withFixture('planted-r66-checks.sql')
    expect(planted(await freeTextColumns(db))).toEqual([
      'planted_checks.anchored_any',
      'planted_checks.any_char',
      'planted_checks.blank_only',
      'planted_checks.negated',
      'planted_checks.neighbour',
      'planted_checks.nonblank_match',
      'planted_checks.not_format',
      'planted_checks.not_match',
    ])
  })
  test("R66 rule (A458 G1): a table refusing DELETE and TRUNCATE through one statement-level trigger, whose function never says append-only, is append-only, so its author text is caught", async () => {
    const cat = await readCatalog(await withFixture('planted-r66-statement-guard.sql'))
    expect(appendOnlyTables(cat)).toContain('planted_stmt')
    expect(planted(freeText(cat))).toEqual(['planted_stmt.author'])
  })
  test('R66 rule (A458 G2): main\'s four inline matches (client_ref, token_hash, jobs.kind, the handoff id pattern) still vouch', async () => {
    const cat = await readCatalog(await cloneTestDb())
    const def = (name: string): string => cat.constraints.find((k) => k.def.includes(name))?.def ?? `no constraint on ${name}`
    expect(checkVouches(def('client_ref ~'), 'client_ref')).toBe(true)
    expect(checkVouches(def('token_hash ~'), 'token_hash')).toBe(true)
    expect(checkVouches(def('kind ~'), 'kind')).toBe(true)
    const handoff = cat.functions.find((f) => f.name === 'is_handoff_id')?.src ?? ''
    expect(formatFunctionProblems({ ...cat, functions: cat.functions.filter((f) => f.name === 'is_handoff_id') }, ['is_handoff_id'])).toEqual([])
    expect(handoff).toMatch(/~/)
  })
  test('R66 rule (item 3): a domain over text (and its array), varchar, varchar[] and char(n) are text', async () => {
    const db = await withFixture('planted-r66-types.sql')
    expect(planted(await freeTextColumns(db))).toEqual([
      'planted_types.as_bpchar',
      'planted_types.as_domain',
      'planted_types.as_domain_array',
      'planted_types.as_varchar',
      'planted_types.as_varchar_array',
    ])
  })
  test('R66 every append-only table is found (sentinel list), every append-only guard sits on one, and the format functions hold a match', async () => {
    const cat = await readCatalog(await cloneTestDb())
    const tables = appendOnlyTables(cat)
    expect(APPEND_ONLY_SENTINEL.filter((t) => !tables.includes(t))).toEqual([])
    expect(appendOnlyGuardProblems(cat)).toEqual([])
    expect(formatFunctionProblems(cat)).toEqual([])
    expect(Object.keys(FORMAT_FUNCTIONS).sort()).toEqual(['handoff_ids_ok', 'is_handoff_id'])
  })
  test('R66 every free-text column of an append-only table is on the reviewed list or an R66 KNOWN entry, and neither list holds a stale line', async () => {
    const free = await freeTextColumns(await cloneTestDb())
    expect(free.length).toBeGreaterThan(0)
    const files = tableFiles(readSchema(ROOT))
    expect(files.get('events')).toMatch(/\/20_ledger\.sql$/)
    expect(applyKnown('R66', r66Problems(free, files), KNOWN)).toEqual([])
    expect(Object.keys(FREE_TEXT).filter((c) => !free.includes(c))).toEqual([])
    const known = new Set(KNOWN.filter((k) => k.rule === 'R66').flatMap((k) => k.problems))
    expect(Object.keys(FREE_TEXT).filter((c) => [...known].some((p) => p.startsWith(`${c} `)))).toEqual([])
  })
})
