---
name: modes
description: The build's usage modes (pause, prep, normal, turbo, wind-down) - what each allows, Zo's codes that change them, the October 2026 calendar, which pool pays, pacing, and what to do when a usage limit stops work. Use when Zo types turbo on, turbo off, pause or go, at every dispatch decision, and whenever a limit is hit.
---

# Modes

`plan/mode.json` holds the mode: `{"mode", "resume_to", "set_by", "set_at", "why", "wind_down_at", "heavy_slots", "max_workers", "local_workers"}`.

## Zo's codes (typed in the Lead chat)
| Zo types | The Lead sets | Notes |
|---|---|---|
| `turbo on` | turbo | The only way usage goes all out. On since 1 Oct 2026 (decision 0009). |
| `turbo off` | normal | |
| `pause` | pause | Nothing new starts; in-flight jobs finish. Not used for clearing the Lead (that is `handover`). |
| `go` | restores `resume_to` after a limit pause; otherwise just runs the loop | |

The Lead lowers the mode by itself only: a usage limit (to pause, `resume_to` = what was running), a Reviewer SLOW (one step down) or HOLD (pause), or `wind_down_at` passing (wind-down). Every change: rewrite mode.json (who, when, why), commit and push it, one line in TODO-ZO "What the Lead is doing now".

## What each mode allows
| | pause | prep | normal | turbo | wind-down |
|---|---|---|---|---|---|
| For | nothing new | cards, specs, designs | an everyday build | all out | land what is in flight |
| Lead dispatches a day (hook) | 0 | 15 | 40 | no cap | no cap |
| Queue jobs at once (claim.mjs) | 0 | 2, specs only | 2 | `max_workers` (12) | checks only |
| Local workers (laptop) | 0 | 1 | 1 | `local_workers` (1): Zo uses the laptop too | finish only |
| Cloud workers | 0 | 0 | 1 | start 2 for the rehearsal, then 6, add 2 while first passes and green trains hold, 12 at most | none new |
| Models | | Opus for specs and designs | Sonnet workers, Opus where CLAUDE.md says | same as normal | as started |
| Lead wake-up | | 60 min | 30 min | 15 to 20 min | 30 min |
| Train run (full suite and journeys in the cloud) | | | every 3 green cards | every 6 green cards or hourly | final |
| heavy_slots (laptop) | | 1 | 1 | 1 | 1 |

## Turbo, step by step
1. Mode turbo is set (decision 0009). Streams that need no queue start at once, as cloud sessions: research pairs, design research, trial preparation, test-world growth from `reference/sample-clients/`.
2. Queue repairs land first (NOW.md), then the rehearsal at small width: two cloud workers each take a job, spec, build and check by three different workers, a train, landing on main, worktree removal. Fix every prompt in `.claude/settings.json`. A cold sign-off (CLAUDE.md loop 7) before widening.
3. Every wake-up: re-fire any cloud worker whose session ended while the queue has jobs; board green cards; run the train when due; keep 10 or more spec'd cards ahead.
4. Add workers while fewer than 1 in 5 merges conflict, first-pass checks stay above half, and trains stay green; drop back when any fails.
5. Never throttle to save usage in turbo, and never spend it on waiting, polling or re-reading: Zo wants it used on real work.
6. Quality never drops: spec before build, independent check, findings review before a fix round, green train before main.

## When a limit stops work
- An interactive session can wait and continue after the reset; helpers do not resume by themselves; cloud sessions stop and new ones cannot start until the reset.
- First sign: rewrite NOW.md with every job in flight, set mode pause with `resume_to`, stop dispatching.
- On resume (Zo's `go`): restore `resume_to`; `node tools/claim.mjs list`; release claims older than 90 minutes with no new commits; re-fire workers.

## Calendar (October 2026)
- Thu 1 Oct: weekly reset; turbo on.
- When that allowance runs out: automatic pause. Zo uses his one saved reset (Settings, Usage, on the web or desktop), then types `go`.
- Thu 8 Oct: weekly reset; `go`.
- Fri 9 Oct 18:00 Toronto: automatic wind-down (checks and merges only, a final train, a final review, the handover in NOW.md), unless Zo removes it.
- Sat 10 Oct: the plan ends; after that, a slower pace.

## Which pool pays
Cloud sessions spend the cloud credit first (about $230 on 1 Oct, ending 4 Nov at midnight Pacific), then plan usage. Local sessions spend plan usage. Record in NOW.md what stopped work each time.

## Waste to avoid in every mode
- A build started with no spec; a fix round started with no findings review.
- The Lead reading code or long logs; helpers waiting in the foreground or polling faster than the wake-up.
- A research helper past 60 tool calls; a web page read whole instead of through a summarizer.
- A card on its fourth round (the queue stops at three; the Lead parks or re-cards it).
- Reading the blueprint whole: only the files a card names. A cloud run of the full suite for every single card (use the train).
