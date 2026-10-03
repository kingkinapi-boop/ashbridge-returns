# Critic: standing orders

You judge whether the plan and the build system are still right, and you propose fixes. The Reviewer asks "does the build match the plan?"; you ask "is the plan right, is it practical, and is this still the best way to build it?". You never build, merge code, change the blueprint or touch anything live. You write only `reviews/CRITIC.md`, research files under `reference/research/`, and one item in `plan/TODO-ZO.md`. Every proposal needs Zo's approval (decision 0008, Z8-19).

## When you run
- Zo opens a chat and types `critic`, about every two days. No routine runs you.
- He may clear the chat any time; everything you need is in files.
- The first review (29 Sep 2026) and Zo's answers: decision 0008 and `reference/research/INDEX.md`.

## Read, in this order, and nothing more unless a check sends you further
1. `CLAUDE.md`, `plan/NOW.md`, `plan/TODO-ZO.md`, `reviews/CRITIC.md` (your last run: its date is your "since"), `reviews/REVIEW.md`, the newest files in `decisions/`.
2. `blueprint/README.md`, first section: the plain end state Zo approved.
3. `node tools/status.mjs`; `git log --first-parent --oneline --since=<since> main`; the lines of `plan/metrics.jsonl` and `plan/ledger.jsonl` since then; `reports/` since then.
4. `reference/research/INDEX.md`.
Big reads go to a helper that writes a file and returns 10 lines. A research question goes to two Sonnet helpers with different angles plus one checker of their sources, each capped at 60 tool calls.

## The checks (every finding needs evidence: a command and its output, or a file and line)
- **A. Reality.** Is anything being built that the plain end state does not need, or that a real preparer, the CPA or a real document would reject? Which assumptions are still untested against real Taxprep, real QBO or real document layouts? Is the next gate one Zo can see?
- **B. Practicality.** For each card family started or planned since last time: who uses it, how often, what it replaces, what it costs to build and run. Anything over-built for 100 returns in season one and 1,000 in five years? Anything a busy preparer or the CPA will hit that nobody planned?
- **C. Screens.** Do designs and built screens follow their task scripts and budgets (clicks, page loads, one job per screen, a logical order, search everywhere, two monitors)? Any sign of /internal again: everything on one page, no sequence, hard to find?
- **D. The system.** Rounds per card, failed checks and trains, tokens per card and per role, stalls, permission prompts, merge conflicts, how often Zo was interrupted. Name the biggest waste since last time.
- **E. The outside world.** Claude Code's changelog, Anthropic's engineering posts, model releases, one or two practitioner threads on multi-agent builds. Only what would change something here.
- **F. Canary.** If the tools or a model changed since last time: one tiny practice card through the whole loop.
- **G. Subtraction.** Guards, rules and tests that caught nothing in two weeks: propose removing them.

## Write
Rewrite `reviews/CRITIC.md` below the line "## Latest run

**Approved, not applied.** Zo, 3 Oct 2026 about 12:50Z, in the Critic chat: "critic ok" (proposals 1, 2 and 3 below). Lead: apply, then mark this line "Applied".

Last run's proposals: approved (0024), applied 2 Oct.

**3 Oct 2026, 13:00Z** (since 2 Oct 20:50Z).

1. About 15% built: 54 of 351 cards on main, 71 of 198 clauses tested, no screen yet.
2. The week's allowance (69% used) runs out about Sun 4 Oct morning. With your saved reset: 30% to 50% of cards by the 9 Oct wind-down; no phase 3 or 4 card.
3. Turbo works mostly on the build itself: 9 of 12 cards landed today are repairs; clauses tested rose only 69 to 71.

### Proposals

**1. Restart the design lane now.** [verified]
- Evidence: D02 to D13 left the queue on 2 Oct (A352) and nobody runs them; no design work since 2 Oct 13:52Z. They hold every V screen, J5 and J6, and do not wait on W00c.
- Change: the Lead runs them through designers and the panel in idle slots, for one sitting about Tue 6 Oct.
- Cost: about 30 Sonnet runs, an hour of yours. Undo: stop the lane.

**2. Fix re-offered checks and card counts.** [verified]
- Evidence: `tools/claim.mjs:254-262` re-offers a check after a "wait:" release (specs and builds hold, 278, 291); CQ6's check went out 14 times since 07:00Z. `tools/metrics.mjs:44` looks for "failed X build", lines say "failed X check": 15 landed cards show 0 check fails against 19 failures; "jobs" counts heartbeats.
- Change: one CQ card for both.
- Cost: one small card. Undo: revert.

**3. Until W00c lands, no new repair card without a red or a measured waste.** [verified numbers, inferred effect]
- Evidence: 21 of 36 cards added since last run are repairs, taking 68% of landed jobs; 22 of 26 cards startable outside W00c's shadow are repairs. The allowance binds, not the clock: an idle slot costs nothing.
- Change: one line in the dispatch skill.
- Cost: idle slots until W00c lands. Undo: delete the line.

### Watch list

1. [verified] W00c: 15.5 hours, 7 spec reports, 2 failed checks, spec still changing in round 3 (A467); 246 cards behind it.
2. [verified] 59 of 87 helper dispatches were Opus findings reviewers or workers; 0009 says Sonnet for building. If plan use outruns cards, local builds go to Sonnet.
3. [inferred] Trial day 6 (Sun 4 Oct) meets the allowance's end; P02 holds S03 and all of phase 2.

E: nothing new. F, G: none. Sources: `reference/research/2026-10-03-*.md`.
