# Zo's to-do (Ashbridge Returns)

The only file you need to read: `C:\Users\User\Documents\GitHub\ashbridge-returns\plan\TODO-ZO.md`. Only red questions come here: things that change the blueprint, cost money, touch live data or change who sees what. Reply in the Lead chat with the number, for example "1 blueprint ok".

## 1. Needs you now

**1. The blueprint (10 minutes).** Open `blueprint\README.md` and read only the first section, "The end state on one page". It is your design with all the review fixes folded in. Three things to notice: the adjustments layer (item 3) is the biggest piece of work; client screens stay in the client app (item 9); at go-live this system shares the client app's database, in its own section. Reply "1 blueprint ok", or name what to drop (for example "1 drop the adjustments layer"). My recommendation: ok.

**2. Free checks and a twice-daily review.** Two things your standing rules say need your word, for this new repo only: (a) GitHub runs the typecheck and tests on every build branch, on GitHub's free monthly minutes for private repos (it stops, it does not charge); (b) a Reviewer runs by itself as a Claude routine, once a day in steady mode and every 12 hours in ultra, to catch drift and waste while you sleep. Both save Claude usage for building. Your rules for ashbridge-app stay as they are. Reply "2 yes". My recommendation: yes.

**3. Create the repo (5 minutes).**
1. Go to github.com/new.
2. Owner: kingkinapi-boop. Name: `ashbridge-returns`. Choose Private. Do NOT tick "Add a README", .gitignore or licence.
3. Click Create repository.
4. Go to github.com/settings/installations, click Configure next to Claude, and under Repository access add `ashbridge-returns`. Click Save.
5. Reply "3 done". I push the folder and set up the cloud slots.

**What the Lead is doing now:**
- Mode: prep. The folder `ashbridge-returns` holds the whole build: blueprint, Lead and Reviewer rules, usage modes, the card list (59 cards in 8 phases) and the first 5 cards.
- Next: reading the client app (read-only) to pin what this system takes from it, then writing the cards and tests for phases 1 and 2, so the build can run flat out from 1 Oct.
- Dates: you wrote "expires on September 10"; I read it as 10 October (resets 1 and 8 October). If that is wrong, just say so.
- I made 11 small calls on my own. They are listed in `plan\AMBER.md` for whenever you want to look. Nothing waits on them.

## 2. Coming up (no action yet)

- **How the build runs:** you answer only red questions here. Everything else I decide and log. Builders work in the background (in the cloud and on the laptop); every piece is tested against the blueprint before it merges; a Reviewer checks for drift and waste and can slow the build, never speed it up.
- **Before 1 Oct:** set the laptop to never sleep when plugged in: Settings, System, Power and battery, "Screen, sleep and hibernate timeouts", "When plugged in, put my device to sleep after": Never.
- **Thu 1 Oct:** type `mode ultra` in the Lead chat. That unleashes the build. Until then it runs gently (prep mode) because little usage is left before the 1st.
- **When the week's usage runs out:** the build pauses by itself. Use your one reset, then type `go`.
- **Thu 8 Oct:** after the weekly reset the session resumes by itself; if it does not, type `go`.
- **Fri 9 Oct, 18:00:** the build winds down by itself and lands what is in flight before your plan ends on the 10th.
- **Optional looks:** when a phase finishes I add a link here to a progress page with screenshots. Comment if you like; I never ask follow-up questions.

## 3. What is left of the build

| Phase | What | Status and latest |
|---|---|---|
| 0 Prep | Blueprint, infrastructure, contracts, cards | Infrastructure and blueprint draft written 28 Sep. Waiting on 1 to 3. |
| 1 Foundations | Scaffold, contracts, test world of 12 made-up corporations, Taxprep simulator, free stand-ins | First 4 cards written. |
| 2 Evidence | Reading documents, the evidence ledger, the books | Listed, not yet written. |
| 3 Round trip | Import file, the four exports, trace, the two gates | Listed, not yet written. |
| 4 Checks | Ties, reconciliations, flags, AI checks, tiers | Listed, not yet written. |
| 5 Screens | CPA review, preparer, ops | Listed, not yet written. |
| 6 Learning loop | Versions, causes, the weekly lesson list | Listed, not yet written. |
| 7 Go-live readiness | Real Taxprep proof, vendors, live database | Built but switched off; each step needs your yes at the end. |
