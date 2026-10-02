// The testusers engine: made-up users, scrypt-checked passwords, six-digit one-time codes, server-side
// sessions (SEC-1, SEC-6, SEC-7, SEC-10, SEC-11). Lock-out and used codes are read from the event log.
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { RoleSchema, SessionSchema, SIGN_IN_FAILED, type AuthAdapter, type Refusal, type Session } from '../../../contracts/auth'
import type { Clock } from '../../../core/clock'
import { makeLogger } from '../../../core/log'
import { stepOf, totpAtStep } from '../totp'
import { credentialsFor, derivedPassword, TEST_USERS } from './credentials'

const MIN = 60_000
const IDLE_MS = 30 * MIN
const MAX_MS = 12 * 60 * MIN
const LOCK_MS = 15 * MIN
const CHALLENGE_MS = 5 * MIN
const FAILURES_TO_LOCK = 5
const FAILED: Refusal = { ok: false, refusal: SIGN_IN_FAILED }

type Reason = 'wrong password' | 'wrong code' | 'code reused' | 'locked' | 'not a test user' | 'unknown user' | 'bad challenge'
const COUNTED: readonly string[] = ['wrong password', 'wrong code', 'code reused']

interface UserRow {
  id: string
  display_name: string
  roles: string[]
}
interface SessionRow {
  id: string
  user_id: string
  signed_in_at: Date
  last_seen_at: Date
  expires_at: Date
  roles: string[]
}
interface EventRow {
  outcome: string
  reason: string
  created_at: Date
  code_step: string | null
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

// The expected scrypt hash of each user's derived password, made once.
const SALT_NOTE = 'ashbridge-returns-scrypt-salt'
const scrypt = (password: string, userId: string): Buffer => scryptSync(password, `${SALT_NOTE}:${userId}`, 32)
const expectedHashes = new Map<string, Buffer>()
function passwordMatches(userId: string, given: string): boolean {
  let expected = expectedHashes.get(userId)
  if (!expected) {
    expected = scrypt(derivedPassword(userId), userId)
    expectedHashes.set(userId, expected)
  }
  return timingSafeEqual(expected, scrypt(given, userId))
}

/** When the user is locked until, from their events in order, or undefined when not locked at `at`. */
function lockedUntil(events: readonly EventRow[], at: Date): Date | undefined {
  let count = 0
  let until: Date | undefined
  for (const e of events) {
    if (e.outcome === 'success') {
      count = 0
      until = undefined
    } else if (COUNTED.includes(e.reason)) {
      if (until && e.created_at >= until) {
        count = 0
        until = undefined
      }
      count += 1
      if (count === FAILURES_TO_LOCK) until = new Date(e.created_at.getTime() + LOCK_MS)
    }
  }
  return until && at < until ? until : undefined
}

export interface TestUsersOptions {
  db: PGlite
  clock: Clock
  sink?: (line: string) => void
}

export async function createTestUsersAuth(opts: TestUsersOptions): Promise<AuthAdapter> {
  const { db, clock } = opts
  const log = makeLogger(opts.sink)
  const challenges = new Map<string, { userId: string; expiresAt: number }>()

  for (const u of TEST_USERS) {
    await db.query('insert into returns.staff_users (id, display_name, roles) values ($1, $2, $3) on conflict (id) do nothing', [u.id, u.displayName, u.roles])
  }

  async function record(userId: string | null, outcome: 'success' | 'refused', reason: string, codeStep?: number): Promise<void> {
    await db.query('insert into returns.sign_in_events (id, user_id, outcome, reason, created_at, code_step) values ($1, $2, $3, $4, $5, $6)', [
      randomUUID(),
      userId,
      outcome,
      reason,
      clock.now(),
      codeStep ?? null,
    ])
    if (outcome === 'success') log.info('sign-in', { userId, outcome, reason })
    else log.warn('sign-in', { userId, outcome, reason })
  }

  async function refuse(userId: string | null, reason: Reason): Promise<Refusal> {
    await record(userId, 'refused', reason)
    return FAILED
  }

  const eventsOf = async (userId: string): Promise<EventRow[]> =>
    (await db.query<EventRow>('select outcome, reason, created_at, code_step from returns.sign_in_events where user_id = $1 order by seq', [userId])).rows

  const isLocked = async (userId: string): Promise<boolean> => lockedUntil(await eventsOf(userId), clock.now()) !== undefined

  async function sessionFor(token: string, touch: boolean): Promise<Session | null> {
    const hash = sha256(token)
    const found = await db.query<SessionRow>(
      `select s.id, s.user_id, s.signed_in_at, s.last_seen_at, s.expires_at, u.roles
       from returns.staff_sessions s join returns.staff_users u on u.id = s.user_id where s.token_hash = $1`,
      [hash],
    )
    const row = found.rows[0]
    const at = clock.now()
    if (!row || at >= row.expires_at) return null
    let lastSeen = row.last_seen_at
    let expires = row.expires_at
    if (touch) {
      lastSeen = at
      expires = new Date(Math.min(at.getTime() + IDLE_MS, row.signed_in_at.getTime() + MAX_MS))
      await db.query('update returns.staff_sessions set last_seen_at = $1, expires_at = $2 where id = $3', [lastSeen, expires, row.id])
    }
    return SessionSchema.parse({
      sessionId: row.id,
      userId: row.user_id,
      roles: row.roles.map((r) => RoleSchema.parse(r)),
      signedInAt: row.signed_in_at,
      lastSeenAt: lastSeen,
      expiresAt: expires,
    })
  }

  return {
    isLive: false,

    async startSignIn(userId, password) {
      const user = (await db.query<UserRow>('select id, display_name, roles from returns.staff_users where id = $1', [userId])).rows[0]
      if (!user) return refuse(userId.slice(0, 64), 'unknown user')
      if (await isLocked(user.id)) return refuse(user.id, 'locked')
      // SEC-11: while go-live is off, only made-up users sign in.
      if (!user.display_name.includes('(Test)')) return refuse(user.id, 'not a test user')
      if (!passwordMatches(user.id, password)) return refuse(user.id, 'wrong password')
      const now = clock.now().getTime()
      for (const [c, v] of challenges) if (v.expiresAt <= now) challenges.delete(c)
      const challenge = randomBytes(32).toString('base64url')
      challenges.set(challenge, { userId: user.id, expiresAt: now + CHALLENGE_MS })
      return { ok: true, challenge }
    },

    async finishSignIn(challenge, code) {
      const pending = challenges.get(challenge)
      challenges.delete(challenge)
      const at = clock.now()
      if (!pending || pending.expiresAt <= at.getTime()) return refuse(null, 'bad challenge')
      const userId = pending.userId
      if (await isLocked(userId)) return refuse(userId, 'locked')
      const secret = credentialsFor(userId).secret
      const now = stepOf(at)
      const matching = [now - 1, now, now + 1].filter((s) => totpAtStep(secret, s) === code)
      if (matching.length === 0) return refuse(userId, 'wrong code')
      const used = new Set((await eventsOf(userId)).filter((e) => e.code_step !== null).map((e) => Number(e.code_step)))
      const step = matching.find((s) => !used.has(s))
      if (step === undefined) return refuse(userId, 'code reused')
      const token = randomBytes(32).toString('hex')
      const expires = new Date(at.getTime() + IDLE_MS)
      await db.query(
        'insert into returns.staff_sessions (id, user_id, token_hash, signed_in_at, last_seen_at, expires_at) values ($1, $2, $3, $4, $4, $5)',
        [randomUUID(), userId, sha256(token), at, expires],
      )
      await record(userId, 'success', 'signed in', step)
      const session = await sessionFor(token, false)
      if (!session) throw new Error('session was not stored')
      return { ok: true, token, session }
    },

    getSession: (token) => sessionFor(token, false),
    touch: (token) => sessionFor(token, true),

    async signOut(token) {
      await db.query('delete from returns.staff_sessions where token_hash = $1', [sha256(token)])
    },
  }
}
