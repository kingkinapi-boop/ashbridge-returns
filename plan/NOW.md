# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 21:09Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, "turbo on" 13:26Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 78% of the week at 15:42Z, about 4% an hour: the limit comes about 21:00Z; then pause until Zo's saved reset and `go`.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims and `list_runs`). 4 queue runs fired 17:36Z. Laptop (decision 0026): designers 1 to 3. 
- **Landed (66):** train 3 (A04C, CQ11, FX14; checked f4e43c51) on main b151c592 at 20:45Z by the Lead; auto mode refused the bookkeeping until Zo's `go` at 21:06Z (A524).
- **Zo 3 Oct, Critic chat:** "critic ok" (decision 0027): design lane restarts; CQ11; no new repair card before W00c lands without a red or a measured waste.

## In flight

| Card | State | Next action |
|---|---|---|
| Train 4 | SC8 and GL3 boarded (5de37d09) (69dd4084; scope flag by design, A523) | add SC10, GL3 on PASS of their Opus reads, W00c on its mutation check; request at 6 cards or hourly |
| B04 | A507 spec patch reported (c17bd825; A510) | build held `wait:` until W00c lands; Opus check |
| A08 | spec review GAPS 11 (A509): spec patch reopened | build after it; then Opus check and a security review |
| W00c | findings review 4 done (A521): no build round; mutation-only check of 75556283 in shards, union of kills | check opened (cloud); land on 100 on all 11 files; W00d makes the method a tool |
| SC10 | round 2 check PASS | Opus read of the landing form (local, from 21:10Z); board on PASS |
| SC6 | round 3 spec reported (168 tests); build marked reported 21:30Z | Opus check against the stated grammar; board; a fourth R77 failure splits SC6a and SC6b |
| SC3 | S4 needs index.ts state on globalThis (A517): spec held `wait:` until SC11 lands | then index.ts joins Paths, round 3 build item, Opus read, security review |
| G18 | A505 spec patch reported (77 tests) | build (Opus, data only); third Opus check; fill the card's Spec commit line |
| SC11 | round 3 spec reported (21 tests); build reopened 21:07Z (B3 to B14) | Opus read; security review; board; then SC3 round 3 (A517) |
| GL3 | Opus read and security review PASS (A525) | boarded train 4 at 21:15Z |
| SC5 | findings review 1 done (A514): round 2 spec S1 to S5, no build | spec held `wait:` until W00c lands; then build marked reported; Opus check |
| A08 | build reported (218 of 218) but mutation under 100 (call.ts, index.ts, scan.ts) | findings review (local Opus, from 21:30Z); check held `wait:` |
| FX7, W00d, FX16 | FX7 A520 patch reported (94 tests): second Opus spec review (local, from 21:10Z), build held `wait:`; W00d spec reopened 21:07Z for A521 (the A517 data job reported) | builds after W00c lands |
| FX8 | A493 spec patch reported | build after W00c lands; then FX3's spec patch (A488) and build, FX4, FX5 round 3 (A494) |
| W00b, FX6, FX18, SC12, FX17 | held `wait:` (FX17 builds after SC3 lands, re-merging main) | reopen when W00c, SC3 or SC11 land |
| JH0, S00, B04, SC2, FX7, S01, W00d | wait for W00c (JH0's refit splits five multi-world tests; S00 classifies createSimulator if SC3 lands first, A504) | builds after W00c lands |
| Design lane | base claude/design-base; rulings A485 | designer 1 done (claude/design-queues-record-3, A512), its panel done (A516); designer 2 done (D03 B+, claude/design-source-viewer-3, A519), its panel done (A522, local branch panel-source-viewer-3); designer 3 (D02) local, then its panel; designers 4 (D07, D05) and 5 (D08, D12) Sun 4 Oct; findings review Mon; sitting Tue 6 Oct |

## Next, in order

1. Poll claims and runs; A04C build, FX18 spec, SC8 build, A08 and SC5 specs, CQ11 build are open since A04 and CQ8 landed; board each PASS.
2. After each no-build spec patch reports (SC10, SC6, SC3): `claim.mjs update <card> build reported --worker lead` so the Opus check opens.
3. W00c lands: W00b, S00, JH0, B04, SC2, FX7, FX8, W00d; SK0, W01 to W13 (decide reference/cpa-check.md item 43's flags before W01's spec, A499), W20, I40.
4. Before SC7's spec: name the card that marks GL1's 6 auth files (A502). After SC10 lands: the push guard gains the card rules and schema contract rules files (A502).
5. Design lane as above (lane plan reports/design-lane-2026-10-03.md, section 4). Taxprep day 6 Sun 4 Oct (O8 folded, A487).
6. After W00c lands: G-family sample sweep; contract-ids.json's marker notes and BQ1.bn's flag (A498). After FX8 lands and the CPA answers items 37 to 39: the sample-facts card (A499).
7. Critic about 5 Oct; Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Watch out

- `.gitleaks.toml` edits go to Zo by hand (0021). No real client data: Assets/ is excluded from git (and so is any folder named assets on Windows): never commit it, never force-add.
- Local workers: a fresh name per dispatch (local-6 next), model opus for core jobs. They cannot run `cmd //c rmdir`: the Lead removes each worktree's node_modules junction, then the worktree. Local helpers never push (A492, A493): reports stay on local branches (a04-sec, sc6-findings, sc6-spec-review, gl3-sec, gl3-findings, sc10-read, sc10-findings, g18-findings, g18-spec-review, sc11-findings, sc3-findings); never push them another way.
- Path holds: a working spec and a reported build hold their Paths. claim.mjs drops the Lead's reopen note on specs: a bold directive at the top of the card. Family cards: directives go in the card's slices `note` (A499).
- A directive never writes the tags label or a harness file path where a card rule reads it: write the forms in words (A502).
- Family cards' checks run Stryker by file name until SC7 lands (checker.md, A502). Parallel db tests: test:flake with TEST_DB=pg16 (A504). At boarding, run the tools/test rule files on the train worktree (A504).
- Before parking a card, move every row it owns in an owner list (KNOWN lists, R89's guard list, data/question-coverage.json; A505).
- Mutation bar is 100 per `@mutate` file (testing.md, ARC-15). Findings review before every fix round; a third failure parks or splits.
- Landing: never rebase a train; merge main in; commit the ledger before the last merge; never force-push (a rebuilt train: delete claude/train, then push). The train worktree junction was refused (A483): run its tools tests with the main checkout's vitest.
- Until SC11 lands, a pg16 run failing only on an unhandled 57P01 from a pool is main's flake: re-run once, report both (A500).
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker. Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`. Network to GitHub drops now and then: retry a push up to three times.
- Commit no new Taxprep CSV to main before FX9 lands (A415). One project per `vitest run` until CQ12 lands (A495). A job released twice at one tip is held "needs Lead": re-release a check with a note starting "wait:", reopen a spec or build.
- Python edits: write a backslash as chr(92); write scripts with the Write tool (a long heredoc breaks bash); run `date -u` before writing any time.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time.
