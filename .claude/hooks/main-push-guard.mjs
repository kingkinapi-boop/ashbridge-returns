/**
 * PreToolUse hook (Bash, git push). Refuses a push to `main` that carries code
 * which did not arrive through a merge commit (CLAUDE.md loop step 5).
 *
 * Why: on 27 Sep a migration file move went straight onto main without the
 * checker, tester or cloud run, and main was red for 75 minutes.
 *
 * Rule: walk the first-parent line of what is being pushed, from origin/main.
 * Merge commits pass (a branch that passed its three checks). A non-merge
 * commit passes only if every file it touches is a status or rule file:
 * plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md,
 * README.md or .claude/ (Ashbridge Returns copy of the client app hook).
 * Anything else is code: put it on a
 * branch and merge it with `git merge --no-ff` after the checks.
 *
 * Contract (code.claude.com/docs/en/hooks-guide): stdin is JSON with `cwd` and
 * `tool_input.command`. Exit 2 blocks the call and shows stderr to Claude.
 * Any git or parse error: let it through (the rule in CLAUDE.md still holds).
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ALLOWED = [/^plan\//, /^reviews\//, /^decisions\//, /^reference\//, /^blueprint\//, /^reports\//, /^CLAUDE\.md$/, /^README\.md$/, /^\.claude\//]

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  let data = {}
  try {
    data = JSON.parse(input || '{}')
  } catch {
    process.exit(0)
  }
  const command = String(data?.tool_input?.command || '')
  let cwd = data.cwd || process.cwd()

  // Each `git ... push ...` segment of the command line.
  for (const segment of command.split(/&&|\|\||;|\|/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean)
    const gitAt = words.indexOf('git')
    if (gitAt < 0) continue
    let i = gitAt + 1
    let dir = cwd
    while (i < words.length && words[i].startsWith('-')) {
      if (words[i] === '-C' && words[i + 1]) {
        dir = path.resolve(dir, words[i + 1].replace(/^["']|["']$/g, ''))
        i += 2
      } else i += 1
    }
    if (words[i] !== 'push') continue
    const rest = words.slice(i + 1).filter((w) => !w.startsWith('-'))
    const refspecs = rest.slice(1)
    const problem = checkPush(dir, refspecs)
    if (problem) {
      process.stderr.write(problem)
      process.exit(2)
    }
  }
  process.exit(0)
})

function git(dir, ...args) {
  try {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function checkPush(dir, refspecs) {
  const targets = []
  if (refspecs.length === 0) {
    if (git(dir, 'rev-parse', '--abbrev-ref', 'HEAD') === 'main') targets.push('HEAD')
  } else {
    for (const spec of refspecs) {
      const clean = spec.replace(/^\+/, '')
      const [src, dst] = clean.includes(':') ? clean.split(':') : [clean, clean]
      if (dst.replace(/^refs\/heads\//, '') !== 'main') continue
      if (!src) return 'Refused: this would delete main.\n'
      targets.push(src)
    }
  }
  for (const src of targets) {
    const tip = git(dir, 'rev-parse', '--verify', `${src}^{commit}`)
    const base = git(dir, 'rev-parse', '--verify', 'origin/main^{commit}')
    if (!tip || !base) continue
    const list = git(dir, 'rev-list', '--first-parent', `${base}..${tip}`)
    if (list === null) continue
    for (const commit of list.split('\n').filter(Boolean)) {
      const parents = (git(dir, 'rev-list', '--parents', '-n', '1', commit) || '').split(' ').length - 1
      if (parents > 1) continue
      const files = (git(dir, 'diff-tree', '--no-commit-id', '--name-only', '-r', commit) || '').split('\n').filter(Boolean)
      const code = files.filter((f) => !ALLOWED.some((re) => re.test(f)))
      if (code.length > 0) {
        const short = commit.slice(0, 8)
        return (
          `Refused: commit ${short} would reach main with code that did not come through a merge (${code.slice(0, 5).join(', ')}). ` +
          'CLAUDE.md loop step 5: code reaches main only through a merge that passed the checker, the tester (screens) and the full suite on the branch. ' +
          'Move the commit onto a branch, run the checks, then `git merge --no-ff` it into main. Status and rule files (plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/) may go straight to main.\n'
        )
      }
    }
  }
  return null
}
