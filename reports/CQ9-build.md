# CQ9 build report (cloud-84988c)
Branch claude/CQ9. Files: stryker.config.mjs (dryRunTimeoutMinutes 45), tools/mutate-changed.mjs (`--` pass-through without a shell; family cards read plan/cards/families/<family>.md for Tags; core card with no product glob prints "no product code to mutate", exit 0).
Acceptance: 15 of 15 in tools/test/mutate-args.test.mjs.
NOT DONE: the "Also (A465)" item (scope.mjs tells `*.build.test.ts` from a spec file): tools/scope.mjs is outside this card's Paths (stryker.config.mjs, tools/mutate-changed.mjs, tools/test/mutate-args.test.mjs) and no spec test covers it. Lead: add tools/scope.mjs to Paths and a spec, or move it to its own card.
Amber: a glob counts as product code when it starts with src/ or testworld/ and names no __fixtures__, __golden__ or test-file pattern. Reverse: edit `productGlob` in mutate-changed.mjs.
Permission gaps: none. Model: Sonnet 5.5.
