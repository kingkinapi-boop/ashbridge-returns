// Runs the next CLI with telemetry off, through process.execPath and no shell (SEC-10).
// Usage: node tools/run-next.mjs <dev|build|start> [args]
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bin = path.join(root, 'node_modules/next/dist/bin/next')
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell:false,
  cwd: root,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
})
process.exit(r.status ?? 1)
