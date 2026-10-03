// CQ10 nested run: this file starts the script itself, so when the script runs this file under a shift, the
// inner script runs under that shift too (the real case: `npm run test:flake:shifted` runs
// tools/test/flake-shifted.test.mjs). The inner unshifted run must still be on the real date, and each inner
// shifted run on the real date plus its own shift, or the inner plant is not named and this test fails.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..')
const CONFIG = path.join(import.meta.dirname, '..', 'flake-shifted.config.mjs')

// The real date from the OS (a fresh file's mtime), whatever Date says in this process.
function realNow() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq10-nested-'))
  try {
    const f = path.join(dir, 'now')
    fs.writeFileSync(f, 'now')
    return fs.statSync(f).mtimeMs
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('nested: the inner script still names the a04 plant under +2d and +1y', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'flake-shifted.mjs'), '--config', CONFIG, 'cq10-plant'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CQ10_FIXED: new Date(realNow()).toISOString() },
    shell:false,
  })
  const lines = `${r.stdout ?? ''}${r.stderr ?? ''}`.split(/\r?\n/)
  expect(r.status).not.toBe(0)
  expect(lines.some((l) => l.startsWith('DIFFERS +2d ') && l.includes('a04 shape: a fixed date against Date.now'))).toBe(true)
  expect(lines.some((l) => l.startsWith('DIFFERS +1y ') && l.includes('a04 shape: a fixed date against Date.now'))).toBe(true)
  expect(lines.some((l) => l.startsWith('DIFFERS +2d ') && l.includes('within three days of a fixed date'))).toBe(false)
})
