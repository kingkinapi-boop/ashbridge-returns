# NOW

True at every moment. 60 lines max. Last rewritten: 28 Sep 2026, late evening.

## State

- Mode: prep (plan/mode.json). Ultra is Zo's to unleash, planned for 1 Oct.
- Blueprint v1 DRAFT, waiting on Zo (TODO-ZO 1). Decision 0006 is proposed, not in force.
- Repo: local git only, no remote. Zo creates GitHub `kingkinapi-boop/ashbridge-returns` (TODO-ZO 3); then: `git remote add origin https://github.com/kingkinapi-boop/ashbridge-returns.git && git push -u origin main`, create the cloud slots (skill `dispatch`), and try one tiny cloud run.
- Nothing is built. The first 5 cards are written (P01, R00 to R03); the other 54 are listed in plan/slices.json.
- Budget: Max 20x, weekly resets Thu 1 Oct and Thu 8 Oct, plan ends Sat 10 Oct (read as October, amber A9); Zo has one extra reset; $240 cloud credit (how it is spent is unclear, decision 0004 M-5).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| none | | | | |

## Next, in order

1. P01 (scout, read-only in ashbridge-app): the client-app contract.
2. Write cards R04 to R16 (phases 1 and 2) so ultra starts with at least 25 written and 10 spec'd.
3. After "1 blueprint ok": write the decision that puts 0006 in force; set slices.json blueprint to v1.
4. After "3 done": push, cloud slots, one tiny cloud run to prove routines work on this repo.
5. After "2 yes": switch on `.github/workflows/checks.yml` (R00 writes it off) and create the `returns-review` routine.
6. R00 scaffold, locally (sonnet), as soon as the blueprint is ok.

## Watch out

- Another Lead session works in ashbridge-app. Never write there; scouts read only.
- Prep caps dispatches at 15 a day (budget hook). Keep prep light: little plan usage is left before 1 Oct.
- The statusline writes plan/usage-now.json only if Claude Code sends usage numbers; if the file stays empty, pace by the ledger.
