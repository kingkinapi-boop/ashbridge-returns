# FX18 Opus read and security review (3 Oct 2026)

Branch FX18chk = origin/claude/FX18 (7528476), diff from merge-base 236f8684, src and data. Card plan/cards/FX18.md; clauses ARC-22, SEC-11, AI-9.

## Verdict: FAIL (2 medium)

Every card item (a to c, L1 to L5, N1 to N6, OUTBOX_MAX_BYTES to data) is present and tested, and the security points hold, except as below.

### FAILs (medium)
1. Spec (c) is not met as written. src/modules/ai/runner/engines.ts:188 `Stryker disable next-line BlockStatement` covers the whole one-line `try { return fn() } catch { return undefined }`, so the try block is disabled as well as the catch. Its stated reason ("an emptied try block returns the same undefined") is wrong: an emptied try makes `attempt` always return undefined, which makes every lstat, realpath and opendir fail, so the tests would kill it. The disable hides a mutant that is not equivalent. The same kind of over-broad disable appears at engines.ts:241: `ConditionalExpression` also disables the `if (true)` mutant, and the inside-repo tests would kill that one. It also appears at schemas.ts:34-53: a range disable of StringLiteral and ObjectLiteral that the card did not ask for. Its claim that a failed import "scores as a survivor" is unproven. Fix: put the try and the catch on separate lines and disable only the catch. Disable only `if (false)` at :241. Drop or justify the schemas.ts range by a real Stryker run.
2. Scope gate fails: `node tools/scope.mjs FX18` reports src/core/safe-read.test.ts and src/modules/ai/runner/exchange-limits.build.test.ts outside the card's Paths. These are build-owned unit tests, which testing.md allows, but the train refuses them. Fix: add both to Paths (Lead).

### Lows
- runner.ts:153-158 lastErrorLine removes C0 and C1 characters but keeps U+2028, U+2029 and bidi overrides (U+202A to U+202E, U+2066 to U+2069). `slice(0, maxChars)` counts UTF-16 units, so it can split a surrogate pair at the cap.
- engines.ts:262 projectRun repeats the redaction check, but not the runner's `isTest` gate (SEC-11 made-up-only). aiEngines is still exported from engines.ts, so a direct caller can send a job that is not a test.
- engines.ts:162-172 `seen` is never cleared and its keys include size and mtime. One stranger rewritten 200 times fills it. After that, a `<waiting id>.<ext>` file (spec b) is never logged by name again for the runner's life.
- engines.ts:296-306 a staging file is left behind when the rechecks or the rename refuse.
- engines.ts:366 mkdir with mode 0700 does not tighten folders that already exist.
- src/contracts/ai.ts:34-40 versionStampSchema keeps free text for the four N5 fields. This is enforced only indirectly, through the runner's stamp-equality check. The file is outside Paths.
- engines.ts:181 recording names are logged unquoted (pre-existing; the folder is in the repo).

### Checked and fine
- (a) no raw fs error escapes projectRun.
- (b) The `.txt`, `.JSON`, `.json5`, `.tmp` and `.json.bak` cases are tested.
- L1, L2 and L3 hold.
- L4: opendir is batched with a cursor, and the cap comes from data.
- L5 is applied in the handler.
- N1: index.ts drops the engines export; the engine checks the redaction stamp and checkedOutput, and refusals are counted once.
- N2 is pinned with z.literal and a message.
- N3 uses `!(now<deadline)`.
- N4 uses the field form.
- N5 uses IdentifierSchema in AiJobSchema and InboxFileSchema.
- N6: insideRepo works by real path, ancestors included; files are 0600 and folders 0700.
- The field lists match their schemas: isRedacted against RedactionStampSchema; ExchangeLimitsSchema against the JSON file (four keys); the expected stamp is typed as VersionStamp.

### KNOWN lists
tools/test/fs-rules.test.mjs does not exist on this branch or on origin/main (SC12 has not landed). No tools/test or data file names FX18 as an owner, so no FX18 KNOWN entries exist to remove.
