# S00 build, round 2 (cloud-3d81d3)
Branch claude/S00. Started from the round-1 build; two real gaps and mutation work.
Files: core/sim.ts, core/release-list.ts, core/gifi-descriptions.json (Taxprep's own GIFI texts from the day 2 export CSVs), own tests core/sim.test.ts and core/release-list.test.ts.
Acceptance: 71 of 71 in sim.acceptance.test.ts pass, spec/harness/goldens untouched (diff vs 5f74392 empty). Full suite 790 unit + 2 db pass.
typecheck, lint, deps:check clean; scope OK; mutate:changed S00 100 on sim.ts and release-list.ts (index.ts has no mutants).
Mutation was run with a throwaway copy of mutate-changed that skips __fixtures__ (DG round 2 is not on main yet); the real command refuses harness.ts for lacking @mutate until DG lands.
Ambers: a yes or no clear on a held cell resets it to N with a "replaced" line, on a never-set cell it is silent. Eight Stryker disables, each with its reason in the source (equivalent mutants: '' versus a missing key, never-compared status labels, unreachable throw, writer purpose, search cursor).
Permission gaps: none. Model: Sonnet 5.5. Needs Node 24 via /opt/nvm (nvm install 24; system node is 22).
