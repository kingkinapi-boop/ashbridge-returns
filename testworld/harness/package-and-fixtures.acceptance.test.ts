// JH0 acceptance tests, checks 6 and 7 as far as the unit project can see them (ARC-21, ARC-4, END-9, RV-54 hook).
// The browser half is e2e/_harness/smoke.acceptance.spec.ts, which runs in the cloud. Spec-writer; builders never edit this file.
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../../src/core/testing/read-own-source'
import { loadHarness } from './_api'

const pkg = JSON.parse(readOwnSource('package.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string>; dependencies: Record<string, string> }
const exact = (v: string | undefined): boolean => /^\d+\.\d+\.\d+$/.test(v ?? '')

describe('JH0 package.json and fixtures', () => {
  test('END-9 dev:testworld loads a chosen sample client into a local PGlite database and starts the app (F00 placeholder gone)', () => {
    const s = pkg.scripts['dev:testworld'] ?? ''
    expect(s).not.toContain('test world not loaded yet')
    expect(s).toMatch(/e2e\/_harness|testworld/)
  })

  test('SEC-11 the harness adds only exact-pinned dev dependencies: @axe-core/playwright and a Postgres client', () => {
    expect(exact(pkg.devDependencies['@axe-core/playwright'])).toBe(true)
    const pg = pkg.devDependencies['pg']
    expect(exact(pg)).toBe(true)
    expect(pkg.dependencies['pg']).toBeUndefined()
    for (const [n, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) expect(exact(v), n).toBe(true)
  })

  test('ARC-16 the pinned clock is America/Toronto, en-CA, a fixed seed and a fixed instant', async () => {
    const h = await loadHarness()
    expect(h.fixtures.PINNED.timezone).toBe('America/Toronto')
    expect(h.fixtures.PINNED.locale).toBe('en-CA')
    expect(Number.isInteger(h.fixtures.PINNED.seed)).toBe(true)
    expect(Number.isNaN(new Date(h.fixtures.PINNED.now).getTime())).toBe(false)
    expect(h.fixtures.harnessClock().now().toISOString()).toBe(new Date(h.fixtures.PINNED.now).toISOString())
  })

  test('ARC-21 the fixtures start the app from the production build and offer the one shared axe check on WCAG 2.2 AA', () => {
    const src = readOwnSource('e2e/_harness/fixtures.ts')
    expect(src).toMatch(/next build|run-next\.mjs['"],\s*['"]build|\bbuild\b/)
    expect(src).toMatch(/\bstart\b/)
    expect(src).not.toMatch(/\bnext dev\b|['"]dev['"]/)
    expect(src).toContain('@axe-core/playwright')
    expect(src).toMatch(/wcag2a\b/)
    expect(src).toMatch(/wcag22aa/)
    expect(src).toContain('America/Toronto')
    expect(src).toContain('en-CA')
  })

  test('SEC-11 the harness sets every *_ENGINE setting explicitly for next start (A06 findings, R62)', () => {
    const src = readOwnSource('e2e/_harness/fixtures.ts')
    expect(src).toMatch(/_ENGINE/)
    expect(src).not.toMatch(/process\.env\s*\[\s*['"](DATABASE_URL|SUPABASE)/)
  })
})
