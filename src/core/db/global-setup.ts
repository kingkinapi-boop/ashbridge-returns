// Global setup of the vitest `db` project (ARC-4): boots the template once and loads the schema, so a
// bad schema fails the run at once, and prints the boot time so growth is visible. With TEST_DB=pg16 it
// refuses a live database before it connects (DB16) and drops this run's databases at the end.
import { createTemplate, dropRunDatabases, pg16RunId, testDbTarget } from './index'

export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  const target = testDbTarget(process.env)
  if (target.kind === 'pg16') pg16RunId()
  const t0 = performance.now()
  const template = await createTemplate()
  await template.close()
  console.log(`db warm-up: schema booted in ${String(Math.round(performance.now() - t0))} ms`)
  if (target.kind !== 'pg16') return undefined
  return () => dropRunDatabases(target.url)
}
