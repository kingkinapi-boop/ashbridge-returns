// W00b acceptance tests: the SEC-11 made-up data guard, closed-world (findings W00 r2 RC1, RC4, S1 to S4, S8).
// Spec-writer owned: builders never edit this file. Helpers: testworld/model/__fixtures__/guard/world.ts.
//
// Every case comes from a walk over the numbered folders of reference/sample-clients/ (all 15 today) or from
// fast-check with a fixed seed, never from a typed list of fields or shapes.
//
// Public API these tests fix (sync or async results both work; the tests await every call):
//   testworld/model/guard-fields.ts (`// @mutate`)
//     classOf(pattern: string): 'name' | 'id-number' | 'free-text' | 'code' | 'other' | undefined
//       The closed, hand-written table of every JSON leaf path. `pattern` is the leaf's path with keys joined by
//       "." and every array index written "[]" after its key, for example "parties[].name",
//       "t2Inputs.slips.T4[].employee", "notes[]", "statementBalances.CHQ[].month" (a table row may use a wildcard
//       for record keys such as account keys and months). The same table serves every JSON file (answer-key.json,
//       onboarding.json, a kind's JSON); undefined means unclassified.
//   testworld/model/guard.ts (one NFKC scanner)
//     guardFolder(folder: string): Finding[]   every file under the folder, nested folders included
//     guardValue(value: unknown): Finding[]    one JSON-like value (W20 and the kinds), paths as in a file
//       Finding = { record: string; reason: string } (more fields allowed). For a file the record holds the file's
//       path relative to the folder (with "/"), and for JSON also the concrete leaf path with its array indices;
//       for a text file it may add the line or cell. For guardValue the record holds the concrete path. A clean
//       folder or value gives []. Plants in a sample copy are judged by the findings that were not there before.
//     Reasons (each finding names what it found: the record or the reason holds the planted value):
//       a JSON leaf path the table does not class          reason contains "unclassified"
//       a name-class value not ending "(Test)"             reason contains "(Test)"
//       a declared person's bare name in any text without "(Test)" after it or TEST in the same text unit
//         (string, line or cell)                           reason contains "(Test)" or "TEST", label names the person
//       a nine-digit number that passes its check digit    reason contains "check digit"
//       a phone number outside 555-0100 to 555-0199        reason contains "phone"
//       a file of a kind that cannot be read as text       reason contains "cannot be checked"
//       a text file that is not valid UTF-8                reason contains "UTF-8" or "cannot be checked"
//     Every JSON leaf is scanned (keys and values, strings and numbers, from the source text and the value),
//     whatever its class. Text kinds: .json, .csv, .md, .txt, .tsv, .xml, .ts. Anything else, a file with no
//     extension and a dotfile cannot be checked.
//     Text units: a JSON key or value, a line of .md, .txt, .xml or .ts, a CSV cell (quoted or not), a TSV cell.
//     Declared persons: answer-key parties of kind "person" (the guard may declare more).
//   testworld/index.ts
//     loadKind(id: KindId, opts?: { root?: string }): Kind   the kind folder is `<root>/<id>` (default root
//       testworld/kinds); it runs guardFolder on that folder and throws (or rejects) when there is any finding,
//       with the finding in its message or its `issues`; "not built" as before when the folder is missing.
//     loadClient(id, { root }) refuses a client the guard refuses (check 'made-up-data'), as in W00.
//
// Throwaway scan of all 15 folders before this spec (a reference scanner written for the scan, not committed):
// no nine-digit number passes its check digit; no phone or e-mail outside the test ranges; every name path ends
// "(Test)"; every file is ASCII .json, .csv or .md. Three folders name a declared person bare in text, which this
// guard refuses (reported to the Lead, fixed by the generator): 07 (Grace Liu: answer-key flags detail and
// profile.md line 33), 09 (Wei Zhang, Olu Adeyemi: answer-key flags detail and profile.md line 33), 14 (Declan
// Murphy: answer-key flags detail and profile.md line 36). Until then the two "S1 no false alarm" tests fail for C07,
// C09 and C14, and so do the W00 tests that load those three clients (once guardIssues refuses bare names in text).
// Re-scanned 3 Oct 2026 on W00c merged with main: the same three folders, nothing else.
//
// Round 3 (A409, reports/W00b-spec-review.md gaps 1 to 10; the card's directive settles the choices):
//   classOf may also answer 'money': a JSON number at a money path is not a nine-digit candidate, a string there is
//     (so the walk plants a string, not a number, at a money path). Money is never the class of a count, a code, a
//     line number, a year or a percent, and a money path holds only numbers (or null) in the samples.
//   loadKind imports `<root>/<id>/kind.ts` and runs guardValue on its exports ({ exportName: value }, so
//     `export const parties = [...]` is the path "parties[]..."); a kind.ts that cannot be imported is refused.
//   The guard parses JSON itself: a key repeated in one object is refused (or the hidden value is still found).
//   Links: a link that resolves inside the folder is scanned like the file it points to; a link that leads out of
//     the folder, dangles or loops is refused naming the link (a link loop never hangs).
//   loadClient refuses with check 'made-up-data' whatever guardFolder refuses (one scanner for both).
//   Nine digits: a separator in any of the 8 gaps may be any \p{Zs} or \p{Pd} code point; an ISO date or month
//     (ASCII hyphens after NFKC) next to a number is a date, not a nine-digit number; transaction ids, GIFI and
//     account codes are never a number or a phone.
//   Declared persons: every one, in any of six writings (Last, First; upper; lower; NBSP; two spaces; 's).
//   E-mail: an address outside example.com/.org/.net, .example, .test, .invalid and localhost is refused (reason
//     contains "e-mail" or "email"), after NFKC, with non-ASCII local parts and domains.
//   Fail closed: a missing folder, a file given as a folder, a FIFO, an unreadable file and any value that is not
//     JSON-like (Map, Set, Date, BigInt, undefined, a function, NaN, Infinity, a cycle) are refused (a throw or a
//     finding), never []. A bare top-level string given to guardValue is free text: scanned, and clean text is [].
//   Card numbers (gap 10, its own describe so it can move to SC R34): 13 to 19 digits passing Luhn, run together or
//     in groups, are refused (reason contains "check digit" or "card").
//   No address, postal code or date-of-birth rule now: no sample holds one (card directive).
import fc from 'fast-check'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { loadClient, loadKind } from '../index'
import { TestWorldLoadError, type LoadIssue } from './index'
import {
  CARD,
  EMAIL,
  ISO_DATE_SHAPE,
  REPEATED,
  attempt,
  expectRefused,
  fullWidthAscii,
  guardApi,
  isDataKey,
  joinNine,
  link,
  luhnBroken,
  luhnComplete,
  luhnValid,
  sampleNodes,
  spaceAndDashCodePoints,
  under,
  CANNOT_CHECK,
  EN_DASH,
  NBSP,
  CHECK_DIGIT,
  FIELD_CLASSES,
  NAME_TEST,
  NINE_PREFIXES,
  NINE_SEPARATORS,
  NINE_SUFFIXES,
  NOT_UTF8,
  PERSON_IN_TEXT,
  PHONE,
  UNCLASSIFIED,
  bare,
  classOfApi,
  copyFolder,
  declaredPersons,
  editJson,
  expectFinding,
  expectNewFinding,
  expectNoFinding,
  filesIn,
  folderFindings,
  fullWidth,
  leaves,
  namePathPlants,
  pruneTo,
  readJson,
  removeTemps,
  sampleFolders,
  sampleLeaves,
  samplePatterns,
  setAt,
  tempFolder,
  valueFindings,
  withCheckDigit,
  withWrongDigit,
  writeNine,
  type Finding,
  type Json,
  type NineShape,
  type SampleFolder,
} from './__fixtures__/guard/world'

afterAll(() => {
  removeTemps()
})

const SEED = 20261002
const RUNS = 40
const FOLDERS = sampleFolders()
const C01 = FOLDERS.find((f) => f.id === 'C01')
if (C01 === undefined) throw new Error('fixture: no sample folder 01')
const firstOf = <T>(xs: readonly T[], what: string): T => {
  const x = xs[0]
  if (x === undefined) throw new Error(`fixture: no ${what}`)
  return x
}

// Made-up numbers, all computed: one that passes its check digit (real-looking), one that fails (made up).
const REAL9 = withCheckDigit('13069254')
const MADE9 = withWrongDigit('13069254')

