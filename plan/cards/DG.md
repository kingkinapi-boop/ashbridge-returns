# DG Done gate: scope and mutation agree with how jobs make files

Phase 0. Size S. Deps: F00, F08. Where: local or cloud.
Tags: none (build tooling; no money, tax, CSV, citations or permissions).
Paths: tools/scope.mjs, tools/mutate-changed.mjs, .gitattributes, tools/test/done-gate.test.mjs, tools/test/__fixtures__/done-gate/**
Clauses: ARC-12, ARC-15, ARC-19, ARC-9
Read: `reports/findings-E03-F03.md` (RC1 to RC3, fix 2, rule tests R19 to R21, risks), `tools/scope.mjs`, `tools/mutate-changed.mjs`, `tools/lib.mjs` (`loadIndex`, `globToRegExp`), `.gitattributes`, `.claude/agents/builder.md`, `.claude/agents/checker.md` (step 5, the widened spec diff; step 7, mutation), `.claude/agents/spec-writer.md` (step 7, the `spec(<card>)` commit), `plan/cards/SC.md` (R18 reads core the same way), `tools/test/queue.test.mjs` (the pattern for git fixtures in a temp repo), `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Goal
The builder's "done" and the checker's "done" are one gate, and neither can pass by silence. Today `scope.mjs` allows spec files only by name pattern (a spec `__fixtures__/` file fails scope), counts the budget hook's `plan/ledger.jsonl` rows as outside, and cannot see a builder edit to a spec file; `mutate-changed.mjs` passes with "no mutation targets changed" when a core file simply lacks `// @mutate`. DG makes both tools read what the jobs actually did, and turns the E03 and F03 findings into rule tests R19 to R21, so they cannot come back on any card.

## Who does what
- The spec job writes R19 to R21 in `tools/test/done-gate.test.mjs` (`unit` project), each first failing on a planted case built in a temp git repo from `tools/test/__fixtures__/done-gate/` (cards, slices entries and file trees; no real repo history), and validates on main (spec-writer step 6).
- The build job edits `tools/scope.mjs`, `tools/mutate-changed.mjs` and `.gitattributes` only; it never edits the rule tests. Changing `builder.md`, `checker.md` and the `mutate:changed` script line in `package.json` to the new arguments is the Lead's, at landing (the push guard lets `.claude/` go to main).

## Build
- `tools/scope.mjs <card> [base] [--board]`:
  - Spec files by commit, not by name: the commits on `base...HEAD` whose subject starts `spec(<card>):` (spec-writer step 7) are found, and every file they touched is allowed, wherever it lives (for example E03's `src/contracts/__fixtures__/fact-catalogue.ts`). The name patterns (`*.acceptance.test.ts`, `__golden__/`) and the card's listed test paths stay allowed as today.
  - The widened spec diff: a file a `spec(<card>)` commit touched that any later commit not starting `spec(<card>):` changes fails as "spec file edited by the build: <file> in <short sha>". This covers fixtures and goldens as well as acceptance tests (checker step 5 does the same by hand today; the tool now does it too).
  - `plan/ledger.jsonl` is never counted as outside the card's paths; it is listed on its own line ("ledger rows on this branch: revert before boarding"). With `--board` (used when a card boards the train, skill `merge`), a branch whose diff against base holds `plan/ledger.jsonl` fails as "ledger on a card branch".
  - Exit codes as today (0 clean, 1 outside or edited spec file or ledger with `--board`, 2 usage); messages name every file.
- `tools/mutate-changed.mjs <card> [base]` (card id first; with no card id it exits 2 with the usage line, so the old silent pass cannot be reached by a missing argument):
  - Reads whether the card is core from the card file's `Tags:` line (it starts with `core`), the same source SC's R18 uses; a card id with no card file is a usage error.
  - On a core card, every changed `src/**/*.ts` file inside the card's Paths that is not a test file (the same test-file pattern as today) must carry `// @mutate` in its first 5 lines; any that does not fails with the list ("core file without @mutate"), before Stryker runs. On a non-core card an unmarked file is not a failure.
  - Then Stryker runs on the marked changed files as today (break threshold from the Stryker config). "No mutation targets changed" stays exit 0 only when the card changed no src file at all.
- `.gitattributes`: `plan/ledger.jsonl merge=union` stays (it is set today; the build checks it and leaves it).

## Test fixtures (spec-writer)
- `tools/test/__fixtures__/done-gate/`: a small slices file and card files for one core card and one non-core card, and the file trees each planted case commits into a temp git repo (a spec commit with an acceptance test and a `__fixtures__/` file outside Paths; a builder commit; a builder commit outside Paths; a builder commit editing the spec fixture; a commit adding a ledger row; a core src file with and without the marker).

## Acceptance checks
1. ARC-12, ARC-19 (R19, scope): a branch whose only extra file is a `plan/ledger.jsonl` row passes scope (the ledger line is printed); a `spec(<card>)` commit's `__fixtures__/` file outside Paths passes; a builder file outside Paths fails naming it; a builder commit that edits the spec commit's fixture fails as "spec file edited by the build" naming the file and commit; a builder edit to a golden or acceptance test fails the same way.
2. ARC-15 (R20, mutate-changed): a core card with an unmarked changed src file fails naming the file, before Stryker runs; the same file unmarked on a non-core card passes the marker gate; a marked core file goes to Stryker (the test stubs the Stryker call); no card id exits 2 with the usage line.
3. ARC-19 (R21): `node tools/scope.mjs <card> <base> --board` fails on a branch whose diff against base contains `plan/ledger.jsonl`, and passes the same branch once the ledger change is reverted.
4. ARC-9: every test in `done-gate.test.mjs` names its rule (R19, R20, R21) and clause; `.gitattributes` holds `plan/ledger.jsonl merge=union` (a test reads it).
5. On the merged branch: `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:flake` (5 of 5) pass; `node tools/scope.mjs DG` passes on DG's own branch.

## Not in this card
Changing `builder.md`, `checker.md`, the merge skill or `package.json` (the Lead, at landing). Adding markers to other cards' files (their own fix rounds: F05M, F01, F03, F04, E03, S00, F09). SC's R18 (it reads the same Tags line). Any change to the Stryker config or the break threshold.
