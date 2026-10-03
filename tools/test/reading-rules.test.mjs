// SC4: reading rules R67 to R70, R74 and the R56 exemption (unit project). Card plan/cards/SC4.md; clauses EV-14, EV-5,
// ARC-10. From reports/A07C-findings.md ("Rule tests for SC") and reports/A07D-opus-read.md (items 1 to 5). Each rule is
// first shown catching a planted bad example under tools/test/__fixtures__/reading-rules/, then applied to the repo.
//
// How "every" is reached: each rule keeps a registry of the functions it runs (one entry per reader, writer or
// rewriter), a source scan that finds product files doing the rule's kind of work with no registry entry, and a list
// of cards that must add an entry when they land (R68 and R69 "run on ... as they land"). A rule with nothing to check
// fails ("a pass with zero tests is a failure").
//
// A rule that fails on main is a defect of the card that owns the file (SC4: rules that fail on landed A07D code go in
// KNOWN with owner FX4, which fixes them; never weaken a rule, A329). An entry that no longer matches fails too, so the
// list only shrinks.
import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { cycles, nestedChain, place } from './__fixtures__/reading-rules/layouts.mjs'
import { NS, PKG_REL, workbookParts, xlsx, zipParts } from './__fixtures__/reading-rules/xlsx.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX_REL = 'tools/test/__fixtures__/reading-rules'
const FIX = path.join(ROOT, ...FIX_REL.split('/'))
const SEED = 20261003
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href)
const loadFix = (name) => import(pathToFileURL(path.join(FIX, name)).href)
const sample = (arb, numRuns) => fc.sample(arb, { seed: SEED, numRuns })

// ---------- known defects on main, each owned by another card ----------
const KNOWN = []

function onlyKnown(rule, problems) {
  const known = KNOWN.filter((k) => k.rule === rule)
  const unknown = problems.filter((p) => !known.some((k) => k.match.test(p)))
  const stale = known
    .filter((k) => !problems.some((p) => k.match.test(p)))
    .map((k) => `stale KNOWN entry ${k.rule} ${String(k.match)} (owner ${k.owner}): it no longer fails, remove it`)
  return [...unknown, ...stale]
}

/** Cards that must add an entry to a rule's registry here when their folder lands on main. */
const LANDING = [
  { rule: 'R68', card: 'E01', dir: 'src/modules/extraction/_core', what: 'arithmetic self-checks over extracted figures' },
  { rule: 'R68', card: 'B01', dir: 'src/modules/books/gifi', what: 'gifiTotals over mapped accounts' },
  { rule: 'R68', card: 'T01', dir: 'src/modules/roundtrip/figures', what: 'figures built from figures' },
  { rule: 'R68', card: 'L01', dir: 'src/modules/ledger/dots', what: "a figure's dot from its sources' dots" },
  { rule: 'R69', card: 'T01', dir: 'src/modules/roundtrip/import', what: 'the Taxprep import writer' },
]
function landingProblems(rule, registry) {
  return LANDING.filter((l) => l.rule === rule && exists(l.dir) && !registry.some((e) => e.card === l.card)).map(
    (l) => `${l.card}: landed (${l.dir}, ${l.what}) with no ${rule} entry in tools/test/reading-rules.test.mjs`,
  )
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
const productTs = (dirs) => dirs.flatMap((d) => walk(d)).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts') && !isTest(f) && !isFixture(f))
const PRODUCT_FILES = () => productTs(['src'])
const CONTRACT_AND_MODULE_FILES = () => productTs(['src/contracts', 'src/modules'])

/** Source with block and line comments blanked (a line comment needs a space or the line start before its "//"). */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|\s)\/\/.*$/gm, '$1')

/** Regex literals in source: `{ body, flags }`. */
function regexLiterals(src) {
  const out = []
  const re = /(?:^|[=(,:!&|?{};[]|\breturn)\s*\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+)\/([dgimsuvy]*)/gm
  for (const m of src.matchAll(re)) out.push({ body: m[1], flags: m[2] })
  return out
}
/** String literals in source (single, double or back quotes, one line). */
const stringLiterals = (src) => [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3])

// ---------- numbers ----------
const FLOAT_VIEW = new DataView(new ArrayBuffer(8))
function ulp(x) {
  const a = Math.abs(x)
  FLOAT_VIEW.setFloat64(0, a)
  FLOAT_VIEW.setBigInt64(0, FLOAT_VIEW.getBigInt64(0) + 1n)
  return FLOAT_VIEW.getFloat64(0) - a
}
const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/
/** The exact value of decimal text as n / 10^scale, or undefined when it is not decimal text. */
function exact(text) {
  const m = DECIMAL.exec(text)
  if (!m || `${m[2]}${m[3] ?? ''}` === '') return undefined
  const frac = m[3] ?? ''
  const n = BigInt(`${m[2]}${frac}` || '0')
  return { n: m[1] === '-' ? -n : n, scale: frac.length - Number(m[4] ?? 0) }
}
function sameValue(a, b) {
  const s = Math.max(a.scale, b.scale)
  return a.n * 10n ** BigInt(s - a.scale) === b.n * 10n ** BigInt(s - b.scale)
}
/** Significant digits of decimal text: leading and trailing zeros left out. */
function sigDigits(text) {
  const m = DECIMAL.exec(text)
  return m ? `${m[2]}${m[3] ?? ''}`.replace(/^0+/, '').replace(/0+$/, '').length : Infinity
}
const CENT_TEXT = /^-?\d+(?:\.\d{1,2})?$/
const centsOf = (text) => {
  const v = exact(text)
  return v === undefined ? undefined : { n: v.n, scale: v.scale }
}

// ---------- clock ----------
let restoreClock = () => {}
beforeAll(async () => {
  const { fixedClock, getClock, setClock } = await load('src/core/clock.ts')
  const saved = getClock()
  setClock(fixedClock('2026-10-03T09:00:00-04:00'))
  restoreClock = () => setClock(saved)
})
afterAll(() => restoreClock())

// =====================================================================================================================
// R67: one tokenizer for every rewrite or parse of a formula or identifier in file content
// =====================================================================================================================

