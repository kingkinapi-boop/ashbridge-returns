# Claude Code facts that shape the build (checked 29 Sep 2026)

Checked by a claude-code-guide helper against the live docs (changelog v2.1.284, 28 Sep). Base URL: https://code.claude.com/docs/en/ . "Not documented" means no statement was found. Re-check before relying on anything here for more than a month.

## Seeing and steering cloud work
- claude.ai/code (browser) and the mobile app's Code tab list every cloud session, including routine runs. The desktop app can start cloud sessions; whether it lists cloud sessions started elsewhere is not documented. (claude-code-on-the-web, desktop, mobile)
- Projects (public beta, Pro and Max, rolling out): an Overview pane grouping threads as Ready for review, Waiting on you, Working, Landing, Idle, Resolved, with Pause everything and a Usage tab. The closest thing to a dashboard for many sessions. (claude-projects)
- `claude --teleport` pulls a cloud session into the terminal (clean git state, branch pushed). `claude --cloud "task"` starts a new cloud session from the GitHub remote. (claude-code-on-the-web)
- Concurrent cloud sessions: no documented cap; they share account limits. (claude-code-on-the-web)

## Routines
- A saved prompt that runs as a full cloud session. Research preview. Schedule (minimum hourly), API fire URL, or GitHub events. One-off runs do not count against the daily run cap (the cap's number shows only in the UI). API fires: 30 per hour per routine, 100 per hour per account. `/schedule` does not work inside a cloud session. (routines)
- Routines run without permission prompts. They push only to `claude/` branches reliably. (routines, cloud-environments)

## Clear, state and memory in the cloud
- `/clear` does not work in cloud sessions: start a new session. `/compact` works. Every session starts from a fresh clone; only what is pushed survives. (claude-code-on-the-web)
- The repo's CLAUDE.md and `.claude/rules/` load in cloud sessions; rules with `paths:` load only when a matching file is read; subagents load project rules. (memory, sub-agents)
- Auto memory (`~/.claude/projects/.../memory/`) is machine-local and never reaches cloud sessions. Anything a cloud role needs must be in the repo. (memory)
- VM: 4 vCPU, 16 GB RAM, 30 GB disk; commands time out at 2 minutes by default, 10 at most. (cloud-environments)

## Permissions and hooks in the cloud
- Project hooks and permission rules in the committed `.claude/settings.json` run only in single-repo sessions. User-level hooks and `settings.local.json` never reach the cloud. (cloud-environments, settings)
- Interactive cloud sessions offer Accept edits, Plan and Auto; no Bypass (`bypassPermissions` in settings is ignored). An unanswered prompt stalls the session until it expires. Auto mode or allow rules avoid stalls. (permission-modes)
- Playwright and Chromium download hosts are not on the default trusted network list: whether browser journeys work in the cloud out of the box is not documented. Test it in the rehearsal, before anything depends on it. (cloud-environments)

## Usage and money
- Max 20x: a five-hour limit and a weekly limit shared by Claude, Claude Code, desktop, cloud sessions and routines. Separate "Opus limit" and "Sonnet limit" errors exist; sizes not documented. (support 11049741, 11647753, errors)
- A saveable limit reset ("Reset for free", Settings, Usage, on the web or desktop) sets the five-hour or weekly limit back to full; unused resets expire. (support 17007452, anthropic.com/claude-opus-5-5)
- Cloud promo credit: press and Anthropic's X post say $250 on Max, claimed by 7 Oct, expires 4 Nov 11:59 pm Pacific, applied automatically when a cloud session starts, then plan limits. One blog says Projects and Routines are excluded: UNVERIFIED. If true, routine-started workers spend plan usage, not the credit. Check the claim page while signed in. (bleepingcomputer.com article; x.com/ClaudeDevs)
- API list prices per million tokens: Opus 5.5 $4 in, $20 out; Sonnet 5.5 $2, $10; Haiku 4.5 $1, $5. Opus costs twice Sonnet per token. How models convert to plan usage is not documented. (platform.claude.com pricing)

## Models and helpers
- Opus 5.5 (`opus`, default on Max) and Sonnet 5.5 (`sonnet`, added to Claude Code 28 Sep), both 1M context. A helper's `model` field picks its model; `CLAUDE_CODE_SUBAGENT_MODEL` sets a default. (model-config, sub-agents)
- Agent teams: experimental, off by default, about 7 times the tokens of one session. Keep off (amber A16 stands). (agent-teams, costs)
- Up to 20 concurrent subagents per session by default. (sub-agents)

## The laptop
- No per-session memory figure is documented; one session warns past a 2.5 GB heap. Background sessions (`claude agents`) are stopped when idle for about an hour or when memory runs low. In worktrees, `${CLAUDE_PROJECT_DIR}` in hooks points at the main checkout; the hook's `cwd` follows the worktree. (troubleshooting, agent-view, worktrees)
