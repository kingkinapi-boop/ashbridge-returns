// W00c acceptance tests (round 2), RC3: values are checked against their twins, and ranges are ordered
// (reports/W00c-findings.md, fix 3 and "Acceptance tests for the spec writer").
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plants one fault in a temp copy and loads through the public loader.
//
// What the W00c round 2 build does:
//   The fiscal year: yearStart <= yearEnd and the year is at most 371 days (53 weeks, both ends counted). Otherwise a
//   'schema' issue whose record names the fiscal year (fiscalYear, yearStart or yearEnd), raised before the rolls.
//   Onboarding twins (corporation.financial_year_end, corporation.fiscal_year_start, corporation.incorporation_date,
//   prior_year_closing_balances.as_of): each, where present, is a calendar date YYYY-MM-DD, and financial_year_end
//   equals yearEnd, fiscal_year_start equals yearStart, incorporation_date is on or before yearStart, and as_of is
//   the day before yearStart. A failure is an issue naming the onboarding field (its key, e.g. "as_of").
//   Unmarked transactions and adjusting entries are dated within [yearStart, yearEnd] (issue naming the row or entry
//   id and the bound it breaks, the yearStart or yearEnd date as written; spec review 3, gap 1); a February 29 is a
//   date only in a leap year (gap 4); a priorYear row is dated within the 12 months before yearStart.
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { loadClient, type FaultEntry } from '../index'
import { TestWorldLoadError } from './index'
import {
  Sandbox,
  addMonth,
  catalogue,
  expectIssueWith,
  expectLoads,
  markersOf,
  monthOf,
  pinOf,
  refusal,
  walkClients,
  type CatalogueEntry,
  type Issue,
  type RawOnboarding,
  type WalkClient,
} from './__fixtures__/sample-walk'
import { daysIn, dropPin, entryFor, expectNamed, fiscalMonths, freeFlagEntry, full, markedRows, plantRow, txIn, type MarkedRow } from './__fixtures__/w00c-walk'

const clients = walkClients()
const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const withAccounts = clients.filter((c) => c.key.accounts.length > 0)
const withEntries = clients.filter((c) => c.key.adjustingEntries.length > 0)

/** A calendar date moved by n days (UTC arithmetic: no clock and no time zone involved). */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The issues a load gives through the public loader ([] when it loads). */
function issuesOf(c: WalkClient, cat?: CatalogueEntry[]): Issue[] {
  try {
    loadClient(c.id as `C${string}`, cat === undefined ? { root: sb.root } : { root: sb.root, faults: cat as unknown as FaultEntry[] })
    return []
  } catch (e) {
    if (e instanceof TestWorldLoadError) return e.issues
    throw e
  }
}
const fiscalYearIssue = (i: Issue): boolean => i.check === 'schema' && /fiscalYear|yearStart|yearEnd/.test(i.record)

/** The onboarding twin fields, as [label, path] with the last key the field's own name. */
const TWINS = [
  ['financial_year_end', ['corporation', 'financial_year_end']],
  ['fiscal_year_start', ['corporation', 'fiscal_year_start']],
  ['incorporation_date', ['corporation', 'incorporation_date']],
  ['as_of', ['prior_year_closing_balances', 'as_of']],
] as const
type Twin = (typeof TWINS)[number][0]
const pathOf = (twin: Twin): readonly [string, string] => {
  const hit = TWINS.find(([name]) => name === twin)
  if (hit === undefined) throw new Error(`fixture: no twin ${twin}`)
  return hit[1]
}
const twinOf = (o: RawOnboarding, twin: Twin): unknown => {
  const [holder, key] = pathOf(twin)
  const h = o[holder]
  return h !== null && typeof h === 'object' ? (h as Record<string, unknown>)[key] : undefined
}
function setTwin(o: RawOnboarding, twin: Twin, value: string): void {
  const [holder, key] = pathOf(twin)
  const h = o[holder]
  if (h === null || typeof h !== 'object') throw new Error(`fixture: onboarding has no ${holder}`)
  ;(h as Record<string, unknown>)[key] = value
}
const twinCases = clients.flatMap((c) => TWINS.filter(([name]) => typeof twinOf(c.onboarding, name) === 'string').map(([name]): [string, Twin, WalkClient] => [c.id, name, c]))

