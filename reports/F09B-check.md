# F09B check (round 2): PASS

Worker cloud-63f8ba. typecheck, lint, deps:check clean; npm test 1155 unit + 2 db pass; test:flake 5 of 5; spec file amount-grammar.acceptance.test.ts unchanged since spec commit c4d24b9; mutate:canary 100; mutate:changed F09B 100 on amount-grammar.ts and reading.ts (7 timeouts, 0 survivors); Opus adversarial read PASS (backwards, overlapping, touching and epsilon cases hold; mixed grouping refused; 50000-word join 57 ms).

Notes (not failures):
- Scope: plan/cards/F09A.md shows outside the card's paths only because the branch carries the Lead's edit from main (63a252c); the builder did not touch it.
- Concern for SC/Lead: amountGroups has no page on Spot, so it joins words across pages (page 1 "1" then page 2 "234.56" gives 123456). valueInBox is safe (filters by page first); other callers are not. Rule candidate: any geometry predicate over words must see only one page.
- Concern: WordSchema accepts other invisible words (U+034F, U+3164, U+2800, Cc controls U+0000 and U+001F); outside the card's Cf/whitespace wording.
- valueInBox plain-text search (reading.ts:190-196) is cubic in word count; outside this card.

Permission gaps: none. Model: Sonnet 5.5 checker; Opus 5.5 adversarial read.