describe('W00b S1: SEC-11 closed world, every JSON leaf path is classed', () => {
  test('SEC-11 S1 the walk finds the samples (15 folders, hundreds of distinct paths)', () => {
    expect(FOLDERS.length).toBeGreaterThanOrEqual(15)
    const patterns = new Set(FOLDERS.flatMap((f) => filesIn(f.dir).filter((x) => x.endsWith('.json')).flatMap((x) => leaves(readJson(join(f.dir, x))).map((l) => l.pattern))))
    expect(patterns.size).toBeGreaterThan(400)
  })

  test.each(FOLDERS.map((f) => [f.id, f] as const))('SEC-11 S1 every JSON leaf path of %s is classed in guard-fields.ts', async (_id, folder) => {
    const classOf = await classOfApi()
    const unclassed = new Set<string>()
    for (const file of filesIn(folder.dir).filter((x) => x.endsWith('.json'))) {
      for (const l of leaves(readJson(join(folder.dir, file)))) {
        if (!FIELD_CLASSES.includes(classOf(l.pattern) as never)) unclassed.add(`${file} ${l.pattern}`)
      }
    }
    expect([...unclassed]).toEqual([])
  })

  test.each(namePathPlants().map((l) => [l.pattern, l] as const))('SEC-11 S1 %s (every sample value ends "(Test)") is classed name', async (pattern) => {
    const classOf = await classOfApi()
    expect(classOf(pattern)).toBe('name')
  })

  test.each([
    'nickname',
    'parties[].nickname',
    'corporation.nickname',
    'owners[].nickname',
    // known keys in a place the samples never put them: the table goes by path, not by key
    'corporation.grantor',
    'owners[].tenant',
    'flags[].name',
    'transactions[].holder',
    'notes[].name',
  ])('SEC-11 S1 the path %s is unclassified', async (pattern) => {
    const classOf = await classOfApi()
    expect(classOf(pattern)).toBeUndefined()
  })

  test.each([
    ['answer-key.json', ['nickname']],
    ['onboarding.json', ['owners', 0, 'nickname']],
    ['onboarding.json', ['corporation', 'contact_nickname']],
  ] as const)('SEC-11 S1 a planted {"nickname"} leaf in %s at %j is refused as unclassified', async (file, steps) => {
    const { dir } = copyFolder(C01)
    editJson(join(dir, file), (doc) => {
      setAt(doc, steps, 'x')
    })
    const findings = await folderFindings(dir)
    expectFinding(findings, UNCLASSIFIED, file, String(steps.at(-1)))
  })

  test.each([
    ['a number', 7],
    ['a boolean', true],
    ['null', null],
    ['an object', { inner: 'x' }],
    ['a list', ['x']],
  ] as const)('SEC-11 S1 an unclassified leaf holding %s is refused (every leaf, not only strings)', async (_kind, value) => {
    expectFinding(await valueFindings({ nickname: value }), UNCLASSIFIED, 'nickname')
    const dir = tempFolder({ 'onboarding.json': JSON.stringify({ client_notes: ['made up'], nickname: value }) })
    expectFinding(await folderFindings(dir), UNCLASSIFIED, 'onboarding.json', 'nickname')
  })

  test('SEC-11 S1 guardValue refuses an unclassified leaf, at the top and nested', async () => {
    expectFinding(await valueFindings({ nickname: 'x' }), UNCLASSIFIED, 'nickname')
    expectFinding(await valueFindings({ parties: [{ name: 'Ada Quill (Test)', kind: 'person', nickname: 'x' }] }), UNCLASSIFIED, 'nickname')
  })

  test('SEC-11 S1 loadClient refuses a client whose answer key has an unclassified leaf', async () => {
    const { root, dir } = copyFolder(C01)
    editJson(join(dir, 'answer-key.json'), (doc) => {
      setAt(doc, ['nickname'], 'x')
    })
    let caught: unknown
    try {
      await Promise.resolve(loadClient('C01', { root }))
    } catch (e) {
      caught = e
    }
    expect(caught, 'C01 with a nickname leaf should be refused').toBeInstanceOf(TestWorldLoadError)
    const issues = (caught as TestWorldLoadError).issues
    const hit = issues.some((i) => i.check === 'made-up-data' && UNCLASSIFIED.test(i.reason) && `${i.record} ${i.reason}`.includes('nickname'))
    expect(hit, JSON.stringify(issues)).toBe(true)
  })

  test.each(FOLDERS.map((f) => [f.id, f] as const))('SEC-11 S1 no false alarm: guardFolder on sample %s as committed gives no finding', async (_id, folder) => {
    expect(await folderFindings(folder.dir)).toEqual([])
  })

  test.each(FOLDERS.map((f) => [f.id, f] as const))('SEC-11 S1 no false alarm: guardValue on each JSON file of sample %s gives no finding', async (_id, folder) => {
    for (const file of filesIn(folder.dir).filter((x) => x.endsWith('.json'))) {
      expect(await valueFindings(readJson(join(folder.dir, file))), file).toEqual([])
    }
  })
})

describe('W00b S2: SEC-11 names by the walk', () => {
  test('SEC-11 S2 the walk finds the name paths the samples use', () => {
    const patterns = namePathPlants().map((l) => l.pattern)
    for (const p of ['name', 'parties[].name', 'corporation.legal_name', 'owners[].name', 'tenants[].tenant', 'grant.grantor']) expect(patterns).toContain(p)
  })

  test.each(namePathPlants().map((l) => [l.pattern, l.folder.id, l.file, l] as const))(
    'SEC-11 S2 a bare name at %s (first found in %s %s) is refused by guardFolder and guardValue',
    async (_pattern, _id, file, leaf) => {
      const value = leaf.value as string
      const planted = bare(value)
      expect(planted).not.toBe(value)
      const { dir } = copyFolder(leaf.folder)
      const before = await folderFindings(dir)
      const doc = readJson(join(dir, file))
      const valueBefore = await valueFindings(doc)
      setAt(doc, leaf.steps, planted)
      editJson(join(dir, file), (d) => {
        setAt(d, leaf.steps, planted)
      })
      expectNewFinding(before, await folderFindings(dir), NAME_TEST, file, planted)
      expectNewFinding(valueBefore, await valueFindings(doc), NAME_TEST, planted)
    },
  )

  test.each(['key', 'account', 'gifiName'])('SEC-11 S2 {"name":"Jane Doe","%s":"x"} at a name path is still a name and is refused', async (extra) => {
    const { dir } = copyFolder(C01)
    const before = await folderFindings(dir)
    const party: Json = { name: 'Jane Doe', kind: 'person', [extra]: 'x' }
    editJson(join(dir, 'answer-key.json'), (doc) => {
      const parties = (doc as { parties: Json[] }).parties
      parties.push(party)
    })
    expectNewFinding(before, await folderFindings(dir), NAME_TEST, 'answer-key.json', 'Jane Doe')
    expectFinding(await valueFindings({ parties: [party] }), NAME_TEST, 'Jane Doe')
  })

  test.each(['Jane (Test) Doe', 'Jane Doe (test)', 'Jane Doe(Test) extra', ' '])('SEC-11 S2 a name that does not end "(Test)" ("%s") is refused', async (name) => {
    expectFinding(await valueFindings({ parties: [{ name, kind: 'person' }] }), NAME_TEST, 'parties')
  })

  test('SEC-11 S2 a list of payers is refused when one of them lacks "(Test)"', async () => {
    const payer = 'Maplegate Banc Corp. (Test), Northern Power Utilities Inc.'
    expectFinding(await valueFindings({ t2Inputs: { schedule3: { dividendsReceived: [{ payer }] } } }), NAME_TEST, 'payer')
  })

  // Every declared person, bare, in each kind of text: a profile line, a JSON note, a client note, a CSV cell.
  type Plant = (dir: string, folder: SampleFolder, name: string) => string
  const firstCsv = (folder: SampleFolder): string => firstOf(filesIn(folder.dir).filter((x) => x.endsWith('.csv')), `CSV in ${folder.name}`)
  const PLACES: [string, Plant][] = [
    [
      'profile.md',
      (dir, _f, name) => {
        const p = join(dir, 'profile.md')
        writeFileSync(p, `${readFileSync(p, 'utf8')}\nSpoke with ${name} about the books.\n`)
        return 'profile.md'
      },
    ],
    [
      'answer-key.json notes',
      (dir, _f, name) => {
        editJson(join(dir, 'answer-key.json'), (doc) => {
          const d = doc as { notes?: Json[] }
          d.notes = [...(d.notes ?? []), `Spoke with ${name} about the books.`]
        })
        return 'answer-key.json'
      },
    ],
    [
      'onboarding.json client_notes',
      (dir, _f, name) => {
        editJson(join(dir, 'onboarding.json'), (doc) => {
          const d = doc as { client_notes?: Json[] }
          d.client_notes = [...(d.client_notes ?? []), `${name} will send the receipts.`]
        })
        return 'onboarding.json'
      },
    ],
    [
      'a CSV cell',
      (dir, folder, name) => {
        const file = firstCsv(folder)
        const p = join(dir, file)
        writeFileSync(p, `${readFileSync(p, 'utf8').replace(/\r?\n?$/, '\n')}2025-12-31,"E-TRANSFER ${name.toUpperCase()}",1.00\n`)
        return file
      },
    ],
  ]
  const PERSON_CASES = FOLDERS.flatMap((f) => {
    const p = declaredPersons(f)[0]
    return p === undefined ? [] : PLACES.map(([place, plant]) => [f.id, bare(p), place, f, plant] as const)
  })

  test('SEC-11 S2 the walk finds a declared person in most sample folders', () => {
    expect(new Set(PERSON_CASES.map((c) => c[0])).size).toBeGreaterThanOrEqual(12)
  })

  test.each(PERSON_CASES)('SEC-11 S2 %s: the declared person "%s" bare in %s is refused', async (_id, name, _place, folder, plant) => {
    const { dir } = copyFolder(folder)
    const before = await folderFindings(dir)
    const file = plant(dir, folder, name)
    expectNewFinding(before, await folderFindings(dir), PERSON_IN_TEXT, file, [name, name.toUpperCase()])
  })

  test('SEC-11 S2 no false alarm: a person written with "(Test)", or in a bank cell that carries TEST, is accepted', async () => {
    const person = bare(firstOf(declaredPersons(C01), 'person in 01'))
    const { dir } = copyFolder(C01)
    const before = await folderFindings(dir)
    const profile = join(dir, 'profile.md')
    writeFileSync(profile, `${readFileSync(profile, 'utf8')}\nSpoke with ${person} (Test) about the books.\n`)
    const csv = join(dir, firstCsv(C01))
    writeFileSync(csv, `${readFileSync(csv, 'utf8').replace(/\r?\n?$/, '\n')}2025-12-31,"E-TRANSFER ${person.toUpperCase()} TEST",1.00\n`)
    expect(await folderFindings(dir)).toEqual(before)
  })
})

// ---- S3: numbers and phones, by property ----

const digits8 = fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 8 }).map((d) => d.join(''))
const nineShape: fc.Arbitrary<NineShape> = fc.record({
  sep1: fc.constantFrom(...NINE_SEPARATORS),
  sep2: fc.constantFrom(...NINE_SEPARATORS),
  prefix: fc.constantFrom(...NINE_PREFIXES),
  suffix: fc.constantFrom(...NINE_SUFFIXES),
  wide: fc.boolean(),
})

