// SC8: R79, every test that reads the text of a src file marked `// @mutate` reads it through readOwnSource (unit
// project). Card plan/cards/SC8.md; clauses ARC-15, ARC-16; testing.md ("Source-scan tests ... read the file through
// readOwnSource"); reports/FX2-findings.md RC2. Stryker rewrites a @mutate file inside its sandbox and the preamble it
// adds holds `process.env` (tools/test/__fixtures__/source-read-rules/stryker-sandbox-mod.ts.txt, captured from
// @stryker-mutator/instrumenter 10.0.0), so a raw read there scans the instrumented copy and the dry run fails.
//
// A finding is any readFileSync, readFile or createReadStream call (on fs, fs.promises, node:fs/promises or a named
// import) in a test file whose path resolves to a @mutate src file, however the path is built: literals, consts,
// templates, `+`, path.join / resolve / dirname, new URL(rel, import.meta.url), fileURLToPath, import.meta.dirname,
// __dirname, loop and callback variables over a list, and a list built from a directory (`files(dir)`). A path that
// resolves to nothing known (a bare parameter) is not a finding: the rule names what it can prove.
//
// The rule is first shown catching planted bad examples, then applied to the repo. KNOWN (A407 shape) is empty: the
// card's build switches every raw read itself (card SC8, A414), so any finding on the repo fails by name.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../../src/core/testing/read-own-source.ts'
import fs from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX_REL = 'tools/test/__fixtures__/source-read-rules'
const fix = (name) => readOwnSource(path.join(ROOT, ...FIX_REL.split('/'), name))
const readRel = (rel) => readOwnSource(path.join(ROOT, ...rel.split('/')))

// ---------- known defects: none (card SC8: "KNOWN ends empty") ----------
// An entry would be { rule, file, problems: [exact strings], owner, why } (testing.md, A407). Any problem not listed
// fails, and a listed string no longer printed fails as stale.
const KNOWN = []
function onlyKnown(rule, problems, known = KNOWN) {
  const mine = known.filter((k) => k.rule === rule)
  const listed = new Set(mine.flatMap((k) => k.problems))
  const unknown = problems.filter((p) => !listed.has(p))
  const stale = mine.flatMap((k) =>
    k.problems.filter((s) => !problems.includes(s)).map((s) => `stale KNOWN entry ${k.rule} ${k.file} (owner ${k.owner}): ${JSON.stringify(s)} no longer fails; remove it`),
  )
  return [...new Set(unknown), ...stale]
}

// ---------- file scans: never empty, and a named sentinel file is in each (findings SC RC3) ----------
function scanProblems(label, files, sentinel) {
  if (files.length === 0) return [`${label}: the scan read no file`]
  return files.includes(sentinel) ? [] : [`${label}: the scan missed its sentinel ${sentinel}`]
}

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.stryker-tmp', 'coverage', 'test-results', 'playwright-report', '__fixtures__', '__golden__'])
function walk(dirRel, out = []) {
  const abs = path.join(ROOT, dirRel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const r = dirRel === '' ? e.name : `${dirRel}/${e.name}`
    if (r === '.claude/worktrees' || r === 'reference' || r === 'plan' || r === 'reports') continue
    if (e.isDirectory()) walk(r, out)
    else out.push(r)
  }
  return out
}
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f)

// The tests Stryker runs inside its sandbox: vitest.mutate.config.ts's include and exclude, read from the config itself
// (A426: derived from the contract, never copied). A test outside it never sees an instrumented file.
async function mutationRunTests() {
  const { default: config } = await import('../../vitest.mutate.config.ts')
  const { include, exclude } = config.test
  return walk('').filter((f) => include.some((g) => path.matchesGlob(f, g)) && !exclude.some((g) => path.matchesGlob(f, g))).sort()
}

/** Src files marked `// @mutate` in their first 5 lines (the marker mutate-changed.mjs reads), read as committed. */
const isMarked = (text) => text.split('\n').slice(0, 5).some((l) => l.includes('// @mutate'))
function mutateFiles() {
  return walk('src').filter((f) => /\.tsx?$/.test(f) && !isTest(f) && !f.endsWith('.d.ts') && isMarked(readRel(f)))
}

