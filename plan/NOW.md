# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 17:35Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, "turbo on" 13:26Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 78% of the week at 15:42Z, about 4% an hour: the limit comes about 21:00Z; then pause until Zo's saved reset and `go`.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims and `list_runs`). SC11's build cloud-7c6fec (cse_01BHfxxvYJHN5tJWuHXbzZJD) runs test:flake on pg16; 4 queue runs fired 17:36Z. Laptop (decision 0026): designers 1 to 3; GL3 spec review (16:58Z).
- **Landed (63):** train 2b (A04, CQ8, CQ9, CQ12; checked 092598f3) on main ba6d7ee5 at 17:30Z. Auto mode refused the Lead's landing push at 17:25Z; Zo ran the fast-forward and push himself. Never route around that refusal: at each next landing, put the commands in TODO-ZO and wait for Zo (or a settings rule he adds).
- **Zo 3 Oct, Critic chat:** "critic ok" (decision 0027): design lane restarts; CQ11; no new repair card before W00c lands without a red or a measured waste.

## In flight

| Card | State | Next action |
|---|---|---|
| Train 3 | empty | board each PASS; request at 6 cards or hourly; landing needs Zo's hand (see State) |
| W00c | round 3 check FAIL on items 1 to 5 only: split to W00d (A501) | fresh check of 75556283 opened 17:36Z; board on PASS |
| SC10 | findings review 1 done (A502): Lead plan commit on main; round 2 spec patch P1 to P8, no build | spec reopened 17:35Z (Opus); after it reports, mark the build reported by hand; Opus check on the landing form |
| SC6 | spec review GAPS (A503): second spec patch G1 to G8 plus grammar coverage | spec reopened 17:35Z (Opus); after it reports, mark the build reported by hand; Opus check |
| SC3 | findings review 1 done (A504): round 3 is spec patch S1 to S3, no build | spec reopened 17:36Z; then mark the build reported; Opus read; security review |
| G18 | spec review GAPS (A505): three plant fixes | spec reopened 17:35Z (Opus); then the build (Opus, data only); third Opus check; fill the card's Spec commit line |
| FX14 | spec reopened 17:35Z (A504: the walker counts test.each bodies; build held) | build after the spec |
| SC11 | round 2 build taken 16:59Z by cloud-7c6fec | Opus read; security review; board (scope note b accepted by hand, A500) |
| GL3 | spec review 4 GAPS (A506): second spec patch G1 to G4 reopened | then reopen the build (B1 to B6); Opus check; fresh security review |
| CQ11 | spec reopened (A500: R82 clean merges) | build after CQ8 lands |
| FX8 | A493 spec patch reported | build after W00c lands; then FX3's spec patch (A488) and build, FX4, FX5 round 3 (A494) |
| FX17, A04C | FX17 spec reported (re-merges main after SC3, A504); A04C spec reported | FX17 build after SC3 lands; A04C build after A04 lands, Opus check |
| W00b, A08, FX6, FX18, SC5, SC12 | held `wait:` | reopen when W00c, A04, SC3, SC11 or SC5's deps land |
| JH0, S00, B04, SC2, FX7, S01, W00d | wait for W00c (JH0's refit splits five multi-world tests; S00 classifies createSimulator if SC3 lands first, A504) | builds after W00c lands |
| Design lane | base claude/design-base; rulings A485 | designers 1 (D13, D04), 2 (D03 B+), 3 (D02) local; then a panel per family; designers 4 (D07, D05) and 5 (D08, D12) Sun 4 Oct; findings review Mon; sitting Tue 6 Oct |

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
- Commit no new Taxprep CSV to main before FX9 lands (A415). One project per `vitest run` until CQ12 lands (A495).
- A job released twice at one tip is held "needs Lead": re-release a check with a note starting "wait:", reopen a spec or build.
- Python edits: write a backslash as chr(92); write scripts with the Write tool (a long heredoc breaks bash); run `date -u` before writing any time.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time.
