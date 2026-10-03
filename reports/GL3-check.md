# GL3 check (cloud-6ca6b4, 3 Oct 2026) FAIL
Branch claude/GL3 at e4d95939, Node 24.21.0, Postgres 16.14.

## Failure (1)
- db/bridge/0002_grants.sql:20 `grant execute on all functions in schema returns to returns_app;` The card grants only returns_app select on the bridge views and client_app_reader select on returns.client_handoff. This blanket grant is unasked, is the build's own amber 1, is not needed by any GL3 test, and covers every future function in schema returns (GL2's ground: "the rights its code uses"). Fix: delete line 20 and fix the comment on line 18; keep line 19 (revoke from public). Found by the Opus adversarial read; line confirmed by me.
Rule candidate: a grant file holds only the grants the card names; a rule test lists every `grant` statement in db/**/*.sql against the card's allow list.

## Low advisories (not failures)
- A1 0001_bridge_views.sql:32 t2_return hard-joins flow_progress (migration 0030) with no fallback; contract U9 says no code assumes 0030 exists, so 0001 fails to apply if it is absent.
- A2 0001_bridge_views.sql:54-55 v2 pointer branch keeps the first entry of each answer; the `drive:([^|]+)` capture can run past an entry not separated by '|'.
- A3 0002_grants.sql:30 RLS enabled again (already at 05_bridge.sql:125); harmless.
- Views run with owner rights (intended); README should say so in one line.

## Passed
typecheck, lint; npm test 633 pass (1 expected fail, 5 skipped); db project on pg16 (TEST_DB=pg16) 638 pass, 1 skipped; spec files unchanged since e6f1676a; scope OK (17 files); mutate:canary ok; mutate:changed GL3: scan.ts 100 (125 killed, 0 survived). Adversarial read: column lists equal views.json, BRIDGE_SHAPES fit, never-read list clean, client_handoff columns equal BridgeHandoffRowSchema, RLS never returns draft, anon/authenticated/PUBLIC revoked, no client sentences.
## Not run
npm run test:flake and e2e (stopped after the failure was established; run them on the rebuild). `/security-review` as a separate pass: the Opus read covered the diff; nothing medium or higher except the grant.
Permission gaps: a subagent's write of its findings to the scratchpad was refused by the protect-spec hook (no other route tried). Model: Sonnet 5.5 (adversarial read Opus 5.5).
