# Zo's to-do (Ashbridge Returns)

The one file you read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Answer in the Lead chat with the item number. Answered items are deleted at once; the numbers below are today's only (earlier answers are recorded in decisions 0010 to 0015; only big questions come here). Chats say only one line; everything they need from you is here. If you do not answer, they keep going on other work. What each chat does: `README.md` in this folder.

## 1. Needs you now

**1. Sign in to QuickBooks Online Accountant in the "Ashbridge Test" Chrome.** What: the walker found that window signed in only to the QuickBooks test company ("Sandbox Company CA"), not to your Accountant login, so it had no client list or Workpapers and made no .GFI. Nothing was added or changed. Why: the .GFI file format decides how card B01 reads the books into the return. What comes next: once you sign in with your accountant login (go to qbo.intuit.com and pick the firm, not the sandbox), reply "1 done" and the walker reruns with the same limits. Meanwhile everything else keeps going; only B01's spec waits.

**Coming soon from you, Sat 3 Oct (about 30 minutes):** day 4 of the trial, the Auto-fill test on your chosen corporation. You do it yourself, no AI in the browser; only the shape of what Auto-fill fills is kept, never numbers or names. The nine steps are in `plan\taxprep-trial-plan.md` under "Day 4". No walker runs that day. Any other day suits too; days 5 and 6 do not wait for it. Keep the "Ashbridge Test" Chrome window on screen while walkers work.

**What the Lead is doing now:** the empty app (F00) is in its last build round in the cloud; the job queue's dependency fix is being checked; two screen designs are in their fix round for your first sitting about 3 Oct; trial day 3 is recorded (part done; the rest moves to day 5); the trial plan for days 4 to 6 and the phase 2 cards are being written.

## 2. Coming up (no action yet)

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
