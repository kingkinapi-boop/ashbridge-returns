# FX2 check (cloud-12baf5, Sonnet 5.5, Node 24.21.0)
Branch claude/FX2 at 6a8531b. Result: FAIL (two items; code itself reads correct).

Passed: typecheck, lint, deps:check; `npm test` unit 2520/2520 and db 545/545 (9 files); the spec diff (6ac7457..HEAD) over both engine-setting tests is empty; env.ts diff is as the card asks; no non-test module outside env.ts reads process.env except auth/index.ts (A06's).

Failures:
1. Scope: `node tools/scope.mjs FX2` lists src/modules/storage/safe.ts, storage/files/index.ts, storage/drive/index.ts outside the card Paths. The edits are needed (readEngine lives in safe.ts) so the fix is a card Paths line, not a code change. Rule candidate: a card whose Goal names a shared helper lists its file in Paths at carding.
2. Mutation (step 7): `npm run mutate:changed -- FX2` dies in Stryker's dry run ("failed tests in the initial test run"). Cause, as the builder reported: the spec's source-text test ("no module reads process.env", src/modules/ocr/engine-setting.test.ts) sees Stryker's instrumentation preamble in the @mutate files. Needs a spec fix (read the un-instrumented source, or strip the preamble). No score exists, so missing tests cannot be listed. Rule candidate: source-text tests over @mutate files must ignore the Stryker preamble (R-rule on every such test).
3. /security-review not run in this job; the diff is small (refuse in production when unset, name only, no value printed).

Permission gaps: none. Model: Sonnet 5.5.
