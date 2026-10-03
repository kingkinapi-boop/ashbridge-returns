# FX18 check (cloud-4b9dab)

FAIL: spec (c) not met, see below.

Passed: typecheck, lint, deps:check, npm test (unit 3369, db 698 on PGlite), mutation canary, mutate:changed FX18 = 100 on safe-read.ts, engines.ts, runner.ts, schemas.ts, acceptance test file identical to spec commit eb8d158. pg16 and test:flake not run (card touches no db files).

## Failures (Opus read, reports/FX18-opus-read.md)
1. Spec (c): engines.ts:188 `// Stryker disable next-line BlockStatement` sits on the one-line `try { return fn() } catch { return undefined }`, so it disables the try block too (an emptied try makes attempt() always undefined; tests should kill that). Same over-broad disable at engines.ts:241 (ConditionalExpression `if (true)` is killable) and schemas.ts:34-53 (StringLiteral/ObjectLiteral ranges the card did not ask for). Fix: split try and catch onto separate lines, disable only the catch; narrow the others. Mutation must stay 100.
Rule candidate: a Stryker disable comment names the mutants it covers and sits on a line holding only the equivalent code.

## Scope note
tools/scope.mjs FX18 on the branch lists safe-read.test.ts and exchange-limits.build.test.ts outside Paths because the branch's slices.json is old; main's slices.json already lists both (A530). Not a failure on the landing form.

## Lows
- runner.ts:153-158 lastErrorLine keeps U+2028/2029 and bidi controls; slice can split a surrogate pair.
- engines.ts:262 engine does not repeat the isTest SEC-11 gate; aiEngines still exported from engines.ts.
- engines.ts:162 `seen` never cleared; after 200 entries spec (b) logging stops for the runner's life.
- engines.ts:296-306 staging file left on refusal; mkdir 0700 does not tighten existing folders.
- contracts/ai.ts:34-40 versionStampSchema free text for the four N5 fields (outside Paths).
KNOWN lists: none name FX18 (fs-rules.test.mjs not on main yet).

Permission gaps: none. Model: Sonnet 5.5 check, Opus 5.5 read.
