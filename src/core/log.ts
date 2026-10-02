// @mutate
// A logger that redacts the restricted personal-data kinds and credentials (SEC-5, SEC-10).
// Keys are matched on whole word parts, never by a guessed regex over spellings; GL account
// codes and business numbers stay visible.
const SIN_PATTERN = /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g
const SIN_ONE = /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/
const MAX_DEPTH = 20

export const REDACTED = '[redacted]'
export const CIRCULAR = '[circular]'

/** Restricted kinds of onboarding-contract section 3 plus credentials, as space-separated word parts. */
export const SENSITIVE_KINDS: readonly string[] = [
  'sin',
  'social insurance',
  'date of birth',
  'dob',
  'birth date',
  'bank transit',
  'transit number',
  'bank institution',
  'institution number',
  'bank account',
  'account number',
  'ontario company key',
  'password',
  'token',
  'access token',
  'refresh token',
  'token hash',
  'code hash',
  'secret',
  'api key',
  'authorization',
]

/** Splits a key into lower-case word parts: camel, pascal, acronym runs, snake, kebab, spaces. */
function wordParts(key: string): string[] {
  const camel = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  // Stryker disable next-line Regex: equivalent. With one capital in place of a run, the space still goes before the last capital of the run ("APIKey" gives "API Key" both ways).
  const spaced = camel.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  // Stryker disable next-line Regex: equivalent while the filter below stays. Without the +, a run of separators leaves empty parts and the filter drops them.
  const split = spaced.split(/[^A-Za-z0-9]+/)
  // Stryker disable next-line MethodExpression,ConditionalExpression,StringLiteral: equivalent. An empty part at an end of the key cannot change a whole-word match, so the filter only tidies (A329: it stays).
  const parts = split.filter((p) => p !== '')
  return parts.map((p) => p.toLowerCase())
}

const KIND_PARTS: readonly (readonly string[])[] = SENSITIVE_KINDS.map((k) => k.split(' '))

function hasRun(parts: readonly string[], run: readonly string[]): boolean {
  // Parts never hold a space, so a space either side makes the match whole word parts only.
  return ` ${parts.join(' ')} `.includes(` ${run.join(' ')} `)
}

function isSensitiveKey(key: string): boolean {
  const parts = wordParts(key)
  return KIND_PARTS.some((run) => hasRun(parts, run))
}

function redactValue(value: unknown, depth: number, ancestors: ReadonlySet<object>): unknown {
  if (typeof value === 'string') return value.replace(SIN_PATTERN, REDACTED)
  if (typeof value === 'number') return SIN_ONE.test(String(value)) ? REDACTED : value
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return REDACTED
  if (ancestors.has(value)) return CIRCULAR
  const next = new Set(ancestors).add(value)
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1, next))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = isSensitiveKey(k) ? REDACTED : redactValue(v, depth + 1, next)
  return out
}

export function redact(value: unknown): unknown {
  return redactValue(value, 0, new Set())
}

export type Sink = (line: string) => void

export function makeLogger(sink: Sink = (line) => process.stdout.write(line + '\n')) {
  const write = (level: string, message: string, fields?: Record<string, unknown>) => {
    sink(JSON.stringify({ level, message: redact(message), ...(fields ? { fields: redact(fields) } : {}) }))
  }
  return {
    info: (m: string, f?: Record<string, unknown>) => { write('info', m, f) },
    warn: (m: string, f?: Record<string, unknown>) => { write('warn', m, f) },
    error: (m: string, f?: Record<string, unknown>) => { write('error', m, f) },
  }
}
