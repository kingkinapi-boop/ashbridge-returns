# FX11 spec (cloud-8dacd4, 3 Oct 2026)
- Tests: src/modules/ocr/recorded/recorded.engine-match.acceptance.test.ts (7: 4 planted mismatches fail until the build, version, name, source side, via adapter; 3 clean twins pass); R84-run KNOWN entry owned by FX11 deleted from tools/test/__fixtures__/settings-rules/known.json, so SC5's R84-run test fails until the build (FX11's two R101 entries kept). Spec commit 4a240e8c.
- Clauses: AI-10, EV-5 (rule R84). Unit project only; the recorded tests are unit tests.
- Validated on main 89be70a6 (typecheck, lint green; unit src/modules/ocr and tools/test: only the 5 FX11 tests fail, refusal missing). Whole unit suite green under a throwaway stub.
- Retired by 6b: none.
- Amber: refusal message must contain the fingerprint, "sourceEngine", "result.engine" and both stamps' names and versions, never "no recording for". The branch carries SC5's unmerged commits (rules file, known.json), so SC5 must land before FX11.
