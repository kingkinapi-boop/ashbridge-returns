// FX7 acceptance tests (unit project): the card's check ("SC's rules green with no FX7 entry in KNOWN"), the Node 24
// floor in the Vitest setup file (SC's R38) and the A05 log plant's number (SC's R34). Card plan/cards/FX7.md.
//
// Spec choices (amber, FX7 spec 3 Oct):
//   - the floor lives in src/core/test-no-network.ts (the card's Harness; every Vitest project lists it first) and reads
//     process.versions.node; importing the file under a Node major below 24 fails (a thrown error), and the message
//     names the floor (24) and the version found;
//   - the A05 plant keeps a nine-digit number in the SIN slot (so the logger rule still has a sensitive-looking
//     interpolation to catch) but no Luhn-valid one.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'
import { luhnValid } from '../../reference/sample-clients/lib/util.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('FX7 the card check: no FX7 entry left in KNOWN', () => {
  test('ARC-15 known.json (unit and db) holds no entry owned by FX7', () => {
    const known = JSON.parse(read('tools/test/__fixtures__/schema-contract/known.json'))
    const all = [...known.unit, ...known.db]
    expect(all.length).toBeGreaterThan(0)
    expect(all.filter((k) => k.owner === 'FX7').map((k) => `${k.rule} ${k.file}: ${k.problems.join(' | ')}`)).toEqual([])
  })
})

describe('FX7 the Node 24 floor at Vitest setup (R38)', () => {
  const SETUP = pathToFileURL(path.join(ROOT, 'src/core/test-no-network.ts')).href
  /** Imports the setup file in a fresh Node with process.versions.node reported as `version`. */
  function importUnder(version) {
    const script = [
      `Object.defineProperty(process, 'versions', { value: { ...process.versions, node: ${JSON.stringify(version)} } })`,
      `await import(${JSON.stringify(SETUP)})`,
      `console.log('setup loaded')`,
    ].join('\n')
    return spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 30_000 })
  }

  test('RT-9 R38 the setup file loads under Node 24 and later', () => {
    for (const v of ['24.0.0', process.versions.node, '25.1.0', '30.0.0']) {
      const r = importUnder(v)
      expect(r.status, `${v}: ${r.stderr}`).toBe(0)
      expect(r.stdout).toContain('setup loaded')
    }
  }, 60_000)

  test('RT-9 R38 planted: under Node 22.1.0, 23.11.0 or 8.0.0 the setup file refuses to load, naming the floor and the version', () => {
    for (const v of ['22.1.0', '23.11.0', '8.0.0']) {
      const r = importUnder(v)
      expect(r.status, `${v} loaded`).not.toBe(0)
      expect(r.stdout).not.toContain('setup loaded')
      expect(r.stderr).toContain('24')
      expect(r.stderr).toContain(v)
    }
  }, 60_000)
})

describe('FX7 the A05 log plant (R34)', () => {
  const PLANT = 'tools/test/__fixtures__/planted-interpolated-log.ts.txt'
  test('SEC-11 R34 the plant holds no Luhn-valid nine-digit number', () => {
    const runs = [...read(PLANT).matchAll(/(?<!\d)\d{9}(?!\d)/g)].map((m) => m[0])
    expect(runs.length).toBeGreaterThan(0)
    expect(runs.filter((n) => luhnValid(n))).toEqual([])
  })
  test('SEC-11 R34 the plant still interpolates a nine-digit value in its SIN slot (the logger rule keeps its subject)', () => {
    const text = read(PLANT)
    expect(text).toMatch(/sin: '\d{9}'/)
    expect(text).toContain('log.info(`loaded client ${client.sin}`)')
  })
})
