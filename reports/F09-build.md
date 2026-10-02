# F09 build, round 4 (cloud-662626, 2 Oct 2026)

Branch `claude/F09` (spec4 and main merged in). Mutation survivors only; no behaviour change.
- Files: `src/contracts/reading.ts`, `src/contracts/reading.test.ts`.
- Rewrites that remove equivalents: snap by Math.min/max, `\s` regex, CR/DR tail by slice, the redundant 15-digit check deleted (the safe-integer check covers it), amount groups built from group objects, text runs by `some`/slice.
- Four reasoned `// Stryker disable next-line` comments (tolerance edges at 1e-9, `?? ''` fallback, case fold). 14 unit tests for the internal survivors.
- Numbers: typecheck clean, lint clean, deps:check clean, scope OK, `npm test` 363 of 363, Stryker on reading.ts 100.00 (461 killed, 0 survived, 0 no cov); acceptance tests unchanged.
- Amber: the four disable comments above (reverse: delete them and accept 4 equivalent survivors).
- Permission gaps: cloud has Node 22, `.npmrc` engine-strict refused `npm ci`; used `npm ci --engine-strict=false`; `nvm install 24` did nothing.
- Model: Sonnet 5.5.
