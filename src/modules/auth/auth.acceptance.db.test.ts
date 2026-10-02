// A06 acceptance tests: staff sign-in stand-in, sessions and roles on PGlite (SEC-1, SEC-6, SEC-7, SEC-10,
// SEC-11, ARC-6, ARC-20, END-8). Written by the spec-writer; builders never edit this file.
//
// The public shape these tests fix (src/modules/auth/index.ts and src/contracts/auth.ts):
// - `createAuth({ db, env?, clock?, sink? }): Promise<AuthAdapter>`. `db` is a PGlite. `env` defaults to process.env,
//   `clock` to the injected clock (src/core/clock.ts), `sink` receives one JSON log line per call (core/log.ts).
//   It reads AUTH_ENGINE by name through readSettings (unset = testusers). Engine `live` makes createAuth reject with
//   "live sign-in is off until go-live"; an unknown value rejects naming AUTH_ENGINE. The testusers engine seeds the
//   nine made-up users into returns.staff_users (idempotent: calling createAuth again adds none).
// - AuthAdapter (all async except isLive):
//     startSignIn(userId, password) -> { ok: true, challenge: string } | { ok: false, refusal: 'sign-in failed' }
//     finishSignIn(challenge, code) -> { ok: true, token: string, session: Session } | { ok: false, refusal: 'sign-in failed' }
//     getSession(token) -> Session | null      touch(token) -> Session | null (null when gone)     signOut(token) -> void
//     isLive: boolean (false for testusers)
//   A refusal is exactly `{ ok: false, refusal: 'sign-in failed' }` whatever the real reason.
// - Tables (schema returns, the schema folder, file 15_auth.sql), each with id text primary key, created_at, is_test default true:
//     staff_users(id, display_name, roles text[]); a row needs only those three to insert.
//     staff_sessions: holds the sha256 (hex) of the token string and no token; free to add columns.
//     sign_in_events(user_id, outcome 'success' | 'refused', reason): append-only; created_at is the injected clock.
//   Event reasons tested: 'signed in', 'wrong password', 'wrong code', 'code reused', 'locked', 'not a test user'.
// - Times: a session is valid for 30 minutes idle and 12 hours in all; touch moves lastSeenAt and expiresAt
//   (expiresAt = the earlier of lastSeenAt + 30 min and signedInAt + 12 h). Five failed attempts (wrong password or
//   wrong code) lock the user until 15 minutes after the fifth.
// - A one-time code is valid for its own 30-second step and one step either side; each step's code is accepted once per user.
import crypto from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import type { Clock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import { createAuth } from './index'
import { listTestUsers, testCredentials } from './testing'
import { totp } from './totp'

const START = new Date('2026-10-02T10:00:05-04:00').getTime()
const STEP = 30_000
const MIN = 60_000
const HOUR = 60 * MIN
const FAILED = { ok: false, refusal: 'sign-in failed' }

type Env = Record<string, string | undefined>
type Auth = Awaited<ReturnType<typeof createAuth>>
type Row = Record<string, unknown>

interface World {
  db: PGlite
  auth: Auth
  lines: string[]
  at: (ms: number) => void
  now: () => number
}

async function world(env: Env = {}): Promise<World> {
  const db = await cloneTestDb()
  let t = START
  const clock: Clock = { now: () => new Date(t) }
  const lines: string[] = []
  const auth = await createAuth({ db, env, clock, sink: (l) => lines.push(l) })
  return { db, auth, lines, at: (ms) => { t = ms }, now: () => t }
}

const userWith = (...roles: string[]): string => {
  const u = listTestUsers().find((x) => [...x.roles].sort().join() === [...roles].sort().join())
  if (!u) throw new Error(`no test user with ${roles.join(',')}`)
  return u.id
}

/** Full sign-in with the right password and the code for the clock's step (or the given overrides). */
async function signIn(w: World, id: string, over: { password?: string; code?: string; codeAt?: number } = {}) {
  const c = testCredentials(id)
  const s = await w.auth.startSignIn(id, over.password ?? c.password)
  if (!s.ok) return s
  return w.auth.finishSignIn(s.challenge, over.code ?? c.codeAt(new Date(over.codeAt ?? w.now())))
}

async function rows(db: PGlite, table: string): Promise<Row[]> {
  return (await db.query<Row>(`select * from returns.${table}`)).rows
}
const events = (db: PGlite): Promise<Row[]> => rows(db, 'sign_in_events')
const refusals = async (db: PGlite): Promise<Row[]> => (await events(db)).filter((e) => e['outcome'] === 'refused')
const sha256 = (s: string): string => crypto.createHash('sha256').update(s).digest('hex')
const roles = (s: { roles: readonly string[] }): string[] => [...s.roles].sort()

async function refusalOf(p: Promise<unknown>): Promise<{ code: string; message: string } | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    const err = e as { code?: string; message?: string }
    return { code: err.code ?? '', message: err.message ?? '' }
  }
}

