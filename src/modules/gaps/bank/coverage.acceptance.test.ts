// Spec for card G18 (question banks: every sample flag mapped), round 2 (Lead directive A499, 3 Oct 16:08Z).
// Choices the card leaves open (amber, in the spec report):
//  - The map is `data/question-coverage.json`: `{ "version": 1, "flags": { "<flag id>": <entry> } }`, where an entry is
//    `{ "questions": ["Q-..."] }` (at least one live bank item) or a reason row
//    `{ "kind": "check" | "cpa-judgment", "owner": "<card id>", "clause": "<clause id>" | "none", "reason": "<why>" }`.
//    An entry has one of the two shapes and nothing else; the short reason stays (round 1's field), the clause is new.
//  - R1 owner covers clause (A499, replaces A467's open-owner rule): the owner is a card in plan/slices.json, not parked
//    (done is allowed), with plan/cards/<id>.md or its family template plan/cards/families/<family>.md, and its
//    `clauses` in plan/slices.json list the row's clause. A cpa-judgment row is owned by X00 with clause `none`, and
//    only for the pinned list; a flag on that list is a cpa-judgment row.
//  - R2 side: a flag's books net is the sum, in cents, of debits less credits on GIFI 1301, 2781 and 3261 over the
//    `post` lines of its evidence transactions (a transaction with no `post` line, booked through an adjusting entry, adds
//    nothing) and the lines of its evidence adjusting entries; a GIFI is read from the account's trial balance row.
//  - R3 opener: a yes/no item without slots is an item whose answer shape is `yes_no` and whose slot list is empty; a
//    flag has books rows when its evidence lists a transaction or an adjusting entry.
//  - R6 side words are matched whole and case-blind ("personal" does not match inside "personally").
//  - The rules are pure functions in this file, so the plants run on in-memory maps built from real flags, real bank
//    items and the real card list, and the real map is checked the same way.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const read = (...p: string[]): unknown => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'))

type Flag = { id: string; severity: string; judgement: boolean; booksRows: number; shareholderNetCents: number }
type Item = { id: string; retired: boolean; opener: boolean; label: string; resolves: string }
type Card = { status: string; clauses: string[]; hasCardFile: boolean }
type Entry = { questions?: string[]; kind?: string; owner?: string; clause?: string; reason?: string }
type CoverageMap = { version: number; flags: Record<string, Entry> }
type World = {
  flags: Flag[]
  items: Map<string, Item>
  cards: Map<string, Card>
  cpaPinned: Set<string>
  openerPinned: Set<string>
  creditSide: Set<string>
  debitSide: Set<string>
}

const KINDS = new Set(['check', 'cpa-judgment'])
const SHAREHOLDER_GIFI = new Set([1301, 2781, 3261])
/** A499: the pinned cpa-judgment list (owner X00, clause none). */
const CPA_PINNED = new Set(['03-F06', '04-F06', '09-F02', '09-F04', '09-F05', '09-F06', '09-F07', '10-F05', '10-F08', '13-F04', '14-F05', '15-F05'])
/** A499 R3: the client's own list, confirmed: a yes/no opener stands for these two. */
const OPENER_PINNED = new Set(['01-F05', '08-F06'])
/** A499 R2: questions whose fact sits on the credit side of the shareholder accounts; none is listed as debit side. */
const CREDIT_SIDE = new Set(['Q-SHL-001', 'Q-SHL-002', 'Q-EXP-001'])
const DEBIT_SIDE = new Set<string>()
/** A499 R6: the side words a bank label keeps from its catalogue label. */
const SIDE_WORDS = ['due to', 'due from', 'personal', 'personally', 'paid']