// ---------- path resolution ----------
// A value is a list of possible repo-relative POSIX paths; U marks a span the rule cannot know.
const U = '\u0000'
const norm = (p) => {
  const out = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..' && !out[out.length - 1].includes(U)) out.pop()
      else out.push('..')
    } else out.push(seg)
  }
  return out.join('/')
}
const joinAll = (parts) => norm(parts.filter((p) => p !== '').join('/'))
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const MAX = 64
const cap = (vals) => [...new Set(vals)].slice(0, MAX)
const cross = (lists, combine) => lists.reduce((acc, list) => acc.flatMap((a) => list.map((b) => [...a, b])).slice(0, MAX * 4), [[]]).map(combine)

const READS = new Set(['readFileSync', 'readFile', 'createReadStream'])
const ARRAY_PASS = new Set(['filter', 'slice', 'sort', 'toSorted', 'reverse', 'toReversed', 'concat', 'flat'])
const CALLBACK = new Set(['map', 'flatMap', 'forEach', 'filter', 'some', 'every', 'find', 'findLast', 'reduce'])

/**
 * Every raw read in one test file's text, as [{ line, callee, targets }] where targets are the @mutate files its path
 * can resolve to. `rel` is where the file sits (its __dirname and import.meta.url).
 */
function rawReads(rel, text, marked) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const here = dirOf(rel)
  // What a name means where it is used: the nearest enclosing scope that declares it (a parameter, a loop variable,
  // or a const / let in a block), so two callbacks that both call their item `f` never share a value.
  const paramMeaning = (fn, prm) => {
    const call = fn.parent
    if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && call && ts.isCallExpression(call) && call.arguments[0] === fn && fn.parameters[0] === prm) {
      const callee = call.expression
      if (ts.isPropertyAccessExpression(callee) && CALLBACK.has(callee.name.text)) return { of: callee.expression }
    }
    return { unknown: true }
  }
  const varMeaning = (d) => {
    const owner = d.parent?.parent
    if (owner && (ts.isForOfStatement(owner) || ts.isForInStatement(owner)) && owner.initializer === d.parent) return { of: owner.expression }
    return d.initializer ? { is: d.initializer } : { unknown: true }
  }
  const declsIn = (scope, name) => {
    const out = []
    if (ts.isFunctionLike(scope)) for (const prm of scope.parameters) if (ts.isIdentifier(prm.name) && prm.name.text === name) out.push(paramMeaning(scope, prm))
    if ((ts.isForOfStatement(scope) || ts.isForInStatement(scope) || ts.isForStatement(scope)) && scope.initializer && ts.isVariableDeclarationList(scope.initializer)) {
      for (const d of scope.initializer.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) out.push(varMeaning(d))
    }
    const statements = ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope) || ts.isCaseClause(scope) || ts.isDefaultClause(scope) ? scope.statements : []
    for (const st of statements) {
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) out.push(varMeaning(d))
    }
    return out
  }
  const meaningsOf = (id) => {
    for (let scope = id.parent; scope; scope = scope.parent) {
      const found = declsIn(scope, id.text)
      if (found.length > 0) return found
    }
    return []
  }

  const PATH_FNS = new Set(['join', 'resolve', 'normalize', 'dirname'])
  const calleeName = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null)
  const isPathMod = (e) => ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && ['path', 'posix', 'nodePath'].includes(e.expression.text)

  /** The possible values of an expression; [] means "nothing known". Memoised per node; a cycle knows nothing. */
  const memo = new Map()
  function val(node, depth = 0) {
    if (depth > 24) return []
    if (memo.has(node)) return memo.get(node)
    memo.set(node, [])
    const out = cap(valOf(node, depth))
    memo.set(node, out)
    return out
  }
  function valOf(node, depth) {
    const v = (n) => val(n, depth + 1)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text]
    if (ts.isTemplateExpression(node)) {
      const lists = [[node.head.text]]
      for (const span of node.templateSpans) {
        const e = v(span.expression)
        lists.push(e.length > 0 ? e : [U], [span.literal.text])
      }
      return cap(cross(lists, (parts) => parts.join('')))
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return v(node.expression)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const l = v(node.left)
      const r = v(node.right)
      return cap(cross([l.length > 0 ? l : [U], r.length > 0 ? r : [U]], (p) => p.join('')))
    }
    if (ts.isArrayLiteralExpression(node)) return cap(node.elements.flatMap((e) => v(ts.isSpreadElement(e) ? e.expression : e)))
    if (ts.isMetaProperty(node)) return []
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isMetaProperty(node.expression)) {
        if (node.name.text === 'url' || node.name.text === 'filename') return [rel]
        if (node.name.text === 'dirname' || node.name.text === 'dir') return [here]
      }
      return []
    }
    if (ts.isIdentifier(node)) {
      if (node.text === '__dirname') return [here]
      if (node.text === '__filename') return [rel]
      return cap(meaningsOf(node).flatMap((d) => ('is' in d ? v(d.is) : 'of' in d ? v(d.of) : [])))
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.length) {
      const relPart = v(node.arguments[0])
      const base = node.arguments[1] ? v(node.arguments[1]) : []
      if (base.length === 0) return []
      return cap(cross([relPart.length > 0 ? relPart : [U], base], ([r, b]) => joinAll([dirOf(b), r])))
    }
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression)
      const args = node.arguments.map((a) => v(a))
      if (name === 'fileURLToPath' || name === 'pathToFileURL' || name === 'String') return args[0] ?? []
      if (name !== null && PATH_FNS.has(name) && (isPathMod(node.expression) || ts.isIdentifier(node.expression))) {
        if (name === 'dirname') return (args[0] ?? []).map(dirOf)
        if (args.length === 0) return []
        return cap(cross(args.map((a) => (a.length > 0 ? a : [U])), (parts) => joinAll(parts)))
      }
      if (ts.isPropertyAccessExpression(node.expression) && name !== null && ARRAY_PASS.has(name)) return cap([...v(node.expression.expression), ...args.flat()])
      // A list built from a directory: any other call given a known path stands for the files under it.
      const dirs = args.flat().filter((p) => !p.includes(U))
      return cap(dirs.map((d) => joinAll([d, U])))
    }
    return []
  }

  const asRe = (p) => new RegExp(`^${p.split(U).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
  const reads = []
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n.expression)
      if (name !== null && READS.has(name) && n.arguments.length > 0) {
        const vals = val(n.arguments[0]).filter((p) => p.replace(new RegExp(U, 'g'), '').replace(/\//g, '') !== '')
        const targets = [...new Set(vals.flatMap((p) => (p.includes(U) ? marked.filter((m) => asRe(p).test(m)) : marked.includes(p) ? [p] : [])))].sort()
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
        reads.push({ line, callee: n.expression.getText(sf), resolved: vals, targets })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return reads
}

/** R79 problem strings for one test file. */
function r79Problems(rel, text, marked) {
  return rawReads(rel, text, marked).flatMap((r) =>
    r.targets.map((t) => `${rel}:${String(r.line)}: ${r.callee} reads ${t} (marked // @mutate); read it through readOwnSource`),
  )
}

