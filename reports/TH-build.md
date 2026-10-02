# TH build (released, 2 Oct, cloud worker)

Branch claude/TH. Built: tools/test-homes.json, vitest.config.ts and vitest.mutate.config.ts read it, tsconfig include from it, .gitleaks.toml, checks.yml `--log-opts="HEAD"`. Typecheck, lint, flake 5 of 5, canary 100 pass; scope clean.

Blocker: 1 acceptance test fails, "ARC-17 R1 every test file is matched by exactly one Vitest project". `reference/taxprep/tools/strip-values.test.mjs` is a `node:test` file (no Vitest suite), so it has no home: adding it to unit makes the suite fail with "No test suite found". The build cannot fix it inside the card's paths. Choices for the Lead: (a) convert that file to Vitest (reference/ edit, straight to main), or (b) add `reference/**` to the R1 walk skip list in the spec (spec job), or (c) add a node:test project. Then rebuild is a no-op: re-check only.

Ambers: gitleaks regexes use regexTarget "line"; mutate config keeps only the src/ globs of the unit include.

## Re-run (cloud-9d2580, 2 Oct)
Lead's choice A287 (R1 skips reference/) is not in the spec: `SKIP_DIRS` in tools/test/toolchain-rules.test.mjs lacks `reference`, so 1 of 27 still fails (strip-values.test.mjs matched by 0 projects). Build side is done and unchanged; the builder may not edit the rule test. Needs a spec job: add `reference` to the R1 walk skip list (spec reopened), then re-check only.
