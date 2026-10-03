# Outside world sweep, 3 Oct 2026, for the Critic
Opened 3 Oct 2026 12:33Z (date -u). Labels: [fact] read on the page, [inference] my reading. Compared against reference/research/2026-10-02c-outside-world.md.

Answer: NOTHING NEW since 2 Oct that changes how this build runs.

Checked, no change [fact]:
- Claude Code: npm "latest" and "next" are both 2.1.288 (published 2 Oct 18:30Z); GitHub releases newest is v2.1.288 (2 Oct 20:19Z). No 2.1.289 or later yet. https://registry.npmjs.org/@anthropic-ai/claude-code ; https://api.github.com/repos/anthropics/claude-code/releases ; https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
- Models: no model released after Sonnet 5.5 (28 Sep). Opus 5.5 and Sonnet 5.5 not retired before 22 and 28 Sep 2027. Haiku 4.5 still "not sooner than 15 Oct 2026". Only deprecation notice is Sonnet 4.5 (30 Sep). Haiku 5.5 is still only "in the coming weeks" (Opus 5.5 post, 22 Sep), already noted in reference/research/2026-09-29-agentic-build-practices.md. https://platform.claude.com/docs/en/about-claude/model-deprecations ; https://www.anthropic.com/news/claude-opus-5-5
- Anthropic news: newest posts are 1 and 2 Oct (Barclays; $100M engineer training), neither relevant. Engineering blog: newest post 23 Apr 2026. https://www.anthropic.com/news ; https://www.anthropic.com/engineering
- Release notes: platform notes end at 30 Sep; Claude apps notes end at 28 Sep; nothing on usage limits, cloud sessions or routines after 2 Oct. https://platform.claude.com/docs/en/release-notes/overview ; https://support.claude.com/en/articles/12138966-release-notes
- Routines and cloud docs: text matches the 2 Oct sweep (same /fire beta header, 30 per hour per routine, no callback, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE set by cloud sessions, command timeouts 2 and 10 minutes). https://code.claude.com/docs/en/routines ; https://code.claude.com/docs/en/claude-code-on-the-web ; https://code.claude.com/docs/en/cloud-environments
- Usage limits: last change is 22 Sep (Opus 5.5 raised five-hour limits; saveable reset). Cloud credit ($100 Pro, $250 Max, claim by 7 Oct, expires early Nov) is already in reference/research/2026-09-29-claude-code-facts.md line 29; whether routines draw on it is still unverified. Secondary source only: https://aitoolsreview.co.uk/insights/claude-code-250-credit-cloud-sessions (30 Sep).
- Status page: no incident listed 1 Oct or later (page gave no history; weak evidence). https://status.claude.com/history

Minor, from 2.1.288 (2 Oct), not in the 2 Oct file [fact, then inference]:
- Unattended sessions (CLAUDE_CODE_RETRY_WATCHDOG) now stop after three stream timeouts instead of retrying for hours. Should shorten some stuck cloud runs. No action.
- A message to a session that held it is now reported as not delivered. Matters only if worker-to-Lead messaging is tried.

For the Critic [inference]: no change to modes, dispatch, hooks or the 300k compact setting. Ask Zo for no new item. Re-sweep when 2.1.289 or Haiku 5.5 appears.