// The marked set the plants are judged against, pinned so a card adding or removing a marker never changes them.
const PINNED_MARKED = ['src/core/clock.ts', 'src/core/env.ts', 'src/core/ids.ts', 'src/core/log.ts', 'src/core/money.ts', 'src/modules/ocr/index.ts', 'src/contracts/reading.ts']

describe('R79 a test reads a @mutate source through readOwnSource, never fs (ARC-15, ARC-16; FX2 findings RC2)', () => {
  test('R79 ARC-15 the planted ocr/engine-setting.test.ts as at FX2 6a8531b is caught (path.join(__dirname, "index.ts"))', () => {
    const text = fix('planted-ocr-engine-setting-6a8531b.test.ts.txt')
    expect(text).toContain("fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8')")
    expect(r79Problems('src/modules/ocr/engine-setting.test.ts', text, PINNED_MARKED)).toEqual([
      'src/modules/ocr/engine-setting.test.ts:87: fs.readFileSync reads src/modules/ocr/index.ts (marked // @mutate); read it through readOwnSource',
    ])
  })

  test('R79 ARC-15 a path built through variables (consts, a template and "+") is caught', () => {
    expect(r79Problems('src/core/variable.test.ts', fix('planted-variable-path.test.ts.txt'), PINNED_MARKED)).toEqual([
      'src/core/variable.test.ts:13: fs.readFileSync reads src/core/money.ts (marked // @mutate); read it through readOwnSource',
    ])
  })

  test('R79 ARC-15 reads through fs.promises.readFile and node:fs/promises readFile are caught', () => {
    expect(r79Problems('src/core/promises.test.ts', fix('planted-promises.test.ts.txt'), PINNED_MARKED)).toEqual([
      'src/core/promises.test.ts:7: fs.promises.readFile reads src/core/ids.ts (marked // @mutate); read it through readOwnSource',
      'src/core/promises.test.ts:8: readFile reads src/core/log.ts (marked // @mutate); read it through readOwnSource',
    ])
  })

  test('R79 ARC-15 reads in a loop over names and over a directory listing are caught for every file they reach', () => {
    expect(r79Problems('src/core/loop.test.ts', fix('planted-loop.test.ts.txt'), PINNED_MARKED)).toEqual([
      'src/core/loop.test.ts:11: readFileSync reads src/core/clock.ts (marked // @mutate); read it through readOwnSource',
      'src/core/loop.test.ts:11: readFileSync reads src/core/env.ts (marked // @mutate); read it through readOwnSource',
      ...['clock', 'env', 'ids', 'log', 'money'].map((m) => `src/core/loop.test.ts:16: readFileSync reads src/core/${m}.ts (marked // @mutate); read it through readOwnSource`),
    ])
  })

  test('R79 ARC-15 no false alarm: readOwnSource reads, data-file reads, an unmarked source and an unknowable parameter', () => {
    const text = fix('clean-reads.test.ts.txt')
    const reads = rawReads('src/contracts/clean.test.ts', text, PINNED_MARKED)
    // the resolver did see the raw reads and knew where two of them go: the clean result is not a blind spot
    expect(reads.map((r) => r.resolved)).toEqual([['data/facts/catalogue.json'], ['src/core/testing/read-own-source.ts'], [], ['data/facts/catalogue.json']])
    expect(r79Problems('src/contracts/clean.test.ts', text, PINNED_MARKED)).toEqual([])
  })

  test('R79 ARC-15 a marker in the first 5 lines is what makes a file a mutation target, as in mutate-changed.mjs', () => {
    expect(isMarked('// a\n// b\n// c\n// d\n// @mutate\n')).toBe(true)
    expect(isMarked('// a\n// b\n// c\n// d\n// e\n// @mutate\n')).toBe(false)
    expect(readRel('tools/mutate-changed.mjs')).toContain(".split('\\n').slice(0, 5).some((l) => l.includes('// @mutate'))")
  })

  test('R79 ARC-15 ARC-16 every test Stryker runs (vitest.mutate.config.ts) reads @mutate sources through readOwnSource (KNOWN empty)', { timeout: 60_000 }, async () => {
    const marked = mutateFiles()
    expect(scanProblems('R79 @mutate files', marked, 'src/core/money.ts')).toEqual([])
    const tests = await mutationRunTests()
    expect(scanProblems('R79 test files', tests, 'src/modules/ocr/engine-setting.test.ts')).toEqual([])
    const all = tests.map((f) => [f, rawReads(f, readRel(f), marked)])
    // the resolver worked on real code: a named raw read of a data file resolved to its path
    const bank = all.find(([f]) => f === 'src/modules/gaps/bank/bank.test.ts')?.[1] ?? []
    expect(bank.flatMap((r) => r.resolved)).toContain('data/facts/catalogue.json')
    const problems = tests.flatMap((f) => r79Problems(f, readRel(f), marked))
    expect(onlyKnown('R79', problems)).toEqual([])
    expect(KNOWN).toEqual([])
  })
})
