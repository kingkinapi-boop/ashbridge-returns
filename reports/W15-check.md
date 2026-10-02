# W15 check (cloud-0b9ab2, Sonnet 5.5; adversarial read by an Opus subagent)
Branch claude/W15 at 959f0f4. Result: PASS, with one scope-tool note for the Lead.

- Node 24 (nvm), npm ci, typecheck, lint, deps:check: clean. Unit suite: 23 files, 275 tests pass. verify.mjs: 534 passed, 5 known (W16, R8 on 03, 04, 07, 08, 10), 0 failed. make-csv --check: 1255 passes, 0 failures.
- Spec files (verify.mjs, make-csv.mjs): git diff from the spec commit ec7733c is empty.
- `node tools/scope.mjs W15`: FAIL, "spec file edited by the build: reference/sample-clients/README.md in 129052c". The edit is the counts line only (534 passes, about 9,736 rows, 31 accounts, "Fifteen ... client folders"), which the spec's R11 check (README counts equal generated data) forces the builder to update. Judged a scope-tool false positive: Lead to confirm (amber).
- Core adversarial read (Opus): CK-21 sums agree to the cent (13: deposits less opening receivable 59,156.30 plus accrual 58,645.95 = 374,185.35 = 4010); window and no HST account hold. CK-12: 15 opens from 14 (UCC 11,360 class 8, 4,760 class 10; 3849 = -2,835.61; loss 7,838.05 applied). END-1 fields and flags present. SEC-11: no Luhn-valid numbers, 14 and 15 alone share BN 104604112, no dashes. Folders 01 to 12 unchanged.
- Security tag: SEC-11 checks above stand in for /security-review (data-only card, no code that runs in the product); no keys or secrets found.
- No mutate run: no src file touched.
- Notes (not W15 defects): `financial_year_end_confirmed` is not a column in reference/onboarding-contract.md but the spec requires it (the spec report already lists it as amber). Running verify.mjs rewrites taxprep/import.csv with CRLF line endings in the working tree (line endings only).

Permission gaps: none. Model: Sonnet 5.5 checker; Opus 5.5 adversarial read.
