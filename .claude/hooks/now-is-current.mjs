/**
 * Stop hook for the Lead. Blocks the end of a turn ONCE when code has reached
 * `main` since `plan/NOW.md` was last committed there, so the shift note never
 * falls behind the code.
 *
 * Why this shape: Stop fires at the end of every turn of the main session
 * (helpers fire SubagentStop, not Stop). Blocking on uncommitted work would
 * force a NOW.md rewrite every turn mid-slice. Builders commit on their own
 * branches in worktrees, so this only bites once their work is on main.
 *
 * Order, not clocks: commits are compared by ancestry
 * (`git rev-list <last NOW.md commit>..HEAD -- <code paths>`), never by
 * timestamp, so a builder commit made earlier but merged later still counts.
 *
 * Contract (code.claude.com/docs/en/hooks): stdin is JSON with `cwd` and
 * `stop_hook_active`. Exit 2 blocks the stop and shows stderr to Claude; exit
 * 0 lets it stop. `stop_hook_active` true means this hook already blocked
 * once in the chain: never block twice. Any git error: let it stop.
 */
import { execFileSync } from 'node:child_process'

const CODE_PATHS = ['src', 'db', 'testworld', 'tools', 'e2e', 'data']

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  let data = {}
  try {
    data = JSON.parse(input || '{}')
  } catch {
    process.exit(0)
  }
  if (data.stop_hook_active) process.exit(0)
  const cwd = data.cwd || process.cwd()
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
      return null
    }
  }
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') process.exit(0)
  const lastNow = git('log', '-1', '--format=%H', '--', 'plan/NOW.md')
  if (!lastNow) process.exit(0)
  const count = Number(git('rev-list', '--count', `${lastNow}..HEAD`, '--', ...CODE_PATHS) || 0)
  if (count > 0) {
    process.stderr.write(
      `Lead: ${count} commit(s) changed code on main after plan/NOW.md was last committed. ` +
        'Before you stop, rewrite plan/NOW.md (and plan/TODO-ZO.md if Zo is needed), then commit and push them. ' +
        'If the slice is finished, also do CLAUDE.md loop step 7. ' +
        'Reviewer sessions: ignore this and stop.\n',
    )
    process.exit(2)
  }
  process.exit(0)
})
