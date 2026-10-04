// SC4 R74 harness (spec-writer): runs one walker case in a worker thread, so a walk that never ends is stopped at its
// budget instead of hanging the suite. Product modules are TypeScript with extensionless imports: these hooks add the
// ".ts" the import leaves out and turn TypeScript into JavaScript with Node's own type stripper (transform mode, so
// parameter properties and enums load too).
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

const { adapter, exportName, caseName } = workerData
try {
  const mod = await import(adapter)
  // The budget starts here: loading the modules is not the walk.
  parentPort.postMessage({ ready: true })
  const t0 = performance.now()
  const outcome = await mod[exportName](caseName)
  parentPort.postMessage({ done: true, ms: performance.now() - t0, outcome })
} catch (e) {
  parentPort.postMessage({ done: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) })
}