/** Rewriters of formula text: each slides a shared formula from its master's address to a child's. */
const TOKENIZERS = [
  {
    name: 'sheets slide (A07)',
    file: 'src/modules/sheets/xlsx/raw.ts',
    get: async () => (await load('src/modules/sheets/xlsx/raw.ts')).slide,
  },
]

/** [formula, from, to, expected, where the case comes from] */
const SLIDE_CASES = [
  ["'Q4 FY2026'!B1*2", 'C1', 'C2', "'Q4 FY2026'!B2*2", 'D1: a quoted name holding letters and digits'],
  ["'It''s'!A1", 'C1', 'C2', "'It''s'!A2", "D1: a '' escape in a quoted name"],
  ["'A1:B2 [x] \"y\" !'!C3+1", 'C1', 'C2', "'A1:B2 [x] \"y\" !'!C4+1", 'R67: a quoted name holding the syntax itself'],
  ['SUM(A:A)', 'C1', 'D1', 'SUM(B:B)', 'D1: whole column'],
  ['SUM($A:A)', 'C1', 'D1', 'SUM($A:B)', 'D1: whole column, one end absolute'],
  ['SUM(1:1)', 'A1', 'A2', 'SUM(2:2)', 'D1: whole row'],
  ['SUM($1:$1)+SUM(A:A)', 'A1', 'B5', 'SUM($1:$1)+SUM(B:B)', 'R67: absolute whole row stays'],
  ['Sheet2!B1', 'C1', 'C2', 'Sheet2!B2', 'D1: plain sheet prefix'],
  ['Sheet1:Sheet3!A1', 'C1', 'C2', 'Sheet1:Sheet3!A2', 'R67: 3D reference over named sheets'],
  ['[1]Sheet1!A1', 'C1', 'C2', '[1]Sheet1!A2', 'R67: external book part'],
  ['"A1"&B1', 'C1', 'C2', '"A1"&B2', 'D1: a reference inside a string'],
  ['"say ""A1"""&A1', 'C1', 'C2', '"say ""A1"""&A2', 'R67: a "" escape inside a string'],
  ['Table1[Amount]', 'C1', 'C2', 'Table1[Amount]', 'D1: structured reference'],
  ['Table1[[#This Row],[A1]]+B1', 'C1', 'C2', 'Table1[[#This Row],[A1]]+B2', 'R67: nested brackets holding a reference-like name'],
  ['LOG10(A1)', 'C1', 'C2', 'LOG10(A2)', 'D1: a function name ending in digits'],
  ['$A$1+A$1+$A1', 'C1', 'D2', '$A$1+B$1+$A2', 'R67: absolute and mixed parts'],
  ['A1', 'C2', 'C1', '#REF!', 'D1: slides up off the sheet'],
  ['XFD1', 'A1', 'B1', '#REF!', 'D1: slides right off the sheet'],
  ["Table1[Col'[1]+A1", 'C1', 'C2', "Table1[Col'[1]+A2", "A07D Opus read item 4: a ' escape inside a structured reference"],
  ['XYZ100*2', 'C1', 'C2', 'XYZ100*2', 'A07D Opus read item 5a: a name past column XFD'],
  ['A1048577+1', 'C1', 'C2', 'A1048577+1', 'A07D Opus read item 5a: a name past row 1048576'],
  ['ÜB1*2', 'C1', 'C2', 'ÜB1*2', 'A07D Opus read item 5b: a name with a non-ASCII letter'],
  ['SUM(Q1:Q4!B1)', 'C1', 'C2', 'SUM(Q1:Q4!B2)', 'A07D Opus read item 5c: an unquoted 3D range of sheets'],
]

