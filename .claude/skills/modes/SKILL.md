---
name: modes
description: The build's usage modes (pause, prep, steady, ultra, wind-down) - what each allows, who changes them, the October 2026 calendar, pacing, and what to do when a usage limit stops work. Use when Zo types mode <name> or go after a pause, at every dispatch decision, and whenever a limit is hit.
---

# Modes

`plan/mode.json` holds the mode:
`{"mode":"prep","resume_to":null,"set_by":"...","set_at":"...","why":"...","wind_down_at":"2026-10-09T18:00:00-04:00","heavy_slots":1}`

Only Zo raises the mode (`mode steady`, `mode ultra`). The Lead lowers it: a usage limit (to `pause`, `resume_to` = the mode that was running), a Reviewer SLOW (one step down) or HOLD (to `pause`), or `wind_down_at` passing (to `wind-down`). Every change: rewrite mode.json (who, when, why) and one line in TODO-ZO section 1 "What the Lead is doing now". `go` after a limit pause restores `resume_to`.

| | pause | prep | steady | ultra | wind-down |
|---|---|---|---|---|---|
| For | nothing runs | blueprint, contracts, cards, tests | a normal build | all out | land what is in flight |
| Dispatches a day (hook) | 0 | 15 | 40 | no cap | no cap, no new cards |
| Local builders at once | 0 | 1 | 1 | 3, up to 5 | finish only |
| Cloud builders at once | 0 | 0 | 1 | 3, up to 6 | finish only |
| Builder model | | opus | sonnet; opus for `hard` cards | opus | as started |
| Spec-writer | | opus | opus | opus, keeps 10 cards ahead | none |
| Checker and tester | | sonnet | sonnet | sonnet | sonnet |
| Scout | | haiku | haiku | haiku | haiku |
| Wake-up interval | | 60 min | 45 min | 20 min | 30 min |
| Reviewer | on `review` | on `review` | daily routine | routine every 12 hours | one final review |
| heavy_slots | | 1 | 1 | 2 | 1 |

## Ultra
- Every slot busy: when a helper finishes, start the next ready card in the same wake-up.
- Keep 10 or more spec'd cards ready. Fewer: one slot becomes a spec-writer until the queue is back.
- Start cloud builders at least 2 minutes apart (people report failures when many cloud sessions start at once; not in Anthropic's docs).
- Add a slot (up to the caps above) while fewer than 1 in 5 merges conflicts and the checker keeps up. Drop a slot when either fails.
- Pacing: if `plan/usage-now.json` shows the week's use behind the pace needed to use it all before the next reset, add a slot. Never throttle below the caps to save usage in ultra; Zo wants it used.
- Quality never drops: the three checks before merge stay (decision 0004, M-6).

## When a limit stops work
- Anthropic's docs: an interactive session resumes on its own after the reset; subagents do not, and must be dispatched again; cloud sessions resume on their own.
- On the first sign (a helper or tool failing with a usage-limit message): rewrite NOW.md with every card in flight, set mode `pause` with `resume_to`, stop dispatching.
- On resume (automatic, or Zo's `go`): restore `resume_to`; run `node tools/status.mjs`; any card "in flight" with no commit or report in 30 minutes gets its helper dispatched again.

## Calendar (October 2026; Zo wrote "September 10", read as 10 October: amber A9)
- To Wed 30 Sep: prep. Blueprint approved; repo on GitHub; contracts carded; at least 25 cards written, the first 10 spec'd.
- Thu 1 Oct: weekly reset. Zo types `mode ultra`.
- When that allowance runs out: automatic pause. Zo uses his one extra reset and types `go`.
- Thu 8 Oct: weekly reset. The session resumes, or Zo types `go`.
- Fri 9 Oct 18:00 Toronto: automatic wind-down. No new cards; finish, check and merge what is in flight; one final review; the handover in NOW.md.
- Sat 10 Oct: the plan ends. Main holds only finished, tested work.

## What pays (decision 0004, M-5)
Anthropic's docs: cloud sessions and routines share the plan's 5-hour and weekly limits with local work. The client app's notes (24 Sep): cloud sessions draw first on a $250 credit valid to 5 Nov 2026. They disagree; do not plan around either. Run ultra until something stops it, then record in NOW.md what stopped it (plan limit, credit, or both) so the next week is paced on facts.

## Waste to avoid in every mode
- A builder starting a card with no spec commit (rework loops).
- A Lead reading code or long logs (use reports and `tools/`).
- Helpers polling or waiting in the foreground.
- A card on its fourth round (park it at three).
- Re-reading the blueprint whole: read only the files a card names.
