# Family: question bank topic ({topic})

Cards G10 to G17. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 05 (AI-12), 09 (ARC-2), `src/modules/gaps/bank/` (G01), `reference/onboarding-contract.md` (the Q&A spec's ASK, CONFIRM, DECIDE).

## Goal
The approved questions for "{topic}" exist as ids, slots and answer shapes, each tied to the fact it resolves, so the gap pass can pick them and the client app can word them.

## Build
- `data/question-bank/{topic}.json`: each item has an id, a type (ASK, CONFIRM or DECIDE), the fact key it resolves, its slots (for example an amount, a date, a document name) and its answer shape.
- No wording at all: client wording lives in the client app (RULE-19, END-7). A short internal label per item is allowed for staff screens.
- A test in `src/modules/gaps/bank/{topic}.test.ts`.

## Acceptance checks
1. Every item validates against `data/question-bank/_schema.json`.
2. Every fact key exists in the fact catalogue, and every test-world gap on this topic has an item that resolves it.
3. No item holds a sentence meant for a client (a check for sentence-like text).

## Not in this card
The client app's screens or wording.
