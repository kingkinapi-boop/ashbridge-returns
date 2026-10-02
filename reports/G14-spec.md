# G14 spec (cloud-85bb68, 2 Oct 2026)
Branch claude/G14 from main ea8283f (G01 and E03A landed). Validated on main ea8283f: with a throwaway stub payroll-bonuses.json (not committed) all 13 tests pass and the bank folder's 116 pass; typecheck and lint clean; without it only the 8 file-dependent tests fail ("file missing"). 6b sweep: no other test fails; none retired.
- 13 tests in src/modules/gaps/bank/payroll-bonuses.acceptance.test.ts (mirrors G11). Clauses ARC-2, AI-12, RULE-19, END-7. Not core (Sonnet).
- Amber: the topic's client-askable facts are fixed in the test as 2 keys (onboarding.payroll.has_payroll, onboarding.owner_bonus.paid); wage, T4 and bonus amounts come from slips and the books, so a test refuses any money slot or money answer in this file; has_staff left to its own topic. File data/question-bank/payroll-bonuses.json, ids Q-PAY-<nnn>, both facts yes_no. Reverse: edit the test.
- Builder: create data/question-bank/payroll-bonuses.json and src/modules/gaps/bank/payroll-bonuses.test.ts.
- Permission gaps: none. Model: Sonnet 5.5.
