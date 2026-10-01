# Ashbridge Returns: your guide

Ashbridge Returns is the firm's staff system for corporate tax returns. The client app brings the work in; the books live in QuickBooks Online; Returns reads the books and the client's documents, writes the Taxprep import file so nobody types numbers, traces every number in Taxprep back to its source, runs the checks, and gives you, as the CPA, one place to review the full return fast. Clients never see it. What it does in full: `blueprint\README.md`, first section (the plain end state you approved).

Your daily file is `plan\TODO-ZO.md`. This README explains how the system works and what to type where. It does not go out of date with the calendar; dates live in the to-do.

## Your chats (no chat runs by itself)

Open each in the Claude desktop app: Code, New session, folder `ashbridge-returns` (the watcher uses its own folder). Type the first word shown. You can clear any chat at any time: everything lives in files. Chats answer in one line only; what they need from you is in the to-do.

| Chat | How often | What you type | What it does |
|---|---|---|---|
| **Lead** (Opus 5.5) | Runs all the time in turbo; otherwise every morning | `go` | Runs the build: plans the next cards, starts cloud workers and helpers, merges checked work, keeps your to-do current. |
| **Watcher** (Sonnet 5.5) | Overnight and when you are away | see `toDelete\lead-watcher-prompt.md` | Checks the Lead's context and, when it is full, has the Lead save everything, clears it and starts it again. |
| **Reviewer** (Opus 5.5) | Daily in turbo; every two or three days otherwise | `review` | Checks that what was built matches the plan, that tests are real and usage is not wasted. It can slow or stop the build, never speed it up. |
| **Critic** (Opus 5.5) | About every two days | `critic` | Asks whether the plan is still right and practical, and whether the build system is working. Proposes at most three changes; each waits for your yes in the to-do. |
| **Workers** (Sonnet 5.5) | Only in turbo | nothing: the Lead starts them in cloud sessions (you may open more and type `work`) | Each takes jobs from the queue: writes tests, builds, or checks. They stop by themselves when the queue is empty. |

## Your codes (type them in the Lead chat)

| Code | What happens |
|---|---|
| `go` | The Lead carries on from where things stand. |
| `turbo on` / `turbo off` | Turns the all-out mode on or off. Only you can switch it on. |
| `pause` | Nothing new starts; what is running finishes. |
| `handover` | The Lead saves everything and says `Handover done. Clear me.` The watcher uses it before a clear; you rarely need it. |
| `critic ok`, `critic ok 1 3`, `critic no 2` | Approves all, some or none of the Critic's latest proposals. |
| `amber ok`, `amber reverse A7` | Accepts or undoes the Lead's small calls in `plan\AMBER.md`. Nothing waits on these. |
| A to-do number and your answer, for example `2 own company` | Answers that item. |

## Seeing cloud work

The desktop app does not reliably list cloud chats. They are all at **claude.ai/code** in your browser and in the Claude phone app's **Code** tab, including their history. A beta called Projects, if your account has it, groups them as Working, Waiting on you and Ready for review, with a pause-everything button. `/clear` does not work in a cloud chat: start a new one instead.

## How the build runs

- **Five phases, each ending in a gate you can see:** 0 prove reality (the Taxprep trial and QBO test companies); 1 evidence and the source viewer (10 test files traced to source); 2 the return build and lock-and-trace (a simple T2 with few typed cells); 3 checks and the CPA review screen (you review 20 test files in the screen); 4 the learning list and client sign-off.
- **Before anything is built:** the Value helper asks who uses it, how often and what it replaces; design research finds how the best tools handle the task; designers make two or three clickable versions with made-up data; the usability panel counts clicks and page loads; you pick in a short sitting.
- **Building:** work is cut into small cards. For each card, one worker writes the tests, a second builds, a third checks; nobody grades their own work. Checked cards land on the main code in tested batches.
- **When testing finds problems:** before any fix, a fresh Opus reviewer looks at all the findings together, finds their shared causes and where else they can bite, foresees what the fixes could break, and writes one combined fix with new tests. The aim is two rounds, not ten.
- **Big chunks get a cold sign-off:** each phase, the trial findings and each design batch are signed off by a fresh Opus reviewer with no history before they count as done.
- **Made-up data only** until go-live, starting with the ten sample clients in `reference\sample-clients\`.
- **AI inside the product** runs through Claude on your subscription, in its own project with its own rules. Code checks every AI claim, and AI never approves anything.

## How it keeps itself honest

- The Reviewer compares the build with the plan. The Critic questions the plan itself.
- Every failure that could happen again becomes a rule test that runs everywhere, not a one-off fix.
- Your comments on designs become rules that every screen must pass.
- After each tool or model update, a tiny practice card runs through the whole loop to catch breakage. Rules and checks that catch nothing for two weeks are proposed for removal.

## Usage

- Sonnet 5.5 does most work (building, routine checks, research reading); Opus 5.5 does judgment (planning, tests for money and tax, hard checks, the Critic and the Reviewer); Haiku 4.5 does mechanical work. Model versions are pinned so a silent model change cannot alter the build.
- Research helpers are capped at 60 tool calls, split big questions, and read web pages through a cheap summarizer; long research sessions were the costly part on 29 Sep.
- In turbo, workers are added only while their work keeps passing first time; the real limits are review capacity and your design choices, not computing power.

## The laptop

Keep it plugged in and never sleeping during turbo; it runs every night. It carries the Lead, the watcher and at most one local worker, so it stays free for your other work (nine workers once used 20 GB and made pages take 30 to 45 seconds). Everything else runs in cloud sessions, paid first from the cloud credit.

## Adding a role or a rule

A new role is one orders file, one row in the roles table in `CLAUDE.md`, and a line in this README. A new rule is a test that runs on every screen or every return kind, first shown failing on a planted bad example. Nothing else has to change.

## If something goes wrong

- The Lead says `Blocked: to-do #N.`: read that item; it says what to click.
- Usage ran out: work pauses by itself. After the reset, type `go`.
- The Reviewer says HOLD: the reason is in your to-do; nothing restarts until you answer.
- You want everything to stop: type `pause`.

## Where things are

| What | File |
|---|---|
| Your to-do (the file you read) | `plan\TODO-ZO.md` |
| What the finished system does | `blueprint\README.md`, first section |
| What is happening right now | `plan\NOW.md` |
| Your decisions | `decisions\` (the latest: 0009, how turbo runs, 1 Oct; 0008, your answers of 29 Sep) |
| The Taxprep trial week | `plan\taxprep-trial-plan.md` |
| The sample clients | `reference\sample-clients\` |
| Research | `reference\research\INDEX.md` |
| The Critic's and Reviewer's latest | `reviews\CRITIC.md`, `reviews\REVIEW.md` |
| The Lead's small calls | `plan\AMBER.md` |
| The rules every chat follows | `CLAUDE.md` |
