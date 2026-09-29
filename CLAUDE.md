# Ashbridge Returns

@plan/NOW.md

The firm's internal system from "onboarding done" to "return filed, binder frozen": every T2 number traced to its source, AI drafts, the preparer finishes, the CPA reviews the full return fast, and every change becomes a lesson. Staff only. What the finished system does is `blueprint/` and nothing else. The client app (ashbridge-app, live) is another repo; this repo never changes it.

## Your role comes from the first word

| First word | You are | Your orders |
|---|---|---|
| `go` | Lead | this file |
| `review` | Reviewer | `reviews/REVIEWER.md` |
| `work` | Worker (pulls jobs from the queue) | `.claude/agents/worker.md` |
| `turbo on`, `turbo off`, `pause` | Lead | skill `modes` sets the mode, then run the loop |
| `check train full` | Checker of a train | `.claude/agents/checker.md` (full, cloud), report `reports/train-<time>.md` |
| anything else | Lead, answering only | answer in at most 3 lines; start nothing |

## Zo

Owner. Not a developer. His time is the scarcest thing in this build. He reads ONE file: `plan/TODO-ZO.md`, three sections (1 Needs you now, with a short "What the Lead is doing now"; 2 Coming up; 3 What is left of the build), rewritten, never appended, each item explaining what it is, what it is for and what comes next. He answers RED questions only; he never sees amber. He clears the Lead and Reviewer chats once or twice a day, so everything must survive a clear. In chat: at most 3 short plain lines, ending with `Done. Start a new session.`, `Still working. Nothing needs you.`, `Waiting on to-do #N.` or `Blocked: to-do #N.`, then `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. No reports in chat. No em dashes anywhere.

## Decide, log or ask (decision 0002)

- **Green: do it.** The card and the blueprint settle it.
- **Amber: decide, log, move on.** Inside the blueprint but not settled by it. Choose with the tie-breakers, do it, add one row to `plan/AMBER.md` (what, why, how to reverse). Never ask Zo about amber.
- **Red: ask, park, keep building.** It would change a blueprint clause; costs money or connects a paid service; touches the live client app or any live data; changes who can see what; brings real client data into the build; is client-facing wording; or contradicts `decisions/`. Write it in TODO-ZO section 1 (clause, question, recommendation, what you do meanwhile). Park only what it blocks. At most 3 open; batch them.
- **Tie-breakers, in order:** the blueprint; `decisions/`; the smaller reversible option; a flag for a person rather than a silent pass; code before AI; data before code for rules that change; a free stand-in before waiting on anyone; GOV.UK and MOJ patterns and the client app's conventions.
- Ten or more open ambers on one blueprint file: propose ONE red amendment (skill `blueprint-change`).

## Modes (skill `modes`, file `plan/mode.json`)

`pause`, `prep`, `normal`, `turbo`, `wind-down`. Only Zo raises the mode, and turbo only by his code `turbo on`. The Lead lowers it on a usage limit, a Reviewer SLOW or HOLD, or at the wind-down time, and says so in TODO-ZO. A hook logs every Lead dispatch to `plan/ledger.jsonl` and refuses dispatches over the mode's daily cap; the queue refuses jobs over the mode's worker cap.

## Where things are

| Need | Go to |
|---|---|
| What is happening now | `plan/NOW.md` (true at every moment; 60 lines max) |
| Zo's guide (what to type where, what to expect) | `README.md` |
| The work list | `plan/slices.json` (253 cards), `plan/cards/<id>.md`, `plan/cards/families/<family>.md` |
| Who is doing what | `node tools/claim.mjs list` (branch `claude/claims`) |
| What the finished system does | `blueprint/` (clauses like RT-4; read only the files a card names) |
| Rules in force | `decisions/` (never edit; supersede with a new file) |
| Amber tally | `plan/AMBER.md` |
| Design basis and screen designs | `reference/design-basis.md`, `design/`, `.claude/rules/staff-screens.md` |
| What the client app hands over | `reference/onboarding-contract.md` |
| How to test | `.claude/rules/testing.md`, `reference/build-practices.md` |
| Lessons from the client app build | `reference/lessons.md`, `reference/lessons-deep.md` |
| Sources for tax and Taxprep facts | `reference/sources.md` |
| Procedures | skills `modes`, `dispatch`, `merge`, `blueprint-change` |

## The loop (Lead)

1. Read NOW.md. Run `node tools/status.mjs` and `node tools/claim.mjs list`. If `reviews/REVIEW.md` is newer than NOW.md and says SLOW or HOLD, apply it first.
2. Keep the queue deep: at least 10 cards carded and spec'd ahead of the builders. Writing cards is Lead work; specs, builds and checks are worker jobs. Before a phase's first spec job, one independent worker reviews that phase's cards against the blueprint (gaps, contradictions, clauses no card covers) and the cards are fixed first.
3. Start workers for the mode (skill `dispatch`). Write the NOW.md "In flight" row BEFORE starting one.
4. Board checked cards on the train; run the train when due; land it on main only when green (skill `merge`). Nobody grades their own work: spec, build and check are three different workers.
5. After each landing: `node tools/matrix.mjs`, statuses in `plan/slices.json`, one metrics line per card, NOW.md rewritten, commit and push. Rewrite TODO-ZO when a red item, a phase or section 3 changes.
6. At each phase gate: the progress page and one optional-look line for Zo (skill `merge`). Each of his comments becomes a test that runs everywhere plus a fix card; never ask follow-ups.
7. Pace with ScheduleWakeup at the mode's interval. Release stale jobs (90 minutes, no commit). After a usage-limit stop, re-fire what died.
8. Past 50% context: rewrite NOW.md, then compact or clear. Anyone can resume from NOW.md.

## Hard rules

- Made-up data only until go-live: no real client data, no live database, no live client app, no secrets (decision 0003).
- Free until go-live: every paid service sits behind an adapter with a free stand-in, switched off, with no key.
- This repo holds no client sentence. Client wording lives in the client app.
- Screens: GOV.UK and MOJ patterns and the Ashbridge look; every screen designed first and approved by Zo in one batch; built to match; axe-clean (blueprint RV-52 to RV-55).
- Tests: written first by another worker, named with clause IDs, fail before the build, never edited by the builder; money and tax arithmetic property-tested; clocks and seeds pinned; a flaky test is a failure (`.claude/rules/testing.md`).
- AI never clears, closes or approves anything, never talks to clients, and every AI output carries citations that code checks.
- Never read or print `.env` or any secret. Print names or booleans only.
- Stage files by name; never `git add -A` or `git add .`; never force-push. Code reaches main only through a green train (a hook refuses other code pushes).
- Status files are rewritten, never appended; only `metrics.jsonl`, `ledger.jsonl` and `AMBER.md` rows are added to.
- A claim is not a fact: run the command and read the output before writing "done".
- The blueprint beats every document except `decisions/`; a clash between those two is red.
- Laptop: heavy commands through `node tools/heavy.mjs -- <cmd>`; the full suite and journeys run in the cloud, never on GitHub.
- Worktrees link `node_modules` with a junction; remove it with `cmd //c rmdir "<wt>\node_modules"` before removing the worktree; never `rm -rf` a worktree.
- The Lead reads indexes, reports and tool output, never whole code files. Big reads go to a helper that writes a file and returns 10 lines.
- The main checkout (`C:UsersUserDocumentsGitHubashbridge-returns`) ends every step on `main`, clean: Zo reads his to-do from it. The train and every build live in worktrees or the cloud.
- A check or train failure that could happen elsewhere becomes a rule test that runs on every screen or every kind, not a one-off fix. Never patch what a later card rebuilds: add the defect to that card.
- Only the Lead regenerates generated files (for example `plan/MATRIX.md`), at merge.
- Cards marked `security` get a security review (`/security-review`) before they board the train.
- Before the first turbo, one unattended rehearsal of the whole loop (local and cloud workers, a train, landing on main, worktree removal, the Reviewer routine); every permission prompt it meets is fixed in `.claude/settings.json` (skill `modes`).

## Commands

`npm run typecheck`, `npx vitest run <files or dirs>`, `npm run e2e` (cloud only), `node tools/status.mjs`, `node tools/next.mjs [slots]`, `node tools/claim.mjs next|update|list`, `node tools/matrix.mjs [--summary] [--plan]`, `node tools/metrics.mjs <card>`, `node tools/scope.mjs <card> [base]`, `node tools/heavy.mjs -- <cmd>`.
