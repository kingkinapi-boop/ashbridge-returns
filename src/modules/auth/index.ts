// The auth module's public exports (ARC-6). The test credentials are in testing.ts and are not exported here.
import type { PGlite } from '@electric-sql/pglite'
import type { AuthAdapter } from '../../contracts/auth'
import { getClock, type Clock } from '../../core/clock'
import { readSettings } from '../../core/env'
import { createLiveAuth } from './live'
import { createTestUsersAuth } from './testusers/engine'

export interface AuthOptions {
  db: PGlite
  env?: Record<string, string | undefined>
  clock?: Clock
  sink?: (line: string) => void
}

/** The engine comes from AUTH_ENGINE read by name (unset means testusers outside production; in production it must be set); live is off and refuses. */
export async function createAuth(opts: AuthOptions): Promise<AuthAdapter> {
  const settings = readSettings(opts.env ?? process.env)
  if (settings.NODE_ENV === 'production' && settings.AUTH_ENGINE === undefined) {
    throw new Error('AUTH_ENGINE must be set in production')
  }
  const engine = settings.AUTH_ENGINE ?? 'testusers'
  if (engine === 'live') return createLiveAuth()
  return createTestUsersAuth({ db: opts.db, clock: opts.clock ?? getClock(), ...(opts.sink ? { sink: opts.sink } : {}) })
}