/** The map rule: every problem found, as one line each, so a plant can name the line it expects. */
function problems(map: CoverageMap, w: World): string[] {
  const out: string[] = []
  const ids = new Set(w.flags.map((f) => f.id))
  for (const f of w.flags) {
    const e = map.flags[f.id]
    if (e === undefined) {
      out.push(`flag ${f.id} is not mapped`)
      continue
    }
    const keys = Object.keys(e).sort().join(',')
    const asQuestion = keys === 'questions'
    const asReason = keys === 'clause,kind,owner,reason'
    if (!asQuestion && !asReason) {
      out.push(`flag ${f.id}: an entry is { questions } or { kind, owner, clause, reason } and nothing else (found ${keys})`)
      continue
    }
    if (asQuestion) {
      const qs = e.questions ?? []
      if (qs.length === 0) out.push(`flag ${f.id}: maps to no question`)
      for (const q of qs) {
        const item = w.items.get(q)
        if (item === undefined) out.push(`flag ${f.id}: question ${q} is in no bank`)
        else if (item.retired) out.push(`flag ${f.id}: question ${q} is retired`)
      }
      if (f.shareholderNetCents > 0) {
        for (const q of qs) {
          if (w.debitSide.has(q)) continue
          if (w.creditSide.has(q)) out.push(`flag ${f.id}: question ${q} sits on the credit side; the flag nets to a debit on GIFI 1301, 2781 or 3261`)
          else out.push(`flag ${f.id}: question ${q} is not listed as debit side; the flag nets to a debit on GIFI 1301, 2781 or 3261`)
        }
      }
      const onlyOpeners = qs.length > 0 && qs.every((q) => w.items.get(q)?.opener === true)
      if (onlyOpeners && (f.judgement || f.booksRows > 0) && !w.openerPinned.has(f.id)) {
        out.push(`flag ${f.id}: only yes/no openers, which cannot cover a flag with judgement or books rows`)
      }
    } else {
      const owner = e.owner ?? ''
      const clause = e.clause ?? ''
      if (!KINDS.has(e.kind ?? '')) out.push(`flag ${f.id}: kind ${String(e.kind)} is not check or cpa-judgment`)
      if ((e.reason ?? '').trim() === '') out.push(`flag ${f.id}: the reason is empty`)
      const card = w.cards.get(owner)
      if (card === undefined) out.push(`flag ${f.id}: the owner ${owner} is not a card in plan/slices.json`)
      else if (card.status === 'parked') out.push(`flag ${f.id}: the owner ${owner} is parked`)
      else if (!card.hasCardFile) out.push(`flag ${f.id}: the owner ${owner} has no card file or family template`)
      if (e.kind === 'check' && card !== undefined && !card.clauses.includes(clause)) {
        out.push(`flag ${f.id}: the owner ${owner} does not list clause ${clause}`)
      }
      if (e.kind === 'cpa-judgment') {
        if (!w.cpaPinned.has(f.id)) out.push(`flag ${f.id}: cpa-judgment is only for the pinned list`)
        if (owner !== 'X00') out.push(`flag ${f.id}: a cpa-judgment row is owned by X00 (found ${owner})`)
        if (clause !== 'none') out.push(`flag ${f.id}: a cpa-judgment row has clause none (found ${clause})`)
      }
    }
    if (w.cpaPinned.has(f.id) && e.kind !== 'cpa-judgment') out.push(`flag ${f.id}: on the pinned cpa-judgment list but not a cpa-judgment row`)
  }
  for (const id of Object.keys(map.flags)) if (!ids.has(id)) out.push(`stale id ${id}: in no sample answer key`)
  return out
}

/** R6: a bank label keeps its catalogue label's side words. */
function labelProblems(items: Item[], catalogue: Map<string, string>): string[] {
  const out: string[] = []
  const has = (label: string, word: string): boolean => new RegExp(`\\b${word}\\b`, 'i').test(label)
  for (const i of items) {
    const cat = catalogue.get(i.resolves)
    if (cat === undefined) {
      out.push(`item ${i.id}: resolves ${i.resolves}, which is not in the catalogue`)
      continue
    }
    const dropped = SIDE_WORDS.filter((word) => has(cat, word) && !has(i.label, word))
    if (dropped.length > 0) out.push(`item ${i.id}: label "${i.label}" drops "${dropped.join('", "')}" from its catalogue label "${cat}"`)
  }
  return out
}

type AnswerKey = {
  flags?: { id: string; severity: string; judgement?: boolean; evidence: { transactions: string[]; adjustingEntries: string[] } }[]
  transactions: { id: string; post?: { a: string; dr?: number; cr?: number }[] }[]
  adjustingEntries: { id: string; lines: { account: string; gifi: number | null; debit: number; credit: number }[] }[]
  trialBalance: Record<string, unknown>
}

const cents = (dollars: number | undefined): number => Math.round((dollars ?? 0) * 100)

