// Global setup of the vitest `db` project (ARC-4): boots PGlite once and loads the schema, so a
// bad schema fails the run at once, and prints the boot time so growth is visible.
import { createTemplate } from './index'

export default async function setup(): Promise<void> {
  const t0 = performance.now()
  const template = await createTemplate()
  await template.close()
  console.log(`db warm-up: schema booted in ${String(Math.round(performance.now() - t0))} ms`)
}
