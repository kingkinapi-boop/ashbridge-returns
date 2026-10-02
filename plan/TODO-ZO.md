# Zo's to-do (Ashbridge Returns)

The one file you read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Answer in the Lead chat with the item number. Answered items are deleted at once; the numbers below are today's only (earlier answers are recorded in decisions 0010 to 0019; only big questions come here). Chats say only one line; everything they need from you is here. If you do not answer, they keep going on other work. What each chat does: `README.md` in this folder.

## 1. Needs you now

**1. Critic proposals of 2 Oct:** both approved by you on 2 Oct (1: sessions compact at 200k tokens; 2: no waits over 4.5 minutes, no reviving big helpers). On your question, compaction is switched on only with two guards: instructions on what every summary must keep, and an automatic reload of NOW.md, the jobs list and recent commits right after each compaction. The Lead applies them and records your yes as a decision; nothing needed from you. Details in `reviewsCRITIC.md`.

**1. Your first design sitting (when you are ready, about 30 to 45 minutes; not tonight).** Open http://localhost:8765/ in any browser on this laptop (it is served from the laptop, so the laptop must be on; you need internet for the GOV.UK styles). The first page explains each screen in plain words and asks seven questions, each with my recommendation. Reply in the Lead chat with the answers, for example "Q1 yes, Q2 B, Q7 B". If the page does not open, type "sitting server" and I restart it.

**Before you sleep (no answer needed):** leave the laptop on and plugged in, with sleep off, and leave the "Ashbridge Test" Chrome full size and in front, not covered or minimised. The walkers use it overnight for the .GFI and the day 5 Taxprep exports. If it drops, they stop and pick up again in the morning; nothing breaks.

**Coming soon from you, Sat 3 Oct (about 30 minutes):** day 4 of the trial, the Auto-fill test on your chosen corporation. You do it yourself, no AI in the browser; only the shape of what Auto-fill fills is kept, never numbers or names. The nine steps are in `plan\taxprep-trial-plan.md` under "Day 4". No walker runs that day. Any other day suits too; days 5 and 6 do not wait for it. Keep the "Ashbridge Test" Chrome window on screen while walkers work.

**What the Lead is doing now:** turbo is on again on your word. The Reviewer slowed things at 01:50Z and named four fixes; I am doing them first: the empty app's core tests get rewritten by a separate test writer, every core file must kill all its mutants, and the reading card and the test-homes card go ahead of the rest. Also running: two workers on this laptop and three in the cloud; the .GFI is done; Taxprep day 5 is running in the test Chrome; the last screen design is in its final fix round for your sitting about 3 Oct.
The Reviewer slowed the build to normal (reviews/REVIEW.md): the Lead first fixes the first card's core tests, the mutation gate and the two cards that block the queue; then type `turbo on`.

## 2. Coming up (no action yet)

**One new rule for your CPA check, when convenient:** item 33 at the end of `reference\cpa-check.md` (how amounts are rounded to whole dollars so the retained earnings ties still hold). Write "right" or a correction under it. Nothing waits on it; the build follows the rule as written until you say otherwise.

**Design sittings:** about 3, 6 and 8 Oct, 30 to 45 minutes each: the flow, then two or three versions of each key screen, then the final look. Built your way: top to bottom, separate tabs for separate things, a laptop with two monitors. Links will appear here.

**Which chats to run, and how often**

| Chat | When | Type |
|---|---|---|
| Lead | Running all the time in turbo; restart it with `go` if it stops | `go` |
| Watcher | Overnight and whenever you are away; clear it once a day | running |
| Reviewer | Daily in turbo, from Fri 2 Oct | `review` |
| Critic | About every two days, from Sat 3 Oct; its proposals come here for your yes | `critic` |

**Turbo ends** when you type `turbo off`, or at the automatic wind-down on Fri 9 Oct 18:00 (your plan ends Sat 10 Oct). Reply `no wind-down` if you want it to run to the end.

**The client app's /internal:** the prompt is ready at `C:\Users\User\Documents\GitHub\ashbridge-returns\toDelete\internal-redesign-prompt.md`. Open a new session in `ashbridge-app` on Opus 5.5 and paste it. It plans first and builds nothing until you approve its designs.

## 3. What is left of the build

| Phase | What gets built | The gate you can see | Status and next step |
|---|---|---|---|
| 0 Prove reality | The Taxprep trial (round trip, cell map, six open questions, Auto-fill shape, diagnostics); QuickBooks test companies with the ten sample clients; repairs to the build system | An export matches the import cell for cell | Round trip proven on a test company (13 of 13 cells identical); trial days 3 to 7 left (ends about 16 Oct); QuickBooks test company checked; the empty app (F00) is built, checked and on main since 2 Oct, so the other phase 0 cards can now be built. |
| 1 Evidence and the source viewer | Documents and QuickBooks read into facts with their sources; the source viewer; an early slice of the CPA review | 10 test files fully traced to source | Cards written; three screen designs and the source viewer in progress for your sitting about 3 Oct. |
| 2 Return build, lock and trace | The Taxprep import file; the lock export; the trace (orphans, overrides, the cite button); every version saved | A simple T2 built with few hand-typed cells | After phase 1. |
| 3 Checks and the CPA review screen | Ties, reconciliations, flags; the AI checklist and red team through the Claude project; the brief; the full review with marks | You review 20 test files end to end in the screen | After phase 2. |
| 4 Learning list and sign-off | Versions compared and the weekly lesson list; the approval summary and T183CORP; the check before transmit; the frozen binder | One return from import to frozen binder | After phase 3. |

Each phase ends with a cold sign-off by a fresh Opus reviewer before it counts as done.
