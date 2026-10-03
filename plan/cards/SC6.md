# SC6 Card and verify rules R77 and R78

**Lead directive, 3 Oct (A408): spec fixup for the 6 gaps in reports/SC6-spec-review.md.** R77 reads bold directives and "Fix round" sections too, whole-sentence handling, any case and path spelling; R78 matches behaviour (git diff, git show, merge-base through a variable, pinned hashes) and covers test files; SC6 now depends on W16, so no KNOWN entry is needed for verify.mjs or W14 (R77 runs only on open cards): KNOWN ends empty. Also (reports/W16-spec-review-3.md): R11 treats a missing "N known" as a failure, never 0; `*` and indented bullets are read; folders outside SPEC are checked too. **R81** (A417, reports/FX8-findings.md): each expectation file in a card's Paths (a verify line, a README count, a golden) is owned by exactly one of the Spec and Build sections. Planted: FX8.md as first carded.

Phase 0. Size S. Deps: SC, W16. Where: cloud.
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

## KNOWN shape (3 Oct, A407)
Every KNOWN entry names one rule, one file, the exact problem strings (no regex) and an open owner card; any problem not listed fails, and a listed string not produced fails as stale. Every file scan asserts it read at least one file and a named sentinel.
R77 runs only on cards that are not done or parked (a landed card's text is history, not a build order), so no KNOWN entry names W14. R78's entry names the exact verify.mjs line text, not any line number, owner W16 (claude/W16-r2).