describe('A06 sign-in with two factors (SEC-1)', () => {
  test('SEC-1 the right password then the right code gives a session with exactly the user roles', async () => {
    const w = await world()
    for (const u of listTestUsers()) {
      const r = await signIn(w, u.id)
      expect(r.ok, u.id).toBe(true)
      if (r.ok) {
        expect(roles(r.session), u.id).toEqual([...u.roles].sort())
        expect(r.session.userId).toBe(u.id)
        expect(r.session.signedInAt.getTime()).toBe(w.now())
      }
      w.at(w.now() + 5 * MIN)
    }
  })

  test('SEC-1 the dual-role user session lists cpa and owner', async () => {
    const w = await world()
    const r = await signIn(w, userWith('cpa', 'owner'))
    expect(r.ok && roles(r.session)).toEqual(['cpa', 'owner'])
  })

  test('SEC-1 the session found by its token has the same roles and user', async () => {
    const w = await world()
    const id = userWith('ops')
    const r = await signIn(w, id)
    if (!r.ok) throw new Error('sign-in failed')
    const got = await w.auth.getSession(r.token)
    expect(got?.userId).toBe(id)
    expect(got && roles(got)).toEqual(['ops'])
    expect(r.token).toMatch(/^[0-9a-f]{64}$|^[A-Za-z0-9_-]{43}$/)
  })

  test('SEC-1 two sign-ins never share a token or a session id', async () => {
    const w = await world()
    const a = await signIn(w, userWith('preparer'))
    w.at(w.now() + 2 * STEP)
    const b = await signIn(w, userWith('preparer'))
    if (!a.ok || !b.ok) throw new Error('sign-in failed')
    expect(a.token).not.toBe(b.token)
    expect(a.session.sessionId).not.toBe(b.session.sessionId)
  })

  test('SEC-1 a code one step either side is accepted (one step of drift)', async () => {
    for (const drift of [-1, 1]) {
      const w = await world()
      const r = await signIn(w, userWith('cpa'), { codeAt: w.now() + drift * STEP })
      expect(r.ok, `drift ${String(drift)}`).toBe(true)
    }
  })

  test('SEC-1 a wrong password is refused with "sign-in failed" and the true reason in the event', async () => {
    const w = await world()
    const id = userWith('preparer')
    const r = await signIn(w, id, { password: 'PLANTED-wrong-password-9' })
    expect(r).toEqual(FAILED)
    const ref = await refusals(w.db)
    expect(ref).toHaveLength(1)
    expect(ref[0]?.['user_id']).toBe(id)
    expect(ref[0]?.['reason']).toBe('wrong password')
  })

  test('SEC-1 a wrong code is refused with "sign-in failed" and the true reason in the event', async () => {
    const w = await world()
    const id = userWith('ops')
    const good = testCredentials(id).codeAt(new Date(w.now()))
    const wrong = good === '000000' ? '000001' : '000000'
    expect(await signIn(w, id, { code: wrong })).toEqual(FAILED)
    const ref = await refusals(w.db)
    expect(ref).toHaveLength(1)
    expect(ref[0]?.['reason']).toBe('wrong code')
  })

  test('SEC-1 a code from three steps ago is refused as a wrong code', async () => {
    const w = await world()
    expect(await signIn(w, userWith('cpa'), { codeAt: w.now() - 3 * STEP })).toEqual(FAILED)
    expect((await refusals(w.db))[0]?.['reason']).toBe('wrong code')
  })

  test('SEC-1 a code two steps away, either way, is refused (drift is one step)', async () => {
    for (const drift of [-2, 2]) {
      const w = await world()
      expect(await signIn(w, userWith('owner'), { codeAt: w.now() + drift * STEP }), `drift ${String(drift)}`).toEqual(FAILED)
    }
  })

  test('SEC-1 a code used twice is refused the second time, as a reused code', async () => {
    const w = await world()
    const id = userWith('preparer')
    expect((await signIn(w, id)).ok).toBe(true)
    expect(await signIn(w, id)).toEqual(FAILED)
    const ref = await refusals(w.db)
    expect(ref).toHaveLength(1)
    expect(ref[0]?.['reason']).toBe('code reused')
  })

  test('SEC-1 a code used in its own step is still refused in the next step, where drift would allow it', async () => {
    const w = await world()
    const id = userWith('preparer')
    const used = w.now()
    expect((await signIn(w, id)).ok).toBe(true)
    w.at(w.now() + STEP)
    expect(await signIn(w, id, { codeAt: used })).toEqual(FAILED)
    expect((await refusals(w.db))[0]?.['reason']).toBe('code reused')
  })

  test('SEC-1 a garbage challenge and an unknown user are refused the same way', async () => {
    const w = await world()
    expect(await w.auth.finishSignIn('not-a-challenge', '123456')).toEqual(FAILED)
    expect(await w.auth.startSignIn('nobody-here', 'whatever')).toEqual(FAILED)
  })

  test('SEC-1 the caller never learns which part was wrong: every refusal object is identical', async () => {
    const w = await world()
    const id = userWith('ops')
    const a = await signIn(w, id, { password: 'PLANTED-wrong-password-9' })
    const b = await signIn(w, id, { code: '999999' })
    const c = await w.auth.startSignIn('nobody-here', 'x')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(b)).toBe(JSON.stringify(c))
    expect(JSON.stringify(a)).toBe(JSON.stringify(FAILED))
  })

  test('SEC-1 a success writes a "signed in" event with the injected clock time', async () => {
    const w = await world()
    const id = userWith('cpa')
    await signIn(w, id)
    const ok = (await events(w.db)).filter((e) => e['outcome'] === 'success')
    expect(ok).toHaveLength(1)
    expect(ok[0]?.['user_id']).toBe(id)
    expect(ok[0]?.['reason']).toBe('signed in')
    expect(new Date(ok[0]?.['created_at'] as string | Date).getTime()).toBe(w.now())
  })
})

