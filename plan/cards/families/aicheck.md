# Family: AI tax checklist topic ({topic})

Cards I10 to I20. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 05 (AI-1 to AI-11), `src/modules/ai/checklist/_core/` (I01) and `src/modules/ai/grounding/` (I00).

## Goal
The owner-manager issue "{topic}" is looked for on every return, and every finding points at facts that code can verify.

## Build
- `src/modules/ai/checklist/{topic}/`: the prompt (versioned), the output schema from `src/contracts/ai.ts`, and the code that turns grounded findings into flags (CK-42).
- The facts the prompt receives are chosen by code; sensitive values are masked first (AI-9).
- Recorded answers for tests; `claude -p` only for measuring the prompt on the test world (A04, I40).

## Acceptance checks
1. On every test-world kind that plants a "{topic}" issue, the recorded answer produces a grounded finding and a flag.
2. A finding with a failed citation is dropped and counted (AI-4).
3. On kinds without the issue, no flag.
4. The prompt version and model are stamped on every output (AI-10).
5. The evaluation harness (I40) shows this topic's score, and it is recorded in `reports/`.

## Not in this card
Other topics. Clearing anything: AI never clears (AI-7).
