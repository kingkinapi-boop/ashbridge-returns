// SC6: card and verify rules R77 and R78 (unit project). Card plan/cards/SC6.md; clauses ARC-15, ARC-16.
// Source: reports/W16-findings.md ("Rule tests to add"). Each rule is first shown failing on its planted example
// under tools/test/__fixtures__/card-rules/ (copies taken from git history), then applied to the repo.
//
// R77 (ARC-15: the tests decide when a card is done, so the spec job's files must be the spec job's alone): no card
//   gives the same file both to the spec job and to the build. Spec-owned files are every file the "Who does what"
//   spec bullet names, plus the tests, fixtures, goldens, verify.mjs and README files a Spec, Test fixtures or Golden
//   files section names. Build files are every file the Build section or the "Who does what" build bullet
//   names, leaving out sentences that say the spec job owns a file or that the build never edits it.
//   Planted: plan/cards/W16.md as on main before A404 (b170854): the README is both the spec's and the build's.
// R78 (ARC-16: a check over sample data is deterministic and depends on the data, not on git history): verify.mjs,
//   and any other checker script over sample data (reference/sample-clients, testworld), holds no hard-coded
//   "unchanged since main" or "folders N to M identical" check and no git merge-base guard: unchanged files are
//   tools/scope.mjs's job. Planted: reference/sample-clients/verify.mjs as on main before W16 round 2 (7f15c0a).
//
// A rule that fails on main is a defect of the card that owns the file; it goes in KNOWN with that card and is never
// fixed here (A329: no rule is weakened). A KNOWN entry that no longer matches fails too, so the list only shrinks.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__', 'card-rules')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8')
const PLANTED_CARD = 'planted-W16-before-A404.md.txt'
const PLANTED_VERIFY = 'planted-verify-before-W16-r2.mjs.txt'

// ---------- known defects on main (validated on main 7eaf18c, 3 Oct), each owned by another card ----------
const KNOWN = [
  {
    rule: 'R77',
    match: /^plan\/cards\/W14\.md: the Build section names (README\.md|contract-ids\.json), which the spec job owns/,
    owner: 'W14 (done; the Lead rewords its Build section: the README counts and contract-ids.json are the spec job\'s, as W16 round 2 did, A404)',
  },
  {
    rule: 'R78',
    match: /^reference\/sample-clients\/verify\.mjs:\d+: /,
    owner: 'W16 round 2 spec (claude/W16-r2, A404: retire the two merge-base "folders unchanged" guards; scope.mjs does that job)',
  },
]

function onlyKnown(rule, problems) {
  const known = KNOWN.filter((k) => k.rule === rule)
  const unknown = problems.filter((p) => !known.some((k) => k.match.test(p)))
  const stale = known
    .filter((k) => !problems.some((p) => k.match.test(p)))
    .map((k) => `stale KNOWN entry ${k.rule} ${String(k.match)} (owner ${k.owner}): it no longer fails, remove it`)
  return [...unknown, ...stale]
}

// ---------- files ----------
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.stryker-tmp', 'coverage', 'test-results', 'playwright-report'])
function walk(dirRel, out = []) {
  const abs = path.join(ROOT, dirRel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const r = `${dirRel}/${e.name}`
    if (e.isDirectory()) walk(r, out)
    else out.push(r)
  }
  return out
}
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f)
const isFixture = (f) => /(^|\/)(__fixtures__|__golden__)\//.test(f)

// ---------- R77: one owner per file ----------
const FILE_RE =
  /(?:[\w.*@-]+\/)*[\w*@-]+(?:\.[\w-]+)*\.(?:mjs|cjs|js|jsx|ts|tsx|json|jsonl|md|csv|sql|txt|ya?ml|pdf|xlsx|toml|html)\b|\bREADME\b/g
