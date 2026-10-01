# Queue repairs build

Branch `claude/queue-repairs` (head: see `git log`). Files: `tools/claim.mjs`, `tools/scope.mjs`, `tools/status.mjs`, `.claude/settings.json`, `tools/test/queue.test.mjs`.

- claim.mjs: push retry with exponential backoff and full jitter, 6 tries (any refused push); claims read in one `ls-tree` plus one `cat-file --batch`; owner check (exit 6, `--worker lead` exempt, holder name kept); `beat` heartbeat, `list` shows minutes since last beat and "(stale)" at 90; `update <card> check failed` writes check and puts the build on `hold-findings` in one push; only `update <card> build reopened --worker lead` reopens it (round counter continues); `next` refuses builds after `wind_down_at`. Test hooks: `CLAIMS_NOW`, `CLAIMS_BACKOFF_MS`.
- scope.mjs: allows `**/*.acceptance.test.ts`, `**/__golden__/**` and paths the card lists (a `Tests:`/`Golden:` line, or bullets/backticks under a heading naming tests or golden).
- status.mjs prints `wind-down at <time>` and "(PASSED: no new builds)".
- settings.json: allow-list additions as asked (`npm ci`, `gh run list/view`, `gh pr view`, `git worktree add/remove`, `git -C * merge/push`, `claude --cloud *`); `env` pins ANTHROPIC_DEFAULT_OPUS/SONNET/HAIKU_MODEL. Deny rules untouched; the main push hook still covers `git -C * push`.
- Tests: `node tools/heavy.mjs -- npx vitest run tools/test`: 14 passed (about 2 minutes on this laptop; each test spawns many processes).

Ambers: (1) the spec-writer patterns are allowed for every card, not only cards that list them (the audit found no card lists them); reverse by deleting the two defaults in scope.mjs. (2) A check FAIL puts the build on `hold-findings` with no round limit; the Lead reopens. (3) Stale only applies to `working`; `hold-findings` never expires.
Could not do: a live 16-way race test (the retry is tested with a simulated rejecting remote). worker.md and checker.md still describe FAIL as two pushes and do not mention `beat`: the Lead should update them (`.claude/agents/`, outside this task).
