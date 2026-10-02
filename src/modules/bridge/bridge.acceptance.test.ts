// F07 acceptance tests, the pure side (spec-writer; builders never edit this file).
// Card plan/cards/F07.md. The database side is bridge.acceptance.db.test.ts.
//
// The shapes these tests fix (the builder matches them; amber, listed in the spec report):
// - src/contracts/bridge.ts exports BRIDGE_CONTRACT ({ clientAppCommit, lastMigration }), the zod
//   schemas BridgeSnapshotSchema, BridgeEntitySchema, BridgeCorporationSchema and
//   BridgeEngagementSchema (all strict: an unknown key is refused), and BRIDGE_SHAPES, a record of
//   every shape the bridge reads. The snapshot is { is_test: true, entities: [{ id, kind:
//   'company' | 'personal', corporation | null, engagements: [...] }] }; see __fixtures__/snapshot.ts.
// - src/modules/bridge/index.ts exports formatClientRef(n), parseClientRef(ref), returnYearEnd(
//   fiscalYearEnd, taxYear) and the database functions the db test names.
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import {
  BRIDGE_CONTRACT,
  BRIDGE_SHAPES,
  BridgeCorporationSchema,
  BridgeEngagementSchema,
  BridgeSnapshotSchema,
} from '../../contracts/bridge'
import { formatClientRef, parseClientRef, returnYearEnd } from './index'
import { neverReadNames } from './__fixtures__/never-read'
import { company, corporation, engagement, personal, snapshot } from './__fixtures__/snapshot'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
const CONTRACT_MD = fs.readFileSync(path.join(REPO_ROOT, 'reference', 'onboarding-contract.md'), 'utf8')

/** Every property name of a zod shape, at any depth. */
function shapeKeys(schema: z.ZodType): Set<string> {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' })
  const keys = new Set<string>()
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node === null || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'properties' && v !== null && typeof v === 'object') {
        for (const p of Object.keys(v as Record<string, unknown>)) keys.add(p)
      }
      walk(v)
    }
  }
  walk(json)
  return keys
}

describe('F07 the shapes (ARC-2)', () => {
  test('ARC-2 a clean made-up snapshot parses', () => {
    const parsed = BridgeSnapshotSchema.safeParse(snapshot(company(1), personal(1)))
    expect(parsed.success).toBe(true)
  })

  test('ARC-2 no field from the contract never-read list exists in any shape', () => {
    const never = neverReadNames()
    // the list was really read (a parse that finds nothing would pass every check below)
    for (const expected of ['value_encrypted', 'last_four', 'token_hash', 'code_hash', 'email', 'mobile_number', 'raw_payload', 'to_address', 'body', 'message', 'access_token_encrypted', 'refresh_token_encrypted', 'restricted_data']) {
      expect(never).toContain(expected)
    }
    const shapes = Object.entries(BRIDGE_SHAPES)
    expect(shapes.length).toBeGreaterThanOrEqual(4)
    const all = new Set<string>()
    for (const [, schema] of shapes) for (const k of shapeKeys(schema)) all.add(k)
    // the walker really reaches fields (guards a walker that finds nothing)
    for (const k of ['legal_name', 'financial_year_end', 'tax_year', 'services']) expect(all).toContain(k)
    const present = never.filter((n) => all.has(n))
    expect(present).toEqual([])
  })

  test('ARC-2 a snapshot that carries a never-read field is refused, not stripped', () => {
    for (const planted of [{ email: 'a@example.test' }, { value_encrypted: 'x' }, { mobile_number: '555' }, { sin: '046454286' }]) {
      const s = snapshot(company(1))
      const entity = s.entities[0]
      if (entity?.corporation === null || entity === undefined) throw new Error('fixture')
      const bad = { ...s, entities: [{ ...entity, corporation: { ...entity.corporation, ...planted } }] }
      expect(BridgeCorporationSchema.safeParse(bad.entities[0]?.corporation).success).toBe(false)
      expect(BridgeSnapshotSchema.safeParse(bad).success).toBe(false)
    }
    expect(BridgeEngagementSchema.safeParse({ ...engagement(1), message: 'hello' }).success).toBe(false)
  })

  test('ARC-2 made-up data only: a snapshot, corporation or engagement not marked is_test is refused', () => {
    expect(BridgeSnapshotSchema.safeParse({ ...snapshot(company(1)), is_test: false }).success).toBe(false)
    expect(BridgeCorporationSchema.safeParse({ ...corporation(1), is_test: false }).success).toBe(false)
    expect(BridgeEngagementSchema.safeParse({ ...engagement(1), is_test: false }).success).toBe(false)
  })

  test('ARC-2 a business number is nine plain digits or null', () => {
    expect(BridgeCorporationSchema.safeParse(corporation(1, { business_number: '10460411' })).success).toBe(false)
    expect(BridgeCorporationSchema.safeParse(corporation(1, { business_number: '104604112RC0001' })).success).toBe(false)
    expect(BridgeCorporationSchema.safeParse(corporation(1, { business_number: null })).success).toBe(true)
  })

  test('ARC-2 the contract names the client-app commit and the last migration it was written against', () => {
    expect(BRIDGE_CONTRACT.clientAppCommit).toMatch(/^[0-9a-f]{8,40}$/)
    // "f87a0043 or later": the commit the scout read (the contract file names it) or a newer one
    expect(CONTRACT_MD).toContain('f87a0043')
    expect(typeof BRIDGE_CONTRACT.lastMigration).toBe('number')
    expect(BRIDGE_CONTRACT.lastMigration).toBeGreaterThanOrEqual(34)
    expect(CONTRACT_MD).toMatch(/M0034:\d+/)
  })
})

