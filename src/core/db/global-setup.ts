// Global setup of the vitest `db` project (ARC-4): boots PGlite once and loads the schema, so a
// bad schema fails the run at once, and prints the boot time so growth is visible.
// With TEST_DB=pg16 (DB16) it refuses a live database before it connects, creates a fresh template
// database on the local Postgres 16 cluster for the run, and drops it, with every clone, at the end.
import { createTemplate, testDbTarget } from './index'

export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  const t0 = performance.now()
  const target = testDbTarget(process.env)
  const template = await createTemplate()
  const name = template.pg16?.name
  if (target.kind === 'pg16' && name !== undefined) {
    process.env['DB16_TEMPLATE'] = name
    console.log(`db warm-up: Postgres 16 schema loaded in ${String(Math.round(performance.now() - t0))} ms`)
    return async () => {
      delete process.env['DB16_TEMPLATE']
      await template.pg16?.drop()
      await template.close()
    }
  }
  await template.close()
  console.log(`db warm-up: schema booted in ${String(Math.round(performance.now() - t0))} ms`)
  return undefined
}
