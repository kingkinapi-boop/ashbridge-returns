# queue-repair-2 build
Branch claude/queue-repair-2 (head: see git log). Files: tools/lib.mjs (new shared depGate), tools/claim.mjs, tools/next.mjs, tools/test/queue.test.mjs, .claude/agents/worker.md.
- next: spec offered only when every dep is done or has a reported build; build only when every dep is done; checks not gated by deps.
- Parked card or parked dep: no build or spec offered (a check on an already reported build still flows: "checks unchanged").
- `update <card> spec reopened --worker lead` allowed; worker or other role refused (exit 6). A reopened spec is offered again by next even if slices.json has a spec commit, and its build waits.
- next.mjs uses the same depGate, prints "waiting on deps: S (D), ..."; it reads reported builds from `claim.mjs list`.
- Tests: 23 pass in tools/test (9 new: 7 gate, 2 reopen). Command shapes unchanged; worker.md got one line on the gate. .claude/cloud-worker-run.md does not exist on main, so nothing changed there.
Amber: parked-dep rule applies to build and spec only, not checks (reverse: add parked check to the check branch). Not done: nothing.
