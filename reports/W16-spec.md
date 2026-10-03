# W16 spec, round 2 fixup (A408), 3 Oct

Branch claude/W16-r2, on top of spec 704a943, validated on main 31defba1 (origin/main merged). Files: reference/sample-clients/verify.mjs, reference/sample-clients/README.md, plan/cards/W16.md (Build bullet 3, acceptance check 3, new Check section). From reports/W16-spec-review.md, gaps 1 to 3 and the 07 amber.

## What changed
1. Gap 1 (ARC-16, verify.mjs): after the two regenerations, one line runs `git diff --quiet --ignore-cr-at-eol HEAD -- <every SPEC folder>` and `git ls-files --others --exclude-standard` over the same folders. It passes only when git answers 0 and nothing is untracked; any other exit, a spawn error, a regeneration error or a missing SPEC folder fails it, with the reason. Compared with HEAD, never main; no card folder list (R78).
2. Gap 3 (END-2, verify.mjs): every "- " bullet under "Opening UCC moved" must parse as `- <folder> class <class>: <from> to <to>.`, or the tie line fails naming the bullet. A new plant line proves it on a sample-copy of README.md with the first bullet's "class 8" written "class8".
3. Gap 2 (card Check section): the one-off check-job step, comparing answer-key.json and onboarding.json of 03, 04, 07, 08 and 10 with origin/main field by field (only `assets`, `t2Inputs.schedule8.openingUcc[].ucc`, `prior_year_closing_balances.ucc[].ucc` may differ; changed set equals the README's six lines; each "from" equals main; every other file byte-identical ignoring CR). Card Build bullet 3 and acceptance check 3 rewritten to the directive.
4. 07 (A408): R8 models the accelerated investment incentive (`cca.firstYear: 'aii'`, factor 1.5 for an asset in use after 20 Nov 2018 and before 2024). The building went into use 1 Jan 2020, so 07 uses it. By hand at 4%: 2020 CCA 0.04 x 1.5 x 560,000 = 33,600.00 (UCC 526,400.00); 2021 21,056.00 (505,344.00); 2022 20,213.76 (485,130.24); 2023 19,405.2096 rounds to 19,405.21 (465,725.03); 2024 18,629.0012 rounds to 18,629.00, UCC 447,096.03. R8 on the stub (below) gives the same. README line now "481,200.00 to 447,096.03"; the rates sentence says every register uses the incentive. The card's Build bullet 3 tells the build to use `aii` for 07 (562b349 had half-year and 466,121.40).
5. README pass count: 539 to 541 (two new lines). Measured on the finished-state stub: 541 passed, 0 known, 0 failed.

## Proofs (by hand)
- Finished-state stub (throwaway worktree, never committed or pushed): 562b349's client files and five folders, 07 switched to `aii` and 447,096.03, regenerated and committed locally. verify.mjs: 541 passed, 0 known, 0 failed. The one-off Check step on it against origin/main: PASS, moved 03 class 8, 04 class 8, 07 class 1, 08 class 8, 08 class 50, 10 class 8. Planted on it (03's legal_name changed, README 07 "from" 481,300.00): FAIL naming both.
- Gap 1, in a temp clone of the stub commit: the line PASSES clean; with `Edited by hand` appended to 09-scarborough-robotics/profile.md and committed, it FAILS ("regenerated output differs from HEAD in reference/sample-clients/09-scarborough-robotics/profile.md"). With .git moved away it FAILS ("git diff could not run (exit 129 ...)"), never passes. An untracked file placed in 09 is removed by generate.mjs (it rewrites each folder), so the untracked check guards new generator output that is not committed.
- Gap 3, in the same clone: README with "- 04 class8:" fails the tie line naming the bullet ("a bullet under "Opening UCC moved" does not parse ...: - 04 class8: 21,400.00 to ..."); the plant lines also fail ("the unchanged copy fails first").
- On the spec branch (no registers yet): 531 passed, 10 failed, all build-dependent: R8 on 03, 04, 07, 08, 10; the three W16 tie lines; the two R11 lines. The new ARC-16 HEAD line passes.

## Validation
origin/main 31defba1 merged. `npm run typecheck` 0, `npm run lint` 0, `npm test` unit 2497 and db 545 passed (Node 24.21). Step 6b sweep on the stub: whole suite green, no test retired.

## For the Lead
- R8 gap: none; R8 models the incentive, including the 1.0 factor for 2024 to 2027.
- Running verify.mjs leaves every import.csv as CRLF on disk (generate then make-csv writes CRLF; git stores LF). F03's `src/contracts/taxprep.acceptance.test.ts` "RT-3 ARC-14 sample client 01's import.csv ... byte for byte" then fails ("already holds CR bytes") until the files are checked out again. Pre-existing, not W16's; checkers should run `npm test` before verify.mjs or restore the CSVs between them.
- Land order: R11 now says 541; whichever of W16 and another verify.mjs card lands second re-runs verify and re-counts.
