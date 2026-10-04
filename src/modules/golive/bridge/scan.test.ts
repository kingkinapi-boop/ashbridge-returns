// GL3 builder's own unit tests for the pure scans (the acceptance tests are in draft.acceptance*.test.ts).
import { describe, expect, test } from 'vitest'
import { draftReads, findSentenceLiterals, missingColumns, neverReadFindings, parseViewsManifest, type ViewsManifest } from './index'

function manifestOf(sources: string[][], alsoReads: string[] = []): ViewsManifest {
  return {
    contract: { clientAppCommit: 'x', lastMigration: 1 },
    views: [
      {
        name: 'v',
        columns: sources.map((s, i) => ({ name: `c${String(i)}`, sources: s.map((source) => ({ source, cite: null })) })),
        alsoReads: alsoReads.map((source) => ({ source, cite: null })),
        derived: [],
      },
    ],
  }
}

describe('GL3 draftReads (U9)', () => {
  test('ARC-2 draftReads sorts by table, then column, in plain string order: a short table name before one it prefixes', () => {
    const m = manifestOf([['a_b.x', 'a.z'], ['a.y', 'a_b.a']], ['B.k', 'a.a'])
    expect(draftReads(m)).toEqual([
      { table: 'B', column: 'k' },
      { table: 'a', column: 'a' },
      { table: 'a', column: 'y' },
      { table: 'a', column: 'z' },
      { table: 'a_b', column: 'a' },
      { table: 'a_b', column: 'x' },
    ])
  })

  test('ARC-2 draftReads keeps the underscore of a column and a digit in a table name', () => {
    expect(draftReads(manifestOf([['t2_x.the_col']]))).toEqual([{ table: 't2_x', column: 'the_col' }])
  })
})

describe('GL3 missingColumns (U9)', () => {
  test('ARC-2 missingColumns matches on table and column together, never on one of them', () => {
    const reads = [
      { table: 'a', column: 'x' },
      { table: 'a', column: 'y' },
      { table: 'b', column: 'x' },
    ]
    expect(missingColumns(reads, [{ table: 'a', column: 'x' }, { table: 'b', column: 'y' }])).toEqual([reads[1], reads[2]])
    expect(missingColumns([], reads)).toEqual([])
    expect(missingColumns(reads, [])).toEqual(reads)
  })
})

describe('GL3 neverReadFindings (ARC-2)', () => {
  test('ARC-2 a never-read column is found on its own table only, a never-read table on any column or none', () => {
    const deps = [
      { view: 'a', table: 'people', column: 'email' },
      { view: 'b', table: 'people', column: 'mobile_number' },
      { view: 'c', table: 'people', column: 'id' },
      { view: 'd', table: 'restricted_data', column: null },
      { view: 'e', table: 'restricted_data', column: 'id' },
      { view: 'f', table: 'links', column: 'id' },
      { view: 'g', table: 'other', column: 'email' },
      { view: 'h', table: 'people', column: null },
    ]
    expect(neverReadFindings(deps)).toEqual([deps[0], deps[1], deps[3], deps[4]])
  })
})

