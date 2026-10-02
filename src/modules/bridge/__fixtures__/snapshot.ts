// Made-up client-app snapshots for the F07 acceptance tests (spec-writer). Shaped like the bridge
// views in reference/onboarding-contract.md section 1. Every name ends in "(Test)". Plain objects,
// so a test can plant a fault by overriding a field; the bridge parses them as `unknown`.

/** A fixed, valid v4 uuid for a small number. */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export interface FixtureEngagement {
  id: string
  service: string
  tax_year: number | null
  current_state: string
  created_at: string
  is_test: true
}

export interface FixtureCorporation {
  id: string
  legal_name: string
  business_number: string | null
  financial_year_end: string | null
  financial_year_end_confirmed: boolean
  incorporation_date: string | null
  all_prior_years_filed: 'yes' | 'no' | 'unsure' | null
  outstanding_years: string | null
  services: string[] | null
  associated_corporation_ids: string[]
  is_test: true
}

export interface FixtureEntity {
  id: string
  kind: 'company' | 'personal'
  corporation: FixtureCorporation | null
  engagements: FixtureEngagement[]
}

export interface FixtureSnapshot {
  is_test: true
  entities: FixtureEntity[]
}

export function engagement(n: number, over: Partial<FixtureEngagement> = {}): FixtureEngagement {
  return {
    id: uuid(9000 + n),
    service: 't2',
    tax_year: 2025,
    current_state: 'intake',
    created_at: '2026-01-20T14:05:00Z',
    is_test: true,
    ...over,
  }
}

export function corporation(n: number, over: Partial<FixtureCorporation> = {}): FixtureCorporation {
  return {
    id: uuid(100 + n),
    legal_name: `Fixture Company ${String(n)} Inc. (Test)`,
    // nine plain digits that fail the check digit, different for every corporation
    business_number: String(100000000 + n * 7919).slice(0, 9),
    financial_year_end: '2025-12-31',
    financial_year_end_confirmed: true,
    incorporation_date: '2019-03-04',
    all_prior_years_filed: 'yes',
    outstanding_years: null,
    services: ['t2', 'bookkeeping'],
    associated_corporation_ids: [],
    is_test: true,
    ...over,
  }
}

/** A company entity that bought one T2 per listed tax year (default 2025). */
export function company(
  n: number,
  corp: Partial<FixtureCorporation> = {},
  years: (number | null)[] = [2025],
): FixtureEntity {
  return {
    id: uuid(500 + n),
    kind: 'company',
    corporation: corporation(n, corp),
    engagements: years.map((y, i) => engagement(n * 10 + i, { tax_year: y })),
  }
}

/** A personal-return entity (T1): no corporation. */
export function personal(n: number): FixtureEntity {
  return {
    id: uuid(700 + n),
    kind: 'personal',
    corporation: null,
    engagements: [engagement(700 + n, { service: 't1', tax_year: 2025 })],
  }
}

export function snapshot(...entities: FixtureEntity[]): FixtureSnapshot {
  return { is_test: true, entities }
}