function flagsOf(key: AnswerKey): Flag[] {
  const gifi = new Map<string, number | null>()
  for (const part of Object.values(key.trialBalance)) {
    const rows = (part as { rows?: { account: string; gifi: number | null }[] } | null)?.rows ?? []
    for (const r of rows) gifi.set(r.account, r.gifi)
  }
  const tx = new Map(key.transactions.map((t) => [t.id, t]))
  const aje = new Map(key.adjustingEntries.map((a) => [a.id, a]))
  return (key.flags ?? []).map((f) => {
    let net = 0
    for (const id of f.evidence.transactions) {
      const t = tx.get(id)
      if (t === undefined) throw new Error(`flag ${f.id}: evidence transaction ${id} is not in the answer key`)
      for (const l of t.post ?? []) if (SHAREHOLDER_GIFI.has(gifi.get(l.a) ?? 0)) net += cents(l.dr) - cents(l.cr)
    }
    for (const id of f.evidence.adjustingEntries) {
      const a = aje.get(id)
      if (a === undefined) throw new Error(`flag ${f.id}: evidence adjusting entry ${id} is not in the answer key`)
      for (const l of a.lines) if (SHAREHOLDER_GIFI.has(l.gifi ?? 0)) net += cents(l.debit) - cents(l.credit)
    }
    return {
      id: f.id,
      severity: f.severity,
      judgement: f.judgement === true,
      booksRows: f.evidence.transactions.length + f.evidence.adjustingEntries.length,
      shareholderNetCents: net,
    }
  })
}

function loadWorld(): World {
  const flags: Flag[] = []
  const clientsDir = path.join(ROOT, 'reference', 'sample-clients')
  for (const d of fs.readdirSync(clientsDir).sort()) {
    const key = path.join(clientsDir, d, 'answer-key.json')
    if (!fs.existsSync(key)) continue
    flags.push(...flagsOf(JSON.parse(fs.readFileSync(key, 'utf8')) as AnswerKey))
  }
  const items = new Map<string, Item>()
  for (const i of loadItems()) items.set(i.id, i)
  const slices = read('plan', 'slices.json') as { cards: { id: string; status: string; family?: string; clauses?: string[] }[] }
  const cards = new Map<string, Card>()
  for (const c of slices.cards) {
    const own = fs.existsSync(path.join(ROOT, 'plan', 'cards', `${c.id}.md`))
    const family = c.family !== undefined && fs.existsSync(path.join(ROOT, 'plan', 'cards', 'families', `${c.family}.md`))
    cards.set(c.id, { status: c.status, clauses: c.clauses ?? [], hasCardFile: own || family })
  }
  return { flags, items, cards, cpaPinned: CPA_PINNED, openerPinned: OPENER_PINNED, creditSide: CREDIT_SIDE, debitSide: DEBIT_SIDE }
}

function loadItems(): Item[] {
  const out: Item[] = []
  const bankDir = path.join(ROOT, 'data', 'question-bank')
  for (const f of fs.readdirSync(bankDir).sort()) {
    if (!f.endsWith('.json') || f === '_schema.json') continue
    const bank = JSON.parse(fs.readFileSync(path.join(bankDir, f), 'utf8')) as {
      items: { id: string; retired: boolean; label: string; resolves: string; slots: unknown[]; answer: { shape: string } }[]
    }
    for (const i of bank.items) {
      out.push({ id: i.id, retired: i.retired, opener: i.answer.shape === 'yes_no' && i.slots.length === 0, label: i.label, resolves: i.resolves })
    }
  }
  return out
}

function loadCatalogue(): Map<string, string> {
  const c = read('data', 'facts', 'catalogue.json') as { entries: { key: string; label: string }[] }
  return new Map(c.entries.map((e) => [e.key, e.label]))
}

const world = loadWorld()
const catalogue = loadCatalogue()
const realMap = (): CoverageMap => read('data', 'question-coverage.json') as CoverageMap
const realFlag = (id: string): Flag => {
  const f = world.flags.find((x) => x.id === id)
  if (f === undefined) throw new Error(`flag ${id} is in no sample answer key`)
  return f
}
const realItem = (id: string): Item => {
  const i = world.items.get(id)
  if (i === undefined) throw new Error(`item ${id} is in no bank`)
  return i
}

