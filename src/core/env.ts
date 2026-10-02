// @mutate
// Settings are read by name through zod and never printed (SEC-10).
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Settings = z.infer<typeof schema>

export function readSettings(source: Record<string, string | undefined> = process.env): Settings {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    // Name the settings that failed, never their values.
    // Stryker disable next-line StringLiteral: NODE_ENV is the only setting, so one issue and no separator is ever printed; killable when a second setting arrives.
    const names = parsed.error.issues.map((i) => String(i.path[0])).join(', ')
    throw new Error(`Invalid settings: ${names}`)
  }
  return parsed.data
}
