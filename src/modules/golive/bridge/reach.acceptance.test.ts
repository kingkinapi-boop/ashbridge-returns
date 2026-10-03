// GL3 round 4 acceptance tests, the unit side (spec-writer; builders never edit this file). Card plan/cards/GL3.md,
// Lead directive A498: S1 (every section 3 item, marker ids included), the pure part of S3 (probeReach's diff, the
// twin of reach.acceptance.db.test.ts for mutation testing, A391), the views.json lines of B1 and B2, and S6 (README).
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
