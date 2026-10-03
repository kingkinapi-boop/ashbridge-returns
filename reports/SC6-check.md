# SC6 check, round 4 (cloud-b04976)

FAIL. Branch claude/SC6 at 7355b03 merged with origin/main. Node 24.21.0.

Passed: typecheck, lint, deps:check, tools/test (641 tests), scope.mjs (6 files, all in Paths), all five A528 plants fail on d245511 and pass on the fix, R77/R81 deleted not skipped.

Failures
1. `npm test`: src/core/egress-rules.acceptance.test.ts "SEC-10 no spawn or exec in tools/ runs a shell" fails: `tools/test/spec-rules.test.mjs: imports exec/execSync, which always run a shell`. Command: `npx vitest run --project unit src/core/egress-rules.acceptance.test.ts`. Never weaken SEC-10 (A329); the file must not import exec/execSync.
2. Opus read, tools/test/spec-rules.test.mjs, forms inside the stated R78 grammar that pass (scratch probes, not committed):
   - :339-351 gitSegments/shellSegments split argv words and quoted args at | and ;, then drop the trailing segment. `spawnSync('git', ['log', '--format=%H|%s', 'main'])`, same with `;`, `execFileSync('git', ['log', '--pretty=format:%h|%an', 'master'])`, `spawnSync('git', ['grep', '-E', 'a|b', 'main'])`, `execSync('git log --format="%H|%s" main')` return []. Regression: d245511 caught the first. Only shell strings split.
   - :334-335 unquote strips quotes only at word ends: `execSync('git diff "main"~1 -- x')` and `"main"^` pass.
   - :477 initCalls accepts whitespace after the dot: `/^git (\w+)/. exec('git init -q')` makes the file exempt.
   - :325-328 option value read as subcommand: `execSync('git -C init diff main')`, `spawnSync('git', ['-C','init','diff','main'])` pass.
Rule candidate: a reader that splits text splits only text of the class that has those separators (shell strings, not argv), and every segment it drops gets a planted near-miss.
Model: Sonnet 5.5 worker; Opus 5.5 subagent for the adversarial read. Permission gaps: none.
