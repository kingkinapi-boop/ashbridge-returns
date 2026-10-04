// SC11 acceptance tests: R107 (grants) and R108 (security definer), the SQL rules from GL3's findings review 1
// (A476). Unit project: it reads db/**/*.sql as text and needs no database.
//
// What these tests fix (amber in reports/SC11-spec.md):
// - The scan is defined here, as R92's is: comments are stripped, statements split on `;` outside quotes, and a
//   statement is normalised (lower case, runs of space collapsed, no trailing `;`) before it is compared.
// - R107: every `grant` statement in db/**/*.sql has an entry in `dbGrantAllow` in tools/test-homes.json
//   (Lead-owned), each { file, statement, owner, reason } with the normalised statement text and the card that owns
//   it. Refused outright, even with an entry: a grant on all functions in a schema, a grant to public, and any
//   `alter default privileges`. A stale entry fails. One entry silences one statement.
// - R108: every `create function` or `create procedure` that is `security definer` also has `set search_path`
//   in its header, and an entry in `definerAllow` (the same shape; `statement` is the function's schema-qualified
//   name, lower case). A stale entry fails.
// - Both lists start empty on this card's base (db/ holds no grant and no definer today); GL3 adds its own.
// - The plant for R107 is GL3's line 20 at e4d95939: __fixtures__/sql-rules/grants-e4d95939.sql.
// - S20 (round 4, A540): GL3 landed its grants draft (a 0002_grants.sql in a folder of db/), so dbGrantAllow holds one
//   entry per grant statement there (owner GL3, the reason from GL3's card). A client-app-standin.sql in that folder's
//   __fixtures__ is a made-up stand-in of the client app, not a migration of ours: R107 skips it only through
//   `dbGrantFixtures` in tools/test-homes.json, a list of { file, reason } whose one entry names that file. A fixture
//   entry must name an existing file under a `__fixtures__` folder, with a reason; any other file, a planted
//   default-privilege grant included, is scanned. GL3's own ARC-2 rule forbids naming the draft's folder anywhere in
//   src outside its module, so these tests take both paths from tools/test-homes.json and pin their shape instead.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../testing/read-own-source'

interface Allow {
  file: string
  statement: string
  owner: string
  reason: string
}
interface Stmt {
  file: string
  line: number
  text: string
}

/** Statements of one SQL file: comments removed, split on `;` outside single quotes and dollar quotes. */
function statements(file: string, src: string): Stmt[] {
  const out: Stmt[] = []
  let cur = ''
  let line = 1
  let startLine = 1
  let i = 0
  const push = (): void => {
    const text = cur.replace(/\s+/g, ' ').trim().toLowerCase()
    if (text !== '') out.push({ file, line: startLine, text })
    cur = ''
  }
  const take = (n: number): void => {
    for (const ch of src.slice(i, i + n)) {
      if (ch === '\n') line += 1
      if (cur.trim() === '' && ch.trim() !== '') startLine = line
    }
    cur += src.slice(i, i + n)
    i += n
  }
  while (i < src.length) {
    const rest = src.slice(i)
    const dollar = /^\$([A-Za-z_]\w*)?\$/.exec(rest)
    if (rest.startsWith('--')) {
      const end = rest.indexOf('\n')
      i += end < 0 ? rest.length : end
    } else if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/')
      const n = end < 0 ? rest.length : end + 2
      line += rest.slice(0, n).split('\n').length - 1
      i += n
    } else if (rest.startsWith("'")) {
      let n = 1
      while (n < rest.length && !(rest[n] === "'" && rest[n + 1] !== "'")) n += rest[n] === "'" ? 2 : 1
      take(Math.min(n + 1, rest.length))
    } else if (dollar) {
      const close = rest.indexOf(dollar[0], dollar[0].length)
      take(close < 0 ? rest.length : close + dollar[0].length)
    } else if (rest.startsWith(';')) {
      i += 1
      push()
    } else {
      const ch = rest.charAt(0)
      if (cur.trim() === '' && ch.trim() !== '') startLine = line
      if (ch === '\n') line += 1
      cur += ch
      i += 1
    }
  }
  push()
  return out
}