describe('A06 lockout (SEC-1)', () => {
  const failFive = async (w: World, id: string): Promise<void> => {
    for (let i = 0; i < 5; i++) expect(await signIn(w, id, { password: `PLANTED-wrong-${String(i)}` })).toEqual(FAILED)
  }

  test('SEC-1 four failed attempts do not lock: the fifth attempt, if right, signs in', async () => {
    const w = await world()
    const id = userWith('preparer')
    for (let i = 0; i < 4; i++) await signIn(w, id, { password: `PLANTED-wrong-${String(i)}` })
    expect((await signIn(w, id)).ok).toBe(true)
  })

  test('SEC-1 five failed attempts lock the user: a sixth with the right password and code is refused as locked', async () => {
    const w = await world()
    const id = userWith('preparer')
    await failFive(w, id)
    expect(await signIn(w, id)).toEqual(FAILED)
    const last = (await refusals(w.db)).filter((e) => e['reason'] === 'locked')
    expect(last.length).toBeGreaterThanOrEqual(1)
  })

  test('SEC-1 a mix of wrong passwords and wrong codes counts toward the five', async () => {
    const w = await world()
    const id = userWith('ops')
    for (let i = 0; i < 3; i++) await signIn(w, id, { password: `PLANTED-wrong-${String(i)}` })
    for (let i = 0; i < 2; i++) await signIn(w, id, { code: '000000' === testCredentials(id).codeAt(new Date(w.now())) ? '000001' : '000000' })
    expect(await signIn(w, id)).toEqual(FAILED)
  })

  test('SEC-1 still locked 14 minutes 59 seconds after the fifth failure', async () => {
    const w = await world()
    const id = userWith('preparer')
    await failFive(w, id)
    w.at(w.now() + 15 * MIN - 1000)
    expect(await signIn(w, id)).toEqual(FAILED)
  })

  test('SEC-1 15 minutes after the fifth failure the right password and code work again', async () => {
    const w = await world()
    const id = userWith('preparer')
    await failFive(w, id)
    w.at(w.now() + 15 * MIN)
    expect((await signIn(w, id)).ok).toBe(true)
  })

  test('SEC-1 the lock is per user: another user signs in while one is locked', async () => {
    const w = await world()
    await failFive(w, userWith('preparer'))
    expect((await signIn(w, userWith('ops'))).ok).toBe(true)
  })
})

