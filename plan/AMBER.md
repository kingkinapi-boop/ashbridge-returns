# Amber tally

Calls the Lead made without asking, because the blueprint allows them. Zo reads this whenever he likes: reply "amber ok" (all), or "amber reverse A7". Nothing waits on this list. Rows are added, never edited, except the Status column.

| # | Date | Card | Decision | Why | How to reverse | Status |
|---|---|---|---|---|---|---|
| A1 | 28 Sep | setup | Repo and folder named ashbridge-returns | "production" already means the live client site | Rename before the GitHub repo exists | open |
| A2 | 28 Sep | setup | Same stack as the client app (Next.js, TypeScript, Postgres, Vitest, Playwright) | Agents and patterns carry over | Change before R00 merges | open |
| A3 | 28 Sep | setup | Tests on an in-memory Postgres (PGlite); cloud journeys on Postgres 16 | Free, no account, no Docker on the laptop | Swap the database helper | open |
| A4 | 28 Sep | setup | Schema kept as editable files until go-live, then one reviewed migration | Parallel builders cannot clash on migration numbers; nothing is live | Switch to numbered migrations | open |
| A5 | 28 Sep | setup | A Taxprep simulator built from CCH's published CSV rules; the real Taxprep proof is a go-live step | The build needs no Taxprep access | n/a | open |
| A6 | 28 Sep | setup | AI in the build: recorded answers in tests; `claude -p` on the subscription to measure prompts; the paid API only at go-live | Free until live; Anthropic's support page on the Agent SDK with a Claude plan suggests plan usage covers headless runs (not yet confirmed here; the first run confirms it) | Switch the adapter | open |
| A7 | 28 Sep | blueprint | "Swing" means a line that moved 25% or more from last year (CK-39) | The approved tier rule needs a testable meaning; 25% is the tier rule's own test for tax payable; no materiality threshold added | Change one constant | open |
| A8 | 28 Sep | blueprint | Twelve made-up return kinds are the end-to-end test set (END-9) | Same role as the client kinds in the client app | Edit the list | open |
| A9 | 28 Sep | setup | Budget calendar reads "September 10" as 10 October 2026 | 10 September had passed | Zo corrects the dates | open |
| A10 | 28 Sep | setup | A hook caps dispatches per day by mode and logs each one; the statusline records plan usage | Usage stays under control without Lead effort | Remove from .claude/settings.json | open |
| A11 | 28 Sep | R02 | A preparer's hold on a return expires after 4 hours idle (FLOW-10) | Long enough for a working session, short enough not to block others | Change one constant | open |
| A12 | 28 Sep | setup | Card map widened to 255 cards: spine cards plus families (one template covers a group of similar cards) | Up to 36 cards can run side by side; templates keep cards short | Merge families back into bigger cards | open |
| A13 | 28 Sep | setup | Cards reach main in tested batches (the train), not one cloud run per card | Same safety, far fewer cloud runs | Run the full suite for every card | open |
| A14 | 28 Sep | setup | The job queue lives on branch claude/claims, with git as the lock; a card stops after 3 failed rounds | Many workers, no double work, nobody checks their own card | Lead-assigned dispatch only | open |
| A15 | 28 Sep | setup | Worker routines are created only when needed (one for the practice run, the rest at the first "turbo on") | Zo: "just setting up" | Create them all now | open |
| A16 | 28 Sep | setup | Claude Code workflows and agent teams stay off; parallel work comes from the queue | Experimental or drift-prone; the queue keeps checks independent | Turn them on for a batch | open |
| A17 | 28 Sep | design | Staff screens use the official govuk-frontend 6.x and MOJ Frontend 11.x (free, MIT) through our own thin React layer; no Tailwind, no third-party React port | Exact GOV.UK markup, testable against the official fixtures | Switch library before U00 | open |
| A18 | 28 Sep | blueprint | "Approve stays off" became "Approve appears only when every section is reviewed" (RV-5) | GOV.UK advises against disabled buttons; same meaning | Reword RV-5 | open |
| A19 | 28 Sep | blueprint | A thirteenth kind (K13, a catch-up of two unfiled years) and a hand-over table in blueprint 00 | The client app sells prior years and no kind covered them (lessons pattern 3) | Drop K13 | open |
| A20 | 28 Sep | design | Staff headings in title case and red asterisks on required fields, as in the client app, though GOV.UK advises sentence case and no asterisks | Zo asked for the same formatting; one look for both apps | Follow GOV.UK instead | open |
| A21 | 28 Sep | setup | Testing adds mutation tests (threshold 70), property tests, golden files, ARIA snapshots and axe; a hook stops builders editing acceptance tests | Proves the tests catch faults; stops tests being bent to pass | Lower the threshold or drop the hook | open |
| A22 | 28 Sep | setup | A walking skeleton (SK0) comes before the core modules, and a shared-screen-behaviour card (U02) before any screen | Lessons patterns 1 and 5 | Remove the dependencies | open |
| A23 | 28 Sep | blueprint | END-1: where the client app's data is unclear (year end, which years, a duplicate), ops confirms in one step; personal-only records are skipped (OUT-6) | The client app does not store tax years cleanly (reference/onboarding-contract.md) | Guess instead (not recommended) | open |
| A24 | 1 Oct | process | Document-only helpers outside the queue (research pairs, design briefs, the trial script) run as cloud agents before the rehearsal; the "two cloud workers before the rehearsal" gate applies to queue workers, which touch worktrees, trains and main | The gate exists to find permission prompts in the build loop; helpers only write a file to a claude/ branch | Hold helpers to two at a time until the rehearsal passes | open |
