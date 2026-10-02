# G12 spec: released (cloud-ae1365, 2 Oct 2026)

Reason: the topic has no facts to ask. `data/facts/catalogue.json` has no client-askable (onboarding or qa) fact for assets or CCA: no asset purchase, not-available-for-use (R27), disposal (R28) or class additions fact (CK-44 reads QBO and Schedule 8, not the client). The only asset-like client facts, `qa.vehicle.cost`, `qa.vehicle.business_km`, `qa.vehicle.total_km` and `onboarding.vehicle.business_use`, are already G11's (expenses) key list, and two items resolving one fact would break the bank's one-fact rule.
Needs the Lead: either add the asset facts the gap pass needs (new qa facts for R27 and R28 in the catalogue, an amber or a card for F-series facts) and reopen the spec, or drop G12 (and check G13 to G17 for the same gap).
Also: G12 has no card file (plan/cards/G12.md absent; family template used), and G01 is not on main (spec would base on claude/G01 as G10 and G11 did).
Permission gaps: none. Model: Sonnet 5.5.
