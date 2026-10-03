# A04 build, round 5 (cloud-dfeb44, 3 Oct 2026)

Branch claude/A04. Spec patch G1 to G5 (A456) is in; this is the build for fix list items 2 to 7.
Files: src/core/safe-read.ts (new, @mutate), src/modules/ai/runner/{engines,runner,schemas}.ts, src/modules/ai/index.ts, build tests src/core/safe-read.test.ts and engines.build.test.ts (round 5 block).
Built: AiJobIdSchema (allowlist, device names refused), OUTBOX_MAX_BYTES, OutboxRefusalSchema (stage); inbox/outbox real-folder check, staging .staging-<id>-<random> with wx; own file via readRegularFile (not-a-file, too big, not JSON, not one result or refusal, another job; refusal fails at once, counted for stage output); strangers lstat only, quoted, keyed by size and mtime; deadline (lease minus 10 min; runner option now, ctx deadline, handler passes ctx.now plus lease minus margin); waiting is a count.
Numbers: typecheck clean; unit 2847 pass (A04 files 248); db ai-exchange 6 pass; deps:check clean; mutation 100 on engines.ts, safe-read.ts, runner.ts, schemas.ts, index.ts, env.ts (one BlockStatement disabled with reason in realFolder: empty catch is equivalent).
BLOCKED on one command: npm run lint has 1 error, in the spec file src/modules/ai/runner/exchange-safe-read.acceptance.test.ts:63 (`as Parameters<typeof createAiRunner>[0]` is now unnecessary because the build adds the `now` option). Spec fix: delete that assertion (one line). I did not edit the spec file.
scope.mjs prints "spec file edited by the build: reports/A04-spec.md in bf0c21d": that is the spec round 5 report commit, not this build.
Not run here: test:flake, /security-review (checker's job), the A08 re-merge.
Ambers: A1 getting the own file first, strangers only when it is not there; A2 realFolder uses realpath equality (lstat-free, same effect); A3 EngineResult carries `counted` so the runner counts stage output refusals; A4 AI_LEASE_MARGIN_MS exported from runner.ts. Reverse by editing those lines.
Permission gaps: none. Model: Sonnet 5.5.
