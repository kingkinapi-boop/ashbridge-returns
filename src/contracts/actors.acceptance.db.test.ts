// FX17 acceptance tests (spec-writer; builders never edit this file). Card plan/cards/FX17.md; clauses SEC-1, SEC-7,
// ARC-13. Findings: reports/SC3-findings.md item 5 and reports/SC3-security.md M4 (on claude/SC3).
//
// The shape these tests fix (amber choices named in reports/FX17-spec.md):
// - The five actor columns (events.actor, state_events.actor, approvals.approved_by, adjusting_entries.author,
//   judgment_inputs.author) each accept exactly: an id in returns.staff_users, or a name on the reviewed list of
//   system actors. Anything else is refused by the database (SQLSTATE class 23), and the refusal names the table
//   and the column (in the message, the constraint name or the detail).
// - The reviewed list is data: table returns.system_actors, filled by the card's schema file 94_actor_keys.sql. Its
//   `id` is the name written in an actor column, `reason` (text) says why that system actor writes records; at least
//   one row, a reason of more than 10 characters per row, no id equal to a test-world staff id. Like every table it
//   has id, created_at and is_test, and row-level security on (ARC-2, SEC-6: records.acceptance.db.test.ts checks).
// - adjusting_entries.author stays nullable (an entry may be stored before anyone owns it; F01); the other four
//   stay not null. Nullability is not this card's subject.
// - The test world loads: the stand-in's test users (seeded into staff_users by createAuth) are accepted as the
//   actor in every column.
// SC3's R66 KNOWN entries owned by FX17 (the five actor columns and sign_in_events.reason, A458) are deleted from
// tools/test/__fixtures__/security-rules/harness.ts in this spec, so R66 fails until this card's keys exist.
import fc from 'fast-check'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { cloneTestDb } from '../core/db'
import { createAuth } from '../modules/auth'
import { listTestUsers, testCredentials } from '../modules/auth/testing'

const AT = new Date('2026-03-17T10:00:00-04:00')
const TEST_IDS = listTestUsers().map((u) => u.id)
const PREPARER = TEST_IDS.find((id) => id.startsWith('preparer')) ?? ''
const PREPARER_NAME = listTestUsers().find((u) => u.id === PREPARER)?.displayName ?? ''

let seq = 0
const tid = (p: string): string => `fx17-${p}-${String(++seq).padStart(6, '0')}`

interface Refusal { code: string; text: string }
async function refusalOf(p: Promise<unknown>): Promise<Refusal | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    const err = e as { code?: string; message?: string; constraint?: string; detail?: string }
    return { code: err.code ?? '', text: `${err.message ?? ''} ${err.constraint ?? ''} ${err.detail ?? ''}` }
  }
}

/** A world: the stand-in has seeded the test users into staff_users. */
async function world(): Promise<PGlite> {
  const db = await cloneTestDb()
  await createAuth({ db, env: { NODE_ENV: 'test' }, clock: { now: () => AT } })
  return db
}

async function newReturn(db: PGlite): Promise<string> {
  const id = tid('return')
  await db.query(`insert into returns.returns (id, entity_name, year_end, state) values ($1, $2, $3, 'intake')`, [
    id,
    'Quillfeather Sample Widgets Inc. (Test)',
    '2025-12-31',
  ])
  return id
}

