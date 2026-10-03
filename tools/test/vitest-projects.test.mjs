// CQ12 (A495): vitest refuses one run that names two projects with different maxWorkers but the same sequence.groupOrder.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__')
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8')

function balanced(src, open) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  return ''
}

// The config text's projects: name, own maxWorkers (else the top-level one), own groupOrder (else 0).
export function projectsOf(src) {
  const start = src.indexOf('projects:')
  const head = src.slice(0, start)
  const topWorkers = /^\s*maxWorkers\s*[:,]\s*([^\n,]+)/m.exec(head.slice(head.lastIndexOf('test: {')))?.[1]?.trim() ?? 'maxWorkers'
  const out = []
  const re = /test:\s*\{/g
  re.lastIndex = start
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const body = balanced(src, m.index + m[0].length - 1)
    re.lastIndex = m.index + body.length
    const name = /name:\s*'([^']+)'/.exec(body)?.[1]
    if (!name) continue
    const workers = /(?:^|[\s,{])maxWorkers\s*:\s*([^\n]+?),?\s*$/m.exec(body)?.[1]?.trim() ?? topWorkers
    const groupOrder = /groupOrder\s*:\s*(\d+)/.exec(body)?.[1] ?? '0'
    out.push({ name, workers, groupOrder })
  }
  return out
}

export function groupOrderProblems(src) {
  const ps = projectsOf(src)
  const problems = []
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const [a, b] = [ps[i], ps[j]]
      if (a.groupOrder === b.groupOrder && a.workers !== b.workers)
        problems.push(`projects "${a.name}" and "${b.name}" share sequence.groupOrder ${a.groupOrder} but differ in maxWorkers`)
    }
  return problems
}

describe('CQ12 vitest project rules (ARC-15, A495)', () => {
  test('ARC-15 rule: the config as FX12 left it (db with its own maxWorkers, no groupOrder) is caught', () => {
    const problems = groupOrderProblems(read(FIX, 'planted-vitest-config.ts.txt'))
    expect(problems.length).toBeGreaterThan(0)
    expect(problems[0]).toContain('"db"')
  })
  test('ARC-15 rule: a config where the odd project has its own groupOrder passes', () => {
    const fixed = read(FIX, 'planted-vitest-config.ts.txt').replace(
      "name: 'db',",
      "name: 'db',\n          sequence: { groupOrder: 1 },",
    )
    expect(groupOrderProblems(fixed)).toEqual([])
  })
  test('ARC-15 the parser sees the three projects of the real config', () => {
    expect(projectsOf(read(ROOT, 'vitest.config.ts')).map((p) => p.name)).toEqual(['unit', 'db', 'evals'])
  })
  test('ARC-15 no two projects in vitest.config.ts share a groupOrder while differing in maxWorkers', () => {
    expect(groupOrderProblems(read(ROOT, 'vitest.config.ts'))).toEqual([])
  })
  test('ARC-15 vitest.mutate.config.ts has no project that breaks the same rule', () => {
    expect(groupOrderProblems(read(ROOT, 'vitest.mutate.config.ts'))).toEqual([])
  })
})
