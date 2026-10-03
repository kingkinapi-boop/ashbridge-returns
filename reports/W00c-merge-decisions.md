# W00c: SC rule failures after merging main (merge decisions)

3 Oct 2026, findings reviewer (Opus). Scratch merge of origin/main bec5aa39 into claude/W00c 62681e23 (not pushed); `npx vitest run tools/test`: 11 of 380 fail, all in tools/test/schema-contract-rules.test.mjs; the other 17 files pass. R18 passes (its scan covers src/contracts and src/modules; W00c's src/core/money.ts carries `// @mutate` anyway). R52 passes. Rule files: tools/test/schema-contract-rules.test.mjs ("rules"), tools/test/__fixtures__/schema-contract/known.json ("known").

**One root cause.** W00c brings `testworld/` to main for the first time, so every SC rule held PENDING or KNOWN on "testworld is not on main" now runs: five rows go stale, rules run on W00c's code, and W00c's own fixes (`-text` on the sample CSVs, no windows-1252 decoder) leave KNOWN entries stale. A second cause: two PENDING rows (R34-guard, R50-guard) key on the file `testworld/model/guard.ts`, which W00c carries unchanged from W00, while their real subject is W00b's exports (guardFolder, the guard Luhn).

| # | Test | Cause | Decision | Who |
|---|---|---|---|---|
| 1 | R35 PENDING rows stale (5) | subjects now exist | (a) delete W00c's rows R35, R51, R52-catalogue; re-key R34-guard and R50-guard to the export (`testworld/model/guard.ts#guardFolder`, `#<Luhn export>`), owner W00b, stale once the export exists; one plant case in the R35 PENDING plant test | W00c spec |
| 2 | R28 one amount table | money.ts: W00c's `refusalReason` keeps a private `(,\d{3})` regex (its own Stryker note says `s.includes(',')` already decides); guard.ts: PHONE10 and NINE_DIGITS capture groups `(\d{3})` hit the scanner | (b) build drops the regex, same reason text; (c) KNOWN R28 guard.ts owner W00b (a phone or SIN shape, not an amount; W00b's guard rewrite settles it, never by dodging the scanner) | W00c build; W00c spec adds the KNOWN row |
| 3 | R31 finding lists | timed out at 5 s under the full laptop run; passes alone (3.7 s, merged tree); loads src/contracts and src/modules only, which W00c does not touch | not W00c; a flake is a failure: give the test an explicit timeout like R50's 60 s | SC7 (edits the rules file) |
| 4 | R34 no real PII (35) | deliberate guard plants in W00c's tests: clients.acceptance.test.ts (2), load.test.ts (4), clients/made-up-data.acceptance.test.ts (7), model/guard.test.ts (22) | (a) one R34_PLANTED entry per file, each listing its exact problems and why (a guard plant); values stay real-looking (they test refusal) | W00c spec; W00b keeps the guard.test.ts and made-up-data lists exact when it edits them |
| 5 | R34 (widened) guardFolder | guard.ts exists, no guardFolder export yet (W00b builds it) | (c) PENDING by export (row 1); runs when W00b exports it | W00c spec now; W00b spec deletes the row |
| 6 | R37 line ends (17 stale) | W00c's `.gitattributes` line `reference/sample-clients/**/taxprep/*.csv -text` fixed the 15 sample CSVs (two with two problems) | (a) delete the 17 sample-clients R37 KNOWN entries; FX9 keeps reference/taxprep/** | W00c spec; FX9 card loses the sample-clients part |
| 7 | R38 decoder (1 stale) | W00c removed `new TextDecoder('windows-1252')` from taxprep.acceptance.test.ts | (a) delete that R38 KNOWN entry (owner FX6); FX7's Node 24 entry stays | W00c spec; FX6 card drops the item |
| 8 | R35 model checks | checks.ts#modelIssues: no test titled "planted ..." calls it; `modelIssues([])` throws (c.corporation undefined) | (a) spec adds one "planted ..." test calling modelIssues with a planted fault and one over an empty input expecting "nothing to check"; (b) build returns that issue on an empty input (not EMPTY_IS_FINE: a throw is not fine) | W00c spec, then build |
| 9 | R50 one Luhn | testworld/__fixtures__/sample-copy.ts has its own `luhnValid` ("independent, on purpose") | (a) the fixture imports `luhnValid` from reference/sample-clients/lib/util.mjs (a Luhn home, independent of guard.ts under test) | W00c spec (fixture) |
| 10 | R50 guard Luhn agrees | guard.ts exports no Luhn yet | (c) PENDING by export (row 1) | W00c spec now; W00b later |
| 11 | R51 loaders guarded | testworld/clients/load.ts and testworld/generate.ts read files; guardFolder and guardValue do not exist until W00b | (c) KNOWN R51 for both files, owner W00b (W00c's R51 PENDING row goes, row 1) | W00c spec adds; W00b wires both and deletes them |

No (d): nothing changes the end state. No rule is weakened (A329): every row either runs now or waits on an open card, and a PENDING row whose owner closes fails.

## Risks and re-tests
- Re-keyed PENDING rows: if W00b names the Luhn export without "luhn", the row never goes stale; it still fails once W00b is done (owner not open). W00b's spec must delete both rows and see R34 (widened) and R50 run.
- R34_PLANTED lists are exact: any W00b or W00c edit to those four test files must update them in the same commit.
- W00c's spec must validate on main's tip with `npx vitest run tools/test` green (plus its own suite), not on 78dd0eed.
- Card Paths tidy-up: W00c lists testworld/model/load.ts and testworld/model/money.ts, which do not exist (the loader is testworld/clients/load.ts).