// Money: cents up to ten billion dollars, half of them built from a real-looking nine-digit number (7 + 2 digits).
const moneyCents = fc.oneof(
  fc.bigInt({ min: 0n, max: 1_000_000_000_000n }),
  digits8.map((d8) => BigInt(withCheckDigit(d8))),
)

/** One placement of a piece of text: where it goes and how the guard is asked. Each returns the findings. */
type Placement = [string, (text: string) => Promise<{ findings: Finding[]; file: string }>]
const csvQuote = (s: string): string => `"${s.replace(/"/g, '""')}"`
const PLACEMENTS: Placement[] = [
  [
    'a JSON string (guardFolder)',
    async (text) => ({ findings: await folderFindings(tempFolder({ 'onboarding.json': JSON.stringify({ client_notes: [`On file: ${text} for the year.`] }) })), file: 'onboarding.json' }),
  ],
  ['a JSON string (guardValue)', async (text) => ({ findings: await valueFindings({ client_notes: [`On file: ${text} for the year.`] }), file: 'client_notes' })],
  [
    'a CSV cell quoted with commas',
    async (text) => ({
      findings: await folderFindings(tempFolder({ 'accounts/chq.csv': `Date,Description,Amount\n2025-01-02,${csvQuote(`NOTE, ${text}, MORE`)},1.00\n` })),
      file: 'accounts/chq.csv',
    }),
  ],
  ['an md line', async (text) => ({ findings: await folderFindings(tempFolder({ 'profile.md': `# Notes (Test)\n\nOn file: ${text}\n` })), file: 'profile.md' })],
]