/** A small world of real flags, real bank items and the real card list, and a good map, for the plants. */
function tiny(): { map: CoverageMap; w: World } {
  const items = new Map(world.items)
  items.set('Q-AAA-002', { id: 'Q-AAA-002', retired: true, opener: false, label: 'Retired item (Test)', resolves: 'qa.test.retired' })
  const w: World = { ...world, flags: ['01-F02', '01-F05', '03-F03', '04-F06'].map(realFlag), items }
  const map: CoverageMap = {
    version: 1,
    flags: {
      '01-F02': { kind: 'check', owner: 'Q30', clause: 'CK-30', reason: 'CK-30 raises the unpaid loan from the books' },
      '01-F05': { questions: ['Q-EXP-001'] },
      '03-F03': { kind: 'check', owner: 'Q23', clause: 'CK-23', reason: 'CK-23 ties wages to the T4 Summary' },
      '04-F06': { kind: 'cpa-judgment', owner: 'X00', clause: 'none', reason: 'A person decides' },
    },
  }
  return { map, w }
}

describe('G18 the map rule catches its plants', () => {
  test('AI-12 a good small map of real flags has no problems', () => {
    const { map, w } = tiny()
    expect(w.flags).toHaveLength(4)
    expect(problems(map, w)).toEqual([])
  })
  test('END-7 an unmapped flag is caught', () => {
    const { map, w } = tiny()
    delete map.flags['01-F05']
    expect(problems(map, w)).toEqual(['flag 01-F05 is not mapped'])
  })
  test('END-7 a mapping to a question that is in no bank is caught', () => {
    const { map, w } = tiny()
    map.flags['01-F05'] = { questions: ['Q-ZZZ-009'] }
    expect(problems(map, w)).toEqual(['flag 01-F05: question Q-ZZZ-009 is in no bank'])
  })
  test('END-7 a mapping to a retired question is caught', () => {
    const { map, w } = tiny()
    map.flags['01-F05'] = { questions: ['Q-EXP-001', 'Q-AAA-002'] }
    expect(problems(map, w)).toEqual(['flag 01-F05: question Q-AAA-002 is retired'])
  })
  test('END-7 an empty question list is caught', () => {
    const { map, w } = tiny()
    map.flags['01-F05'] = { questions: [] }
    expect(problems(map, w)).toEqual(['flag 01-F05: maps to no question'])
  })
  test('END-7 a reason with no text or a made-up kind is caught', () => {
    const { map, w } = tiny()
    map.flags['01-F02'] = { kind: 'hunch', owner: 'Q30', clause: 'CK-30', reason: ' ' }
    expect(problems(map, w)).toEqual(['flag 01-F02: kind hunch is not check or cpa-judgment', 'flag 01-F02: the reason is empty'])
  })
  test('END-7 an entry with both shapes, an unknown field, or a reason row without its clause is caught', () => {
    const { map, w } = tiny()
    map.flags['01-F05'] = { questions: ['Q-EXP-001'], reason: 'also a reason' }
    map.flags['01-F02'] = { kind: 'check', owner: 'Q30', clause: 'CK-30', reason: 'r', questions: ['Q-SHL-002'] }
    map.flags['03-F03'] = { kind: 'check', owner: 'Q23', reason: 'round 1 shape, no clause' }
    expect(problems(map, w)).toEqual([
      'flag 01-F02: an entry is { questions } or { kind, owner, clause, reason } and nothing else (found clause,kind,owner,questions,reason)',
      'flag 01-F05: an entry is { questions } or { kind, owner, clause, reason } and nothing else (found questions,reason)',
      'flag 03-F03: an entry is { questions } or { kind, owner, clause, reason } and nothing else (found kind,owner,reason)',
    ])
  })
  test('END-7 a stale id, in no answer key, is caught', () => {
    const { map, w } = tiny()
    map.flags['T-F09'] = { questions: ['Q-EXP-001'] }
    expect(problems(map, w)).toEqual(['stale id T-F09: in no sample answer key'])
  })

  test('AI-12 R1 a check owned by a card that does not list its clause is caught: {Q00, CK-30}', () => {
    expect(world.cards.get('Q00')?.clauses).not.toContain('CK-30')
    const { map, w } = tiny()
    map.flags['01-F02'] = { kind: 'check', owner: 'Q00', clause: 'CK-30', reason: 'CK-30 raises the unpaid loan from the books' }
    expect(problems(map, w)).toEqual(['flag 01-F02: the owner Q00 does not list clause CK-30'])
  })
  test('AI-12 R1 a family card with no card file of its own passes through its template: {Q30, CK-30}', () => {
    expect(fs.existsSync(path.join(ROOT, 'plan', 'cards', 'Q30.md'))).toBe(false)
    const q30 = world.cards.get('Q30')
    expect(q30?.status).not.toBe('parked')
    expect(q30?.clauses).toContain('CK-30')
    expect(q30?.hasCardFile).toBe(true)
    const { map, w } = tiny()
    expect(map.flags['01-F02']).toMatchObject({ owner: 'Q30', clause: 'CK-30' })
    expect(problems(map, w)).toEqual([])
  })
  test('AI-12 R1 a parked owner is caught, even one that lists the clause', () => {
    const parked = [...world.cards].find(([, c]) => c.status === 'parked' && c.hasCardFile && c.clauses.length > 0)
    expect(parked).toBeDefined()
    const [owner, card] = parked ?? ['', { clauses: [''] }]
    const { map, w } = tiny()
    map.flags['01-F02'] = { kind: 'check', owner, clause: card.clauses[0] ?? '', reason: 'a rule check' }
    expect(problems(map, w)).toEqual([`flag 01-F02: the owner ${owner} is parked`])
  })
  test('AI-12 R1 a done owner that lists the clause is allowed', () => {
    expect(world.cards.get('F07')?.status).toBe('done')
    const { map, w } = tiny()
    map.flags['01-F02'] = { kind: 'check', owner: 'F07', clause: 'END-1', reason: 'the ops-confirms item' }
    expect(problems(map, w)).toEqual([])
  })
  test('AI-12 R1 an owner missing from plan/slices.json, or empty, is caught', () => {
    for (const owner of ['NOPE', '']) {
      const { map, w } = tiny()
      map.flags['01-F02'] = { kind: 'check', owner, clause: 'CK-30', reason: 'a rule check' }
      expect(problems(map, w)).toEqual([`flag 01-F02: the owner ${owner} is not a card in plan/slices.json`])
    }
  })
  test('AI-12 R1 an owner with no card file and no family template is caught', () => {
    const { map, w } = tiny()
    w.cards = new Map(world.cards)
    w.cards.set('Z99', { status: 'carded', clauses: ['CK-30'], hasCardFile: false })
    map.flags['01-F02'] = { kind: 'check', owner: 'Z99', clause: 'CK-30', reason: 'a rule check' }
    expect(problems(map, w)).toEqual(['flag 01-F02: the owner Z99 has no card file or family template'])
  })
  test('AI-12 R1 a cpa-judgment row outside the pinned list is caught', () => {
    const { map, w } = tiny()
    map.flags['03-F03'] = { kind: 'cpa-judgment', owner: 'X00', clause: 'none', reason: 'a person decides' }
    expect(problems(map, w)).toEqual(['flag 03-F03: cpa-judgment is only for the pinned list'])
  })
  test('AI-12 R1 a pinned cpa-judgment flag made a check, or a cpa-judgment row with another owner or a clause, is caught', () => {
    const a = tiny()
    a.map.flags['04-F06'] = { kind: 'check', owner: 'Q23', clause: 'CK-23', reason: 'a rule check' }
    expect(problems(a.map, a.w)).toEqual(['flag 04-F06: on the pinned cpa-judgment list but not a cpa-judgment row'])
    const b = tiny()
    b.map.flags['04-F06'] = { kind: 'cpa-judgment', owner: 'Q00', clause: 'CK-1', reason: 'a person decides' }
    expect(problems(b.map, b.w)).toEqual([
      'flag 04-F06: a cpa-judgment row is owned by X00 (found Q00)',
      'flag 04-F06: a cpa-judgment row has clause none (found CK-1)',
    ])
  })

  test('AI-12 R2 01-F02 nets to a debit of $13,211.58 on GIFI 1301, the amount its detail states', () => {
    expect(realFlag('01-F02').shareholderNetCents).toBe(1_321_158)
    expect(realFlag('01-F05').shareholderNetCents).toBe(-178_842)
  })
  test('AI-12 R2 a credit-side question on a flag that nets to a debit is caught: 01-F02 to Q-SHL-002', () => {
    const { map, w } = tiny()
    map.flags['01-F02'] = { questions: ['Q-SHL-002'] }
    expect(problems(map, w)).toEqual([
      'flag 01-F02: question Q-SHL-002 sits on the credit side; the flag nets to a debit on GIFI 1301, 2781 or 3261',
    ])
  })
  test('AI-12 R2 a flag that nets to a debit takes only a question listed as debit side', () => {
    const { map, w } = tiny()
    map.flags['01-F02'] = { questions: ['Q-CRA-003'] }
    expect(problems(map, w)).toEqual([
      'flag 01-F02: question Q-CRA-003 is not listed as debit side; the flag nets to a debit on GIFI 1301, 2781 or 3261',
    ])
    w.debitSide = new Set(['Q-CRA-003'])
    expect(problems(map, w)).toEqual([])
  })
  test('AI-12 R2 on the round 1 rows (5e8f0643) the side rule fails 01-F02, 01-F04 and 02-F02 and passes the credit-side five', () => {
    const round1: Record<string, string[]> = {
      '01-F02': ['Q-SHL-001', 'Q-SHL-002'],
      '01-F04': ['Q-SHL-002'],
      '02-F02': ['Q-EXP-001'],
      '01-F05': ['Q-EXP-001'],
      '07-F04': ['Q-SHL-002'],
      '08-F06': ['Q-EXP-001'],
      '09-F03': ['Q-SHL-002'],
      '14-F08': ['Q-SHL-001', 'Q-SHL-002'],
    }
    const w: World = { ...world, flags: Object.keys(round1).map(realFlag) }
    const map: CoverageMap = { version: 1, flags: Object.fromEntries(Object.entries(round1).map(([id, questions]) => [id, { questions }])) }
    const caught = [...new Set(problems(map, w).filter((l) => l.includes('credit side')).map((l) => l.slice(5, 11)))]
    expect(caught).toEqual(['01-F02', '01-F04', '02-F02'])
  })

  test('AI-12 R3 a row of yes/no openers on a flag with books rows is caught: 03-F03 to Q-PAY-001', () => {
    expect(realItem('Q-PAY-001').opener).toBe(true)
    const { map, w } = tiny()
    map.flags['03-F03'] = { questions: ['Q-PAY-001'] }
    expect(problems(map, w)).toEqual(['flag 03-F03: only yes/no openers, which cannot cover a flag with judgement or books rows'])
  })
  test('AI-12 R3 the pinned client list 01-F05 stands on its yes/no opener; unpinned, it is caught', () => {
    const { map, w } = tiny()
    expect(problems(map, w)).toEqual([])
    w.openerPinned = new Set(['08-F06'])
    expect(problems(map, w)).toEqual(['flag 01-F05: only yes/no openers, which cannot cover a flag with judgement or books rows'])
  })
  test('AI-12 R3 an opener beside an item with a slot is not only openers', () => {
    const { map, w } = tiny()
    map.flags['03-F03'] = { questions: ['Q-PAY-001', 'Q-EXP-004'] }
    expect(problems(map, w)).toEqual([])
  })
  test('AI-12 R3 on the round 1 rows (5e8f0643) the opener rule catches 13 rows besides the two pins', () => {
    const round1: Record<string, string[]> = {
      '01-F05': ['Q-EXP-001'],
      '08-F06': ['Q-EXP-001'],
      '02-F02': ['Q-EXP-001'],
      '02-F03': ['Q-CRA-006'],
      '03-F01': ['Q-PAY-002'],
      '03-F03': ['Q-PAY-001'],
      '04-F03': ['Q-PAY-001'],
      '06-F03': ['Q-REV-003'],
      '08-F04': ['Q-PAY-001'],
      '08-F05': ['Q-REV-003'],
      '09-F05': ['Q-CRA-001'],
      '10-F05': ['Q-PAY-001'],
      '11-F02': ['Q-PAY-001'],
      '13-F04': ['Q-CRA-001'],
      '13-F06': ['Q-PAY-001'],
    }
    const w: World = { ...world, flags: Object.keys(round1).map(realFlag), cpaPinned: new Set() }
    const map: CoverageMap = { version: 1, flags: Object.fromEntries(Object.entries(round1).map(([id, questions]) => [id, { questions }])) }
    const caught = problems(map, w).filter((l) => l.includes('yes/no openers')).map((l) => l.slice(5, 11))
    expect(caught).toHaveLength(13)
    expect(caught).not.toContain('01-F05')
    expect(caught).not.toContain('08-F06')
  })

  test('AI-12 R6 a bank label that drops its catalogue side words is caught: Q-SHL-002 as built', () => {
    expect(catalogue.get('qa.shareholder.loan_balance')).toBe('Due to shareholders at year end, as stated')
    const asBuilt: Item = { ...realItem('Q-SHL-002'), label: 'Shareholder loan balance at year end' }
    expect(labelProblems([asBuilt], catalogue)).toEqual([
      'item Q-SHL-002: label "Shareholder loan balance at year end" drops "due to" from its catalogue label "Due to shareholders at year end, as stated"',
    ])
  })
  test('AI-12 R6 the relabels pass, "personal" is matched whole, and an item off the catalogue is caught', () => {
    const relabelled: Item[] = [
      { ...realItem('Q-SHL-002'), label: 'Due to shareholders at year end' },
      { ...realItem('Q-EXP-004'), label: 'Home costs paid personally' },
      { ...realItem('Q-EXP-001'), label: 'Business items on a personal card' },
    ]
    expect(labelProblems(relabelled, catalogue)).toEqual([])
    const homeAsBuilt: Item = { ...realItem('Q-EXP-004'), label: 'Total home costs for the year' }
    expect(labelProblems([homeAsBuilt], catalogue)).toEqual([
      'item Q-EXP-004: label "Total home costs for the year" drops "personally", "paid" from its catalogue label "Home costs paid personally"',
    ])
    const lost: Item = { ...realItem('Q-EXP-001'), resolves: 'qa.test.nowhere' }
    expect(labelProblems([lost], catalogue)).toEqual(['item Q-EXP-001: resolves qa.test.nowhere, which is not in the catalogue'])
  })
})

