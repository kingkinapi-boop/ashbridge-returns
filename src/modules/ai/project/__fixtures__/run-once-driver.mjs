#!/usr/bin/env node
// A08 round 2 fixture (spec-writer; builders never edit this file): one run-once pass in its own Node process, the
// way `npm run ai:once` makes it (ai-project/ai-once.mjs: the same TypeScript resolver, the same entry), but with an
// approved list the test gives, since the shipped data/ai/approved.json approves nothing and `ai:once` takes no
// options. The process must end on its own: a timer or a child left behind keeps it alive past the test's limit.
// Usage: node run-once-driver.mjs '<JSON: { argv, env, approvedPath }>'. Prints each log line, then the result.
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
register(pathToFileURL(path.join(repo, 'ai-project', 'ts-resolve.mjs')))
const { runAiProjectOnce } = await import(pathToFileURL(path.join(repo, 'src', 'modules', 'ai', 'project', 'index.ts')).href)

const options = JSON.parse(process.argv[2] ?? '{}')
const result = await runAiProjectOnce({ ...options, sink: (line) => console.log(line) })
console.log(JSON.stringify(result))
