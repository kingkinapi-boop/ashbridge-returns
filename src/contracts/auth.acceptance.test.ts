// A06 acceptance tests: the auth contract and the AUTH_ENGINE setting (SEC-1, ARC-6, END-8, SEC-10).
// Written by the spec-writer; builders never edit this file.
//
// The public shape these tests fix (src/contracts/auth.ts):
// - `ROLES` (the four roles), `RoleSchema`, `StaffUserSchema` ({ id, displayName, roles }), `SessionSchema`
//   ({ sessionId, userId, roles, signedInAt, lastSeenAt, expiresAt }, the three times are Date).
// - `AuthAdapter` (type only): startSignIn, finishSignIn, getSession, touch, signOut, isLive (see the db test file).
// - src/core/env.ts: `AUTH_ENGINE` is an optional setting, 'testusers' or 'live'. Unset stays undefined in
//   readSettings (so F00T's exact-equality tests keep passing); the auth module treats unset as testusers.
import { describe, expect, test } from 'vitest'
import { readSettings } from '../core/env'
import { ROLES, RoleSchema, SessionSchema, StaffUserSchema } from './auth'

const T = new Date('2026-10-02T10:00:00-04:00')

describe('A06 contract: roles (SEC-1)', () => {
  test('SEC-1 ROLES is exactly preparer, ops, cpa, owner', () => {
    expect([...ROLES].sort()).toEqual(['cpa', 'ops', 'owner', 'preparer'])
  })

  test('SEC-1 RoleSchema accepts each of the four roles', () => {
    for (const r of ['preparer', 'ops', 'cpa', 'owner']) expect(RoleSchema.safeParse(r).success, r).toBe(true)
  })

  test('SEC-1 RoleSchema refuses any other value, including near misses', () => {
    for (const r of ['admin', 'Preparer', 'CPA', ' cpa', 'cpa ', 'reviewer', 'client', '', 'cpa,owner', null, 1, undefined]) {
      expect(RoleSchema.safeParse(r).success, String(r)).toBe(false)
    }
  })
})

describe('A06 contract: users and sessions (SEC-1)', () => {
  const user = { id: 'u-1', displayName: 'Pat Preparer (Test)', roles: ['preparer'] }

  test('SEC-1 a staff user with one role and one with cpa and owner are accepted', () => {
    expect(StaffUserSchema.safeParse(user).success).toBe(true)
    expect(StaffUserSchema.safeParse({ ...user, roles: ['cpa', 'owner'] }).success).toBe(true)
  })

  test('SEC-1 a staff user needs at least one role and only known roles', () => {
    expect(StaffUserSchema.safeParse({ ...user, roles: [] }).success).toBe(false)
    expect(StaffUserSchema.safeParse({ ...user, roles: ['preparer', 'admin'] }).success).toBe(false)
  })

  test('SEC-1 a staff user needs a non-blank id and display name', () => {
    expect(StaffUserSchema.safeParse({ ...user, id: '' }).success).toBe(false)
    expect(StaffUserSchema.safeParse({ ...user, displayName: '​  ' }).success).toBe(false)
  })

  test('SEC-1 a session carries its roles and its three times', () => {
    const s = { sessionId: 's-1', userId: 'u-1', roles: ['cpa', 'owner'], signedInAt: T, lastSeenAt: T, expiresAt: T }
    expect(SessionSchema.safeParse(s).success).toBe(true)
    expect(SessionSchema.safeParse({ ...s, roles: ['superuser'] }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...s, expiresAt: undefined }).success).toBe(false)
  })
})

describe('A06 AUTH_ENGINE is read by name through env.ts (ARC-6, END-8, SEC-10)', () => {
  test('ARC-6 AUTH_ENGINE reads back testusers and live, and unset stays undefined', () => {
    expect(readSettings({ AUTH_ENGINE: 'testusers' }).AUTH_ENGINE).toBe('testusers')
    expect(readSettings({ AUTH_ENGINE: 'live' }).AUTH_ENGINE).toBe('live')
    expect(readSettings({}).AUTH_ENGINE).toBeUndefined()
  })

  test('SEC-10 a bad AUTH_ENGINE is refused by name and its value is never printed', () => {
    const planted = 'PLANTED-engine-value-77 (Test)'
    expect(() => readSettings({ AUTH_ENGINE: planted })).toThrow(new Error('Invalid settings: AUTH_ENGINE'))
  })

  test('END-8 no setting holds a key: a planted live key is dropped and nothing named key, secret or token is read', () => {
    const planted = 'PLANTED-live-key-4d2e'
    const read = readSettings({ AUTH_ENGINE: 'live', AUTH_LIVE_KEY: planted, AUTH_SECRET: planted })
    expect(JSON.stringify(read)).not.toContain(planted)
    for (const k of Object.keys(read)) expect(k, k).not.toMatch(/key|secret|token|password/i)
  })
})
