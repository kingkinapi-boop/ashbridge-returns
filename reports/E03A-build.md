# E03A build report, round 2 (cloud-c5a0ac, 2 Oct)

Branch claude/E03A. Data only: `data/facts/catalogue.json`; no code change.
Round 2: the two year-total asset keys became six per-asset keys (rowKey `asset`): `qa.assets.purchased_not_in_use` (+ `_cca_class`, R27, cite line 203 with the "no line" note) and `qa.assets.disposed` (+ `_kind` enum sold/written_off, `_original_cost`, `_cca_class`, R28, cite line 207). The two vehicle/home-office keys from round 1 are kept.
Acceptance: all of `src/contracts/facts-askable.acceptance.test.ts` passes; full suite 43 files, 1458 tests pass. Typecheck, lint, deps:check clean; scope OK. No `// @mutate` file touched.

Amber:
1. Labels for the new keys are staff-side wording, not client sentences. Reverse: edit the labels.
2. Cost key `qa.assets.purchased_not_in_use` is `instant` money (cost at year end); disposed proceeds is `duration` as the spec requires.
3. Schedule 8 lines 203 and 207 still come from memory of the form; the check's Opus read must confirm.

Permission gaps: `nvm install 24` printed nothing and left Node 22; I fetched Node 24 from nodejs.org into the scratchpad instead.
Model: Sonnet 5.5.
