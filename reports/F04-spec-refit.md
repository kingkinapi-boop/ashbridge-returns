# F04 spec refit (cloud-44dfa6, Opus subagent)
Commit ec29150 on claude/F04, validated on main a11d30e. Import changed to BoxSchema (F09's export at 2216375); no assertion changed.
Red for the right reason: ./ai missing; ./reading missing on main until F09 lands (typecheck and lint cannot pass before that). npm test: only ai.acceptance fails.
Amber: none. Permission gaps: none. Model: Opus 5.5 (subagent), Sonnet 5.5.
