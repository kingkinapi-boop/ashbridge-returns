// GL3 round 4 acceptance tests, the unit side (spec-writer; builders never edit this file). Card plan/cards/GL3.md,
// Lead directive A498: S1 (every section 3 item, marker ids included), the pure part of S3 (probeReach's diff, the
// twin of reach.acceptance.db.test.ts for mutation testing, A391), the views.json lines of B1 and B2, and S6 (README).
// Its second patch A506: G1's key forms through reachDiff, G2's text twin over 0001_bridge_views.sql (every view
// with security_barrier, every union inside a subquery), and G4 (the README's B6 items; "nothing else" gone from 0002).
//
// The shapes these tests fix (the builder matches them; amber, listed in the spec report):
// - NEVER_READ gains markerIds: readonly string[], the contract's marker answer ids (section 3, line 70).
// - src/modules/golive/bridge/index.ts exports, beside the round 1 exports:
//     probeReach(db: Pick<PGlite, 'query'>, role: string): Promise<string[]>
//         the role's reach in the key forms at the top of reach.acceptance.db.test.ts, each once, in plain string
//         order; select statements on the catalog only
//     reachDiff(reach: readonly string[], allowed: readonly string[]): { extra: string[]; missing: string[] }
//         (scan.ts, @mutate) extra: each reach key not in allowed, and every key ending " security definer" even
//         when allowed (a reachable definer function always fails), in reach order; missing: each allowed key not
//         in reach, in allowed order
// - views.json: bridge.answer's answer_verbatim lists answers.question_asked (M0006:41) as its second source;
//   bridge.document's alsoReads lists answers.question_asked.
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import * as bridge from './index'
import { NEVER_READ } from './index'
import { neverReadItems } from './__fixtures__/contract'
import { DRAFT_DIR, manifest } from './__fixtures__/views-manifest'

const SEED = 20261003

type ReachDiff = (reach: readonly string[], allowed: readonly string[]) => { extra: string[]; missing: string[] }

/** The export the card names (B5); a clear failure until the build adds it. */
function reachDiff(reach: readonly string[], allowed: readonly string[]): { extra: string[]; missing: string[] } {
  const f = (bridge as unknown as { reachDiff?: unknown }).reachDiff
  if (typeof f !== 'function') throw new Error('src/modules/golive/bridge/index.ts does not export reachDiff(reach, allowed) (GL3 B5)')
  return (f as ReachDiff)(reach, allowed)
}

function viewOf(name: string): ReturnType<typeof manifest>['views'][number] {
  const v = manifest().views.find((x) => x.name === name)
  if (v === undefined) throw new Error(`views.json has no view ${name}`)
  return v
}

describe('GL3 round 4: every section 3 item (A498 S1; ARC-2)', () => {
  test('ARC-2 NEVER_READ holds every item of contract section 3: the table, the 15 pairs and the five marker ids', () => {
    const items = neverReadItems()
    expect(items.tables).toEqual(['restricted_data'])
    expect(items.pairs).toHaveLength(15)
    expect(items.markerIds).toHaveLength(5)
    expect([...NEVER_READ.tables].sort()).toEqual([...items.tables].sort())
    for (const p of items.pairs) expect(NEVER_READ.columns, `${p.table}.${p.column}`).toContainEqual(p)
    expect(NEVER_READ.columns).toHaveLength(items.pairs.length)
    const markers = (NEVER_READ as typeof NEVER_READ & { markerIds?: readonly string[] }).markerIds
    expect(markers, 'NEVER_READ.markerIds').toBeDefined()
    expect([...(markers ?? [])].sort()).toEqual([...items.markerIds].sort())
  })

  test("ARC-2 views.json: bridge.answer's answer_verbatim reads answers.question_asked as its second source, and bridge.document reads it too (the marker mask)", () => {
    const answer = viewOf('answer').columns.find((c) => c.name === 'answer_verbatim')
    expect(answer?.sources).toEqual([
      { source: 'answers.answer_verbatim', cite: 'M0006:42' },
      { source: 'answers.question_asked', cite: 'M0006:41' },
    ])
    expect(viewOf('document').alsoReads).toContainEqual({ source: 'answers.question_asked', cite: 'M0006:41' })
  })
})

