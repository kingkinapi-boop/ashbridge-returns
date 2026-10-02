# F07 spec report (cloud-746946)

- 47 tests: `src/modules/bridge/bridge.acceptance.test.ts` (12, unit) and `bridge.acceptance.db.test.ts` (35, db); fixtures in `src/modules/bridge/__fixtures__/`. Clauses: END-1, ARC-2, FLOW-11, OUT-6, RT-5. Spec commit 49d1183, on claude/F07 (based on claude/F01C, since F01 is not merged).
- Validated on main 31ee347 (merged). Smallest stub (throwaway worktree, never committed) passes all 47. The rest of the suite on the stub: unit 1544 pass; db: only the two F01 catalog rules fail, which the builder must satisfy (every returns table has id, created_at, is_test default true; a version column such as client_handoff.list_version needs a BEFORE UPDATE guard). Tests retired: none.
- Toolchain: nvm install 24 worked after retry; typecheck/lint on the branch fail only for the missing `src/contracts/bridge.ts` and `src/modules/bridge/index.ts` (the card's own).

## Permission gaps
A chained `ls node_modules` Bash command was refused once; no impact.

## Model
Sonnet 5.5 (card is `security`, not `core`; no Opus subagent).

## Amber (choices the card left open; Lead logs in plan/AMBER.md)
1. Snapshot shape: `{ is_test: true, entities: [{ id, kind company|personal, corporation|null, engagements[] }] }`, strict zod (an unknown or never-read key is refused). Corporation carries `financial_year_end_confirmed`, `services` (null = not said) and `associated_corporation_ids`.
2. A corporation with any current ops-confirms item (year end unconfirmed or null, unfiled years as text, same year twice, services not said) gets no return until the snapshot stops raising it; it still gets its client_ref. Items are stored once (unique per corporation, kind, year). Resolving items in a screen is a later card.
3. Return year end = last day of the confirmed year-end month in the tax year.
4. Associated companies: one group per connected set of associated corporations that have returns; every return links every other return in the group.
5. Two schema files: `05_bridge.sql` (client_refs, client_handoff) and one sorting after 50 (e.g. `55_bridge_returns.sql`) for tables with a return FK. Card Paths should add it.
6. Not tested, left to a later test-world card: a mapper from `reference/sample-clients/*/onboarding.json` to the snapshot.

## Toolchain refit (2026-10-02)
Merged origin/main 187902d into claude/F07. Typecheck, lint and both Vitest projects show failures only in the F07 acceptance files (missing src/contracts/bridge and src/modules/bridge, as intended); every other test passes (unit 1685, db 350). No assertion changed. validated on main 187902d.
Permission gaps: none. Model: Sonnet 5.5.
