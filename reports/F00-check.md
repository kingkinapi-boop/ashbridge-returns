# F00 check (fix round 1), worker cloud-5a0720, Node 24.21, npm 11
FAIL (step 7 only). Steps 1-6 and 8-10 pass.
## Passed
- typecheck, lint, deps:check clean. `npm test`: unit 33 + db 2 = 35 pass (11 spec tests included). `npm run test:flake` 5 of 5 ok, slowest boot 3.1 s.
- `npm run e2e` passes (1 test, production build). `npm audit --audit-level=high` exits clean (2 moderate qs findings via typed-rest-client, below the gate).
- Spec files (db.acceptance.test.ts, __fixtures__, tools/test) unchanged since spec commit ae075e5.
- Diff read: workflow skips claims/train/review branches and docs pushes, runs no journeys; no key, SIN, paid service or request.url redirect. Security (SEC-10): no medium-or-higher finding found by manual read (`/security-review` not run separately).
## Failures
1. Mutation (step 7): `npm run mutate:changed` scores 0.00 on ids.ts and money.ts (47 mutants, all survive), under break threshold 70. Cause per build report: Stryker 10.0.0 VitestTestRunner.init fails with vitest 5.0.1; reproduced here, the run completes in 6 s with 0% coverage. Not a missing-test finding; a tooling incompatibility. Needs a Stryker/Vitest version decision or a card.
2. Scope: `node tools/scope.mjs F00 origin/main` lists 4 files outside the card paths: tools/test-flake.mjs and tools/test/__fixtures__/planted-{new-pglite,package.json,vitest-config}.txt (the Lead adds them to the card's Paths; the build report said so too).
Note: scope against local `main` in a cloud clone is stale; use origin/main.
## Not checked
Acceptance 7 (CRLF on laptop), Dependabot alerts: Lead. Laptop timing numbers not measured.
Rule candidate: a tool-compatibility smoke test (mutate on a known-killable mutant) in the dependency baseline so a Stryker/Vitest mismatch fails at install time, not at the check.
## Permission gaps
- /opt/nvm had Node 22 only; `nvm install 24` worked. `npm ci` fails silently under Node 22 (EBADENGINE).
## Model
claude-sonnet-5-5
