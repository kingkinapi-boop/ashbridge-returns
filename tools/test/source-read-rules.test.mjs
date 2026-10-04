// SC8: R79, every test that reads the text of a src file marked `// @mutate` reads it through readOwnSource (unit
// project). Card plan/cards/SC8.md; clauses ARC-15, ARC-16; testing.md ("Source-scan tests ... read the file through
// readOwnSource"); reports/FX2-findings.md RC2; spec patch from reports/SC8-spec-review.md (G1 to G6, A436). Stryker
// rewrites a @mutate file inside its sandbox and the preamble it adds holds `process.env`
// (tools/test/__fixtures__/source-read-rules/stryker-sandbox-mod.ts.txt, captured from @stryker-mutator/instrumenter
// 10.0.0), so a raw read there scans the instrumented copy and the dry run fails.
//
// A finding is any read of a @mutate src file's text other than readOwnSource, however the path is built:
// - read calls: readFileSync, readFile, createReadStream, open, openSync (on fs, fs.promises, node:fs/promises, a
//   named import, an aliased import `{ readFileSync as rf }`, a destructured or assigned alias), `fs['readFileSync']`,
//   and `.call` / `.apply` of any of these (G2);
// - Vite `?raw` imports, which give the text of the file Vite serves (the sandbox copy): static, dynamic and
//   `import.meta.glob` with `query: '?raw'` or `as: 'raw'` (G4);
// - paths from literals, consts, templates, `+`, path.join / resolve / normalize / dirname / relative,
//   new URL(rel, base) and its .pathname / .href, fileURLToPath, import.meta.url / dirname / filename / resolve,
//   __dirname, process.cwd(), require.resolve and createRequire(...).resolve (an extensionless specifier tries .ts,
//   .tsx and /index.ts) (G3), loop and callback variables over a list, a list built from a directory (`files(dir)`),
//   `.map` / `.flatMap` callbacks, a local function's return value, and a local function's parameter bound at its call
//   sites, rest parameters included (G1).
// Scanned: every test Stryker runs (vitest.mutate.config.ts), and the harnesses those tests import (non-test .ts files
// under src/**/__fixtures__/ and src/core/testing/, except read-own-source.ts itself) (G6).
// A path that resolves to nothing known (a parameter never called with a value) is not a finding: the rule names what
// it can prove. Accepted limits (SC8 review, no test): object-property paths (`cfg.file`), `let` reassignment and
// arrays filled by `push`, paths imported from another module, and shell commands such as `cat`.
//
// The rule is first shown catching planted bad examples, then applied to the repo. KNOWN (A407 shape) is empty: the
// card's build switches every raw read itself (card SC8, A414), so any finding on the repo fails by name. The listed
// tests keep their titles, `expect(` counts and skips as at the SC8 spec tip 40391e96 (G5, tools/test/__fixtures__/
// source-read-rules/listed-baseline.json): the build changes only the read.
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
function walk(dirRel, out = [], skip = SKIP_DIRS) {
  const abs = path.join(ROOT, dirRel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (skip.has(e.name)) continue
    const r = dirRel === '' ? e.name : `${dirRel}/${e.name}`
    if (r === '.claude/worktrees' || r === 'reference' || r === 'plan' || r === 'reports') continue
    if (e.isDirectory()) walk(r, out, skip)
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

// G6: the helpers those tests import run in the sandbox too: every non-test TypeScript file under a src __fixtures__
// folder or src/core/testing, except readOwnSource itself.
const HELPER = 'src/core/testing/read-own-source.ts'
function sandboxHelpers() {
  const all = walk('src', [], new Set([...SKIP_DIRS].filter((d) => d !== '__fixtures__')))
  return all
    .filter((f) => /\.(?:m?ts|tsx)$/.test(f) && !isTest(f) && !f.endsWith('.d.ts') && f !== HELPER)
    .filter((f) => /(^|\/)__fixtures__\//.test(f) || f.startsWith('src/core/testing/'))
    .sort()
}

/** Src files marked `// @mutate` in their first 5 lines (the marker mutate-changed.mjs reads), read as committed. */
const isMarked = (text) => text.split('\n').slice(0, 5).some((l) => l.includes('// @mutate'))
function mutateFiles() {
  return walk('src').filter((f) => /\.tsx?$/.test(f) && !isTest(f) && !f.endsWith('.d.ts') && isMarked(readRel(f)))
}

// ---------- path resolution ----------
// A value is a list of possible repo-relative POSIX paths; U marks a span the rule cannot know, and B marks a value
// met again while it is still being worked out (a recursive function): such a value adds nothing.
const U = '\u0000'
const B = '\u0001'
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
const known = (p) => !p.includes(B) && p.replace(new RegExp(U, 'g'), '').replace(/\//g, '') !== ''

const READS = new Set(['readFileSync', 'readFile', 'createReadStream', 'open', 'openSync'])
const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises'])
const ARRAY_PASS = new Set(['filter', 'slice', 'sort', 'toSorted', 'reverse', 'toReversed', 'concat', 'flat'])
const STRING_PASS = new Set(['replace', 'replaceAll', 'trim', 'toString'])
const LISTS_NAMES = new Set(['readdirSync', 'readdir'])
const CALLBACK = new Set(['map', 'flatMap', 'forEach', 'filter', 'some', 'every', 'find', 'findLast', 'reduce'])
const RAW_QUERY = /[?&]raw(?:[&=]|$)/

/** A module specifier as the files it can name: `./money` tries money, money.ts, money.tsx and money/index.ts. */
function specFiles(baseDir, spec) {
  const bare = spec.replace(/\?.*$/, '')
  if (bare.includes(B)) return []
  const p = bare.startsWith('.') ? joinAll([baseDir, bare]) : bare.startsWith('/') ? norm(bare) : null
  if (p === null || p === '') return []
  const out = [p]
  if (/\.js$/.test(p)) out.push(p.replace(/\.js$/, '.ts'))
  if (!/\.[cm]?[jt]sx?$/.test(p)) out.push(`${p}.ts`, `${p}.tsx`, `${p}/index.ts`)
  return out
}

/** A Vite glob pattern (relative to baseDir, or to the root when it starts with /) as a regular expression. */
function globRe(baseDir, pattern) {
  const bare = pattern.replace(/\?.*$/, '')
  const full = bare.startsWith('/') ? norm(bare) : joinAll([baseDir, bare])
  let re = ''
  for (let i = 0; i < full.length; i++) {
    const c = full[i]
    if (c === '*' && full[i + 1] === '*') {
      re += full[i + 2] === '/' ? '(?:.*/)?' : '.*'
      i += full[i + 2] === '/' ? 2 : 1
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '{') re += '(?:'
    else if (c === '}') re += ')'
    else if (c === ',') re += '|'
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

/**
 * Every raw read in one file's text, as [{ line, callee, resolved, targets }] where targets are the @mutate files its
 * path can resolve to. `rel` is where the file sits (its __dirname and import.meta.url).
 */
function rawReads(rel, text, marked) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const here = dirOf(rel)
  const strip = (e) => (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isAwaitExpression(e) ? strip(e.expression) : e)
  const calls = []
  const collect = (n) => {
    if (ts.isCallExpression(n)) calls.push(n)
    ts.forEachChild(n, collect)
  }
  collect(sf)

  // Local functions: `function f() {}` and `const f = (...) => ...` / `function () {}`, found by scope like any name.
  const isFnExpr = (e) => e !== undefined && (ts.isArrowFunction(strip(e)) || ts.isFunctionExpression(strip(e)))
  const fnName = (fn) => {
    if (ts.isFunctionDeclaration(fn)) return fn.name?.text ?? null
    let p = fn.parent
    while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p))) p = p.parent
    return p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : null
  }
  const statementsOf = (scope) => (ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope) || ts.isCaseClause(scope) || ts.isDefaultClause(scope) ? scope.statements : [])
  const localFn = (id) => {
    for (let scope = id.parent; scope; scope = scope.parent) {
      for (const st of statementsOf(scope)) {
        if (ts.isFunctionDeclaration(st) && st.name?.text === id.text && st.body) return st
        if (ts.isVariableStatement(st)) {
          for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === id.text) return isFnExpr(d.initializer) ? strip(d.initializer) : null
        }
      }
      if (ts.isFunctionLike(scope) && scope.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === id.text)) return null
    }
    return null
  }
  const callSites = (fn) => {
    const name = fnName(fn)
    return name === null ? null : calls.filter((c) => ts.isIdentifier(c.expression) && c.expression.text === name && localFn(c.expression) === fn)
  }
  const returnsOf = (fn) => {
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body]
    const out = []
    const walkR = (n) => {
      if (ts.isReturnStatement(n)) {
        if (n.expression) out.push(n.expression)
      } else if (!ts.isFunctionLike(n)) ts.forEachChild(n, walkR)
    }
    if (fn.body) ts.forEachChild(fn.body, walkR)
    return out
  }

  // What a name means where it is used: the nearest enclosing scope that declares it (a parameter, a loop variable,
  // or a const / let in a block), so two callbacks that both call their item `f` never share a value. A parameter of
  // a named local function means whatever its call sites pass (G1).
  const paramMeaning = (fn, prm) => {
    const call = fn.parent
    if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && call && ts.isCallExpression(call) && call.arguments[0] === fn && fn.parameters[0] === prm) {
      const callee = call.expression
      if (ts.isPropertyAccessExpression(callee) && CALLBACK.has(callee.name.text)) return [{ of: callee.expression }]
    }
    const sites = callSites(fn)
    if (sites === null) return [{ unknown: true }]
    const idx = fn.parameters.indexOf(prm)
    const out = []
    for (const c of sites) {
      if (c.arguments.slice(0, idx).some((a) => ts.isSpreadElement(a))) continue
      if (prm.dotDotDotToken) for (const a of c.arguments.slice(idx)) out.push({ is: ts.isSpreadElement(a) ? a.expression : a })
      else if (c.arguments[idx]) out.push({ is: c.arguments[idx] })
      else if (prm.initializer) out.push({ is: prm.initializer })
    }
    return out.length > 0 ? out : [{ unknown: true }]
  }
  const varMeaning = (d) => {
    const owner = d.parent?.parent
    if (owner && (ts.isForOfStatement(owner) || ts.isForInStatement(owner)) && owner.initializer === d.parent) return { of: owner.expression }
    return d.initializer ? { is: d.initializer } : { unknown: true }
  }
  const declsIn = (scope, name) => {
    const out = []
    if (ts.isFunctionLike(scope)) for (const prm of scope.parameters) if (ts.isIdentifier(prm.name) && prm.name.text === name) out.push(...paramMeaning(scope, prm))
    if ((ts.isForOfStatement(scope) || ts.isForInStatement(scope) || ts.isForStatement(scope)) && scope.initializer && ts.isVariableDeclarationList(scope.initializer)) {
      for (const d of scope.initializer.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) out.push(varMeaning(d))
    }
    for (const st of statementsOf(scope)) {
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
  /** For `...p` where p is a rest parameter of a named local function: the argument lists its call sites pass. */
  const restSites = (id) => {
    if (!ts.isIdentifier(id)) return null
    for (let scope = id.parent; scope; scope = scope.parent) {
      if (!ts.isFunctionLike(scope)) continue
      const prm = scope.parameters.find((p) => ts.isIdentifier(p.name) && p.name.text === id.text)
      if (!prm) continue
      if (!prm.dotDotDotToken) return null
      const sites = callSites(scope)
      if (sites === null) return null
      const idx = scope.parameters.indexOf(prm)
      return sites.map((c) => c.arguments.slice(idx))
    }
    return null
  }

  const PATH_FNS = new Set(['join', 'resolve', 'normalize', 'dirname'])
  const calleeName = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null)
  const isPathMod = (e) => ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && ['path', 'posix', 'nodePath'].includes(e.expression.text)
  const isCall = (e, name) => ts.isCallExpression(e) && calleeName(e.expression) === name
  const isImportMeta = (e) => ts.isMetaProperty(e) && e.keywordToken === ts.SyntaxKind.ImportKeyword

  /** The possible values of an expression; [] means "nothing known". Memoised per node unless it leans on a value
   * still being worked out (a cycle through a recursive function), which adds nothing (B). */
  const memo = new Map()
  const onStack = new Map()
  let low = Infinity
  function val(node, depth = 0) {
    if (memo.has(node)) return memo.get(node)
    if (onStack.has(node)) {
      low = Math.min(low, onStack.get(node))
      return [B]
    }
    if (depth > 24) {
      low = -1
      return []
    }
    const mine = onStack.size
    onStack.set(node, mine)
    const outer = low
    low = Infinity
    const out = cap(valOf(node, depth))
    onStack.delete(node)
    if (low >= mine) {
      memo.set(node, out)
      low = outer
    } else low = Math.min(outer, low)
    return out
  }
  /** Where `X.resolve(spec)` resolves from, when X is `require` or a createRequire(...) result; null otherwise. */
  function requireBase(e, v) {
    const x = strip(e)
    if (isCall(x, 'createRequire')) return x.arguments[0] ? v(x.arguments[0]).map(dirOf) : null
    if (!ts.isIdentifier(x)) return null
    const ms = meaningsOf(x)
    for (const m of ms) if ('is' in m && isCall(strip(m.is), 'createRequire')) return requireBase(m.is, v)
    return x.text === 'require' && ms.length === 0 ? [here] : null
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
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node) || ts.isAwaitExpression(node)) return v(node.expression)
    if (ts.isConditionalExpression(node)) return cap([...v(node.whenTrue), ...v(node.whenFalse)])
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return cap([...v(node.left), ...v(node.right)])
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
      // a URL's pathname and href name the same file (G3)
      if (node.name.text === 'pathname' || node.name.text === 'href') return v(node.expression)
      return []
    }
    if (ts.isIdentifier(node)) {
      if (node.text === '__dirname') return [here]
      if (node.text === '__filename') return [rel]
      return cap(meaningsOf(node).flatMap((d) => ('is' in d ? v(d.is) : 'of' in d ? v(d.of) : [])))
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.length) {
      const relPart = v(node.arguments[0])
      if (!node.arguments[1]) return relPart
      const base = v(node.arguments[1])
      if (base.length === 0) return []
      return cap(cross([relPart.length > 0 ? relPart : [U], base], ([r, b]) => joinAll([dirOf(b), r])))
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const name = calleeName(callee)
      const args = node.arguments.map((a) => v(ts.isSpreadElement(a) ? a.expression : a))
      if (name === 'fileURLToPath' || name === 'pathToFileURL' || name === 'String') return args[0] ?? []
      // G3 roots: the working directory is the repo root (the sandbox root inside Stryker)
      if (name === 'cwd' && ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'process') return ['']
      if (name === 'resolve' && ts.isPropertyAccessExpression(callee) && isImportMeta(callee.expression)) return cap((args[0] ?? []).flatMap((s) => specFiles(here, s)))
      if (name === 'resolve' && ts.isPropertyAccessExpression(callee) && !isPathMod(callee)) {
        const bases = requireBase(callee.expression, v)
        if (bases !== null) return cap(bases.flatMap((b) => (args[0] ?? []).flatMap((s) => specFiles(b, s))))
      }
      // G1: a local function's return value
      const fn = ts.isIdentifier(callee) ? localFn(callee) : null
      if (fn) {
        const out = returnsOf(fn).flatMap((r) => v(r))
        if (out.some(known)) return out
      }
      if (!fn && name === 'relative' && (isPathMod(callee) || ts.isIdentifier(callee)) && args.length === 2) {
        return cap(cross([args[0], args[1]], ([from, to]) => (from === '' ? to : to.startsWith(`${from}/`) ? to.slice(from.length + 1) : B)))
      }
      if (!fn && name !== null && PATH_FNS.has(name) && (isPathMod(callee) || ts.isIdentifier(callee))) {
        if (name === 'dirname') return (args[0] ?? []).map(dirOf)
        if (args.length === 0) return []
        return cap(argAlternatives(node.arguments, v).flatMap((alt) => (alt.length === 0 ? [] : cross(alt.map((a) => (a.length > 0 ? a : [U])), (parts) => joinAll(parts)))))
      }
      // a directory listing gives bare names
      if (name !== null && LISTS_NAMES.has(name)) return [U]
      if (ts.isPropertyAccessExpression(callee) && name !== null && STRING_PASS.has(name)) return v(callee.expression)
      // G1: a list carried through .map / .flatMap is what the callback returns
      if (ts.isPropertyAccessExpression(callee) && (name === 'map' || name === 'flatMap') && isFnExpr(node.arguments[0])) return cap(returnsOf(strip(node.arguments[0])).flatMap((r) => v(r)))
      if (ts.isPropertyAccessExpression(callee) && name !== null && ARRAY_PASS.has(name)) return cap([...v(callee.expression), ...args.flat()])
      // A list built from a directory: any other call given a known path stands for the files under it.
      const dirs = args.flat().filter((p) => !p.includes(U) && !p.includes(B))
      return cap(dirs.map((d) => joinAll([d, U])))
    }
    return []
  }
  /** The argument lists a call can see, a rest parameter spread out per call site of its function (G1). */
  function argAlternatives(argNodes, v) {
    let alts = [[]]
    for (const a of argNodes) {
      let opts
      if (ts.isSpreadElement(a)) {
        const sites = restSites(strip(a.expression))
        if (sites !== null) opts = sites.map((exprs) => exprs.map((e) => v(ts.isSpreadElement(e) ? e.expression : e)))
        else if (ts.isArrayLiteralExpression(strip(a.expression))) opts = [strip(a.expression).elements.map((e) => v(e))]
        else opts = [[v(a.expression)]]
      } else opts = [[v(a)]]
      alts = alts.flatMap((acc) => opts.map((o) => [...acc, ...o])).slice(0, MAX)
    }
    return alts
  }

  // G2: the names a read function goes by in this file (aliased imports, destructured or assigned aliases).
  const aliases = new Set()
  const isReadFn = (e) => {
    const x = strip(e)
    if (ts.isIdentifier(x)) return READS.has(x.text) || aliases.has(x.text)
    if (ts.isPropertyAccessExpression(x)) return READS.has(x.name.text) || (x.name.text === 'bind' && isReadFn(x.expression))
    if (ts.isElementAccessExpression(x)) return ts.isStringLiteralLike(x.argumentExpression) && READS.has(x.argumentExpression.text)
    return false
  }
  const findAliases = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && FS_MODULES.has(n.moduleSpecifier.text)) {
      const nb = n.importClause?.namedBindings
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if (READS.has((el.propertyName ?? el.name).text)) aliases.add(el.name.text)
    }
    if (ts.isVariableDeclaration(n)) {
      if (ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) {
          const key = el.propertyName ?? el.name
          if (ts.isIdentifier(key) && READS.has(key.text) && ts.isIdentifier(el.name)) aliases.add(el.name.text)
        }
      } else if (ts.isIdentifier(n.name) && n.initializer && isReadFn(n.initializer)) aliases.add(n.name.text)
    }
    ts.forEachChild(n, findAliases)
  }
  findAliases(sf)
  /** The path argument of a read call, or null when the call is no read. */
  const readArg = (call) => {
    const e = strip(call.expression)
    if (isReadFn(e)) return { arg: call.arguments[0] }
    if (ts.isPropertyAccessExpression(e) && e.name.text === 'call' && isReadFn(e.expression)) return { arg: call.arguments[1] }
    if (ts.isPropertyAccessExpression(e) && e.name.text === 'apply' && isReadFn(e.expression)) {
      const list = call.arguments[1] && strip(call.arguments[1])
      return { arg: list && ts.isArrayLiteralExpression(list) ? list.elements[0] : undefined }
    }
    return null
  }

  const asRe = (p) => new RegExp(`^${p.split(U).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
  const targetsOf = (vals) => [...new Set(vals.flatMap((p) => (p.includes(U) ? marked.filter((m) => asRe(p).test(m)) : marked.includes(p) ? [p] : [])))].sort()
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const reads = []
  const visit = (n) => {
    // G4: a static `?raw` import
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && RAW_QUERY.test(n.moduleSpecifier.text)) {
      const resolved = specFiles(here, n.moduleSpecifier.text)
      reads.push({ line: lineOf(n), callee: 'import', resolved, targets: targetsOf(resolved) })
    }
    if (ts.isCallExpression(n)) {
      const r = readArg(n)
      if (r !== null && r.arg !== undefined) {
        const vals = val(r.arg).filter(known)
        reads.push({ line: lineOf(n), callee: n.expression.getText(sf), resolved: vals, targets: targetsOf(vals) })
      }
      // G4: a dynamic `?raw` import
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0]) {
        const specs = val(n.arguments[0]).filter((s) => !s.includes(B) && RAW_QUERY.test(s))
        if (specs.length > 0) {
          const resolved = cap(specs.flatMap((s) => specFiles(here, s)))
          reads.push({ line: lineOf(n), callee: 'import()', resolved, targets: targetsOf(resolved) })
        }
      }
      // G4: import.meta.glob with query '?raw' (or the older as: 'raw'), or a pattern carrying ?raw
      if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'glob' && isImportMeta(n.expression.expression) && n.arguments[0]) {
        const patterns = val(n.arguments[0]).filter((s) => !s.includes(B))
        const opts = n.arguments[1] ? n.arguments[1].getText(sf) : ''
        const raw = /\braw\b/.test(opts) || patterns.some((s) => RAW_QUERY.test(s))
        if (raw) {
          const positive = patterns.filter((s) => !s.startsWith('!'))
          const res = positive.map((s) => globRe(here, s))
          reads.push({ line: lineOf(n), callee: 'import.meta.glob', resolved: positive, targets: marked.filter((m) => res.some((re) => re.test(m))).sort() })
        }
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
const problem = (rel, line, callee, target) => `${rel}:${String(line)}: ${callee} reads ${target} (marked // @mutate); read it through readOwnSource`

// The marked set the plants are judged against, pinned so a card adding or removing a marker never changes them.
const PINNED_MARKED = ['src/core/clock.ts', 'src/core/env.ts', 'src/core/ids.ts', 'src/core/log.ts', 'src/core/money.ts', 'src/modules/ocr/index.ts', 'src/contracts/reading.ts']

// G5: the files today's raw reads target (all must stay marked), and the tests the build switches (card SC8 Paths;
// the last two from review G1). Each must stay in the mutation run, keep its shape and import readOwnSource.
const TARGETED = ['src/contracts/amount-grammar.ts', 'src/contracts/reading.ts', 'src/core/clock.ts', 'src/core/env.ts', 'src/core/ids.ts', 'src/core/log.ts', 'src/core/money.ts', 'src/modules/ocr/index.ts']
const LISTED = [
  'src/contracts/amount-grammar.acceptance.test.ts',
  'src/contracts/reading.acceptance.test.ts',
  'src/contracts/reading-strict.acceptance.test.ts',
  'src/core/clock.acceptance.test.ts',
  'src/core/env.acceptance.test.ts',
  'src/core/ids.acceptance.test.ts',
  'src/core/log.acceptance.test.ts',
  'src/core/money.acceptance.test.ts',
  'src/core/egress-rules.acceptance.test.ts',
  'src/modules/auth/rules.acceptance.test.ts',
]

/**
 * A test file's shape for G5, from its syntax (comments never count): its test and describe titles in order, its
 * `expect(` count, its skips (.skip, .skipIf, .runIf, .todo), and its sandbox guards (process.env, or a string naming
 * Stryker), so a build that drops, skips or guards a check is caught.
 */
function shapeOf(text) {
  const sf = ts.createSourceFile('shape.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const rootOf = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) || ts.isCallExpression(e) ? rootOf(e.expression) : null)
  const titles = []
  let expects = 0
  let skips = 0
  let guards = 0
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const root = rootOf(n.expression)
      if ((root === 'test' || root === 'it' || root === 'describe') && n.arguments.slice(1).some((a) => isFn(a))) titles.push(`${root} ${n.arguments[0].getText(sf)}`)
      if (ts.isIdentifier(n.expression) && n.expression.text === 'expect') expects += 1
      if (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'expect' && n.expression.name.text === 'soft') expects += 1
    }
    if (ts.isPropertyAccessExpression(n) && ['skip', 'skipIf', 'runIf', 'todo'].includes(n.name.text) && ['test', 'it', 'describe'].includes(rootOf(n.expression) ?? '')) skips += 1
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'env' && ts.isIdentifier(n.expression) && n.expression.text === 'process') guards += 1
    if (ts.isStringLiteralLike(n) && /stryker/i.test(n.text)) guards += 1
    ts.forEachChild(n, visit)
  }
  const isFn = (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)
  visit(sf)
  return { titles, expects, skips, guards }
}
/** Whether a file imports readOwnSource from src/core/testing/read-own-source. */
function importsReadOwnSource(rel, text) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return sf.statements.some((st) => {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) return false
    if (joinAll([dirOf(rel), st.moduleSpecifier.text]).replace(/\.ts$/, '') !== HELPER.replace(/\.ts$/, '')) return false
    const nb = st.importClause?.namedBindings
    return nb !== undefined && ts.isNamedImports(nb) && nb.elements.some((el) => (el.propertyName ?? el.name).text === 'readOwnSource')
  })
}

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

  test('R79 ARC-15 G1 reads behind local functions are caught: a wrapper, a rest-parameter wrapper, a return value and a list through .map', () => {
    const rel = 'src/core/wrapper.test.ts'
    expect(r79Problems(rel, fix('planted-wrapper.test.ts.txt'), PINNED_MARKED)).toEqual([
      problem(rel, 8, 'fs.readFileSync', 'src/core/money.ts'),
      problem(rel, 9, 'fs.readFileSync', 'src/core/ids.ts'),
      ...[...PINNED_MARKED].sort().map((m) => problem(rel, 27, 'fs.readFileSync', m)),
      ...[...PINNED_MARKED].sort().map((m) => problem(rel, 33, 'fs.readFileSync', m)),
    ])
  })

  test('R79 ARC-15 G2 other callee forms are caught, one problem per line, the callee printed as written', () => {
    const rel = 'src/core/callee.test.ts'
    expect(r79Problems(rel, fix('planted-callee-forms.test.ts.txt'), PINNED_MARKED)).toEqual([
      problem(rel, 10, 'rf', 'src/core/money.ts'),
      problem(rel, 11, "fs['readFileSync']", 'src/core/money.ts'),
      problem(rel, 12, 'fs.readFileSync.call', 'src/core/money.ts'),
      problem(rel, 13, 'fs.readFileSync.apply', 'src/core/money.ts'),
      problem(rel, 14, 'open', 'src/core/money.ts'),
      problem(rel, 15, 'fs.openSync', 'src/core/money.ts'),
    ])
  })

  test('R79 ARC-15 G3 paths from process.cwd(), require.resolve, createRequire().resolve, import.meta.resolve and a URL pathname or href are caught', () => {
    const rel = 'src/core/roots.test.ts'
    expect(r79Problems(rel, fix('planted-roots.test.ts.txt'), PINNED_MARKED)).toEqual([11, 12, 13, 14, 15, 16].map((l) => problem(rel, l, 'fs.readFileSync', 'src/core/money.ts')))
  })

  test('R79 ARC-15 G4 Vite ?raw imports (static, dynamic and import.meta.glob) are caught, naming every file they reach', () => {
    const rel = 'src/core/raw-import.test.ts'
    expect(r79Problems(rel, fix('planted-raw-import.test.ts.txt'), PINNED_MARKED)).toEqual([
      problem(rel, 3, 'import', 'src/core/money.ts'),
      problem(rel, 8, 'import()', 'src/core/ids.ts'),
      ...['clock', 'env', 'ids', 'log', 'money'].map((m) => problem(rel, 9, 'import.meta.glob', `src/core/${m}.ts`)),
      problem(rel, 10, 'import.meta.glob', 'src/modules/ocr/index.ts'),
    ])
  })

  test('R79 ARC-15 no false alarm: readOwnSource reads, data-file reads, an unmarked source and an unknowable parameter', () => {
    const text = fix('clean-reads.test.ts.txt')
    const reads = rawReads('src/contracts/clean.test.ts', text, PINNED_MARKED)
    // the resolver did see the raw reads and knew where two of them go: the clean result is not a blind spot
    expect(reads.map((r) => r.resolved).slice(0, 4)).toEqual([['data/facts/catalogue.json'], ['src/core/testing/read-own-source.ts'], [], ['data/facts/catalogue.json']])
    expect(r79Problems('src/contracts/clean.test.ts', text, PINNED_MARKED)).toEqual([])
  })

  test('R79 ARC-15 G1 no false alarm: a wrapper called only with a data file resolves to that file, and a ?url import is no read', () => {
    const reads = rawReads('src/contracts/clean.test.ts', fix('clean-reads.test.ts.txt'), PINNED_MARKED)
    expect(reads.map((r) => r.resolved)).toEqual([['data/facts/catalogue.json'], ['src/core/testing/read-own-source.ts'], [], ['data/facts/catalogue.json'], ['data/facts/catalogue.json']])
    expect(reads.map((r) => r.callee)).toEqual(['fs.readFileSync', 'fs.promises.readFile', 'fs.readFileSync', 'fs.readFileSync', 'fs.readFileSync'])
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

  test('R79 ARC-15 G6 the harnesses tests import (src __fixtures__ and src/core/testing) read @mutate sources through readOwnSource', { timeout: 60_000 }, () => {
    const marked = mutateFiles()
    const helpers = sandboxHelpers()
    expect(scanProblems('R79 sandbox helpers', helpers, 'src/modules/sheets/__fixtures__/harness.ts')).toEqual([])
    expect(helpers).not.toContain(HELPER)
    expect(helpers.filter((f) => isTest(f))).toEqual([])
    const problems = helpers.flatMap((f) => r79Problems(f, readRel(f), marked))
    expect(onlyKnown('R79', problems)).toEqual([])
  })
})

