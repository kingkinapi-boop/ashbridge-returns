// @mutate
// Due dates (FLOW-7, FLOW-12). Source: CRA T4012, "Filing deadline" and "Balance-due day".
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function lastDay(y: number, m0: number): number {
  if (m0 === 1) return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28
  return [3, 5, 8, 10].includes(m0) ? 30 : 31
}

function iso(y: number, m0: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addMonths(y: number, m0: number, k: number): { y: number; m0: number } {
  const t = y * 12 + m0 + k
  return { y: Math.floor(t / 12), m0: t % 12 }
}

/**
 * Filing: the same day of the sixth month after year end, or that month's last day when the year
 * end is a month end. Balance due: two months after (three for a CCPC meeting CRA's conditions),
 * counted as the Interpretation Act s. 28 does (amber, reports/F02-spec.md).
 */
export function dueDates(yearEnd: string, opts: { ccpcConditionsMet: boolean }): { filing: string; balance: string } {
  const m = ISO.exec(yearEnd)
  if (!m) throw new Error(`year end must be YYYY-MM-DD: ${JSON.stringify(yearEnd)}`)
  const y = Number(m[1])
  const m0 = Number(m[2]) - 1
  const d = Number(m[3])
  if (m0 < 0 || m0 > 11 || d < 1 || d > lastDay(y, m0)) throw new Error(`not a calendar date: ${yearEnd}`)
  const f = addMonths(y, m0, 6)
  const fd = d === lastDay(y, m0) ? lastDay(f.y, f.m0) : Math.min(d, lastDay(f.y, f.m0))
  const b = addMonths(y, m0, opts.ccpcConditionsMet ? 3 : 2)
  return { filing: iso(f.y, f.m0, fd), balance: iso(b.y, b.m0, Math.min(d, lastDay(b.y, b.m0))) }
}