const letterOf = (n) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
const dollar = fc.boolean().map((b) => (b ? '$' : ''))
const colArb = fc.integer({ min: 1, max: 60 }).map(letterOf)
const rowArb = fc.integer({ min: 1, max: 300 })
const cellArb = fc.tuple(dollar, colArb, dollar, rowArb).map(([a, c, b, r]) => `${a}${c}${b}${String(r)}`)
const refArb = fc.oneof(
  cellArb,
  fc.tuple(cellArb, cellArb).map(([a, b]) => `${a}:${b}`),
  fc.tuple(dollar, colArb, dollar, colArb).map(([a, c, b, d]) => `${a}${c}:${b}${d}`),
  fc.tuple(dollar, rowArb, dollar, rowArb).map(([a, r, b, s]) => `${a}${String(r)}:${b}${String(s)}`),
)
const sheetArb = fc.constantFrom('', '', 'Sheet2!', "'Q4 FY2026'!", "'It''s (Test)'!", "'A1:B2 [x] \"y\" !'!", '[1]Sheet1!', 'Sheet1:Sheet3!')
const PROTECTED = ['"A1 (Test)"', '"B2:C3"', `"'x'!A1"`, '""""', '"SUM(A:A)"', 'Table1[Amount]', 'Table1[[#This Row],[A1]]', 'Table1[#Totals]']
const WORDS = ['SUM(', 'LOG10(', '_xlfn.XLOOKUP(', 'TaxRate', 'Rate_2026', ')', '1.5E+3', '100', 'TRUE']
const tokenArb = fc.oneof(
  fc.tuple(sheetArb, refArb).map(([s, r]) => ({ text: `${s}${r}`, kept: /^'/.test(s) ? [s.slice(0, -1)] : s.startsWith('[') ? ['[1]'] : [] })),
  fc.constantFrom(...PROTECTED).map((p) => ({ text: p, kept: [p] })),
  fc.constantFrom(...WORDS).map((w) => ({ text: w, kept: [] })),
)
const formulaArb = fc
  .tuple(fc.array(tokenArb, { minLength: 1, maxLength: 8 }), fc.array(fc.constantFrom('+', '-', '*', '/', '&', ',', '^', ' '), { minLength: 8, maxLength: 8 }))
  .map(([tokens, ops]) => ({ formula: tokens.map((t, i) => (i === 0 ? t.text : `${ops[i] ?? '+'}${t.text}`)).join(''), kept: tokens.flatMap((t) => t.kept) }))
const moveArb = fc.tuple(fc.integer({ min: 6, max: 30 }), fc.integer({ min: 6, max: 30 }), fc.integer({ min: -5, max: 5 }), fc.integer({ min: -5, max: 5 }))

/** Every way a slider can fail the tokenizer cases and properties. */
function slideProblems(name, slide) {
  const problems = []
  const call = (f, from, to) => {
    try {
      return slide(f, from, to)
    } catch (e) {
      return `threw ${e instanceof Error ? e.name : String(e)}`
    }
  }
  for (const [f, from, to, want, where] of SLIDE_CASES) {
    const got = call(f, from, to)
    if (got !== want) problems.push(`${name}: slide(${JSON.stringify(f)}, ${from}, ${to}) gave ${JSON.stringify(got)}, expected ${JSON.stringify(want)} (${where})`)
    const still = call(f, 'C3', 'C3')
    if (still !== f) problems.push(`${name}: slide(${JSON.stringify(f)}) by (0, 0) gave ${JSON.stringify(still)} (${where})`)
  }
  const firsts = new Map()
  const note = (key, text) => {
    if (!firsts.has(key)) firsts.set(key, `${name}: ${text}`)
  }
  for (const [{ formula, kept }, [c, r, dc, dr]] of sample(fc.tuple(formulaArb, moveArb), 400)) {
    const from = `${letterOf(c)}${String(r)}`
    const to = `${letterOf(c + dc)}${String(r + dr)}`
    if (call(formula, from, from) !== formula) note('identity', `property: sliding by (0, 0) changes text (first at ${JSON.stringify(formula)})`)
    const there = call(formula, from, to)
    let at = 0
    for (const k of kept) {
      const i = there.indexOf(k, at)
      if (i < 0) {
        note('kept', `property: text inside quotes or brackets changes (first: ${JSON.stringify(k)} in ${JSON.stringify(formula)} from ${from} to ${to} gave ${JSON.stringify(there)})`)
        break
      }
      at = i + k.length
    }
    if (!there.includes('#REF!') && call(there, to, from) !== formula) {
      note('back', `property: sliding out and back does not give the formula again (first at ${JSON.stringify(formula)} from ${from} to ${to})`)
    }
  }
  return [...problems, ...firsts.values()]
}

/** A cell reference shape inside a regex or a pattern string: column letters, then digits within a few characters. */
const REF_SHAPE = /\[A-Z\][^\n]{0,24}?\\{1,2}d/
/**
 * Product files that rewrite or parse formula references outside a registered tokenizer: an unanchored regex literal
 * of reference shape (or one with the g or y flag), or a pattern string of reference shape (a RegExp built from text).
 * A regex anchored at both ends with no g or y flag matches a whole address or a whole formula and is allowed.
 */
function refRegexProblems(files, readFile, tokenizerFiles) {
  const problems = []
  for (const f of files) {
    if (tokenizerFiles.includes(f)) continue
    const src = code(readFile(f))
    for (const { body, flags } of regexLiterals(src)) {
      if (!REF_SHAPE.test(body)) continue
      const anchored = body.startsWith('^') && /(?<!\\)\$$/.test(body) && !/[gy]/.test(flags)
      if (!anchored) problems.push(`${f}: rewrites or parses formula references with its own regex (/${body.slice(0, 40)}/${flags}); go through the tokenizer`)
    }
    for (const s of stringLiterals(src)) {
      if (REF_SHAPE.test(s)) problems.push(`${f}: builds a reference regex from text (${JSON.stringify(s.slice(0, 40))}); go through the tokenizer`)
    }
  }
  return problems
}

describe('SC4 R67: one tokenizer for formula and identifier text (EV-14, ARC-10)', () => {
  test("EV-14 R67 rule: a planted regex slider that changes 'Q4 FY2026' is caught by the cases and by the source scan", async () => {
    const { slide } = await loadFix('planted-r67-slide.mjs')
    const problems = slideProblems('planted slider', slide)
    expect(problems).toContain(
      `planted slider: slide("'Q4 FY2026'!B1*2", C1, C2) gave "'Q5 FY2027'!B2*2", expected "'Q4 FY2026'!B2*2" (D1: a quoted name holding letters and digits)`,
    )
    expect(problems.some((p) => p.startsWith('planted slider: slide("SUM(A:A)", C1, D1)'))).toBe(true)
    expect(problems.some((p) => p.startsWith('planted slider: property: text inside quotes or brackets changes'))).toBe(true)
    expect(refRegexProblems(['planted-r67-slide.mjs'], fix, [])).toEqual([
      'planted-r67-slide.mjs: rewrites or parses formula references with its own regex (/(\\$?)([A-Z]{1,3})(\\$?)(\\d+)/g); go through the tokenizer',
    ])
  })

  test('EV-14 R67 every registered formula rewriter passes the tokenizer cases (quoted names, whole rows and columns, strings, brackets, A07D items 4 and 5) and properties', async () => {
    expect(TOKENIZERS.length, 'nothing to check: no formula rewriter is registered').toBeGreaterThan(0)
    const problems = []
    for (const t of TOKENIZERS) {
      expect(exists(t.file), `nothing to check: ${t.file} is not on main`).toBe(true)
      const slide = await t.get()
      expect(typeof slide, `${t.file} exports no slide`).toBe('function')
      problems.push(...slideProblems(t.name, slide))
    }
    expect(onlyKnown('R67', problems)).toEqual([])
  })

  test('EV-14 R67 no product file outside a registered tokenizer rewrites or parses formula references with its own regex', () => {
    const files = PRODUCT_FILES()
    expect(files.length, 'nothing to check: no product files under src').toBeGreaterThan(0)
    expect(onlyKnown('R67-scan', refRegexProblems(files, read, TOKENIZERS.map((t) => t.file)))).toEqual([])
  })
})

// =====================================================================================================================
// R68: a value derived from other cells or figures is the same whatever order they are visited in
// =====================================================================================================================

/** The six terms of the A07B check's planted sum (cent amounts); their floating-point sum is 253914.87999999803. */
const TERMS = ['-7335624.99', '2860106.52', '-2434451.58', '8522880.37', '4815622.56', '-6174618']

/** Readers of derived values. `derive(cells)` takes cells `{ ref, f?, v }` and gives each cell's text by address. */
const DERIVERS = [
  {
    card: 'A07',
    name: 'sheets SUM snap (A07)',
    file: 'src/modules/sheets/xlsx/index.ts',
    get: async () => {
      const { createSheetsReader } = await load('src/modules/sheets/index.ts')
      return async (cells) => {
        const out = await createSheetsReader().read(xlsx({ cells }), 'layout (Test).xlsx')
        if (!out.ok) throw new Error(`refused: ${out.reason}`)
        return new Map(out.result.sheets[0].cells.map((c) => [`${c.column.letter}${String(c.row)}`, c.text]))
      }
    },
  },
]

const SYMMETRIES = [0, 1, 2, 3, 4, 5, 6, 7]
const rhoOf = (depth, keys) =>
  Array.from({ length: depth + 1 }, (_, i) => i)
    .sort((a, b) => (keys[a] ?? 0) - (keys[b] ?? 0) || a - b)
    .map((i) => i + 1)

/** Visit-order problems of one deriver: nested SUM chains moved around the grid, and reference cycles. */
async function orderProblems(name, derive) {
  const firsts = new Map()
  const note = (key, text) => {
    if (!firsts.has(key)) firsts.set(key, `${name}: ${text}`)
  }
  const textsOf = async (placed) => {
    const texts = await derive(placed.cells)
    return Object.fromEntries(Object.entries(placed.nodes).map(([n, ref]) => [n, texts.get(ref)]))
  }
  const base = new Map()
  const baseOf = async (depth) => {
    if (!base.has(depth)) {
      const identity = Array.from({ length: depth + 1 }, (_, i) => i + 1)
      base.set(depth, await textsOf(place(nestedChain(TERMS, depth, identity), { sym: 0, dr: 0, dc: 0 })))
    }
    return base.get(depth)
  }
  const fixed = [1, 2, 3].map((depth) => ({ depth, keys: Array.from({ length: depth + 1 }, (_, i) => -i), sym: 0, dr: 0, dc: 0 }))
  const drawn = sample(
    fc.record({
      depth: fc.integer({ min: 1, max: 4 }),
      keys: fc.array(fc.nat(), { minLength: 5, maxLength: 5 }),
      sym: fc.constantFrom(...SYMMETRIES),
      dr: fc.integer({ min: 0, max: 3 }),
      dc: fc.integer({ min: 0, max: 3 }),
    }),
    24,
  )
  for (const s of [...fixed, ...drawn]) {
    const rho = rhoOf(s.depth, s.keys)
    const want = await baseOf(s.depth)
    const got = await textsOf(place(nestedChain(TERMS, s.depth, rho), s))
    for (const node of Object.keys(want)) {
      if (got[node] !== want[node]) {
        note('nested', `nested SUMs read differently when the layout moves (first: depth ${String(s.depth)}, ${node} reads ${JSON.stringify(want[node])} with the outer total on top and ${JSON.stringify(got[node])} with rows ${rho.join(',')} and symmetry ${String(s.sym)})`)
      }
    }
  }
  for (const [caseName, { members, layout }] of Object.entries(cycles(TERMS))) {
    for (const sym of SYMMETRIES) {
      const placed = place(layout, { sym, dr: 1, dc: 1 })
      const texts = await textsOf(placed)
      for (const m of members) {
        const cached = layout.cells.find((c) => c.name === m).cached
        const own = String(Number(cached))
        if (texts[m] !== own) {
          note(`cycle ${caseName} ${m}`, `cycle "${caseName}": member ${m} was snapped (first in symmetry ${String(sym)}: ${JSON.stringify(texts[m])}, cached ${JSON.stringify(cached)}); every member of a cycle keeps its own text`)
        }
      }
    }
  }
  return [...firsts.values()]
}

describe('SC4 R68: derived values do not depend on visit order (EV-14, EV-5)', () => {
  test('EV-14 R68 rule: a planted row-major snap with the outer total above the inner one is caught, and so is its missed cycle member', async () => {
    const { derive } = await loadFix('planted-r68-snap.mjs')
    const problems = await orderProblems('planted snap', async (cells) => derive(cells))
    expect(problems.some((p) => p.startsWith('planted snap: nested SUMs read differently when the layout moves (first: depth 2, N0 reads '))).toBe(true)
    expect(problems.some((p) => p.startsWith('planted snap: cycle "joined": member Z was snapped'))).toBe(true)
  })

  test('EV-14 EV-5 R68 every registered deriver gives the same values whatever the layout, and finds every member of a cycle (joined through a finished node, through a non-SUM formula)', async () => {
    expect(DERIVERS.length, 'nothing to check: no deriver is registered').toBeGreaterThan(0)
    const problems = []
    for (const d of DERIVERS) {
      expect(exists(d.file), `nothing to check: ${d.file} is not on main`).toBe(true)
      problems.push(...(await orderProblems(d.name, await d.get())))
    }
    problems.push(...landingProblems('R68', DERIVERS))
    expect(onlyKnown('R68', problems)).toEqual([])
  }, 120_000)
})

// =====================================================================================================================
// R69: every number-to-text function is total over the doubles and invents no digits
// =====================================================================================================================

const EDGE_DOUBLES = [
  0, -0, 5e-324, -5e-324, 1e-310, 2.2250738585072014e-308, 1e-7, 0.1 + 0.2, 0.005, 0.5, 1.5, 12.3456, 100, 253914.87999999803, 1e13 + 0.01,
  46897341536252.6, 1e15, 1e16, 2 ** 53, 2 ** 53 + 2, 2 ** 64, 1e20, 1.00000000001e20, 1e21, 1e23, -1e23, 1e300, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER,
  -Number.MAX_SAFE_INTEGER, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
]
const DOMAINS = {
  finite: { arb: fc.double({ noNaN: true, noDefaultInfinity: true }), keep: (x) => Number.isFinite(x) },
  all: { arb: fc.oneof(fc.double(), fc.maxSafeInteger()), keep: () => true },
}
const taxprepRow = async (value) => {
  const { parseCellId, writeTaxprepCsv } = await load('src/contracts/taxprep.ts')
  const parsed = parseCellId('Rules.Value')
  return (x) => {
    const out = writeTaxprepCsv({ header: { returnName: 'Rules (Test)', guid: 'rules-test' }, rows: [{ id: parsed.id, current: value(x) }] }, { purpose: 'export' })
    if (!out.ok) return { refused: out.problems.map((p) => p.reason).join('; ') }
    const line = Buffer.from(out.bytes).toString('latin1').split('\r\n')[1]
    return { text: /^Rules\.Value,"([^"]*)"/.exec(line)?.[1] ?? `unreadable row ${line}` }
  }
}

/**
 * Number-to-text functions. `call(x)` gives `{ text }` or `{ refused }`; `mayRefuse(x)` says when a refusal is allowed;
 * `mapsBack(text, x)` says the text stands for x (each entry's own written rounding); `mustWrite` are values it may not refuse.
 */
const NUMBER_TEXT = [
  {
    card: 'A07',
    name: 'sheets numberText (A07)',
    file: 'src/modules/sheets/xlsx/index.ts',
    domain: 'finite', // a stored <v> is a finite double; typed() turns a non-finite value into #NUM! before numberText
    get: async () => {
      const { numberText } = await load('src/modules/sheets/xlsx/index.ts')
      return (x) => ({ text: numberText(x) })
    },
    mayRefuse: () => false,
    mapsBack: (text, x) => {
      const back = Number(text)
      return back === x || (CENT_TEXT.test(text) && Math.abs(back - x) <= Math.min(0.005, 4 * ulp(Math.max(Math.abs(x), Math.abs(back)))))
    },
    mustWrite: [0.5, 1e23, 5e-324],
  },
  {
    card: 'F01',
    name: 'money formatCents',
    file: 'src/core/money.ts',
    domain: 'all',
    get: async () => {
      const { formatCents } = await load('src/core/money.ts')
      return (x) => {
        try {
          return { text: formatCents(x) }
        } catch (e) {
          if (e instanceof RangeError) return { refused: e.message }
          throw e
        }
      }
    },
    mayRefuse: (x) => !Number.isSafeInteger(x),
    mapsBack: (text, x) => {
      const v = exact(text)
      return v !== undefined && /^-?\d+\.\d\d$/.test(text) && sameValue(v, { n: BigInt(x), scale: 2 })
    },
    mustWrite: [0, -1, 123456789, Number.MAX_SAFE_INTEGER],
  },
  {
    card: 'F03',
    name: 'Taxprep rate text (F03)',
    file: 'src/contracts/taxprep.ts',
    domain: 'all',
    get: () => taxprepRow((x) => ({ kind: 'rate', rate: x })),
    mayRefuse: () => true,
    mapsBack: (text, x) => /^\d+\.\d{4}$/.test(text) && Math.abs(Number(text) - x) <= 0.00005 + ulp(x),
    mustWrite: [0, 0.5, 12.3456, 100],
  },
  {
    card: 'F03',
    name: 'Taxprep amount text (F03)',
    file: 'src/contracts/taxprep.ts',
    domain: 'all',
    get: () => taxprepRow((x) => ({ kind: 'amount', amount: x })),
    mayRefuse: (x) => !Number.isSafeInteger(x),
    mapsBack: (text, x) => {
      const v = exact(text)
      return v !== undefined && Number.isSafeInteger(x) && sameValue(v, { n: BigInt(x), scale: 0 })
    },
    mustWrite: [0, -1, 123456789, Number.MAX_SAFE_INTEGER],
  },
]

/** Totality, no invented digits, no "0" for a nonzero value, and the text maps back. One line per kind of failure. */
function numberTextProblems(entry, fn) {
  const firsts = new Map()
  const note = (key, x, text) => {
    if (!firsts.has(key)) firsts.set(key, `${entry.name}: ${key} (first at ${String(x)}: ${JSON.stringify(text)})`)
  }
  const domain = DOMAINS[entry.domain]
  const xs = [...EDGE_DOUBLES.filter(domain.keep), ...entry.mustWrite, ...sample(domain.arb, 3000)]
  for (const x of xs) {
    let out
    try {
      out = fn(x)
    } catch (e) {
      note('throws instead of writing or refusing', x, e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      continue
    }
    if (out.refused !== undefined) {
      if (!entry.mayRefuse(x) || entry.mustWrite.some((m) => Object.is(m, x))) note('refuses a value it must write', x, out.refused)
      continue
    }
    const text = out.text
    if (typeof text !== 'string') {
      note('gives something other than text', x, String(text))
      continue
    }
    const value = exact(text)
    if (value === undefined) {
      note('gives text that is not a number', x, text)
      continue
    }
    if (sigDigits(text) > sigDigits(String(x))) note('invents digits (more significant digits than the shortest round-trip text)', x, text)
    if (x !== 0 && !Number.isNaN(x) && value.n === 0n) note('reads "0" for a nonzero value', x, text)
    if (!entry.mapsBack(text, x)) note('does not map back to the value', x, text)
  }
  return [...firsts.values()]
}

/** The SUM total text from big cents terms: [big term cents, small term cents] (A07D Opus read item 1 and more). */
const SUM_CENTS_FIXED = [
  [4689734153581555n, 43705n],
  [7053684657411262n, 97739n],
]
const centsText = (c) => {
  const a = c < 0n ? -c : c
  return `${c < 0n ? '-' : ''}${String(a / 100n)}.${String(a % 100n).padStart(2, '0')}`
}

/** Any cents-to-text of a SUM total maps back to the exact cents of its terms as read, or leaves the total unsnapped. */
async function sumCentsProblems(name, derive, numberText) {
  const pairs = [
    ...SUM_CENTS_FIXED,
    ...sample(fc.tuple(fc.bigInt({ min: 10n ** 15n, max: 10n ** 17n }), fc.bigInt({ min: 1n, max: 10n ** 5n })), 40),
  ]
  for (const [big, small] of pairs) {
    const terms = [String(Number(centsText(big))), String(Number(centsText(small)))]
    const cached = Number(terms[0]) + Number(terms[1])
    const texts = await derive([
      { ref: 'A1', v: terms[0] },
      { ref: 'A2', v: terms[1] },
      { ref: 'A3', f: 'SUM(A1:A2)', v: String(cached) },
    ])
    const termTexts = [texts.get('A1'), texts.get('A2')]
    const total = texts.get('A3')
    const own = numberText(cached)
    if (total === own) continue
    const sum = termTexts.every((t) => t !== undefined && CENT_TEXT.test(t)) ? termTexts.reduce((s, t) => s + centsOf(t).n * 10n ** BigInt(2 - centsOf(t).scale), 0n) : undefined
    const v = total === undefined ? undefined : exact(total)
    if (sum === undefined || v === undefined || !sameValue(v, { n: sum, scale: 2 })) {
      return [
        `${name}: a SUM total of 1e13 or more reads a cent amount other than the exact sum of its terms (first: ${termTexts.join(' + ')} reads ${JSON.stringify(total)}, exact ${sum === undefined ? 'none' : centsText(sum)}, own text ${JSON.stringify(own)})`,
      ]
    }
  }
  return []
}

/** Product files that turn numbers into text with toFixed, toPrecision, toExponential, toLocaleString or Intl, or expand through BigInt. */
function numberTextScanProblems(files, readFile, registeredFiles) {
  const problems = []
  for (const f of files) {
    const src = code(readFile(f))
    const ways = [...new Set([...src.matchAll(/\.(toFixed|toPrecision|toExponential|toLocaleString)\(|\bIntl\.NumberFormat\b/g)].map((m) => m[1] ?? 'Intl.NumberFormat'))]
    if (ways.length > 0 && !registeredFiles.includes(f)) problems.push(`${f}: turns numbers into text (${ways.join(', ')}) with no R69 entry`)
    if (/\bBigInt\(\s*(?![`'"\s])[^()]*(?:\([^()]*\)[^()]*)*\)\s*\.toString\(|\bString\(\s*BigInt\(\s*(?![`'"])/.test(src)) {
      problems.push(`${f}: expands a number into text through BigInt (digits past the double's own are invented)`)
    }
  }
  return problems
}

describe('SC4 R69: number text is total over the doubles and invents no digits (EV-14, EV-5)', () => {
  test('EV-14 R69 rule: a planted BigInt(1e23).toString() is caught (it invents digits); the shortest round-trip twin is clean', async () => {
    const { numberText, cleanNumberText } = await loadFix('planted-r69-number-text.mjs')
    const entry = { name: 'planted numberText', domain: 'finite', mayRefuse: () => false, mapsBack: (t, x) => Number(t) === x, mustWrite: [] }
    expect(numberTextProblems(entry, (x) => ({ text: numberText(x) }))).toContain(
      'planted numberText: invents digits (more significant digits than the shortest round-trip text) (first at 1e+23: "99999999999999991611392")',
    )
    expect(numberTextProblems(entry, (x) => ({ text: cleanNumberText(x) }))).toEqual([])
    expect(numberTextScanProblems(['planted-r69-number-text.mjs'], fix, [])).toEqual([
      'planted-r69-number-text.mjs: expands a number into text through BigInt (digits past the double\'s own are invented)',
    ])
  })

  test('EV-14 EV-5 R69 every registered number-to-text function (sheets numberText, money.ts, the Taxprep writer rate and amount text) is total over fc.double, maps back and invents no digits', async () => {
    const problems = []
    for (const e of NUMBER_TEXT) {
      expect(exists(e.file), `nothing to check: ${e.file} is not on main`).toBe(true)
      problems.push(...numberTextProblems(e, await e.get()))
    }
    problems.push(...landingProblems('R69', NUMBER_TEXT))
    expect(onlyKnown('R69', problems)).toEqual([])
  }, 60_000)

  test('EV-14 EV-6 R69 a SUM total of 1e13 and up maps back to the exact cents of its terms or keeps its own text (A07D Opus read item 1)', async () => {
    const deriver = DERIVERS.find((d) => d.card === 'A07')
    const { numberText } = await load('src/modules/sheets/xlsx/index.ts')
    expect(onlyKnown('R69-sum', await sumCentsProblems(deriver.name, await deriver.get(), numberText))).toEqual([])
  }, 60_000)

  test('EV-14 R69 every product file that turns numbers into text has an R69 entry, and none expands a number through BigInt', () => {
    const files = PRODUCT_FILES()
    expect(files.length, 'nothing to check: no product files under src').toBeGreaterThan(0)
    const problems = numberTextScanProblems(files, read, NUMBER_TEXT.map((e) => e.file))
    expect(onlyKnown('R69-scan', problems)).toEqual([])
  })
})

// =====================================================================================================================
// R70: every raw-XML reader accepts the well-formed variants
// =====================================================================================================================

const R70_CELLS = [
  { ref: 'A1', v: '12.5' },
  { ref: 'A2', t: 'n', v: '7' },
  { ref: 'A3', f: 'SUM(A1:A2)', v: '19.5' },
  { ref: 'A4', t: 'str', f: '"x (Test)"&""', v: 'x (Test)' },
  { ref: 'A5', xml: '<c r="A5"><f t="shared" ref="A5:A6" si="0">A1*2</f><v>25</v></c>' },
  { ref: 'A6', xml: '<c r="A6"><f t="shared" si="0"/><v>14</v></c>' },
]

const READ_PARTS = ['workbook', 'workbookRels', 'sheet']
const mapParts = (parts, fn) => Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, READ_PARTS.includes(k) ? fn(v, k) : v]))
const singleQuoted = (xml) => xml.replace(/(\s[\w:]+)="([^"']*)"/g, "$1='$2'")
const prefixed = (xml) => {
  const [ns, p] = xml.includes(`xmlns="${PKG_REL}"`) ? [PKG_REL, 'pr'] : [NS, 'x']
  return xml.replace(`xmlns="${ns}"`, `xmlns:${p}="${ns}"`).replace(/<(\/?)([A-Za-z][\w.-]*)(?=[\s/>])/g, `<$1${p}:$2`)
}
const valueAttributes = (xml) => xml.replace(/<v>/g, '<v xml:space="preserve">').replace(/<f>/g, '<f aca="false">')
/** Well-formed spellings of the same file; "all three" is the planted <x:c r='A1'> shape. */
const R70_VARIANTS = {
  'single-quoted attributes': (parts) => mapParts(parts, singleQuoted),
  'namespace prefixes': (parts) => mapParts(parts, prefixed),
  'attributes on value elements': (parts) => mapParts(parts, valueAttributes),
  'all three': (parts) => mapParts(parts, (xml) => singleQuoted(prefixed(valueAttributes(xml)))),
}

/** Raw-XML readers: `read(parts)` gives `{ sheet: { address: { type, value, formula } } }` for a one-sheet workbook's parts. */
const RAW_XML_READERS = [
  {
    name: 'sheets raw XML (A07)',
    file: 'src/modules/sheets/xlsx/raw.ts',
    get: async () => {
      const { readRaw } = await load('src/modules/sheets/xlsx/raw.ts')
      const { openZip } = await load('src/modules/sheets/xlsx/zip.ts')
      return (parts) => {
        const sheets = readRaw(openZip(zipParts(parts)))
        if (sheets === undefined) return { unread: true }
        return Object.fromEntries([...sheets].map(([name, cells]) => [name, Object.fromEntries([...cells].map(([a, c]) => [a, { type: c.type, value: c.value, formula: c.formula }]))]))
      }
    },
  },
]

const plain = (o) => JSON.parse(JSON.stringify(o))
function rawXmlProblems(name, readParts) {
  const problems = []
  const parts = workbookParts({ cells: R70_CELLS })
  const want = plain(readParts(parts))
  const cells = Object.values(want)[0] ?? {}
  if (Object.keys(cells).length !== R70_CELLS.length) return [`${name}: nothing to check: the plain file reads ${String(Object.keys(cells).length)} of ${String(R70_CELLS.length)} cells`]
  for (const [variant, make] of Object.entries(R70_VARIANTS)) {
    const got = plain(readParts(make(parts)))
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      const gotCells = Object.values(got)[0] ?? {}
      const same = Object.keys(cells).filter((a) => JSON.stringify(gotCells[a]) === JSON.stringify(cells[a])).length
      problems.push(`${name}: the ${variant} variant does not read as the plain file (${String(same)} of ${String(R70_CELLS.length)} cells the same)`)
    }
  }
  return problems
}

/** Product files holding a regex over raw XML (an element name after "<"), with no R70 entry. */
function rawXmlScanProblems(files, readFile, registeredFiles) {
  return files
    .filter((f) => !registeredFiles.includes(f))
    .filter((f) => regexLiterals(code(readFile(f))).some(({ body }) => /<\\?\/?[A-Za-z]/.test(body)))
    .map((f) => `${f}: reads raw XML with a regex and has no R70 entry`)
}

describe('SC4 R70: raw-XML readers accept the well-formed variants (EV-14, ARC-10)', () => {
  test("EV-14 R70 rule: a planted reader that misses <x:c r='A1'> is caught; it reads the plain file", async () => {
    const { readParts } = await loadFix('planted-r70-raw.mjs')
    expect(rawXmlProblems('planted raw', readParts)).toEqual([
      'planted raw: the single-quoted attributes variant does not read as the plain file (0 of 6 cells the same)',
      'planted raw: the namespace prefixes variant does not read as the plain file (0 of 6 cells the same)',
      'planted raw: the attributes on value elements variant does not read as the plain file (0 of 6 cells the same)',
      'planted raw: the all three variant does not read as the plain file (0 of 6 cells the same)',
    ])
    expect(rawXmlScanProblems(['planted-r70-raw.mjs'], fix, [])).toEqual(['planted-r70-raw.mjs: reads raw XML with a regex and has no R70 entry'])
  })

  test('EV-14 R70 every registered raw-XML reader reads single-quoted attributes, namespace prefixes and attributes on value elements as the plain file', async () => {
    expect(RAW_XML_READERS.length, 'nothing to check: no raw-XML reader is registered').toBeGreaterThan(0)
    const problems = []
    for (const r of RAW_XML_READERS) {
      expect(exists(r.file), `nothing to check: ${r.file} is not on main`).toBe(true)
      problems.push(...rawXmlProblems(r.name, await r.get()))
    }
    expect(onlyKnown('R70', problems)).toEqual([])
  })

  test('EV-14 R70 every product file that reads raw XML with a regex has an R70 entry', () => {
    expect(onlyKnown('R70-scan', rawXmlScanProblems(PRODUCT_FILES(), read, RAW_XML_READERS.map((r) => r.file)))).toEqual([])
  })
})

// =====================================================================================================================
// R74: range and region walks are bounded by what exists, inside a budget
// =====================================================================================================================

/** Readers that walk a range or a file region: an adapter module run in a worker, each case with its budget in ms. */
const RANGE_WALKERS = [
  {
    name: 'sheets reader (A07)',
    file: 'src/modules/sheets/xlsx/index.ts',
    adapter: `${FIX_REL}/r74-sheets.mjs`,
    exportName: 'run',
    cases: [
      ['running-balance-20k', 30_000],
      ['whole-sheet-range', 10_000],
      ['whole-sheet-merge', 10_000],
    ],
  },
]

/** Loading the product modules in a fresh worker is not part of the budget, but it has its own limit. */
const LOAD_LIMIT_MS = 30_000

/** Runs one case in a worker thread; a case still running at its budget (counted from when its modules are loaded) is stopped. */
function runCase(adapterRel, exportName, caseName, budgetMs) {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./__fixtures__/reading-rules/r74-worker.mjs', import.meta.url), {
      workerData: { adapter: pathToFileURL(path.join(ROOT, adapterRel)).href, exportName, caseName },
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
      stdout: true,
      stderr: true,
    })
    let settled = false
    const finish = (r) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(r)
    }
    let timer = setTimeout(() => finish({ status: 'error', error: `modules did not load within ${String(LOAD_LIMIT_MS / 1000)} s` }), LOAD_LIMIT_MS)
    worker.on('message', (m) => {
      if (m.ready) {
        clearTimeout(timer)
        timer = setTimeout(() => finish({ status: 'over' }), budgetMs)
        return
      }
      finish(m.done ? { status: 'done', outcome: m.outcome } : { status: 'error', error: m.error })
    })
    worker.on('error', (e) => finish({ status: 'error', error: `${e.name}: ${e.message}` }))
    worker.on('exit', (code) => finish({ status: 'error', error: `worker exited with code ${String(code)}` }))
  })
}

