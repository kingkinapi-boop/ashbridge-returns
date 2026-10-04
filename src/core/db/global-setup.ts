// Global setup of the vitest `db` project (ARC-4): boots the template once and loads the schema, so a
// bad schema fails the run at once, and prints the boot time so growth is visible. With TEST_DB=pg16 it
// refuses a live database before it connects (DB16), mints this run's id (an inherited DB16_RUN_ID is never
// reused), and at the end drops this run's databases, then fails naming any role the run left (R91).
import {
  createTemplate,
  DROP_RUN_STEP_MS,
  dropRunDatabases,
  leftoverRoles,
  listRoles,
  mintPg16RunId,
  settleAll,
  TEARDOWN_BOUNDS_MS,
  testDbTarget,
} from './index'

interface TeardownDeps {
  dropRunDatabases(url: string): Promise<void>
  listRoles(url: string): Promise<string[]>
}

/** SC11 S10: the teardown runs both steps whatever the first one does, so the role check (R91) is never skipped. */
export function makeTeardown(deps: TeardownDeps, url: string, rolesAtSetup: string[]): () => Promise<void> {
  return async () => {
    const left: string[] = []
    // The role check runs first (R91 is a security net: a hung drop never starves it); every bound is a named constant inside
    // 0.8 of vitest's teardownTimeout (S18).
    await settleAll('db teardown', [
      {
        name: 'role check',
        boundMs: TEARDOWN_BOUNDS_MS.roleCheck,
        run: () =>
          deps.listRoles(url).then((after) => {
            left.push(...leftoverRoles(rolesAtSetup, after))
            if (left.length > 0) throw new Error(`the run left roles behind: ${left.join(', ')}`)
          }),
      },
      { name: 'dropRunDatabases', boundMs: DROP_RUN_STEP_MS, run: () => deps.dropRunDatabases(url) },
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
