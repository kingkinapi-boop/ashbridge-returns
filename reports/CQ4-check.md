# CQ4 check

Checker local-1 (Opus 5.5, laptop; did neither spec nor build). Branch claude/CQ4 at 669b45a2 (main 0f7e1cc4 merged in).

**FAIL**: scope is not clean on CQ4 itself; the new rule flags the card's own build file.

## Failures

1. `node tools/scope.mjs CQ4` exits 1: `SCOPE FAIL CQ4: spec file edited by the build: tools/scope.mjs in a702cd9`. The card's Spec section says "which scope.mjs passes today" (prose about the tool), and `specNamed()` turns every bare token with an extension into a spec-owned file, matched by trailing path, so `tools/scope.mjs` (the one file the Build section asks for) becomes the spec job's. The build report's "`scope.mjs CQ4` OK" does not hold on the pushed branch. Card Check line: "scope clean".
   - Where else it bites (same regex run over every card's Spec section against its own non-test Paths): FX2 (open build; its Spec names `src/core/env.ts`, which its build must change), CQ1, CQ2, BL0, F03R, F09A, F09B, F01C. FX2's build would fail scope falsely as soon as CQ4 lands. Paths given as globs were not expanded, so the real count may be higher.
   - Rule candidate: a file the card's Build section (or its Paths, as code the build writes) asks the builder to change is never spec-owned by name alone; only expectation files (counts, verify lines, goldens, READMEs) or files the Spec section marks as owned are the spec job's. Add a by-class test: for every card in plan/slices.json, scope.mjs's spec-named set never contains a non-test file the Build section names.
   - The acceptance tests did not catch it: the fixture card names only expectation files in its Spec section; none names a code file in prose. A spec round should add that row (Spec prose naming the build's own file is not spec-owned), since the test file is the spec's.

## Passed

- typecheck, lint, deps:check (197 modules) clean.
- Tests: `node tools/heavy.mjs -- npx vitest run --project unit tools/test`: 15 files, 255 of 255 pass, including scope-spec-files 7 of 7.
- Spec files untouched since the spec commits (41ba7869, 78fbaf82): `git diff 78fbaf82 HEAD` over tools/test/scope-spec-files.test.mjs, plan/cards/CQ4.md and reports/CQ4-spec.md is empty.
- Planted case: `node tools/scope.mjs FX8` now fails on reference/sample-clients/verify.mjs in 005070e (005070e8 is in claude/FX8).
- Diff read: only tools/scope.mjs changed by the build; nothing beyond the card; no client sentence, key or real data. Merge check uses `git diff-tree --cc`, which lists only files differing from every parent, as R82 asks.
