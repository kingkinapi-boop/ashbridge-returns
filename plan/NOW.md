# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 16:30Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, "turbo on" 13:26Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 78% of the week at 15:42Z, about 4% an hour: the limit comes about 21:00Z; then pause until Zo's saved reset and `go`.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims); 4 runs fired 16:25Z (train 2b and the queue). Laptop (decision 0026): designers 1 to 3; SC10 findings review (15:38Z); SC3 findings review and SC6 spec review (16:31Z).
- **Landed (59):** train 725bc456 at 15:20Z. Train 2 (6587e0a0) red on SC3's tests only (A500); train 2b (A04, CQ8, CQ9, CQ12) at 092598f3 requested 16:23Z.
- **Zo 3 Oct, Critic chat:** "critic ok" (decision 0027): design lane restarts; CQ11; no new repair card before W00c lands without a red or a measured waste.

## In flight

| Card | State | Next action |
|---|---|---|
| Train 2b | A04, CQ8, CQ9, CQ12 at 092598f3 | land if green (rehearsal: two vitest runs); then W00c's fresh check (A501), A04C build, FX18 spec, SC8 build, A08 and SC5 specs, CQ11 build |
| W00c | round 3 check FAIL on items 1 to 5 only (RC-A, RC-C): split to W00d (A501) | after train 2b lands: `claim.mjs update W00c build reported --worker lead` (fresh check of 75556283: npm test, mutation 100, flake, Opus read); land on PASS |
| SC3 | train 2 red on its tests (inventory lacks A04's create* exports; 6 db tests over FX12's budget; pg16 R65 twin let 4 of 6 through); build hold-findings | findings review (local Opus, from 16:31Z); then its round, Opus re-check, security re-review; FX17's build waits for SC3 |
| SC6 | spec patch reported (71 tests; N01.md fixed on main, A501) | Opus spec review (local, from 16:31Z), then reopen the build; Opus check |
| SC11 | round 2 spec reopened 16:23Z (A500: DB16.md restore, R116, R117) | spec reports: reopen the build (B1, B2); Opus read; security review; board |
| SC10 | Opus read FAIL, 7 items (local sc10-read e68b2986); build hold-findings | findings review (local Opus, from 15:38Z): Lead plan edits, then a spec patch |
| GL3 | round 4 spec working (A498) | reopen the build (B1 to B6); Opus check; fresh security review; board |
| G18 | round 2 spec reopened 16:10Z (A499: core, R1 R2 R3 R6, 39 pins) | spec reports: reopen the build (Opus, data only); third Opus check |
| CQ11 | spec reopened 16:23Z (A500: R82 clean merges) | build after CQ8 lands |
| FX8 | A493 spec patch reported | build after W00c lands (known.json, A481); then FX3's spec patch (A488) and build, FX4, FX5 round 3 (A494) |
| FX17, A04C | FX17 spec reported; A04C spec reported | FX17 build after SC3 lands; A04C build after A04 lands, Opus check |
| W00b, A08, FX6, FX18, SC5, SC12 | held `wait:` | reopen when W00c, A04, SC3, SC11 or SC5's deps land |
| JH0, S00, B04, SC2, FX7, S01 | wait for W00c (S01's reopened spec waits for S00) | builds after W00c lands; W00d after W00c |
| Design lane | base claude/design-base; rulings A485 | designers 1 (D13, D04), 2 (D03 B+), 3 (D02) local; then a panel per family; workbench brief check, designers 4 (D07, D05) and 5 (D08, D12) Sun 4 Oct; findings review Mon; sitting Tue 6 Oct |

## Next, in order

1. Poll claims; land train 2b if green; then W00c's fresh check; board each PASS (request at 6 cards or hourly).
2. W00c lands: W00b, S00, JH0, B04, SC2, FX7, FX8, W00d; SK0, W01 to W13 (decide reference/cpa-check.md item 43's eight flags before W01's spec, A499), W20, I40.
3. Findings rounds: SC3, SC10 (reviews running), then SC11, G18, GL3 (specs out).
4. Design lane as above (lane plan reports/design-lane-2026-10-03.md, section 4).
5. After W00c lands: G-family sample sweep; contract-ids.json's marker notes and BQ1.bn's flag (A498). After FX8 lands and the CPA answers items 37 to 39: the sample-facts card (A499). Taxprep day 6 Sun 4 Oct (O8 folded, A487).
6. Critic about 5 Oct; Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Watch out

- `.gitleaks.toml` edits go to Zo by hand (0021). Cloud boxes lack gitleaks; GitHub checks run it.
- No real client data: Assets/ is excluded from git (and so is any folder named assets on Windows): never commit it, never force-add.
- Local workers: a fresh name per dispatch (local-6 next), model opus for core jobs; use `next --roles` (CQ11). They cannot run `cmd //c rmdir`: the Lead removes each worktree's node_modules junction, then the worktree. Worktrees under .claude/worktrees resolve node_modules from the main checkout: `npm ci` there only when no local process runs.
- Path holds: a working spec and a reported build hold their Paths; next.mjs START ignores holds until CQ8 lands. After a findings round's spec reports, the Lead reopens the build.
- claim.mjs drops the Lead's reopen note on specs (CQ2 item 5): a bold directive at the top of the card; never a new Spec rule while its spec job works. Family cards: directives go in the card's slices `note` (A499).
- Mutation bar is 100 per `@mutate` file (testing.md, ARC-15).
- Network to GitHub drops now and then: retry a push up to three times.
- Landing: never rebase a train; merge main in; commit the ledger before the last merge; never force-push (a rebuilt train: delete claude/train, then push). The train worktree junction was refused (A483): run its tools tests with the main checkout's vitest; never retry the junction another way.
- Until SC11 lands, a pg16 run failing only on an unhandled 57P01 from a pool is main's flake: re-run once, report both (A500).
- Findings review before every fix round; a third failure parks or splits.
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`.
- Commit no new Taxprep CSV to main before FX9 lands (SC's R37, A415).
- A job released twice at one tip is held "needs Lead": re-release a check with a note starting "wait:", reopen a spec or build. Local workers skip cloud-only cards.
- Python edits: write a backslash as chr(92); write scripts with the Write tool (a long heredoc breaks bash); run `date -u` before writing any time.
- Local helpers never push (A492, A493): reports stay on local branches (a04-sec, sc6-findings, gl3-sec, gl3-findings, sc10-read, g18-findings, sc11-findings); never push them another way. One project per `vitest run` until CQ12 lands (A495).
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
