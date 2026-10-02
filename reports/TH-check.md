# TH check (cloud-337b0b, 2 Oct 2026)

PASS, with one note for the Lead.

Branch claude/TH (7609c4e) merged with origin/main a3c7799 locally (clean, not pushed).
- typecheck, lint, deps:check: clean.
- `npm test`: 723 of 724 pass. The one failure is `src/contracts/taxprep.acceptance.test.ts` "RT-3 RT-9 property (fixed seed): text of any Windows-1252 characters" (F03 round 2 spec). It also fails on main-based branches without TH (seen by the F04 spec worker on a3c7799), so it is not TH's. Needs a F03 fix card; it will redden the train unless handled.
- `npm run test:flake`: 5 of 5 ok.
- `npm run mutate:canary`: 100.
- Spec files (toolchain-rules.test.mjs, egress-rules.acceptance.test.ts, fixtures) unchanged since spec commit 0299b2e.
- `node tools/scope.mjs TH`: clean (20 files).
- gitleaks v8.28.0 (the CI pin) with `--redact --log-opts="HEAD"` on the branch: 295 commits, no leaks. Allowlist is regex-scoped, not whole folders.
- Diff read: configs read globs from tools/test-homes.json; mutate config keeps src only; nothing outside the card.

Not run: GitHub's own Actions run (cannot from here).

## Permission gaps
None. ## Model
Sonnet 5.5 (non-core card, no Opus read needed).
