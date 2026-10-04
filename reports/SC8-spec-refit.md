# SC8 spec refit (cloud-07698b, Opus spec-writer subagent)
A479 regex and plants (f788ca60) and A436 gaps G1 to G6 (99791441) were already in the spec; nothing redone. Fix: the G5 baseline listed-baseline.json recaptured at spec tip 40391e96 (egress-rules +1 title, +5 expects; auth rules +1 expect), test file marker updated. Commit 7849b700 on claude/SC8, merged main 89be70a6. typecheck and lint pass; npm test passes except the card's own 10 R79 tests (fail by design until the build). Retired: none. Step 6b skipped (stub = the build).
Amber: baseline capturedAt is the SC8 spec tip, not main; every later refit must recapture it the same way.
Permission gaps: none. Model: Sonnet 5.5 worker, Opus 5.5 spec-writer.
