# E03 build round 2 (cloud-c1cb2b, 2 Oct)

Branch claude/E03, Node 24. Files: data/facts/catalogue.json, src/contracts/facts.ts, src/contracts/facts.test.ts.
- Fix 8 done: `String(...)` on the three template values; `// @mutate` on facts.ts; every cra_form cite now "Schedule N line N" or "T2 line NNN" (T4/T5 boxes, GST34 lines and NOA text cites dropped, an answer_key cite kept or added); new key onboarding.engagement.tax_year (answer-key field `engagements`); answer_key cites added for corporation.* and ohip_remittance_advice.
- facts.ts rewritten where mutants were equivalent (version hash by sorted JSON, no redundant typeof checks, `ctx.addIssue(message)`). 23 own unit tests in facts.test.ts quote every refusal word for word.
- Numbers: typecheck, lint, deps:check clean; scope OK (7 files); mutation facts.ts 100.00 (260 killed, 0 survived, 0 no cov; full run, incremental file cleared); full suite 1077 pass, 10 fail.
- **10 acceptance tests still fail and I cannot fix them (spec is stale, new spec round needed):**
  1. "lists read from the repo" expects `sampleClientDirs()` length 10; there are now 15 sample clients (W15 landed 13 to 15).
  2. Nine "onboarding field X is cited" tests (BQ2.earn, FL:96, FL:97, FL:104, YE1.pcost, YE1.puse, YE1.vehicle, YE1.vkm, YE1.vbkm), new since clients 12 to 15: they are question ids, not onboarding fields. They need a ref equal to the id, but the answer_key cite test needs the ref's first segment to be a top-level field of onboarding.json or answer-key.json, so the two tests cannot both pass. The spec should read only top-level onboarding fields (or accept question ids as their own cite kind).
  Mutation was run with those tests skipped in a throwaway edit, restored before commit (checker step 5 diff is empty).
- Ambers: engagement tax_year as a count with rowKey `engagement`; dropping cra_form cites that fit neither pattern rather than inventing line numbers (the T4/T5/GST34/NOA sources keep their answer_key cite; M00 defect already covers line-list checks).
- Permission gaps: none. Model: Sonnet 5.5.
