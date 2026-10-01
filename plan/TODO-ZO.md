# Zo's to-do (Ashbridge Returns)

The one file you read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Answer in the Lead chat with the item number. Answered items are deleted at once; the numbers below are today's only (earlier answers are recorded in decisions 0010 to 0015; only big questions come here). Chats say only one line; everything they need from you is here. If you do not answer, they keep going on other work. What each chat does: `README.md` in this folder.

## 1. Needs you now

**1. Sign in to QuickBooks Online Accountant in the "Ashbridge Test" Chrome.** What: the walker found that window signed in only to the QuickBooks test company ("Sandbox Company CA"), not to your Accountant login, so it had no client list or Workpapers and made no .GFI. Nothing was added or changed. Why: the .GFI file format decides how card B01 reads the books into the return. What comes next: once you sign in with your accountant login (go to qbo.intuit.com and pick the firm, not the sandbox), reply "1 done" and the walker reruns with the same limits. Meanwhile everything else keeps going; only B01's spec waits.

**2. May the trial walker load made-up import files into Taxprep by script?** What: Taxprep's import page opens no file window for the walker, and its safety guard now stops it from placing the file by script (that is how day 2's round trip worked). Only the ten made-up sample clients and "(Test)" returns are involved, in the trial account. Why: day 5 must import all ten sample clients to see every import message and diagnostic; without imports, phase 2's import checks rest on one company only. Recommendation: reply "2 yes" and the walker places the made-up files by script on "(Test)" returns only, as on day 2. Or reply "2 me" and you click "select a file" ten times when the walker asks (about 10 minutes). Meanwhile the walker does the steps that need no import (the Eglinton schedules, diagnostics, print options).

**Coming soon from you, Sat 3 Oct (about 30 minutes):** day 4 of the trial, the Auto-fill test on your chosen corporation. You do it yourself, no AI in the browser; only the shape of what Auto-fill fills is kept, never numbers or names. The nine steps are in `plan\taxprep-trial-plan.md` under "Day 4". No walker runs that day. Any other day suits too; days 5 and 6 do not wait for it. Keep the "Ashbridge Test" Chrome window on screen while walkers work.

**What the Lead is doing now:** the empty app (F00) passed its tests and is being checked in the cloud; the job queue's dependency fix passed its check and is landing; two screen designs are in their fix round for your first sitting about 3 Oct; trial day 5 continues in the "Ashbridge Test" Chrome (if the link drops again, the walker asks you to pick the browser in a Claude pop-up); the phase 2 cards are written and under independent review.

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
| 0 Prove reality | The Taxprep trial (round trip, cell map, six open questions, Auto-fill shape, diagnostics); QuickBooks test companies with the ten sample clients; repairs to the build system | An export matches the import cell for cell | Round trip proven on a test company (13 of 13 cells identical); trial days 3 to 7 left (ends about 16 Oct); QuickBooks test company checked; the empty app in its last fix round. |
| 1 Evidence and the source viewer | Documents and QuickBooks read into facts with their sources; the source viewer; an early slice of the CPA review | 10 test files fully traced to source | Cards written; three screen designs and the source viewer in progress for your sitting about 3 Oct. |
| 2 Return build, lock and trace | The Taxprep import file; the lock export; the trace (orphans, overrides, the cite button); every version saved | A simple T2 built with few hand-typed cells | After phase 1. |
| 3 Checks and the CPA review screen | Ties, reconciliations, flags; the AI checklist and red team through the Claude project; the brief; the full review with marks | You review 20 test files end to end in the screen | After phase 2. |
| 4 Learning list and sign-off | Versions compared and the weekly lesson list; the approval summary and T183CORP; the check before transmit; the frozen binder | One return from import to frozen binder | After phase 3. |

Each phase ends with a cold sign-off by a fresh Opus reviewer before it counts as done.
