# Family: AI tax checklist topic ({topic})

Phase (the card's own, in plan/slices.json). Where: local or cloud.

Cards I10 to I19 (I20 parked: next year's instalments are code, CK-46). Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 05 (AI-1 to AI-11), `src/modules/ai/checklist/_core/` (I01) and `src/modules/ai/grounding/` (I00).

## Goal
The owner-manager issue "{topic}" is looked for on every return, and every finding points at facts that code can verify.

## Build
- `src/modules/ai/checklist/{topic}/`: the prompt (versioned), the output schema from `src/contracts/ai.ts`, and the code that turns grounded findings into flags (CK-42).
- The facts the prompt receives are chosen by code; sensitive values are masked first (AI-9).
- Recorded answers for tests; the Claude project job runner (A04, ARC-22) only for measuring the prompt on the test world (I40). No paid API.

## Acceptance checks
1. On every test-world kind that plants a "{topic}" issue, the recorded answer produces a grounded finding and a flag.
2. A finding with a failed citation is dropped and counted (AI-4).
3. On kinds without the issue, no flag.
4. The prompt version and model are stamped on every output (AI-10).
5. The evaluation harness (I40) shows this topic's score, and it is recorded in `reports/`.

## Not in this card
Other topics. Clearing anything: AI never clears (AI-7).
