// npm run test:flake: the db project in 5 fresh processes, cold each time, shuffle seed pinned.
// Any failure or timeout fails it; prints the slowest boot and the wall time of each run.
import { spawnSync } from 'node:child_process'

const RUNS = Number(process.env.FLAKE_RUNS ?? 5)
let slowestBoot = 0
let failed = 0
for (let i = 1; i <= RUNS; i++) {
  const t0 = Date.now()
  const r = spawnSync(
    'npx',
    ['vitest', 'run', '--project', 'db', '--sequence.shuffle', '--sequence.seed=20261001', '--passWithNoTests'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  )
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const boot = /schema booted in (\d+) ms/.exec(out)
  if (boot) slowestBoot = Math.max(slowestBoot, Number(boot[1]))
  console.log(`run ${i}: ${r.status === 0 ? 'ok' : 'FAIL'} in ${Date.now() - t0} ms`)
  if (r.status !== 0) {
    failed++
    console.log(out.split('\n').slice(-30).join('\n'))
  }
}
console.log(`slowest boot: ${slowestBoot} ms`)
if (failed > 0) {
  console.error(`test:flake FAILED: ${failed} of ${RUNS} runs`)
  process.exit(1)
}