// One insert per column: every other column valid, so the actor is the only thing that can be wrong.
type Insert = (db: PGlite, actor: string | null) => Promise<unknown>
interface Column { name: string; table: string; column: string; insert: Insert }
const COLUMNS: readonly Column[] = [
  {
    name: 'events.actor',
    table: 'events',
    column: 'actor',
    insert: (db, actor) =>
      db.query(
        `insert into returns.events (id, record_table, record_id, actor, occurred_at, from_value, to_value, reason)
         values ($1, 'facts', $2, $3, $4, null, '{"status":"preparer_verified"}'::jsonb, 'Ticked against the statement (Test)')`,
        [tid('event'), tid('fact'), actor, AT],
      ),
  },
  {
    name: 'state_events.actor',
    table: 'state_events',
    column: 'actor',
    insert: async (db, actor) => {
      const r = await newReturn(db)
      return db.query(
        `insert into returns.state_events (id, return_id, from_state, to_state, actor, occurred_at, reason)
         values ($1, $2, 'intake', 'evidence', $3, $4, 'Created from client-app data (Test)')`,
        [tid('state'), r, actor, AT],
      )
    },
  },
  {
    name: 'approvals.approved_by',
    table: 'approvals',
    column: 'approved_by',
    insert: async (db, actor) => {
      const r = await newReturn(db)
      const v = tid('version')
      await db.query(`insert into returns.versions (id, return_id, version_no) values ($1, $2, 1)`, [v, r])
      return db.query(
        `insert into returns.approvals (id, return_id, version_id, approved_by, fingerprint) values ($1, $2, $3, $4, $5)`,
        [tid('approval'), r, v, actor, 'a'.repeat(64)],
      )
    },
  },
  {
    name: 'adjusting_entries.author',
    table: 'adjusting_entries',
    column: 'author',
    insert: async (db, actor) => {
      const r = await newReturn(db)
      return db.query(
        `insert into returns.adjusting_entries (id, return_id, qbo_snapshot_id, qbo_txn_id, entry_type, reason, author)
         values ($1, $2, 'snap-0001', $3, 'accrual', 'Year-end accrual of December rent (Test)', $4)`,
        [tid('entry'), r, tid('txn'), actor],
      )
    },
  },
  {
    name: 'judgment_inputs.author',
    table: 'judgment_inputs',
    column: 'author',
    insert: async (db, actor) => {
      const r = await newReturn(db)
      return db.query(
        `insert into returns.judgment_inputs (id, return_id, cell_id, value, author, reason)
         values ($1, $2, 'T2S8.CCA.CLASS10', '4200', $3, 'Half-year rule applied to the new van (Test)')`,
        [tid('judgment'), r, actor],
      )
    },
  },
]

async function expectRefusedNamingColumn(c: Column, p: Promise<unknown>, what: string): Promise<void> {
  const r = await refusalOf(p)
  expect(r, `${c.table}.${c.column} accepted ${what}`).toBeDefined()
  expect(r?.code, `${c.table}.${c.column} refused ${what} for the wrong reason: ${r?.code ?? ''} ${r?.text ?? ''}`).toMatch(/^23/)
  expect(r?.text, `${c.table}.${c.column}: the refusal of ${what} names the table`).toContain(c.table)
  expect(r?.text, `${c.table}.${c.column}: the refusal of ${what} names the column`).toContain(c.column)
}
async function expectAccepted(c: Column, p: Promise<unknown>, what: string): Promise<void> {
  const r = await refusalOf(p)
  expect(r, `${c.table}.${c.column} refused ${what}: ${r?.code ?? ''} ${r?.text ?? ''}`).toBeUndefined()
}

async function systemActors(db: PGlite): Promise<{ name: string; reason: string }[]> {
  return (await db.query<{ name: string; reason: string }>('select id as name, reason from returns.system_actors order by id')).rows
}

describe('SEC-7 the reviewed list of system actors is data with a reason per name', () => {
  test('SEC-7 returns.system_actors holds at least one name, each with a reason of more than 10 characters', async () => {
    const list = await systemActors(await cloneTestDb())
    expect(list.length).toBeGreaterThan(0)
    for (const { name, reason } of list) {
      expect(name.trim(), 'a system actor name is not blank').not.toBe('')
      expect(name, 'a system actor name has no padding').toBe(name.trim())
      expect(reason.trim().length, `${name}: the reason says why this actor writes records`).toBeGreaterThan(10)
    }
  })
  test('SEC-1 no system actor name is also a staff user id in the test world (one name, one kind of actor)', async () => {
    const names = (await systemActors(await world())).map((r) => r.name)
    expect(names.filter((n) => TEST_IDS.includes(n))).toEqual([])
  })
})

describe('SEC-1 SEC-7 each actor column accepts a staff user id or a listed system actor', () => {
  test.each(COLUMNS)('SEC-1 the test world loads: every test user id is accepted as $name', async (c) => {
    const db = await world()
    expect(TEST_IDS.length).toBeGreaterThan(0)
    for (const id of TEST_IDS) await expectAccepted(c, c.insert(db, id), `test user ${id}`)
  })
  test.each(COLUMNS)('SEC-7 every name on the reviewed system actor list is accepted as $name', async (c) => {
    const db = await world()
    const names = (await systemActors(db)).map((r) => r.name)
    expect(names.length).toBeGreaterThan(0)
    for (const n of names) await expectAccepted(c, c.insert(db, n), `system actor ${n}`)
  })
  test.each(COLUMNS)('SEC-1 a staff user added after the schema is accepted as $name (the key follows staff_users)', async (c) => {
    const db = await world()
    await db.query(`insert into returns.staff_users (id, display_name, roles) values ('late-joiner-1', 'Lee Late (Test)', '{preparer}')`)
    await expectAccepted(c, c.insert(db, 'late-joiner-1'), 'a staff user added later')
  })
})

