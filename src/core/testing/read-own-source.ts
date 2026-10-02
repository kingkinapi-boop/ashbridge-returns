import fs from 'node:fs'
import path from 'node:path'

const SANDBOX = '.stryker-tmp/'

/** The text of a source file as committed. Inside Stryker's sandbox (cwd under `.stryker-tmp/`) the sandbox copy is instrumented, so the same relative path under the repo root is read instead. */
export function readOwnSource(file: string): string {
  const norm = (p: string): string => p.replace(/\\/g, '/')
  const cwd = norm(process.cwd())
  const at = cwd.indexOf(SANDBOX)
  if (at === -1) return fs.readFileSync(path.isAbsolute(file) ? file : path.join(cwd, file), 'utf8')
  const root = cwd.slice(0, at)
  const sandboxDir = cwd.replace(/\/$/, '')
  const abs = norm(path.isAbsolute(file) ? file : path.join(sandboxDir, file))
  const rel = abs.startsWith(`${sandboxDir}/`) ? abs.slice(sandboxDir.length + 1) : norm(file)
  return fs.readFileSync(path.join(root, rel), 'utf8')
}
