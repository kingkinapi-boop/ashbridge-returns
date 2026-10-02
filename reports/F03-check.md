# F03 check (full, cloud-4ab7b4)

Result: FAIL (minor: scope and mutation marker)

Passed: typecheck, lint, deps:check; npm test (unit 276 tests in 16 files, db 2 tests); e2e 1 passed (production build); spec files and goldens unchanged since the spec commit (checks.acceptance.test.ts shows only because it came in by the main merge, spec(F05)); mutate:canary 100 (strong test kills all 10); acceptance checks 1 to 12 each have tests in taxprep.acceptance.test.ts; no client sentence, no real-looking person/SIN, no key or service.

Failures:
1. `node tools/scope.mjs F03`: SCOPE FAIL, plan/ledger.jsonl outside the card's paths (dispatch rows from the hook, not builder work; scope tool should ignore ledger rows).
2. src/contracts/taxprep.ts has no `// @mutate` marker in its first 5 lines, so `npm run mutate:changed` says "no mutation targets changed" and checks nothing on a CSV file. Run by hand (`stryker run --mutate src/contracts/taxprep.ts`): score 75.25 (597 killed, 8 timeout, 167 survived, 32 no coverage), above the 70 break but with many survivors. Examples: taxprep.ts:609 (`i <= out.length` in the byte writer), :66 and :69 (CP1252 undefined-byte set), :105 (identifier part regex end anchor `$` removed). These are missing tests (an identifier part with trailing junk such as `A[1]x`; bytes 0x81/0x8d/0x8f/0x90/0x9d refused).
Rule candidate: money, tax and CSV files must carry `// @mutate`; a lint/tool test fails a card whose Tags include core and whose src files lack it.

Permission gaps: none met.
Model: Sonnet 5.5 (claude-sonnet-5-5).