describe('A06 sessions (SEC-1)', () => {
  async function session(w: World) {
    const r = await signIn(w, userWith('cpa'))
    if (!r.ok) throw new Error('sign-in failed')
    return r
  }

  test('SEC-1 valid at 29 minutes idle, gone at 31', async () => {
    const w = await world()
    const { token } = await session(w)
    const t0 = w.now()
    w.at(t0 + 29 * MIN)
    expect(await w.auth.getSession(token)).not.toBeNull()
    w.at(t0 + 31 * MIN)
    expect(await w.auth.getSession(token)).toBeNull()
  })

  test('SEC-1 a session gone for idleness stays gone: touch does not bring it back', async () => {
    const w = await world()
    const { token } = await session(w)
    w.at(w.now() + 31 * MIN)
    expect(await w.auth.touch(token)).toBeNull()
    expect(await w.auth.getSession(token)).toBeNull()
  })

  test('SEC-1 touch extends: valid 29 minutes after a touch made at 20 minutes', async () => {
    const w = await world()
    const { token, session: s } = await session(w)
    const t0 = w.now()
    w.at(t0 + 20 * MIN)
    const touched = await w.auth.touch(token)
    expect(touched?.lastSeenAt.getTime()).toBe(t0 + 20 * MIN)
    expect(touched?.expiresAt.getTime()).toBe(t0 + 50 * MIN)
    expect(touched?.signedInAt.getTime()).toBe(s.signedInAt.getTime())
    w.at(t0 + 49 * MIN)
    expect(await w.auth.getSession(token)).not.toBeNull()
    w.at(t0 + 51 * MIN)
    expect(await w.auth.getSession(token)).toBeNull()
  })

  test('SEC-1 nothing survives 12 hours, however often it is touched', async () => {
    const w = await world()
    const { token } = await session(w)
    const t0 = w.now()
    for (let m = 25; m <= 11 * 60 + 50; m += 25) {
      w.at(t0 + m * MIN)
      expect(await w.auth.touch(token), `touch at ${String(m)} min`).not.toBeNull()
    }
    w.at(t0 + 11 * HOUR + 55 * MIN)
    const last = await w.auth.touch(token)
    expect(last?.expiresAt.getTime()).toBe(t0 + 12 * HOUR)
    w.at(t0 + 12 * HOUR + MIN)
    expect(await w.auth.getSession(token)).toBeNull()
    expect(await w.auth.touch(token)).toBeNull()
  })

  test('SEC-1 signOut ends the session at once', async () => {
    const w = await world()
    const { token } = await session(w)
    await w.auth.signOut(token)
    expect(await w.auth.getSession(token)).toBeNull()
    expect(await w.auth.touch(token)).toBeNull()
  })

  test('SEC-1 signing out one session leaves another of the same user alone', async () => {
    const w = await world()
    const a = await session(w)
    w.at(w.now() + 2 * STEP)
    const b = await session(w)
    await w.auth.signOut(a.token)
    expect(await w.auth.getSession(b.token)).not.toBeNull()
  })

  test('SEC-1 an unknown token finds nothing and signing it out does not throw', async () => {
    const w = await world()
    expect(await w.auth.getSession('0'.repeat(64))).toBeNull()
    expect(await w.auth.touch('0'.repeat(64))).toBeNull()
    await expect(w.auth.signOut('0'.repeat(64))).resolves.not.toThrow()
  })
})

