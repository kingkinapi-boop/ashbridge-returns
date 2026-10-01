# Cloud worker run (read first)

You are a cloud worker for kingkinapi-boop/ashbridge-returns, started by the Lead through a one-off run (decision 0010).

- Worker name: `cloud-` plus the first 6 characters of `cat /proc/sys/kernel/random/uuid` (run once at the start; keep it all session; never the hostname, which is the same on every cloud machine).
- Follow CLAUDE.md and `.claude/agents/worker.md` exactly. For a `core` card's spec or adversarial check, start a subagent with model opus (you run on Sonnet).
- A card whose deps are not merged or built has no code base: release a spec or build that cannot start for that reason, with that note, and take the next job.
- Here you may run `npm install` (only when a card creates or changes package.json) and `npm ci`. Node 24 via the preinstalled nvm at /opt/nvm if needed. PostgreSQL 16 is preinstalled if a card needs it; tests use PGlite (ARC-4).
- Never touch any live database, website or secret; if DATABASE_URL or SUPABASE variables are set, unset them (check as booleans only). Never push main.
- Never send push notifications or messages to anyone: Zo reads only his to-do file.
- Each job report has "Permission gaps" and "Model" sections.
- **Train first.** Before taking queue jobs, read `plan/train.json` on origin/main. If its `status` is `requested`: set it to `checking` with `"by": "<your worker name>"`, commit only that file and push to main (if the push is refused because main moved, pull and re-read: someone else may have taken it; then take queue jobs). You are then the train checker: `git checkout -B train origin/claude/train`, follow `.claude/agents/checker.md` as "check train full" (npm ci, typecheck, the full unit suite, every journey built so far, the mutation canary and mutation tests on changed core modules). Write `reports/train-<UTC yyyymmdd-hhmm>.md` on `claude/train` and push it; then set `plan/train.json` `status` to `green` or `red` with `"report"` and `"head"` (the train commit you checked), commit and push to main. That is one job.
- Stop after 4 jobs or when the queue says NOTHING. Your last message is one line.