const SPEC_HEADING = /^(spec\b|golden files|test fixtures)|spec-writer/i
const BUILD_HEADING = /^build\b/i
const WHO_HEADING = /who does what/i
const SPEC_BULLET = /^\s*[-*]\s+(\*\*)?(the\s+)?spec(\s+job|-writer)?\b/i
const BUILD_BULLET = /^\s*[-*]\s+(\*\*)?(the\s+)?build(\s+job|er)?\b/i
// Files a Spec section names that the spec job writes (a Spec section also names product files it tests).
const SPEC_KIND = /\.test\.|(^|\/)__fixtures__\/|(^|\/)__golden__\/|(^|\/)verify\.mjs$|(^|\/)README\.md$/
// A build sentence that hands a file to the spec job, or says the build never edits it, writes nothing.
const SPEC_MENTION = /\bspec(\s+job|-writer|'s)\b/i
const NEVER_EDITS = /\b(never|not|without|no line of|nor)\b[^.;]*\b(edit|edits|editing|change|changes|touch|touches)\b/i

function sections(text) {
  const out = []
  let cur = { heading: '', lines: [] }
  for (const line of text.split(/\r?\n/)) {
    const m = /^##\s+(.*)$/.exec(line)
    if (m) {
      out.push(cur)
      cur = { heading: m[1], lines: [] }
    } else cur.lines.push(line)
  }
  out.push(cur)
  return out.map((s) => ({ heading: s.heading, body: s.lines.join('\n') }))
}
const bullets = (body) => body.split(/\n(?=\s*[-*] )/)
const sentences = (text) => text.split(/(?<=[.;:])\s+/)
const refs = (text) => [...new Set((text.match(FILE_RE) ?? []).map((r) => (r === 'README' ? 'README.md' : r)))]
const buildWrites = (text) =>
  sentences(text)
    .filter((s) => !SPEC_MENTION.test(s) && !NEVER_EDITS.test(s))
    .join('\n')

/** The files a card gives to the spec job and the files it gives to the build. */
function cardOwnership(text) {
  let who = ''
  let spec = ''
  let build = ''
  for (const s of sections(text)) {
    if (SPEC_HEADING.test(s.heading)) spec += `\n${s.body}`
    else if (BUILD_HEADING.test(s.heading)) build += `\n${buildWrites(s.body)}`
    else if (WHO_HEADING.test(s.heading)) {
      for (const b of bullets(s.body)) {
        if (SPEC_BULLET.test(b)) who += `\n${b}`
        else if (BUILD_BULLET.test(b)) build += `\n${buildWrites(b)}`
      }
    }
  }
  const specOwned = [...new Set([...refs(who), ...refs(spec).filter((r) => SPEC_KIND.test(r))])]
  return { spec: specOwned, build: refs(build) }
}
const sameFile = (a, b) =>
  a === b || ((!a.includes('/') || !b.includes('/')) && path.posix.basename(a) === path.posix.basename(b))

function r77(rel, text) {
  const { spec, build } = cardOwnership(text)
  const out = []
  for (const b of build) {
    const s = spec.find((x) => sameFile(b, x))
    if (s) out.push(`${rel}: the Build section names ${b}, which the spec job owns (${s})`)
  }
  return out
}
const CARD_FILES = () => [...walk('plan/cards')].filter((f) => f.endsWith('.md'))

// ---------- R78: no frozen history guard in a checker over sample data ----------
const R78_PATTERNS = [
  [/['"`]merge-base['"`]/, 'a git merge-base guard'],
  [/\b(folders?|clients?)\s+\d+\s+(to|through|-)\s+\d+\s+(are\s+|is\s+)?(byte-)?(identical|unchanged)\b/i, 'a hard-coded "folders N to M identical" check'],
  [/\b(byte-)?(identical|unchanged)\s+(to|since|from|with)\s+(origin\/)?main\b/i, 'a hard-coded "unchanged since main" check'],
]
function r78(rel, text) {
  const out = []
  text.split(/\r?\n/).forEach((line, i) => {
    for (const [re, what] of R78_PATTERNS) {
      if (re.test(line)) {
        out.push(`${rel}:${String(i + 1)}: ${what} (scope.mjs checks unchanged files)`)
        break
      }
    }
  })
  return out
}
const CHECKER_FILES = () =>
  [...walk('reference/sample-clients'), ...walk('testworld')].filter(
    (f) => /\.(mjs|cjs|js|ts)$/.test(f) && !f.endsWith('.d.ts') && !isTest(f) && !isFixture(f),
  )

describe('SC6 card and verify rules (ARC-15, ARC-16)', () => {
  test('ARC-15 R77 rule: W16.md as on main before A404 fails (the README is the spec job\'s and the Build section names it)', () => {
    const problems = r77('plan/cards/W16.md', fix(PLANTED_CARD))
    expect(problems).toEqual(['plan/cards/W16.md: the Build section names README.md, which the spec job owns (README.md)'])
  })

  test('ARC-15 R77 rule: the planted W16.md passes once its Build section hands the moved-figure list to the spec job', () => {
    const planted = fix(PLANTED_CARD)
    const fixed = planted.replace(
      'and list each moved figure in the README with the reason.',
      'and report each moved figure with the reason in reports/W16-build.md (the spec job writes them into the README).',
    )
    expect(fixed).not.toBe(planted)
    expect(r77('plan/cards/W16.md', fixed)).toEqual([])
  })

  test('ARC-15 R77 rule: a Spec section that only names the product file it tests does not own it', () => {
    const card = [
      '# X1 A card (Test)',
      '## Spec',
      '- Tests in `src/modules/x/x.acceptance.test.ts` for `src/modules/x/index.ts`.',
      '## Build',
      '- Write `src/modules/x/index.ts`.',
    ].join('\n')
    expect(r77('plan/cards/X1.md', card)).toEqual([])
    const bad = card.replace('- Write `src/modules/x/index.ts`.', '- Write `src/modules/x/index.ts` and fix `x.acceptance.test.ts`.')
    expect(r77('plan/cards/X1.md', bad)).toEqual([
      'plan/cards/X1.md: the Build section names x.acceptance.test.ts, which the spec job owns (src/modules/x/x.acceptance.test.ts)',
    ])
  })

  test('ARC-15 R77 no card gives the same file both to the spec job and to the build (KNOWN entries aside)', () => {
    const files = CARD_FILES()
    expect(files.length, 'no card files found under plan/cards').toBeGreaterThan(50)
    expect(files).toContain('plan/cards/W16.md')
    const problems = files.flatMap((f) => r77(f, read(f)))
    expect(onlyKnown('R77', problems)).toEqual([])
  })

  test('ARC-16 R78 rule: verify.mjs as on main before W16 round 2 fails on its two merge-base guards and nothing else', () => {
    const problems = r78('reference/sample-clients/verify.mjs', fix(PLANTED_VERIFY))
    expect(problems.map((p) => Number(/:(\d+):/.exec(p)?.[1]))).toEqual([996, 1000, 1003, 1007])
    expect(problems[0]).toMatch(/a git merge-base guard/)
    expect(problems[1]).toMatch(/folders N to M identical/)
  })

  test('ARC-16 R78 rule: the planted verify.mjs passes once the two guards are retired, keeping the second-generation check', () => {
    const lines = fix(PLANTED_VERIFY).split('\n')
    const kept = lines.filter((_, i) => ![995, 996, 997, 998, 999, 1002, 1003, 1004, 1005, 1006].includes(i))
    const text = kept.join('\n')
    expect(text).toMatch(/a second generation \(generate\.mjs, then make-csv\.mjs\) is byte-identical/)
    expect(r78('reference/sample-clients/verify.mjs', text)).toEqual([])
  })

  test('ARC-16 R78 no checker script over sample data holds a merge-base or "folders unchanged" guard (KNOWN entries aside)', () => {
    const files = CHECKER_FILES()
    expect(files).toContain('reference/sample-clients/verify.mjs')
    const problems = files.flatMap((f) => r78(f, read(f)))
    expect(onlyKnown('R78', problems)).toEqual([])
  })
})
