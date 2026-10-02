# S00 spec round 2 (cloud-3620d3, Opus 5.5): reported

Spec commit: 5f74392 on claude/S00. Validated on main 35dadb2 (origin/main merged; it differs from 86ebd54 only by plan/ledger.jsonl, no toolchain change).

Files: `src/modules/taxprep-sim/core/sim.acceptance.test.ts` (58 to 71 tests), `core/__fixtures__/harness.ts` (adds `extendedList()`, `YES_NO`, `RATE_CELL`, a `list` option on `makeSim`/`makeReturn`). Goldens unchanged.

Round 2 items:
1. Yes or no: `""` and `" "` on `IDENT.Ident240` holding Y reset it to N with a "replaced" line, N in "entered" and "all-input"; Y on the default N gives no line (FINDINGS Q20, run 2, 5D).
2. Rate `"0.2000"` into `CCACat.FD08C[1].FED.Ttw08cA2` imports with no line, exported as written; `"10.1"` in the class-number text cell replaces with a "replaced" line (RT-25).
3. O4: unknown field on a known form (`GFGBA.Ttwzzz1`), unknown form, copy index on a non-repeating cell (`GFBGII[2]...`, `GFGBA[1].Ttwgba64`) give CELL_NA; the rest imports.
4. Gap [4] with 2 copies and [2] with none refused, named unconfirmed.
5. [3] then [4] in one file on 2 copies creates both, no line.
6. `Café (Test)` exports 0xE9 in the header and name cell, no C3 A9, no BOM (RT-9).
7. The byte-order-mark test is deleted (S03 owns it); the header comment says S00's answer for UTF-8 and BOM files is not fixed.
8. Default-list descriptions: the "every description non-empty" loop is gone; three cells (Ttwgba64, Ttwgba72, Ttwgba127) must equal the day 2 export text, read from `rt-07-imported-default.csv`.
9. Property: rows now hand-made (amounts, text with é and a period, `""` and `" "` clears); a variant creates copies [1..3] by import; plus one example that F03-writer and hand-made files export the same.
10. All-zeros header test asserts GIFI_CASH = 5 and the return's own header.
11. Already-empty clear asserts no events (plus a `" "` variant).
12. ARC-15 marker test reads the first 5 lines, as mutate-changed does.
13. The source walk already skips `__fixtures__/`; nothing else needed.

Run: on the round-1 build (6c3dd67, kept on the branch) 68 of 71 pass; 3 fail for the right reason: the two yes or no reset tests (build empties the cell: "This cell has been emptied by the import.") and the descriptions test (build gives "GIFI code 1002"). On origin/main without the build all fail (module `../index` missing). Typecheck and lint clean; unit project 677 pass, only those 3 fail; db project 2 of 2 pass.

Ambers:
1. Yes or no and rate cells live in `extendedList()`, not `fixtureList()`, so the goldens and the property do not decide how an untouched yes or no cell is exported (the trial has not said); `IDENT.Ident240` chosen as it is a real yes or no cell (FINDINGS, ID form) not on F03's ignored list.
2. The yes or no reset tests start from Y (typed or imported); the trial's "replaced" line on a cell already at N is not tested.
3. Descriptions: the default list must carry Taxprep's export text; the builder's source is the day 2 exports (`gifi-dict-structure.csv` holds the GIFI cells); no description is required for cells the trial has not shown.
