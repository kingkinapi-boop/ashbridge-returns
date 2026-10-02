# F05 build: reported
Worker cloud-173eff. Branch claude/F05 (merged with main).
Files: src/contracts/checks.ts, src/contracts/checks.test.ts (3 own tests).
Acceptance: 38 of 38 in checks.acceptance.test.ts pass; typecheck, lint, deps:check, scope clean.
Ambers: (1) validators are zod schemas; the reason text is "path: message" so it names the field (for example sourceLink); (2) RECONCILING_ITEM_CODES is generated R01 to R29 (CK-48 table), per-check allowed codes belong to the check cards; (3) R21 rounding item source text is "rounding of statement lines to whole dollars"; (4) fail() also refuses non-integer cents. Reverse: edit checks.ts.
Not done: CK-50 ($1 cap on R21) and per-check allowed types, left to Q00 and the check cards.
Permission gaps: none (Node 24 from /opt/nvm). Model: claude-sonnet-5-5.
