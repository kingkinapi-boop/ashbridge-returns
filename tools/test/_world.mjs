// Shared helper for the F08 acceptance tests (not a test file). Builds a temp project root with a
// copy of tools/ (the tools find their root from their own location), and runs a tool in it.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll } from 'vitest'

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dirs = []
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

export function makeWorld({ files = {}, slices } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f08-'))
  dirs.push(root)
  fs.cpSync(TOOLS, path.join(root, 'tools'), {
    recursive: true,
    filter: (s) => !s.startsWith(path.join(TOOLS, 'test')) && !s.includes('test-flake'),
  })
  const put = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  if (slices !== undefined) put('plan/slices.json', typeof slices === 'string' ? slices : JSON.stringify(slices))
  for (const [f, c] of Object.entries(files)) put(f, c)
  return { root, put, read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8') }
}

export function runTool(world, tool, args = []) {
  const r = spawnSync('node', [path.join(world.root, 'tools', tool), ...args], {
    cwd: world.root,
    encoding: 'utf8',
    env: { ...process.env, CLAIMS_NOW: '2026-10-02T12:00:00Z' },
  })
  return { code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() }
}
