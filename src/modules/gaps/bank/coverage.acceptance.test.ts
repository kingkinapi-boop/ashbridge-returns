// Spec for card G18 (question banks: every sample flag mapped). Choices the card leaves open (amber, in the spec report):
//  - The map is `data/question-coverage.json`: `{ "version": 1, "flags": { "<flag id>": <entry> } }`, where an entry is
//    `{ "questions": ["Q-..."] }` (at least one live bank item) or `{ "kind": "check" | "cpa-judgment", "reason": "<why>",
//    "owner": "<card id>" }` (not a question). An entry has one of the two shapes and nothing else.
//  - The owner is an open card (status todo or carded) that has a card file (A467 rule).
//  - The rule is a pure function in this file, so the plants run on in-memory maps and the real map is checked the same way.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const read = (...p: string[]): unknown => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'))

type Flag = { id: string; severity: string }
type Entry = { questions?: string[]; kind?: string; reason?: string; owner?: string }
type CoverageMap = { version: number; flags: Record<string, Entry> }
type World = { flags: Flag[]; questionIds: Set<string>; retiredIds: Set<string>; openCards: Set<string> }

const KINDS = new Set(['check', 'cpa-judgment'])

/** The rule: every problem found, as one line each, so a plant can name the line it expects. */
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
    const asReason = keys === 'kind,owner,reason'
    if (!asQuestion && !asReason) {
      out.push(`flag ${f.id}: an entry is { questions } or { kind, reason, owner } and nothing else (found ${keys})`)
      continue
    }
    if (asQuestion) {
      const qs = e.questions ?? []
      if (qs.length === 0) out.push(`flag ${f.id}: maps to no question`)
      for (const q of qs) {
        if (!w.questionIds.has(q)) out.push(`flag ${f.id}: question ${q} is in no bank`)
        else if (w.retiredIds.has(q)) out.push(`flag ${f.id}: question ${q} is retired`)
      }
    } else {
      if (!KINDS.has(e.kind ?? '')) out.push(`flag ${f.id}: kind ${String(e.kind)} is not check or cpa-judgment`)
      if ((e.reason ?? '').trim() === '') out.push(`flag ${f.id}: the reason is empty`)
      if (!w.openCards.has(e.owner ?? '')) out.push(`flag ${f.id}: the owner ${String(e.owner)} is not an open card with a card file`)
    }
  }
  for (const id of Object.keys(map.flags)) if (!ids.has(id)) out.push(`stale id ${id}: in no sample answer key`)
  return out
}

function loadWorld(): World {
  const flags: Flag[] = []
  const clientsDir = path.join(ROOT, 'reference', 'sample-clients')
  for (const d of fs.readdirSync(clientsDir).sort()) {
    const key = path.join(clientsDir, d, 'answer-key.json')
    if (!fs.existsSync(key)) continue
    const parsed = JSON.parse(fs.readFileSync(key, 'utf8')) as { flags?: Flag[] }
    flags.push(...(parsed.flags ?? []))
  }
  const questionIds = new Set<string>()
  const retiredIds = new Set<string>()
  const bankDir = path.join(ROOT, 'data', 'question-bank')
  for (const f of fs.readdirSync(bankDir).sort()) {
    if (!f.endsWith('.json') || f === '_schema.json') continue
    const bank = JSON.parse(fs.readFileSync(path.join(bankDir, f), 'utf8')) as { items: { id: string; retired: boolean }[] }
    for (const i of bank.items) {
      questionIds.add(i.id)
      if (i.retired) retiredIds.add(i.id)
    }
  }
  const slices = read('plan', 'slices.json') as { cards: { id: string; status: string; family?: string }[] }
  const openCards = new Set(
    slices.cards
      .filter((c) => (c.status === 'todo' || c.status === 'carded') && fs.existsSync(path.join(ROOT, 'plan', 'cards', `${c.id}.md`)))
      .map((c) => c.id),
  )
  return { flags, questionIds, retiredIds, openCards }
}

const world = loadWorld()
const realMap = (): CoverageMap => read('data', 'question-coverage.json') as CoverageMap

/** A small world and a good map, for the plants. */
function tiny(): { map: CoverageMap; w: World } {
  const w: World = {
    flags: [
      { id: 'T-F01', severity: 'must fire' },
      { id: 'T-F02', severity: 'must fire' },
    ],
    questionIds: new Set(['Q-AAA-001', 'Q-AAA-002']),
    retiredIds: new Set(['Q-AAA-002']),
    openCards: new Set(['G99']),
  }
  const map: CoverageMap = {
    version: 1,
    flags: {
      'T-F01': { questions: ['Q-AAA-001'] },
      'T-F02': { kind: 'check', reason: 'a rule check, not a question', owner: 'G99' },
    },
  }
  return { map, w }
}

