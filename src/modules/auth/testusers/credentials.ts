// The stand-in's made-up users and their credentials. Each password and one-time code seed is derived
// at run time from the user id and a fixed public string, so nothing secret-looking is committed.
import { createHash } from 'node:crypto'
import type { Role } from '../../../contracts/auth'
import { totp } from '../totp'

const PUBLIC_STRING = 'ashbridge-returns-made-up-users'

export interface TestUser {
  id: string
  displayName: string
  roles: Role[]
}

export const TEST_USERS: readonly TestUser[] = [
  { id: 'preparer-1', displayName: 'Pat Preparer (Test)', roles: ['preparer'] },
  { id: 'preparer-2', displayName: 'Pia Preparer (Test)', roles: ['preparer'] },
  { id: 'ops-1', displayName: 'Omar Ops (Test)', roles: ['ops'] },
  { id: 'ops-2', displayName: 'Olga Ops (Test)', roles: ['ops'] },
  { id: 'cpa-1', displayName: 'Cleo Cpa (Test)', roles: ['cpa'] },
  { id: 'cpa-2', displayName: 'Cal Cpa (Test)', roles: ['cpa'] },
  { id: 'owner-1', displayName: 'Olive Owner (Test)', roles: ['owner'] },
  { id: 'owner-2', displayName: 'Owen Owner (Test)', roles: ['owner'] },
  { id: 'cpa-owner-1', displayName: 'Zia Cpa Owner (Test)', roles: ['cpa', 'owner'] },
]

const derive = (kind: string, userId: string): Buffer =>
  createHash('sha256').update(`${kind}:${userId}:${PUBLIC_STRING}`).digest()

export function derivedPassword(userId: string): string {
  return derive('password', userId).toString('base64url').slice(0, 20)
}

export function derivedSecret(userId: string): Uint8Array {
  return new Uint8Array(derive('one-time', userId).subarray(0, 20))
}

export function credentialsFor(userId: string): { password: string; secret: Uint8Array; codeAt(at: Date): string } {
  const secret = derivedSecret(userId)
  return { password: derivedPassword(userId), secret, codeAt: (at) => totp(secret, at) }
}