describe('A06 the database holds only valid roles (SEC-1)', () => {
  const insert = (db: PGlite, id: string, name: string, rolesLiteral: string): Promise<unknown> =>
    db.query(`insert into returns.staff_users (id, display_name, roles) values ($1, $2, ${rolesLiteral})`, [id, name])

  test('SEC-1 a user row with any other role is refused by the database', async () => {
    const w = await world()
    for (const bad of ["'{auditor}'", "'{preparer,auditor}'", "'{Preparer}'", "'{}'", 'null']) {
      const r = await refusalOf(insert(w.db, `bad-${String(bad.length)}`, 'Bad Role (Test)', bad))
      expect(r, bad).toBeDefined()
      expect(r?.code, `${bad}: ${r?.message ?? ''}`).toMatch(/^23(514|502)$/)
    }
  })

  test('SEC-1 a user row with each good role set is accepted, including cpa and owner together', async () => {
    const w = await world()
    for (const [i, ok] of ["'{preparer}'", "'{ops}'", "'{cpa}'", "'{owner}'", "'{cpa,owner}'"].entries()) {
      expect(await refusalOf(insert(w.db, `ok-${String(i)}`, 'Good Role (Test)', ok)), ok).toBeUndefined()
    }
  })

  test('SEC-1 a blank display name or id is refused by the database', async () => {
    const w = await world()
    expect((await refusalOf(insert(w.db, 'blank-name', '​  ', "'{ops}'")))?.code).toBe('23514')
    expect((await refusalOf(insert(w.db, '​', 'Blank Id (Test)', "'{ops}'")))?.code).toBe('23514')
  })

  test('SEC-1 the nine made-up users are in the database, and a second createAuth adds none', async () => {
    const w = await world()
    expect(await rows(w.db, 'staff_users')).toHaveLength(9)
    await createAuth({ db: w.db, env: {}, clock: { now: () => new Date(w.now()) } })
    expect(await rows(w.db, 'staff_users')).toHaveLength(9)
  })
})

describe('A06 no secret kept or logged (SEC-10)', () => {
  test('SEC-10 the sessions table holds the hash of each token and no column equal to any issued token', async () => {
    const w = await world()
    const tokens: string[] = []
    for (const role of ['preparer', 'ops', 'cpa']) {
      const r = await signIn(w, userWith(role))
      if (!r.ok) throw new Error('sign-in failed')
      tokens.push(r.token)
    }
    const all = await rows(w.db, 'staff_sessions')
    expect(all).toHaveLength(3)
    for (const row of all) for (const [k, v] of Object.entries(row)) for (const t of tokens) expect(String(v), `column ${k}`).not.toBe(t)
    const values = new Set(all.flatMap((r) => Object.values(r).map(String)))
    for (const t of tokens) expect(values.has(sha256(t)), 'the sha256 of the token is stored').toBe(true)
  })

  test('SEC-10 no log line, event, user or session row holds a password, code, secret or token (planted-value scan)', async () => {
    const w = await world()
    const id = userWith('ops')
    const c = testCredentials(id)
    const planted = 'PLANTED-wrong-password-9'
    const code = c.codeAt(new Date(w.now()))
    const wrongCode = code === '000000' ? '000001' : '000000'
    await signIn(w, id, { password: planted })
    await signIn(w, id, { code: wrongCode })
    const ok = await signIn(w, id)
    if (!ok.ok) throw new Error('sign-in failed')
    const start = await w.auth.startSignIn(id, c.password)
    expect(start.ok).toBe(true)
    await w.auth.signOut(ok.token)
    const secretHex = Buffer.from(c.secret).toString('hex')
    const secretB64 = Buffer.from(c.secret).toString('base64')
    const blob = [
      ...w.lines,
      JSON.stringify(await events(w.db)),
      JSON.stringify(await rows(w.db, 'staff_users')),
      JSON.stringify(await rows(w.db, 'staff_sessions')),
    ].join('\n')
    expect(w.lines.length, 'every sign-in outcome is logged').toBeGreaterThanOrEqual(3)
    expect(w.lines.join('\n')).toContain(id)
    for (const secret of [c.password, planted, ok.token, secretHex, secretB64]) expect(blob, secret.slice(0, 6)).not.toContain(secret)
    for (const digits of [code, wrongCode]) expect(blob).not.toMatch(new RegExp(`(?<![0-9])${digits}(?![0-9])`))
    if (start.ok) expect(blob).not.toContain(start.challenge)
  })

  test('SEC-10 a refusal object holds neither the password nor the code that was sent', async () => {
    const w = await world()
    const r = await signIn(w, userWith('ops'), { password: 'PLANTED-wrong-password-9' })
    expect(JSON.stringify(r)).not.toContain('PLANTED-wrong-password-9')
  })
})

