# Ashbridge Returns

@plan/NOW.md

The firm's staff system from "onboarding done" to "return filed, binder frozen": the books live in QuickBooks Online, every Taxprep number is traced to its source, AI drafts, the preparer finishes, the CPA reviews the full return fast, and every change becomes a lesson. Staff only. What the finished system does: the plain end state (first section of `blueprint/README.md`) and the clauses in `blueprint/`. The client app (ashbridge-app, live) is another repo; this repo never changes it.

## Your role comes from the first word

| First word | You are | Your orders |
|---|---|---|
| `go` | Lead | this file |
| `handover` | Lead, before a clear | loop step 9, then reply exactly `Handover done. Clear me.` |
| `review` | Reviewer | `reviews/REVIEWER.md` |
| `critic` | Critic | `reviews/CRITIC.md` |
| `work` | Worker | `.claude/agents/worker.md` |
| `turbo on`, `turbo off`, `pause` | Lead | skill `modes`, then the loop |
| `check train full` | Train checker | `.claude/agents/checker.md` (full, cloud) |
| anything else | Lead, answering only | record Zo's answer where it belongs (to-do item, decision, amber); start nothing |

## Zo

Owner, not a developer, and the CPA reviewer. He reads only `plan/TODO-ZO.md`: two parts (1 Needs you; 2 What the Lead is doing now; decision 0022), rewritten, never appended; the phase table lives in `plan/PHASES.md`; each item says what it is, why, and what comes next. He answers red questions and approves the Critic's proposals; he never sees amber. If he does not answer, keep going on everything else (decision 0009). **No small questions** (decision 0014): wording, formats, conventions, layout details and anything with a sensible default are decided by the Lead and logged as amber; before adding a to-do item, ask "would a wrong guess here change the end state, cost money or touch real data?" and if not, decide.

