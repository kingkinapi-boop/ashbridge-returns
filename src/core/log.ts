// A logger that redacts SIN, date-of-birth and account-number fields (SEC-5).
const SENSITIVE_KEY = /(^|_|-)(sin|dob|birth|birthdate|date_?of_?birth|account|accountnumber|account_?no)(_|-|$)|^sin$|^dob$|accountnumber|dateofbirth/i
const SIN_PATTERN = /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g

export const REDACTED = '[redacted]'

export function redact(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SIN_PATTERN, REDACTED)
  if (Array.isArray(value)) return value.map(redact)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v)
    return out
  }
  return value
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
