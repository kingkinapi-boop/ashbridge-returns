// W00a acceptance tests, part 2 of 3: fault markers against the catalogue, with both rolls (findings W00 r2
// RC3, S6; card decisions "Two rolls" and "Every marker needs a catalogue entry"; build B3, B4).
//
// Every case comes from a walk over all numbered folders of reference/sample-clients/ (testworld/model/__fixtures__/
// sample-walk.ts), never from a typed list; the expected rolls and markers are computed there from the raw files.
//
// The catalogue (testworld/model/faults.ts, faults()), two additions to FaultEntry:
//   roll?:   { account: string; month: string; cause: 'missing' | 'duplicate' }   (cause is new)
//   marker?: { field: 'missingFromExport' | 'dupOf' | 'priorYear'; account: string; month: string;
//              rows: { id; date; amountCents; dupOf? }[] }   (rows: W00c round 2, A400; see marker-pins)
//            on the entry of the flag the planted fault raises (it has a flagId; each flag is still listed once).
//
// The marker check (W00c round 2 rewrite): every transaction carrying a marker (missingFromExport: true,
// dupOf: "<id>", priorYear: true) must be listed by id in the rows of a catalogue entry of that client whose
// marker has that field and which has a flagId; otherwise a 'fault-catalogue' issue whose record or reason names
// the row id and the field. A marker entry whose listed rows are not in its account and month, or one with no
// flagId, is a 'fault-catalogue' issue naming the entry id. A roll entry is never a marker entry.
//
// The two rolls (card and pcard subtract activity):
//   statement roll: opening plus the month's rows with dupOf and priorYear rows out and missingFromExport rows in
//                   equals closing, every month, no waiver ('roll', record "<account> <YYYY-MM>").
//   export roll:    opening plus the rows in the export (missingFromExport rows out, dupOf rows in) equals
//                   closing, or the catalogue has a roll entry for (client, account, month) whose cause explains
//                   the gap exactly: 'missing' when closing - (opening + export) = sign * sum of the month's
//                   missingFromExport rows, 'duplicate' when it = -sign * sum of its dupOf rows. Otherwise 'roll',
//                   record "<account> <YYYY-MM>". A listed month that rolls is still refused (round 2).
//   loaded month.rolls stays the export roll (C10 CHQ 2025-03 and 2025-05 false, as the answer key says).
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { expectNamed } from './__fixtures__/w00c-walk'
import {
  Sandbox,
  addMonth,
  catalogue,
  causeOf,
  expectIssue,
  expectLoads,
  groupLabel,
  markerGroups,
  monthRolls,
  pinOf,
  plainMonth,
  refusal,
  shiftFrom,
  sign,
  walkClients,
  type CatalogueEntry,
  type MarkerGroup,
  type MonthRoll,
  type RawAccount,
  type RawTx,
  type WalkClient,
} from './__fixtures__/sample-walk'

const clients = walkClients()
const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clientOf = (id: string): WalkClient => {
  const c = clients.find((x) => x.id === id)
  if (c === undefined) throw new Error(`fixture: no client ${id}`)
  return c
}
const groups: [string, MarkerGroup][] = clients.flatMap((c) => markerGroups(c).map((g): [string, MarkerGroup] => [groupLabel(g), g]))
const gaps: [string, MonthRoll][] = clients.flatMap((c) =>
  monthRolls(c)
    .filter((r) => r.exportGapCents !== 0)
    .map((r): [string, MonthRoll] => [`${r.client} ${r.account} ${r.month}`, r]),
)
const accountCases: [string, { c: WalkClient; a: RawAccount }][] = clients.flatMap((c) =>
  c.key.accounts.map((a): [string, { c: WalkClient; a: RawAccount }] => [`${c.id} ${a.key}`, { c, a }]),
)
const sameMarker = (e: CatalogueEntry, g: MarkerGroup): boolean =>
  e.client === g.client && e.marker?.field === g.field && e.marker.account === g.account && e.marker.month === g.month
const isRollFor = (e: CatalogueEntry, r: { client: string; account: string; month: string }): boolean =>
  e.client === r.client && e.roll?.account === r.account && e.roll.month === r.month
const plantedId = (c: WalkClient, what: string): string => `${c.id}-${what}-(Test)`
const markedWith = (t: RawTx, field: string): boolean =>
  field === 'dupOf' ? typeof t.dupOf === 'string' : field === 'missingFromExport' ? t.missingFromExport === true : t.priorYear === true

/** A copy of row t with a new id and no postings (a planted row posts nothing, so the trial balance is untouched). */
function copyRow(t: RawTx, id: string, changes: Partial<RawTx>): RawTx {
  const r = structuredClone(t)
  delete r['post']
  delete r['pair']
  delete r['flags']
  return { ...r, ...changes, id }
}

