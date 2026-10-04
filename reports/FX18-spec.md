# FX18 spec report (rounds 1 and 2)

Written 4 Oct 2026 00:52Z by the spec-writer (Opus). Round 1's report never landed (A537), so this one covers both rounds briefly.

## Round 1 (eb8d158c, validated on main 5a21f65a)

src/modules/ai/runner/exchange-errors.acceptance.test.ts: (a) three file-system failures (mkdir, staging write or rename, outbox listing) reach runAiStep and the ai:<step> handler as fixed sentences, never the path; (b) `<waiting id>.<other extension>` logged once, quoted; (c) the BlockStatement disable covers only the equivalent catch; L1 to L5 (O_NOFOLLOW, many-links, folders re-checked, caps in data/ai/exchange-limits.json with batched listing, last_error one line and capped); N1 to N6 and OUTBOX_MAX_BYTES in data. src/modules/ai/runner/exchange-safe-read.acceptance.test.ts for safe-read through the engine.

## Round 2, A534 (31f5579e)

S1 attempt() behaviour plus the one-line disable shape rule (engines.ts and schemas.ts); S2 no range disable in schemas.ts; S3 relIsInside(rel, p = path) pure helper and no insideRepo disable; S4 a second wait logs `<id>.txt` again; S5 a rewritten stranger never silences `<id>.txt`; S6 L5 drops Cc, Cf, Zl, Zp and cuts by code points with no lone surrogate; S7 no staging file left after a refusal; S8 an existing 0755 inbox and outbox end 0700 (posix); S9 the project engine refuses `isTest: false` with the runner's SEC-11 sentence.

## Round 2 patch, A537 gaps 1 to 6 (this commit)

1. S2's no-range rule runs on engines.ts as well as schemas.ts (one test per file), and a scanner test plants attempt() wrapped in `// Stryker disable BlockStatement: ...` ... `// Stryker restore BlockStatement` and expects lines 1 and 9 flagged.
2. S5b: seenMax + 3 strangers fill the per-wait cap (the "more than" line shows once), then `<id>.txt` is written: logged once by name, no content, and the wait still takes its result. Fails on the build tip (the waited-id file is counted against the cap).
3. S6's hidden characters are escapes (` `, ` `, `‮`, `⁦`, `​`, `﻿`); the file holds no raw bidi or format character. The header's L5 line now says Cc, Cf, Zl, Zp and a cap in code points.
4. runner.acceptance.test.ts:1544 (A04 round 5, fix 5) restated to the B4 rule: "a stranger file is logged once per wait by name only, whatever its size or mtime (rewrites add no line)"; same canary and path checks. Fails on the build tip at the new-mtime rewrite (the size:mtime key logs again).
5. `.JSON` in (b) is skipped by name where a probe shows the temp folder folds case; a probe test pins "no fold" on Linux.
6. (a) plants table gains two rows: chmodSync of the inbox, or of the outbox, throws with the path in its message: refused with INBOX_NOT_REAL or OUTBOX_NOT_REAL, the handler error is exactly the sentence, no path (both runAiStep and handler tests, 4 tests). Beside S7: the rename fails and the staging cleanup (unlinkSync or rmSync) throws with the path: the staging file is tried and INBOX_WRITE_FAILED stands, no path.

Counts: exchange-errors.acceptance.test.ts 96 tests (9 added this patch), runner.acceptance.test.ts one test restated. On the build tip 20 tests fail by name, each for its reason (feature missing); everything else in unit (3548) and db (740) passes.

## Validation

Validated on main 48fbf42c: typecheck, lint, unit and db green except the 20 FX18 acceptance failures. Stub sweep (a throwaway B1 to B8 stub, never committed, removed): unit 3567 of 3568 pass, db 740 pass; the one failure is exchange-limits.build.test.ts:239 ("past seenMax each kind of flagged file says once ... the two kinds apart"), which is the builder's under B4 (A537). No test retired; runner.acceptance.test.ts:1544 is restated (A537 gap 4, superseded by A534 B4).

## Notes for the build

- engines.ts exports `attempt` and `relIsInside(rel, p = path)` (read through `import * as engines`).
- B7's chmod is read through `fs.chmodSync` (the plant spies on it); B6's cleanup through `fs.unlinkSync` or `fs.rmSync`.
- The G1 recording test (runner.acceptance ~:1458, "rewritten with other bytes: logged again") still holds while recordings keep their runner-wide set keyed by line plus content.
