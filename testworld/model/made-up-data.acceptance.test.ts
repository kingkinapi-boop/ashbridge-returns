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
import fc from 'fast-check'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { loadClient, loadKind } from '../index'
import { TestWorldLoadError } from './index'
import {
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
    for (const leaf of plants) {
      const small = pruneTo(readJson(join(leaf.folder.dir, leaf.file)), leaf.steps)
      const beforeFolder = await folderFindings(tempFolder({ [leaf.file]: JSON.stringify(small.doc) }))
      const beforeValue = await valueFindings(small.doc)
      setAt(small.doc, small.steps, typeof leaf.value === 'number' ? Number(REAL9) : `ref ${spaced}`)
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
      'K05/kind.ts': "export const owner = { name: 'Ada Quill (Test)', sin: 'restricted-provided' }\n",
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
