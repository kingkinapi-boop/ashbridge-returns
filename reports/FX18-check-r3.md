# FX18 check, round 3: FAIL (one item)
Worker cloud-f14272 (Sonnet), claude/FX18 d9c2712a, Node 24.21.0, Linux. Model: Sonnet 5.5; reads by Opus subagents.
Passed: typecheck, lint, deps:check, scope clean, spec files unchanged since 68ce1093, npm test (740 passed, 1 expected fail, 5 skipped), cloud `mutate:changed -- FX18 --force` 100.00 on env.ts, safe-read.ts, engines.ts, runner.ts, schemas.ts. Not run: pg16, e2e, mutate:canary (no db files touched; canary not run).
Security review (Opus): no medium or higher. Lows: chmodSync follows a link after realpath (engines.ts:328, already to SC12); whole-outbox walk per poll.
Opus read FAIL: engines.ts:213-214 quotedName escapes only Cf, Zl, Zp; JSON.stringify leaves DEL and U+0080 to U+009F raw (NEL, 8-bit CSI), so S12's "no Cc" rule fails. Fix: add \p{Cc} to the class; add \u0085 and \u009b to S12 or exchange-limits.build.test.ts:376; testing.md rule "a cleaner is tested with one code point from each class it claims". Lows: astral Cf gives a 5-hex escape; schemas.ts disable reasons say "outside coverage" (NoCoverage) not Survived; card Spec commit line says 6e1bff63, round 3 is 68ce1093.
Rule candidate: a cleaner is tested with one code point per class it claims.
Details: reports/FX18-opus-read-r3.md, reports/FX18-security-r3.md.
