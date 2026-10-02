// SessionStart (matcher "compact"): reload the Lead's state right after a compaction (decision 0024, Critic 2 Oct).
// Prints NOW.md, the recent claims and the last commits; nothing secret is read.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 20000 }) } catch { return '(unavailable)\n' } }
let out = '## Reloaded after compaction (decision 0024)\n\n### plan/NOW.md\n'
try { out += readFileSync('plan/NOW.md', 'utf8') } catch { out += '(missing)\n' }
const claims = run('node', ['tools/claim.mjs', 'list']).split('\n').filter((l) => l && !l.includes('(inactive)')).slice(-25).join('\n')
out += '\n### Active claims (last 25)\n' + claims + '\n'
out += '\n### Last commits\n' + run('git', ['log', '--oneline', '-8'])
process.stdout.write(out)
