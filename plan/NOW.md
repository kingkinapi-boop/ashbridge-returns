# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 14:13Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, "turbo on" 13:26Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 69% of the week at 13:00Z (Critic): about Sunday morning.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims), 8 runs active 14:07Z. Laptop (decision 0026): designers 1 to 3 and the SC3 security re-review from 14:15Z. `npm ci` done 14:11Z in the main checkout (pg back).
- **Landed (57):** through FX15, CQ7, CQ6 (train df6f1249, 13:5xZ, 310ffa60). Train 725bc456 (FX5, FX12, CQ10) checking (cloud-bdd6e0, from 14:04Z).
- **Zo 3 Oct, Critic chat:** "critic ok" (decision 0027): design lane restarts; CQ11; no new repair card before W00c lands without a red or a measured waste.

## In flight

| Card | State | Next action |
|---|---|---|
| Train | 725bc456 (FX5, FX12, CQ10) checking | land if green; next train SC3 (after its security re-review), SC6, GL3, A04 as each passes |
| W00c | build round 3 (last) open but held: known.json (FX5 on the train, FX3's working spec) | taken once FX5 lands and FX3's spec reports; hold FX3's build until W00c's is taken (A481) |
| FX8, FX4 | builds held `wait:` (A481) | reopen FX8 when W00c's build is taken, then FX4 |
| A04 | round 5c built; check working (cloud-39d8f1) | PASS: security read, train; then A04C build, FX18 spec, SC8 build, A08 and SC5 specs |
| A04C | spec reported (G1 to G4) | build after A04 lands; Opus check |
| SC3 | check PASS at 8d0f21fc; security review 1 (09:27Z) FINDINGS, fixed by A452 and A458 | Opus security re-review (local), then board; FX17 build after SC3 lands |
| SC6, GL3 | builds reported, checks working | board each PASS; SC10 build follows SC6 (card-rules paths) |
| CQ8 | spec patch reported (13 tests); build round 2 working | fresh check; CQ11 spec after CQ8 lands |
| CQ9, SC11 | builds working | checks |
| CQ12 | spec reported; Paths gap fixed (A484) | build after FX12 lands (vitest.config.ts) |
| SC12, G18, FX3 | specs working | builds |
| S01 | spec reopened (A482) | waits for S00 (deps) |
| W00b, A08, FX6, FX18, SC5 | held `wait:` | reopen when W00c, A04 or SC5's deps land |
| JH0, S00, B04, SC2, FX7 | wait for W00c | builds after W00c lands |
| Design lane | base claude/design-base fe9b4e1e; brief re-check report; rulings A485 | designers 1 (D13, D04), 2 (D03 B+), 3 (D02) local; then a panel per family; workbench brief check, designers 4 (D07, D05) and 5 (D08, D12); findings review Mon; sitting Tue 6 Oct |

## Next, in order

1. Poll claims; land train 725bc456 if green; board every PASS; request a train hourly or at 6 cards.
2. W00c build, then W00c lands: W00b, S00, JH0, B04, SC2, FX7; SK0, W01 to W13, W20, I40 follow.
3. Design lane as above (lane plan reports/design-lane-2026-10-03.md, section 4).
4. Reviewer items in CQ11; G-family sample sweep carded; phase 3 and 4 card fixes (A437, A438, A447).
5. Taxprep: fold O8 into FINDINGS.md, CK-12 and RT-14; day 6 Sun 4 Oct.
6. Critic about 5 Oct; Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Watch out

- `.gitleaks.toml` edits go to Zo by hand (0021). Cloud boxes lack gitleaks; GitHub checks run it.
- No real client data: Assets/ is excluded from git (and so is any folder named assets on Windows): never commit it, never force-add.
- Cloud boxes need Node 24.21 or later; see .claude/cloud-worker-run.md.
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
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
