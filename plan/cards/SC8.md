# SC8 Source reads go through readOwnSource (R79)

**Lead directive, 3 Oct (A436): spec patch for gaps G1 to G6 in reports/SC8-spec-review.md (on claude/SC8), one planted file per gap as the review gives.** The rule follows local functions (wrapper parameters bound at call sites, return values, `.map`); catches aliased imports, `fs['readFileSync']`, `.call`/`.apply`, `open`/`openSync`, `process.cwd()`, `require.resolve`, `import.meta.resolve`, `new URL().pathname`, Vite `?raw` static, dynamic and glob imports; scans harnesses under `__fixtures__` and `src/core/testing`. Sentinels: the marked set holds all 8 files today's reads target; every listed test is still scanned; a baseline of titles and `expect(` counts from 25fc96d. Paths gain src/core/egress-rules.acceptance.test.ts and src/modules/auth/rules.acceptance.test.ts (their raw reads switch too); SC8 lands after FX2 and A04.

Phase 0. Size S. Deps: SC, FX2, A04. Where: cloud.
Tags: core (mutation testing is the bar for money, tax and citation code; a raw read breaks it).
Paths: tools/test/source-read-rules.test.mjs, tools/test/__fixtures__/source-read-rules/**, src/core/testing/read-own-source.acceptance.test.ts, src/contracts/amount-grammar.acceptance.test.ts, src/contracts/reading.acceptance.test.ts, src/contracts/reading-strict.acceptance.test.ts, src/core/clock.acceptance.test.ts, src/core/env.acceptance.test.ts, src/core/ids.acceptance.test.ts, src/core/log.acceptance.test.ts, src/core/money.acceptance.test.ts, src/core/egress-rules.acceptance.test.ts, src/modules/auth/rules.acceptance.test.ts
Clauses: ARC-15, ARC-16
Read: `reports/FX2-findings.md` (RC2), `.claude/rules/testing.md`, `src/core/testing/` (readOwnSource).
Spec commit: 9979144 (patch G1 to G6, validated on main 913ded6795563e5a7adc69dc24a5b54ca3575e76); first spec f91a3f6 (validated on main 25fc96d; branch carries SC e19dcdb and FX2 82f9b10 merged)

## Goal
testing.md says a test that reads a source file's text reads it through `readOwnSource`, because Stryker rewrites the file and its preamble holds `process.env`. Nothing enforces it: FX2's check failed on it, and eight more raw reads of `@mutate` files sit on main.

## Spec
- **R79** every test that reads the text of a src file marked `// @mutate` reads it through `readOwnSource` (any `readFileSync`, `readFile` or `fs.promises` call whose path resolves to such a file is a finding, however the path is built). Planted: ocr/engine-setting.test.ts as at FX2's 6a8531b; a path built through a variable; a read through `fs.promises`. The scan asserts it read at least one file and a named sentinel.
- DG's read-own-source acceptance test plants a real captured Stryker preamble (with `process.env`), not a made-up one.

## Build
Switch the eight listed tests to `readOwnSource`, same files, same assertions (never drop a check, skip it when instrumented, or unmark @mutate: A329). KNOWN ends empty.

## Check
A checker who did neither: R79 green with KNOWN empty; every listed test asserts exactly what it did before (diff shows only the read); `mutate:changed` runs on clock, ids, log and money without the dry-run failure.
