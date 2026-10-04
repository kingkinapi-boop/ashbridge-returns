// PLANT (SC11 round 4, spec-owned, A540): src/core/db/global-setup.ts exactly as SC11's round 3 build left it (git show
// 71b621d7:src/core/db/global-setup.ts): the teardown drops before the role check and bounds the drop with a number
// literal, 8000, against vitest's 10 s teardownTimeout (RC-C, R119). Only the import path edited (./index is now
// ./index-71b621d7). Scanned as text only (pool-rules.acceptance.test.ts), never imported by a test, never edited.
// The lint line below stands in for eslint.config.mjs's no-console exemption of the real global-setup.ts.
/* eslint-disable no-console */
// Global setup of the vitest `db` project (ARC-4): boots the template once and loads the schema, so a
// bad schema fails the run at once, and prints the boot time so growth is visible. With TEST_DB=pg16 it
// refuses a live database before it connects (DB16), mints this run's id (an inherited DB16_RUN_ID is never
// reused), and at the end drops this run's databases, then fails naming any role the run left (R91).
import { createTemplate, dropRunDatabases, leftoverRoles, listRoles, mintPg16RunId, settleAll, testDbTarget } from './index-71b621d7'

interface TeardownDeps {
  dropRunDatabases(url: string): Promise<void>
  listRoles(url: string): Promise<string[]>
}

/** SC11 S10: the teardown runs both steps whatever the first one does, so the role check (R91) is never skipped. */
export function makeTeardown(deps: TeardownDeps, url: string, rolesAtSetup: string[]): () => Promise<void> {
  return async () => {
    const left: string[] = []
    await settleAll('db teardown', [
      { name: 'dropRunDatabases', run: () => deps.dropRunDatabases(url), boundMs: 8000 },
      {
        name: 'role check',
        run: () =>
          deps.listRoles(url).then((after) => {
            left.push(...leftoverRoles(rolesAtSetup, after))
            if (left.length > 0) throw new Error(`the run left roles behind: ${left.join(', ')}`)
          }),
      },
    ])
  }
}

export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  const target = testDbTarget(process.env)
  const rolesAtSetup = target.kind === 'pg16' ? await listRoles(target.url) : []
  if (target.kind === 'pg16') mintPg16RunId()
  const t0 = performance.now()
  const template = await createTemplate()
  await template.close()
  console.log(`db warm-up: schema booted in ${String(Math.round(performance.now() - t0))} ms`)
  if (target.kind !== 'pg16') return undefined
  return makeTeardown({ dropRunDatabases, listRoles }, target.url, rolesAtSetup)
}
