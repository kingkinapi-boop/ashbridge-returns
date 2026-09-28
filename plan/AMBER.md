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
