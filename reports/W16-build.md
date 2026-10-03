# W16 build (round 2, cloud-a113b9, 3 Oct 2026)

Branch claude/W16-r2, head see the last commit. Built from the spec on claude/W16-r2 (6c428ac); data only brought over from the retired build 562b349 (clients 03, 04, 08, 10 registers), never verify.mjs or README.md.
Files changed: clients/c03_04.mjs, c07_08.mjs, c09_10.mjs; answer-key.json and onboarding.json of folders 03, 04, 07, 08, 10 (regenerated).
Acceptance: `node reference/sample-clients/verify.mjs` 541 passed, 0 known, 0 failed (twice, second generation byte-identical); `make-csv.mjs --check` 1255 passes; typecheck, lint, deps:check clean.
One-off step against origin/main (by hand): only `assets`, Schedule 8 `openingUcc[].ucc` and onboarding `prior_year_closing_balances.ucc[].ucc` moved; the 6 changed figures equal the README's six lines (03 8, 04 8, 07 1, 08 8, 08 50, 10 8).
Client 07: the retired build used half-year (466,121.40); this one uses `aii` on the building (in use 1 Jan 2020), giving UCC 447,096.03 as the README says.
Note for the Lead: `node tools/scope.mjs W16` reads origin/claude/W16 (the retired branch), so it still prints "spec file edited by the build" for 562b349. Run it with the branch ref fixed, or delete origin/claude/W16 (I did not). By hand, every changed file on W16-r2 is inside the card's Paths or a spec commit's files. `mutate:changed -- W16`: "no marked mutation target" (Paths are data and verify only; changed set empty), a card/tool mismatch for the Lead.
Verify leaves import.csv as CRLF on disk; I restored them before committing (R37, FX7).
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