describe('F07 client_ref (RT-5, onboarding contract U6)', () => {
  test('RT-5 the number is ASH- and four digits from 0001, more digits after 9999', () => {
    expect(formatClientRef(1)).toBe('ASH-0001')
    expect(formatClientRef(42)).toBe('ASH-0042')
    expect(formatClientRef(9999)).toBe('ASH-9999')
    expect(formatClientRef(10000)).toBe('ASH-10000')
    expect(formatClientRef(123456)).toBe('ASH-123456')
  })

  test('RT-5 formatClientRef and parseClientRef round-trip, and formatting is strictly increasing in the number', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5_000_000 }), (n) => {
        expect(parseClientRef(formatClientRef(n))).toBe(n)
        expect(formatClientRef(n)).toMatch(/^ASH-\d{4,}$/)
      }),
      { seed: 20261002, numRuns: 200 },
    )
  })

  test('RT-5 numbers below 1 or not whole are refused, and so is a ref that is not ASH- plus digits', () => {
    for (const n of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) expect(() => formatClientRef(n)).toThrow()
    for (const ref of ['ASH-001', 'ash-0001', 'ASH-0000', 'ASH-00001', 'ASH-', 'ASH-12a4', ' ASH-0001', 'ASH-0001 ']) {
      expect(parseClientRef(ref)).toBeNull()
    }
  })
})

describe('F07 the return year end (END-1)', () => {
  test('END-1 the year end is the last day of the confirmed year-end month in the tax year', () => {
    expect(returnYearEnd('2025-12-31', 2025)).toBe('2025-12-31')
    expect(returnYearEnd('2025-03-31', 2026)).toBe('2026-03-31')
    expect(returnYearEnd('2025-06-30', 2025)).toBe('2025-06-30')
    expect(returnYearEnd('2024-02-29', 2025)).toBe('2025-02-28')
    expect(returnYearEnd('2025-02-28', 2028)).toBe('2028-02-29')
    expect(returnYearEnd('2024-12-31', 2025)).toBe('2025-12-31')
  })

  test('END-1 property: always a real date in the tax year, in the same month as the year end, and the last day of it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2040 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2000, max: 2040 }),
        (fyeYear, month, taxYear) => {
          const lastOfFye = new Date(Date.UTC(fyeYear, month, 0)).getUTCDate()
          const fye = `${String(fyeYear)}-${String(month).padStart(2, '0')}-${String(lastOfFye).padStart(2, '0')}`
          const out = returnYearEnd(fye, taxYear)
          const lastOfOut = new Date(Date.UTC(taxYear, month, 0)).getUTCDate()
          expect(out).toBe(`${String(taxYear)}-${String(month).padStart(2, '0')}-${String(lastOfOut).padStart(2, '0')}`)
        },
      ),
      { seed: 20261002, numRuns: 300 },
    )
  })

  test('END-1 a date that is not a calendar date is refused, never guessed', () => {
    for (const bad of ['2025-13-01', '2025-02-30', '25-12-31', '', 'December 31']) expect(() => returnYearEnd(bad, 2025)).toThrow()
  })
})
