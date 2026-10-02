# CQ2 check (cloud-4b7764, 2 Oct 2026)

FAIL (two process items, no code defect found). Branch claude/CQ2 at cfd6877.

Passed: typecheck, lint, deps:check, `npm test` (2460 unit, 488 db), tools tests 223 of 223, spec files (claim, scope, done-gate, queue tests and fixtures) unchanged since the spec commit 1ad7722, `node tools/next.mjs 12` prints in flight 5 from claims, START only FX2, CQ2 and A06 under waiting on check. Rules 1 to 5 read in the diff and match the card. Not core, so no mutation run.

Failures:
1. `node tools/scope.mjs CQ2`: SCOPE FAIL, 2 files outside the card's Paths: `.claude/skills/merge/SKILL.md` (the card's Build asks for it) and `tools/test/claim-needs-lead.test.mjs`. Fix: add both to the card's Paths (Lead edit), or board with this note.
2. The builder wrote `tools/test/claim-needs-lead.test.mjs` (3 tests for rule 6) because the spec has no rule 6 tests. That breaks "tests written by another worker". Fix: a spec job for rule 6 (or the Lead accepts it as amber); rule 6 is untested by an independent author.

Not run: `node tools/scope.mjs F02` on main shows the intended exit 2 (no origin/claude/F02), not a file count; F02 has landed so there is no branch.

Builder ambers (reports/CQ2-build.md): a reopened spec is offered while the build is reported; the needs-Lead hold ignores "wait:" releases. Both look reasonable.

Rule candidate: when a card adds a rule after its spec ran, send the new rule to a spec job before the build starts.