describe('GL3 findSentenceLiterals (END-7)', () => {
  const lits = (sql: string): { line: number; literal: string }[] => findSentenceLiterals(sql, 'f.sql').map((f) => ({ line: f.line, literal: f.literal }))

  test('END-7 a tab or a line break makes a literal a sentence; an empty literal and an escaped quote do not', () => {
    expect(lits("select 'a\tb';")).toEqual([{ line: 1, literal: 'a\tb' }])
    expect(lits("select 'a\r\nb';")).toEqual([{ line: 1, literal: 'a\r\nb' }])
    expect(lits("select '', '''', 'a', ' ';")).toEqual([{ line: 1, literal: ' ' }])
    expect(lits("select 'it''s ok', 'x';")).toEqual([{ line: 1, literal: "it's ok" }])
  })

  test('END-7 the line is that of the opening quote, after earlier literals and comments', () => {
    expect(lits("select 'a';\n-- note\n/* x\ny */\nselect 'b c';")).toEqual([{ line: 5, literal: 'b c' }])
    expect(lits("select 'a b', 'c d';\nselect 'e f';")).toEqual([
      { line: 1, literal: 'a b' },
      { line: 1, literal: 'c d' },
      { line: 2, literal: 'e f' },
    ])
  })

  test('END-7 a block comment ends at its own end; a quote inside it is not a literal', () => {
    expect(lits("/* it's a note */ select 'x y' /* another it's */;")).toEqual([{ line: 1, literal: 'x y' }])
    expect(lits("/* a\n'b c'\nd */ select 1;")).toEqual([])
  })

  test('END-7 a line comment ends at its line end; a quoted identifier holding quotes or a space is not a literal', () => {
    expect(lits("-- it's\nselect 'a b'; -- it's 'c d'")).toEqual([{ line: 2, literal: 'a b' }])
    expect(lits(`select "it's", 'x y', "a""b c" from t where z = 'w';`)).toEqual([{ line: 1, literal: 'x y' }])
    expect(lits(`select "it's a" , "b'c d'";`)).toEqual([])
  })

  test('END-7 a dollar quote ends at its own tag; tags may hold digits and underscores; two quotes on a line stay two', () => {
    expect(lits('select $a$ x y $b$ z $a$;')).toEqual([{ line: 1, literal: ' x y $b$ z ' }])
    expect(lits('select $t_1$p q$t_1$, $$r s$$, $$u$$;')).toEqual([
      { line: 1, literal: 'p q' },
      { line: 1, literal: 'r s' },
    ])
    expect(lits('select $$a b$$, $$c d$$;')).toEqual([
      { line: 1, literal: 'a b' },
      { line: 1, literal: 'c d' },
    ])
    expect(lits("select $$it''s a$$;")).toEqual([{ line: 1, literal: "it''s a" }])
  })

  test('END-7 a dollar sign inside an identifier or a parameter is not a quote', () => {
    expect(lits('select x$a$ y z$a$;')).toEqual([])
    expect(lits('select 1$a$ y z$a$, _$b$ y z$b$, $c$$d$ y z$d$$c$;')).toEqual([{ line: 1, literal: '$d$ y z$d$' }])
    expect(lits("select $1, 'a b', $2;")).toEqual([{ line: 1, literal: 'a b' }])
  })

  test('END-7 an unterminated literal, comment or dollar quote reports nothing and does not throw', () => {
    expect(lits("select 'a b")).toEqual([])
    expect(lits('select $a$ b c')).toEqual([])
    expect(lits('/* a b')).toEqual([])
  })

  test('END-7 the file name is carried on every finding', () => {
    expect(findSentenceLiterals("select 'a b';", 'x/y.sql')).toEqual([{ file: 'x/y.sql', line: 1, literal: 'a b' }])
  })
})

describe('GL3 parseViewsManifest (ARC-2)', () => {
  test('ARC-2 a manifest with a bad cite, a bad name or no sources is refused', () => {
    const ok = manifestOf([['t.c']])
    expect(parseViewsManifest(ok)).toEqual(ok)
    const withCite = JSON.parse(JSON.stringify(ok)) as ViewsManifest
    const first = withCite.views[0]?.columns[0]?.sources[0]
    if (first !== undefined) first.cite = 'M2:5'
    expect(() => parseViewsManifest(withCite)).toThrow()
    expect(() => parseViewsManifest({ ...ok, views: [{ ...ok.views[0], name: 'Bad' }] })).toThrow()
    expect(() => parseViewsManifest({ ...ok, views: [] })).toThrow()
    expect(() => parseViewsManifest({ ...ok, views: [{ ...ok.views[0], columns: [{ name: 'c', sources: [] }] }] })).toThrow()
  })
})
