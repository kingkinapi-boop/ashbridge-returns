# W00 check (cloud-d26ada)

FAIL. Checked claude/W00 13013ca (origin/main already merged in), Node 24. Passed: typecheck, lint, deps:check, scope (32 files in paths), spec files unchanged since 59bb5ae, test:flake 5 of 5, no em dashes, no real-looking data found by the read.

## Failures (all listed)
1. `npm test` red: `src/contracts/taxprep.acceptance.test.ts` "RT-3 ARC-14 sample client 01's import.csv ... byte for byte" (F03, landed) throws "import.csv already holds CR bytes: the CRLF restore would double them" (line 84). Cause: A347 stores the taxprep CSVs CRLF (`.gitattributes` `-text` plus regenerated files), but F03's helper `taxprepBytes` adds CR itself and refuses files that have it. The two decisions clash. Needs a Lead call (change F03's helper, a spec job, or keep LF and normalise in W00 check 8). Command: `npx vitest run --project unit src/contracts/taxprep.acceptance.test.ts`.
2. Mutation (step 7): `npm run mutate:changed -- W00` says "no mutation targets changed": no `testworld` file carries `// @mutate`, although the card is core (money in cents, ARC-13). `testworld/model/money.ts`, `guard.ts`, `checks.ts` should be marked and scored.
3. Security review (step 9, card is security): `/security-review` not run in this check; the Opus adversarial read below stands in and found medium-or-higher SEC-11 gaps (items 5 to 8).
4. Opus adversarial read, findings (file:line):
   - ARC-13 `load.ts:14` with `money.ts:35`: amounts go through `JSON.parse` as floats and then `dollarsToCents(String(x))`; large values lose cents silently and "1.230" is accepted. The converter never sees the source text.
   - SEC-11 `load.ts:229-251`: `t2Inputs.slips.T4[].sin`, `T5[].sin`, `schedule9.relatedCorporations[].businessNumber` and `.name`, `onboarding.owners[].sin`, `shares.holders[].name`, `spouse.name` never reach the guard.
   - SEC-11 `load.ts:252-255`: e-mail and phone scan covers only onboarding.json and profile.md, not the answer key or any CSV; payee names in CSVs are not checked for "(Test)" or TEST.
   - SEC-11 `guard.ts:66`: phone pattern misses "(416)555-1234", "4165551234", "867-5309".
   - SEC-11 `guard.ts:50`: a non-digit business number ("123 456 782", RT suffix) returns "fails check digit", which the guard treats as made-up; real numbers in that shape pass.
   - ARC-8 `faults.ts:204-212` with `checks.ts:126`: the "listed fault" requirement is satisfied by the same `rolls:false` bit that waives the check, so any break can be waved through.
   - ARC-8 vacuous passes: `load.ts:163` (no statementBalances means no roll check), `checks.ts:136-138` (transaction `acct` never checked against declared accounts), `checks.ts:104-110` (an entry with zero lines nets to zero), `load.ts:190-195` (entry type derived from sources, so "has a type" cannot fail), `checks.ts:145` (null GIFI skips the four-digit check).
   - Note only: `generate.ts:289` runs `make-csv.mjs` without `--check` (correct for a temp-copy compare; card wording differs).

Rule candidate: every guard that scans fields (SEC-11) is driven from the schema's list of string fields, not a hand-picked list, and a planted real-looking value in each field kind must be refused; every "listed fault" check must read the catalogue, not the data's own flag.

Not run: e2e (no screens, none on card). Permission gaps: none. Model: Sonnet 5.5 (adversarial read: Opus).
