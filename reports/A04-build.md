# A04 build report (cloud-3e2f84, 2 Oct 2026)

Branch `claude/A04`, build commits on top of spec 9d97dd0 and main e77ffc5. RELEASED, not reported: one test cannot pass.

## Blocker (spec, not build)
`__golden__/inbox-finding-c01.json` holds `"minLength": 1` on every non-blank string in its `schema` block (about 12 places). Current main's `NonBlankSchema` (src/contracts/text.ts, a `.refine`) emits no `minLength` in `z.toJSONSchema`, so the same test file's other check (schema equals `z.toJSONSchema(aiStepSchemas.finding)`) passes while the golden snapshot fails. Only those lines differ. The golden was written against an older F01 text schema. Fix by a spec refit: regenerate the golden (`vitest -u` on that one test) after confirming nothing else differs. I did not touch it.
Because that test fails the initial run, `npm run mutate:changed -- A04` aborts at the dry run; mutation numbers are not available yet.

## Done
- `src/modules/ai/{index.ts,runner/schemas.ts,engines.ts,runner.ts}`, `data/ai/approved.json` (no triples).
- Acceptance: 50 of 51 pass (unit 45 of 46, db 5 of 5). typecheck, lint, deps:check clean; scope OK (14 files).

## Ambers
- B1 The stamp must match the job on model id, prompt version, prompt hash and input hash (not only input hash); reverse by trimming `expected` in runner.ts.
- B2 Go-live is a constant off (`GO_LIVE_ON`); no setting exists yet. Reverse when a go-live switch lands.
- B3 The project engine polls the outbox with no timeout (24 hour lease covers it).

## Permission gaps
None.

## Model
Sonnet 5.5 (core card; no adversarial read run because the build is not reported).