const GRANT = /^grant\b/
const ALTER_DEFAULT = /^alter default privileges\b/
const REFUSED: { rule: RegExp; why: string }[] = [
  { rule: /^grant\b.*\bon all functions in schema\b/, why: 'a grant on all functions in a schema' },
  { rule: /^grant\b.*\bto\b(?:.*,)?\s*public\b/, why: 'a grant to public' },
  { rule: ALTER_DEFAULT, why: 'a default-privilege grant' },
]

/** R107 problems for the given files against the allow list: refused outright, not allowed, or stale. */
function grantProblems(files: { file: string; src: string }[], allow: Allow[]): string[] {
  const problems: string[] = []
  const spent = new Set<number>()
  const seen = new Set<string>()
  for (const f of files) {
    for (const s of statements(f.file, f.src)) {
      if (!GRANT.test(s.text) && !ALTER_DEFAULT.test(s.text)) continue
      seen.add(`${s.file}\n${s.text}`)
      const refused = REFUSED.find((r) => r.rule.test(s.text))
      if (refused) {
        problems.push(`${s.file}:${String(s.line)} refused outright: ${refused.why}`)
        continue
      }
      const i = allow.findIndex((a, n) => !spent.has(n) && a.file === s.file && a.statement === s.text)
      if (i < 0) problems.push(`${s.file}:${String(s.line)} grant not on the allow list: ${s.text}`)
      else spent.add(i)
    }
  }
  allow.forEach((a, n) => {
    if (!seen.has(`${a.file}\n${a.statement}`)) problems.push(`stale grant allow entry ${a.file}: ${a.statement}`)
    else if (!spent.has(n)) problems.push(`duplicate grant allow entry ${a.file}: ${a.statement}`)
    if (a.reason.trim() === '' || a.owner.trim() === '') problems.push(`grant allow entry ${a.statement} needs an owner and a reason`)
  })
  return problems
}

