# W14 spec, fix round 1 (cloud-4ab7b4, Opus): commit a8a100e on claude/W14, validated on main 2cb2159

1. `reference/sample-clients/verify.mjs` rewritten: the `"<id>: <label>"` check is gone; ids come from new `contract-ids.json` (46 question ids, 92 fact ids, each cited to its line of `reference/onboarding-contract.md` and checked against that line); rules R5 to R10 run on every folder and R11 on the README, each first proven on a sample-copy plant (YE2.phone, `BQ2.earn: What the business sold`, prior income doubled, balance owing neither paid nor carried, 2,600 and 1,480, instalments removed, prior balances emptied, accounts count two short); 11 gains an instalments check, 12 its prior balances traced to fact-keyed conversation answers. README: rows 11 and 12, planted issues, the rule-check line (counts left to the build).
2. Clauses: END-6 (R5, R6), END-2 (R7, R8, R9), END-9 (R10), ARC-8 (R11). Before build round 2: 356 passed, 5 known, 19 failed, all on 11 and 12 content, their plants' unchanged copies, and the README counts; nothing fails on 01 to 10. Typecheck, lint and `npm test` (unit 164, db 2) green; validated on main 2cb2159.
3. KNOWN (01 to 10, never silent; `KNOWN` table in verify.mjs): R8 on 03, 04, 07, 08, 10 (opening accumulated amortization and UCC with no asset register). Proposed fix card W16: asset registers for 03, 04, 07, 08, 10 in their answer keys, regenerated so R8 recomputes. A KNOWN entry that starts passing is a FAIL.
4. Amber: family ids (ARB.*, INC3.*, PY1.* and the rest) left out because ashbridge-app was not reachable from this cloud session (no family member read from source); slash shorthand (BQ1.bn/date) read as separate ids; screen answers carry a fact id in `what_it_resolves` (a stand-in for fact-list wording); R8 takes the first-year rule from each asset (half-year, or aii at 1.5 before 2024 and 1.0 for 2024 to 2027) with one cent per year of tolerance; R7 and R9 do not apply where there is no `prior_year` (01 to 10, 12) and say so on the line; with 12's planted money unchanged, its opening retained earnings balance at 0.00.
5. New data shapes the builder must write: `prior_year.incomeStatement`, `.retainedEarnings`, `.balanceOwing`; answer key `assets`; 12's `source` on prior balances and opening rows, `balancing: true` only on GIFI 3600.

## Permission gaps
None. The main checkout had uncommitted `plan/ledger.jsonl` on claude/TH, so the work ran in a separate worktree (/home/user/wt-W14) and the checkout was not touched.

## Model
Opus 5.5 (claude-opus-5-5).