describe("GL3 round 4: probeReach's pure diff (A498 S3, B5; ARC-2)", () => {
  test('ARC-2 reachDiff names each right beyond the allow-list and each allowed right not reached, in their own orders', () => {
    const allowed = ['usage on schema bridge', 'select on bridge.client', 'select on bridge.flag']
    expect(reachDiff(['usage on schema bridge', 'select on bridge.client', 'select on bridge.flag'], allowed)).toEqual({ extra: [], missing: [] })
    expect(reachDiff(['select on bridge.flag', 'insert on public.people', 'usage on schema bridge', 'member of client_app_reader'], allowed)).toEqual({
      extra: ['insert on public.people', 'member of client_app_reader'],
      missing: ['select on bridge.client'],
    })
    expect(reachDiff([], allowed)).toEqual({ extra: [], missing: allowed })
    expect(reachDiff(allowed, [])).toEqual({ extra: allowed, missing: [] })
  })

  test('ARC-2 rule: a reachable security definer function is always extra, even when the allow-list names it', () => {
    const definer = 'execute on public.gl3_planted_definer() security definer'
    expect(reachDiff(['usage on schema bridge', definer], ['usage on schema bridge', definer])).toEqual({ extra: [definer], missing: [] })
    expect(reachDiff([definer], [])).toEqual({ extra: [definer], missing: [] })
    expect(reachDiff(['execute on public.f()'], ['execute on public.f()'])).toEqual({ extra: [], missing: [] })
    expect(reachDiff(['execute on public.security_definer_log()'], ['execute on public.security_definer_log()'])).toEqual({ extra: [], missing: [] })
  })

  test('ARC-2 property (fixed seed): reachDiff is exactly the set differences, definer rights always extra, orders kept', () => {
    const key = fc.constantFrom(
      'usage on schema bridge',
      'select on bridge.client',
      'select (status) on returns.client_handoff',
      'insert on public.people',
      'member of client_app_reader',
      'execute on public.f()',
      'execute on public.g() security definer',
    )
    fc.assert(
      fc.property(fc.uniqueArray(key), fc.uniqueArray(key), (reach, allowed) => {
        expect(reachDiff(reach, allowed)).toEqual({
          extra: reach.filter((k) => !allowed.includes(k) || k.endsWith(' security definer')),
          missing: allowed.filter((k) => !reach.includes(k)),
        })
      }),
      { seed: SEED, numRuns: 300 },
    )
  })
})

describe('GL3 round 4: the README for the client repo (A498 S6; LIVE-6)', () => {
  test('LIVE-6 db/bridge/README.md names probeReach and the one-transaction apply, and no longer says "nothing else"', () => {
    const readme = fs.readFileSync(path.join(DRAFT_DIR, 'README.md'), 'utf8')
    expect(readme).toContain('probeReach')
    expect(readme).toMatch(/one transaction/i)
    expect(readme).not.toMatch(/nothing else/i)
  })
})

describe("GL3 round 4 patch: reachDiff over every key form (A506 G1; the unit twin of the planted forms)", () => {
  test('ARC-2 reachDiff names every key form planted on gl3_nobody as extra against an empty allow-list, and none against a list that holds them', () => {
    const forms = [
      'usage on schema gl3_planted',
      'create on schema gl3_planted',
      ...['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'].map((p) => `${p} on public.people`),
      ...['select', 'insert', 'update', 'references'].map((p) => `${p} (filename) on public.documents`),
      ...['usage', 'select', 'update'].map((p) => `${p} on public.gl3_planted_seq`),
      'execute on public.gl3_planted_fn(a integer, b text)',
      'member of gl3_planted_group',
    ]
    expect(reachDiff(forms, [])).toEqual({ extra: forms, missing: [] })
    expect(reachDiff(forms, forms)).toEqual({ extra: [], missing: [] })
    expect(reachDiff([], forms)).toEqual({ extra: [], missing: forms })
  })
})

/** The SQL text with comments blanked, each create view statement on schema bridge, by name. */
function bridgeViewStatements(sql: string): { name: string; text: string }[] {
  const clean = sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
  const statements: string[] = []
  let depth = 0
  let quoted = false
  let start = 0
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]
    if (ch === "'") quoted = !quoted
    else if (!quoted && ch === '(') depth += 1
    else if (!quoted && ch === ')') depth -= 1
    else if (!quoted && depth === 0 && ch === ';') {
      statements.push(clean.slice(start, i))
      start = i + 1
    }
  }
  statements.push(clean.slice(start))
  const out: { name: string; text: string }[] = []
  for (const st of statements) {
    const m = /^\s*create\s+(?:or\s+replace\s+)?view\s+bridge\.([a-z0-9_]+)/i.exec(st)
    if (m?.[1] !== undefined) out.push({ name: m[1], text: st })
  }
  return out
}