describe('A06 engine switch (ARC-6, ARC-20, END-8)', () => {
  const OFF = /live sign-in is off until go-live/

  test('ARC-6 the engine is testusers by default and by name, and neither is live', async () => {
    for (const env of [{}, { AUTH_ENGINE: 'testusers' }, { AUTH_ENGINE: '' }]) {
      const w = await world(env)
      expect(w.auth.isLive, JSON.stringify(env)).toBe(false)
      expect((await signIn(w, userWith('preparer'))).ok).toBe(true)
    }
  })

  test('ARC-20 AUTH_ENGINE=live is refused with "live sign-in is off until go-live"', async () => {
    const db = await cloneTestDb()
    const r = await refusalOf(createAuth({ db, env: { AUTH_ENGINE: 'live' } }))
    expect(r?.message).toMatch(OFF)
  })

  test('END-8 live holds no key: a planted key in the settings is never printed, in the refusal or the log', async () => {
    const db = await cloneTestDb()
    const lines: string[] = []
    const planted = 'PLANTED-live-key-4d2e'
    const r = await refusalOf(createAuth({ db, env: { AUTH_ENGINE: 'live', AUTH_LIVE_KEY: planted }, sink: (l) => lines.push(l) }))
    expect(r?.message).toMatch(OFF)
    expect(`${r?.message ?? ''}\n${lines.join('\n')}`).not.toContain(planted)
  })

  test('ARC-6 an unknown engine is refused naming AUTH_ENGINE, never its value', async () => {
    const db = await cloneTestDb()
    const r = await refusalOf(createAuth({ db, env: { AUTH_ENGINE: 'PLANTED-engine-77' } }))
    expect(r?.message).toMatch(/AUTH_ENGINE/)
    expect(r?.message).not.toContain('PLANTED-engine-77')
  })

  test('ARC-6 both directions: testusers, then live refused, then testusers again signs in', async () => {
    const w = await world({ AUTH_ENGINE: 'testusers' })
    expect((await signIn(w, userWith('ops'))).ok).toBe(true)
    expect((await refusalOf(createAuth({ db: w.db, env: { AUTH_ENGINE: 'live' } })))?.message).toMatch(OFF)
    const again = await createAuth({ db: w.db, env: {}, clock: { now: () => new Date(w.now() + 5 * MIN) } })
    expect(again.isLive).toBe(false)
    const c = testCredentials(userWith('owner'))
    const s = await again.startSignIn(userWith('owner'), c.password)
    expect(s.ok).toBe(true)
    if (s.ok) expect((await again.finishSignIn(s.challenge, totp(c.secret, new Date(w.now() + 5 * MIN)))).ok).toBe(true)
  })

  test('ARC-20 the live engine takes no sign-in even when the settings ask for it: nothing is written', async () => {
    const db = await cloneTestDb()
    await refusalOf(createAuth({ db, env: { AUTH_ENGINE: 'live' } }))
    expect((await db.query('select count(*)::int as n from returns.sign_in_events')).rows).toEqual([{ n: 0 }])
  })
})