async function rangeWalkProblems(walker) {
  const results = await Promise.all(walker.cases.map(([c, budget]) => runCase(walker.adapter, walker.exportName, c, budget).then((r) => [c, budget, r])))
  const problems = []
  for (const [c, budget, r] of results) {
    if (r.status === 'over') problems.push(`${walker.name}: ${c} did not finish inside its ${String(budget / 1000)} s budget (stopped)`)
    else if (r.status === 'error') problems.push(`${walker.name}: ${c} failed: ${r.error}`)
    else if (r.outcome === null || typeof r.outcome !== 'object') problems.push(`${walker.name}: ${c} gave no outcome`)
  }
  return problems
}

describe('SC4 R74: range walks are bounded by what exists, inside a budget (EV-14, ARC-10)', () => {
  test('EV-14 R74 rule: a planted nested loop over A1:XFD1048576 is stopped at its budget; the same walk over the cells that exist finishes', async () => {
    const planted = `${FIX_REL}/planted-r74-walker.mjs`
    expect(await rangeWalkProblems({ name: 'planted walker', adapter: planted, exportName: 'run', cases: [['whole-sheet-range', 2_000]] })).toEqual([
      'planted walker: whole-sheet-range did not finish inside its 2 s budget (stopped)',
    ])
    expect(await rangeWalkProblems({ name: 'bounded walker', adapter: planted, exportName: 'runBounded', cases: [['whole-sheet-range', 10_000]] })).toEqual([])
  }, 60_000)

  test('EV-14 R74 every registered reader reads a 20k-row running balance, a whole-sheet SUM range and a whole-sheet merge inside its budget', async () => {
    expect(RANGE_WALKERS.length, 'nothing to check: no range walker is registered').toBeGreaterThan(0)
    const problems = []
    for (const w of RANGE_WALKERS) {
      expect(exists(w.file), `nothing to check: ${w.file} is not on main`).toBe(true)
      problems.push(...(await rangeWalkProblems(w)))
    }
    expect(onlyKnown('R74', problems)).toEqual([])
  }, 120_000)
})