describe('W00a S6 the sample clients and the catalogue agree (walk)', () => {
  test('ARC-8 the walk finds marked rows and export gaps to test (C10 today), and every month of every client holds the statement roll', () => {
    expect(groups.length).toBeGreaterThan(0)
    expect(gaps.length).toBeGreaterThan(0)
    const broken = clients.flatMap((c) => monthRolls(c).filter((r) => !r.statementRolls).map((r) => `${r.client} ${r.account} ${r.month}`))
    expect(broken).toEqual([])
  })

  test.each(clients.map((c): [string, WalkClient] => [c.id, c]))('ARC-8 %s loads with the real catalogue (both rolls, markers and relations hold)', async (_l, c) => {
    await expectLoads(sb, c.id)
  })

  test('ARC-8 the catalogue has a marker entry for exactly the marked groups the walk finds, each on a flag the client answer key has', () => {
    const cat = catalogue()
    const listed = cat.filter((e) => e.marker !== undefined)
    expect(listed.map((e) => `${String(e.client)} ${String(e.marker?.field)} ${String(e.marker?.account)} ${String(e.marker?.month)}`).sort()).toEqual(
      groups.map(([label]) => label).sort(),
    )
    for (const e of listed) {
      const flags = clientOf(String(e.client)).key.flags.map((f) => f.id)
      expect(flags, `${e.id} marker flag`).toContain(e.flagId)
      expect(e.roll, `${e.id}: a marker entry is not a roll entry`).toBeUndefined()
    }
  })

  test('ARC-8 the catalogue has a roll entry for exactly the months whose export does not roll, with the cause the walk finds', () => {
    const want = gaps.map(([label, r]) => `${label} ${String(causeOf(r))}`).sort()
    for (const w of want) expect(w, 'every export gap has one cause in the data').not.toMatch(/undefined$/)
    const rolls = catalogue().filter((e) => e.roll !== undefined)
    expect(rolls.map((e) => `${String(e.client)} ${String(e.roll?.account)} ${String(e.roll?.month)} ${String(e.roll?.cause)}`).sort()).toEqual(want)
  })
})

describe('W00a S6 every marker needs its catalogue entry', () => {
  test.each(groups)('ARC-8 %s: with its marker taken off the catalogue entry, the client is refused naming every marked row and the marker', async (_l, g) => {
    const cat = catalogue()
    const hits = cat.filter((e) => sameMarker(e, g))
    expect(hits, `the catalogue lists ${groupLabel(g)} once`).toHaveLength(1)
    for (const e of hits) delete e.marker
    const issues = await refusal(sb, g.client, cat)
    const marked = clientOf(g.client).key.transactions.filter((t) => t.acct === g.account && t.date.slice(0, 7) === g.month && markedWith(t, g.field))
    expect(marked.length).toBeGreaterThan(0)
    for (const t of marked) expectNamed(issues, 'fault-catalogue', [t.id, g.field])
  })

  test.each(groups)('ARC-8 %s: a marker entry moved to a month its listed rows are not dated in is refused, naming the entry', async (_l, g) => {
    const cat = catalogue()
    const e = cat.find((x) => sameMarker(x, g))
    if (e?.marker === undefined) throw new Error(`the catalogue has no marker entry for ${groupLabel(g)}`)
    const elsewhere = addMonth(g.month, 7)
    e.marker = { ...e.marker, month: elsewhere }
    expectIssue(await refusal(sb, g.client, cat), 'fault-catalogue', e.id)
  })

  test.each(groups)('ARC-8 %s: a marker entry with no flag is refused, naming the entry', async (_l, g) => {
    const cat = catalogue()
    const e = cat.find((x) => sameMarker(x, g))
    if (e?.marker === undefined) throw new Error(`the catalogue has no marker entry for ${groupLabel(g)}`)
    const id = `${g.client}-marker-without-flag-(Test)`
    cat.push({ id, client: g.client, planted: 'a marker with no flag (Test)', expected: 'refused (Test)', marker: { ...e.marker } })
    delete e.marker
    expectIssue(await refusal(sb, g.client, cat), 'fault-catalogue', id)
  })

  test.each(accountCases)('ARC-8 %s: a planted dupOf row in a month the catalogue waives as "duplicate" but lists no marker for is refused', async (_l, { c, a }) => {
    const { month, tx } = plainMonth(c, a)
    sb.editKey(c, (k) => {
      k.transactions.push(copyRow(tx, `${tx.id}-DUP`, { dupOf: tx.id }))
    })
    // The export roll's gap is the duplicate exactly and the waiver explains it: only the marker check can refuse.
    const cat = catalogue()
    cat.push({ id: plantedId(c, 'dup-roll'), client: c.id, planted: 'duplicate (Test)', expected: 'roll waiver (Test)', roll: { account: a.key, month, cause: 'duplicate' } })
    expectNamed(await refusal(sb, c.id, cat), 'fault-catalogue', [`${tx.id}-DUP`, 'dupOf'])
  })

  test.each(accountCases)('ARC-8 %s: a missingFromExport row in a month the catalogue waives as "missing" but lists no marker for is refused', async (_l, { c, a }) => {
    const { month, tx } = plainMonth(c, a)
    sb.editKey(c, (k) => {
      const t = k.transactions.find((x) => x.id === tx.id)
      if (t === undefined) throw new Error('fixture: row gone')
      t.missingFromExport = true
    })
    const cat = catalogue()
    cat.push({ id: plantedId(c, 'missing-roll'), client: c.id, planted: 'missing (Test)', expected: 'roll waiver (Test)', roll: { account: a.key, month, cause: 'missing' } })
    expectNamed(await refusal(sb, c.id, cat), 'fault-catalogue', [tx.id, 'missingFromExport'])
  })

  test.each(accountCases)('ARC-8 %s: a planted priorYear row dated before the year with no catalogue entry listing it is refused, naming the row and the field', async (_l, { c, a }) => {
    const { tx } = plainMonth(c, a)
    // The month before the year that no listed priorYear group already covers (C10 CHQ 2024-12 is listed).
    let before = addMonth(c.key.fiscalYear.start.slice(0, 7), -1)
    while (markerGroups(c).some((g) => g.field === 'priorYear' && g.account === a.key && g.month === before)) before = addMonth(before, -1)
    sb.editKey(c, (k) => {
      k.transactions.push(copyRow(tx, `${tx.id}-PRIOR`, { priorYear: true, date: `${before}-15`, account: 'PRIOR YEAR: already in the opening balances, not this year', accountNo: null }))
    })
    expectNamed(await refusal(sb, c.id), 'fault-catalogue', [`${tx.id}-PRIOR`, 'priorYear'])
  })
})

