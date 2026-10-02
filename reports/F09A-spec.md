# F09A spec (cloud-44dfa6, Opus subagent)
Commit 9e3dbb4 on claude/F09A (card line 348b080). 90 tests (EV-6, ARC-8, ARC-15), seed 20261002. Validated on origin/claude/F09 2216375 + origin/main 42b3650. Fails only because ./amount-grammar is missing; logic proven on a throwaway grammar (90 pass; 17 fail on F09's current grammar).
Conflict for the Lead: F09's test `EV-6 r4 a trailing sign closes the group: "1,234.56" "-" "7"` in reading.acceptance.test.ts contradicts the A296 dash rule and will fail once F09A is built; it needs marking superseded (not edited by the spec).
Ambers: normaliseAmount needs one group covering every word; one sign mark per group; formatAmount(-0) prints as 0; gap tests use page fractions; Stryker score (check 20) left to the checker.
Permission gaps: none. Model: Opus 5.5 (subagent), Sonnet 5.5.
