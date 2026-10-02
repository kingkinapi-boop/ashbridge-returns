// F08 checks 4, 5 and 6 (ARC-9, ARC-12): tools/matrix.mjs reads clauses and the tests that name them.
import { describe, expect, test, vi } from 'vitest'
import { makeWorld, runTool } from './_world.mjs'

vi.setConfig({ testTimeout: 60000 })

const BLUEPRINT = [
  '# 09 fixture',
  '',
  '- **ARC-1** covered by a test name.',
  '- **ARC-2** only named in a comment.',
  '- **ARC-3** removed clause (removed in v1.1).',
  '- **ARC-4** only in the middle of a test name.',
  '- **ARC-5** opens a describe name.',
  '- **ARC-6** opens an it name with double quotes.',
  '- **ARC-7** covered by a .spec.ts file.',
  '- **ARC-8** covered by a .test.mjs file.',
  '- **ARC-9** has no test at all.',
  '- **RULE-1** a rule for people.',
  '- **OUT-1** not building.',
  '- **LIVE-1** go-live step.',
  '',
].join('\n')

const FILES = {
  'blueprint/09-arch.md': BLUEPRINT,
  'src/a.test.ts': "import { test } from 'vitest'\ntest('ARC-1 does the thing', () => {})\n",
  'src/comment.test.ts': "// ARC-2 only a comment, and RULE-1\ntest('something else', () => {})\n",
  'src/mid.test.ts': "test('does a thing for ARC-4 later', () => {})\n",
  'src/group.test.ts': "describe('ARC-5 group', () => { it(\"ARC-6 inner\", () => {}) })\n",
  'src/b.spec.ts': "test('ARC-7 spec file', () => {})\n",
  'src/c.test.mjs': "test('ARC-8 mjs file', () => {})\n",
}

const CARD_OK = '# X\n\n## Acceptance checks\n1. ok\n'
// Every testable clause cited by some card, so --plan has nothing to say about them.
const ALL_TESTABLE = ['ARC-1', 'ARC-2', 'ARC-4', 'ARC-5', 'ARC-6', 'ARC-7', 'ARC-8', 'ARC-9']
const slices = (cards) => ({ blueprint: 'x', cards })

function matrix(files, args = [], cards = []) {
  const w = makeWorld({ files: { ...FILES, ...files }, slices: slices(cards) })
  const r = runTool(w, 'matrix.mjs', args)
  return { w, r, md: (() => { try { return w.read('plan/MATRIX.md') } catch { return '' } })() }
}
const missingOf = (md) => {
  const row = md.split('\n').find((l) => l.startsWith('| 09-arch.md'))
  return (row?.split('|')[3] ?? '').trim().split(/\s+/).filter((x) => x && x !== 'none')
}

describe('ARC-9 matrix.mjs clause coverage', () => {
  test('ARC-9 a clause that opens a test name counts as covered', () => {
    const { md } = matrix({})
    const missing = missingOf(md)
    for (const id of ['ARC-1', 'ARC-5', 'ARC-6', 'ARC-7', 'ARC-8']) expect(missing, id).not.toContain(id)
  })

  test('ARC-9 a clause only in a comment or in the middle of a test name does not count', () => {
    const { md } = matrix({})
    const missing = missingOf(md)
    expect(missing).toContain('ARC-2')
    expect(missing).toContain('ARC-4')
    expect(missing).toContain('ARC-9')
  })

  test('ARC-9 a removed clause is not listed as needing a test', () => {
    const { md, r } = matrix({}, ['--plan'])
    expect(missingOf(md)).not.toContain('ARC-3')
    expect(r.out).not.toMatch(/ARC-3\b/)
  })

  test('ARC-9 RULE, OUT and LIVE clauses are never listed as uncovered or as needing a card', () => {
    const { md, r } = matrix({}, ['--plan'])
    for (const id of ['RULE-1', 'OUT-1', 'LIVE-1']) {
      expect(missingOf(md), id).not.toContain(id)
      expect(r.out).not.toMatch(new RegExp(`clause ${id}\\b`))
    }
  })

  test('ARC-9 the counts in MATRIX.md follow the fixture: 8 testable, 5 with tests', () => {
    const { md, r } = matrix({})
    expect(r.code).toBe(0)
    expect(md).toMatch(/Clauses 8 testable, 5 with tests \(63%\)/)
    expect(md).toMatch(/\| 09-arch\.md \| 5\/8 \|/)
  })

  test('ARC-9 an unknown clause ID named in a test is reported', () => {
    const { r } = matrix({ 'src/unk.test.ts': "test('ARC-77 nothing like it', () => {})\n" })
    expect(r.out).toMatch(/unknown IDs in tests:.*ARC-77/)
  })

  test('ARC-9 a clause named in a non-test file never counts', () => {
    const { md } = matrix({ 'src/notatest.ts': "test('ARC-9 in a source file', () => {})\n" })
    expect(missingOf(md)).toContain('ARC-9')
  })
})

