# SC6 Card and verify rules R77 and R78

Phase 0. Size S. Deps: SC. Where: cloud.
Tags: core (who writes which file decides whether a spec can be graded fairly).
Paths: tools/test/card-rules.test.mjs, tools/test/__fixtures__/card-rules/**
Clauses: ARC-15, ARC-16
Read: `reports/W16-findings.md` (rule tests), `plan/cards/SC.md` (rule style, KNOWN table), `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Spec
Each rule first shown failing on its planted example, then passing on main:
- **R77** no card gives the same file both to the spec job (tests, fixtures, verify.mjs, README counts) and to the build: a card whose Build section names a file the Spec section owns fails. Planted: W16.md as on main before A404.
- **R78** verify.mjs (and any checker script over sample data) holds no hard-coded "unchanged since main" or "folders N to M identical" checks: unchanged files are scope.mjs's job. Planted: verify.mjs as on main before W16 round 2.
- Entries that fail on main go in KNOWN with their owning card; never weaken a rule (A329).

## Check
A checker who did neither: both rules fail on the planted examples and pass on main (with KNOWN), `npm test` green.
