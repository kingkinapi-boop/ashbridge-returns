# F05M spec (cloud-b1776c): released, no spec needed
The card says "Spec commit: none (no new acceptance tests; F05's acceptance tests stand)". Its checks 1 to 5 are tool runs (marker, mutate:changed, diff against main, typecheck, lint), and survivor tests are the builder's own unit tests in checks.test.ts. A spec file would fall outside the card's paths. Lead: mark F05M spec done (`update F05M spec reported --worker lead`) so the build is offered.
Permission gaps: none. Model: sonnet.
