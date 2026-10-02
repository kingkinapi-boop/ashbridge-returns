# F02 spec (round 2: cloud-c8eb87, Opus spec-writer, 2 Oct; round 1: cloud-d42547)
Spec commit f345742 on claude/F02, based on origin/claude/F01C 2866afe (F01C build reported, not yet on main) merged with origin/main; validated on main e949b5c.
Tests: 102 in src/modules/lifecycle/ (unit 25, db 77). Round 2 adds the card's "From findings F01 round 2" section: who, why and holder checked with isBlank over the whole blank class (16 samples plus a seeded property over BLANK_RANGES) on move, voidApproval, setWaiting, clearWaiting, takeHold, releaseHold, returning ok:false (voidApproval: voided:false with a reason) before any guard or write; one transaction for event and return update (planted triggers on the return update and on the approval event; nothing kept, no pending event left); a refused guard leaves no pending event; FLOW-4 fingerprint refuses blank ids and versions below 1.
Red for the right reason: both files fail at import (./index and ../../contracts/lifecycle missing); typecheck and lint errors only there. Unit 1532 and db 295 otherwise green.
Step 6b: a throwaway stub passed all 102 and the whole suite (unit 1557, db 372), typecheck and lint clean. Planted faults caught: trim instead of isBlank (5 tests), no transaction (2 tests). Retired: none. Stub worktree removed.
## Ambers (round 2)
- voidApproval(returnId, changedItems, actor, why): the findings name its actor and why, so it takes them (the card's Build line showed two arguments); its state event carries them. Reverse: drop the two arguments and the actor/reason assertions.
- Blank checks run before guards: no guard is asked about a move with a blank who or why (the test that catches a trim-only check, since the database refuses blanks anyway).
- A changed item with a blank id refuses the whole void with a reason (a flag for a person), even beside a fingerprinted change.
- setWaiting and clearWaiting return { ok: true } | { ok: false; reason }.
- A database failure inside move or voidApproval may return a refusal or throw; either way nothing is kept.
## Ambers (round 1, kept)
- Balance-due day counts months as the Interpretation Act s. 28 (30 Jun -> 30 Aug); filing keeps CRA's month-end rule.
- API: createLifecycle({ db, clock, guards?, approvals? }); guards keyed by MOVES[i].guard, a missing guard refuses "not built yet"; dueDates(yearEnd, { ccpcConditionsMet }) -> ISO text.
- FLOW-4 shape: { cells: {cellId, value}[], facts|entries|judgmentInputs: {id, version}[] }; T06 supplies it through ApprovalFingerprintSource.
- voidApproval writes one state event to trace and one returns.events row (record_table 'approvals').
- Waiting flag lives in returns.events; hold idle counts from the last take; only the holder releases.
## Permission gaps
None met.
## Model
claude-opus-5-5 (spec-writer).