describe('W00b S3: SEC-11 a nine-digit number that passes its check digit is refused in every placement and shape', () => {
  test('SEC-11 S3 fixture: the computed numbers pass and fail their check digit', () => {
    expect(REAL9).toHaveLength(9)
    expect(MADE9).toHaveLength(9)
    expect(withCheckDigit('13069254')).toBe(REAL9)
    expect(REAL9).not.toBe(MADE9)
  })

  test.each(PLACEMENTS)('SEC-11 S3 property: any shape in %s is refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(digits8, nineShape, async (d8, shape) => {
        const text = writeNine(withCheckDigit(d8), shape)
        const { findings, file } = await place(text)
        expectFinding(findings, CHECK_DIGIT, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test('SEC-11 S3 property: any shape as a JSON key is refused', async () => {
    await fc.assert(
      fc.asyncProperty(digits8, nineShape, async (d8, shape) => {
        const key = writeNine(withCheckDigit(d8), shape)
        const findings = await folderFindings(tempFolder({ 'onboarding.json': JSON.stringify({ client_notes: ['x'], [key]: 'x' }) }))
        expectFinding(findings, CHECK_DIGIT, 'onboarding.json')
        expectFinding(await valueFindings({ [key]: 'x' }), CHECK_DIGIT, [key, key.normalize('NFKC')])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test('SEC-11 S3 property: as a JSON number, integer or exponent, is refused (source text and value)', async () => {
    const real = fc.tuple(fc.integer({ min: 1, max: 9 }), fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 7, maxLength: 7 })).map(([a, r]) => withCheckDigit(`${String(a)}${r.join('')}`))
    await fc.assert(
      fc.asyncProperty(real, fc.constantFrom('int', 'e8', 'E+8', 'cents-e2', 'point-zero', 'negative'), async (n, form) => {
        const source =
          form === 'int'
            ? n
            : form === 'e8'
              ? `${n.slice(0, 1)}.${n.slice(1)}e8`
              : form === 'E+8'
                ? `${n.slice(0, 1)}.${n.slice(1)}E+8`
                : form === 'cents-e2'
                  ? `${n.slice(0, 7)}.${n.slice(7)}e2`
                  : form === 'point-zero'
                    ? `${n}.0`
                    : `-${n}`
        const findings = await folderFindings(tempFolder({ 'onboarding.json': `{"staff": {"employees": ${source}}}` }))
        expectFinding(findings, CHECK_DIGIT, 'onboarding.json')
        expectFinding(await valueFindings({ staff: { employees: Number(n) } }), CHECK_DIGIT, 'employees')
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each([
    ['BN.', `BN.${REAL9}`],
    ['mixed separators', `${REAL9.slice(0, 3)}-${REAL9.slice(3, 6)} ${REAL9.slice(6)}`],
    ['dots', `${REAL9.slice(0, 3)}.${REAL9.slice(3, 6)}.${REAL9.slice(6)}`],
    ['commas', `${REAL9.slice(0, 3)},${REAL9.slice(3, 6)},${REAL9.slice(6)}`],
    ['NBSP', `${REAL9.slice(0, 3)}${NBSP}${REAL9.slice(3, 6)}${NBSP}${REAL9.slice(6)}`],
    ['en dash', `${REAL9.slice(0, 3)}${EN_DASH}${REAL9.slice(3, 6)}${EN_DASH}${REAL9.slice(6)}`],
    ['slash', `${REAL9.slice(0, 3)}/${REAL9.slice(3, 6)}/${REAL9.slice(6)}`],
    ['full-width digits', fullWidth(REAL9)],
    ['SIN: prefix and RT0001 suffix', `SIN:${REAL9}RT0001`],
  ])('SEC-11 S3 example: %s in an md line is refused', async (_shape, text) => {
    expectFinding(await folderFindings(tempFolder({ 'profile.md': `On file: ${text}\n` })), CHECK_DIGIT, 'profile.md')
  })

  test.each(PLACEMENTS)('SEC-11 S3 control property: a number that fails its check digit, in any shape in %s, is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(digits8, nineShape, async (d8, shape) => {
        const { findings } = await place(writeNine(withWrongDigit(d8), shape))
        expect(findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  const group = (int: string): string => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const moneyText = fc.tuple(moneyCents, fc.constantFrom('plain', 'grouped', 'dollar', 'minus', 'brackets', 'minus-dollar')).map(([c, style]) => {
    const int = (c / 100n).toString()
    const cc = (c % 100n).toString().padStart(2, '0')
    const g = `${group(int)}.${cc}`
    return style === 'plain' ? `${int}.${cc}` : style === 'grouped' ? g : style === 'dollar' ? `$${g}` : style === 'minus' ? `-${int}.${cc}` : style === 'brackets' ? `(${g})` : `-$${g}`
  })

  test.each(PLACEMENTS)('SEC-11 S3 control property: money in %s is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(moneyText, async (m) => {
        const { findings } = await place(m)
        expect(findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test('SEC-11 S3 control property: money as a JSON number is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(moneyCents, async (c) => {
        const source = `${(c / 100n).toString()}.${(c % 100n).toString().padStart(2, '0')}`
        const findings = await folderFindings(tempFolder({ 'onboarding.json': `{"shareholder_loans": [{"amount": ${source}}]}` }))
        expect(findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test('SEC-11 S3 loadClient refuses a real-looking SIN written as a JSON number', async () => {
    const { root, dir } = copyFolder(C01)
    editJson(join(dir, 'onboarding.json'), (doc) => {
      setAt(doc, ['staff', 'employees'], Number(REAL9))
    })
    let caught: unknown
    try {
      await Promise.resolve(loadClient('C01', { root }))
    } catch (e) {
      caught = e
    }
    expect(caught, 'C01 with a real-looking SIN should be refused').toBeInstanceOf(TestWorldLoadError)
    const issues = (caught as TestWorldLoadError).issues
    expect(issues.some((i) => i.check === 'made-up-data' && CHECK_DIGIT.test(i.reason)), JSON.stringify(issues)).toBe(true)
  })
})

// Every leaf the walk finds is scanned, whatever its class: one plant at a time, at the first leaf of each distinct
// pattern (folder order), as a JSON number where the leaf is a number and as text otherwise.
const LEAF_PLANTS = (() => {
  const seen = new Set<string>()
  return sampleLeaves().filter((l) => !seen.has(l.pattern) && (seen.add(l.pattern), true))
})()
const LEAF_PLANTS_BY_FOLDER = FOLDERS.map((f) => [f.id, LEAF_PLANTS.filter((l) => l.folder.id === f.id)] as const).filter(([, ls]) => ls.length > 0)
const lastKey = (steps: readonly (string | number)[]): string => [...steps].reverse().find((s) => typeof s === 'string') ?? ''

describe('W00b S3: SEC-11 every JSON leaf path the walk finds is scanned for numbers', () => {
  test('SEC-11 S3 the walk plants at every distinct path (hundreds)', () => {
    expect(LEAF_PLANTS.length).toBe(samplePatterns().length)
    expect(LEAF_PLANTS.length).toBeGreaterThan(400)
  })

  // Each plant goes into the smallest document that still holds the leaf at its path (pruneTo), so the walk stays fast;
  // the guard is asked with and without the plant, and only the new findings count.
  test.each(LEAF_PLANTS_BY_FOLDER)('SEC-11 S3 a real-looking SIN at each path first found in %s is refused (guardFolder and guardValue)', async (_id, plants) => {
    const spaced = `${REAL9.slice(0, 3)} ${REAL9.slice(3, 6)} ${REAL9.slice(6)}`
    const misses: string[] = []
    const key = (f: Finding): string => JSON.stringify([f.record, f.reason])
    const fresh = (after: Finding[], before: Finding[]): Finding[] => {
      const old = new Set(before.map(key))
      return after.filter((f) => !old.has(key(f)))
    }
    const hit = (fs: Finding[], ...hints: string[]): boolean => fs.some((f) => CHECK_DIGIT.test(f.reason) && hints.every((h) => `${f.record} ${f.reason}`.includes(h)))
    // Round 3 (card decision): a JSON number at a money path is not a nine-digit candidate, so a money path gets the
    // string; every other number leaf gets the JSON number.
    const classOf = await classOfApi()
    for (const leaf of plants) {
      const small = pruneTo(readJson(join(leaf.folder.dir, leaf.file)), leaf.steps)
      const beforeFolder = await folderFindings(tempFolder({ [leaf.file]: JSON.stringify(small.doc) }))
      const beforeValue = await valueFindings(small.doc)
      setAt(small.doc, small.steps, typeof leaf.value === 'number' && classOf(leaf.pattern) !== 'money' ? Number(REAL9) : `ref ${spaced}`)
      const name = lastKey(leaf.steps)
      if (!hit(fresh(await folderFindings(tempFolder({ [leaf.file]: JSON.stringify(small.doc, null, 2) })), beforeFolder), leaf.file, name)) misses.push(`guardFolder ${leaf.file} ${leaf.pattern}`)
      if (!hit(fresh(await valueFindings(small.doc), beforeValue), name)) misses.push(`guardValue ${leaf.file} ${leaf.pattern}`)
    }
    expect(misses).toEqual([])
  })
})

// More placements: every text kind the guard reads (S4) holds a number or a phone the same way. A bare (unquoted)
// CSV cell cannot hold a comma, so its shapes leave the comma out.
const MORE_PLACEMENTS: [string, (text: string) => Promise<{ findings: Finding[]; file: string }>, boolean][] = [
  ['a .txt line', async (text) => ({ findings: await folderFindings(tempFolder({ 'notes.txt': `Made up (Test).\nOn file: ${text}\n` })), file: 'notes.txt' }), true],
  ['a .tsv cell', async (text) => ({ findings: await folderFindings(tempFolder({ 'data.tsv': `Date\tDescription\tAmount\n2025-01-02\tNOTE ${text}\t1.00\n` })), file: 'data.tsv' }), true],
  ['an .xml element', async (text) => ({ findings: await folderFindings(tempFolder({ 'data.xml': `<?xml version="1.0"?>\n<note>On file: ${text}</note>\n` })), file: 'data.xml' }), true],
  ['a .ts string', async (text) => ({ findings: await folderFindings(tempFolder({ 'kind.ts': `export const note = 'On file: ${text}'\n` })), file: 'kind.ts' }), true],
  ['an unquoted CSV cell', async (text) => ({ findings: await folderFindings(tempFolder({ 'accounts/chq.csv': `Date,Description,Amount\n2025-01-02,NOTE ${text},1.00\n` })), file: 'accounts/chq.csv' }), false],
]
const nineShapeNoComma: fc.Arbitrary<NineShape> = nineShape.filter((s) => s.sep1 !== ',' && s.sep2 !== ',')

describe('W00b S3: SEC-11 numbers in every text kind', () => {
  test.each(MORE_PLACEMENTS)('SEC-11 S3 property: any shape in %s is refused', async (_where, place, commas) => {
    await fc.assert(
      fc.asyncProperty(digits8, commas ? nineShape : nineShapeNoComma, async (d8, shape) => {
        const { findings, file } = await place(writeNine(withCheckDigit(d8), shape))
        expectFinding(findings, CHECK_DIGIT, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(MORE_PLACEMENTS)('SEC-11 S3 control property: a number that fails its check digit, in any shape in %s, is accepted', async (_where, place, commas) => {
    await fc.assert(
      fc.asyncProperty(digits8, commas ? nineShape : nineShapeNoComma, async (d8, shape) => {
        const { findings } = await place(writeNine(withWrongDigit(d8), shape))
        expect(findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(MORE_PLACEMENTS)('SEC-11 S3 control property: money in %s is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(moneyCents, async (c) => {
        const { findings } = await place(`${(c / 100n).toString()}.${(c % 100n).toString().padStart(2, '0')}`)
        expect(findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})

const SEPS = ['', ' ', '-', '.', NBSP, EN_DASH] as const
const NANP_PREFIXES = ['', '1', '+1', '1 ', '+1 ', '1-', '+1-'] as const
const nanp = (allowed: boolean): fc.Arbitrary<string> =>
  fc
    .record({
      area: fc.integer({ min: 200, max: 999 }),
      exch: allowed ? fc.constant(555) : fc.integer({ min: 200, max: 999 }),
      line: allowed ? fc.integer({ min: 100, max: 199 }) : fc.integer({ min: 0, max: 9999 }),
      prefix: fc.constantFrom(...NANP_PREFIXES),
      bracket: fc.boolean(),
      sepA: fc.constantFrom(...SEPS),
      sepB: fc.constantFrom(...SEPS),
      wide: fc.boolean(),
    })
    .filter((r) => allowed || !(r.exch === 555 && r.line >= 100 && r.line <= 199))
    .map((r) => {
      const line = String(r.line).padStart(4, '0')
      const area = r.bracket ? `(${String(r.area)})${r.sepA === ' ' ? ' ' : ''}` : `${String(r.area)}${r.sepA}`
      const body = `${area}${String(r.exch)}${r.sepB}${line}`
      return `${r.prefix}${r.wide ? fullWidth(body) : body}`
    })
const seven = (allowed: boolean): fc.Arbitrary<string> =>
  fc
    .record({
      exch: allowed ? fc.constant(555) : fc.integer({ min: 200, max: 999 }),
      line: allowed ? fc.integer({ min: 100, max: 199 }) : fc.integer({ min: 0, max: 9999 }),
      sep: fc.constantFrom(' ', '.', '-'),
    })
    .filter((r) => allowed || !(r.exch === 555 && r.line >= 100 && r.line <= 199))
    .map((r) => `${String(r.exch)}${r.sep}${String(r.line).padStart(4, '0')}`)
const international = fc
  .record({
    // a country code that does not start with 1 (1 is North America, tested above)
    cc: fc.oneof(fc.integer({ min: 2, max: 9 }), fc.integer({ min: 20, max: 99 }), fc.integer({ min: 200, max: 999 })),
    groups: fc.array(fc.integer({ min: 10, max: 9999 }), { minLength: 2, maxLength: 4 }),
    sep: fc.constantFrom(' ', '-'),
  })
  .map((r) => `+${String(r.cc)} ${r.groups.map((g) => String(g)).join(r.sep)}`)
  .filter((s) => {
    const n = s.replace(/\D/g, '').length
    return n >= 8 && n <= 15
  })

describe('W00b S3: SEC-11 phone numbers outside 555-01xx are refused in every format', () => {
  test.each(PLACEMENTS)('SEC-11 S3 property: a North American number with any separators, brackets or +1 in %s is refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(nanp(false), async (p) => {
        const { findings, file } = await place(`call ${p} after six`)
        expectFinding(findings, PHONE, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(PLACEMENTS)('SEC-11 S3 property: seven digits with a space, dot or hyphen in %s are refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(seven(false), async (p) => {
        const { findings, file } = await place(`call ${p} after six`)
        expectFinding(findings, PHONE, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(PLACEMENTS)('SEC-11 S3 property: any + international number in %s is refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(international, async (p) => {
        const { findings, file } = await place(`call ${p} after six`)
        expectFinding(findings, PHONE, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test('SEC-11 S3 a ten-digit phone written as a JSON number is refused', async () => {
    const phone = ['416', '867', '5309'].join('')
    expectFinding(await folderFindings(tempFolder({ 'onboarding.json': `{"staff": {"employees": ${phone}}}` })), PHONE, 'onboarding.json')
    expectFinding(await valueFindings({ staff: { employees: Number(phone) } }), PHONE, 'employees')
  })

  test.each(PLACEMENTS)('SEC-11 S3 control property: 555-0100 to 555-0199 in every format in %s is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(fc.oneof(nanp(true), seven(true)), async (p) => {
        const { findings } = await place(`call ${p} after six`)
        expect(findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})

describe('W00b S4: SEC-11 every file is checked or refused', () => {
  const sin = `${REAL9.slice(0, 3)} ${REAL9.slice(3, 6)} ${REAL9.slice(6)}`

  test.each([
    ['notes.txt', `Owner SIN ${sin}\n`],
    ['data.tsv', `Date\tDescription\tAmount\n2025-01-02\tSIN ${sin}\t1.00\n`],
    ['data.xml', `<?xml version="1.0"?>\n<note>SIN ${sin}</note>\n`],
    ['deep/er/notes.md', `SIN ${sin}\n`],
    ['accounts/old/chq.csv', `Date,Description,Amount\n2025-01-02,"SIN ${sin}",1.00\n`],
  ])('SEC-11 S4 a text file %s is scanned: a real-looking SIN in it is refused', async (file, body) => {
    expectFinding(await folderFindings(tempFolder({ [file]: body })), CHECK_DIGIT, file)
  })

  test.each([
    ['notes.txt', 'Made up (Test).\n'],
    ['data.tsv', 'Date\tDescription\tAmount\n2025-01-02\tCOFFEE\t1.00\n'],
    ['data.xml', '<?xml version="1.0"?>\n<note>made up</note>\n'],
    ['deep/er/notes.md', '# Notes\n'],
  ])('SEC-11 S4 a clean text file %s is accepted', async (file, body) => {
    expect(await folderFindings(tempFolder({ [file]: body }))).toEqual([])
  })

  test.each([
    ['scan.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])],
    ['book.xlsx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00])],
    ['README', 'plain words with no extension\n'],
    ['.hidden', 'a dotfile\n'],
    ['deep/er/photo.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
    ['notes.docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
  ])('SEC-11 S4 %s (binary or unknown) is refused as a file that cannot be checked', async (file, body) => {
    expectFinding(await folderFindings(tempFolder({ 'profile.md': '# Made up (Test)\n', [file]: body })), CANNOT_CHECK, file)
  })

  test.each(['profile.md', 'accounts/chq.csv', 'onboarding.json', 'notes.txt'])('SEC-11 S4 invalid UTF-8 in %s is refused', async (file) => {
    const bytes = new Uint8Array([0x53, 0x49, 0x4e, 0x20, 0xff, 0xfe, 0x0a])
    expectFinding(await folderFindings(tempFolder({ [file]: bytes })), NOT_UTF8, file)
  })

  test('SEC-11 S4 a JSON file that does not parse is refused as a file that cannot be checked', async () => {
    expectFinding(await folderFindings(tempFolder({ 'answer-key.json': '{"name": "Ada Quill (Test)",' })), CANNOT_CHECK, 'answer-key.json')
  })

  test('SEC-11 S4 a planted file in a sample copy is refused alongside the clean samples', async () => {
    const { dir } = copyFolder(C01)
    const before = await folderFindings(dir)
    writeFileSync(join(dir, 'accounts', 'statement.pdf'), new Uint8Array([0x25, 0x50, 0x44, 0x46]))
    expectNewFinding(before, await folderFindings(dir), CANNOT_CHECK, 'statement.pdf')
  })
})

describe('W00b S8: SEC-11 the kind gate', () => {
  type LoadKind = (id: string, opts?: { root?: string }) => unknown
  const askKind = (id: string, root: string): Promise<unknown> => Promise.resolve().then(() => (loadKind as unknown as LoadKind)(id, { root }))
  const refusedText = async (p: Promise<unknown>): Promise<string> => {
    let caught: unknown
    let loaded = false
    try {
      await p
      loaded = true
    } catch (e) {
      caught = e
    }
    expect(loaded, 'the kind should have been refused').toBe(false)
    const e = caught as { message?: unknown; issues?: unknown }
    return `${typeof e.message === 'string' ? e.message : ''} ${JSON.stringify(e.issues ?? [])}`
  }
  const sin = `${REAL9.slice(0, 3)} ${REAL9.slice(3, 6)} ${REAL9.slice(6)}`

  test('SEC-11 S8 loadKind refuses a kind whose .ts holds a SIN that passes its check digit', async () => {
    const root = tempFolder({ 'K05/kind.ts': `export const owner = { name: 'Ada Quill (Test)', sin: '${sin}' }\n` })
    const text = await refusedText(askKind('K05', root))
    expect(text).toMatch(CHECK_DIGIT)
    expect(text).toContain('kind.ts')
  })

  test('SEC-11 S8 loadKind refuses a kind whose .json holds a SIN that passes its check digit', async () => {
    const root = tempFolder({ 'K05/kind.json': JSON.stringify({ t2Inputs: { schedule50: [{ name: 'Ada Quill (Test)', sin: REAL9 }] } }) })
    const text = await refusedText(askKind('K05', root))
    expect(text).toMatch(CHECK_DIGIT)
    expect(text).toContain('kind.json')
  })

  test('SEC-11 S8 loadKind refuses a kind with a bare name at a name path and one with an unclassified leaf', async () => {
    const named = tempFolder({ 'K05/kind.json': JSON.stringify({ parties: [{ name: 'Ada Quill', kind: 'person' }] }) })
    expect(await refusedText(askKind('K05', named))).toMatch(NAME_TEST)
    const unknown = tempFolder({ 'K05/kind.json': JSON.stringify({ nickname: 'x' }) })
    expect(await refusedText(askKind('K05', unknown))).toMatch(UNCLASSIFIED)
  })

  test('SEC-11 S8 loadKind refuses a kind folder holding a file that cannot be checked', async () => {
    const root = tempFolder({ 'K05/kind.ts': 'export const k = 1\n', 'K05/scan.pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]) })
    const text = await refusedText(askKind('K05', root))
    expect(text).toMatch(CANNOT_CHECK)
    expect(text).toContain('scan.pdf')
  })

  test('SEC-11 S8 a clean kind folder loads from the given root', async () => {
    const root = tempFolder({
      // round 3: kind.ts exports are guarded by the closed table, so the clean kind uses classed paths
      'K05/kind.ts': "export const owners = [{ name: 'Ada Quill (Test)', sin: 'restricted-provided' }]\n",
      'K05/kind.json': JSON.stringify({ parties: [{ name: 'Ada Quill (Test)', kind: 'person' }] }),
    })
    const k = (await askKind('K05', root)) as { id?: unknown; folder?: unknown; status?: unknown }
    expect(k.id).toBe('K05')
    expect(k.status).toBe('built')
    expect(k.folder).toBe(join(root, 'K05'))
  })

  test('SEC-11 S8 a kind with no folder under the given root is still "not built"', async () => {
    const root = tempFolder({ 'K05/kind.ts': 'export const k = 1\n' })
    expect(await refusedText(askKind('K06', root))).toMatch(/not built/)
  })

  test('SEC-11 S8 guardValue refuses a name path without "(Test)" and accepts it with "(Test)"', async () => {
    expectFinding(await valueFindings({ owners: [{ name: 'Ada Quill' }] }), NAME_TEST, 'Ada Quill')
    expectNoFinding(await valueFindings({ owners: [{ name: 'Ada Quill (Test)' }] }), NAME_TEST)
  })
})

// =====================================================================================================================
// Round 3 (A409): the gaps of reports/W00b-spec-review.md, each walk-driven or by property (seed pinned).
// =====================================================================================================================

const SIN_SPACED = `${REAL9.slice(0, 3)} ${REAL9.slice(3, 6)} ${REAL9.slice(6)}`
type Place = (text: string) => Promise<{ findings: Finding[]; file: string }>
/** The nine placements: a JSON string (folder and value), a quoted CSV cell, an md line, .txt, .tsv, .xml, .ts, an unquoted CSV cell. */
const ALL_PLACEMENTS: [string, Place][] = [...PLACEMENTS, ...MORE_PLACEMENTS.map(([where, place]): [string, Place] => [where, place])]
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])
const either = (a: RegExp, b: RegExp): RegExp => new RegExp(`${a.source}|${b.source}`, 'i')
const R3_TIMEOUT = 30_000

type KindLoader = (id: string, opts?: { root?: string }) => unknown
const loadKindAt = (id: string, root: string): Promise<unknown> => Promise.resolve().then(() => (loadKind as unknown as KindLoader)(id, { root }))
/** The text of a kind refusal (message and issues); fails when the kind loads. */
async function kindRefusal(root: string, id = 'K05'): Promise<string> {
  let caught: unknown
  let loaded = false
  try {
    await loadKindAt(id, root)
    loaded = true
  } catch (e) {
    caught = e
  }
  expect(loaded, 'the kind should have been refused').toBe(false)
  const e = caught as { message?: unknown; issues?: unknown }
  return `${typeof e.message === 'string' ? e.message : ''} ${JSON.stringify(e.issues ?? [])}`
}

describe("W00b R3 gap 1: SEC-11 a kind's kind.ts exports are guarded by the closed world", () => {
  test('SEC-11 R3 gap 1 loadKind refuses a kind.ts exporting a bare name at a name path', async () => {
    const text = await kindRefusal(tempFolder({ 'K05/kind.ts': "export const parties = [{ name: 'Ada Quill', kind: 'person' }]\n" }))
    expect(text).toMatch(NAME_TEST)
    expect(text).toContain('Ada Quill')
  })

  test('SEC-11 R3 gap 1 loadKind refuses a bare name the source text never spells (built when the module runs)', async () => {
    const text = await kindRefusal(tempFolder({ 'K05/kind.ts': "export const owners = [{ name: ['Ada', 'Quill'].join(' ') }]\n" }))
    expect(text).toMatch(NAME_TEST)
    expect(text).toContain('Ada Quill')
  })

  test('SEC-11 R3 gap 1 loadKind refuses an unclassified export and an unclassified key inside an export', async () => {
    const top = await kindRefusal(tempFolder({ 'K05/kind.ts': "export const nickname = 'x'\n" }))
    expect(top).toMatch(UNCLASSIFIED)
    expect(top).toContain('nickname')
    const inner = await kindRefusal(tempFolder({ 'K05/kind.ts': "export const owners = [{ name: 'Ada Quill (Test)', nickname: 'x' }]\n" }))
    expect(inner).toMatch(UNCLASSIFIED)
    expect(inner).toContain('nickname')
  })

  test('SEC-11 R3 gap 1 loadKind refuses a real-looking SIN the source text never holds (built when the module runs)', async () => {
    const parts = [REAL9.slice(0, 3), REAL9.slice(3, 6), REAL9.slice(6)].map((p) => `'${p}'`).join(', ')
    const text = await kindRefusal(tempFolder({ 'K05/kind.ts': `export const owners = [{ name: 'Ada Quill (Test)', sin: [${parts}].join('') }]\n` }))
    expect(text).toMatch(CHECK_DIGIT)
  })

  test.each([
    ['a syntax error', 'export const = ;\n'],
    ['a throw when it runs', "throw new Error('made up (Test)')\n"],
  ])('SEC-11 R3 gap 1 loadKind refuses a kind.ts that cannot be imported (%s), naming kind.ts', async (_why, source) => {
    expect(await kindRefusal(tempFolder({ 'K05/kind.ts': source }))).toContain('kind.ts')
  })

  test('SEC-11 R3 gap 1 no false alarm: a kind.ts whose exports sit at classed paths with "(Test)" names loads', async () => {
    const root = tempFolder({
      'K05/kind.ts': "export const owners = [{ name: 'Ada Quill (Test)', sin: 'restricted-provided' }]\nexport const parties = [{ name: 'Ada Quill (Test)', kind: 'person' }]\n",
    })
    const k = (await loadKindAt('K05', root)) as { id?: unknown; status?: unknown }
    expect(k.id).toBe('K05')
    expect(k.status).toBe('built')
  })
})

describe('W00b R3 gap 2: SEC-11 a key repeated in one JSON object never hides a value', () => {
  // Digits written as JSON \u escapes, so the source text holds no digit and only the parsed value does.
  const escaped = SIN_SPACED.replace(/\d/g, (d) => `\\u003${d}`)
  const CASES: [string, string, string, RegExp][] = [
    ['a SIN in the first of two "notes"', 'answer-key.json', `{"notes":["On file: ${escaped}"],"notes":["x"]}`, CHECK_DIGIT],
    ['a SIN in the first of two "client_notes"', 'onboarding.json', `{"client_notes":["On file: ${escaped}"],"client_notes":["x"]}`, CHECK_DIGIT],
    ['a bare name, then the same name with (Test), in one party', 'answer-key.json', '{"parties":[{"name":"Jane Doe","kind":"person","name":"Jane Doe (Test)"}]}', NAME_TEST],
    ['a bare name, then the same name with (Test), in one owner', 'onboarding.json', '{"owners":[{"name":"Jane Doe","name":"Jane Doe (Test)"}]}', NAME_TEST],
    ['an unclassified subtree under the first of two "notes"', 'answer-key.json', '{"notes":{"nickname":"x"},"notes":["x"]}', UNCLASSIFIED],
    ['a repeat whose first key is written with an escape', 'onboarding.json', `{"client\\u005fnotes":["On file: ${escaped}"],"client_notes":["x"]}`, CHECK_DIGIT],
  ]

  test.each(CASES)('SEC-11 R3 gap 2 guardFolder refuses %s (%s)', async (_what, file, source, hidden) => {
    expectFinding(await folderFindings(tempFolder({ [file]: source })), either(REPEATED, hidden), file)
  })

  test('SEC-11 R3 gap 2 loadKind refuses a kind .json with a repeated key hiding a bare name', async () => {
    const text = await kindRefusal(tempFolder({ 'K05/kind.json': '{"parties":[{"name":"Jane Doe","kind":"person","name":"Jane Doe (Test)"}]}' }))
    expect(text).toMatch(either(REPEATED, NAME_TEST))
  })

  test('SEC-11 R3 gap 2 no false alarm: equal keys in different objects, and a key written inside a string', async () => {
    const source = '{"parties":[{"name":"Ada Quill (Test)","kind":"person"},{"name":"Bo Quill (Test)","kind":"person"}],"notes":["\\"notes\\" and \\"notes\\" again"]}'
    expect(await folderFindings(tempFolder({ 'answer-key.json': source }))).toEqual([])
  })
})

describe('W00b R3 gap 3: SEC-11 links are resolved, never skipped', () => {
  const outsideFile = (body: string): string => join(tempFolder({ 'secret.md': body }), 'secret.md')
  const clean = (): string => tempFolder({ 'profile.md': '# Made up (Test)\n' })
  const ANY = /./

  test('SEC-11 R3 gap 3 a file link (absolute) to a SIN file outside the folder is refused, naming the link', async () => {
    const dir = clean()
    link(outsideFile(`SIN ${SIN_SPACED}\n`), join(dir, 'notes.md'))
    expectFinding(await folderFindings(dir), ANY, 'notes.md')
  })

  test('SEC-11 R3 gap 3 a file link (relative) out of the folder is refused even when its target is clean', async () => {
    const dir = clean()
    const at = join(dir, 'deep', 'notes.md')
    link(relative(dirname(at), outsideFile('# Made up (Test)\n')), at)
    expectFinding(await folderFindings(dir), ANY, 'notes.md')
  })

  test('SEC-11 R3 gap 3 a folder link out of the folder is refused, naming the link', async () => {
    const dir = clean()
    const outside = tempFolder({ 'chq.csv': `Date,Description,Amount\n2025-01-02,"SIN ${SIN_SPACED}",1.00\n` })
    link(outside, join(dir, 'accounts'), 'dir')
    expectFinding(await folderFindings(dir), ANY, 'accounts')
  })

  test('SEC-11 R3 gap 3 a dangling link is refused, naming the link', async () => {
    const dir = clean()
    link(join(dir, 'gone.md'), join(dir, 'dangling.md'))
    expectFinding(await folderFindings(dir), ANY, 'dangling.md')
  })

  test(
    'SEC-11 R3 gap 3 a link loop (a folder linked to itself, two links to each other) never hangs and the folder is still scanned',
    async () => {
      const dir = tempFolder({ 'profile.md': `On file: ${SIN_SPACED}\n` })
      link(dir, join(dir, 'sub', 'loop'), 'dir')
      link(join(dir, 'loopB.md'), join(dir, 'loopA.md'))
      link(join(dir, 'loopA.md'), join(dir, 'loopB.md'))
      const findings = await folderFindings(dir)
      expectFinding(findings, CHECK_DIGIT, 'profile.md')
      expectFinding(findings, ANY, 'loopA.md')
      expectFinding(findings, ANY, 'loopB.md')
    },
    R3_TIMEOUT,
  )

  test('SEC-11 R3 gap 3 no false alarm: a file link and a folder link that stay inside the folder are scanned like their targets', async () => {
    const dir = tempFolder({ 'profile.md': '# Made up (Test)\n', 'accounts/chq.csv': 'Date,Description,Amount\n2025-01-02,COFFEE,1.00\n' })
    link(join(dir, 'accounts', 'chq.csv'), join(dir, 'accounts', 'inside.csv'))
    link(join(dir, 'accounts'), join(dir, 'old'), 'dir')
    expect(await folderFindings(dir)).toEqual([])
  })

  test('SEC-11 R3 gap 3 a link inside the folder to a SIN file is scanned: the SIN is refused', async () => {
    const dir = tempFolder({ 'profile.md': '# Made up (Test)\n', 'data/x.txt': `SIN ${SIN_SPACED}\n` })
    link(join(dir, 'data'), join(dir, 'alias'), 'dir')
    const findings = await folderFindings(dir)
    expectFinding(findings, CHECK_DIGIT, 'x.txt')
  })
})

describe('W00b R3 gap 4: SEC-11 loadClient refuses whatever guardFolder refuses (one scanner)', () => {
  async function loadIssues(root: string): Promise<LoadIssue[]> {
    let caught: unknown
    try {
      await Promise.resolve(loadClient('C01', { root }))
    } catch (e) {
      caught = e
    }
    expect(caught, 'C01 with the plant should be refused').toBeInstanceOf(TestWorldLoadError)
    return (caught as TestWorldLoadError).issues
  }
  const PLANTS: [string, (dir: string) => void, string, RegExp][] = [
    ['a .pdf', (dir) => { writeFileSync(join(dir, 'scan.pdf'), PDF); }, 'scan.pdf', CANNOT_CHECK],
    ['a notes.txt holding a SIN', (dir) => { writeFileSync(join(dir, 'notes.txt'), `Owner SIN ${SIN_SPACED}\n`); }, 'notes.txt', CHECK_DIGIT],
    ['a .tsv holding a SIN', (dir) => { writeFileSync(join(dir, 'data.tsv'), `Date\tDescription\n2025-01-02\tSIN ${SIN_SPACED}\n`); }, 'data.tsv', CHECK_DIGIT],
    ['a nested .txt holding a SIN (path written with slashes)', (dir) => {
      mkdirSync(join(dir, 'deep', 'er'), { recursive: true })
      writeFileSync(join(dir, 'deep', 'er', 'notes.txt'), `Owner SIN ${SIN_SPACED}\n`)
    }, 'deep/er/notes.txt', CHECK_DIGIT],
    ['an e-mail and a phone in a .txt', (dir) => {
      writeFileSync(join(dir, 'contact.txt'), 'Write to eve@real-firm.com or call 416-867-5309\n')
    }, 'contact.txt', either(EMAIL, PHONE)],
    ['a file with no extension', (dir) => { writeFileSync(join(dir, 'README'), 'made up\n'); }, 'README', CANNOT_CHECK],
    ['a link out of the folder', (dir) => {
      link(join(tempFolder({ 'secret.md': `SIN ${SIN_SPACED}\n` }), 'secret.md'), join(dir, 'extra.md'))
    }, 'extra.md', /./],
  ]

  test.each(PLANTS)('SEC-11 R3 gap 4 loadClient refuses C01 with %s, check made-up-data', async (_what, plant, name, reason) => {
    const { root, dir } = copyFolder(C01)
    plant(dir)
    const issues = await loadIssues(root)
    const hit = issues.some((i) => i.check === 'made-up-data' && reason.test(i.reason) && `${i.record} ${i.reason}`.includes(name))
    expect(hit, JSON.stringify(issues)).toBe(true)
  })

  test('SEC-11 R3 gap 4 no false alarm: a plain copy of C01 loads', async () => {
    const { root } = copyFolder(C01)
    const c = (await Promise.resolve(loadClient('C01', { root }))) as { id?: unknown }
    expect(c.id).toBe('C01')
  })
})

describe('W00b R3 gap 5: SEC-11 the table is closed at every node the walk finds (no subtree wildcards)', () => {
  const NODES = sampleNodes()
  const LEAF_PATTERNS = samplePatterns()
  const RECORD_MAPS = [...NODES.objects].filter(([, keys]) => [...keys].every(isDataKey)).map(([p]) => p)

  test('SEC-11 R3 gap 5 the walk finds the object nodes and few record maps (keys that are data: months, account keys)', () => {
    expect(NODES.objects.size).toBeGreaterThan(100)
    expect(NODES.objects.has('')).toBe(true)
    expect(RECORD_MAPS.length).toBeGreaterThan(0)
    expect(RECORD_MAPS.length).toBeLessThanOrEqual(10)
  })

  test('SEC-11 R3 gap 5 a new key two levels under every object node is unclassified', async () => {
    const classOf = await classOfApi()
    const classed = [...NODES.objects.keys()].flatMap((p) => [under(under(p, 'zzplanted'), 'zzdeeper'), `${under(p, 'zzplanted')}[]`, `${under(p, 'zzplanted')}[].zzdeeper`]).filter((x) => classOf(x) !== undefined)
    expect(classed).toEqual([])
  })

  test('SEC-11 R3 gap 5 a new scalar key under every object node that is not a record map is unclassified', async () => {
    const classOf = await classOfApi()
    const classed = [...NODES.objects.keys()].filter((p) => !RECORD_MAPS.includes(p)).map((p) => under(p, 'zzplanted')).filter((x) => classOf(x) !== undefined)
    expect(classed).toEqual([])
  })

  test('SEC-11 R3 gap 5 an object in place of every leaf, and in every list of scalars, is unclassified', async () => {
    const classOf = await classOfApi()
    const classed = [...LEAF_PATTERNS.map((l) => under(l, 'zzplanted')), ...[...NODES.scalarLists].map((l) => `${l}[].zzplanted`)].filter((x) => classOf(x) !== undefined)
    expect(classed).toEqual([])
  })
})

// Nine digits: a separator in any subset of the 8 gaps, each any space (Zs) or dash (Pd) code point.
const GAP_SEPS = spaceAndDashCodePoints()
const anyGaps = fc.array(fc.oneof({ arbitrary: fc.constant(''), weight: 1 }, { arbitrary: fc.constantFrom(...GAP_SEPS), weight: 2 }), { minLength: 8, maxLength: 8 })
const notDate = (text: string): boolean => !ISO_DATE_SHAPE.test(text.normalize('NFKC'))
const ninePassing = fc.tuple(digits8, anyGaps).map(([d8, gaps]) => joinNine(withCheckDigit(d8), gaps)).filter(notDate)
const nineFailing = fc.tuple(digits8, anyGaps).map(([d8, gaps]) => joinNine(withWrongDigit(d8), gaps)).filter(notDate)

// Codes the samples hold (transaction ids, GIFI, account keys and numbers), found by the walk.
const CODE_KEY = /^(id|gifi|key|account|glAccount|accountNo|code)$/i
const CODES = [...new Set(sampleLeaves().filter((l) => CODE_KEY.test(lastKey(l.steps)) && (typeof l.value === 'string' || typeof l.value === 'number')).map((l) => String(l.value)))].sort()
const pad2 = (n: number): string => String(n).padStart(2, '0')
const dateNextToNumber = fc
  .record({ y: fc.integer({ min: 2000, max: 2030 }), m: fc.integer({ min: 1, max: 12 }), d: fc.integer({ min: 1, max: 28 }), r: fc.integer({ min: 0, max: 99 }), form: fc.constantFrom('date k', 'k date', 'month kkk') })
  .map(({ y, m, d, r, form }) => {
    const ymd = `${String(y)}${pad2(m)}${pad2(d)}`
    if (form === 'date k') return `${String(y)}-${pad2(m)}-${pad2(d)} ${luhnComplete(ymd).slice(-1)}`
    if (form === 'k date') {
      const k = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].find((x) => luhnValid(x + ymd)) ?? '0'
      return `${k} ${String(y)}-${pad2(m)}-${pad2(d)}`
    }
    return `${String(y)}-${pad2(m)} ${luhnComplete(`${String(y)}${pad2(m)}${pad2(r)}`).slice(-3)}`
  })

describe('W00b R3 gap 6: SEC-11 nine digits with any space or dash in any gap', () => {
  test('SEC-11 R3 gap 6 fixture: the separators are computed (Zs and Pd), with the narrow ones French text uses', () => {
    expect(GAP_SEPS.length).toBeGreaterThan(30)
    for (const cp of [0x20, 0xa0, 0x2009, 0x202f, 0x3000, 0x2d, 0x2010, 0x2013, 0x2014, 0xfe63, 0xff0d]) expect(GAP_SEPS).toContain(String.fromCodePoint(cp))
    expect(CODES.length).toBeGreaterThan(100)
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 6 property: a real-looking number with any gaps in %s is refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(ninePassing, async (text) => {
        const { findings, file } = await place(text)
        expectFinding(findings, CHECK_DIGIT, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test('SEC-11 R3 gap 6 property: a real-looking number with any gaps as a JSON key is refused (guardFolder and guardValue)', async () => {
    await fc.assert(
      fc.asyncProperty(ninePassing, async (key) => {
        expectFinding(await folderFindings(tempFolder({ 'onboarding.json': JSON.stringify({ client_notes: ['x'], [key]: 'x' }) })), CHECK_DIGIT, 'onboarding.json')
        expectFinding(await valueFindings({ [key]: 'x' }), CHECK_DIGIT)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 6 control property: a number that fails its check digit, with any gaps, in %s is not a check-digit finding', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(nineFailing, async (text) => {
        expectNoFinding((await place(text)).findings, CHECK_DIGIT)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 6 control property: an ISO date or month next to a number (nine digits passing Luhn) in %s is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(dateNextToNumber, async (text) => {
        expect((await place(text)).findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 6 control property: a transaction id, GIFI or account code from the samples in %s is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...CODES), async (code) => {
        expect((await place(`ref ${code}`)).findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})

// Every declared person of every folder, written six ways, in each kind of text, in a small folder that declares them.
type Writing = [string, (first: string, last: string) => string]
const WRITINGS: Writing[] = [
  ['Last, First', (first, last) => `${last}, ${first}`],
  ['upper case', (first, last) => `${first} ${last}`.toUpperCase()],
  ['lower case', (first, last) => `${first} ${last}`.toLowerCase()],
  ['NBSP between', (first, last) => `${first}${NBSP}${last}`],
  ['two spaces between', (first, last) => `${first}  ${last}`],
  ["possessive 's", (first, last) => `${first} ${last}'s`],
]
type PersonPlace = [string, (text: string) => Record<string, string>, string]
const PERSON_PLACES: PersonPlace[] = [
  ['profile.md', (t) => ({ 'profile.md': `# Notes\n\nSpoke with ${t} about the books.\n` }), 'profile.md'],
  ['answer-key.json notes', (t) => ({ 'answer-key.json:notes': `Spoke with ${t} about the books.` }), 'answer-key.json'],
  ['onboarding.json client_notes', (t) => ({ 'onboarding.json': JSON.stringify({ client_notes: [`${t} will send the receipts.`] }) }), 'onboarding.json'],
  ['a CSV cell', (t) => ({ 'accounts/chq.csv': `Date,Description,Amount\n2025-12-31,${csvQuote(`E-TRANSFER ${t}`)},1.00\n` }), 'accounts/chq.csv'],
]
const PERSON_FOLDERS = FOLDERS.filter((f) => declaredPersons(f).length > 0)

describe('W00b R3 gap 7: SEC-11 every declared person, in every writing', () => {
  test('SEC-11 R3 gap 7 the walk finds every declared person (C03 declares 19)', () => {
    expect(PERSON_FOLDERS.length).toBeGreaterThanOrEqual(12)
    expect(PERSON_FOLDERS.reduce((n, f) => n + declaredPersons(f).length, 0)).toBeGreaterThan(50)
  })

  test.each(PERSON_FOLDERS.flatMap((f) => WRITINGS.map(([how, write]) => [f.id, how, f, write] as const)))(
    'SEC-11 R3 gap 7 %s: every declared person written "%s" bare in each kind of text is refused',
    async (_id, _how, folder, write) => {
      const persons = declaredPersons(folder)
      const parties = persons.map((name) => ({ name, kind: 'person' }))
      const misses: string[] = []
      for (const person of persons) {
        const plain = bare(person)
        const words = plain.split(' ')
        const first = words.slice(0, -1).join(' ')
        const last = words.at(-1) ?? ''
        const written = write(first, last)
        for (const [where, files, file] of PERSON_PLACES) {
          const planted = files(written)
          const notes = planted['answer-key.json:notes']
          const body: Record<string, string> = Object.fromEntries(Object.entries(planted).filter(([k]) => k !== 'answer-key.json:notes'))
          body['answer-key.json'] = JSON.stringify({ parties, ...(notes === undefined ? {} : { notes: [notes] }) })
          const findings = await folderFindings(tempFolder(body))
          const hints = [written, plain, written.toUpperCase(), plain.toUpperCase(), `${last}, ${first}`]
          const hit = findings.some((f) => PERSON_IN_TEXT.test(f.reason) && f.record.includes(file) && hints.some((h) => `${f.record} ${f.reason}`.includes(h)))
          if (!hit) misses.push(`${plain} in ${where}`)
        }
      }
      expect(misses).toEqual([])
    },
    R3_TIMEOUT,
  )

  test('SEC-11 R3 gap 7 no false alarm: the small folder that declares every person, with no plant, is clean', async () => {
    for (const folder of PERSON_FOLDERS) {
      const parties = declaredPersons(folder).map((name) => ({ name, kind: 'person' }))
      expect(await folderFindings(tempFolder({ 'answer-key.json': JSON.stringify({ parties }) })), folder.id).toEqual([])
    }
  })
})

// E-mail addresses: ASCII and not, outside every reserved domain.
const LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
const WIDE_LETTERS = [...LETTERS, 'é', 'ü', 'ñ', 'ø', 'ç', 'ж', 'д', '中', '文']
const RESERVED_DOMAIN = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i
const word = (letters: string[]): fc.Arbitrary<string> => fc.array(fc.constantFrom(...letters), { minLength: 1, maxLength: 6 }).map((cs) => cs.join(''))
const localPart = (letters: string[]): fc.Arbitrary<string> =>
  fc.tuple(word(letters), fc.array(fc.tuple(fc.constantFrom('.', '_', '+', '-'), word(letters)), { maxLength: 2 })).map(([w, rest]) => w + rest.map(([p, x]) => p + x).join(''))
const TLDS = ['com', 'ca', 'org', 'net', 'io', 'de', 'fr', 'mx', 'uk', 'рф', '中国']
const domain = (letters: string[]): fc.Arbitrary<string> =>
  fc.tuple(fc.array(word(letters), { minLength: 1, maxLength: 3 }), fc.constantFrom(...TLDS)).map(([labels, tld]) => `${labels.join('.')}.${tld}`)
const realEmail = fc
  .boolean()
  .chain((ascii) => {
    const letters = ascii ? LETTERS : WIDE_LETTERS
    return fc.tuple(localPart(letters), domain(letters))
  })
  .filter(([, d]) => !RESERVED_DOMAIN.test(d))
  .map(([l, d]) => `${l}@${d}`)
const reservedEmail = fc
  .tuple(localPart(LETTERS), fc.constantFrom('example.com', 'example.org', 'example.net', 'mail.example.com', 'client.test', 'a.invalid', 'b.example', 'localhost'))
  .map(([l, d]) => `${l}@${d}`)

describe('W00b R3 gap 8: SEC-11 e-mail addresses outside the reserved domains are refused', () => {
  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 8 property: an address outside the reserved domains in %s is refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(realEmail, async (email) => {
        const { findings, file } = await place(`write to ${email} today`)
        expectFinding(findings, EMAIL, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 8 property: the same address written full width (NFKC) in %s is refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(realEmail, async (email) => {
        const { findings, file } = await place(`write to ${fullWidthAscii(email)} today`)
        expectFinding(findings, EMAIL, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test('SEC-11 R3 gap 8 property: an address as a JSON key is refused (guardFolder and guardValue)', async () => {
    await fc.assert(
      fc.asyncProperty(realEmail, async (email) => {
        expectFinding(await folderFindings(tempFolder({ 'onboarding.json': JSON.stringify({ client_notes: ['x'], [email]: 'x' }) })), EMAIL, 'onboarding.json')
        expectFinding(await valueFindings({ [email]: 'x' }), EMAIL)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 8 control property: an address at a reserved domain in %s is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(reservedEmail, async (email) => {
        expect((await place(`write to ${email} today`)).findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each([
    ['a reserved name followed by a real domain', 'ada@example.com.evil.org'],
    ['a non-ASCII local part', 'josé.garcía@correo.mx'],
    ['a non-ASCII domain', 'info@exämple.de'],
    ['full-width @ only', `ada${String.fromCodePoint(0xff20)}mail.ca`],
  ])('SEC-11 R3 gap 8 example: %s is refused', async (_what, email) => {
    expectFinding(await folderFindings(tempFolder({ 'profile.md': `Write to ${email} today.\n` })), EMAIL, 'profile.md')
    expectFinding(await valueFindings({ client_notes: [`Write to ${email} today.`] }), EMAIL)
  })
})

describe('W00b R3 gap 9: SEC-11 the guard fails closed on bad input', () => {
  test('SEC-11 R3 gap 9 guardFolder on a missing path is refused, never []', async () => {
    const g = await guardApi()
    expectRefused(await attempt(() => g.guardFolder(join(tempFolder({}), 'no-such-folder'))))
  })

  test('SEC-11 R3 gap 9 guardFolder on a file path is refused, never []', async () => {
    const g = await guardApi()
    const dir = tempFolder({ 'profile.md': '# Made up (Test)\n' })
    expectRefused(await attempt(() => g.guardFolder(join(dir, 'profile.md'))))
  })

  test.runIf(process.platform !== 'win32')(
    'SEC-11 R3 gap 9 a FIFO in the folder is refused as a file that cannot be checked, without hanging',
    { timeout: 30_000 },
    async () => {
      const dir = tempFolder({ 'profile.md': '# Made up (Test)\n' })
      execFileSync('mkfifo', [join(dir, 'pipe.md')])
      expectFinding(await folderFindings(dir), CANNOT_CHECK, 'pipe.md')
    },
  )

  // chmod 000 stops only a user who is not root; a cloud box running as root reads the file anyway (the FIFO test
  // above covers a file the guard cannot read there).
  test.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)('SEC-11 R3 gap 9 an unreadable file is refused, never skipped', async () => {
    const dir = tempFolder({ 'profile.md': '# Made up (Test)\n', 'notes.md': `SIN ${SIN_SPACED}\n` })
    chmodSync(join(dir, 'notes.md'), 0o000)
    try {
      const g = await guardApi()
      expectRefused(await attempt(() => g.guardFolder(dir)), 'notes.md')
    } finally {
      chmodSync(join(dir, 'notes.md'), 0o644)
    }
  })

  test.each([
    ['a Map at a name path', { owners: new Map([['name', 'Jane Doe']]) }],
    ['a Set of notes', { client_notes: new Set([`On file: ${SIN_SPACED}`]) }],
    ['a Date', { corporation: { incorporation_date: new Date(0) } }],
    ['a BigInt', { staff: { employees: BigInt(REAL9) } }],
    ['undefined in a list', { client_notes: [undefined] }],
    ['a function', { client_notes: [(): string => 'x'] }],
    ['NaN', { staff: { employees: Number.NaN } }],
    ['Infinity', { staff: { employees: Number.POSITIVE_INFINITY } }],
    ['undefined at the top', undefined],
    ['a Map at the top', new Map([['client_notes', ['x']]])],
  ] as const)('SEC-11 R3 gap 9 guardValue refuses %s (a throw or a finding, never [])', async (_what, value) => {
    const g = await guardApi()
    expectRefused(await attempt(() => g.guardValue(value)))
  })

  test(
    'SEC-11 R3 gap 9 guardValue refuses a value that holds itself, without hanging or overflowing the stack',
    async () => {
      const owners: unknown[] = []
      const value = { owners }
      owners.push(value)
      const g = await guardApi()
      expectRefused(await attempt(() => g.guardValue(value)))
    },
    R3_TIMEOUT,
  )

  test('SEC-11 R3 gap 9 guardValue scans a bare top-level string (W20 text entry) as free text', async () => {
    expectFinding(await valueFindings(`On file: ${SIN_SPACED}`), CHECK_DIGIT)
    expectFinding(await valueFindings('Spoke with ada@mail.ca today'), EMAIL)
    expect(await valueFindings('Made up note about the books (Test).')).toEqual([])
  })
})

// Money paths (card directive): a JSON number at a path the table classes money is not a nine-digit candidate.
const COUNT_KEY = /^(gifi|line|qboLine|seed|days|year|tax_year|n|runs|slips|units|unit|months|term_months|employees|fullTimeEmployees)$|percent/i

describe('W00b R3 money: SEC-11 a JSON number at a money path is not a nine-digit candidate, a string there is', () => {
  test('SEC-11 R3 money the table classes the money paths the samples use, and only number paths', async () => {
    const classOf = await classOfApi()
    expect(classOf('shareholder_loans[].amount')).toBe('money')
    const money = samplePatterns().filter((p) => classOf(p) === 'money')
    expect(money.length).toBeGreaterThan(20)
    const notNumbers = sampleLeaves().filter((l) => money.includes(l.pattern) && l.value !== null && typeof l.value !== 'number')
    expect(notNumbers.map((l) => `${l.folder.id} ${l.file} ${l.pattern}`)).toEqual([])
  })

  test('SEC-11 R3 money is never the class of a count, code, line, year or percent path the walk finds', async () => {
    const classOf = await classOfApi()
    const counts = samplePatterns().filter((p) => COUNT_KEY.test(p.split('.').at(-1)?.replace(/\[\]$/, '') ?? ''))
    expect(counts.length).toBeGreaterThan(10)
    expect(counts.filter((p) => classOf(p) === 'money')).toEqual([])
  })

  test('SEC-11 R3 money at every money path: a real-looking JSON number is accepted and the same number as a string is refused', async () => {
    const classOf = await classOfApi()
    const seen = new Set<string>()
    const plants = sampleLeaves().filter((l) => typeof l.value === 'number' && classOf(l.pattern) === 'money' && !seen.has(l.pattern) && (seen.add(l.pattern), true))
    expect(plants.length).toBeGreaterThan(20)
    const misses: string[] = []
    for (const leaf of plants) {
      const small = pruneTo(readJson(join(leaf.folder.dir, leaf.file)), leaf.steps)
      setAt(small.doc, small.steps, Number(REAL9))
      const asNumber = [...(await folderFindings(tempFolder({ [leaf.file]: JSON.stringify(small.doc) }))), ...(await valueFindings(small.doc))]
      if (asNumber.some((f) => CHECK_DIGIT.test(f.reason))) misses.push(`number refused at ${leaf.pattern}`)
      setAt(small.doc, small.steps, REAL9)
      const asString = [...(await folderFindings(tempFolder({ [leaf.file]: JSON.stringify(small.doc) }))), ...(await valueFindings(small.doc))]
      if (!asString.some((f) => CHECK_DIGIT.test(f.reason))) misses.push(`string accepted at ${leaf.pattern}`)
    }
    expect(misses).toEqual([])
  })
})

// Gap 10 stands alone so that, under the card's landing rule, it can move to SC R34 if it alone fails.
const cardNumber = (passing: boolean): fc.Arbitrary<string> =>
  fc
    .record({
      len: fc.integer({ min: 13, max: 19 }),
      lead: fc.integer({ min: 1, max: 9 }),
      body: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 17, maxLength: 17 }),
      style: fc.constantFrom('run', 'groups of 4 spaced', 'groups of 4 hyphenated', '4-6-5'),
    })
    .map(({ len, lead, body, style }) => {
      const head = `${String(lead)}${body.slice(0, len - 2).join('')}`
      const n = passing ? luhnComplete(head) : luhnBroken(head)
      if (style === 'run') return n
      if (style === '4-6-5' && n.length === 15) return `${n.slice(0, 4)} ${n.slice(4, 10)} ${n.slice(10)}`
      return (n.match(/.{1,4}/g) ?? []).join(style === 'groups of 4 hyphenated' ? '-' : ' ')
    })

describe('W00b R3 gap 10 (SC R34 candidate): SEC-11 card and account numbers that pass Luhn are refused', () => {
  test('SEC-11 R3 gap 10 fixture: the generated numbers pass and fail Luhn', () => {
    fc.assert(
      fc.property(cardNumber(true), cardNumber(false), (good, bad) => {
        const g = good.replace(/\D/g, '')
        const b = bad.replace(/\D/g, '')
        return g.length >= 13 && g.length <= 19 && luhnValid(g) && !luhnValid(b)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 10 property: a 13 to 19 digit number passing Luhn in %s is refused', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(cardNumber(true), async (n) => {
        const { findings, file } = await place(`card ${n} on file`)
        expectFinding(findings, CARD, file)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  test.each(ALL_PLACEMENTS)('SEC-11 R3 gap 10 control property: a 13 to 19 digit number failing Luhn in %s is accepted', async (_where, place) => {
    await fc.assert(
      fc.asyncProperty(cardNumber(false), async (n) => {
        expect((await place(`card ${n} on file`)).findings).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})