describe('G18 the map rule catches its plants', () => {
  test('RULE-19 a good small map has no problems', () => {
    const { map, w } = tiny()
    expect(problems(map, w)).toEqual([])
  })
  test('END-7 an unmapped flag is caught', () => {
    const { map, w } = tiny()
    delete map.flags['T-F01']
    expect(problems(map, w)).toEqual(['flag T-F01 is not mapped'])
  })
  test('END-7 a mapping to a question that is in no bank is caught', () => {
    const { map, w } = tiny()
    map.flags['T-F01'] = { questions: ['Q-ZZZ-009'] }
    expect(problems(map, w)).toEqual(['flag T-F01: question Q-ZZZ-009 is in no bank'])
  })
  test('END-7 a mapping to a retired question is caught', () => {
    const { map, w } = tiny()
    map.flags['T-F01'] = { questions: ['Q-AAA-002'] }
    expect(problems(map, w)).toEqual(['flag T-F01: question Q-AAA-002 is retired'])
  })
  test('END-7 an empty question list is caught', () => {
    const { map, w } = tiny()
    map.flags['T-F01'] = { questions: [] }
    expect(problems(map, w)).toEqual(['flag T-F01: maps to no question'])
  })
  test('END-7 a reason whose owner is a done card, a missing card or empty is caught', () => {
    for (const owner of ['A01', 'NOPE', '']) {
      const { map, w } = tiny()
      map.flags['T-F02'] = { kind: 'check', reason: 'a rule check', owner }
      expect(problems(map, w)).toEqual([`flag T-F02: the owner ${owner} is not an open card with a card file`])
    }
  })
  test('END-7 a reason with no text or a made-up kind is caught', () => {
    const { map, w } = tiny()
    map.flags['T-F02'] = { kind: 'hunch', reason: ' ', owner: 'G99' }
    expect(problems(map, w)).toEqual(['flag T-F02: kind hunch is not check or cpa-judgment', 'flag T-F02: the reason is empty'])
  })
  test('END-7 an entry with both shapes, or an unknown field, is caught', () => {
    const { map, w } = tiny()
    map.flags['T-F01'] = { questions: ['Q-AAA-001'], reason: 'also a reason' }
    map.flags['T-F02'] = { kind: 'check', reason: 'r', owner: 'G99', questions: ['Q-AAA-001'] }
    expect(problems(map, w)).toHaveLength(2)
  })
  test('END-7 a stale id, in no answer key, is caught', () => {
    const { map, w } = tiny()
    map.flags['T-F09'] = { questions: ['Q-AAA-001'] }
    expect(problems(map, w)).toEqual(['stale id T-F09: in no sample answer key'])
  })
})

describe('G18 the real map covers every sample flag', () => {
  test('END-7 the world reads: 15 answer keys, flags in each, banks with live items', () => {
    expect(world.flags.length).toBeGreaterThan(100)
    expect(new Set(world.flags.map((f) => f.id.slice(0, 2))).size).toBe(15)
    expect(world.questionIds.size).toBeGreaterThan(30)
  })
  test('END-7 data/question-coverage.json exists, is version 1 and sits outside the bank folder', () => {
    expect(fs.existsSync(path.join(ROOT, 'data', 'question-coverage.json'))).toBe(true)
    expect(realMap().version).toBe(1)
    expect(fs.existsSync(path.join(ROOT, 'data', 'question-bank', 'question-coverage.json'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'data', 'question-bank', 'coverage.json'))).toBe(false)
  })
  test('END-7 every flag id in every answer key is mapped, every mapped question exists, no stale ids', () => {
    expect(problems(realMap(), world)).toEqual([])
  })
  test('RULE-19 every "must fire" flag that is a question maps to at least one live question', () => {
    const map = realMap()
    for (const f of world.flags.filter((x) => x.severity === 'must fire')) {
      const e = map.flags[f.id]
      expect(e, `flag ${f.id}`).toBeDefined()
      if (e?.questions !== undefined) expect(e.questions.length, `flag ${f.id}`).toBeGreaterThan(0)
    }
  })
  test('END-7 the Maple Ridge shareholder loan flags 01-F02 and 01-F04 are covered (Review 3 Oct, finding 7)', () => {
    const map = realMap()
    for (const id of ['01-F02', '01-F04']) expect(map.flags[id], id).toBeDefined()
  })
  test('RULE-19 the map holds no client sentence: only ids, kinds and short reasons', () => {
    const map = realMap()
    for (const [id, e] of Object.entries(map.flags)) {
      for (const q of e.questions ?? []) expect(q, id).toMatch(/^Q-[A-Z]+-\d{3}$/)
      if (e.reason !== undefined) expect(e.reason.length, id).toBeLessThanOrEqual(160)
    }
  })
})
