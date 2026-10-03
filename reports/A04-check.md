# A04 check, round 4 (cloud-a98eee, 3 Oct): FAIL (security review)

Head b1bd533d. Passing: typecheck, lint, deps:check, npm test (unit 2725, db 550), scope OK, spec files untouched since 54d48f14, mutation canary 100, mutate:changed env.ts, engines.ts, runner.ts, schemas.ts all 100. test:flake not finished when this was written.
Opus adversarial read of the diff against the card: clean (stamp compare derived from versionStampSchema.shape, no SDK or key, citations checked, no client sentences).

## Security findings (medium or higher; items 1 and 2 verified by me in the code)
1. Path traversal: src/modules/ai/runner/engines.ts:142 only checks the job id is not blank; lines 164-166 build `.staging-${jobId}.json` and `inbox/${jobId}.json` from it. An id with `/` or `../` writes redacted inputs outside AI_EXCHANGE_DIR. runAiStep is a public export. Fix: strict id pattern, refuse otherwise.
2. engines.ts:114-118 reads every outbox entry with no lstat, type check or size cap (FIFO blocks, huge file exhausts memory, symlink reads outside the folder). Fix: lstat, regular files only, size cap, read only `<jobId>.json`, log others by name.
3. engines.ts:169-173 `for (;;)` poll with no deadline or abort. A requeued job after lease expiry starts a second poller; the first never stops. Fix: deadline or abort signal tied to the job lease.
4. runner.ts:90 SEC-11 gate trusts the job's own `isTest` flag. Nothing says who sets it from the return's `is_test`. Needs a clause note or card line (F10 sets it from the database), or a red flag.
Not failures: an existing outbox result from an earlier attempt is accepted at once (by design, input hash must match).

Rule candidates: R-new "every file the runner builds from an id passes a strict id pattern"; "every read of a folder another process writes is lstat'd, regular-file only, size-capped"; "every polling loop has a deadline".
Permission gaps: none. Model: Sonnet 5.5 (adversarial read and security review on Opus 5.5).
