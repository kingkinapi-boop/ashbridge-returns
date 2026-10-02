# F00T build (local-4e140f), RELEASED unfinished: log.ts at 93.04, not 100

Branch claude/F00T. Done: money.ts (addCents sums exactly in BigInt, refuses an unsafe exact total; roundCentsToDollars no -0 via `Math.sign(c) * dollars + 0`), ids.ts (injectable random: setIdRandom/resetIdRandom, no static initialiser mutants), `// @mutate` on clock.ts and env.ts, env.ts names the failing key with a Stryker disable on the one equivalent separator, new src/core/ids.test.ts (2 unit tests). Gate: `npx vitest run src/core` 94 of 94; typecheck, lint, deps:check clean; scope OK.
Stryker per file (run on the five files, incremental): clock 100, env 100, ids 100, money 100, log 93.04 (8 survivors).
Not done: the log.ts survivors. My edit that removed the three redundant kinds (log.ts:28-30 'access token', 'refresh token', 'token hash'), dropped the `.filter` at 43, changed the regex at 41 and 42 was refused by the permission classifier ("Security Weaken"), so I left it and did only the pure refactors (hasRun by joined string, ancestors as a Set). Survivors left: log.ts 28, 29, 30 (redundant kinds), 39 and 43 (filter), 41 (regex), 42 (split `+`). A worker (or Zo's approval) must finish them: remove the three kinds (the kind 'token' already matches any key with that word part) and the empty-part filter, use `([A-Z])([A-Z][a-z])`, and rerun Stryker; or add `// Stryker disable` with reasons from reports/F00T-mutants.md. Not run: full suite, flake, e2e (cloud checker).
Amber: the id injection names are the spec's (setIdRandom, resetIdRandom).

## Permission gaps
Main checkout has no node_modules (junction dangles); used `npm ci` in the worktree. Classifier refused the log.ts redaction-list edit (above).
## Model
Sonnet 5.5.
