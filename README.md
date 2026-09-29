# Ashbridge Returns: your one-page guide

Ashbridge Returns is the firm's staff system for the work after onboarding: it reads each client's documents, builds the T2 with every number traced to its source, runs the checks, and gives the CPA one screen to review the whole return fast, then files and learns from every change. Clients never see it; their side stays in the client app.

**Where we are:** setup and planning (prep mode). Nothing is being built yet and nothing runs in the cloud. Your to-do is `plan\TODO-ZO.md`.

## Your chats

Open each one in the Claude desktop app: Code, New session, folder `ashbridge-returns`.

| Chat | When | What you type | What it says back |
|---|---|---|---|
| **Lead** (Opus, effort medium) | Any time. Clear it once or twice a day and type `go` again: nothing is lost. | `go`, a code below, or an answer such as `1 blueprint ok` | `Done. Start a new session.` / `Still working. Nothing needs you.` / `Waiting on to-do #N.` / `Blocked: to-do #N.`, then the to-do's path |
| **Reviewer** (Opus, effort high) | It also runs by itself, daily (every 12 hours in turbo). Open it yourself when something feels off. Clear it any time. | `review` | `Review written: reviews/REVIEW.md.` Read its first 5 lines. |
| **Extra workers** (optional, turbo only) | When you want even more building at once | At claude.ai/code, pick the `ashbridge-returns` repo, type `work`, send. Open as many as you like. | Nothing needed. Each stops by itself when the queue is empty. |

## Your codes (type them in the Lead chat)

| Code | What happens |
|---|---|
| `go` | The Lead carries on from where things are: after a clear, a usage reset or a pause. |
| `turbo on` | Unleashes the build: many workers in the cloud and on the laptop, side by side, until the queue is empty or usage runs out. Only you can do this. |
| `turbo off` | Back to normal pace. |
| `pause` | Nothing new starts; what is running finishes. `go` starts it again. |
| `blueprint ok` | Approves the end state (once). |
| `amber ok`, or `amber reverse A7` | Accepts or undoes the Lead's small calls. Whenever you like; nothing waits on it. |

## Your day

- **Morning, 5 minutes:** open `plan\TODO-ZO.md`. Section 1 is the only thing that needs you, and it says why.
- **Once, about 45 minutes:** approve the staff screen designs (a link in the to-do when they are ready).
- **At the end of each phase, optional:** a progress page with screenshots. Comment if you like; each comment becomes a test, and nobody asks you follow-up questions.
- **After a usage reset:** type `go`.

## The turbo plan

- **Now to Wed 30 Sep (prep, low usage):** the Lead finishes the cards, workers write the tests first, the screen designs are drafted, and the empty app (F00) is built.
- **When you type `turbo on` (planned Thu 1 Oct):** 6 to 12 cloud workers and 4 to 6 laptop workers take jobs from one queue. The work is cut into 253 cards in 17 waves; up to 36 can run at once. For each card one worker writes the tests, a second builds it, a third checks it. Cards reach the main code only in batches that passed the full test suite and every return kind in the cloud.
- **Usage:** cloud work spends the $240 cloud credit first, then your plan; laptop work spends your plan. When the week's usage runs out, everything pauses by itself: use your one extra reset and type `go`. Thu 8 Oct: weekly reset, type `go`. Fri 9 Oct 18:00: it winds down by itself and lands what is in flight. Sat 10 Oct: your plan ends; the main code holds only finished, tested work.
- **Want more:** while turbo is on, open extra cloud sessions and type `work` (see "Your chats").

## The path forward

| Phase | What gets built | What it is for | Your part |
|---|---|---|---|
| 0 Prep | Blueprint, rules, 253 cards, tests written first | Builders never guess | Approve the blueprint |
| 1 Foundations and design | The empty app, the data shapes, 13 made-up companies with all their documents, a Taxprep simulator, free stand-ins for paid services, the screen designs | Everything can be built and tested with no real data, no Taxprep account and no money | Approve the designs, one sitting |
| 2 Evidence | Reading documents into facts with their page and box; the client's books with our adjustments | Every number starts with a source | None |
| 3 Round trip | The Taxprep import file, the four exports, the trace, the two gates | Proves what is in Taxprep, and that what is filed is what the CPA approved | None |
| 4 Checks and AI | 26 code checks, the AI tax checklist, a red team, tiers | Errors are caught before the CPA sees the return | None |
| 5 Screens | CPA review, preparer, ops, owner | The full review on one screen, any source in under a second | Optional look |
| 6 Learning loop | Versions, causes, the weekly lesson list | The system improves itself | None |
| 7 Go-live readiness | Live connections built but switched off, a real Taxprep proof kit, the live database plan | Ready to switch on | Yes or no on each (money, live data) |

## How your practices are built in

| Your practice | Where it lives |
|---|---|
| Only questions that change the plan reach you | Decision 0002; small calls go to `plan\AMBER.md` for whenever you like |
| Clear chats any time | `plan\NOW.md` is always true; a hook stops the Lead leaving it stale |
| Short chats; everything in documents | CLAUDE.md: three lines in chat, ending with one fixed phrase |
| No drift | The blueprint has 216 numbered rules; every test names the rule it proves; each card may only touch its own files; the Reviewer samples merged cards against the blueprint |
| Nobody grades their own work | Three different workers per card; the queue enforces it |
| Test along the way | Tests written first; GitHub checks every branch for free; the full suite and every return kind run in the cloud before anything reaches the main code |
| GOV.UK rules | Blueprint RV-52 to RV-55, the staff screen rules, designs approved before building |
| Your comments become rules | Every comment becomes a test that runs on every screen or every return kind |
| Free build | Decision 0003: no paid service until you say yes at go-live |
| Measure | `plan\metrics.jsonl` per card, `plan\ledger.jsonl` per dispatch; the Reviewer reports on both |
| Your time | At most 3 open questions, batched; one design sitting; looks are optional |

## Where things are

| What | File |
|---|---|
| Your to-do (the only file you read) | `plan\TODO-ZO.md` |
| What the finished system does | `blueprint\README.md` (one page), then `blueprint\` |
| What is happening right now | `plan\NOW.md` |
| The work list | `plan\slices.json`, `plan\cards\` |
| Your decisions | `decisions\` |
| The Lead's small calls | `plan\AMBER.md` |
| The Reviewer's latest review | `reviews\REVIEW.md` |
| The rules the Lead follows | `CLAUDE.md` |

## If something goes wrong

- The Lead says `Blocked: to-do #N.`: read that item; it says what to click.
- Usage ran out: it has paused by itself. After the reset, type `go`.
- The Reviewer says HOLD: the reason is in your to-do; nothing restarts until you answer.
- You want everything to stop: type `pause`.
