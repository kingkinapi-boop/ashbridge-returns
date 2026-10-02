# W02 spec (cloud-f6e3cf, Sonnet; card not tagged core)

1. 21 tests in testworld/kinds/K02/kind.acceptance.test.ts (ARC-8, TB-8, TB-5, TB-3, END-9, ARC-16, SEC-11); all fail only because testworld/kinds/K02/kind.ts and faults.ts do not exist. Checked against a scratch implementation (deleted): all 21 pass.
2. Validated on main 405683b714c2b297735ff060b7577f1880a21a8e (merged into claude/W00 base: W00 build is not on main yet, so the branch is W00's head f905b7e plus main). typecheck, lint green; npm test: only the 21 K02 tests fail. Step 6b: none retired.
3. Public API fixed in the test header: kind.ts exports kind (client = C08 model, priorReturn, conversion rows in signed cents, expected figures and flags, documents); faults.ts exports faults (FaultEntry, kind K02, ids K02-F01 to F05).
4. Amber: (a) tie rule: tied to prior T2 PDF or notice means grey (TB-8 wins over EV-11's amber for client-filed); (b) five planted faults: 1484 transposition, 2680 untied, 3600 RE mismatch (TB-5), 2707 mapped differently (TB-3), not prepared by us (info); (c) registering K02 faults in W00's faults() (testworld/model/faults.ts, outside card paths) is left to the Lead; no test requires it; (d) W02 build must base on merged W00.

## Permission gaps
None.

## Model
Sonnet 5.5.
