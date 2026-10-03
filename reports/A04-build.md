# A04 build, round 2 (cloud-88d9d7, 3 Oct 2026)

Branch `claude/A04`. Fixes items 2 to 5 of reports/A04-findings.md plus the round 3 spec (G1, G2, duplicates).

Files: src/core/env.ts (AI_EXCHANGE_DIR, optional, no min), src/modules/ai/runner/{runner,engines,schemas}.ts, new engines.build.test.ts (3 own tests: EISDIR reason for a folder recording, name order of the duplicate message, a folder named for the job in the outbox).

Numbers: acceptance 106 of 106 unit + 5 db pass; `npm test` unit 2606 and db 550 pass; typecheck, lint, deps:check clean; scope OK (23 files).
Mutation (`npm run mutate:changed -- A04`, fresh cache): env.ts, engines.ts, runner.ts, schemas.ts all 100. Reasoned disables (2, in engines.ts): the unreadable-own-outbox-file branch (same ignore as a non-JSON one) and `tryParse`'s `{ ok: false }` (callers read only `ok`).

Done: setting through env.ts, folder captured once at the switch, no process.env, GO_LIVE_ON deleted, default sink is the core logger, strict RecordingSchema, approved list unreadable gets its own reason, malformed recordings skipped and logged once by name with the reason (unparseable / not one recording / error code), duplicate recordings refused naming both files, outbox filter dropped (any file logged by name), blank folder refused as a result, `readUtf8` via TextDecoder (no encoding literals), inbox file has no trailing newline (golden compares canonical JSON).

Amber: A1 unreadable-entry reason is the Node error code (e.g. EISDIR). A2 dedupe key for logged files is line plus content. Reverse by editing engines.ts logOnce.
Not done: GL1 must re-add the go-live term with both directions tested (Lead adds to GL1's card). A08 should write temp files outside outbox/, then rename in. Security review still to run at the check.

Permission gaps: none. Model: Sonnet 5.5.
