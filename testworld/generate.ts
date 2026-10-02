// @mutate
// Byte-identical regeneration of the sample clients (ARC-16): re-runs their generators in a temp folder and compares.
import { execFile } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { SAMPLE_ROOT } from './clients/load'

const run = promisify(execFile)
const NUMBERED = /^\d\d-/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
}

function clientFiles(root: string): string[] {
  return readdirSync(root)
    .filter((n) => NUMBERED.test(n) && statSync(join(root, n)).isDirectory())
    .flatMap((n) => walk(join(root, n)))
    .map((p) => relative(root, p).split('\\').join('/'))
}

/** Runs generate.mjs and make-csv.mjs into a temp folder and lists the files (relative to root) that differ or are missing. */
export async function checkRegeneration(opts: { root?: string } = {}): Promise<{ identical: boolean; differing: string[] }> {
  const root = opts.root ?? SAMPLE_ROOT
  const temp = mkdtempSync(join(tmpdir(), 'w00-regen-'))
  try {
    cpSync(SAMPLE_ROOT, temp, { recursive: true })
    for (const n of readdirSync(temp).filter((x) => NUMBERED.test(x))) rmSync(join(temp, n), { recursive: true, force: true })
    for (const script of ['generate.mjs', 'make-csv.mjs']) {
      await run(process.execPath, [join(temp, script)], { cwd: temp })
    }
    const names = new Set([...clientFiles(root), ...clientFiles(temp)])
    const differing = [...names]
      .filter((n) => {
        try {
          return !readFileSync(join(root, n)).equals(readFileSync(join(temp, n)))
        } catch {
          return true
        }
      })
      .sort()
    return { identical: differing.length === 0, differing }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}