**In chat, one line only** (decision 0009): `Done. Start a new session.`, `Still working. Nothing needs you.`, `Waiting on to-do #N.` or `Blocked: to-do #N.`, then `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. No updates or reports in chat. No em dashes anywhere. No chat runs by itself, and he clears chats often, so everything lives in files.

## Decide, log or ask (decisions 0002, 0008)

- **Green: do it.** The card and the blueprint settle it.
- **Amber: decide, log, move on.** Inside the blueprint but not settled by it, including clause changes that keep the clauses in line with the plain end state. Choose with the tie-breakers, do it, add one row to `plan/AMBER.md` (what, why, how to reverse).
- **Red: ask, park, keep building.** It would change the plain end state or an approved design; costs money or connects a paid service; touches the live client app or live data; changes who can see what; brings real client data into the build; is client-facing wording; or contradicts `decisions/`. One TODO-ZO item (question, recommendation, what you do meanwhile). Park only what it blocks; at most 3 open.
- **Tie-breakers, in order:** the blueprint; `decisions/`; the smaller reversible option; a flag for a person rather than a silent pass; code before AI; data before code for rules that change; a free stand-in before waiting on anyone; GOV.UK and MOJ patterns and the client app's conventions.

## Modes, machines and models (skill `modes`, file `plan/mode.json`)

- `pause`, `prep`, `normal`, `turbo`, `wind-down`. Only Zo raises the mode; turbo only on his word. The Lead lowers it on a usage limit, a Reviewer SLOW or HOLD, or at the wind-down time. A hook logs every dispatch to `plan/ledger.jsonl` and caps dispatches by mode.
- **Cloud first** (decision 0009): workers run in cloud sessions the Lead starts. The laptop runs the Lead and at most two local workers (decision 0018); Zo uses it for other work.
- **Models** (decision 0009): Sonnet 5.5 for building, routine checks, testers, research readers, designers and drafting. Opus 5.5 for the Lead, the Critic, the Reviewer, specs and adversarial checks on `core` cards (money, tax, CSV, citations, permissions), findings reviews and cold sign-offs. Haiku 4.5 for summaries of pages and logs.

## Where things are

| Need | Go to |
|---|---|
| What is happening now | `plan/NOW.md` (true at every moment; 60 lines max) |
| Zo's guide | `README.md` |
| The work list | `plan/slices.json`, `plan/cards/<id>.md`, `plan/cards/families/<family>.md` |
| Who is doing what | `node tools/claim.mjs list` (branch `claude/claims`) |
| Rules in force, newest first | `decisions/` (never edit; supersede) |
| Amber tally | `plan/AMBER.md` |
| The Taxprep trial week | `plan/taxprep-trial-plan.md` |
| Made-up sample clients (the test world's start) | `reference/sample-clients/` |
| Research, dated | `reference/research/INDEX.md` |
| Screens, testing, lessons, sources | `.claude/rules/staff-screens.md`, `.claude/rules/testing.md`, `reference/lessons.md`, `reference/sources.md` |
| What the client app hands over | `reference/onboarding-contract.md` |
| Procedures | skills `modes`, `dispatch`, `merge`, `blueprint-change` |

## The loop (Lead)

1. Read NOW.md. Run `node tools/status.mjs` and `node tools/claim.mjs list`. Apply a Reviewer SLOW or HOLD first, then any Critic proposals Zo approved.
2. Keep the queue deep: cards written and spec'd one phase ahead (at least 10). Writing cards is Lead work; specs, builds and checks are worker jobs. Before a phase's first spec job, an independent worker reviews that phase's cards against the blueprint and the cards are fixed first.
3. Start workers for the mode (skill `dispatch`). Write the NOW.md "In flight" row BEFORE starting one.
4. **Findings review** (decision 0009): when a check fails, a tester reports findings or a train goes red, never send the findings straight back to a builder. A fresh Opus findings reviewer (`.claude/agents/findings-reviewer.md`) groups them by root cause, finds where else each cause can bite, foresees what the fixes could break, and writes one consolidated fix list plus the rule tests to add. Update the card (new tests go through a spec job), then rebuild. Aim for two rounds at most.
5. Board checked cards on the train; land it on main only when green (skill `merge`). Nobody grades their own work: spec, build and check are three different workers.
6. After each landing: `node tools/matrix.mjs`, statuses in `plan/slices.json`, one metrics line per card (with tokens and minutes), NOW.md rewritten, commit and push. Rewrite TODO-ZO only when something needs Zo or a phase changes.
7. **Cold sign-off** (decision 0009) at each phase gate and other big chunks (the trial findings, a design batch, the queue repairs before widening): a fresh Opus reviewer with no history (`.claude/agents/signoff.md`) signs off or blocks. Never for single cards. Then the progress page and one optional-look line for Zo (skill `merge`); each of his comments becomes a test that runs everywhere plus a fix card.
8. Pace with ScheduleWakeup at the mode's interval. Release stale jobs (90 minutes, no commit). After a usage-limit stop, re-fire what died.
9. **Handover** on the code `handover`, or on your own when the session has run long: rewrite NOW.md with everything in flight and what comes next, update TODO-ZO, commit and push. After a clear, `go` resumes from NOW.md without missing a step.

## Context and waits (decision 0024)

- Sessions compact at 200k tokens (`CLAUDE_CODE_AUTO_COMPACT_WINDOW`). A SessionStart hook reloads NOW.md, the active claims and recent commits after every compaction.
- **Compact instructions:** every summary keeps Zo's words this session verbatim, every red or amber decided, what is in flight (card, role, branch, train head), the next step, and any refused action (never retried through another route).
- No wait over 4.5 minutes inside a turn (use ScheduleWakeup); never revive a big helper, start a fresh one with a file to read.
- Loop step 1 also reads the top of `reviews/CRITIC.md`: an "Approved, not applied" line is applied first, then marked "Applied".

## Hard rules

- Made-up data only until go-live: no real client data, no live database, no live client app, no secrets (decision 0003). The one Auto-fill test Zo chose keeps structure only, never values (decision 0008).
- Free until go-live: every paid service sits behind an adapter with a free stand-in, switched off, with no key. AI inside the product runs through a Claude project on the subscription (decision 0008).
- This repo holds no client sentence. Client wording lives in the client app.
- Screens: the GOV.UK look, built for repeat desk work on a laptop with two monitors; as many screens as the work needs, each with one job, in a logical top-to-bottom order, separate tabs for separate things, search everywhere; designed first and approved by Zo; built to match; axe-clean.
- Tests: written first by another worker, named with clause IDs, fail before the build, never edited by the builder; money and tax arithmetic property-tested; clocks and seeds pinned; a flaky test is a failure (`.claude/rules/testing.md`).
- AI never clears, closes or approves anything, never talks to clients, and every AI output carries citations that code checks.
- Never kill processes by name (`taskkill /IM`, `pkill`, `killall`): only process IDs you started yourself. Zo's browsers and apps share the laptop.
- Never read or print `.env` or any secret. Print names or booleans only.
- Stage files by name; never `git add -A` or `git add .`; never force-push. Code reaches main only through a green train (a hook refuses other code pushes; plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ may go straight to main).
- Status files are rewritten, never appended; only `metrics.jsonl`, `ledger.jsonl` and `AMBER.md` rows are added to.
- A claim is not a fact: run the command and read the output before writing "done".
- The blueprint beats every document except `decisions/`; a clash between those two is red.
- Laptop: heavy commands through `node tools/heavy.mjs -- <cmd>`; the full suite and journeys run in the cloud, never on GitHub.
- Worktrees link `node_modules` with a junction; remove it with `cmd //c rmdir "<wt>\node_modules"` before removing the worktree; never `rm -rf` a worktree.
- The Lead reads indexes, reports and tool output, never whole code files. Big reads go to a helper that writes a file and returns 10 lines.
- The main checkout (`C:\Users\User\Documents\GitHub\ashbridge-returns`) ends every step on `main`, clean: Zo reads his to-do from it. The train and every build live in worktrees or the cloud.
- A failure that could happen elsewhere becomes a rule test that runs on every screen or every kind, not a one-off fix. Never patch what a later card rebuilds: add the defect to that card.
- Only the Lead regenerates generated files (for example `plan/MATRIX.md`), at merge.
- Cards marked `security` get a security review (`/security-review`) before they board the train.
- Before widening turbo past two cloud workers: one rehearsal of the whole loop at small width (a cloud worker, a train, landing on main, worktree removal); every permission prompt it meets is fixed in `.claude/settings.json`.

## Commands

`npm run typecheck`, `npx vitest run <files or dirs>`, `npm run e2e` (cloud only), `node tools/status.mjs`, `node tools/next.mjs [slots]`, `node tools/claim.mjs next|update|list`, `node tools/matrix.mjs [--summary] [--plan]`, `node tools/metrics.mjs <card>`, `node tools/scope.mjs <card> [base]`, `node tools/heavy.mjs -- <cmd>`.
