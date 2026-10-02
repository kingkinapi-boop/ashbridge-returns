# F01 spec refit (findings review W14-D01, RC1, fix 4)

- Old spec commit: ea1e06ef122a9776cd17e5abe1abf9dc211b2525 (card line). Branch head before refit: e4a0104.
- New spec commit: e8acadc378872c0389c5e1d668c3f7a07d3b85c6 on claude/F01.
- Validated on main 7a6038d779f24b093405f40262d272bcda2f822b (origin/main merged into claude/F01 as ab0d798).
- Change, `src/contracts/records.acceptance.db.test.ts` only: "ARC-3 the F01 schema files alone create exactly the F01 tables" no longer calls `new PGlite()`. A file-level `beforeAll` (30 s hookTimeout) copies the nine F01 files from `DEFAULT_SCHEMA_DIR` (exported by `src/core/db`) into a temp folder and calls `createTemplate(tmpDir)`; the test clones it and asserts the exact F01 table set plus `insertWorld`. `afterAll` closes the template and removes the folder. The PGlite import is now type-only. Every assertion kept (the per-file existence check is now one `missingF01Files` equals `[]`).
- Results on Node 22 (`npm ci --engine-strict=false`): typecheck green, lint green, `npm test` unit 92 of 92 and db 65 of 65 green (ARC-4 rule passes), `npm run test:flake` 5 of 5 ok (slowest boot 4.1 s).
- Amber: the test names no `db/schema` path literal (TH R4); it takes the nine named files from `DEFAULT_SCHEMA_DIR`, never the folder's listing, so B04 and T07 schema files cannot change its table set. Card Spec commit line left for the Lead (plan/ goes to main).