// =====================================================================================================================
// R56 exemption: absolute epsilons on page coordinates scaled 0 to 1, with the scale named in a comment
// =====================================================================================================================

const TOLERANCE_NAME = /(?:^|_)(?:EPS|EPSILON|TOLERANCE|TOL|SLACK|FUZZ|ALLOWANCE)(?:_|$)/i
const SCALE_NAMED = /\bpages?\b|\bfractions?\b|\b0 to 1\b/i
/** The comment lines directly above line i (JSDoc or line comments, up to five lines). */
function commentAbove(lines, i) {
  const out = []
  for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
    const t = lines[j].trim()
    if (/^(\/\/|\/\*|\*)/.test(t)) out.unshift(t)
    else break
  }
  return out.join(' ')
}
/**
 * Absolute tolerances (a constant named like an epsilon with a value below 1, or a literal like 1e-7 in a comparison)
 * are problems unless the comment above names the 0-to-1 page scale. Returns the problems and the exempted ones.
 */
function toleranceProblems(files, readFile) {
  const problems = []
  const exempted = []
  for (const f of files) {
    const src = readFile(f)
    const lines = src.split('\n')
    const codeLines = code(src).split('\n')
    codeLines.forEach((line, i) => {
      const constant = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+(?:\.\d+)?(?:e-?\d+)?)\s*$/.exec(line)
      const literal = /[<>]=?/.test(line) ? /(?<![\w.])\d+(?:\.\d+)?e-\d+(?![\w.])/.exec(line) : null
      const named = constant !== null && TOLERANCE_NAME.test(constant[1]) && Number(constant[2]) > 0 && Number(constant[2]) < 1
      if (!named && literal === null) return
      const what = named ? constant[1] : `${literal[0]} in a comparison`
      if (SCALE_NAMED.test(commentAbove(lines, i))) exempted.push(`${f}: ${what}`)
      else problems.push(`${f}: an absolute tolerance (${what}); scale it with the magnitude, or name the 0-to-1 page scale in a comment above`)
    })
  }
  return { problems, exempted }
}

