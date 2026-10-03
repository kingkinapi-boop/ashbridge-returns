# W00c build, round 2 (cloud-f27e32)

Branch claude/W00c. Fix list RC1 to RC5 of reports/W00c-findings.md built in order; tests untouched.

- Files: testworld/model/faults.ts (marker `rows` by id, date, amount, dupOf; `empty: 'accounts'` on 12-F02; rows typed as a non-empty tuple so the spec's cast stays needed and lint stays clean), testworld/model/checks.ts (row-by-row marker pins, empties, year range and out-of-year dates, priorYear window), testworld/clients/load.ts (lstat on JSON files and client folders, resolved-path account files, string-only qualifier records, onboarding twin dates, opening-empty only in a first year, linked client folder refused as a 'file' issue), new testworld/clients/json-keys.ts (`repeatedKeys(text)`).
- Numbers: acceptance and unit `npm test`: unit 6858 of 6858, db 545 of 545. typecheck, lint, deps:check clean. scope.mjs: SCOPE OK (69 files).
- NOT DONE: `npm run mutate:changed -- W00c` and `test:flake` 5 of 5. Stryker's initial test run times out at 5 minutes on this box (twice, once alone), so the 100 per `@mutate` file bar is unmeasured, json-keys.ts included. A checker needs a longer dry-run timeout or a bigger box.
- Amber: marker `rows` typed `readonly [MarkedRow, ...MarkedRow[]]` (reverse: `readonly MarkedRow[]`, which makes lint fail on w00c-checks.test.ts:53). Messages: marker issues use the entry id as record and name the row id in the reason (checks.test needs record 'M').
- Permission gaps: none. Model: Sonnet 5.5.
