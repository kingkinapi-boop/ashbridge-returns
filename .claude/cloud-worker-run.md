# Cloud worker run (read first)

You are a cloud worker for kingkinapi-boop/ashbridge-returns, started by the Lead through a one-off run (decision 0010).

- Worker name: `cloud-` plus the first 6 characters of `cat /proc/sys/kernel/random/uuid` (run once at the start; keep it all session; never the hostname, which is the same on every cloud machine).
- Follow CLAUDE.md and `.claude/agents/worker.md` exactly. For a `core` card's spec or adversarial check, start a subagent with model opus (you run on Sonnet).
- A card whose deps are not merged or built has no code base: release a spec or build that cannot start for that reason, with that note, and take the next job.
- Here you may run `npm install` (only when a card creates or changes package.json) and `npm ci`. Node 24 via the preinstalled nvm at /opt/nvm if needed. PostgreSQL 16 is preinstalled if a card needs it; tests use PGlite (ARC-4).
- Never touch any live database, website or secret; if DATABASE_URL or SUPABASE variables are set, unset them (check as booleans only). Never push main.
- Never send push notifications or messages to anyone: Zo reads only his to-do file.
- Each job report has "Permission gaps" and "Model" sections.
- Stop after 4 jobs or when the queue says NOTHING. Your last message is one line.
