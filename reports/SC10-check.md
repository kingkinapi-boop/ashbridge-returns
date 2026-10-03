# SC10 check: PASS (cloud-161fd8, Node 24.21.0)

- typecheck, lint, deps:check: clean.
- tools tests: 426 of 426 pass; card-rules.test.mjs 27 of 27 (each plant fails by name; KNOWN exact: R86 FX7, R89 for E00, E01, G00 x2, Q00 as the card expects).
- Spec files (tools/test) unchanged since spec commit e578b6e2. scope.mjs: SCOPE OK, 14 files.
- unbuilt-guards.json: 17 guards (every PAIRS move; deps.ts does not exist yet), every owner is a card in slices.json.
- No @mutate files and no db/schema/vitest.config.ts change: mutation, pg16 and flake runs not applicable.
- Not run: e2e (tools-only card, no screens, no security tag).

## Permission gaps
None.

## Model
Sonnet 5.5 (core adversarial Opus read not run: the rules file is test-only and I compared KNOWN, the starting list and owners by hand).
