// JH0 acceptance tests, check 8 (END-9). Spec-writer; builders never edit this file.
// e2e/_harness/kinds.ts holds the logic kinds.spec.ts runs: which journeys, which kinds are not built, and whether the run fails.
import { describe, expect, test } from 'vitest'
import { loadHarness } from './_api'

const TEN = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10']
const ids = Array.from({ length: 13 }, (_, i) => `K${String(i + 1).padStart(2, '0')}`)
const notBuiltAll = ids.map((id) => ({ id, startsFrom: 'new' as const, status: 'not built' as const }))

describe('JH0 kinds run', () => {
  test('END-9 the sample clients are always C01 to C10', async () => {
    const h = await loadHarness()
    expect([...h.kinds.SAMPLE_CLIENTS]).toEqual(TEN)
  })

  test('END-9 with no kind built, the run without the flag passes on the ten sample clients and prints every not-built kind by name', async () => {
    const h = await loadHarness()
    const p = h.kinds.planKindsRun({ requireAll: false, kinds: notBuiltAll })
    expect(p.journeys).toEqual(TEN)
    expect(p.notBuilt).toEqual(ids)
    expect(p.failures).toEqual([])
    expect(p.passed).toBe(true)
    for (const id of ids) expect(p.message).toContain(id)
    expect(p.message).toMatch(/not built/i)
  })

  test('END-9 with --require-all the run fails while any of K01 to K13 is not built, naming each', async () => {
    const h = await loadHarness()
    const p = h.kinds.planKindsRun({ requireAll: true, kinds: notBuiltAll })
    expect(p.passed).toBe(false)
    expect(p.failures.length).toBe(13)
    for (const id of ids) expect(p.failures.join('\n')).toContain(id)
    const one = notBuiltAll.map((k) => (k.id === 'K07' ? { ...k, status: 'built' as const } : k))
    const q = h.kinds.planKindsRun({ requireAll: true, kinds: one })
    expect(q.failures.length).toBe(12)
    expect(q.failures.join('\n')).not.toContain('K07')
  })

  test('END-9 a built kind adds its own journey after the ten sample clients; with every kind built --require-all passes', async () => {
    const h = await loadHarness()
    const some = notBuiltAll.map((k) => (k.id === 'K02' || k.id === 'K08' ? { ...k, status: 'built' as const } : k))
    const p = h.kinds.planKindsRun({ requireAll: false, kinds: some })
    expect(p.journeys).toEqual([...TEN, 'K02', 'K08'])
    expect(p.notBuilt).toEqual(ids.filter((i) => i !== 'K02' && i !== 'K08'))
    const all = ids.map((id) => ({ id, startsFrom: 'new' as const, status: 'built' as const }))
    const done = h.kinds.planKindsRun({ requireAll: true, kinds: all })
    expect(done.journeys).toEqual([...TEN, ...ids])
    expect(done.notBuilt).toEqual([])
    expect(done.passed).toBe(true)
  })

  test('END-9 without a kinds argument the plan reads the real register (W00c): thirteen kinds, none silently skipped', async () => {
    const h = await loadHarness()
    const p = h.kinds.planKindsRun({ requireAll: false })
    expect(p.journeys.slice(0, 10)).toEqual(TEN)
    expect(new Set([...p.journeys.slice(10), ...p.notBuilt])).toEqual(new Set(ids))
    expect(p.journeys.length - 10 + p.notBuilt.length).toBe(13)
  })

  test('END-9 a run that runs zero journeys is a failure', async () => {
    const h = await loadHarness()
    const p = h.kinds.planKindsRun({ requireAll: false, kinds: [], clients: [] } as never)
    expect(p.journeys).toEqual([])
    expect(p.passed).toBe(false)
    expect(p.failures.join('\n')).toMatch(/zero journeys/i)
  })

  test('END-9 --require-all comes from the flag on the command line or JOURNEYS_REQUIRE_ALL=1, and from nothing else', async () => {
    const h = await loadHarness()
    expect(h.kinds.requireAllFrom({}, [])).toBe(false)
    expect(h.kinds.requireAllFrom({}, ['--require-all'])).toBe(true)
    expect(h.kinds.requireAllFrom({ JOURNEYS_REQUIRE_ALL: '1' }, [])).toBe(true)
    expect(h.kinds.requireAllFrom({ JOURNEYS_REQUIRE_ALL: '0' }, [])).toBe(false)
    expect(h.kinds.requireAllFrom({ JOURNEYS_REQUIRE_ALL: '' }, ['--other'])).toBe(false)
    expect(h.kinds.requireAllFrom({ REQUIRE_ALL: '1' }, [])).toBe(false)
  })
})
