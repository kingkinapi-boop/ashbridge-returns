# F07 check (cloud-43b472, 2 Oct 2026)

Result: PASS, with one Lead action before boarding.

- typecheck, lint, deps:check clean (Node 24.21.0).
- npm test: unit 1697 of 1697, db 385 of 385 (47 F07 acceptance tests among them). test:flake: 5 of 5 cold runs ok.
- Spec files (acceptance tests, __fixtures__) unchanged since spec commit 15bceab.
- Diff read against the card: no request.url, network, env, key, or paid service; fixtures are made-up; hand-off table has RLS on and no policies; client_ref minted by max+1 with unique constraints both ways.
- Not run: mutate:canary and mutate:changed (no money, tax, CSV or citation-check files changed); /security-review left to the Lead as the build report says.

## Lead action
`node tools/scope.mjs F07` FAILS: db/schema/55_bridge_returns.sql is outside the paths in plan/slices.json. The card file lists it (A369) but slices.json F07 `paths` does not. Add it to slices.json, then scope is clean.

## Permission gaps
None.
## Model
Sonnet 5.5
