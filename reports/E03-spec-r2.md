# E03 spec round 2 (cloud-71b41d)

Spec commit 6e5e86b on claude/E03, validated on main ba4505f (Node 24.21.0). Tests: 29 added to src/contracts/facts.acceptance.test.ts (EV-5, check 4): onboarding_contract cites are `table.column` listed in reference/onboarding-contract.md section 1 (7 bad refs planted); cra_form cites match `Schedule NNN line NNNN` or `T2 line NNN` (14 free-text planted, 6 valid accepted). Only the committed cra_form check fails (33 free-text cites), as intended. Retired tests: none.

## For the Lead (needs a decision before the build)
- 15 older E03 acceptance tests fail on main since W14/W15 landed (sample clients 10 -> 15): `expect(sampleClientDirs()).toHaveLength(10)` (about line 507), and 14 tests "onboarding field X that an answer-key flag relies on is cited by a catalogue key" (X = FL:96, FL:97, FL:104, YE1.*, BQ2.earn, corporation.*, engagements, ohip_remittance_advice). These need an `answer_key` cite equal to X, but "every answer_key citation names a field the sample clients really hold" refuses a head like FL:104: the two contradict. A third spec round (or card note) must settle this.
- Amber: schedule 1 to 3 digits, line 3 or 4 digits; contract cite must be `table.column`.
- Amber: the strict pattern leaves no cra_form home for T4/T5 box, GST34 line, NOA cites; builder re-cites as answer_key or T2/schedule line. Widening the regex is a one-line spec change.

## Permission gaps
None.
## Model
Opus 5.5 spec-writer subagent; Sonnet 5.5 worker.
