// Spec fixtures for E03 (fact catalogue). Made up. Plain data on purpose: no import from
// '../facts', so these load even before the module exists.
//
// The catalogue file shape these tests fix (amber, E03 spec):
//   { "entries": [ <entry>, ... ] }   (the version is computed by loadFactCatalogue, not stored)
// One entry:
//   key        dotted lower case, exactly <area>.<subject>.<measure>, segments [a-z][a-z0-9_]*
//   valueType  'money' | 'date' | 'text' | 'count' | 'percent' | 'boolean' | 'enum'
//   options    the option ids, present only when valueType is 'enum'
//   period     'instant' | 'duration'
//   repeating  'none' | { rowKey: string }   (rowKey non-empty)
//   sensitive  'none' | 'sin' | 'birth_date' | 'bank_account'
//   suppliedBy one or more of DOCUMENT_KINDS or the named non-document sources
//   label      staff label, at most 60 characters, no final full stop
//   cites      one or more { kind: 'cra_form' | 'onboarding_contract' | 'answer_key', ref: string }

export type FixtureEntry = Record<string, unknown>

/** The six named non-document sources (card E03, Build). */
export const NON_DOCUMENT_SOURCES = ['onboarding', 'qa', 'cra_capture', 'prior_return', 'qbo', 'judgment'] as const

/** The sixteen extractor families E10 to E25 (their {doc} params in plan/slices.json). */
export const EXTRACTOR_DOC_KINDS = [
  'bank', 'card', 'loan', 'tb-pdf', 'tb-sheet', 'fs', 'invoice', 'prior-t2',
  'noa', 'cra-sheet', 'hst', 't4', 't5', 'ohip', 'corporate', 'resolution',
] as const

/** A valid entry supplied by a non-document source, so it does not depend on DOCUMENT_KINDS ids. */
export function cleanEntry(over: FixtureEntry = {}): FixtureEntry {
  return {
    key: 'testarea.widget_test.closing_amount',
    valueType: 'money',
    period: 'instant',
    repeating: 'none',
    sensitive: 'none',
    suppliedBy: ['qbo'],
    label: 'Widget closing amount (Test)',
    cites: [{ kind: 'answer_key', ref: 'trialBalance (Test)' }],
    ...over,
  }
}

/** A small valid catalogue of made-up entries. */
export function cleanCatalogue(): { entries: FixtureEntry[] } {
  return {
    entries: [
      cleanEntry(),
      cleanEntry({
        key: 'testarea.gadget_test.opened_on',
        valueType: 'date',
        label: 'Gadget opened on (Test)',
        suppliedBy: ['onboarding'],
        cites: [{ kind: 'onboarding_contract', ref: 'corporations.incorporation_date' }],
      }),
      cleanEntry({
        key: 'testarea.gadget_test.kind',
        valueType: 'enum',
        options: ['alpha', 'beta'],
        label: 'Gadget kind (Test)',
        suppliedBy: ['judgment'],
        cites: [{ kind: 'cra_form', ref: 'T2 line 070 (Test)' }],
      }),
      cleanEntry({
        key: 'testarea.slip_test.amount',
        repeating: { rowKey: 'slip_number' },
        period: 'duration',
        label: 'Slip amount (Test)',
        suppliedBy: ['cra_capture', 'prior_return'],
      }),
      cleanEntry({
        key: 'testarea.share_test.percent_common',
        valueType: 'percent',
        label: 'Share of common shares (Test)',
        suppliedBy: ['qa'],
      }),
      cleanEntry({
        key: 'testarea.staff_test.headcount',
        valueType: 'count',
        label: 'Staff headcount (Test)',
      }),
      cleanEntry({
        key: 'testarea.payroll_test.has_account',
        valueType: 'boolean',
        label: 'Payroll account open (Test)',
      }),
      cleanEntry({
        key: 'testarea.note_test.text',
        valueType: 'text',
        label: 'Client note (Test)',
      }),
      // "sin" inside "business" must not trip the sensitive-name rule (no false alarm).
      cleanEntry({
        key: 'corporation.identity_test.business_number',
        valueType: 'text',
        label: 'Business number (Test)',
      }),
    ],
  }
}

/** A catalogue with the clean entries plus the given extra ones appended. */
export function withExtra(...extra: FixtureEntry[]): { entries: FixtureEntry[] } {
  const c = cleanCatalogue()
  return { entries: [...c.entries, ...extra] }
}
