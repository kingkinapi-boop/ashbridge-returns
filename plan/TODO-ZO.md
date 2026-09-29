# Zo's to-do (Ashbridge Returns)

The only file you need to read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Only red questions come here: things that change the blueprint, cost money, touch live data or change who sees what. Reply in the Lead chat with the number, for example "1 blueprint ok". What to type in which chat: `README.md` in this folder.

## 1. Needs you now

**1. Approve the blueprint (15 minutes).**
- **What it is:** the finished system in plain words: `blueprint\README.md`, first section, 13 short points.
- **Why it matters:** every card, test and check in the build is tied to one of its 216 numbered rules. Once you say ok, builders build only what it says, the Reviewer checks every merged piece against it, and nothing in it changes without your yes. This is what stops the drift you saw in the client app build.
- **New since your last look:** design rules (GOV.UK and MOJ patterns in the Ashbridge look, designs you approve before anything is built), testing rules, a 13th made-up company (a catch-up of two unfiled years), and "ops confirms anything the client app leaves unclear" (the client app does not store tax years cleanly, so the system never guesses them).
- **What happens after your ok:** the empty app is built on the laptop, then one practice run of the whole loop (see section 2), then the first tests are written.
- Reply `1 blueprint ok`, or name what to change. My recommendation: ok.

**What the Lead is doing now:**
- Tonight's setup is finished and pushed to GitHub. Everything for this build now lives in `ashbridge-returns`; `ashbridge-app` is clear of it.
- The turbo system is ready and switched off: one job queue that many builders pull from at once, so no two take the same job and nobody checks their own work (tested tonight: four builders claiming at the same moment got four different jobs).
- The work is cut into 255 cards in 17 waves; up to 36 can run side by side.
- Research, all in `reference\`: 23 mistakes from the client app build and how each is now prevented (`lessons-deep.md`); current best practice with sources (`build-practices.md`); the GOV.UK and MOJ design basis (`design-basis.md`); exactly what the client app hands over (`onboarding-contract.md`).
- The Reviewer now has a strict checklist: drift from the blueprint, whether tests are real, independence, usage, your time, screens, safety. It can slow or stop the build, never speed it up.
- Mode: prep. Nothing runs in the cloud until you approve the blueprint, and turbo only when you type `turbo on`.
- I made 23 small calls on my own (`plan\AMBER.md`). Read them whenever you like; nothing waits on them.
- Dates: you wrote "expires on September 10"; I read it as 10 October (resets 1 and 8 October). If that is wrong, say so.

## 2. Coming up (no action yet)

**After your "blueprint ok" (prep, low usage):**
1. **F00, the empty app.** Built on the laptop: the app shell, the test tools, free GitHub checks on every branch (typecheck and tests, never the browser journeys), and safe settings for outside packages. Everything later is built on it.
2. **The practice run.** One small card goes through the whole loop with nobody at the keyboard: a laptop worker and one cloud worker take jobs, the tests are written, the card is built and checked by different workers, lands on the main code, and the Reviewer runs once. Any permission prompt or snag it hits gets fixed now, not at 3 a.m. during turbo. It uses a little of the cloud credit.
3. **Tests first and designs.** Workers write the tests for the first waves, and the staff screen designs are drafted (static pages with made-up data, in the GOV.UK and MOJ style with the Ashbridge logo and colours).

**The design look (one sitting, about 45 minutes, when the designs are ready):** a link here to every staff screen, in batches (review, preparer, ops and owner), each with one line on what to look at. Screens are built only to the designs you approve, and a test keeps each built screen matching its design.

**Before Thu 1 Oct:** set the laptop to never sleep when plugged in: Settings, System, Power and battery, "Screen, sleep and hibernate timeouts", "When plugged in, put my device to sleep after": Never.

**Thu 1 Oct: type `turbo on` in the Lead chat.** 6 to 12 cloud workers and 4 to 6 laptop workers start taking jobs from the queue, each card written, built and checked by three different workers, landing on the main code only in batches that passed every test and every made-up company in the cloud. Cloud work spends the $240 cloud credit first, then your plan. Want even more: open claude.ai/code, pick `ashbridge-returns`, type `work`, send; as many as you like.

**After that:** when the week's usage runs out, everything pauses by itself; use your one extra reset, then type `go`. Thu 8 Oct: weekly reset, type `go`. Fri 9 Oct 18:00: the build winds down by itself and lands what is in flight. Sat 10 Oct: your plan ends; the main code holds only finished, tested work.

**Later, for the client app (not now):** the client app never confirms a company's year end with the client and stores prior years only as text. This system works around both (ops confirms in one step), but a fix in the client app would save ops that step. I will write it up for the client app's Lead when it is useful.

## 3. What is left of the build

| Phase | What gets built | What it is for | Cards | Status and next step |
|---|---|---|---|---|
| 0 Prep | Blueprint, rules, card list, research | Builders never guess; the client app's mistakes are designed out | 1 | Done tonight, apart from your blueprint ok. Next: F00 and the practice run. |
| 1 Foundations and design | The empty app; data shapes; 13 made-up companies with all their documents; the Taxprep simulator; free stand-ins for reading, AI, storage and sign-in; a thin end-to-end version from day one; the screen designs | Everything can be built and tested with no real data, no Taxprep account and no money | 68 | First cards written (F00 to F07, SK0, D00, D01) plus templates for the rest. |
| 2 Evidence | Reading every document type into facts with their page and box; the client's books with our adjusting entries; the gap list | Every number starts with a source | 48 | Listed; templates written. |
| 3 Round trip | The Taxprep import file, the four exports, the trace, the two gates | Proves what is in Taxprep, and that what is filed is what the CPA approved | 35 | Listed; templates written. |
| 4 Checks and AI | 26 code checks, the AI tax checklist, a red team, tiers | Errors are caught before the CPA sees the return | 57 | Listed; templates written. |
| 5 Screens | CPA review, preparer, ops, owner | The full review on one screen, any source in under a second | 27 | Waits for your design look. |
| 6 Learning loop | Versions, causes, the weekly lesson list | The system improves itself, with no one logging anything | 13 | Listed; templates written. |
| 7 Go-live readiness | Live connections built but switched off, a real Taxprep proof kit, an OCR test to choose a vendor, the live database plan | Ready to switch on when you say yes | 6 | Each step needs your yes at the end (money, live data). |
