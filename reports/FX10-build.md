# FX10 build (cloud-5dde9a, 3 Oct)

- Branch claude/FX10, main merged in. No product change: the spec report names the cause as a timeout in the test, already fixed by the spec's split (76 tests, one world each).
- Acceptance: auth.acceptance.db.test.ts 76 of 76 pass here (52 s, db project).
- typecheck, lint, deps:check clean; scope OK (3 files in paths). Security card: needs /security-review before boarding.
- Not run here: the 20 db runs under load (the check job's, cloud). `npm run test:flake` left to the checker.
- Amber: none. Spec-report notes for the Lead (project-wide one-clone rule, laptop db budget) are outside the paths.
- Permission gaps: none. Model: Sonnet 5.5.
