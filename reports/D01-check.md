# D01 check (cloud-451039)

FAIL. Content is sound; the card does not fit the repo's checks yet.

Checked: claude/D01 c532562 merged with origin/main 5a70f12 (the branch has no F00 base), Node 24.

- FAIL step 2, `npm run lint`: `design/map/map.acceptance.test.ts was not found by the project service` (not in tsconfig include or allowDefaultProject).
- FAIL step 4, `npm test`: the 19 acceptance tests never run. `vitest.config.ts` unit include is only `src/**/*.test.ts` and `tools/test/**/*.test.mjs`. Run with a config including `design/**/*.test.ts`, all 19 pass (so the content meets all 5 acceptance checks). The spec report already flagged this need (design/**/*.test.ts in the unit include). Rule candidate: any card whose tests live outside src/ must get its path added to the vitest include and the lint project in the same spec commit; a rule test that every `*.acceptance.test.ts` is matched by a vitest project.
- PASS: typecheck, deps:check, spec file unchanged since d082015, scope clean, no em dashes, no client sentence, no real-looking data.
- Not run: e2e, mutation (no code changed; design only), security (not marked).

Fix list: add `design/**/*.test.ts` to vitest unit include and to the eslint/tsconfig project (infra files, Lead or a small card); then re-check D01 (no content change needed).

Permission gaps: none. Model: Sonnet 5.5.
