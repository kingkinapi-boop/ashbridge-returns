// Shared path and settings checks for both storage adapters (ARC-6, SEC-10).
import fs from 'node:fs'
import path from 'node:path'
import { readSettings } from '../../core/env'
import { makeLogger, type Sink } from '../../core/log'

export const LIVE_OFF = 'live storage is off until go-live'

/** Why a key, file id or prefix is unsafe, or null when it is fine. */
export function unsafeReason(value: string): string | null {
  if (value.includes('\0')) return 'it holds a null character'
  if (value.includes('\\')) return 'it holds a backslash'
  if (value.startsWith('/')) return 'it is an absolute path'
  if (/^[A-Za-z]:/.test(value)) return 'it starts with a drive letter'
  if (value.split('/').includes('..')) return 'it holds a ".." segment'
  return null
}

export function refuse(what: string, value: string): Error {
  const reason = unsafeReason(value)
  return new Error(`refused: ${what} is not allowed (${reason ?? 'unsafe'})`)
}

/** Throws a "refused" error when the value is unsafe. */
export function assertSafe(what: string, value: string): void {
  if (unsafeReason(value) !== null) throw refuse(what, value)
}

/** True when `target` (already real) sits inside `root` (already real). */
export function inside(root: string, target: string): boolean {
  return target.startsWith(root + path.sep)
}

/** The real path of `p` when it sits inside the real root, otherwise a "refused" error. */
export function realInside(root: string, p: string, what: string): string {
  const realRoot = fs.realpathSync(root)
  const real = fs.realpathSync(p)
  if (!inside(realRoot, real)) throw new Error(`refused: ${what} resolves outside the storage root`)
  return real
}

export type Engine = 'local' | 'live'

/** Reads one engine setting by name. The value is never printed, only the setting name. */
export function readEngine(env: Record<string, string | undefined> | undefined, name: string, sink?: Sink): Engine {
  const settings: Record<string, string | undefined> = readSettings(env)
  const value = settings[name]
  if (settings['NODE_ENV'] === 'production' && value === undefined) throw new Error(`${name} must be set in production`)
  if (sink) makeLogger(sink).info('storage setting read', { setting: name })
  if (value === undefined || value === '' || value === 'local') return 'local'
  if (value === 'live') throw new Error(`${LIVE_OFF} (${name})`)
  throw new Error(`${name} must be local or live`)
}
