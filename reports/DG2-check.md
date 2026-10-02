# DG2 check (cloud-7554c7, Sonnet)
PASS. typecheck, lint, deps:check clean; npm test 916 unit + 2 db; test:flake 5 of 5; mutate:canary 100; scope OK (7 files in paths); done-gate.test.mjs diff vs spec commit comes only from the merged DG round 3 spec (not the builder). F05M's marked file src/contracts/checks.ts scores 100 (364 mutants, 0 survived) under the widened config. Diff read: target pattern now src|testworld minus tests, fixtures, goldens; zero marked target in a core card's Paths fails; mutate config runs testworld tests.
Note (builder's amber, accepted): a core card whose diff holds only fixtures/goldens exits 0 (`specDataOnly`).
Model: Sonnet 5.5. Permission gaps: none.
