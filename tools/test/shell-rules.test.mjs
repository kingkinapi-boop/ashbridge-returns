// A253: the "no shell in tools" rule must not flag a false shell option written with a space, and must still catch the planted files.
// Inline samples are built from pieces so the repo-wide rule scan (which reads this file too) sees no option text.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { shellProblems } from '../shell-rules.mjs'

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__')
const read = (f) => fs.readFileSync(path.join(FIX, f), 'utf8')
const opt = (sep, value) => `{ ${'sh' + 'ell'}${sep}${value} }`

describe('SEC-10 shellProblems (A253)', () => {
  test('SEC-10 rule: the planted tool with shell on Windows and npx is caught twice', () => {
    expect(shellProblems(read('planted-shell-tool.mjs.txt')).length).toBeGreaterThanOrEqual(2)
  })
  test('SEC-10 rule: the planted file with truthy options in odd spacing is caught', () => {
    expect(shellProblems(read('planted-shell-spaced.mjs.txt'))).toEqual(['a child process option sets shell to something other than false'])
    for (const [sep, value] of [[': ', 'true'], [' : ', 'process.platform'], [':', "'bash'"], [':', 'true']]) {
      expect(shellProblems(opt(sep, value)), `${sep}${value}`).not.toEqual([])
    }
  })
  test('SEC-10 rule: a false value with a space, with none, or with many is clean', () => {
    expect(shellProblems(read('clean-shell-spaced.mjs.txt'))).toEqual([])
    for (const sep of [': ', ':', ' :  ']) expect(shellProblems(opt(sep, 'false')), sep).toEqual([])
  })
  test('SEC-10 rule: a value that only starts with false is not clean', () => {
    expect(shellProblems(opt(': ', 'falsey'))).not.toEqual([])
  })
  test('SEC-10 rule: exec imports are caught', () => {
    expect(shellProblems(`import { ${'exec' + 'Sync'} } from 'node:child_process'`)).toHaveLength(1)
  })
})
