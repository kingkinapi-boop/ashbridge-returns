# Running the Claude project once

Staff only. Made-up data only until go-live.

## The one command

`npm run ai:once`

It runs once and stops. There is no timer, no watcher and no schedule (decision 0010): start it by hand each time.

## Settings

- `AI_EXCHANGE_DIR`: the exchange folder, outside this repo. It holds `inbox/` (jobs the app wrote), `outbox/` (what comes back) and one `job-<hex>` folder per call.
- `AI_PROJECT_CLAUDE_BIN`: the Claude program to run. On Windows point it at `claude.exe` or at a script run by node: a `claude.cmd` cannot be started without a shell, and the launcher never uses a shell.
- `CLAUDE_CODE_OAUTH_TOKEN`: the subscription token for the run. Each run uses a fresh empty config folder, so there is no saved login. This is the Claude subscription; no vendor API key is used, and a run refuses if any `*_API_KEY` or `ANTHROPIC_BASE_URL` is set (names only are shown).

## What an outbox refusal means

Each job ends in `outbox/<id>.json`, either an answer or a refusal `{jobId, refusal:{reason, problems, stage}}`. The stage is `input` (refused before any call: not redacted, not approved, test flag missing, sensitive content found), `run` (the call failed, timed out or the approved model did not answer) or `output` (the answer failed the output check). A refusal is a flag for a person. Nothing is retried and the AI never clears or approves anything.

## Whole-run refusals

The launcher refuses to start if: any argument is given; the Claude project is off; a vendor key is set; the exchange folder is inside the repo, is missing, or has a CLAUDE.md in it or any parent; or a run is already going.

A crash can leave `.ai-once.lock` in the exchange folder. Delete it by hand once you are sure no run is going.

## Tools the project denies

`ai-project/settings.json` allows only `Read(./**)` and denies Write, Edit, MultiEdit, NotebookEdit, Bash, WebFetch, WebSearch, Task, Agent and every MCP tool with the wildcard entry `mcp__*`. The wildcard form is not described in `claude --help` (unverified); the flag `--strict-mcp-config` also stops MCP servers loading.

## Flags used (checked against `claude --help`, Claude Code 2.1.288)

Verified in the help: `-p`, `--output-format json`, `--model`, `--system-prompt` (the orders text; there is no `--system-prompt-file`), `--settings`, `--strict-mcp-config`, `--no-session-persistence`, `--permission-prompts none`.

Unverified: the `mcp__*` wildcard deny entry (above). No permission-skipping flag is ever passed.
