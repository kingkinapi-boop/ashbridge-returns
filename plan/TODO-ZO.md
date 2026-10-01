# Zo's to-do (Ashbridge Returns)

The one file you read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Answer in the Lead chat with the item number. Chats say only one line; everything they need from you is here. If you do not answer, they keep going on other work. What each chat does: `README.md` in this folder.

## 1. Needs you now

**1. The Taxprep trial (you said: in progress).**
- When it is set up: the trial signed in inside the "Ashbridge Test" Chrome profile, the **T2 2025** edition, and you know its last day. Optional: that profile's download folder set to `C:\Users\User\Documents\taxprep-trial\inbox` with "Ask where to save" off.
- Then reply `1 started, ends <date>` (Chrome is connected already). The walker then runs day 1 (`plan\trial\day1-script.md`). You are needed again on day 4 (Auto-fill); the Lead tells you the day before.

**2. Is `ashbridge.cchifirm.ca` the trial, or the firm's real iFirm? (question, 1 minute)**
- What: the "Ashbridge Test" Chrome profile has a tab open on `ashbridge.cchifirm.ca`. Nobody touched it. If that address is the firm's real CCH iFirm (with real clients), the walker must not work in it (decision 0003: made-up data only; the trial plan: never the firm's real Taxprep).
- Reply `2 trial` if it is a separate trial account holding no real clients, or `2 real` if it is the firm's account. Recommendation: if real, sign out of it in that profile and create the trial under a new login, so the walker can never reach real clients.
- Meanwhile: the walker does nothing in iFirm.

**3. QuickBooks test company: please check one screen (2 minutes, when you can).**
- The helper created a Canadian sandbox company on developer.intuit.com (Dashboard, Sandboxes), but the page then showed "Sorry, something went wrong" three times. Open that page in the "Ashbridge Test" profile and reply `3 one`, `3 none` or `3 error`. Do not create another one yourself; the Lead retries if there is none.

**What the Lead is doing now:** two cloud workers are building the empty app (F00) and the screen map spec (your answer 1 A, decision 0010); the queue widens after that. The screen designs (CPA review, preparer workbench, queues) get one consolidated fix after the usability panel, for your first sitting about 3 Oct. Connected to the "Ashbridge Test" Chrome (thank you).

## 2. Coming up (no action yet)

**Tax rules for your CPA check (when you have an hour, any day this week):** `reference\cpa-check.md` lists 32 tax rules the checks will use (shareholder loans, unpaid bonuses, the business limit, instalments, GST/HST line 101 and more), each with its source and a worked example on made-up numbers. Reply `cpa ok`, or the item numbers you disagree with and why. Nothing waits on it until the checks are built (phase 3).

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
| 0 Prove reality | The Taxprep trial (round trip, cell map, six open questions, Auto-fill shape, diagnostics); QuickBooks test companies with the ten sample clients; repairs to the build system | An export matches the import cell for cell | Sample clients done. Trial script being written; the trial waits for "ready". |
| 1 Evidence and the source viewer | Documents and QuickBooks read into facts with their sources; the source viewer; an early slice of the CPA review | 10 test files fully traced to source | Screen research starts today; designs before building. |
| 2 Return build, lock and trace | The Taxprep import file; the lock export; the trace (orphans, overrides, the cite button); every version saved | A simple T2 built with few hand-typed cells | After phase 1. |
| 3 Checks and the CPA review screen | Ties, reconciliations, flags; the AI checklist and red team through the Claude project; the brief; the full review with marks | You review 20 test files end to end in the screen | After phase 2. |
| 4 Learning list and sign-off | Versions compared and the weekly lesson list; the approval summary and T183CORP; the check before transmit; the frozen binder | One return from import to frozen binder | After phase 3. |

Each phase ends with a cold sign-off by a fresh Opus reviewer before it counts as done.
