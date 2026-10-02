// The "never read" names of reference/onboarding-contract.md section 3, read from the file (spec-writer).
import fs from 'node:fs'
import path from 'node:path'
import { expect } from 'vitest'

const CONTRACT_MD = fs.readFileSync(
  path.resolve(import.meta.dirname, '..', '..', '..', '..', 'reference', 'onboarding-contract.md'),
  'utf8',
)

/** The "never read" names, read from section 3 of the contract: every column named before an M####:line reference. */
export function neverReadNames(): string[] {
  const start = CONTRACT_MD.indexOf('## 3. Never read')
  const end = CONTRACT_MD.indexOf('## 4.')
  expect(start).toBeGreaterThan(0)
  expect(end).toBeGreaterThan(start)
  const section = CONTRACT_MD.slice(start, end)
  const names = new Set<string>()
  for (const m of section.matchAll(/(?<![.\w])([a-z]+(?:_[a-z0-9]+)*)\s+\(?M\d{4}:\d+/g)) {
    if (m[1] !== undefined) names.add(m[1])
  }
  // the restricted kinds named on the first bullet (M0001:171-178) and the marker answers' kinds
  for (const k of ['sin', 'date_of_birth', 'bank_transit', 'bank_institution', 'bank_account', 'ontario_company_key']) {
    expect(section).toContain(k)
    names.add(k)
  }
  return [...names]
}

