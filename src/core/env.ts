// @mutate
// Settings are read by name through zod and never printed (SEC-10).
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // ARC-6: which staff sign-in engine; unset or blank means the made-up users. No key is ever read (END-8).
  AUTH_ENGINE: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['testusers', 'live']).optional()),
  // ARC-22: the folder the Claude project exchange uses. Blank is as unset as missing; the AI runner checks that (a throw here would break every caller).
  AI_EXCHANGE_DIR: z.string().optional(),
})

export type Settings = z.infer<typeof schema>

export function readSettings(source: Record<string, string | undefined> = process.env): Settings {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    // Name the settings that failed, never their values.
    const names = parsed.error.issues.map((i) => String(i.path[0])).join(', ')
    throw new Error(`Invalid settings: ${names}`)
  }
  return parsed.data
}