/** A499: the 39 pinned rows, each the full row from the directive's table. */
const check = (owner: string, clause: string): Entry => ({ kind: 'check', owner, clause })
const cpa: Entry = { kind: 'cpa-judgment', owner: 'X00', clause: 'none' }
const PINS: [string, Entry][] = [
  ['01-F02', check('Q30', 'CK-30')],
  ['01-F04', check('Q32', 'CK-32')],
  ['02-F02', check('I22', 'AI-2')],
  ['04-F02', check('Q20', 'CK-20')],
  ['06-F02', check('Q20', 'CK-20')],
  ['06-F06', check('Q20', 'CK-20')],
  ['10-F07', check('Q15', 'CK-15')],
  ['02-F03', check('Q13', 'CK-13')],
  ['03-F03', check('Q23', 'CK-23')],
  ['04-F03', check('Q23', 'CK-23')],
  ['06-F03', check('B05', 'TB-2')],
  ['08-F04', check('Q23', 'CK-23')],
  ['08-F05', check('Q20', 'CK-20')],
  ['11-F02', check('Q23', 'CK-23')],
  ['13-F06', check('Q23', 'CK-23')],
  ['09-F05', cpa],
  ['10-F05', cpa],
  ['10-F06', { questions: ['Q-EXP-003', 'Q-EXP-006', 'Q-EXP-007', 'Q-VHO-001'] }],
  ['02-F06', check('Q23', 'CK-23')],
  ['06-F01', check('Q19', 'CK-19')],
  ['10-F04', check('I22', 'AI-2')],
  ['14-F01', check('X01', 'CK-40')],
  ['14-F04', check('F07', 'END-1')],
  ['14-F05', cpa],
  ['15-F01', check('X01', 'CK-40')],
  ['15-F04', check('F07', 'END-1')],
  ['15-F05', cpa],
  ['01-F03', check('Q31', 'CK-31')],
  ['03-F01', check('Q47', 'CK-47')],
  ['04-F06', cpa],
  ['05-F05', check('I19', 'AI-2')],
  ['07-F05', check('B05', 'TB-2')],
  ['12-F03', check('G00', 'AI-12')],
  ['12-F04', check('G00', 'AI-12')],
  ['12-F05', check('G00', 'AI-12')],
  ['13-F04', cpa],
  ['14-F03', check('F07', 'END-1')],
  ['15-F03', check('F07', 'END-1')],
  ['15-F08', { questions: ['Q-SHL-001', 'Q-SHL-002'] }],
]

