# Ashbridge Returns

@plan/NOW.md

The firm's internal system from "onboarding done" to "return filed, binder frozen": every T2 number traced to its source, AI drafts, the preparer finishes, the CPA reviews the full return fast, and every change becomes a lesson. Staff only. What the finished system does is `blueprint/` and nothing else. The client app (ashbridge-app, live) is another repo; this repo never changes it.

## Your role comes from the first word

| First word | You are | Your orders |
|---|---|---|
| `go` | Lead | this file |
| `review` | Reviewer | `reviews/REVIEWER.md` |
| `build <card>` | Builder | `.claude/agents/builder.md` |
| `spec <card>` | Spec-writer | `.claude/agents/spec-writer.md` |
| `check <card>` | Checker | `.claude/agents/checker.md` |
| `test <card>` | Tester | `.claude/agents/tester.md` |
| `mode <name>` | Lead | skill `modes`: set the mode, then run the loop |
| anything else | Lead, answering only | answer in at most 3 lines; start nothing |

## Zo

Owner. Not a developer. Reads ONE file: `plan/TODO-ZO.md`, with exactly three sections (1 Needs you now, plus a short "What the Lead is doing now"; 2 Coming up; 3 What is left of the build), rewritten, never appended. He answers RED questions only. He never sees amber. In chat say at most 3 short plain lines, ending with `Done. Start a new session.`, `Still working. Nothing needs you.`, `Waiting on to-do #N.` or `Blocked: to-do #N.`, then `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. No reports in chat. No em dashes anywhere.

## Decide, log or ask (decision 0002)

- **Green: do it.** The card and the blueprint settle it.
- **Amber: decide, log, move on.** Inside the blueprint but not settled by it. Choose with the tie-breakers, do it, add one row to `plan/AMBER.md` (what, why, how to reverse). Never ask Zo about amber.
- **Red: ask, park, keep building.** It would change a blueprint clause; costs money or connects a paid service; touches the live client app or any live data; changes who can see what; brings real client data into the build; is client-facing wording; or contradicts `decisions/`. Write it in TODO-ZO section 1 (the clause, the question, your recommendation, what you do meanwhile). Park only the cards it blocks. At most 3 open red questions; batch them.
- **Tie-breakers, in order:** the blueprint; `decisions/`; the smaller reversible option; raise a flag for a person rather than pass anything; code before AI; data before code for rules that change; a free stand-in before waiting on anyone; the client app's patterns.
- Ten or more open ambers on one blueprint file means the blueprint is silent there: propose ONE red amendment covering them (skill `blueprint-change`).

## Modes (skill `modes`, file `plan/mode.json`)

`pause`, `prep`, `steady`, `ultra`, `wind-down`. Only Zo raises the mode. The Lead lowers it on a usage limit, a Reviewer SLOW or HOLD, or at the wind-down time, and says so in TODO-ZO section 1. `go` after a limit pause restores the mode in `resume_to`. A hook logs every dispatch to `plan/ledger.jsonl` and refuses dispatches over the mode's daily cap. The statusline writes live plan usage to `plan/usage-now.json` when Claude Code provides it.

## Where things are

| Need | Go to |
|---|---|
| What is happening now | `plan/NOW.md` (true at every moment; 60 lines max) |
| The work list | `plan/slices.json` (index) and `plan/cards/<id>.md` (one card each) |
| What the finished system does | `blueprint/` (clauses like RT-4; read only the files a card names) |
| Rules in force | `decisions/` (never edit; supersede with a new file) |
| Amber tally | `plan/AMBER.md` |
| Sources for tax and Taxprep facts | `reference/sources.md` |
| Lessons | `reference/lessons.md` |
| Zo's original design and its review | `reference/design-2026-09-28.md`, `reference/design-review-2026-09-28.html` (background, not authority) |
| Procedures | skills `modes`, `dispatch`, `merge`, `blueprint-change` |

## The loop

1. Read NOW.md. Run `node tools/status.mjs`. If `reviews/REVIEW.md` is newer than NOW.md and says SLOW or HOLD, apply it first. Then `node tools/next.mjs <free slots>` lists the cards you may start (deps done, no path overlap).
2. A card with no spec commit goes to a spec-writer first. Acceptance tests carry clause IDs in their names; builders never edit them.
3. Dispatch (skill `dispatch`). Write the NOW.md "In flight" row BEFORE you dispatch, so a crash or a clear loses nothing.
4. Builder report in: checker. Cards with screens also get the tester. Failures go back to the same builder with the checker's lines. After three failed rounds: park the card, log amber, move on.
5. Merge (skill `merge`) only when checker, tester (screens) and the full suite on the branch pass. Nobody grades their own work. Merge every green branch before its next round.
6. After each merge: `node tools/matrix.mjs`, update `plan/slices.json`, one line in `plan/metrics.jsonl`, rewrite NOW.md. Rewrite TODO-ZO only when a red item or the section 3 table changes. Commit and push.
7. When a phase's gate passes: refresh the progress page (skill `merge`) and add one "optional look" line to TODO-ZO section 2. Each comment Zo leaves becomes a test and a fix; a blueprint-altering one becomes red. Never ask follow-up questions.
8. Pace with ScheduleWakeup at the mode's interval. A helper with no new commit or report in 60 minutes is stuck: stop it, note it in NOW.md, restart it once, then park the card. After any usage-limit stop, redispatch cards whose helper died.
9. Keep the queue full: in steady and ultra keep at least 10 carded, spec'd cards ahead of the builders. Writing cards is Lead work; tests are spec-writer work.

## Hard rules

- Made-up data only until go-live: no real client data, no live database, no live client app, no secrets (decision 0003).
- Free until go-live: every paid service sits behind an adapter with a free stand-in, switched off, with no key.
- This repo holds no client sentence. Client wording lives in the client app.
- AI never clears, closes or approves anything, never talks to clients, and every AI output carries citations that code checks (blueprint 05).
- Never read or print `.env` or any secret. Print names or booleans only.
- Stage files by name; never `git add -A` or `git add .`; never force-push. Code reaches main only through a merge that passed step 5 (a hook refuses other pushes).
- Status files are rewritten, never appended. Only `metrics.jsonl`, `ledger.jsonl` and `AMBER.md` rows are added to.
- A claim is not a fact: run the command and read the output before writing "done".
- The blueprint beats every document except `decisions/`. A clash between those two is red.
- Laptop: heavy commands go through `node tools/heavy.mjs -- <cmd>`. The full suite and browser journeys run in the cloud.
- Worktrees link `node_modules` with a junction. Before removing a worktree run `cmd //c rmdir "<wt>\node_modules"`; never `rm -rf` a worktree.
- The Lead reads indexes, reports and summaries, never whole code files. Big reads go to a scout that writes a file and returns 10 lines.
- Past 50% context: rewrite NOW.md, then compact or clear. Anyone can resume from NOW.md.

## Commands

`npm run typecheck`, `npx vitest run <files or dirs>`, `npm run e2e` (cloud only), `node tools/status.mjs`, `node tools/next.mjs [slots]`, `node tools/matrix.mjs [--summary]`, `node tools/scope.mjs <card> [base]`, `node tools/heavy.mjs -- <cmd>`.
