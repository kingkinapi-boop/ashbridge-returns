// PLANT (SC11 round 3, spec-owned, A508): src/core/db/global-setup.ts exactly as SC11's round 2 build left it (git show
// 030e1d6f:src/core/db/global-setup.ts), the version whose cleanup sequences stop at their first failure or let a later
// failure replace an earlier one (RC1, R118). Only import paths edited so it can live here (./index is now ../index). Scanned as
// text only (pool-rules.acceptance.test.ts), never imported, never edited. The lint line below stands in for
// eslint.config.mjs's no-console exemption of the real global-setup.ts.
/* eslint-disable no-console */
// Global setup of the vitest `db` project (ARC-4): boots the template once and loads the schema, so a
// bad schema fails the run at once, and prints the boot time so growth is visible. With TEST_DB=pg16 it
// refuses a live database before it connects (DB16), mints this run's id (an inherited DB16_RUN_ID is never
// reused), and at the end drops this run's databases, then fails naming any role the run left (R91).
import { createTemplate, dropRunDatabases, leftoverRoles, listRoles, mintPg16RunId, testDbTarget } from '../index'

export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  const target = testDbTarget(process.env)
  const rolesAtSetup = target.kind === 'pg16' ? await listRoles(target.url) : []
  if (target.kind === 'pg16') mintPg16RunId()
  const t0 = performance.now()
  const template = await createTemplate()
  await template.close()
  console.log(`db warm-up: schema booted in ${String(Math.round(performance.now() - t0))} ms`)
  if (target.kind !== 'pg16') return undefined
  return async () => {
    await dropRunDatabases(target.url)
    const left = leftoverRoles(rolesAtSetup, await listRoles(target.url))
    if (left.length > 0) throw new Error(`the run left roles behind: ${left.join(', ')}`)
  }
}
