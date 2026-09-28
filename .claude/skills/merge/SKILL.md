---
name: merge
description: How a card's branch reaches main, how a card closes, and how the progress page is refreshed at a phase gate. Use for every merge.
---

# Merge and close

1. The branch has, on its latest commit: checker PASS; tester PASS if the card has screens; the full suite and journeys PASS (`check <card> full` in the cloud, or GitHub Actions); `node tools/scope.mjs <card>` clean.
2. `git fetch -q && git checkout -q main && git pull -q && git merge --no-ff origin/claude/<card> -m "Merge <card>: <title> (checker, tester, full suite pass)"`. A conflict: `git merge --abort`, then dispatch `build <card>` with one line "rebase on main".
3. `node tools/matrix.mjs`; in `plan/slices.json` set the card to `done` with the date; one line in `plan/metrics.jsonl`; rewrite NOW.md. Commit these on main. `git push origin main`.
4. Delete the branch: `git push origin --delete claude/<card>`. Remove any local worktree: junction first (`cmd //c rmdir "<wt>\node_modules"`), then `git worktree remove <wt>`.

Metrics line (never leave a field empty):
`{"card":"R07","closed":"2026-10-02","mode":"ultra","build_loops":1,"checker_fails":0,"tester_fails":0,"dispatches":4,"amber":1,"red":0,"accepted":true}`

## Phase gate
A phase is done when all its cards are done and its journey card (R19, R29, R39, R49, R59) passes for all twelve return kinds.
- Refresh the progress page: `reports/progress.html`, published with the Artifact tool to the same URL every time. Plain words: what works now, 3 to 6 screenshots from the latest journey run (made-up data), the matrix percentage, open ambers, what is next.
- One line in TODO-ZO section 2: "Optional look: <link>. Nothing waits on it."
- Zo's comments: each becomes a test that runs everywhere and a fix card; a blueprint-altering one becomes red. No follow-up questions.
