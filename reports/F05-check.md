# F05 check (cloud-45ec67): PASS

Typecheck, lint, deps:check clean. Full vitest 132/132 (F05: 41 tests, all 8 acceptance checks covered). Scope OK. F05 acceptance file unchanged since spec commit 2c9e48d. Mutation canary 100%; stryker on src/contracts/checks.ts 93.53% (break 70): 8 survivors, all error-message strings plus line 15 path-join, 1 no-coverage (line 17).

## Notes for the Lead (not failures of the card's clauses CK-1 to CK-6)
1. `src/contracts/checks.ts` has no `// @mutate` marker, so `npm run mutate:changed` skips it ("no mutation targets changed"). Add the marker (core money file).
2. Opus adversarial read (clauses beyond the card, CK-48 to CK-50) found: R21 rounding item is not capped at $1 (CK-50), in `reconcile()` and `roundStatementToDollars`; `reconcile()` does not validate its items; `acceptedBy` is optional (CK-48); no per-check allowed-code list; the R-code list is a count (29, matches the table) with no type names (CK-49). Decide whether these belong to F05 or the Q00 engine card.
3. Tooling: the cloud image has Node 22 only; `npm ci` needs Node 24 (I downloaded it from nodejs.org). /opt/nvm does not exist, contrary to cloud-worker-run.md.

Permission gaps: none. Model: Sonnet 5.5; Opus 5.5 subagent for the adversarial read.