describe('R79 a wrong build cannot pass without switching the reads (SC8 review G5, A329)', () => {
  test('R79 ARC-15 G5 every file today\'s raw reads target stays marked // @mutate', () => {
    expect(mutateFiles()).toEqual(expect.arrayContaining(TARGETED))
  })

  test('R79 ARC-15 G5 every listed test is still in the mutation run, so the scan still reads it', { timeout: 60_000 }, async () => {
    const tests = await mutationRunTests()
    for (const f of LISTED) expect(tests).toContain(f)
  })

  const BASELINE = JSON.parse(fix('listed-baseline.json'))
  test('R79 ARC-15 G5 the baseline covers exactly the listed tests, captured at the spec tip 40391e96', () => {
    expect(BASELINE.capturedAt).toBe('40391e96')
    expect(Object.keys(BASELINE.files).sort()).toEqual([...LISTED].sort())
  })

  test.each(LISTED)('R79 ARC-15 G5 %s keeps its test titles, expect( count, skips and sandbox guards as at 40391e96', (f) => {
    expect(shapeOf(readRel(f))).toEqual(BASELINE.files[f])
  })

  test.each(LISTED)('R79 ARC-15 G5 %s imports readOwnSource from src/core/testing/read-own-source', (f) => {
    expect(importsReadOwnSource(f, readRel(f))).toBe(true)
  })

  test('R79 ARC-15 G5 the shape catches a dropped check, a skip and a sandbox guard; the import check needs the real helper', () => {
    const base = "import { expect, test } from 'vitest'\ntest('A x', () => {\n  expect(1).toBe(1)\n  expect(2).toBe(2)\n})\n"
    const shape = shapeOf(base)
    expect(shape).toEqual({ titles: ["test 'A x'"], expects: 2, skips: 0, guards: 0 })
    expect(shapeOf(base.replace('  expect(2).toBe(2)\n', ''))).not.toEqual(shape)
    expect(shapeOf(base.replace("test('A x'", "test.skipIf(true)('A x'"))).not.toEqual(shape)
    expect(shapeOf(base.replace("  expect(1)", "  if (process.env['X']) return\n  expect(1)"))).not.toEqual(shape)
    expect(shapeOf(base.replace("  expect(1)", "  if (process.cwd().includes('.stryker-tmp')) return\n  expect(1)"))).not.toEqual(shape)
    expect(shapeOf(`// a comment naming process.env and .stryker-tmp\n${base}`)).toEqual(shape)
    expect(importsReadOwnSource('src/core/money.acceptance.test.ts', "import { readOwnSource } from './testing/read-own-source'\n")).toBe(true)
    expect(importsReadOwnSource('src/contracts/reading.acceptance.test.ts', "import { readOwnSource } from '../core/testing/read-own-source.ts'\n")).toBe(true)
    expect(importsReadOwnSource('src/core/money.acceptance.test.ts', "import { readOwnSource } from './elsewhere'\n")).toBe(false)
    expect(importsReadOwnSource('src/core/money.acceptance.test.ts', "// import { readOwnSource } from './testing/read-own-source'\n")).toBe(false)
  })
})
