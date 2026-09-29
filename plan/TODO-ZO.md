# Zo's to-do (Ashbridge Returns)

The one file you read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Answer in the Lead chat with the item number, for example `3 own`. What each chat does and what to type: `README.md` in this folder. Your answers of 29 Sep are recorded in `decisions\0008-zo-answers-2026-09-29.md`; the review doc is archived.

## 1. Needs you now

**1. Do not start the Taxprep trial yet.**
- **What it is:** the one-week trial is where we prove everything about Taxprep. Day 1 needs the ten sample clients, their import files and the walk script ready, or days are lost.
- **What comes next:** I write "ready" here, aiming for Thu 1 Oct in the evening. The day-by-day plan: `plan\taxprep-trial-plan.md`.

**2. Make a separate Chrome profile for testing (5 minutes).**
- **Why:** an agent will click through Taxprep and QuickBooks in your Chrome. It must never be able to reach a real client account.
- **Clicks:** in Chrome, your profile picture (top right), Add, "Continue without an account", name it "Ashbridge Test", Done. In that new window, install the Claude extension from the Chrome Web Store and sign in to Claude. Sign in to nothing else; the trial and the QuickBooks test companies are added there later.
- Reply `2 done`.

**3. Choose the business for the real Auto-fill test (red: real data).**
- **What it is:** on trial day 4, Taxprep's Auto-fill pulls one real business's CRA data. The AI walker sees it on screen; we save only its shape (which boxes fill, in what format), never the numbers.
- **My recommendation:** your own corporation, so no client's data is involved and the consent is yours.
- Reply `3 own`, or name the business and confirm its owner agrees.

**4. Your brother's computer.**
- **My answer: yes, for the build,** with made-up data only. It is a real upgrade.
- **What it gives:** on all day with fast, steady internet, so the Lead and local workers run through the night without your laptop or hotspot; more memory, so more local workers and faster tests; you steer its chats from your phone or laptop through Claude's Remote Control (claude.ai/code).
- **What it costs:** when Claude updates or signs out, someone must restart it (your brother, when you ask); your Claude and GitHub accounts are signed in on his machine; the Taxprep trial walk still runs on your laptop, because it drives your Chrome.
- **Conditions:** a separate Windows user for you with its disk encrypted, your own sign-ins, Claude Code's automatic updates paused during turbo. At go-live, anything with real client data runs on a machine the firm controls.
- **Google Workspace** offers no computers to run programs on (it is Gmail, Drive and Docs). Google Cloud is separate and paid, and not needed: Claude's cloud sessions already give each worker its own machine, paid first from your $230 credit.
- Reply `4 yes` and I write the setup steps for him (about 30 minutes of his time), or `4 no`.

**5. Two quick confirmations.**
- a) Excel and Salesforce: tools you like working in, whose feel we copy (record pages, list views, grids), or ones to avoid?
- b) In turbo, may the Lead start cloud workers itself after you type `turbo on`? Nothing is scheduled, and they stop when the queue is empty. Otherwise you open cloud sessions and type `work` yourself.
- My recommendation: a) like; b) yes. Reply `5 like, yes`, or correct me.

**What the Lead is doing now:** nothing until the weekly reset on Thu 1 Oct at 12:00 Toronto (usage is at 86%). The ten sample clients are done: about 8,800 made-up transactions with onboarding answers and answer keys, all checks passing (`reference\sample-clients\README.md`; a few tax points are marked for your CPA check). After the reset: repairs to the job queue, the new helper roles, the blueprint brought in line with your answers, and trial readiness.

## 2. Coming up (no action yet)

**Your question about the 4%.** It was seven research helpers, not a couple, plus my own session: about 3 million tokens in all. Normal for deep web research, but more than needed. Each helper made 75 to 280 page reads and searches, and each step re-reads everything the helper has gathered so far, so long sessions cost far more per finding. The fixes are now rules: at most 60 steps per research helper, narrow questions, web pages read by a cheap summarizer that passes back only what matters, findings written down as they go. My estimate: research now costs about half as much. From today's numbers, one weekly allowance is roughly 70 to 80 million tokens of this kind of work (a rough estimate), so the three allowances cover the plan only if every job stays lean.

**Which chats to run, and how often.**

| Chat | When | Type |
|---|---|---|
| Lead | Every morning, and evenings in turbo; it says when to clear | `go` |
| Critic | About every two days; its proposals come here for your yes | `critic` |
| Reviewer | Daily in turbo; every two or three days otherwise | `review` |
| Workers | Only in turbo (see item 5b) | `work` |

**Thu 1 Oct, after 12:00 Toronto:** type `go` in the Lead chat. It repairs the queue, sets up the roles and gets the trial ready, then says "ready" here.

**The trial week (once ready):** day 1 the cell map, day 2 the round trip and the six open questions, day 3 the preparer's work in Taxprep, day 4 Auto-fill (you sign in), day 5 all ten companies, day 6 changes after lock and the check before transmit, day 7 buffer and write-up. You are needed on day 1 (sign in to the trial in the test profile) and day 4.

**Design sittings:** about 3, 6 and 8 Oct, 30 to 45 minutes each: the flow, then two or three versions of each key screen, then the final look. Links will appear here.

**Turbo:** type `turbo on` once the Lead says the rehearsal is clean. Sonnet 5.5 does most of the work and Opus 5.5 the judgment; it runs every night; wind-down Fri 9 Oct at 18:00; your plan ends Sat 10 Oct, and after that we move to a slower pace.

**The client app's /internal:** the prompt is ready at `C:\Users\User\Documents\GitHub\ashbridge-returns\toDelete\internal-redesign-prompt.md`. Open a new session in `ashbridge-app` on Opus 5.5 and paste it (steps at the top of the file). It plans first and builds nothing until you approve its designs.

## 3. What is left of the build

| Phase | What gets built | The gate you can see | Status and next step |
|---|---|---|---|
| 0 Prove reality | The Taxprep trial (round trip, cell map, six open questions, Auto-fill shape, diagnostics); QuickBooks test companies with the ten sample clients; repairs to the build system | An export matches the import cell for cell | Sample clients done and checked. The trial waits for "ready". |
| 1 Evidence and the source viewer | Documents and QuickBooks read into facts with their sources; the source viewer; an early slice of the CPA review | 10 test files fully traced to source | Designs first (sittings from about 3 Oct). |
| 2 Return build, lock and trace | The Taxprep import file; the lock export; the trace (orphans, overrides, the cite button); every version saved | A simple T2 built with few hand-typed cells | After phase 1. |
| 3 Checks and the CPA review screen | Ties, reconciliations, flags; the AI checklist and red team through the Claude project; the brief; the full review with marks | You review 20 test files end to end in the screen | After phase 2. |
| 4 Learning list and sign-off | Versions compared and the weekly lesson list; the approval summary and T183CORP; the check before transmit; the frozen binder | One return from import to frozen binder | After phase 3. |
