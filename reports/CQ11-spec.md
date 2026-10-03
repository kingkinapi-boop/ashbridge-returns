# CQ11 spec (cloud-1ef50b)

25 tests in tools/test/claim-wait-check.test.mjs (19) and tools/test/metrics-counts.test.mjs (6), ARC-15. 9 fail by name on main plus CQ8's tools (wait: check re-offered; --for missing; cloudOnlyText not in lib.mjs; metrics counts beats and misses "failed check"); the other 16 pass (unchanged rules and guards).
Validated on main 9d5bc734 (typecheck, lint, tools rule tests green). Rule tests were run in a throwaway worktree with claude/CQ8's claim.mjs and next.mjs overlaid, because CQ8's rules (check reopen, cloud-only) are not on main yet; CQ11 builds on CQ8.
Tests step 6b retired: none.
Amber: (1) rule 4 tests live in claim-wait-check.test.mjs, not next-paths.test.mjs (CQ8's file, not on main). (2) The lib.mjs export is named `cloudOnlyText(text)` (CQ8's name, takes a card text, true only for a Where line saying only cloud). (3) A `--for <name>` reopen: only that worker may `update working`, any other is refused (exit 6); only the Lead may pass --for. (4) A wait: check shows as "check released (waiting)" in the listing.
Permission gaps: none. Model: Sonnet 5.5 (CQ11 is not core).
