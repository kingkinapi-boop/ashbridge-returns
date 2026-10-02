# F03R build (cloud-3620d3)
Branch claude/F03R, head after this report's commit. Files: src/contracts/taxprep.ts, src/contracts/taxprep.test.ts.
- classifyValue: any leading apostrophe (and minus then apostrophe) is an apostrophe fault unless the value is '-<integer>; apostrophe inside text still accepted.
- Writer: a text value the reader would refuse is refused with the reader's reason; each row id is re-checked with parseCellId.
- Acceptance: 272 of 272 in taxprep.acceptance.test.ts pass (341 with unit tests). Spec files untouched.
- typecheck, lint, deps:check clean; scope OK; full npm test green; mutate:changed F03R: taxprep.ts 100.
- Amber: dropped the old "apostrophe among digits" clause for a leading-or-minus-apostrophe rule (1'2 is now text); reverse by restoring the old regex.
- Permission gaps: none. Model: Sonnet 5.5.
