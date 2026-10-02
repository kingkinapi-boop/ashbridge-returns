// RT-5: the client_ref, ASH- and four digits from 0001 (more digits after 9999). Never built from client data.
const PREFIX = 'ASH-'

export function formatClientRef(n: number): string {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`a client_ref number is a whole number from 1, not ${String(n)}`)
  return PREFIX + String(n).padStart(4, '0')
}

/** The number in a client_ref, or null when the text is not exactly what formatClientRef writes. */
export function parseClientRef(ref: string): number | null {
  const m = /^ASH-(\d{4,})$/.exec(ref)
  if (m === null || m[1] === undefined) return null
  const n = Number(m[1])
  if (!Number.isSafeInteger(n) || n < 1 || formatClientRef(n) !== ref) return null
  return n
}
