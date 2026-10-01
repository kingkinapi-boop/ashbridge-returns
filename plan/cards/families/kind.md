# Family: test world kind ({kind})

Cards W01 to W13. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 00 (the kinds table), the clauses on the card, and `testworld/model/` (W00).

## Goal
One made-up corporation, {kind}, with everything a real file would hold and the known right answers, so every later card can prove itself on it.

## Build
- `testworld/kinds/{kind}/kind.ts`, starting from the sample client the blueprint 00 kinds table names (`reference/sample-clients/`, ARC-8; K01, K05, K06 and K13 need new ones there first): the corporation (name ending "(Test)", made-up business number, year end), shareholders, the facts the client app would supply (onboarding answers), the client's books as the QBO stand-in serves them (trial balance, transactions, adjusting entries with reasons, the .GFI mapping), the transactions the documents will show, CRA data, last year's figures where the kind has them.
- The expected results: every GIFI and schedule figure, every fact with its source kind and origin, the dot of each figure, and every flag and exception the checks must raise (with the clause that raises it).
- The planted faults this kind exists to test (the clauses on the card), each with the exact flag or exception it must produce, listed in `testworld/kinds/{kind}/faults.ts`, which the W00 fault catalogue reads.
- K12 also carries planted prompt injections: document text telling an AI to ignore its rules or report a false value. The expected result is no effect (AI-8).
- A list of the documents this kind has (by document family), so renderers produce them.
- Everything deterministic: fixed seed, fixed dates.

## Acceptance checks
1. The kind loads through the W00 model with no validation errors.
2. The books balance and retained earnings roll (the model's own checks).
3. Every clause on the card has at least one planted fault or expected result that names it.
4. No real person, business or number (names end in "(Test)").

## Not in this card
Rendering documents (W21 to W38). Any product code.
