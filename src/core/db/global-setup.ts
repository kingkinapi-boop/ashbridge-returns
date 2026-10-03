// Global setup of the vitest `db` project (ARC-4): boots the template once and loads the schema, so a
// bad schema fails the run at once, and prints the boot time so growth is visible. With TEST_DB=pg16 it
// refuses a live database before it connects (DB16), mints this run's id (an inherited DB16_RUN_ID is never
// reused), and at the end drops this run's databases, then fails naming any role the run left (R91).
import { createTemplate, dropRunDatabases, leftoverRoles, listRoles, mintPg16RunId, testDbTarget } from './index'

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