describe('SEC-1 SEC-7 planted: each actor column refuses anyone who is neither, naming the column', () => {
  const PLANTED: readonly (readonly [string, string])[] = [
    ['an unknown id', 'nobody-9 (Test)'],
    ['a blank', ''],
    ['a whitespace-only value', ' \t'],
    ['a system name not on the list', 'system (Test)'],
    ['another unlisted system name', 'system:unlisted-robot (Test)'],
    ['a staff display name instead of the id', PREPARER_NAME],
    ['a staff id with padding', ` ${PREPARER}`],
    ['a staff id in another case', PREPARER.toUpperCase()],
  ]
  for (const c of COLUMNS) {
    test.each(PLANTED)(`SEC-1 ${c.table}.${c.column} refuses %s, naming the column`, async (_what, value) => {
      const db = await world()
      await expectRefusedNamingColumn(c, c.insert(db, value), JSON.stringify(value))
    })
  }
  test.each(COLUMNS)('SEC-7 $name refuses a listed system actor name with padding or in another case', async (c) => {
    const db = await world()
    const first = (await systemActors(db))[0]?.name ?? ''
    expect(first).not.toBe('')
    for (const v of [`${first} `, first.toUpperCase() === first ? first.toLowerCase() : first.toUpperCase()]) {
      if (v === first) continue
      await expectRefusedNamingColumn(c, c.insert(db, v), JSON.stringify(v))
    }
  })
  test.each(COLUMNS)('SEC-1 $name refuses a staff id before the user exists and accepts it after (control)', async (c) => {
    const db = await world()
    await expectRefusedNamingColumn(c, c.insert(db, 'joiner-2'), 'joiner-2 before it exists')
    await db.query(`insert into returns.staff_users (id, display_name, roles) values ('joiner-2', 'Jo Joiner (Test)', '{ops}')`)
    await expectAccepted(c, c.insert(db, 'joiner-2'), 'joiner-2 after it exists')
  })
  test('SEC-1 a refused actor writes no row in any of the five tables', async () => {
    const db = await world()
    const before = await counts(db)
    for (const c of COLUMNS) await refusalOf(c.insert(db, 'nobody-9 (Test)'))
    const after = await counts(db)
    for (const c of COLUMNS) expect(after[c.table], c.table).toBe(before[c.table])
  })
})

async function counts(db: PGlite): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const c of COLUMNS) {
    out[c.table] = (await db.query<{ n: number }>(`select count(*)::int as n from returns.${c.table}`)).rows[0]?.n ?? -1
  }
  return out
}

describe('SEC-1 ARC-13 property: an actor value is accepted exactly when it is a staff id or a listed system name', () => {
  test('SEC-1 ARC-13 property (seed 20261017): a made-up id is refused in every column until it is a staff user, then accepted', async () => {
    const db = await world()
    const listed = new Set((await systemActors(db)).map((r) => r.name))
    let i = 0
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim() !== '' && !s.includes('\u0000')),
        fc.integer({ min: 0, max: COLUMNS.length - 1 }),
        async (raw, k) => {
          const id = `${raw}-${String(++i)} (Test)`
          if (listed.has(id) || TEST_IDS.includes(id)) return
          const c = COLUMNS[k]
          if (!c) throw new Error('column index out of range')
          await expectRefusedNamingColumn(c, c.insert(db, id), JSON.stringify(id))
          await db.query(`insert into returns.staff_users (id, display_name, roles) values ($1, 'Pat Property (Test)', '{preparer}')`, [id])
          await expectAccepted(c, c.insert(db, id), JSON.stringify(id))
        },
      ),
      { seed: 20261017, numRuns: 40 },
    )
  })
})

