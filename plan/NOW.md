# NOW

True at every moment. 60 lines max. Last rewritten: 2 Oct 2026 05:58Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, decision 0018). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 05:26Z: 5h 32%, week 28%. Reviewer HOLD lifted (F00T landed eb311e1).
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp, up to 6 runs (queue repair 3 landed). Runs cannot notify: poll claims (ScheduleWakeup ~30 min). Laptop: the Lead plus up to 2 local workers (0018); local workers have no subagent tool, so core specs and checks go to the cloud (A331) and core checks done locally get a separate Opus read.
- **Zo:** to-do #1 is the design sitting (http://localhost:8765/, served from scratchpad/sitting by a python http.server; restart with `python -m http.server 8765` in that folder). Day 4 (Auto-fill, Zo) Sat 3 Oct. Decisions 0016 to 0019 today (0019: preparer pastes the diagnostics list; blueprint v1.2).
- **Landed (12 done):** F00, F05, F08, DG rounds 1 and 2, A05, W14, W15, F03, F00T, F05M, F09, queue repairs 1 to 3.

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Findings review: F03R, F04, F09A, S00 check FAILs (+ A01 mutation 91.6) | Opus findings reviewer | local | 2 Oct 05:58Z | text, to reports/ |
| Cloud queue: A01 check, S01 spec, DG round 3 spec, F01 build, TH build, E03 | up to 6 cloud runs | cloud | 2 Oct 05:26Z | claude/<card> |

## Next, in order

1. Findings review of F03R, F04, F09A, S00: record, update cards, reopen specs.
2. Board each PASS: F03R (core: Opus read in its check), S00 after its build and check, TH (its gitleaks scope ends A312), E03 after TH.
3. DG round 3 small: mutate-changed skips `__fixtures__` and `__golden__` for the marker (card note).
4. F09A amount grammar (with F09's four carried defects); F01 and F04 builds now possible; then I00, E01, A07, W20, SK0 unblock.
5. Taxprep: day 6 Sun 4 Oct (changes after lock, check export, roll forward, copy one full diagnostics panel); day 4 Zo Sat 3 Oct. FINDINGS interim (979363f).
6. Designs: Zo's sitting answers (Q1 to Q7) become decisions and fix cards; then D00, D01, D05.
7. B01 spec (reference/qbo/gfi-file.md, A305). W16 card to write (W14 KNOWN R8 fails on 03, 04, 07, 08, 10).

## Watch out

- Landing a train: MERGE origin/main into the train (never rebase --rebase-merges), run the code-diff guard, then ff main. Record done, release claims and delete branches only AFTER the push to main succeeded. Pushing a train straight to main is refused by the guard.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time, window in front and visible (Taxprep delivers downloads only while visible). QBO and iFirm sign out after a while: a walker that meets a sign-in page stops; ask Zo. Walkers never type passwords.
- Taking a helper branch: only the files in `git diff --name-only $(git merge-base main B) B`; plan/slices.json by `git merge-file`.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`; never `git add -A`. Other sessions (Critic, Reviewer) commit to main too: pull first.
- Subagents cannot write report files: record their text under reports/ yourself.
- Findings review before every fix round; a third failure parks or splits the card (F09 got a fourth, mutation-only round, A327).
- Never weaken redaction, permissions or security checks to pass a test (A329); a refused edit is not routed through another worker.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/ straight to main.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
