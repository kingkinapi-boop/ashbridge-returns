# TH build (released, 2 Oct, cloud worker)

Branch claude/TH. Built: tools/test-homes.json, vitest.config.ts and vitest.mutate.config.ts read it, tsconfig include from it, .gitleaks.toml, checks.yml `--log-opts="HEAD"`. Typecheck, lint, flake 5 of 5, canary 100 pass; scope clean.

Blocker: 1 acceptance test fails, "ARC-17 R1 every test file is matched by exactly one Vitest project". `reference/taxprep/tools/strip-values.test.mjs` is a `node:test` file (no Vitest suite), so it has no home: adding it to unit makes the suite fail with "No test suite found". The build cannot fix it inside the card's paths. Choices for the Lead: (a) convert that file to Vitest (reference/ edit, straight to main), or (b) add `reference/**` to the R1 walk skip list in the spec (spec job), or (c) add a node:test project. Then rebuild is a no-op: re-check only.

Ambers: gitleaks regexes use regexTarget "line"; mutate config keeps only the src/ globs of the unit include.

## Re-run (cloud-9d2580, 2 Oct)
Lead's choice A287 (R1 skips reference/) is not in the spec: `SKIP_DIRS` in tools/test/toolchain-rules.test.mjs lacks `reference`, so 1 of 27 still fails (strip-values.test.mjs matched by 0 projects). Build side is done and unchanged; the builder may not edit the rule test. Needs a spec job: add `reference` to the R1 walk skip list (spec reopened), then re-check only.

## Re-run (cloud-e1c409, 2 Oct)
Same state: build is complete and unchanged; 26 of 27 rule tests pass. The one failure needs `reference` in `SKIP_DIRS` (toolchain-rules.test.mjs line 82), a spec change (A287) that has not been made. Released: needs a spec job, then re-check only. Permission gaps: none (Node 24 via `nvm install 24`). Model: Sonnet 5.5.

## Re-run (cloud-0a2392, 2 Oct, after the A287 spec refit)
Branch claude/TH merged with origin/main; no build change needed. Acceptance: toolchain-rules and egress-rules 51 of 51 pass. Full suite 726 of 726 (32 files). typecheck, lint, deps:check clean; flake 5 of 5; canary 100; scope OK (20 files). Ambers: none new. Permission gaps: none (Node 24 via `nvm install 24`; the image defaults to Node 22). Model: Sonnet 5.5.

## Round 2 (worker cloud-5d8906)
gitleaks v8.28.0 (checksum verified) on the branch history: 1 leak, rule generic-api-key, reports/W15-build.md line 3, commit 959f0f4: prose listing made-up sample-client folder names (`15-rouge-valley-landscaping-...`), not a secret. Fix: one regex in `.gitleaks.toml` (`\d\d-rouge-valley-landscaping[a-z0-9-]*`, no paths, as the A05 rule test requires). Re-run: no leaks found. Full suite 726 of 726, typecheck, lint, deps:check clean, scope OK, canary 100.
Amber: regex allowlist entry for that prose pattern; reverse: delete the line and rewrite nothing (history stays). Permission gaps: none. Model: Sonnet 5.5.