describe('SC4 R56 exemption: page-scale epsilons (EV-5, EV-14)', () => {
  test('EV-5 R56 rule: absolute tolerances with no named scale are caught; a page epsilon with its 0-to-1 scale named is exempt', () => {
    const planted = toleranceProblems(['planted-r56-tolerance.ts.txt'], fix)
    expect(planted.problems).toEqual([
      'planted-r56-tolerance.ts.txt: an absolute tolerance (SNAP_EPSILON); scale it with the magnitude, or name the 0-to-1 page scale in a comment above',
      'planted-r56-tolerance.ts.txt: an absolute tolerance (EDGE_EPS); scale it with the magnitude, or name the 0-to-1 page scale in a comment above',
      'planted-r56-tolerance.ts.txt: an absolute tolerance (1e-7 in a comparison); scale it with the magnitude, or name the 0-to-1 page scale in a comment above',
    ])
    expect(planted.exempted).toEqual(['planted-r56-tolerance.ts.txt: PAGE_EPS'])
    expect(toleranceProblems(['clean-r56-tolerance.ts.txt'], fix)).toEqual({ problems: [], exempted: ['clean-r56-tolerance.ts.txt: GEOMETRY_EPSILON'] })
  })

  test('EV-5 R56 with the exemption, every absolute tolerance in src/contracts and src/modules is a named page-scale epsilon (reading.ts EPS, amount-grammar.ts GEOMETRY_EPSILON)', () => {
    const { problems, exempted } = toleranceProblems(CONTRACT_AND_MODULE_FILES(), read)
    expect(exempted).toEqual(expect.arrayContaining(['src/contracts/reading.ts: EPS', 'src/contracts/amount-grammar.ts: GEOMETRY_EPSILON']))
    expect(onlyKnown('R56', problems)).toEqual([])
  })
})