/** G2's text rule: every bridge view has security_barrier (in its with clause or a later alter view), and no union sits outside a subquery. */
function viewTextProblems(sql: string): string[] {
  const clean = sql.replace(/--[^\n]*/g, ' ')
  const out: string[] = []
  for (const v of bridgeViewStatements(sql)) {
    const barrier = /^\s*create\s+(?:or\s+replace\s+)?view\s+bridge\.[a-z0-9_]+\s+with\s*\(\s*security_barrier(\s*=\s*(true|on))?\s*\)/i.test(v.text)
      || new RegExp(`alter\\s+view\\s+bridge\\.${v.name}\\s+set\\s*\\(\\s*security_barrier(\\s*=\\s*(true|on))?\\s*\\)`, 'i').test(clean)
    if (!barrier) out.push(`bridge.${v.name} has no security_barrier`)
    let depth = 0
    let quoted = false
    let outside = ''
    for (const ch of v.text) {
      if (ch === "'") quoted = !quoted
      else if (!quoted && ch === '(') depth += 1
      else if (!quoted && ch === ')') depth -= 1
      else if (!quoted && depth === 0) outside += ch
    }
    if (/\bunion\b/i.test(outside)) out.push(`bridge.${v.name} has a union outside a subquery`)
  }
  return out
}

describe('GL3 round 4 patch: every bridge view holds its own filters (A506 G2, card B2; the unit twin of the plan shape)', () => {
  test('ARC-2 0001_bridge_views.sql creates every view of views.json with security_barrier, each union view wrapped in a subquery', () => {
    const sql = fs.readFileSync(path.join(DRAFT_DIR, '0001_bridge_views.sql'), 'utf8')
    const names = bridgeViewStatements(sql).map((v) => v.name).sort()
    expect(names).toEqual(manifest().views.map((v) => v.name).sort())
    expect(viewTextProblems(sql)).toEqual([])
  })

  test('ARC-2 rule: planted after the draft views, a union view with only a barrier and a view with no barrier are each caught by name; a wrapped union with a barrier passes; the draft views add nothing', () => {
    const planted = [
      "create view bridge.p_union with (security_barrier) as select 1 as a where 'x;(' = 'y' union all select 2;",
      '-- a comment: union all',
      'create view bridge.p_plain as select a.id from public.answers a;',
      'create view bridge.p_wrapped with (security_barrier = true) as select * from (select 1 as a union all select 2) u;',
      'create view bridge.p_altered as select 1 as a;',
      'alter view bridge.p_altered set (security_barrier);',
    ].join('\n')
    expect(bridgeViewStatements(planted).map((v) => v.name)).toEqual(['p_union', 'p_plain', 'p_wrapped', 'p_altered'])
    const sql = `${fs.readFileSync(path.join(DRAFT_DIR, '0001_bridge_views.sql'), 'utf8')}\n${planted}\n`
    expect(viewTextProblems(sql)).toEqual(['bridge.p_union has a union outside a subquery', 'bridge.p_plain has no security_barrier'])
  })
})

describe('GL3 round 4 patch: the README for the client repo, every B6 item (A506 G4; LIVE-6)', () => {
  const readme = (): string => fs.readFileSync(path.join(DRAFT_DIR, 'README.md'), 'utf8')
  /** The README's sentences, whitespace folded, so a sentence wrapped over lines reads as one. */
  const sentences = (): string[] => readme().replace(/\s+/g, ' ').split(/(?<=[.;:])\s+/)
  const someSentence = (...words: RegExp[]): boolean => sentences().some((s) => words.every((w) => w.test(s)))

  test('LIVE-6 db/bridge/README.md says the draft goes in as one migration, and that every bridge view has security_barrier', () => {
    expect(readme()).toMatch(/one migration/i)
    expect(readme()).toContain('security_barrier')
  })

  test("LIVE-6 db/bridge/README.md names the marker mask: marker answers read as 'given', citing contract line 70", () => {
    expect(someSentence(/marker/i, /\bgiven\b/)).toBe(true)
    expect(readme()).toMatch(/line 70\b/)
  })

  test("LIVE-6 db/bridge/README.md gives the security definer guidance (a definer function probeReach lists is the client repo's Lead's call) and never a blanket PUBLIC revoke", () => {
    expect(readme()).toContain('probeReach')
    expect(someSentence(/\bdefiner\b/i, /\bLead\b/)).toBe(true)
    expect(someSentence(/\bnever\b/i, /\bblanket\b/i, /\bpublic\b/i, /\brevoke\b/i)).toBe(true)
  })

  test('LIVE-6 db/bridge/README.md states the wrapped-union rule: a union view is wrapped in a subquery', () => {
    expect(someSentence(/\bunion\b/i, /\bsubquery\b/i)).toBe(true)
  })

  test('LIVE-6 0002_grants.sql no longer says "nothing else" in any comment', () => {
    const sql = fs.readFileSync(path.join(DRAFT_DIR, '0002_grants.sql'), 'utf8')
    expect(sql.length).toBeGreaterThan(0)
    expect(sql).not.toMatch(/nothing else/i)
  })
})