describe('ARC-9 matrix.mjs --plan', () => {
  test('ARC-9 --plan exits 0 on a clean fixture', () => {
    const cards = [{ id: 'OK1', status: 'carded', deps: [], clauses: ALL_TESTABLE }]
    const { r } = matrix({ 'plan/cards/OK1.md': CARD_OK }, ['--plan'], cards)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/PLAN OK/)
  })

  test('ARC-9 --plan exits 1 and names each case', () => {
    const cards = [
      { id: 'C1', status: 'carded', deps: [], clauses: [...ALL_TESTABLE.slice(1), 'ARC-99'] },
      { id: 'C2', status: 'carded', deps: [], clauses: [] },
      { id: 'C3', status: 'carded', deps: [], clauses: [] },
      { id: 'C4', status: 'todo', deps: ['ZZ'], clauses: [] },
    ]
    const { r } = matrix({ 'plan/cards/C1.md': CARD_OK, 'plan/cards/C3.md': '# no checks here\n' }, ['--plan'], cards)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/C1 cites unknown clause ARC-99/)
    expect(r.out).toMatch(/clause ARC-1 is cited by no card/)
    expect(r.out).toMatch(/C2 is carded but has no card file/)
    expect(r.out).toMatch(/C3 card has no acceptance checks/)
    expect(r.out).toMatch(/C4 depends on unknown card ZZ/)
  })

  test('ARC-9 --plan does not ask a todo or family card for a card file', () => {
    const cards = [
      { id: 'OK1', status: 'carded', deps: [], clauses: ALL_TESTABLE },
      { id: 'T1', status: 'todo', deps: [], clauses: [] },
    ]
    const { r } = matrix({ 'plan/cards/OK1.md': CARD_OK }, ['--plan'], cards)
    expect(r.out).not.toMatch(/T1/)
  })
})

describe('ARC-12 matrix.mjs acceptance test names', () => {
  test('ARC-12 a test in an acceptance file whose name opens with no clause ID is reported with its file and name', () => {
    const { r, md } = matrix({
      'src/x/thing.acceptance.test.ts': "test('ARC-1 fine', () => {})\ntest('forgot the clause ID', () => {})\n",
    })
    const text = `${r.out}\n${md}`
    expect(text).toMatch(/src\/x\/thing\.acceptance\.test\.ts/)
    expect(text).toMatch(/forgot the clause ID/)
    expect(text).not.toMatch(/ARC-1 fine/)
  })

  test('ARC-12 a test with no clause ID in an ordinary test file is not a problem', () => {
    const { r, md } = matrix({ 'src/x/plain.test.ts': "test('no id here', () => {})\n" })
    expect(`${r.out}\n${md}`).not.toMatch(/no id here/)
  })

  test('ARC-12 an acceptance file whose names all open with clause IDs reports no problem', () => {
    const { r, md } = matrix({ 'src/x/good.acceptance.test.ts': "test('ARC-1 a', () => {})\ntest(\"ARC-5 b\", () => {})\n" })
    expect(`${r.out}\n${md}`).not.toMatch(/good\.acceptance/)
  })
})
