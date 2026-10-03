// B04 acceptance tests: the API client keeps to Intuit's published limits (ARC-20), check 7. Spec-writer's file;
// builders never edit it. Every request goes to the local fake API (api/__fixtures__/fake-api.ts), stamped with the
// test's manual clock, which moves only when the client sleeps on the injected `sleep` (or the test moves it). A client
// that waits on real time instead times the test out; a client that never paces sends many requests at one instant.
//
// Spec choices (amber): "three 429s in a row end in a refusal" and "retries at most 3 times" are read together as
// "the client gives up after its third or fourth 429 in a row", so 3 or 4 requests to the company host are accepted
// before the refusal; every gap between them is at least 60 seconds on the clock. Pacing is measured over requests to
// the company host (https://sandbox-quickbooks.api.intuit.com); the OAuth token exchange is not counted.
import { describe, expect, test } from 'vitest'
import { createQboReader } from '../index'
import { REALM, YEAR_END, failure, manualClock, sandboxEnv } from '../__fixtures__/harness'
import { SANDBOX_HOST, createFakeQboApi, type Recorded } from './__fixtures__/fake-api'

const AT = '2026-10-01T12:00:00-04:00'
const WAIT = 60_000

function setUp(throttle = 0) {
  const mc = manualClock(AT)
  const fake = createFakeQboApi({ now: mc.now, throttle })
  const reader = createQboReader({ env: sandboxEnv(), transport: fake.transport, clock: mc.clock, sleep: mc.sleep })
  const company = (): Recorded[] => fake.requests.filter((r) => r.url.startsWith(SANDBOX_HOST))
  return { mc, reader, company }
}

/** The most requests found in any window of `ms` milliseconds (window [at, at + ms)). */
function busiest(requests: Recorded[], ms: number): number {
  let most = 0
  for (const r of requests) {
    const n = requests.filter((q) => q.at >= r.at && q.at < r.at + ms).length
    most = Math.max(most, n)
  }
  return most
}

describe('B04 the API client and a 429 (ARC-20)', () => {
  test('ARC-20 a 429 makes the client wait 60 seconds on the pinned clock and retry, and the read then succeeds', async () => {
    const { mc, reader, company } = setUp(1)
    const tb = await reader.trialBalance(REALM, YEAR_END, 'accrual')
    expect(tb.length).toBeGreaterThan(0)
    const reqs = company()
    const first429 = reqs.findIndex((r) => r.status === 429)
    expect(first429).toBeGreaterThanOrEqual(0)
    const retry = reqs[first429 + 1]
    expect(retry, 'a retry after the 429').toBeDefined()
    expect((retry?.at ?? 0) - (reqs[first429]?.at ?? 0)).toBeGreaterThanOrEqual(WAIT)
    expect(mc.sleeps).toContain(WAIT)
    expect(reqs.at(-1)?.status).toBe(200)
  })

  test('ARC-20 two 429s in a row are each waited out for 60 seconds, then the read succeeds', async () => {
    const { mc, reader, company } = setUp(2)
    const tb = await reader.trialBalance(REALM, YEAR_END, 'accrual')
    expect(tb.length).toBeGreaterThan(0)
    const reqs = company()
    expect(reqs.slice(0, 3).map((r) => r.status)).toEqual([429, 429, 200])
    expect((reqs[1]?.at ?? 0) - (reqs[0]?.at ?? 0)).toBeGreaterThanOrEqual(WAIT)
    expect((reqs[2]?.at ?? 0) - (reqs[1]?.at ?? 0)).toBeGreaterThanOrEqual(WAIT)
    expect(mc.sleeps.filter((s) => s >= WAIT).length).toBeGreaterThanOrEqual(2)
  })

  test('ARC-20 planted: 429s that never stop end in a refusal with the reason, after 3 or 4 tries spaced 60 seconds apart', async () => {
    const { reader, company } = setUp(Number.POSITIVE_INFINITY)
    const e = await failure(() => reader.trialBalance(REALM, YEAR_END, 'accrual'))
    expect(e, 'the read is refused').toBeInstanceOf(Error)
    expect(e?.message).toMatch(/429|rate limit/i)
    const reqs = company()
    expect(reqs.every((r) => r.status === 429)).toBe(true)
    expect(reqs.length).toBeGreaterThanOrEqual(3)
    expect(reqs.length).toBeLessThanOrEqual(4)
    for (let i = 1; i < reqs.length; i++) expect((reqs[i]?.at ?? 0) - (reqs[i - 1]?.at ?? 0), `gap ${String(i)}`).toBeGreaterThanOrEqual(WAIT)
  })

  test('ARC-20 the refusal stops the client: no further request after it gives up', async () => {
    const { reader, company } = setUp(Number.POSITIVE_INFINITY)
    await failure(() => reader.trialBalance(REALM, YEAR_END, 'accrual'))
    const n = company().length
    await Promise.resolve()
    expect(company()).toHaveLength(n)
  })
})

describe('B04 the API client paces its requests (ARC-20)', () => {
  test('ARC-20 25 reads one after another send no more than 10 requests in any one second', async () => {
    const { reader, company } = setUp()
    for (let i = 0; i < 25; i++) await reader.trialBalance(REALM, YEAR_END, 'accrual')
    expect(company().length).toBeGreaterThanOrEqual(25)
    expect(busiest(company(), 1000)).toBeLessThanOrEqual(10)
  })

  test('ARC-20 25 reads started at once send no more than 10 requests in any one second', async () => {
    const { reader, company } = setUp()
    const all = await Promise.all(Array.from({ length: 25 }, () => reader.trialBalance(REALM, YEAR_END, 'accrual')))
    expect(all).toHaveLength(25)
    expect(company().length).toBeGreaterThanOrEqual(25)
    expect(busiest(company(), 1000)).toBeLessThanOrEqual(10)
  })

  test('ARC-20 600 reads send no more than 500 requests to the company in any one minute', async () => {
    const { reader, company } = setUp()
    for (let i = 0; i < 600; i++) await reader.trialBalance(REALM, YEAR_END, 'accrual')
    expect(company().length).toBeGreaterThanOrEqual(600)
    expect(busiest(company(), 60_000)).toBeLessThanOrEqual(500)
    expect(busiest(company(), 1000)).toBeLessThanOrEqual(10)
  }, 60_000)
})
