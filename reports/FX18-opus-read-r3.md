# FX18 Opus read, round 3 (4 Oct 2026)

Branch claude/FX18 at d9c2712a; diff origin/main...HEAD, src and data. Card plan/cards/FX18.md (directive A546; B9 to B12, S10 to S12). Read only; the only file written is this report.

## Verdict: FAIL (one item, rooted in the card; a one-token fix)

B9, B11 and B12 are built as the card asks. B10 is built exactly as the card's text says, but the card's own S12 rule ("one line holding no Cc, Cf, Zl or Zp character") does not hold for every name. If the Lead rules item 1 a low (B10 met to the letter), everything else PASSES.

### Failure
1. src/modules/ai/runner/engines.ts:213-214 quotedName escapes only `\p{Cf}\p{Zl}\p{Zp}`. It assumes JSON.stringify escapes every Cc, but JSON.stringify escapes only U+0000 to U+001F. U+007F and the C1 controls U+0080 to U+009F stay raw in the logged outbox line. Run with node: quotedName('a\u0085b') and quotedName('a\u009bb') each hold a raw Cc character. U+0085 (NEL) is a line break to some log readers. U+009B (the 8-bit CSI) starts a terminal escape. This is the same outside writer and the same line as Low 1, which the card said to fix now. S12's test plants no C1 character, so it passes.
   Fix: add `\p{Cc}` to the class at :214. C0 is already escaped by JSON.stringify, so only U+007F to U+009F change, and they come out as `\u007f` and the like. Spec: add `\u0085` and `\u009b` to S12's name, or to the build test's quotedName cases (exchange-limits.build.test.ts:376). Rule for testing.md: "a cleaner is tested with one code point from each class it claims (C0, DEL, C1, Cf, Zl, Zp)".

### Checks asked for
- (1) B9 holds. Per-wait `WaitState { seen, waitedName }` is made in waitForResult (:375), never in ctx. lookAtStranger (:220-231) returns on `name === waitedName`. It sets waitedName only while that is undefined and the name starts with `<id>.`, sinks that line once, and does not store it. Every other name, including later `<id>.*` names, goes through logOnce, which no longer has an exempt parameter. The Set holds at most seenMax + 1 keys (seenMax names plus the one "more" key, :73-83). The "more" line appears once per wait. The R104 marker (:374) has the exact prefix, and the Set is on the next line. `<id>.json` is still skipped by isWaitedJsonFile (:190). The job-id grammar has no dot (schemas.ts:110), so the prefix cannot match another job's file. S4, S5, S5b, S10 and S11 cover it.
- (2) quotedName writes Cf, Zl and Zp as `\u` plus hex (escaped, not dropped). It is used for both logged outbox lines (:227, :230). Gap: Cc, see item 1. Low: an astral Cf such as U+E0001 or U+1D173 comes out as `1`. That is five hex digits, which is not a valid JSON `\u` escape. Two names still stay apart (a raw U+E000 is printed as itself), so this is a low only.
- (3) B11 comments are accurate. engines.ts:43 ("Flagged recordings already seen"; ctx.seen is used only by readRecording, :103). schemas.ts:45 ("recordings per runner, and outbox names per wait"). schemas.ts:49 ("code points"; lastErrorLine cuts with Array.from). The logOnce doc (:60-63) and the lookAtStranger doc (:216-219) match the code.
- (4) The disables at schemas.ts:35, :41 and :53 are next-line disables. Each reason quotes "Survived" for mutants 647 to 650, 651 and 652 to 654, as reports/FX18-build.md states for the cloud run with the disables removed. None says "fails the import". Low: each reason also says "outside any test's coverage", which is Stryker's NoCoverage status, not Survived. Better wording: "static (evaluated at import), scored Survived". Also, no Stryker output is committed, so I can check the status only against the build report, not against the run itself.
- (5) Nothing was built beyond the card. The round 3 commits touch only engines.ts, schemas.ts, the build test and the build report. Spec files are unchanged since spec commit 68ce1093: `git diff 68ce1093 HEAD` on both acceptance files shows only the spec's own addition. No clause contradicted beyond item 1. Hand lists: ExchangeLimitsSchema matches data/ai/exchange-limits.json (four keys), and isRedacted matches RedactionStampSchema. No redaction or permission check is weakened: the SEC-11 gate is in the engine (:304), and so is the AI-9 check (:303). No client sentence. No raw bidi or zero-width character in the added source. No SIN-like number, key or paid service.
- Tests run here: `npx vitest run --project unit src/modules/ai/runner src/core/safe-read.test.ts`, 7 files, 378 passed.

## Earlier findings
reports/FX18-opus-read.md (round 1):
- FAIL 1 is fixed. attempt() puts try and catch on separate lines with a disable on the catch only (:196-204). relIsInside is extracted, and the :241 disable is gone. The schemas.ts range disable is gone; three next-line disables remain.
- FAIL 2 is fixed. Both test files are in Paths (A492, A530). The scope tool clean is per the build report; I did not re-run it.
- Lows: lastErrorLine (Cc, Cf, Zl, Zp; code points) is fixed. The engine's isTest gate is fixed. Per-wait, name-only stranger keys are fixed. Staging unlink in finally is fixed. chmod 0700 on existing folders is fixed. versionStampSchema went to FX3 and the unquoted recording name went to SC12, both out of scope.

reports/FX18-check.md (round 2):
- Failure 1 (the startsWith exemption) is fixed (B9).
- Low 1 (hidden characters in the logged name) is fixed for Cf, Zl and Zp. C1 and DEL are still open (item 1).
- Low 2 (chmodSync follows a link) went to SC12, as the card says.
- Low 3 (disable reasons) is fixed. Low 4 (stale comment) is fixed.

## For the Lead (not failures)
- The card's "Spec commit" line still names 6e1bff63. Round 3's spec is 68ce1093.
- The testing.md rule ("an exemption from a cap is tested with two exempt names and a flood of them") is not written yet. It is outside the builder's Paths.
