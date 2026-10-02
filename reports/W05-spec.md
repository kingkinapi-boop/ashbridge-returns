# W05 spec report (cloud-5d574e)

- 17 tests in `testworld/kinds/K05/kind.acceptance.test.ts`: ARC-8, END-6, EV-11, TB-3, ARC-16 and ARC-13-style balance checks, on sample client 12.
- Base: claude/W00 (built, not yet merged) merged with main; plan files from main, taxprep CSVs from W00 (A347). Validated on main d at push time; typecheck/lint fail only on missing `./kind` and `./faults`.
- Step 6b sweep: no existing test contradicts (kinds.test.ts mocks the folder check). None retired.
- Amber: K05 fault ids must not reuse the client ids (catalogue ids unique); onboarding stored under `onboarding.answers` verbatim; priorYear has no taxCents (filed by another firm).
- Permission gaps: none. Model: Sonnet 5.5 (card not core).
