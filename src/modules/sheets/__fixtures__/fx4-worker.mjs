// FX4 time-budget harness (spec-writer): runs one job inside a worker thread, so a walk that never ends is stopped at its
// budget instead of hanging the suite (the walk is synchronous, so a test timeout alone could not stop it). Two jobs:
//   read: the bytes through the sheets module's public reader (createSheetsReader), giving every cell's text and merge;
//   snap: snapSums from src/modules/sheets/xlsx/index.ts over cells built in memory, giving its visits, its skipped list
//         and every cell's text after the snap (work counts decide those tests; the budget only stops a hang).
// Product modules are TypeScript with extensionless imports: these hooks add the ".ts" the import leaves out and strip
// the types with Node's own stripper (as tools/test/__fixtures__/reading-rules/r74-worker.mjs).
import fs from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parentPort, workerData } from 'node:worker_threads'

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (e) {
      if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) return next(`${specifier}.ts`, context)
      throw e
    }
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      const source = stripTypeScriptTypes(fs.readFileSync(fileURLToPath(url), 'utf8'), { mode: 'transform', sourceUrl: url })
      return { format: 'module', source, shortCircuit: true }
    }
    return next(url, context)
  },
})

const { job = 'read', bytes, fileName, cells: memCells, limit } = workerData
try {
  const { setClock, fixedClock } = await import(new URL('../../../core/clock.ts', import.meta.url).href)
  const { createSheetsReader } = await import(new URL('../index.ts', import.meta.url).href)
  const xlsx = await import(new URL('../xlsx/index.ts', import.meta.url).href)
  setClock(fixedClock('2026-10-03T09:00:00-04:00'))
  if (job === 'snap' && typeof xlsx.snapSums !== 'function') throw new Error('src/modules/sheets/xlsx/index.ts does not export snapSums')
  // The budget starts here: loading the modules is not the work.
  parentPort.postMessage({ ready: true })
  if (job === 'snap') {
    const out = limit === undefined ? xlsx.snapSums(memCells) : xlsx.snapSums(memCells, limit)
    const texts = {}
    for (const c of memCells) texts[`${c.column.letter}${String(c.row)}`] = c.text
    parentPort.postMessage({ done: true, ok: true, snap: { visits: out.visits, skipped: out.skipped, texts } })
  } else {
    const out = await createSheetsReader().read(bytes, fileName)
    if (!out.ok) parentPort.postMessage({ done: true, ok: false, reason: out.reason })
    else {
      const cells = {}
      for (const sheet of out.result.sheets) for (const c of sheet.cells) cells[`${c.column.letter}${String(c.row)}`] = { text: c.text, merged: c.merged }
      parentPort.postMessage({ done: true, ok: true, cells })
    }
  }
} catch (e) {
  parentPort.postMessage({ done: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) })
}
