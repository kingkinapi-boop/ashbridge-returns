// END-1: the year end of a return is the last day of the confirmed year-end month in the tax year.
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function returnYearEnd(fiscalYearEnd: string, taxYear: number): string {
  const m = DATE.exec(fiscalYearEnd)
  if (m === null) throw new Error(`not a calendar date: ${fiscalYearEnd}`)
  const [y, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const real = new Date(Date.UTC(y, month - 1, day))
  if (real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) throw new Error(`not a calendar date: ${fiscalYearEnd}`)
  if (!Number.isInteger(taxYear)) throw new Error(`not a tax year: ${String(taxYear)}`)
  const last = new Date(Date.UTC(taxYear, month, 0)).getUTCDate()
  return `${String(taxYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}
