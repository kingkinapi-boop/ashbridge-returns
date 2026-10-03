# FX15 spec: released (Paths gap, A414)
Worker cloud-feb1e6. No tests written. complete and fail are declared in src/contracts/jobs.ts and called by src/modules/jobs/runner.ts (holds workerId, never passes it); FX15 Paths list only queue.ts and the new test.
Proposed card fix (Lead): add src/contracts/jobs.ts and src/modules/jobs/runner.ts to Paths; Build: complete(id, workerId, result, versions) and fail(id, workerId, error, options?), runner passes its workerId; the spec rewrites the 8 old-signature calls in jobs.acceptance.db.test.ts (lines 172, 173, 285, 286, 512, 525, 611, 615) under 6b.
To settle: an expired lease with no re-claim refuses the old holder too (check lease_holder = workerId and lease_until > now); a pure holdsLease(job, workerId, now) export in queue.ts for the unit twin (4b) and the property. Known limit: same worker id re-claiming its own expired job is indistinguishable without a lease token.
Permission gaps: none. Model: Sonnet 5.5 (Opus subagent read only).
