// GL3 (spec-writer): what the tests read from reference/onboarding-contract.md, parsed from the file so a
// change to the contract changes the expectations (A426: tables come from the contract, never copied by hand
// from the code under test). Each parser asserts named sentinels, so a parse that finds nothing fails.
import fs from 'node:fs'
import path from 'node:path'
import { expect } from 'vitest'

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..')
export const CONTRACT_MD = fs.readFileSync(path.join(REPO_ROOT, 'reference', 'onboarding-contract.md'), 'utf8')

function section(start: string, end: string): string {
  const a = CONTRACT_MD.indexOf(start)
  const b = CONTRACT_MD.indexOf(end, a + 1)
  expect(a, `contract has "${start}"`).toBeGreaterThan(0)
  expect(b, `contract has "${end}" after "${start}"`).toBeGreaterThan(a)
  return CONTRACT_MD.slice(a, b)
}

/** Section 1, "What this system reads". */
export const SECTION_1 = section('## 1. What this system reads', '## 2.')
/** Section 3, "Never read". */
export const SECTION_3 = section('## 3. Never read', '## 4.')

export interface ClientColumn {
  table: string
  column: string
}

/** The view names section 1 heads with **bridge.<name>**; a name ending in "_" (bridge.v1_*) is a prefix. */
export function contractViewNames(): { exact: string[]; prefixes: string[] } {
  const names = [...SECTION_1.matchAll(/\*\*bridge\.([a-z0-9_]+)\*?\*\*/g)].map((m) => m[1] ?? '')
  const exact = names.filter((n) => !n.endsWith('_'))
  const prefixes = names.filter((n) => n.endsWith('_'))
  expect(exact).toContain('corporation')
  expect(exact).toContain('t2_return')
  expect(exact).toContain('cra_access')
  expect(prefixes).toEqual(['v1_'])
  return { exact, prefixes }
}

/** The client-app tables the v1 paragraph of section 1 names ("shareholders: holder_name M0004:19, ..."). */
export function contractV1Tables(): string[] {
  const at = SECTION_1.indexOf('**bridge.v1_')
  expect(at).toBeGreaterThan(0)
  const v1 = SECTION_1.slice(at)
  const tables = [...v1.matchAll(/([a-z][a-z0-9_]*): [a-z][a-z0-9_]* M\d{4}:\d+/g)].map((m) => m[1] ?? '')
  expect(tables).toContain('shareholders')
  expect(tables).toContain('predecessor_requests')
  return [...new Set(tables)]
}

/**
 * The never-read columns of section 3 as (table, column) pairs, from its "Credentials and tokens" and
 * "Contact details" bullets: in each ";"-separated part, the first "<table> <column> M####:n" names the
 * table, and every ", <column> M####:n" after it is on the same table.
 */
export function neverReadPairs(): ClientColumn[] {
  const out: ClientColumn[] = []
  const bullets = SECTION_3.split('\n').filter((l) => l.startsWith('- Credentials and tokens:') || l.startsWith('- Contact details'))
  expect(bullets).toHaveLength(2)
  for (const part of bullets.join(';').split(';')) {
    const first = /([a-z][a-z0-9_]*) ([a-z][a-z0-9_]*) M\d{4}:\d+/.exec(part)
    if (first?.[1] === undefined || first[2] === undefined) continue
    const table = first[1]
    out.push({ table, column: first[2] })
    const rest = part.slice(first.index + first[0].length)
    for (const m of rest.matchAll(/, ([a-z][a-z0-9_]*) M\d{4}:\d+/g)) out.push({ table, column: m[1] ?? '' })
  }
  expect(out).toContainEqual({ table: 'people', column: 'email' })
  expect(out).toContainEqual({ table: 'people', column: 'mobile_number' })
  expect(out).toContainEqual({ table: 'links', column: 'token_hash' })
  expect(out).toContainEqual({ table: 'intakes', column: 'raw_payload' })
  expect(out).toContainEqual({ table: 'quickbooks_connections', column: 'refresh_token_encrypted' })
  return out
}

/** The tables section 3 forbids outright ("no join, no select"). */
export function neverReadTables(): string[] {
  const tables = [...SECTION_3.matchAll(/^- ([a-z][a-z0-9_]*) \(M\d{4}:\d+\): no join, no select/gm)].map((m) => m[1] ?? '')
  expect(tables).toEqual(['restricted_data'])
  return tables
}

/** True when the contract names this column with this cite ("legal_name M0002:50"). */
export function contractCites(column: string, cite: string): boolean {
  return new RegExp(`(^|[^a-z0-9_])${column} ${cite.replace(/[.:]/g, (c) => `\\${c}`)}(?![0-9])`).test(CONTRACT_MD)
}

/** True when the cite token (M0002:50, U4) appears anywhere in the contract. */
export function contractHasCite(cite: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9])${cite.replace(/[.:]/g, (c) => `\\${c}`)}(?![0-9])`).test(CONTRACT_MD)
}
