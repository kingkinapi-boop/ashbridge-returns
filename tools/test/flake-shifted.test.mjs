// CQ10 acceptance (ARC-15, testing.md "a test that passes only on today's date is a flaky test", A469).
// Spec-owned: the builder writes tools/flake-shifted.mjs and the npm entry, never this file or its fixtures.
//
// The contract these tests pin:
// - `npm run test:flake:shifted` is `node tools/flake-shifted.mjs`.
// - `node tools/flake-shifted.mjs [vitest args...]` runs `vitest run --project unit [vitest args...]` three times
//   from the repo root: unshifted, with the system date shifted forward by 2 days, and by 1 year. The shift is
//   in place before any test file loads; it moves Date.now() and `new Date()` with no argument only (dates built
//   from values, the time zone and a test's own vi.setSystemTime are untouched). Extra args go to every run, so
//   a test can aim the script at a fixture config and files.
// - Each run's date is the real date plus that run's shift, even when the script itself runs under a shift
//   (it runs this file when it runs the unit project).
// - For every test (or test file that fails to load) whose result under a shift differs from the unshifted run,
//   it prints one line: `DIFFERS <+2d|+1y> <file> > <test name>...`. It exits non-zero when any line is printed,
//   when the unshifted run has a failing test, or when the unshifted run ran no test; otherwise it exits 0.
//
// CQ10_FIXED (handed to the fixtures) is the real date read from a fresh file's mtime: the OS clock, which no
// date shim moves, so these tests hold when the script runs them under its own shift.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(ROOT, 'tools', 'flake-shifted.mjs')
const CONFIG = path.join(ROOT, 'tools', 'test', '__fixtures__', 'flake-shifted', 'flake-shifted.config.mjs')
// Three cold Vitest boots per script run (about 4 s each on the laptop); the nested run starts twelve.

function realNowIso() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq10-'))
  try {
    const f = path.join(dir, 'now')
    fs.writeFileSync(f, 'now')
    return new Date(fs.statSync(f).mtimeMs).toISOString()
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function runShifted(args) {
  expect(fs.existsSync(SCRIPT), 'tools/flake-shifted.mjs exists').toBe(true)
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CQ10_FIXED: realNowIso() },
    shell:false,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  return { code: r.status, out, lines: out.split(/\r?\n/), differs: out.split(/\r?\n/).filter((l) => l.startsWith('DIFFERS ')) }
}

const named = (run, shift, file, title) =>
  run.differs.some((l) => l.startsWith(`DIFFERS ${shift} `) && l.includes(file) && l.includes(title))

describe('CQ10 flake run with the date shifted (ARC-15)', () => {
  test('ARC-15 package.json runs `npm run test:flake:shifted` as node tools/flake-shifted.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.scripts['test:flake:shifted']).toBe('node tools/flake-shifted.mjs')
    expect(pkg.scripts['test:flake']).toBe('node tools/test-flake.mjs')
  })

  describe('planted run: date-dependent tests are named, by shift', () => {
    const PLANT = 'cq10-plant.check.mjs'
    let run
    beforeAll(() => {
      run = runShifted(['--config', CONFIG, 'cq10-plant', 'cq10-load', 'cq10-other'])
    }, 180_000)

    test('ARC-15 planted: a fixed date compared with Date.now() passes unshifted, fails shifted and is named under +2d and +1y; the run fails', () => {
      expect(run.code).not.toBe(0)
      expect(named(run, '+2d', PLANT, 'a04 shape: a fixed date against Date.now')).toBe(true)
      expect(named(run, '+1y', PLANT, 'a04 shape: a fixed date against Date.now')).toBe(true)
    })
    test('ARC-15 planted: `new Date()` with no argument is shifted too', () => {
      expect(named(run, '+2d', PLANT, 'new Date with no argument against a fixed date')).toBe(true)
      expect(named(run, '+1y', PLANT, 'new Date with no argument against a fixed date')).toBe(true)
    })
    test('ARC-15 planted: the shift is in place before the test file loads (a clock read at module load is shifted)', () => {
      expect(named(run, '+2d', PLANT, 'the clock read at file load against a fixed date')).toBe(true)
      expect(named(run, '+1y', PLANT, 'the clock read at file load against a fixed date')).toBe(true)
    })
    test('ARC-15 planted: the first shift is at least 1 day and under 3 days; the second is over 300 days', () => {
      expect(named(run, '+2d', PLANT, 'within three days of a fixed date')).toBe(false)
      expect(named(run, '+1y', PLANT, 'within three days of a fixed date')).toBe(true)
      expect(named(run, '+2d', PLANT, 'within 300 days of a fixed date')).toBe(false)
      expect(named(run, '+1y', PLANT, 'within 300 days of a fixed date')).toBe(true)
    })
    test('ARC-15 planted: a test that fails unshifted and passes shifted is named as well (a result that differs either way)', () => {
      expect(named(run, '+2d', PLANT, 'a day or more after a fixed date')).toBe(true)
      expect(named(run, '+1y', PLANT, 'a day or more after a fixed date')).toBe(true)
      expect(named(run, '+2d', PLANT, 'more than 300 days after a fixed date')).toBe(false)
      expect(named(run, '+1y', PLANT, 'more than 300 days after a fixed date')).toBe(true)
    })
    test('ARC-15 planted: a test file that cannot load under a shift is named by its file', () => {
      expect(run.differs.some((l) => l.startsWith('DIFFERS +2d ') && l.includes('cq10-load.check.mjs'))).toBe(true)
      expect(run.differs.some((l) => l.startsWith('DIFFERS +1y ') && l.includes('cq10-load.check.mjs'))).toBe(true)
    })
    test('ARC-15 no false alarm: a test that fails on every date is not named, and only the unit project runs', () => {
      expect(run.differs.length, 'the planted run names something, so the checks below see real lines').toBeGreaterThan(0)
      expect(run.differs.some((l) => l.includes('always fails whatever the date'))).toBe(false)
      expect(run.differs.some((l) => l.includes('cq10-other') || l.includes('other project plant'))).toBe(false)
      expect(run.differs.every((l) => /^DIFFERS \+(2d|1y) /.test(l))).toBe(true)
    })
  })

  test(
    'ARC-15 no false alarm: tests that pin their clock or use explicit dates and the time zone pass under both shifts, nothing is named, exit 0',
    () => {
      const run = runShifted(['--config', CONFIG, 'cq10-clean'])
      expect(run.differs).toEqual([])
      expect(run.code, run.out).toBe(0)
    },
    180_000
  )

  test(
    'ARC-15 the unshifted run is the real date even when the script itself runs under a shift (nested run names the inner plant)',
    () => {
      const run = runShifted(['--config', CONFIG, 'cq10-nested'])
      expect(run.differs).toEqual([])
      expect(run.code, run.out).toBe(0)
    },
    600_000
  )

  test(
    'ARC-15 a failing unshifted run fails the script even when nothing differs',
    () => {
      const run = runShifted(['--config', CONFIG, 'cq10-plant', '-t', 'always fails whatever the date'])
      expect(run.differs).toEqual([])
      expect(run.code).not.toBe(0)
    },
    180_000
  )

  test(
    'ARC-15 a run with no test is a failure, not a pass',
    () => {
      const run = runShifted(['--config', CONFIG, 'cq10-no-such-file'])
      expect(run.differs).toEqual([])
      expect(run.code).not.toBe(0)
    },
    180_000
  )
})
