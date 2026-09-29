---
name: modes
description: The build's usage modes (pause, prep, normal, turbo, wind-down) - what each allows, Zo's codes that change them, the October 2026 calendar, which pool pays, pacing, and what to do when a usage limit stops work. Use when Zo types turbo on, turbo off, pause or go, at every dispatch decision, and whenever a limit is hit.
---

# Modes

`plan/mode.json` holds the mode:
`{"mode":"prep","resume_to":null,"set_by":"...","set_at":"...","why":"...","wind_down_at":"2026-10-09T18:00:00-04:00","heavy_slots":1,"max_workers":12}`

## Zo's codes (typed in the Lead chat)
| Zo types | The Lead sets | Notes |
|---|---|---|
| `turbo on` | turbo | The only way usage goes all out (decision 0007, Z-5). |
| `turbo off` | normal | |
| `pause` | pause | Nothing new starts; in-flight jobs finish. |
| `go` | restores `resume_to` after a limit pause; otherwise just runs the loop | |
| `blueprint ok` (first time) | normal | Prep ends when the blueprint is approved and F00 is merged. |

The Lead lowers the mode by itself only: a usage limit (to pause, `resume_to` = what was running), a Reviewer SLOW (one step down) or HOLD (pause), or `wind_down_at` passing (wind-down). Every change: rewrite mode.json (who, when, why), commit and push it (workers read it from main), and one line in TODO-ZO section 1 "What the Lead is doing now".

## What each mode allows
| | pause | prep | normal | turbo | wind-down |
|---|---|---|---|---|---|
| For | nothing new | blueprint, cards, specs, designs | an everyday build | all out | land what is in flight |
| Lead dispatches a day (hook) | 0 | 15 | 40 | no cap | no cap |
| Queue jobs at once (claim.mjs) | 0 | 2, specs only | 2 | `max_workers` (12, up to 20) | checks only |
| Local workers | 0 | 1 | 1 | 4 to 6 | finish only |
| Cloud workers (routines) | 0 | 0 | 1 | 6 to 12, started 2 min apart | none new |
| Extra cloud sessions Zo opens with `work` | refused | specs only | counted in the cap | welcome | refused |
| Models | | opus for specs and designs | sonnet builders, opus for `hard` cards and specs | opus everywhere | as started |
| Lead wake-up | | 60 min | 30 min | 15 to 20 min | 30 min |
| Reviewer routine | | on `review` | daily | every 12 hours | one final |
| Train run (full suite and journeys in the cloud) | | | every 3 green cards | every 6 green cards or hourly | final |
| heavy_slots (laptop) | | 1 | 1 | 2 | 1 |

## Before the first turbo: the rehearsal (in prep, after "blueprint ok")
Run the whole loop once on one small real card with nobody at the keyboard: a local worker and one cloud worker (routine) each take a job; spec, build and check by three different workers; the card boards a train; a cloud train run; landing on main; worktree removal; the Reviewer routine once. Every permission prompt or failure it meets is fixed (usually in `.claude/settings.json`) and the rehearsal repeated until it runs clean. Record the result in NOW.md. Turbo does not start until the rehearsal is clean.

## Turbo, step by step (only after Zo types `turbo on`)
1. Set mode turbo, push mode.json.
2. First time only: create the worker routines if they do not exist (skill `dispatch`, "Cloud workers"), then fire one and wait for it to claim a job, to prove the path.
3. Fire the cloud workers 2 minutes apart; dispatch the local workers.
4. Every wake-up: re-fire any routine whose run ended while the queue still has jobs; merge green cards into the train; start a train run when due; keep 10 or more spec'd cards ahead (if fewer, point local workers at spec jobs with `--roles spec`).
5. Add workers while fewer than 1 in 5 merges conflict and train runs stay green; drop back when either fails.
6. Pacing: if `plan/usage-now.json` shows the week's use behind the pace needed to use it all before the reset, add workers. Never throttle below this table to save usage in turbo: Zo wants it used.
7. Quality never drops: spec before build, independent check, green train before main (decision 0004, M-6).

## When a limit stops work
- Anthropic's docs: an interactive session can wait and continue after the reset; subagents do not resume by themselves; cloud sessions stop and new ones cannot start until the reset.
- First sign (a usage-limit message from a helper or a tool): rewrite NOW.md with every job in flight, set mode pause with `resume_to`, stop dispatching.
- On resume (automatic, or Zo's `go`): restore `resume_to`; `node tools/claim.mjs list`; release claims older than 90 minutes with no new commits, so their jobs go back in the queue; re-fire workers.

## Calendar (October 2026; Zo wrote "September 10", read as 10 October: amber A9)
- To Wed 30 Sep: prep. Blueprint approved; F00 merged; the spine's specs written; designs drafted.
- Thu 1 Oct: weekly reset. Turbo only when Zo types `turbo on`.
- When that allowance runs out: automatic pause. Zo uses his one extra reset, then types `go`.
- Thu 8 Oct: weekly reset. The session continues, or Zo types `go`.
- Fri 9 Oct 18:00 Toronto: automatic wind-down: checks and merges only, a final train run, a final review, the handover in NOW.md.
- Sat 10 Oct: the plan ends. Main holds only finished, tested work.

## Which pool pays (decision 0007, Z-9)
Cloud sessions and routines spend the cloud credit first ($240 on 28 Sep, expires 5 Nov), then plan usage. Local sessions and helpers spend plan usage. In turbo both run full. Record in NOW.md what stopped work each time (plan limit, credit, or both).

## Waste to avoid in every mode
- A build started with no spec (rework loops).
- The Lead reading code or long logs (read reports and `tools/` output).
- Helpers waiting in the foreground, or polling faster than the wake-up.
- A card on its fourth round (the queue stops at three; the Lead parks or re-cards it).
- Reading the blueprint whole: only the files a card names.
- A cloud run of the full suite for every single card (use the train).
