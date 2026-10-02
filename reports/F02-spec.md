# F02 spec (cloud-d42547, Opus spec-writer, 2 Oct)
Spec commit 40bebf3 on claude/F02, based on origin/claude/F01 124b473 (F01 not yet on main) merged with origin/main; validated on main bb88e2e.
Tests: 92 in src/modules/lifecycle/: lifecycle.acceptance.test.ts (unit, 25) and lifecycle.acceptance.db.test.ts (db, 67); fixture __fixtures__/blueprint-moves.ts. Clauses: FLOW-1, FLOW-2, FLOW-3, FLOW-4, FLOW-5, FLOW-7, FLOW-10, FLOW-12 (CRA T4012 cited); 3 seeded fast-check properties on due dates.
Red for the right reason: both files fail at import (./index and ../../contracts/lifecycle missing); typecheck and lint errors are only those (TS2307 and the unresolved-type knock-ons). Unit 960/960 and db 168/168 otherwise green.
Step 6b: a throwaway stub passed all 92 and the whole suite (985 unit, 235 db), lint clean on the tests with types resolved; planted faults caught (month-end balance rule, kind-blind fingerprint match). Retired: none. Stub worktree removed.
## Ambers
- Balance-due day counts months as the Interpretation Act s. 28 (30 Jun -> 30 Aug; 28 Feb -> 28 Apr), never later than a month-end reading, so it cannot make a payment late; filing keeps CRA's month-end rule. Reverse: four rows and balanceOracle in the unit test. Worth a CPA glance (Zo) if the earlier date bothers anyone.
- API: createLifecycle({ db, clock, guards?, approvals? }) with move/voidApproval/setWaiting/clearWaiting/waitingOnClient/takeHold/releaseHold/holder; results are { ok } unions; guards keyed by MOVES[i].guard, a missing guard refuses "not built yet"; dueDates(yearEnd 'YYYY-MM-DD', { ccpcConditionsMet }) -> ISO text.
- FLOW-4 shape set here (T06 not written): { cells: {cellId, value}[], facts|entries|judgmentInputs: {id, version}[] }; T06 supplies it through ApprovalFingerprintSource.current(returnId); matching is by kind and id.
- voidApproval works from approved and ready_to_file (tested), writes one approved/ready_to_file -> trace state event (guards bypassed; not a table move) and one returns.events row (record_table 'approvals', record_id the approval id), since F02 has no schema path.
- Waiting flag lives in returns.events (one row per set or clear, no state event); hold idle counts from the last take, the holder retaking renews; only the holder releases.
## Permission gaps
- `git worktree add ... && ... && tail` in one compound call was denied; plain `git worktree add` worked. One `sed ...; ls ...; node -v` call denied; used Read instead.
## Model
claude-opus-5-5 (spec-writer).
