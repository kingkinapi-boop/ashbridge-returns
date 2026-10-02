# E03A build report (local-cc7d7a, 2 Oct)

Branch claude/E03A. Data only: four entries added to `data/facts/catalogue.json` (166 to 170); no code change.
Acceptance: 22 of 22 in `src/contracts/facts-askable.acceptance.test.ts` pass (10 failed before); all of `src/contracts` passes (14 files, 1089 tests). Typecheck, lint, deps:check green; scope OK. No `// @mutate` file touched, so no mutation run.

New keys: `qa.assets.purchased_not_in_use` (R27), `qa.assets.disposed` (R28), `qa.vehicle.ownership` (enum owned, leased), `qa.home_office.principal_place` (boolean), all suppliedBy qa, sensitive none.

Amber:
1. Schedule 8 line numbers (203 acquisitions, 207 proceeds of dispositions) were chosen from memory of the T2 form; the tests check only the pattern. A CPA read (the Opus read in the check) should confirm them; reverse by editing the two `cra_form` refs.
2. answer_key cites point at the sample-client fields `assets`, `vehicle`, `home_office` (they exist), the nearest field each key corresponds to.
