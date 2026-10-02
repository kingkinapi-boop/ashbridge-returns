---
name: merge
description: How checked cards reach main through the train (a batch branch tested in the cloud), how a card closes, and how the progress page is refreshed at a phase gate. Use for every merge.
---

# Merge: the train

Main only ever moves to a commit that passed the full suite and every journey in the cloud. Cards reach it in batches (the train), so the expensive cloud run happens once per batch, not once per card. All train work happens in its own worktree, `.claude/worktrees/train`: the main checkout stays on `main`, clean, because Zo reads his to-do from it.

## 1. Board the train
A card boards when, on its latest commit: check PASS (from a worker that did not spec or build it); GitHub checks green (typecheck and unit tests); `node tools/scope.mjs <card>` clean; its acceptance tests unchanged since the spec commit; and, for a card marked `security`, a clean security review.
```
W=.claude/worktrees/train
git fetch -q origin
[ -d $W ] || git worktree add -q $W origin/main
git -C $W checkout -q -B train origin/claude/train 2>/dev/null || git -C $W checkout -q -B train origin/main
git -C $W merge --no-ff origin/claude/<card> -m "Merge <card>: <title> (spec, build, check by three workers)"
git -C $W push -q origin train:claude/train
```
A conflict: `git merge --abort`, release the card's build job with the note "rebase on main", and it goes back in the queue.

## 2. Run the train
When due (mode table: every 3 green cards in normal, 6 or hourly in turbo): fire a cloud check of the train (`check train full`): `npm ci`, typecheck, the full unit suite, every journey for every kind built so far, mutation tests on changed core modules. Report in `reports/train-<time>.md` on `claude/train`.

## 3. Land it
- Green: main has always moved (the train checker and the Lead push docs to main), so rebuild the train on main in the train worktree and land it only if the code is the checked code:
```
W=.claude/worktrees/train; H=$(jq -r .head plan/train.json)   # the checked train commit
git fetch -q origin && git -C $W checkout -q -B train origin/claude/train
git -C $W merge -q --no-ff origin/main -m "Train: bring in main before landing"   # never rebase: it replays card history
git -C $W diff --name-only $H train -- . ':!plan' ':!reports' ':!reference' ':!decisions' ':!blueprint' ':!reviews' ':!.claude' ':!CLAUDE.md' ':!README.md'   # must print nothing
git pull -q --ff-only && git merge -q --ff-only train && git push -q origin main
```
  If the guard prints any path, main gained code since the check: request a new train check instead. Record done, release claims and delete branches only after the push to main succeeded. Then for each card: `node tools/metrics.mjs <card>` appends its metrics line; `plan/slices.json` status done with the date; `node tools/claim.mjs update <card> build released --worker lead --note merged`; `node tools/matrix.mjs`. Rewrite NOW.md. Commit these on main and push. Delete merged card branches, and delete the train (`git push origin --delete claude/train`) so the next one starts from the new main.
- Red: the report names the failing journey or test and module. Rebuild the train from main without the card that owns that module and re-run. If two cards interact and removing one does not help, halve the boarded cards, land the green half, and run the pair one after the other. Then a findings review (CLAUDE.md loop 4) before the card's next round. Never land a red train; never fix on the train itself.

Metrics line (never leave a field empty; 0 is a value):
`{"card":"F03","closed":"2026-10-02","mode":"turbo","rounds":1,"check_fails":0,"train_fails":0,"jobs":3,"tokens":0,"minutes":0,"amber":1,"red":0,"accepted":true}`
`rounds` is build rounds (builds reported in the claims history), not jobs; `minutes` runs from the first claim to the landing push; `jobs` counts every claim including refits and releases (Review 2 Oct).

## Phase gate
A phase is done when all its cards are merged, its gate (`plan/TODO-ZO.md` section 3) is met, its journeys pass on main, and a cold sign-off (`.claude/agents/signoff.md`, fresh Opus, no history) says SIGNED OFF.
- Refresh the progress page: `reports/progress.html`, published with the Artifact tool to the same URL every time: in plain words what works now and what it is for, 3 to 6 screenshots from the last journey run (made-up data), clause coverage, open ambers, what is next and why.
- One line in TODO-ZO section 2: "Optional look: <link>. Nothing waits on it."
- Zo's comments: each becomes a test that runs on every screen or every kind, plus a fix card; a blueprint-altering one becomes red. No follow-up questions.
