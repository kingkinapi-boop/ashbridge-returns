# W00 check, round 2 (cloud-b37146, 2 Oct 2026)

FAIL (Opus adversarial and security read, probed with throwaway tests; round 1 items are fixed).

Passed: typecheck, lint, deps:check, npm test (1773 unit, 2 db), test:flake 5 of 5, spec files unchanged since f6aed41, mutation canary, mutate:changed W00 (100, 0 survivors, 8 marked files). Round 1 items now refused: float money, T4/owner SINs as text, spaced and RT business numbers, names without "(Test)" in every field, e-mail and phones in answer key and CSVs, rolls:false waiver, zero-line and sourceless entries.
Scope: SCOPE FAIL names only plan/cards/W00.md in the Lead's commit 8d44550 (spec commit line), not a build edit; no code outside the card's paths.

Failures:
1. SEC-11 medium, testworld/model/guard.ts:41: the walk visits only JSON strings; a SIN, business number or phone stored as a JSON number (sin: 130692544, 4168675309) is accepted.
2. SEC-11 medium, guard.ts:31: the nine-digit pattern needs one separator throughout and refuses dots; "123-456 782", "046 454-286" (in a CSV), "123.456.782" and "BN.123456782" are accepted.
3. SEC-11 medium, guard.ts:36 and :54: name checks use a hard-coded key list; real names under grantor (a key the samples use), tenant, payer or full_name are accepted, and so is a "name" whose object also has a "key" field.
4. SEC-11 medium, testworld/clients/load.ts:278: only .json, .csv and .md are read; a SIN in notes.txt or accounts/x.tsv in a client folder is accepted.
5. ARC-8 medium, checks.ts:42: the roll check fails only when an account has no months at all. Dropping one month, or all but the first, from statementBalances is accepted, and nothing checks that one month's closing equals the next month's opening.
6. ARC-8 low, load.ts:192: missingFromExport:true on a transaction removes it from the month's activity, so a fudged closing balance passes (a waiver taken from the data again). Low, checks.ts:25: an adjusting entry whose only source is a non-existent id ("nope") passes.

Rule candidates: the SEC-11 guard walks every value (strings and numbers) of every key and every file in a client folder, and treats any file type it cannot read as a refusal; name checks are driven by the schema's string fields, not a key list. A month sequence must be complete between first and last month and each closing equals the next opening.

Permission gaps: none. Model: Sonnet 5.5 (adversarial and security read: Opus).
