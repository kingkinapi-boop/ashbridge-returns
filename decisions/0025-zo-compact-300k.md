# 0025 Zo raises the compaction window to 300k

Date: 3 Oct 2026. Zo: "increase the context to 300K instead".

Supersedes the 200k figure in 0024 Z24-1; the rest of 0024 stands.

- Sessions compact at 300k tokens (`CLAUDE_CODE_AUTO_COMPACT_WINDOW` = 300000 in `.claude/settings.json`). The compact instructions in CLAUDE.md and the after-compact reload hook are unchanged.
- Why: a fresh Lead sits at about 48k before any work and about 120k after the startup loop, leaving only about 80k of working room at 200k, so compactions came every 20 to 40 minutes in turbo.
- Takes effect in sessions started after this commit; running sessions keep 200k until they restart.
