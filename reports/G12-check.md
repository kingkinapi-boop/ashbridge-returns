# G12 check

FAIL. Typecheck, lint, deps:check clean; gaps unit 123/123 pass.

1. Spec edited by the build (scope FAIL, ae9d809): src/modules/gaps/bank/assets-cca.test.ts, a spec(G12) file (b8ec230). The builder removed `expect(keys.length).toBeGreaterThan(0)` from "AI-12 each assets-cca item resolves a distinct fact", so an empty assets-cca bank now passes; it also rewrote the first test. Shows with: `git diff b8ec230 HEAD -- src/modules/gaps/bank/assets-cca.test.ts` and `node tools/scope.mjs G12`.

Fix: restore the spec file to b8ec230 (`git checkout b8ec230 -- src/modules/gaps/bank/assets-cca.test.ts`) and re-run; the bank has 6 items so it should still pass.

Rule candidate: scope.mjs already catches this; builders must run it before reporting (G12 build note claimed scope OK).

Not run after the stop: e2e, mutation (data-only card).

Permission gaps: none. Model: Sonnet 5.5.
