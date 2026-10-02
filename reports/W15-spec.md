# W15 spec, fix round 1 re-spec (cloud-44dfa6, Opus subagent)
Spec commit ec7733c on claude/W15, validated on main 9f895a6. Typecheck, lint, npm test green (273 unit, 2 db).
verify.mjs: 397 passed, 5 known, 16 failed; all failures are missing folders 13 to 15 and the README count lines. 01 to 12 pass and are byte-identical to main.
Covered: ARC-8, ARC-16, SEC-11, CK-21, CK-12 (openingTie with two plants), END-1; R5 to R13 on 13 to 15.
Ambers: no new contract ids; 15 prior_year is 14's return in W14's shape; financial_year_end_confirmed false is a sample-data marker (the contract has no column).
Permission gaps: none. Model: Opus 5.5 (spec subagent), Sonnet 5.5 (worker).
