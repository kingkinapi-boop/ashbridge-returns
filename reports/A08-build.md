# A08 build, round 3 (BLOCKED: mutation not 100)
Worker cloud-0cc6b0. Branch claude/A08, build commit "build(A08): round 3 B1 to B6, G2, G5, G8" (on top of spec 5ed532c2).
Files: src/modules/ai/project/{call,index,scan}.ts, src/core/env.ts, ai-project/RUNNING.md.
Done: B1 (isInside on realpath.native, prefix test), B2 (every lock error is one refusal), B3 (no slice, no sort in scan, no .cjs, empty vendor value refuses), B4 (four reasoned next-line disables), B5 (AI_PROJECT_CLAUDE_BIN in env.ts), B6 (RUNNING.md), G2 (pattern without `$`), G5 (missing root refuses), G8 (config folder removed at run end), claudeOutputMaxBytes option.
Numbers (Node 24.21, Linux): the 4 unit files 381 passed, 2 skipped; db ai-project joint test 3 passed; src/core + tools/test 888 passed; typecheck, lint, deps:check clean; scope OK (40 files).
BLOCKED: `mutate:changed -- A08` overall 96.08. env.ts 100; call.ts 98.25 (line 55 StringLiteral, NoCoverage); index.ts 95.19 (survivors lines 52 55 59 60 90 109 110 111 117 121 190 234 266 282 293 294 295 297 353); scan.ts 97.02 (lines 21 37 47 62 68). Tests are spec-owned, so I did not edit them: needs a spec patch for these rows (findings review first), or Lead rulings on the equivalent ones.
Not run: pg16 run, Windows rows (G4/G5 win32), security review.
Ambers: none new beyond the card's rulings.
Permission gaps: none. Model: Sonnet 5.5.
