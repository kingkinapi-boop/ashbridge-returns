# Cards from findings E03-F03 (2 Oct, card side only)

Branch `claude/cards-findings-e03`. Inputs: `reports/findings-E03-F03.md`, the cards named below, `tools/scope.mjs`, `tools/mutate-changed.mjs`, `.gitattributes`.

## Done
- New card `plan/cards/DG.md` (phase 0, S, deps F00 and F08) and its slices entry: scope allows the files of `spec(<card>)` commits, fails a later non-spec edit to them (the widened diff), never counts `plan/ledger.jsonl` as outside, and refuses it with `--board`; mutate-changed takes the card id and fails a core card's unmarked changed src file before Stryker. Checks R19 to R21.
- New card `plan/cards/F05M.md` (phase 0, S, deps F05) and its slices entry; F05M added to SC's deps (slices and card).
- "Fix round 2" on F03 (helper report first, then spec, build, LF exports, re-check) and on E03 (spec, build, board after TH); E03 Paths gain `src/contracts/__fixtures__/fact-catalogue.ts` (card only).
- Build line "the first lines of every core file carry `// @mutate`" on F01, F03, F04, E03, S00.
- SC check 7 (R18): core read from the card's Tags line plus Paths.
- M00: "Defect to cover" for the GIFI and T2 line list check of E03's cites. T02: the Windows-1252-that-forms-UTF-8 refusal noted, with one test.
- `node tools/matrix.mjs --plan`: PLAN OK.

## Proposed ambers
1. R21 is `scope.mjs --board` (fails on a ledger change), while plain scope only lists the ledger and passes (R19); why: R19 and R21 otherwise contradict, and the hook writes ledger rows during builds; reverse: drop the flag and make plain scope fail on the ledger.
2. mutate-changed with no card id exits 2 (usage) instead of today's pass; why: a missing argument must not reopen the silent pass (RC2); reverse: default to today's behaviour when no id is given. The Lead updates builder.md, checker.md and the `mutate:changed` script in package.json at DG's landing.
3. DG and SC read "core" from the card's `Tags:` line, not slices.json's `core` flag; why: the findings name the Tags line and both rules must agree; reverse: read slices.json `core` in both.
4. DG's fixtures live under `tools/test/__fixtures__/done-gate/**`, inside TH's `tools/test/__fixtures__/**` glob, so the queue may serialise DG and TH; why: the fixtures home is shared and both are small; reverse: move DG's fixtures to `tools/test/done-gate.fixtures/` or narrow TH's glob.
5. E03's slices.json paths are not changed (the brief allowed only the DG, F05M and SC entries), so the card's Paths line and slices disagree on the fixture; DG's spec-commit rule makes scope pass anyway; why: stay inside the brief; reverse: add `src/contracts/__fixtures__/fact-catalogue.ts` to E03's slices paths (recommended).
6. E03's "board after TH" is written on the card only, not as a dep; why: same limit as 5, and TH is a boarding order, not a build input; reverse: add TH to E03's slices deps.
7. F05M has no new acceptance tests (F05's stand); a clause-class survivor goes to the Lead for a spec job before F05M lands; why: three-worker rule (ARC-12) for any new acceptance test; reverse: let F05M's builder add only unit tests and land with a logged survivor.
8. F01's marker line names `records.ts` and `ids.ts`, not `index.ts` (re-exports only, nothing to mutate); why: matches the findings' list; reverse: add `index.ts`.
9. F03's helper runs Stryker directly (`--mutate src/contracts/taxprep.ts`, JSON reporter) without adding the marker; why: the helper changes no code; reverse: let the helper add the marker on its branch.
