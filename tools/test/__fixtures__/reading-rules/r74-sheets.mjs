// SC4 R74 adapter (spec-writer): the A07 spreadsheet reader on the range-walk cases, run inside r74-worker.mjs.
//  - running-balance-20k: a ledger of 20,000 amounts in column A and a running balance B<r> = SUM($A$1:A<r>).
//  - whole-sheet-range: A1 = SUM(A2:XFD1048576) over three amounts.
//  - whole-sheet-merge: three amounts and one merge over B2:XFD1048576.
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { xlsx } from './xlsx.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const url = (rel) => pathToFileURL(path.join(ROOT, ...rel.split('/'))).href

const centsText = (c) => {
  const a = c < 0 ? -c : c
  return `${c < 0 ? '-' : ''}${String(Math.floor(a / 100))}.${String(a % 100).padStart(2, '0')}`
}

export const CASES = {
  'running-balance-20k': () => {
    const cells = []
    let balance = 0
    for (let r = 1; r <= 20_000; r++) {
      const amount = centsText(((r * 7919) % 200_001) - 100_000)
      balance += Number(amount)
      cells.push({ ref: `A${String(r)}`, v: amount }, { ref: `B${String(r)}`, f: `SUM($A$1:A${String(r)})`, v: String(balance) })
    }
    return xlsx({ cells })
  },
  'whole-sheet-range': () =>
    xlsx({
      cells: [
        { ref: 'A1', f: 'SUM(A2:XFD1048576)', v: '6.6' },
        { ref: 'A2', v: '1.1' },
        { ref: 'A3', v: '2.2' },
        { ref: 'A4', v: '3.3' },
      ],
    }),
  'whole-sheet-merge': () =>
    xlsx({
      cells: [
        { ref: 'A1', v: '1.1' },
        { ref: 'A2', v: '2.2' },
        { ref: 'B2', v: '3.3' },
      ],
      merges: ['B2:XFD1048576'],
    }),
}

// Loaded before the worker says it is ready, so module loading is not counted in the budget.
const { setClock, fixedClock } = await import(url('src/core/clock.ts'))
const { createSheetsReader } = await import(url('src/modules/sheets/index.ts'))
setClock(fixedClock('2026-10-03T09:00:00-04:00'))

/** Reads one case through the sheets module's public reader; the outcome says whether it read or refused, never how long. */
export async function run(caseName) {
  const out = await createSheetsReader().read(CASES[caseName](), `${caseName} (Test).xlsx`)
  return out.ok ? { ok: true, cells: out.result.sheets.reduce((n, s) => n + s.cells.length, 0) } : { ok: false, reason: out.reason }
}
