# Zo's to-do (Ashbridge Returns)

The one file you read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Answer in the Lead chat with the item number. Answered items are deleted at once; earlier answers are in `decisions\` (latest 0020). Chats say only one line; everything they need from you is here. If you do not answer, they keep going on other work. What each chat does: `README.md` in this folder.

## 1. Needs you now

Nothing. Your scanner edit is in (thank you), and today's answers are recorded: all seven design recommendations accepted (for the source viewer, which had no recommendation, I picked B, cite or write a reason; say "viewer A" or "viewer C" to change it), your logo is in use, and turbo is on.

**When you are ready:** clear the Lead and type `go`; it picks up from `plan\NOW.md`.

**Your CRA walks:** thank you. They name one real corporation and one real person, with their numbers and amounts, so the originals stay on the laptop only (the `Assets` folder is kept out of the repo, decision 0003). Copies with every name, number and amount taken out go to `reference\cra\` for the build to use. Nothing needed from you.

**Sat 3 Oct (about 30 minutes):** day 4 of the Taxprep trial, the Auto-fill test on your chosen corporation. You do it yourself, no AI in the browser; only the shape of what Auto-fill fills is kept, never numbers or names. The nine steps are in `plan\taxprep-trial-plan.md` under "Day 4". Any other day suits too; nothing waits on it.

**What the Lead is doing now (2 Oct, 17:40 UTC):** handing over. 28 cards are on main; today added the records schema (the base most other cards build on), the design basis with your logo, the amount rules, the fact list, the AI output rules, the queue fixes the Reviewer asked for, and the first two question-bank topics. Four cards that kept failing narrowly were split so their good work could land; the rest of their edge cases became rule tests. In flight: the test world, the spreadsheet reader, and six cards the records schema just unblocked. Plan use this week: 45%.

**Reviewer, 2 Oct 14:40 UTC:** mode lowered from turbo to normal (too much rework, one flaky test, too few cards ready). Details in `reviews\REVIEW.md`. Your answer: turbo comes back by itself when FX1 and F01C land; nothing needed from you.

## 2. Coming up (no action yet)

**Design sittings 2 and 3:** about 6 and 8 Oct, 30 to 45 minutes each: two or three versions of the remaining screens, then the final look. Links will appear here.

**One rule for your CPA check, when convenient:** item 33 at the end of `reference\cpa-check.md` (rounding to whole dollars so the retained earnings ties still hold). Write "right" or a correction under it. The build follows it as written until you say otherwise.

**Leave the "Ashbridge Test" Chrome on screen** (full size, not minimised) while walkers work; if it drops they stop and pick up later.

**Turbo ends** when you type `turbo off`, or at the automatic wind-down on Fri 9 Oct 18:00 (your plan ends Sat 10 Oct). Reply `no wind-down` to run to the end.

**The client app's /internal:** the prompt is ready at `C:\Users\User\Documents\GitHub\ashbridge-returns\toDelete\internal-redesign-prompt.md`. Open a new session in `ashbridge-app` on Opus 5.5 and paste it; it plans first and builds nothing until you approve its designs.

| Chat | When | Type |
|---|---|---|
| Lead | Running all the time in turbo; restart it with `go` if it stops | `go` |
| Reviewer | Daily in turbo | `review` |
| Critic | About every two days, from Sat 3 Oct; its proposals come here for your yes | `critic` |

## 3. What is left of the build

| Phase | What gets built | The gate you can see | Status and next step |
|---|---|---|---|
| 0 Prove reality | The Taxprep trial (round trip, cell map, six open questions, Auto-fill shape, diagnostics); QuickBooks test companies with the sample clients; repairs to the build system | An export matches the import cell for cell | Round trip proven on a test company (13 of 13 cells identical); trial days 3 to 7 left (ends about 16 Oct); 28 build cards on main, including the records schema; the test world, the PDF and spreadsheet readers are in their final rounds. |
| 1 Evidence and the source viewer | Documents and QuickBooks read into facts with their sources; the source viewer; an early slice of the CPA review | 10 test files fully traced to source | Cards written; your first design sitting is answered (decision 0020), so the approved screens now go into the design cards. |
| 2 Return build, lock and trace | The Taxprep import file; the lock export; the trace (orphans, overrides, the cite button); every version saved | A simple T2 built with few hand-typed cells | After phase 1. |
| 3 Checks and the CPA review screen | Ties, reconciliations, flags; the AI checklist and red team through the Claude project; the brief; the full review with marks | You review 20 test files end to end in the screen | After phase 2. |
| 4 Learning list and sign-off | Versions compared and the weekly lesson list; the approval summary and T183CORP; the check before transmit; the frozen binder | One return from import to frozen binder | After phase 3. |

Each phase ends with a cold sign-off by a fresh Opus reviewer before it counts as done.
