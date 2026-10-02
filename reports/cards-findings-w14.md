# Card side of the W14-D01 findings review (2 Oct, helper for the Lead)

Branch `claude/cards-findings-w14` from origin/main 6c7801a. Cards and plan only, no code. `node tools/matrix.mjs --plan`: PLAN OK (no MATRIX.md written).

## Done
- `.claude/agents/spec-writer.md`: new step 6 (merge origin/main; typecheck, lint, `npm test` green except the card's own acceptance tests failing by name; "validated on main <sha>"), plus a paragraph on what a spec refit is. Steps renumbered 7 and 8.
- New card `plan/cards/TH.md` (phase 0, S, no tags, deps F00) with R1 to R4 as acceptance checks 1 to 4, and its `plan/slices.json` entry (placed before W00).
- Deps gain TH on D01, D00, W00 (cards and slices).
- "Fix round 1" sections on F01, F09, D01, W15, F04, W00, D00, F08, W14, each pointing at `reports/findings-W14-D01.md`.
- W14 amended per "Card decisions" with checks 7 to 13 (R5 to R11); W14 and W15 Paths gain `reference/sample-clients/contract-ids.json` (card and slices).
- `reference/onboarding-contract.md`: one "Note (Returns side)" line under section 4; contract terms unchanged.

## Proposed ambers (what; why; reverse)
1. TH globs live in `tools/test-homes.json`; fix 2 asks for one data file read by the config and the rule test, and `tools/` sits next to the rule tests; move the file and update both readers.
2. TH Paths include `vitest.mutate.config.ts` (only to read the same data file if it copies the unit include); the risk list says mutate config may pick up tests; drop the path if the builder does not touch it.
3. TH clauses ARC-17 (R1 to R3: every test and file is run and typed), ARC-4 (R4), ARC-9 (globs from one data file); the nearest blueprint clauses; re-cite if the Critic prefers ARC-12.
4. R4 written as "no test file outside `src/core/db/` names the shared `db/schema` folder"; that can be checked by code, where "asserts an exact table set" cannot; narrow it to acceptance tests only if a legitimate test needs the path.
5. TH paths overlap F08 (`tools/test/**`): the queue will not run them side by side; accepted, both are small; split F08's paths if it blocks.
6. W14: `question_asked` holds the id alone (not "id plus a fixed marker"); the smaller option; reverse by allowing a fixed marker in R6.
7. W14: fact ids for conversation answers are `FL:<row>` (the fact-list row the contract's section 2 cites; the current data already carries these rows); no fact catalogue exists yet; rename when the question family's fact catalogue lands.
8. W14: allowed ids in `reference/sample-clients/contract-ids.json`, written by the spec job; an id the contract names only as a family (`ARB.*`, `INC3.*`) is listed only with a client-app source cite (read-only); otherwise `ARB.bal` or `INC3.shares` would pass R5 through the family; reverse by accepting any member of a named family.
9. W14 K01 instalments: chose "pays quarterly instalments in 2025" (the build's 2024 tax is about $14,400 and its RV-2 instalments 12,000); keeps the 2024 figures and exercises the RV-2 instalments number; reverse by setting 2024 tax under $3,000.
10. W14 client 12 consistency (R10): keep "all prior years filed: yes" and incorporation 2023; its onboarding gains the 2024 closing balances as fact-keyed conversation answers (bank, shareholder loan, share capital), retained earnings balancing; making 12 a first-year company would copy K3; reverse by setting `all_prior_years_filed` to unsure.
11. Rule checks failing on 01 to 10 print as KNOWN with a fix card id (never silent, never a change to 01 to 10 inside W14); the risk list forbids silent exemption and W14 cannot touch 01 to 10; reverse by blocking W14 until the fix card lands.
12. W15 Paths gain `contract-ids.json` so its re-spec can add a cited id; reverse by routing new ids through the Lead.
13. Fix round sections on F01, F09, D01 say "no content change; build stands" and name a different spec worker; matches "Card decisions"; none.

## Red (listed, not decided)
- None found. Watch item for the Lead: the contract note fixes this repo's sample shape only; if R62 (the bridge views draft for the client repo) ever proposes a fact_id format for line 83 answers, `FL:<row>` must match it, and that is client-app wording or schema, red there.
- The dep gate itself ("toolchain refit" in tools) is not here: per the main commit it is in queue repair 3.
