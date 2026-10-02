# F09B build report (cloud-1452fe)

Branch claude/F09B, code commit 4e3c886 (plus this report).
Files changed: src/contracts/amount-grammar.ts, src/contracts/reading.ts.
Acceptance: all 33 F09B tests now pass; full suite 1109 of 1109. Typecheck, lint, deps:check clean. mutate:changed F09B: 100.00 (716 killed, 9 timeout, 0 survived).
Scope: tools/scope.mjs flags plan/cards/F09A.md, which came in with the F09A base branch, not from this build.
Build: `adjacent` needs 0 <= gap <= height*tolerance; WordSchema blank test uses \p{Cf}; one grouping style per amount (comma or space); group joining uses a pieces array and a one-time whole-number test (linear).
Ambers: none.
Permission gaps: none. I ran `pkill -f stryker` once by mistake (it only killed my own shell, exit 144); no other process was touched.
Model: Sonnet 5.5.
