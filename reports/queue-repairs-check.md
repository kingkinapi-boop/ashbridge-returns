# Queue repairs check

FAIL

- .claude/agents/worker.md line 24 (check FAIL): still tells the checker to run `update <card> build failed --worker <checker>`. The new owner check refuses it (exit 6, build held by the builder). Change to one command: `update <card> check failed --worker <name> --note "..."` (it holds the build). checker.md is not updated either; `beat` is in no caller (worker.md should say to beat about every 30 minutes). Show: owner line in update() of tools/claim.mjs.
- Rule candidate: when a command rules change, grep every doc that calls it in the same card.

Verified OK: retry/backoff/jitter, one-pass read, owner check (mutation: test failed), beat and stale, check failed holds build in one push, only lead reopens, wind_down_at (mutation: test failed), scope, settings.json diff (only requested allows and env; hooks and denies unchanged), 14 of 14 tests pass.
Minor: scope.mjs accepts any backticked token under a tests heading, so a card could list a broad glob.
