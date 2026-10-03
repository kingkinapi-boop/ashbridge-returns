# SC build (local-3, 3 Oct 06:40Z)

Branch claude/SC, spec 0884fdfa (patch A415) with origin/main 376d8bfa merged clean. No product code written: SC is rules only, and every earlier failure is a KNOWN entry (owners FX3 to FX9) or fixed by the spec rounds. Earlier release notes (2 Oct runs) are in git history of this file.

- `tools/test/schema-contract-rules.test.mjs` (unit): 87 of 87 pass.
- `src/contracts/schema-rules.db.test.ts` (db, PGlite on the laptop): 23 of 23 pass. Not run on Postgres 16 (DB16 not landed; the check does that when it has).
- `npm run typecheck` 0, `npm run lint` 0, `npm run deps:check` no violations (198 modules), `node tools/scope.mjs SC` OK (53 files, all inside the paths).
- Mutation: no `@mutate` product file added or changed.
- Not run here (laptop): `npm test` whole suite, `npm run test:flake`; the card's Check section runs them on a cloud box.

Amber: none. Permission gaps: none. Model: Opus 5.5.