// ---------- A458 (card "Also"): sign_in_events.reason takes only the fixed sentences the auth engine writes ----------
// The sentences are not copied here from the engine (A426): every path of the stand-in is driven, each must still
// write its row (a refused insert would make the call throw), and the sentences it wrote are the accepted set.
const SIGN_IN_START = new Date('2026-10-02T10:00:05-04:00').getTime()

async function signInWorld(): Promise<{ db: PGlite; auth: Awaited<ReturnType<typeof createAuth>> }> {
  const db = await cloneTestDb()
  const auth = await createAuth({ db, env: { NODE_ENV: 'test' }, clock: { now: () => new Date(SIGN_IN_START) } })
  return { db, auth }
}

/** Drives every path of the stand-in once; returns the sentences written, one row per path. */
async function everySignInSentence(): Promise<{ db: PGlite; reasons: string[] }> {
  const { db, auth } = await signInWorld()
  const [a, b, c] = TEST_IDS
  if (!a || !b || !c) throw new Error('the test world has fewer than three users')
  const cred = (id: string): ReturnType<typeof testCredentials> => testCredentials(id)
  const now = (): Date => new Date(SIGN_IN_START)
  // signed in, then the same code again (code reused)
  const s1 = await auth.startSignIn(a, cred(a).password)
  if (!s1.ok) throw new Error('control sign-in refused')
  expect((await auth.finishSignIn(s1.challenge, cred(a).codeAt(now()))).ok).toBe(true)
  const s2 = await auth.startSignIn(a, cred(a).password)
  if (s2.ok) await auth.finishSignIn(s2.challenge, cred(a).codeAt(now()))
  // wrong code
  const s3 = await auth.startSignIn(b, cred(b).password)
  if (s3.ok) await auth.finishSignIn(s3.challenge, cred(b).codeAt(new Date(SIGN_IN_START + 10 * 60_000)))
  // wrong password five times, then locked
  for (let i = 0; i < 5; i++) await auth.startSignIn(c, 'not the password (Test)')
  await auth.startSignIn(c, cred(c).password)
  // unknown user, bad challenge, not a test user
  await auth.startSignIn('nobody-9', 'whatever (Test)')
  await auth.finishSignIn('no-such-challenge', '000000')
  await db.query(`insert into returns.staff_users (id, display_name, roles) values ('real-person', 'Jordan Real', '{preparer}')`)
  await auth.startSignIn('real-person', cred('real-person').password)
  const reasons = (await db.query<{ reason: string }>('select distinct reason from returns.sign_in_events order by reason')).rows.map((r) => r.reason)
  return { db, reasons }
}

describe('SEC-1 SEC-7 sign_in_events.reason takes only the fixed sentences of the auth engine (A458)', () => {
  test('SEC-1 every path of the stand-in still writes its sign-in event: eight paths, eight distinct sentences', async () => {
    const { reasons } = await everySignInSentence()
    expect(reasons).toHaveLength(8)
  })
  test('SEC-7 planted: a free-text reason, and each written sentence padded or recased, is refused naming sign_in_events.reason', async () => {
    const { db, reasons } = await everySignInSentence()
    const user = TEST_IDS[0] ?? ''
    const planted = ['Typed by someone (Test)', ...reasons.flatMap((r) => [`${r} `, r.toUpperCase()])]
    for (const reason of planted) {
      const r = await refusalOf(
        db.query(`insert into returns.sign_in_events (id, user_id, outcome, reason) values ($1, $2, 'refused', $3)`, [tid('sign-in'), user, reason]),
      )
      expect(r, `sign_in_events.reason accepted ${JSON.stringify(reason)}`).toBeDefined()
      expect(r?.code, `refused ${JSON.stringify(reason)} for the wrong reason: ${r?.text ?? ''}`).toMatch(/^23/)
      expect(r?.text).toContain('sign_in_events')
      expect(r?.text).toContain('reason')
    }
  })
  test('SEC-7 control: each written sentence is accepted again on a direct insert', async () => {
    const { db, reasons } = await everySignInSentence()
    for (const reason of reasons) {
      const r = await refusalOf(
        db.query(`insert into returns.sign_in_events (id, user_id, outcome, reason) values ($1, $2, 'refused', $3)`, [tid('sign-in'), TEST_IDS[0], reason]),
      )
      expect(r, `sign_in_events.reason refused ${reason}: ${r?.text ?? ''}`).toBeUndefined()
    }
  })
})
