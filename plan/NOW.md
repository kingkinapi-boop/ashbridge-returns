# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 15:22Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, "turbo on" 13:26Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 74% of the week at 14:36Z: at this pace it runs out late tonight; then pause until Zo's saved reset and `go`.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims); 4 runs fired 15:22Z (train 2 and the queue). Laptop (decision 0026): designers 1 to 3; GL3 security review and SC10 Opus read (15:18Z); G18 findings review (15:22Z).
- **Landed (59):** train 725bc456 (FX12, CQ10, and FX5's code) at 15:20Z, main 04dbb004. FX5 stays open for round 3 (A494). Train 2 (A04, SC3, CQ8, CQ9) head 6587e0a0 requested 15:22Z.
- **Zo 3 Oct, Critic chat:** "critic ok" (decision 0027): design lane restarts; CQ11; no new repair card before W00c lands without a red or a measured waste.

## In flight

| Card | State | Next action |
|---|---|---|
| Train 2 | A04, SC3, CQ8, CQ9 requested 15:22Z | land if green (rehearsal: two vitest runs, A495); then A04C build, FX18 spec, SC8 build, A08 and SC5 specs; FX17 build; SC12 spec after SC11 lands |
| Train 3 | SC11 (check working) and whatever passes next | board each PASS; request hourly or at 6 cards |
| SC10 | Opus read FAIL, 7 items (landing traps in KNOWN and R89 owners, R86 reach, core read three ways; report local only: sc10-read e68b2986); build on hold-findings | findings review (local Opus, from 15:38Z): Lead plan edits first, then a spec patch; consistent with SC6's A493 fix |
| GL3 | security review FINDINGS: one medium, five lows (report local only: branch gl3-sec, 3fec0c11); build on hold-findings | findings review (local Opus, from 15:29Z); round 4 (the last): spec patch, build, check, security re-review |
| W00c | toolchain refit (FX12), then build round 3 (last) | FX8's spec patch (A493) once W00c's build is taken; then FX8's build, FX3's spec patch (A488) and build, FX4, FX5 round 3 (A494) |
| G18 | Opus read FAIL: 26 of 105 mappings wrong (reports/G18-check-opus.md on claude/G18-check, 1308ab4f); build on hold-findings | findings review (local Opus); fix list into the card; then its round |
| SC6, CQ11 | spec patches reopened (A493) | SC6 then an Opus check; CQ11's build after CQ8 lands |
| CQ12 | spec reopened: refit plus A495 (a groupOrder per vitest project) | build, check |
| FX17 | spec open | build after SC3 lands |
| A04C | spec reported (G1 to G4) | build after A04 lands; Opus check |
| W00b, A08, FX6, FX18, SC5, SC12 | held `wait:` | reopen when W00c, A04, SC3, SC11 or SC5's deps land |
| JH0, S00, B04, SC2, FX7, S01 | wait for W00c (S01's reopened spec waits for S00) | builds after W00c lands |
| Design lane | base claude/design-base; rulings A485 | designers 1 (D13, D04), 2 (D03 B+), 3 (D02) local; then a panel per family; workbench brief check, designers 4 (D07, D05) and 5 (D08, D12) Sun 4 Oct; findings review Mon; sitting Tue 6 Oct |

## Next, in order

1. Poll claims; land train 2 if green; board SC11 and each PASS; GL3 and SC10 after their findings rounds.
2. W00c refit and build, then W00c lands: W00b, S00, JH0, B04, SC2, FX7; SK0, W01 to W13, W20, I40 follow.
3. G18 findings review, then its round 2.
4. Design lane as above (lane plan reports/design-lane-2026-10-03.md, section 4).
5. G-family sample sweep after W00c lands; Taxprep day 6 Sun 4 Oct (O8 folded, A487).
6. Critic about 5 Oct; Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Watch out

- `.gitleaks.toml` edits go to Zo by hand (0021). Cloud boxes lack gitleaks; GitHub checks run it.
- No real client data: Assets/ is excluded from git (and so is any folder named assets on Windows): never commit it, never force-add.
- Local workers: a fresh name per dispatch (local-6 next), model opus for core jobs; use `next --roles` (CQ11). They cannot run `cmd //c rmdir`: the Lead removes each worktree's node_modules junction, then the worktree. Worktrees under .claude/worktrees resolve node_modules from the main checkout: `npm ci` there only when no local process runs.
- Path holds: a working spec and a reported build hold their Paths; next.mjs START ignores holds until CQ8 lands. After a findings round's spec reports, the Lead reopens the build.
- claim.mjs drops the Lead's reopen note on specs (CQ2 item 5): a bold directive at the top of the card; never a new Spec rule while its spec job works.
- Mutation bar is 100 per `@mutate` file (testing.md, ARC-15).
- Network to GitHub drops now and then: retry a push up to three times.
- Landing: never rebase a train; merge main in; commit the ledger before the last merge; never force-push. The train worktree junction was refused (A483): run its tools tests with the main checkout's vitest; never retry the junction another way.
- Findings review before every fix round; a third failure parks or splits.
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`.
- Commit no new Taxprep CSV to main before FX9 lands (SC's R37, A415).
- A job released twice at one tip is held "needs Lead": re-release a check with a note starting "wait:", reopen a spec or build. Local workers skip cloud-only cards.
- Python edits: write a backslash as chr(92) (a heredoc halves a doubled one); run `date -u` before writing any time.
- Local helpers never push: the A04 security and SC6 findings report pushes were refused (A492, A493); they stay on local branches a04-sec and sc6-findings; never push them another way. One project per `vitest run` until CQ12 lands (A495).
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