const FUNCTION = /^create (?:or replace )?(?:function|procedure)\s+([\w."]+)/

/** R108 problems: a security definer without `set search_path`, one without an allow entry, or a stale entry. */
function definerProblems(files: { file: string; src: string }[], allow: Allow[]): string[] {
  const problems: string[] = []
  const spent = new Set<number>()
  const seen = new Set<string>()
  for (const f of files) {
    for (const s of statements(f.file, f.src)) {
      const m = FUNCTION.exec(s.text)
      if (!m || !/\bsecurity definer\b/.test(s.text)) continue
      const name = (m[1] ?? '').replace(/"/g, '')
      seen.add(`${s.file}\n${name}`)
      // The header is the text before the body's quote: a `set search_path` inside the body does not count.
      const header = s.text.split(/\bas\s+(?:\$|')/)[0] ?? s.text
      if (!/\bset search_path\b/.test(header)) problems.push(`${s.file}:${String(s.line)} security definer ${name} sets no search_path`)
      const i = allow.findIndex((a, n) => !spent.has(n) && a.file === s.file && a.statement === name)
      if (i < 0) problems.push(`${s.file}:${String(s.line)} security definer ${name} is not on the allow list`)
      else spent.add(i)
    }
  }
  allow.forEach((a) => {
    if (!seen.has(`${a.file}\n${a.statement}`)) problems.push(`stale definer allow entry ${a.file}: ${a.statement}`)
    if (a.reason.trim() === '' || a.owner.trim() === '') problems.push(`definer allow entry ${a.statement} needs an owner and a reason`)
  })
  return problems
}

function sqlFiles(dir: string): { file: string; src: string }[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.posix.join(dir, e.name)
    if (e.isDirectory()) return sqlFiles(p)
    return e.name.endsWith('.sql') ? [{ file: p, src: readOwnSource(p) }] : []
  })
}

interface FixtureEntry {
  file: string
  reason: string
}

/** S20: the files R107 reads (every file but a valid fixture entry's), and the problems of the fixture entries. */
function grantScan(files: { file: string; src: string }[], fixtures: FixtureEntry[]): { files: { file: string; src: string }[]; problems: string[] } {
  const problems: string[] = []
  const exempt = new Set<string>()
  for (const f of fixtures) {
    if (!/(?:^|\/)__fixtures__\//.test(f.file)) problems.push(`grant fixture entry ${f.file} is not under a __fixtures__ folder: only a fixture is exempt`)
    else if (!files.some((x) => x.file === f.file)) problems.push(`stale grant fixture entry ${f.file}`)
    else exempt.add(f.file)
    if (f.reason.trim() === '') problems.push(`grant fixture entry ${f.file} needs a reason`)
  }
  return { files: files.filter((x) => !exempt.has(x.file)), problems }
}

function fixtureList(): FixtureEntry[] {
  const homes = JSON.parse(readOwnSource('tools/test-homes.json')) as Record<string, unknown>
  expect(Array.isArray(homes['dbGrantFixtures']), 'tools/test-homes.json has a dbGrantFixtures array (S20)').toBe(true)
  return homes['dbGrantFixtures'] as FixtureEntry[]
}

function list(key: 'dbGrantAllow' | 'definerAllow'): Allow[] {
  const homes = JSON.parse(readOwnSource('tools/test-homes.json')) as Record<string, unknown>
  expect(Array.isArray(homes[key]), `tools/test-homes.json has a ${key} array (Lead-owned)`).toBe(true)
  return homes[key] as Allow[]
}

const FIXTURES = 'src/core/db/__fixtures__/sql-rules'
const fixture = (name: string): { file: string; src: string }[] => [{ file: `${FIXTURES}/${name}`, src: readOwnSource(`${FIXTURES}/${name}`) }]
const sql = (src: string, file = 'db/x.sql'): { file: string; src: string }[] => [{ file, src }]

describe('SC11 R107 every grant in db/**/*.sql is on an allow list (SEC-6, ARC-2)', () => {
  test('SEC-6 the scan reads comments, quotes and several statements on one line', () => {
    const src = "-- grant all on t to public;\n/* grant x */ select 'a; grant b to public';\ngrant select on t\n  to r;grant usage on schema s to r;"
    const got = statements('f.sql', src)
    expect(got.map((s) => s.text)).toEqual(["select 'a; grant b to public'", 'grant select on t to r', 'grant usage on schema s to r'])
    expect(got.map((s) => s.line)).toEqual([2, 3, 4])
  })

  test('SEC-6 PLANT: GL3 line 20 at e4d95939 is refused outright, even with an allow entry', () => {
    const plant = fixture('grants-e4d95939.sql')
    expect(grantProblems(plant, [])).toContainEqual(
      expect.stringMatching(/grants-e4d95939\.sql:\d+ refused outright: a grant on all functions in a schema/),
    )
    const stmt = 'grant execute on all functions in schema returns to returns_app'
    const allowed: Allow[] = [{ file: plant[0]?.file ?? '', statement: stmt, owner: 'GL3', reason: 'test' }]
    expect(grantProblems(plant, allowed).some((p) => p.includes('refused outright'))).toBe(true)
  })

  test('SEC-6 refused outright: a grant to public (alone or in a list), a default-privilege grant', () => {
    for (const src of [
      'grant select on t to public;',
      'GRANT SELECT ON t TO a, PUBLIC;',
      'alter default privileges in schema returns grant select on tables to returns_app;',
      'grant all on all functions in schema returns to r;',
    ]) {
      const got = grantProblems(sql(src), [{ file: 'db/x.sql', statement: statements('db/x.sql', src)[0]?.text ?? '', owner: 'X', reason: 'r' }])
      expect(got.some((p) => p.includes('refused outright')), src).toBe(true)
    }
  })

  test('SEC-6 a grant with no allow entry is reported with its file and line; one entry silences one statement', () => {
    const src = 'grant usage on schema bridge to returns_app;\n\ngrant usage on schema bridge to returns_app;'
    const entry: Allow = { file: 'db/x.sql', statement: 'grant usage on schema bridge to returns_app', owner: 'GL3', reason: 'reads bridge views' }
    expect(grantProblems(sql(src), [])).toHaveLength(2)
    expect(grantProblems(sql(src), [entry])).toEqual(['db/x.sql:3 grant not on the allow list: grant usage on schema bridge to returns_app'])
    expect(grantProblems(sql(src), [entry, entry])).toEqual([])
  })

  test('SEC-6 an allow entry is matched on its file and its statement; a stale or reasonless one fails', () => {
    const src = 'grant usage on schema bridge to returns_app;'
    const entry: Allow = { file: 'db/x.sql', statement: 'grant usage on schema bridge to returns_app', owner: 'GL3', reason: 'why' }
    expect(grantProblems(sql(src), [{ ...entry, file: 'db/y.sql' }]).length).toBeGreaterThanOrEqual(2)
    expect(grantProblems(sql('select 1;'), [entry])).toEqual([`stale grant allow entry db/x.sql: ${entry.statement}`])
    expect(grantProblems(sql(src), [{ ...entry, reason: ' ' }]).length).toBe(1)
    expect(grantProblems(sql(src), [{ ...entry, owner: '' }]).length).toBe(1)
  })

  test('SEC-6 a revoke, a select naming grant, and a comment are not grants', () => {
    const src = "revoke all on schema s from public;\nselect 'grant x to public';\n-- grant all to public\ncomment on table t is 'grant';"
    expect(grantProblems(sql(src), [])).toEqual([])
  })

  test('SEC-6 the real db/**/*.sql has no grant outside the allow list (which GL3 fills); a fixture is skipped only through its entry', () => {
    const files = sqlFiles('db')
    expect(files.length, 'sentinel: the scan read the schema files').toBeGreaterThan(0)
    const scan = grantScan(files, fixtureList())
    expect(scan.problems).toEqual([])
    expect(grantProblems(scan.files, list('dbGrantAllow'))).toEqual([])
  })
})

describe('SC11 S20 R107 against GL3 landed grants (SEC-6, ARC-2, END-7)', () => {
  /** The grants draft: the one file dbGrantAllow names, a 0002_grants.sql one folder below db/. */
  function grantsFile(): string {
    const files = [...new Set(list('dbGrantAllow').map((a) => a.file))]
    expect(files, 'dbGrantAllow names exactly one file, GL3 grants draft (S20)').toHaveLength(1)
    const file = files[0] ?? ''
    expect(path.posix.basename(file)).toBe('0002_grants.sql')
    expect(path.posix.dirname(path.posix.dirname(file)), 'the draft sits one folder below db/').toBe('db')
    return file
  }
  /** The stand-in: client-app-standin.sql in the __fixtures__ folder beside the grants draft. */
  function standinFile(): string {
    return `${path.posix.dirname(grantsFile())}/__fixtures__/client-app-standin.sql`
  }

  test('SEC-6 S20 every grant statement of GL3 grants draft has exactly one allow entry, owned by GL3, with a reason', () => {
    const GRANTS = grantsFile()
    expect(sqlFiles('db').some((f) => f.file === GRANTS), 'sentinel: the scan reads the grants draft').toBe(true)
    const grants = statements(GRANTS, readOwnSource(GRANTS)).filter((s) => GRANT.test(s.text))
    expect(grants.length, 'sentinel: the GL3 draft holds grants').toBeGreaterThan(0)
    const entries = list('dbGrantAllow').filter((a) => a.file === GRANTS)
    expect(entries.map((a) => a.statement).sort()).toEqual(grants.map((s) => s.text).sort())
    for (const a of entries) {
      expect(a.owner).toBe('GL3')
      expect(a.reason.trim().length, `${a.statement} has a reason`).toBeGreaterThan(20)
    }
    expect(grantProblems([{ file: GRANTS, src: readOwnSource(GRANTS) }], entries)).toEqual([])
  })

  test('SEC-6 S20 the client app stand-in is exempt only through its one fixture entry, naming that file and why; without it the scan refuses its default-privilege grants', () => {
    const STANDIN = standinFile()
    const fixtures = fixtureList()
    expect(fixtures).toHaveLength(1)
    expect(fixtures[0]?.file).toBe(STANDIN)
    expect(fixtures[0]?.reason).toMatch(/stand-in of the client app/)
    expect(fixtures[0]?.reason).toMatch(/not a migration of ours/)
    const files = sqlFiles('db')
    expect(files.some((f) => f.file === STANDIN), 'sentinel: the scan reads the stand-in').toBe(true)
    const without = grantProblems(grantScan(files, []).files, list('dbGrantAllow'))
    expect(without.filter((p) => p.startsWith(`${STANDIN}:`) && p.includes('refused outright: a default-privilege grant'))).toHaveLength(4)
  })

  test('SEC-6 S20 PLANT: a default-privilege grant in any other db/**/*.sql still fails with the fixture entry in place', () => {
    const planted = [
      { file: `${path.posix.dirname(grantsFile())}/0003_planted_test.sql`, src: 'alter default privileges grant select on tables to anon;' },
      { file: 'db/schema/99_planted_test.sql', src: 'alter default privileges in schema returns grant select on tables to returns_app;' },
    ]
    const scan = grantScan([...sqlFiles('db'), ...planted], fixtureList())
    expect(scan.problems).toEqual([])
    const got = grantProblems(scan.files, list('dbGrantAllow'))
    for (const p of planted) expect(got, p.file).toContainEqual(`${p.file}:1 refused outright: a default-privilege grant`)
    expect(got).toHaveLength(planted.length)
  })

  test('SEC-6 S20 a fixture entry naming a file outside __fixtures__, a missing file, or no reason is a problem and exempts nothing', () => {
    const GRANTS = grantsFile()
    const STANDIN = standinFile()
    const GONE = `${path.posix.dirname(STANDIN)}/gone.sql`
    const files = sqlFiles('db')
    const outside = grantScan(files, [{ file: GRANTS, reason: 'not a fixture (Test)' }])
    expect(outside.problems).toEqual([`grant fixture entry ${GRANTS} is not under a __fixtures__ folder: only a fixture is exempt`])
    expect(outside.files.some((f) => f.file === GRANTS)).toBe(true)
    expect(grantScan(files, [{ file: GONE, reason: 'why (Test)' }]).problems).toEqual([`stale grant fixture entry ${GONE}`])
    expect(grantScan(files, [{ file: STANDIN, reason: ' ' }]).problems).toEqual([`grant fixture entry ${STANDIN} needs a reason`])
  })
})

describe('SC11 R108 a security definer function sets search_path and is on an allow list (SEC-6)', () => {
  const FN = (extra: string, body = 'select 1'): string =>
    `create or replace function returns.f() returns int language sql security definer ${extra} as $$ ${body} $$;`
  const entry: Allow = { file: 'db/x.sql', statement: 'returns.f', owner: 'GL3', reason: 'why' }

  test('SEC-6 PLANT: a security definer without set search_path is reported, even with an allow entry', () => {
    expect(definerProblems(sql(FN('')), [entry])).toEqual(['db/x.sql:1 security definer returns.f sets no search_path'])
  })

  test('SEC-6 a set search_path in the body does not count; one in the header does', () => {
    expect(definerProblems(sql(FN('', 'set search_path = x; select 1')), [entry])).toHaveLength(1)
    expect(definerProblems(sql(FN("set search_path = returns, pg_temp")), [entry])).toEqual([])
    expect(definerProblems(sql(FN('set search_path to pg_catalog')), [entry])).toEqual([])
  })

  test('SEC-6 a definer with search_path but no allow entry is reported; a stale or reasonless entry fails', () => {
    const ok = FN('set search_path = pg_temp')
    expect(definerProblems(sql(ok), [])).toEqual(['db/x.sql:1 security definer returns.f is not on the allow list'])
    expect(definerProblems(sql('select 1;'), [entry])).toEqual(['stale definer allow entry db/x.sql: returns.f'])
    expect(definerProblems(sql(ok), [{ ...entry, reason: '' }])).toHaveLength(1)
  })

  test('SEC-6 security invoker functions, procedures written in other ways, and quoted names', () => {
    expect(definerProblems(sql('create function returns.g() returns int language sql security invoker as $$ select 1 $$;'), [])).toEqual([])
    const proc = 'create procedure returns."P"() language sql security definer as $$ select 1 $$;'
    expect(definerProblems(sql(proc), [{ ...entry, statement: 'returns.p' }])).toEqual(['db/x.sql:1 security definer returns.p sets no search_path'])
  })

  test('SEC-6 the real db/**/*.sql has no security definer outside the allow list (which GL3 fills)', () => {
    expect(definerProblems(sqlFiles('db'), list('definerAllow'))).toEqual([])
  })
})