describe('A06 go-live is off: only made-up users (SEC-11)', () => {
  test('SEC-11 a user without "(Test)" in the name cannot sign in, even with the derived password and code', async () => {
    const w = await world()
    await w.db.query(`insert into returns.staff_users (id, display_name, roles) values ('real-person', 'Jordan Real', '{preparer}')`)
    expect(await signIn(w, 'real-person')).toEqual(FAILED)
    const ref = await refusals(w.db)
    expect(ref).toHaveLength(1)
    expect(ref[0]?.['user_id']).toBe('real-person')
    expect(ref[0]?.['reason']).toBe('not a test user')
  })

  test('SEC-11 the same row named "(Test)" signs in, so the name is what decided', async () => {
    const w = await world()
    await w.db.query(`insert into returns.staff_users (id, display_name, roles) values ('extra-person', 'Jordan Extra (Test)', '{preparer}')`)
    expect((await signIn(w, 'extra-person')).ok).toBe(true)
  })

  test('SEC-11 "(Test)" must be in the name: a look-alike without the brackets is refused', async () => {
    const w = await world()
    await w.db.query(`insert into returns.staff_users (id, display_name, roles) values ('lookalike', 'Jordan Test', '{ops}')`)
    expect(await signIn(w, 'lookalike')).toEqual(FAILED)
  })
})

describe('A06 events are append-only and the tables are closed (SEC-6, SEC-7)', () => {
  const TABLES = ['staff_users', 'staff_sessions', 'sign_in_events']

  async function populated(): Promise<World> {
    const w = await world()
    await signIn(w, userWith('cpa'))
    await signIn(w, userWith('ops'), { password: 'PLANTED-wrong-password-9' })
    return w
  }

  test('SEC-7 sign-in events refuse update, delete and truncate', async () => {
    const w = await populated()
    expect(await events(w.db)).not.toHaveLength(0)
    for (const sql of [`update returns.sign_in_events set reason = 'edited'`, 'delete from returns.sign_in_events', 'truncate returns.sign_in_events']) {
      const r = await refusalOf(w.db.exec(sql))
      expect(r, sql).toBeDefined()
      expect(r?.message, sql).toMatch(/append-only/)
    }
    expect((await events(w.db)).every((e) => e['reason'] !== 'edited')).toBe(true)
  })

  test('SEC-6 row-level security is on for the three tables, with no policies', async () => {
    const w = await world()
    const r = await w.db.query<{ t: string; rls: boolean }>(
      `select c.relname as t, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'returns' and c.relname = any($1)`,
      [TABLES],
    )
    expect(r.rows.map((x) => x.t).sort()).toEqual([...TABLES].sort())
    expect(r.rows.filter((x) => !x.rls)).toEqual([])
    const p = await w.db.query<{ n: number }>(`select count(*)::int as n from pg_policies where schemaname = 'returns' and tablename = any($1)`, [TABLES])
    expect(p.rows[0]?.n).toBe(0)
  })

  test('SEC-6 the three tables are marked is_test and default to true', async () => {
    const w = await populated()
    for (const t of TABLES) {
      const all = await rows(w.db, t)
      expect(all.length, t).toBeGreaterThan(0)
      expect(all.every((r) => r['is_test'] === true), t).toBe(true)
    }
  })

  test('SEC-6 a role granted SELECT (the public key) and a role with no grants both read zero rows from each table', async () => {
    const w = await populated()
    for (const t of TABLES) expect((await rows(w.db, t)).length, `${t} has rows for the owner`).toBeGreaterThan(0)
    await w.db.exec(`create role anon_auth_test nologin;
      grant usage on schema returns to anon_auth_test;
      grant select on all tables in schema returns to anon_auth_test;
      create role nobody_auth_test nologin;`)
    for (const role of ['anon_auth_test', 'nobody_auth_test']) {
      await w.db.exec(`set role ${role}`)
      try {
        for (const t of TABLES) {
          const r = await refusalOf(w.db.query(`select * from returns.${t}`))
          if (r) expect(r.code, `${role} ${t}: ${r.message}`).toBe('42501')
          else expect((await w.db.query(`select * from returns.${t}`)).rows, `${role} ${t} leaked rows`).toHaveLength(0)
        }
      } finally {
        await w.db.exec('reset role')
      }
    }
  })
})