/** The row without its free-text reason, questions sorted, so a pin compares the table's fields only. */
function rowOf(e: Entry | undefined): Entry | undefined {
  if (e === undefined) return undefined
  const row: Entry = { ...e }
  delete row.reason
  return row.questions === undefined ? row : { ...row, questions: [...row.questions].sort() }
}

describe('G18 the real map covers every sample flag', () => {
  test('END-7 the world reads: 15 answer keys, flags in each, banks with live items, the card list', () => {
    expect(world.flags.length).toBe(105)
    expect(new Set(world.flags.map((f) => f.id.slice(0, 2))).size).toBe(15)
    expect(world.items.size).toBeGreaterThan(30)
    expect(world.cards.size).toBeGreaterThan(100)
    expect(world.flags.filter((f) => f.shareholderNetCents > 0).length).toBeGreaterThan(0)
  })
  test('END-7 data/question-coverage.json exists, is version 1 and sits outside the bank folder', () => {
    expect(fs.existsSync(path.join(ROOT, 'data', 'question-coverage.json'))).toBe(true)
    expect(realMap().version).toBe(1)
    expect(fs.existsSync(path.join(ROOT, 'data', 'question-bank', 'question-coverage.json'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'data', 'question-bank', 'coverage.json'))).toBe(false)
  })
  test('END-7 every flag id in every answer key is mapped, every mapped question exists, no stale ids, every rule holds', () => {
    expect(problems(realMap(), world)).toEqual([])
  })
  test('AI-12 R1 every reason row is owned by a live card that lists its clause; cpa-judgment only on the pinned list', () => {
    const lines = problems(realMap(), world).filter((l) => /owner|cpa-judgment|an entry is/.test(l))
    expect(lines).toEqual([])
  })
  test('AI-12 R2 no credit-side question covers a flag that nets to a debit on the shareholder accounts', () => {
    expect(problems(realMap(), world).filter((l) => l.includes('debit side') || l.includes('credit side'))).toEqual([])
  })
  test('AI-12 R3 no row of yes/no openers covers a flag with judgement or books rows, but the pinned two', () => {
    expect(problems(realMap(), world).filter((l) => l.includes('yes/no openers'))).toEqual([])
  })
  test('AI-12 R6 every live bank label keeps its catalogue label side words', () => {
    const live = [...world.items.values()].filter((i) => !i.retired)
    expect(live.length).toBeGreaterThan(30)
    expect(labelProblems(live, catalogue)).toEqual([])
  })
  test('RULE-19 every "must fire" flag that is a question maps to at least one live question', () => {
    const map = realMap()
    const mustFire = world.flags.filter((x) => x.severity === 'must fire')
    expect(mustFire.length).toBeGreaterThan(0)
    for (const f of mustFire) {
      const e = map.flags[f.id]
      expect(e, `flag ${f.id}`).toBeDefined()
      if (e?.questions !== undefined) expect(e.questions.length, `flag ${f.id}`).toBeGreaterThan(0)
    }
  })
  test('AI-12 the pin table holds 39 distinct flags, every one in a sample answer key', () => {
    expect(new Set(PINS.map(([id]) => id)).size).toBe(39)
    for (const [id] of PINS) expect(realFlag(id).id).toBe(id)
  })
  test.each(PINS)('AI-12 pin %s is the directive row %j (Review 3 Oct finding 7; A499)', (id, row) => {
    expect(rowOf(realMap().flags[id])).toEqual(rowOf(row))
  })
  test('RULE-19 the map holds no client sentence: only ids, kinds, clauses and short reasons', () => {
    const map = realMap()
    const entries = Object.entries(map.flags)
    expect(entries.length).toBeGreaterThan(0)
    for (const [id, e] of entries) {
      for (const q of e.questions ?? []) expect(q, id).toMatch(/^Q-[A-Z]+-\d{3}$/)
      if (e.clause !== undefined) expect(e.clause, id).toMatch(/^([A-Z]+-\d+|none)$/)
      if (e.reason !== undefined) expect(e.reason.length, id).toBeLessThanOrEqual(160)
    }
  })
})
