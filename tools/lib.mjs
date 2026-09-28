// Shared helpers for the Lead's tools. No dependencies: runs before `npm ci`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

export function loadIndex() {
  return JSON.parse(read('plan/slices.json'))
}

// Card statuses that hold their paths (tools/next.mjs never starts an overlapping card).
export const IN_FLIGHT = new Set(['speccing', 'building', 'checking', 'merging'])

// "src/**" matches everything under src/; "*" matches within one folder.
export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i++
        if (glob[i + 1] === '/') i++
      } else re += '[^/]*'
    } else if ('\\^$+?.()|{}[]'.includes(ch)) re += '\\' + ch
    else re += ch
  }
  return new RegExp('^' + re + '$')
}

// Two path lists overlap when the literal start of one glob (up to its first *)
// is a start of the other: "src/modules/ai/**" overlaps "src/modules/ai/runner/x.ts".
export function pathsOverlap(a, b) {
  const lit = (g) => g.split('*')[0]
  return a.some((x) => b.some((y) => lit(x).startsWith(lit(y)) || lit(y).startsWith(lit(x))))
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}