describe('W00a S6 a marker never changes the arithmetic: both rolls', () => {
  test.each(accountCases)('ARC-8 %s: a row marked missingFromExport in an unwaived month is refused by the export roll and the marker check', async (_l, { c, a }) => {
    const { month, tx } = plainMonth(c, a)
    sb.editKey(c, (k) => {
      const t = k.transactions.find((x) => x.id === tx.id)
      if (t === undefined) throw new Error('fixture: row gone')
      t.missingFromExport = true
    })
    const issues = await refusal(sb, c.id)
    expectIssue(issues, 'roll', a.key, month)
    expectNamed(issues, 'fault-catalogue', [tx.id, 'missingFromExport'])
  })

  test.each(accountCases)(
    'ARC-8 %s: a row marked missingFromExport with the closing fudged so the export rolls, marker listed, is refused by the statement roll',
    async (_l, { c, a }) => {
      const { month, tx, index } = plainMonth(c, a)
      sb.editKey(c, (k) => {
        const t = k.transactions.find((x) => x.id === tx.id)
        if (t === undefined) throw new Error('fixture: row gone')
        t.missingFromExport = true
        // The closing drops the missing row, and every later month and the account's closing follow: links hold.
        shiftFrom(k, a.key, index, -sign(a.role) * Math.round(tx.amount * 100), false)
      })
      const cat = catalogue()
      const flagEntry = cat.find((e) => e.client === c.id && e.flagId !== undefined && e.marker === undefined)
      if (flagEntry === undefined) throw new Error(`fixture: ${c.id} has no flag entry to carry the marker`)
      flagEntry.marker = { field: 'missingFromExport', account: a.key, month, rows: [pinOf(tx, 'missingFromExport')] }
      expectIssue(await refusal(sb, c.id, cat), 'roll', a.key, month)
    },
  )

  test.each(gaps)('ARC-8 %s: the waiver with its cause flipped no longer explains the gap and the client is refused for that month', async (_l, r) => {
    const cat = catalogue()
    const e = cat.find((x) => isRollFor(x, r))
    if (e?.roll === undefined) throw new Error(`the catalogue has no roll entry for ${r.client} ${r.account} ${r.month}`)
    e.roll = { ...e.roll, cause: e.roll.cause === 'missing' ? 'duplicate' : 'missing' }
    expectIssue(await refusal(sb, r.client, cat), 'roll', r.account, r.month)
  })

  test.each(gaps)(
    'ARC-8 %s: the closing fudged to what the export shows and the waiver dropped is still refused by the statement roll (round 1 RC4 probe)',
    async (_l, r) => {
      const c = clientOf(r.client)
      const index = (c.key.statementBalances[r.account] ?? []).findIndex((m) => m.month === r.month)
      expect(index).toBeGreaterThanOrEqual(0)
      sb.editKey(c, (k) => {
        shiftFrom(k, r.account, index, -r.exportGapCents, false)
      })
      const cat = catalogue().filter((e) => !isRollFor(e, r))
      expectIssue(await refusal(sb, r.client, cat), 'roll', r.account, r.month)
    },
  )
})
