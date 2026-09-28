// Runs a heavy command (typecheck, tests, build) only when a laptop slot is
// free, so parallel builders never run several at once (CLAUDE.md).
// Slots: plan/mode.json "heavy_slots" (default 1). A lock older than
// 45 minutes is stale and is taken over.
// Usage: node tools/heavy.mjs -- npm run typecheck
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { read } from './lib.mjs'

const sep = process.argv.indexOf('--')
const cmd = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(2)
if (!cmd.length) {
  console.error('usage: node tools/heavy.mjs -- <command>')
  process.exit(2)
}
let slots = 1
try {
  slots = Math.max(1, Number(JSON.parse(read('plan/mode.json')).heavy_slots) || 1)
} catch {}
const STALE_MS = 45 * 60 * 1000
const lockDir = (i) => path.join(os.tmpdir(), `ashbridge-returns-heavy-${i}.lock`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function acquire() {
  let told = false
  for (;;) {
    for (let i = 1; i <= slots; i++) {
      const dir = lockDir(i)
      try {
        fs.mkdirSync(dir)
        fs.writeFileSync(path.join(dir, 'pid'), String(process.pid))
        return dir
      } catch {
        try {
          if (Date.now() - fs.statSync(dir).mtimeMs > STALE_MS) fs.rmSync(dir, { recursive: true, force: true })
        } catch {}
      }
    }
    if (!told) {
      console.error(`waiting for a heavy-job slot (${slots} on this laptop)...`)
      told = true
    }
    await sleep(3000)
  }
}

const lock = await acquire()
const release = () => {
  try {
    fs.rmSync(lock, { recursive: true, force: true })
  } catch {}
}
const child = spawn(cmd.join(' '), { stdio: 'inherit', shell: true })
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    child.kill(sig)
    release()
    process.exit(130)
  })
}
child.on('exit', (code) => {
  release()
  process.exit(code ?? 1)
})
