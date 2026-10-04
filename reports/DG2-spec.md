# DG2 spec report (cloud-1452fe, Sonnet; card is not core)
Branch claude/DG2, spec commit e480b61, validated on main 6d1efdf.
7 new tests in tools/test/done-gate.test.mjs (R20 DG2 block, ARC-15) plus fixture card DGT (core, Paths testworld/**); all 7 fail on main for the right reason; typecheck and lint clean.
Retired by step 6b: "R20 ARC-15: 'no mutation targets changed' is exit 0 only when the card changed no src file at all" (done-gate.test.mjs, core DGC) superseded by DG2 spec item 2; kept for non-core DGP, core case now expects exit 1.
Title-count guard raised to 32. Not unit-tested (check phase): mutate:canary 100 and F05M score (spec item 4).
Amber: failure message for zero marked targets must match /no marked mutation target/i.