describe('W00c RC3 the walk', () => {
  test('ARC-8 every folder has its four onboarding twins as written dates that agree with its fiscal year, and no unmarked row or adjusting entry outside the year', () => {
    expect(twinCases).toHaveLength(clients.length * TWINS.length)
    for (const c of clients) {
      const { start, end } = c.key.fiscalYear
      expect(twinOf(c.onboarding, 'financial_year_end'), c.id).toBe(end)
      expect(twinOf(c.onboarding, 'fiscal_year_start'), c.id).toBe(start)
      expect(twinOf(c.onboarding, 'as_of'), c.id).toBe(addDays(start, -1))
      expect(String(twinOf(c.onboarding, 'incorporation_date')) <= start, c.id).toBe(true)
      for (const t of c.key.transactions.filter((x) => markersOf(x).length === 0)) expect(t.date >= start && t.date <= end, `${c.id} ${t.id}`).toBe(true)
      for (const j of full(c.key).adjustingEntries) expect(j.date >= start && j.date <= end, `${c.id} ${j.id}`).toBe(true)
    }
  })

  test.each(byId(clients))('END-9 %s loads unchanged under the range and twin rules', async (_l, c) => {
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC3 the fiscal year is ordered and at most 53 weeks (every folder)', () => {
  test.each(byId(clients))("ARC-8 %s with fiscal year start and end swapped (onboarding twins swapped to match) is refused with a 'schema' issue naming the fiscal year", (_l, c) => {
    const { start, end } = c.key.fiscalYear
    sb.editKey(c, (k) => {
      k.fiscalYear = { start: end, end: start }
    })
    sb.editOnboarding(c, (o) => {
      setTwin(o, 'fiscal_year_start', end)
      setTwin(o, 'financial_year_end', start)
      setTwin(o, 'as_of', addDays(end, -1))
    })
    const issues = issuesOf(c)
    expect(issues.some(fiscalYearIssue), `expected a 'schema' issue whose record names the fiscal year; got ${JSON.stringify(issues)}`).toBe(true)
  })

  test.each(byId(clients))("ARC-8 %s with a 372-day fiscal year (end moved, financial_year_end to match) is refused with a 'schema' issue naming the fiscal year", (_l, c) => {
    const end = addDays(c.key.fiscalYear.start, 371)
    sb.editKey(c, (k) => {
      k.fiscalYear.end = end
    })
    sb.editOnboarding(c, (o) => {
      setTwin(o, 'financial_year_end', end)
    })
    const issues = issuesOf(c)
    expect(issues.some(fiscalYearIssue), `expected a 'schema' issue whose record names the fiscal year; got ${JSON.stringify(issues)}`).toBe(true)
  })

  test.each(byId(clients))('ARC-8 %s with a 371-day fiscal year (53 weeks, end moved, financial_year_end to match) raises no fiscal-year issue (other checks may still speak)', (_l, c) => {
    const end = addDays(c.key.fiscalYear.start, 370)
    sb.editKey(c, (k) => {
      k.fiscalYear.end = end
    })
    sb.editOnboarding(c, (o) => {
      setTwin(o, 'financial_year_end', end)
    })
    expect(issuesOf(c).filter(fiscalYearIssue)).toEqual([])
  })
})

describe('W00c RC3 the onboarding twins are calendar dates (every twin of every folder)', () => {
  const bad = (written: string): { label: string; value: string }[] => {
    const y = written.slice(0, 4)
    return [
      { label: 'February 30', value: `${y}-02-30` },
      { label: 'month 13', value: `${y}-13-01` },
      { label: 'no day', value: written.slice(0, 7) },
    ]
  }
  const cases = twinCases.flatMap(([id, twin, c]) => bad(String(twinOf(c.onboarding, twin))).map((d): [string, Twin, string, { c: WalkClient; value: string }] => [id, twin, d.label, { c, value: d.value }]))

  test.each(cases)('ARC-8 %s %s written as %s is refused, naming the field', async (_l, twin, _d, { c, value }) => {
    sb.editOnboarding(c, (o) => {
      setTwin(o, twin, value)
    })
    expectNamed(await refusal(sb, c.id), undefined, [twin])
  })
})

describe('W00c RC3 the onboarding twins agree with the fiscal year (every twin of every folder)', () => {
  const offsets: Record<Twin, number[]> = { financial_year_end: [1, -1], fiscal_year_start: [1, -1], as_of: [1, -1], incorporation_date: [] }
  const cases = twinCases.flatMap(([id, twin, c]) => {
    const written = String(twinOf(c.onboarding, twin))
    const values =
      twin === 'incorporation_date'
        ? [{ label: 'one day after the fiscal year start', value: addDays(c.key.fiscalYear.start, 1) }]
        : offsets[twin].map((n) => ({ label: n > 0 ? 'one day later' : 'one day earlier', value: addDays(written, n) }))
    return values.map((v): [string, Twin, string, { c: WalkClient; value: string }] => [id, twin, v.label, { c, value: v.value }])
  })

  test.each(cases)('ARC-8 %s %s %s is refused, naming the field', async (_l, twin, _w, { c, value }) => {
    sb.editOnboarding(c, (o) => {
      setTwin(o, twin, value)
    })
    expectNamed(await refusal(sb, c.id), undefined, [twin])
  })

  test.each(byId(clients))('ARC-8 %s with incorporation_date on the fiscal year start itself still loads', async (_l, c) => {
    sb.editOnboarding(c, (o) => {
      setTwin(o, 'incorporation_date', c.key.fiscalYear.start)
    })
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC3 unmarked rows and adjusting entries are dated inside the fiscal year', () => {
  /** A zero-amount copy of the client's first unmarked row: it moves no roll, so only its date can be wrong. */
  const zeroRow = (c: WalkClient): { id: string; plant: (date: string) => void } => {
    const src = c.key.transactions.find((t) => markersOf(t).length === 0)
    if (src === undefined) throw new Error(`fixture: ${c.id} has no unmarked row`)
    const id = `${src.id}-DATED-(Test)`
    return {
      id,
      plant: (date) => {
        sb.editKey(c, (k) => {
          k.transactions.push(plantRow(src, id, { date, amount: 0 }))
        })
      },
    }
  }

  // Spec review 3, gap 1: the issue names the row and the bound it breaks (the yearStart or yearEnd date as written),
  // so the older "dated in no statement month" issue cannot stand in for it.
  test.each(byId(withAccounts))('ARC-8 %s with an unmarked zero-amount row dated the day before the fiscal year start is refused, naming the row and the year start date', async (_l, c) => {
    const r = zeroRow(c)
    r.plant(addDays(c.key.fiscalYear.start, -1))
    expectNamed(await refusal(sb, c.id), undefined, [r.id, c.key.fiscalYear.start])
  })

  test.each(byId(withAccounts))('ARC-8 %s with an unmarked zero-amount row dated the day after the fiscal year end is refused, naming the row and the year end date', async (_l, c) => {
    const r = zeroRow(c)
    r.plant(addDays(c.key.fiscalYear.end, 1))
    expectNamed(await refusal(sb, c.id), undefined, [r.id, c.key.fiscalYear.end])
  })

  // Spec review 3, gap 1: the day left out stays inside a statement month, so only the year-range rule can catch it.
  test.each(byId(withAccounts))('ARC-8 %s with the fiscal year start moved one day later (day 2 when the year starts on the 1st; fiscal_year_start and as_of moved to match) and an unmarked zero-amount row dated on the old start is refused, naming the row and the new start date', async (_l, c) => {
    const start = c.key.fiscalYear.start
    const newStart = addDays(start, 1)
    sb.editKey(c, (k) => {
      k.fiscalYear.start = newStart
    })
    sb.editOnboarding(c, (o) => {
      setTwin(o, 'fiscal_year_start', newStart)
      setTwin(o, 'as_of', start)
    })
    const r = zeroRow(c)
    r.plant(start)
    expectNamed(await refusal(sb, c.id), undefined, [r.id, newStart])
  })

  test.each(byId(withAccounts))('ARC-8 %s with the fiscal year end moved one day earlier (the day before the month end; financial_year_end moved to match) and an unmarked zero-amount row dated on the old end is refused, naming the row and the new end date', async (_l, c) => {
    const end = c.key.fiscalYear.end
    const newEnd = addDays(end, -1)
    sb.editKey(c, (k) => {
      k.fiscalYear.end = newEnd
    })
    sb.editOnboarding(c, (o) => {
      setTwin(o, 'financial_year_end', newEnd)
    })
    const r = zeroRow(c)
    r.plant(end)
    expectNamed(await refusal(sb, c.id), undefined, [r.id, newEnd])
  })

  test.each(byId(withAccounts))('ARC-8 %s with an unmarked zero-amount row dated on the fiscal year start and one on its end still loads', async (_l, c) => {
    const src = c.key.transactions.find((t) => markersOf(t).length === 0)
    if (src === undefined) throw new Error('fixture: no unmarked row')
    sb.editKey(c, (k) => {
      k.transactions.push(plantRow(src, `${src.id}-START-(Test)`, { date: c.key.fiscalYear.start, amount: 0 }))
      k.transactions.push(plantRow(src, `${src.id}-END-(Test)`, { date: c.key.fiscalYear.end, amount: 0 }))
    })
    await expectLoads(sb, c.id)
  })

  const entryCases = withEntries.flatMap((c) =>
    full(c.key).adjustingEntries.flatMap((j, index) =>
      [
        { label: 'the day after the fiscal year end', date: addDays(c.key.fiscalYear.end, 1), bound: c.key.fiscalYear.end },
        { label: 'the day before the fiscal year start', date: addDays(c.key.fiscalYear.start, -1), bound: c.key.fiscalYear.start },
      ].map((d): [string, string, string, { c: WalkClient; id: string; index: number; date: string; bound: string }] => [c.id, j.id, d.label, { c, id: j.id, index, date: d.date, bound: d.bound }]),
    ),
  )
  test.each(entryCases)('ARC-8 %s adjusting entry %s dated %s is refused, naming the entry and the bound it breaks (the year start or end date)', async (_l, _id, _d, { c, id, index, date, bound }) => {
    sb.editKey(c, (k) => {
      const j = full(k).adjustingEntries[index]
      if (j?.id !== id) throw new Error(`fixture: entry ${id} moved`)
      j.date = date
    })
    expectNamed(await refusal(sb, c.id), undefined, [id, bound])
  })

  test.each(byId(withEntries))('ARC-8 %s with every adjusting entry dated on the fiscal year start still loads', async (_l, c) => {
    sb.editKey(c, (k) => {
      for (const j of full(k).adjustingEntries) j.date = c.key.fiscalYear.start
    })
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC3 a priorYear row is dated within the 12 months before the fiscal year (every priorYear row of every folder)', () => {
  const priorCases = markedRows(clients)
    .filter((r) => r.field === 'priorYear')
    .map((r): [string, MarkedRow] => [`${r.c.id} ${r.t.id}`, r])
  /** The row moved to `date`, with its pin moved to a new priorYear entry for that month (pins kept true). */
  const moved = (r: MarkedRow, date: string): CatalogueEntry[] => {
    const cat = catalogue()
    dropPin(entryFor(cat, r.group), r.t.id)
    freeFlagEntry(cat, r.c.id).marker = { field: 'priorYear', account: r.t.acct, month: monthOf(date), rows: [{ ...pinOf(r.t, 'priorYear'), date }] }
    sb.editKey(r.c, (k) => {
      txIn(k, r.t.id).date = date
    })
    return cat
  }

  test('ARC-8 the walk finds priorYear rows (C10 today)', () => {
    expect(priorCases.length).toBeGreaterThan(0)
  })

  test.each(priorCases)('ARC-8 %s dated 13 months before the fiscal year start, its pin moved to match, is refused, naming the row', async (_l, r) => {
    const date = `${addMonth(monthOf(r.c.key.fiscalYear.start), -13)}-15`
    expectNamed(await refusal(sb, r.c.id, moved(r, date)), undefined, [r.t.id])
  })

  test.each(priorCases)('ARC-8 %s dated on the first day of the month 11 months before the fiscal year start, its pin moved to match, still loads', async (_l, r) => {
    const date = `${addMonth(monthOf(r.c.key.fiscalYear.start), -11)}-01`
    await expectLoads(sb, r.c.id, moved(r, date))
  })
})

describe('W00c RC3 February 29 is a date only in a leap year (spec review 3, gap 4: every folder)', () => {
  /** The Februaries the fiscal year holds, from its own months, as [YYYY-02-29, leap?] with the date inside the year. */
  const februaries = (c: WalkClient): { date: string; leap: boolean }[] =>
    fiscalMonths(c.key)
      .filter((ym) => ym.endsWith('-02'))
      .map((ym) => ({ date: `${ym}-29`, leap: daysIn(ym) === 29 }))
      .filter((f) => !f.leap || (f.date >= c.key.fiscalYear.start && f.date <= c.key.fiscalYear.end))
  const leapCases = clients.flatMap((c) => februaries(c).filter((f) => f.leap).map((f): [string, string, WalkClient] => [c.id, f.date, c]))
  const nonLeapCases = clients.flatMap((c) => februaries(c).filter((f) => !f.leap).map((f): [string, string, WalkClient] => [c.id, f.date, c]))

  /** Plants an unmarked zero-amount row (when the folder has accounts) and moves the first adjusting entry (when it has one) to `date`. */
  function plantOn(c: WalkClient, date: string): { rowIndex?: number; entry: boolean } {
    const src = c.key.transactions.find((t) => markersOf(t).length === 0)
    const entry = full(c.key).adjustingEntries.length > 0
    if (src === undefined && !entry) throw new Error(`fixture: ${c.id} has neither an unmarked row nor an adjusting entry`)
    sb.editKey(c, (k) => {
      if (src !== undefined) k.transactions.push(plantRow(src, `${src.id}-FEB29-(Test)`, { date, amount: 0 }))
      const j = full(k).adjustingEntries[0]
      if (j !== undefined) j.date = date
    })
    return src === undefined ? { entry } : { rowIndex: c.key.transactions.length, entry }
  }

  test('ARC-8 the walk finds a fiscal year holding a February 29 (C14 today) and years holding a non-leap February', () => {
    expect(leapCases.length).toBeGreaterThan(0)
    expect(leapCases.map(([id]) => id)).toContain('C14')
    expect(nonLeapCases.length).toBeGreaterThan(0)
  })

  test.each(leapCases)('ARC-8 %s with an unmarked zero-amount row and an adjusting entry dated %s (inside its year) still loads', async (_l, date, c) => {
    const planted = plantOn(c, date)
    expect(planted.rowIndex !== undefined && planted.entry, `fixture: ${c.id} should take both plants`).toBe(true)
    await expectLoads(sb, c.id)
  })

  test.each(nonLeapCases)("ARC-8 %s with an unmarked zero-amount row and its first adjusting entry dated %s is refused with a 'schema' issue naming each date field as not a calendar date", async (_l, date, c) => {
    const planted = plantOn(c, date)
    const issues = await refusal(sb, c.id)
    if (planted.rowIndex !== undefined) expectIssueWith(issues, 'schema', ['answer-key.json', `transactions.${String(planted.rowIndex)}.date`], ['not a calendar date'])
    if (planted.entry) expectIssueWith(issues, 'schema', ['answer-key.json', 'adjustingEntries.0.date'], ['not a calendar date'])
  })
})
