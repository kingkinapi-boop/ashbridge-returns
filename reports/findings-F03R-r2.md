# Findings review F03R, round 2 (2 Oct, Opus; text returned to the Lead and recorded here, condensed)

Root causes, all from card wording the spec copied:
- RC-A. The card loosened RT-3 to "a leading apostrophe" (A333) and never listed apostrophes inside numbers; the builder replaced main's digits-plus-apostrophe branch with startsWith("'") || startsWith("-'"), so `1'234`, `12'`, `-12'`, `1'2'3` read as text and the writer writes them. Bites: F09A amount-grammar.ts and reading.ts, S00 sim.ts:90, formatAmount, money.formatCents, W20, T01.
- RC-B. "Refuses a value whose read-back differs" cannot fire against a correct formatter, so under mutation 100 it was dropped (amber). The card named no test seam. Bites: any "defence in depth" core code (S00 writer, F09A, W20, T01; SC R24).
- RC-C. Two single-source lists shared entries by spread: 4 of 8 ALWAYS_EXPORTED entries cite the import-skip finding; the spec only checked "FINDINGS.md" and length over 20. Bites: S00 sim.ts:194, S02, S03, T01, T02, testworld.

Card wrong on RT-3: amended (A346, plain end state unchanged). Fix list (round 3, last): Lead L1 RT-3 text and check 1; L2 the readBackMatches seam. Spec S1 to S5, build B1 to B4, check with an Opus read then S00 checks 1, 2, 10 (all in plan/cards/F03R.md "Round 3"). No split. Not fixed (amber only): rate 123456789012.3456 refused with the wrong reason; NBSP-only text refused by the writer but read by the parser (writer stricter, safe).
Rule tests for SC: R29 refusal ratchet per parser; R30 every @writes module exports a read-back check with a planted mismatch; R31 no two finding lists share an entry.
Risks: B1 may refuse real text like `5'` (a visible refusal, acceptable); re-test S00 goldens and day 5 goldens; B3 treats -0 as 0 and compares rates as numbers; re-run the full suite and mutation per file.
