# SC6 spec, round 2 (cloud-4863d0, 3 Oct 2026, Opus 5.5)

Spec commit f64dedb0 (`spec(SC6): round 2 spec patch`), validated on main de30610b (merged as 10a3721f). Brief: the Lead directive of 3 Oct 15:04Z (A493) on plan/cards/SC6.md, eight fixes.

## What changed
- `git mv` to tools/test/spec-rules.test.mjs and tools/test/__fixtures__/spec-rules/ (three planted copies, unchanged). SC10's tools/test/card-rules.test.mjs (origin/claude/SC10) is not touched; main has no card-rules.test.mjs.
- 71 tests (42 `test` and `test.each` blocks): cards read 5, R77 20, R81 9, R78 34, KNOWN 3. R77 and R81 cite ARC-12, R78 ARC-16. KNOWN is empty and a test asserts it.
- The R77 closed grammar (fix 4) and the R78 reach (fixes 3 and 7) are stated in the file header.

## Validation
- On this branch (main de30610b plus the spec): `npm run typecheck` and `npm run lint` clean; unit project 1 failure of 2934 tests, the R77 repo scan (below); db project green (655 passed, 1 expected fail, 5 skipped).
- Scratch merge of origin/main plus the origin/claude/CQ8 (d73e9bba), origin/claude/CQ11 (cc4bc6f4) and origin/claude/SC10 (22d25f06) tips: spec-rules gives the same one failure. The other failures there are CQ11's own unbuilt acceptance tests (claim-wait-check, metrics-counts, next-paths A493, scope-spec-files), the same with or without this spec.
- Stub sweep (step 6b), in a throwaway worktree: with N01.md's Build line reworded (stub, never committed), every spec-rules test passes and no other test fails. No test retired.
- FX1's cold-tool rule (toolchain-rules.test.mjs) flagged the `git ls-files` spawn: the two tests that call it set a 30 s timeout. Assertions unchanged.

## Item 8: the reruns on main de30610b
- Cards: 356 read, none open without a file, 265 open (162 of them family cards).
- R77 on all 265 open cards: one problem.
  - `plan/cards/N01.md: a build order names src/modules/learning/causes/_core/__fixtures__/, which the spec job owns (causes/_core/__fixtures__/)`. N01's Spec section lists the planted set as a fixture (line 14) and its Build section has the build write it (line 33). This is fix 5 working as written. **Needs the Lead:** reword N01.md on main (the planted set is the spec job's, or the Spec line stops naming the folder). Until then this test fails on main; KNOWN stays empty as directed.
- R81 on all 265 open cards: none.
- R78 on all files (git ls-files): 161 files read (142 tests, 19 checkers over sample data), 10 exempt as temp-repo tests (claim-needs-lead, claim-race-update, claim-race, claim-wait, claim, done-gate, mutate-harness, queue, scope-spec-files, scope; read with the exemption off, they give 35 hits, so the scanner does reach them), problems: none.

## Amber (decided, for the Lead's AMBER.md)
1. Fix 2: only an *open* card with no file fails by id. Main has 8 closed cards with no file (P02, P03, P04, B00, B02, T03, V07, T06). Failing those would make main red with KNOWN empty. Reverse: drop the isOpen test in scanCards.
2. Fix 4: "names its job" in a round sentence also takes the check ("the check runs verify.mjs ..."; FX8.md A417 has one). A label carries the build only when it is nothing but a build job word ("Rebuild:", "Builder:"): "Build rules added:" (S00.md) is not a label. A colon sentence naming the spec gives the spec to the rest of its line (DB16's "First a spec patch (Opus, core-grade): tests ...").
3. Fix 5: the folder rule covers fixture and golden folders only (`__fixtures__/`, `__golden__/`). A product folder a Spec section names ("Tests for `src/modules/x/`") stays the build's. `.spec.` files (check item 4) stay outside isExpectationFile: tools/lib.mjs is not in SC6's Paths.
4. R81 asks for a named owner only for verify scripts and READMEs. Acceptance tests and goldens are owned by standing rule. Other tests and fixtures are the spec job's by role (scope.mjs R82). Requiring names for those failed 72 entries on 47 open cards, SC6's own Paths among them. Reverse: drop the isTest and isFixture exclusions in needsNamedOwner.
5. R78: hex and sha- literals count only in files over sample data, as in round 1 (a recorded prompt hash in a test is not a baseline). A git call has to name a ref-reading subcommand before "main" counts, so `git init -b main` passes.

## Owned files
tools/test/spec-rules.test.mjs and tools/test/__fixtures__/spec-rules/** (spec-owned; the build has nothing). When SC6 lands, the Lead adds spec-rules.test.mjs to the main push guard for plan/cards and slices.json pushes (card note). Its name matches `tools/test/*-rules.test.mjs`, so changes to it reopen specs as a toolchain refit (tools/lib.mjs toolchainChanged).

Model: Opus 5.5. Permission gaps: none (one `ls node_modules/.bin` was denied; Glob was used instead).
