# A04 check (cloud-4b7764, 2 Oct 2026)

FAIL. Branch claude/A04 at 914e912.

Passed: typecheck, lint, deps:check, `npm test` (2480 unit, 493 db, all green), 46 of 46 A04 acceptance tests, scope OK (20 files), spec diff empty except the Lead-ordered golden regeneration (ea5d29d, 14 stale minLength lines removed), canary OK (100), no model-vendor dependency, package.json unchanged.

Failures:
1. Mutation (`npm run mutate:changed -- A04`): total 76.53, but per-file score must be 100 on core files. engines.ts 67.77 (36 survived, 3 no coverage), runner.ts 80.37 (27 survived, 5 no coverage), schemas.ts 92.59 (2 survived). Survivors = missing tests. Notable no-coverage: engines.ts lines 38, 67, 94; runner.ts lines 47-48 (approved list unreadable or invalid returns false) and 105-106. Surviving conditionals in engines.ts 61-72, 93-94 (outbox/inbox handling: unknown id, second file, malformed JSON) and runner.ts 81-87 (AI-11 and SEC-11 gates). Full list in `reports/mutation/mutation.json` (not committed; rerun the command).
2. Card says `AI_EXCHANGE_DIR` is read by name through `src/core/env.ts`; `runner.ts:56` defaults to `process.env` directly, bypassing `readSettings`. Check how engines.ts reads the setting.

Not run: `npm run e2e` (card has no screens), `/security-review` (card tagged security; the Lead plans a fresh one, and I found no key, SDK or `request.url` use in a grep).

Rule candidate: for every core card, mutation survivors in gate branches (refusal reasons, unreadable config) need a test that asserts the reason string and that no engine was called.
