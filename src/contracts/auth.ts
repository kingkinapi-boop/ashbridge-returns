// Staff sign-in contract (SEC-1, ARC-6): the four roles, a staff user, a session and the adapter
// interface every screen and module takes as a parameter. Who sees which return is V00's (SEC-2).
import { z } from 'zod'
import { NonBlankSchema } from './text'

export const ROLES = ['preparer', 'ops', 'cpa', 'owner'] as const
export const RoleSchema = z.enum(ROLES)
export type Role = z.infer<typeof RoleSchema>

export const StaffUserSchema = z.object({
  id: NonBlankSchema,
  displayName: NonBlankSchema,
  roles: z.array(RoleSchema).min(1),
})
export type StaffUser = z.infer<typeof StaffUserSchema>

export const SessionSchema = z.object({
  sessionId: NonBlankSchema,
  userId: NonBlankSchema,
  roles: z.array(RoleSchema).min(1),
  signedInAt: z.date(),
  lastSeenAt: z.date(),
  expiresAt: z.date(),
})
export type Session = z.infer<typeof SessionSchema>

/** Whatever went wrong, the caller sees only this (SEC-1); the true reason goes to the event log. */
export const SIGN_IN_FAILED = 'sign-in failed'
export type Refusal = { ok: false; refusal: typeof SIGN_IN_FAILED }

export interface AuthAdapter {
  startSignIn(userId: string, password: string): Promise<{ ok: true; challenge: string } | Refusal>
  finishSignIn(challenge: string, code: string): Promise<{ ok: true; token: string; session: Session } | Refusal>
  getSession(token: string): Promise<Session | null>
  touch(token: string): Promise<Session | null>
  signOut(token: string): Promise<void>
  readonly isLive: boolean
}
