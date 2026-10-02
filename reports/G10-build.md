# G10 build (cloud-47706f)
Branch claude/G10. Files: data/question-bank/revenue.json (Q-REV-001 to 003), src/modules/gaps/bank/revenue.test.ts.
Acceptance: 9 of 9 revenue acceptance tests pass; bank folder 81 tests pass. Typecheck, lint, deps:check clean; scope.mjs G10 OK.
Amber: sales channels answer is a `choice` with option ids (in_person, online_store, marketplace, wholesale, services_only, other), since the fact is text and no free-text shape exists. Reverse: edit the option list.
Amber: foreign currency item is a CONFIRM with no slots (yes_no answer).
Permission gaps: none. Model: Sonnet 5.5.
