# BL0 spec (cloud-76f46b, Opus spec-writer subagent, 2 Oct 2026)
Branch claude/BL0 = claude/F04 + claude/F01 (text.ts) + main 1c1da37. Validated on main 1c1da376afb6c94edb7e389241b2cf79edca2541: typecheck and lint green; only BL0's own 12 of 18 tests fail (1495 unit pass, db 249/249). A stub passed all 18 and the full suite; 6b sweep: none retired.
- 18 tests in src/contracts/blank-rule.acceptance.test.ts. Clauses AI-5, ARC-8. Core.
- Amber: F01 blank sample set restated (34 strings, not exported); scan covers ai.ts and checks.ts only (R41 does the rest); a quote is kept exactly as given (no trim); extraction and slot value fields may stay blank; ARC-8 used as the card cites it; spec file uses plain ASCII \u escapes (the Write tool turned them raw once; watch other specs).
- Permission gaps: none. Model: Opus 5.5 (spec), Sonnet 5.5 (worker).
