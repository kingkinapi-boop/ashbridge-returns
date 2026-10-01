# F01 spec: released

Worker: cloud-vm (model: Sonnet 5.5). Role needs Opus 5.5 for a core card, and no Opus subagent was run.

F01 spec cannot be done yet. F00 (vitest, PGlite helper in src/core/db, package.json) is not on any branch, so tests cannot be run to show they fail for the right reason (spec-writer step 5). Writing them blind would break the rule.

Do first: F00 build, then re-queue F01 spec (core: use a spec-writer subagent on Opus).

Permission gaps: none met.
Model: claude-sonnet-5-5.
Note: two workers share the name cloud-vm (hostname tail is the same). Use a unique name per worker.
