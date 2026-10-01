# Zo's to-do (Ashbridge Returns)

The one file you read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Answer in the Lead chat with the item number. Chats say only one line; everything they need from you is here. If you do not answer, they keep going on other work. What each chat does: `README.md` in this folder.

## 1. Needs you now

**Answered 1 Oct, thank you:** 1 A (one-off cloud runs, decision 0010), 2 watcher done, 3 Intuit account done. Items 1 to 3 are removed from the next rewrite.

**OLD 1. How should the Lead start cloud workers? (answered: A)**
- What: the Lead cannot open cloud sessions from its own chat. The command only works when a person sits at a terminal, and the background "remote" option quietly ran on this laptop instead. So turbo's 6 to 12 cloud workers cannot start yet.
- Why it matters: without cloud workers the build runs about one card at a time on the laptop, and it spends your plan usage instead of the cloud credit.
- Choose one. **A (recommended):** let the Lead fire one-off cloud runs through Claude's "run once" trigger. No schedules; the Lead fires each run and stops it, and nothing runs on a timer. This changes decision 0008's "no routines" for one-off runs only. **B:** you open cloud sessions yourself at claude.ai/code on this repo and type `work` in each (each keeps taking jobs until the queue is empty). Opening 6 now and again each morning would do.
- Reply `1 A` or `1 B`.
- Meanwhile: research and screen design run as light helpers on the laptop (no heavy commands), and one build worker runs locally.

**2. Start the watcher, before you leave the desk tonight (10 minutes).** Skip if done.
- It clears the Lead when its context gets full and starts it again, so nothing stops overnight. Steps: `C:\Users\User\Documents\GitHub\ashbridge-returns\toDelete\lead-watcher-prompt.md`.

**3. Create a free Intuit developer account (10 minutes, when you can).**
- Why: our research could not confirm from Intuit's pages whether QuickBooks reports carry the transaction ids the trace needs; a free test company answers it in minutes. No card, no real clients.
- Steps: developer.intuit.com, Sign up with a new login (not your firm's QBO login), then Dashboard, Sandbox, Add a sandbox company, region Canada. Reply `3 done`; the Lead then asks for nothing else (no keys in chat).

**4. The Taxprep trial is ready: start it when you have 15 minutes at the laptop (Fri 2 Oct morning is ideal).**
- What: day 1 maps every Taxprep input cell on made-up companies. The trial lasts one week, so nothing starts until you do this.
- Steps: open Chrome with the "Ashbridge Test" profile only; create the CCH iFirm Taxprep T2 trial and sign in yourself (the Lead never types a password); choose the **T2 2025** edition; note the trial's last day. Optional: in that profile, Settings, Downloads, set the location to `C:\Users\User\Documents\taxprep-trial\inbox` and turn "Ask where to save" off.
- Then reply `4 started, ends <date>` and leave that Chrome window open. The walker does day 1 (script: `plan\trial\day1-script.md`). You are needed again on day 4 (Auto-fill); the Lead tells you the day before.

**What the Lead is doing now:** research on the checks (ties, reconciliations, flags) and QuickBooks; three screen families being designed (CPA review, preparer workbench, queues and the return page) for your first sitting about 3 Oct; the trial day 1 script; repairs to the job queue; the blueprint clauses brought into line with v1.1.

## 2. Coming up (no action yet)

**The Taxprep trial:** the Lead writes "ready" here, likely today or tomorrow, and says when to open the "Ashbridge Test" Chrome profile for the walker. Day 4 is your corporation's Auto-fill; it tells you the day before.

**Tax rules for your CPA check (when you have an hour, any day this week):** `reference\cpa-check.md` lists 32 tax rules the checks will use (shareholder loans, unpaid bonuses, the business limit, instalments, GST/HST line 101 and more), each with its source and a worked example on made-up numbers. Reply `cpa ok`, or the item numbers you disagree with and why. Nothing waits on it until the checks are built (phase 3).

**Design sittings:** about 3, 6 and 8 Oct, 30 to 45 minutes each: the flow, then two or three versions of each key screen, then the final look. Built your way: top to bottom, separate tabs for separate things, a laptop with two monitors. Links will appear here.

**Which chats to run, and how often**

| Chat | When | Type |
|---|---|---|
| Lead | Running all the time in turbo; restart it with `go` if it stops | `go` |
| Watcher | Overnight and whenever you are away; clear it once a day | see item 2 |
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
