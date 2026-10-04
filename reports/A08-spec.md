# A08 spec

# Round 2 (A529: S0 to S5, and the spec-owned tests for B1 to B6)

Spec-writer (Opus, cloud), 3 to 4 Oct 2026. Commit `spec(A08): acceptance tests round 2` on claude/A08 (the hash is on the card's Spec commit line). Validated on main 0d631db4 (merged into claude/A08; main moved from 860f086e with plan/ files only, so the suites below ran on the same code).

## Tests: 360 (357 unit, 3 db); was 218

- `src/modules/ai/project/project.acceptance.test.ts`: 124 (was 123): one rule test for the `insideReal` helper.
- `src/modules/ai/project/exchange-safety.acceptance.test.ts`: 93 (was 92): the libuv Windows names test.
- `src/modules/ai/project/launcher-round2.acceptance.test.ts`: 94 (new): S0, S1, S2, S3, S5, B1, B2, B3, B5, B6.
- `src/modules/ai/project/scan-edges.acceptance.test.ts`: 46 (new): S4 and B3 (the order of the kinds).
- `src/pipeline/ai-project.acceptance.db.test.ts`: 3 (unchanged).

Clauses: ARC-6, ARC-20, ARC-22, AI-1, AI-8, AI-9, AI-10, END-8, R96, SEC-5, SEC-10, SEC-11 (each test name starts with its clause and A529).

## Fails first: 16, each for its B item (the build tip 148b9a2b, the build 9a152e7a merged with main)

- B1: `a folder named ..x inside the repo is inside the repo` (the `startsWith('..')` defect).
- B2: `making the lock failing with EACCES / EPERM / EROFS / ENOSPC / EIO / undefined` (6: the build throws).
- B3: `a reported model id is shown whole, however long` (`.slice(0, 100)`); `a vendor setting set to an empty value refuses the run too` (`value !== ''`); `several kinds are reported in the order the scan finds them` (`.sort()`).
- S2 option: `output exactly at the cap (claudeOutputMaxBytes)`, `with no claudeOutputMaxBytes the cap is CLAUDE_OUTPUT_MAX_BYTES`, `a call past the cap that then hangs` (3: no option, and the reason does not name "<n> bytes").
- B5: `readSettings returns AI_PROJECT_CLAUDE_BIN`, `every setting name the launcher reads is one readSettings returns` (2). B6: `RUNNING.md names the Windows program choice` (no cli.js).
Every other test passes on the build tip: unit 141 files, 3610 passed and the 16 above; db 15 files, 701 passed (1 expected fail, 5 skipped); typecheck and lint clean; the tools/test rule files green over the new files.

## S0: the build's survivors, each mapped

`npm run mutate:changed -- A08 -- --force` on 148b9a2b (Linux cloud box, the round 1 tests: 215): call.ts 59.02 (25 survivors), index.ts 73.59 (122), scan.ts 75.15 (42); 692 mutants. Line numbers are the build's.

| Survivors (file:lines) | What they are | Item that kills them |
|---|---|---|
| call.ts:23 (2) | isScript's regex and arrow | S5 `.js` and `.MJS` rows; S0 `claude.mjs.sh` row (the `$` anchor) |
| call.ts:29, 35, 37, 38 (5) | non-script args; the `stopped` guard; `child.kill()`; the SIGKILL timer | S1 claude on PATH; S2 past the cap then hanging; S0 "stopped at once, well before the grace"; S2 ignores SIGTERM |
| call.ts:30 (2) | stdio `[]`; `windowsHide` | S0 1 MB of stderr is answered (stdio); windowsHide: **B4** |
| call.ts:41, 43 to 45, 48, 49, 53, 56, 58 (14) | the seconds in the reason; the spawn error path; the cap count and compare; the stdin error handler; clearTimeout on close; ok on a non-zero exit | S2 "(4 seconds)", ENOENT (and the timer check), at the cap and cap+1, exits before stdin; S0 no timer left after an answered call |
| index.ts:49 to 61 (13) | vendor names, vendor pattern, the child allowlist | S0 every allowlisted setting reaches the child (8); the four `*_API_KEY` names and the `$`: **held** (below) |
| index.ts:74 (2) | isInside | B1 |
| index.ts:81, 82 (3) | realPathOf's walk up | S1 two missing folders; S0 a link into the repo, then two missing folders; one **held** |
| index.ts:103 to 105 (5) | isRealFolder | S1 inbox and outbox symlinks, inbox a file; three **held** |
| index.ts:111 to 115 (6) | loadApproved | S1 approved list missing, not JSON, wrong shape (exact log line); two **held** |
| index.ts:122 (1) | the temp file's `wx` | S3 exchange watch (the temp name, killed in the stub run) |
| index.ts:131 to 138 (7) | promptFor | S3 prompt golden; S0 an input name with odd characters |
| index.ts:141, 145 (2) | the envelope schema | S1 no envelope, is_error; S0 outputTokens not a number |
| index.ts:148 (1) | `shown()`'s slice | B3 |
| index.ts:169 to 185 (19) | checkInbox: not JSON, not one job, stamps, schema, approved triple | S1 raw rows and stamp rows; S0 not a valid job (problems from A04's schema); S0 triple rows (each field, any not every) |
| index.ts:199, 215 to 217 (4) | inputs.json; the argv | S3 job folder row; argv golden |
| index.ts:224 to 228 (5) | the config folder cleared; `problems` default | S1 config folder emptied between jobs; S3 exact refusals |
| index.ts:238 to 248 (5) | the models log line and reasons; the not-JSON answer | S1 model rows; S3 log golden and exact table |
| index.ts:258 (1) | child env `undefined` | S1 TZ undefined; **held** (spawn drops undefined values itself) |
| index.ts:266 (1) | argv default | S0 options with no argv key |
| index.ts:270, 272 (5) | the vendor filter and its reason | B3 empty value; S1 undefined value, lower case, two vendors |
| index.ts:275 (2) | missing exchange folder | S1 |
| index.ts:284 to 288 (5) | orders, settings and catalogue unreadable | **held** |
| index.ts:291, 293 (2) | the lock's content and codes | B2 |
| index.ts:300 to 302 (8) | outbox and inbox not real folders; no inbox | S1 |
| index.ts:307 (5) | blank AI_PROJECT_CLAUDE_BIN | S1 claude on PATH ('', blanks, undefined) |
| index.ts:310, 311 (4) | the config folder's place; the default approved list | S0 config folder in the system temp folder; S0 no approvedPath reads data/ai/approved.json |
| index.ts:316 (3) | the `.json` filter; the sort | S1 `.json.bak` is silent (kills the filter: **B4's disable for it is not needed**); S0 job id order (sort: **held**, below) |
| index.ts:319 (2) | the ignored-name log line | S1 a bad name is logged |
| index.ts:324 (3) | `read.reason === 'gone'` | **B4** |
| index.ts:327 (3) | too big | S1 |
| index.ts:331, 334 (2) | answered and refused log lines | S3 log golden |
| index.ts:339 (2) | the lock's `rm` force | S0 a lock deleted by hand mid-run (fake control `remove`) |
| scan.ts:8 to 12 (5) | the KIND strings | S3 and S4 exact kinds |
| scan.ts:21 to 27 (13) | bank shape, birth labels, birth and bank keys | S4 rows (two spaces, one word, born, zero-width, full-width); `u` flag **held** |
| scan.ts:37 (2) | the Luhn sum | S4 property against the reference Luhn; `-=` **held** |
| scan.ts:42, 47, 52 (5) | NFKC and format chars; the SIN digits; the marker tail | S4 zero-width and full-width rows, SIN property, marker rows; one **held** |
| scan.ts:56 (10) | `present()` | S4 null, empty, blank, 0 rows; S0 undefined and empty list |
| scan.ts:62 to 68 (6) | walk | S4 array and JSON number rows, marked fact rows; two **held** |
| scan.ts:83 (1) | the sort | B3 |

Check: a throwaway stub of B1, B2, B3, B5, B6 and the cap option (never committed) passed all 357 unit tests, and Stryker on it (`--force`, the three files, 357 tests) left 30 of 678: call.ts 2, index.ts 23, scan.ts 5 (95.57). Each is B4 or held:

- **B4 (as the directive names them):** call.ts `windowsHide`; index.ts `read.reason === 'gone'` (3). The `.json` filter is killed now, so B4 needs no disable for it.
- **Held for the Lead: the vendor list (5).** The four `*_API_KEY` names in VENDOR_SETTINGS are covered by VENDOR_PATTERN (equivalent: a rewrite drops them). VENDOR_PATTERN's `$`: whether a name like `X_API_KEY_FILE` refuses is not settled; fail closed says drop the `$` and add a row.
- **Held for the Lead: equivalent or unreachable (21).** index.ts: realPathOf's `dirname !== at` (the root always exists); isRealFolder's realpath clause after `lstat().isDirectory()` and its catch (the folder is known to exist; 3); `'utf8'` in loadApproved and the catalogue read (JSON.parse reads a Buffer the same; 2); the fail-closed list's content (a non-triple approves nothing); the schema problem path's `join('.')` (no nested path is reachable after the hand checks); `force: true` when clearing the config folder (entries just listed); `value !== undefined` in childSettings (spawn drops undefined values); the orders, settings and catalogue load failures (5: repo files no test can make unreadable); the inbox `.sort()` (this box lists a folder sorted, so the S0 order row passes either way; it catches a file system that does not). call.ts: `e.code ?? 'error'` (a spawn error always has a code). scan.ts: the bank regex `u` flag (every class char is in the BMP); Luhn `-=` (the sum mod 10 is sign-symmetric; W00b's shared Luhn replaces it); `m[1] ?? ''` (the group always matches); `Array.isArray` false (an array walks the same as an object); `typeof fact === 'string'` (Set.has of a non-string is false). Each needs a rewrite or a reasoned disable line naming its equivalence; a disable on the lock or the vendor check is never one (RC4).

## Step 6b sweep

With the stub in place, the whole unit suite was green (141 files, 3606 then; the S0 rows added after were run in the stub on the A08 folder: 357 of 357) and the db project was green (15 files, 701 passed). No test is retired. Rewritten, not weakened (S5, RC5):
- project.acceptance.test.ts: the repo top-level listing test compares only names the launcher could make (inbox, outbox, job-*, .tmp-*, .ai-once.lock), so other workers' files in the repo cannot flake it (RC5b); the `isInside` helper and the user-config check use `child === parent || child.startsWith(parent + sep)` on real paths (the old copies had the `..` defect, RC5d); the job-folder check uses that helper.
- exchange-safety.acceptance.test.ts: the child allowlist adds libuv's 7 Windows names on win32 only (RC5a); every scan row asserts its exact problems list (S3).

## Amber choices (for AMBER.md)

- The 10-second exit row runs `__fixtures__/run-once-driver.mjs`, the same resolver and entry as `npm run ai:once` but with the test's approved list, because ai:once takes no options and data/ai/approved.json approves nothing.
- The `.MJS` row uses a CommonJS shim (Node runs no file named `.MJS` as a module); the row tests that the launcher runs any case of the extension through Node.
- Reason texts are pinned whole as the build writes them; the cap reason must name the cap as "<n> bytes"; the lock file holds the run's pid and a newline.
- B3 insertion order: kinds in the order the walk finds them (a key before the keys after it).
- S0 choices: every allowlisted setting must reach the child (the CLI needs its profile and the subscription token); the config folder is made in the system temp folder; an input name's characters outside `A-Za-z0-9_.-` become `_`; a dob or account key holding an empty list is reported (only null, undefined and blank text count as no value); a lock deleted by hand mid-run does not crash the run's end.

Files the spec owns (new or changed this round): the four test files above; `__fixtures__/fake-claude.mjs` (stdoutBytes, hangAfterMs, writeConfigDir, exitBeforeStdin, ignoreTerm, remove), `__fixtures__/harness.ts`, `__fixtures__/run-once-driver.mjs`; `__golden__/` argv-c01-clean.json, prompt-c01-clean.txt, outbox-c01-clean.bytes.json, outbox-c01-unredacted.bytes.json, run-log-fixtures.txt.

# Round 4 patch (A509, gaps 1 to 11 and the Lead rulings)

Spec-writer (Opus, cloud-8c7eee), 3 Oct 2026. Spec commit 05edddb6 on claude/A08. Validated on main 702b5892 (origin/main later moved to 89be70a6, which changes plan/ files only, so the code is the same).

## Tests: 218 (215 unit, 3 db); was 121

- `src/modules/ai/project/project.acceptance.test.ts`: 123 (was 84).
- `src/modules/ai/project/exchange-safety.acceptance.test.ts`: 92 (was 34).
- `src/pipeline/ai-project.acceptance.db.test.ts`: 3 (unchanged).

## Clauses covered

ARC-6, ARC-20, ARC-22, AI-1, AI-5, AI-6, AI-8, AI-9, AI-10, END-8, SEC-5, SEC-10, SEC-11 (plus every clause the earlier rounds cover).

## What changed, gap by gap

| Gap | Tests | Fault planted (each one caught by the stub sweep) |
|---|---|---|
| 1 AI-8 | `settingsProblems` refuses a bare `Read` or `Read()` and needs a deny entry of the form `mcp__*` (the wildcard); a rule test with plants; a test that every allow rule is `Read(<relative pattern>)` and that RUNNING.md names the wildcard entry | `allow: ['Read']`; the only MCP deny entry `mcp__github` |
| 2 | the call passes `--strict-mcp-config`; `CLAUDE_CONFIG_DIR` is an absolute folder that exists and is empty when the CLI starts, outside the repo, the user's `~/.claude` and the job folder; two runs get two folders; a CLAUDE.md in the exchange folder or its parent refuses the run (the reason names CLAUDE.md, no call, no outbox); no false alarm for one in a folder beside it | no config folder; no `--strict-mcp-config`; no CLAUDE.md check |
| 3 ARC-22 SEC-10 | `vi.stubEnv` plants `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; `options.env` adds an extra name, `NODE_OPTIONS` and the exchange settings; the fake's env names must be a subset of the allowlist (PATH, HOME, USERPROFILE, APPDATA, SystemRoot, TEMP, TMP, TZ, LANG, CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_CONFIG_DIR; compared without case), with PATH present as a sentinel | `env: { ...process.env, ...env }` |
| 4 END-8 | the END-8 table gains CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_USE_VERTEX, AWS_BEARER_TOKEN_BEDROCK, GEMINI_API_KEY, GOOGLE_API_KEY, ANTHROPIC_BASE_URL and two pattern rows (MISTRAL_API_KEY, A08_PLANTED_VENDOR_API_KEY); with CLAUDE_CODE_OAUTH_TOKEN set the run goes ahead, the token's name reaches the CLI, and its value is in no log line, argument or file; the call test's `/API_KEY\|AUTH_TOKEN/` is narrowed to skip CLAUDE_CODE_OAUTH_TOKEN | a hand-written list of the 3 old names |
| 5 AI-9 SEC-5 | one table of 25 rows, each refused at stage input with no call and no value in a log line or the refusal: SIN with `.` and every R34 Unicode separator (U+00A0, U+2009, U+202F, U+2010 to U+2015), full-width digits (bare and spaced), as a JSON number at `ledger[0].memo`; DOB, D.O.B., born, birth date and date de naissance labels; the keys dob, birth_date and birthDate (nested); the keys accountNumber, transitNumber and institutionNumber; a bank shape with spaces; `RESTRICTED-PROVIDED` and the marker with a U+2011 hyphen. A SIN written with `\u` escapes in the raw inbox file. Four no-false-alarm rows (a nine-digit amountCents that fails the check digit, yearEnd as a date, a recordId with digit groups, the words restricted and provided apart) | ASCII separators only; no NFKC; numbers not scanned; the old DOB label only; no bank keys; a bank shape with dashes only; a case-sensitive ASCII marker |
| 6 A498 | the marked keys are every key E03 marks with `sensitive !== 'none'`, minus a reasoned exemption map (empty) that is checked for stale entries: the 3 bank_account keys now have rows (18 rows, was 9); every kind in SENSITIVE_KINDS has a key; a rule test with a copied catalogue holding a new kind, and a planted stale exemption | the closed `sin`/`birth_date` filter |
| 7 AI-1 AI-5 AI-6 | `test.each(aiStepTypes)`: an approved job per step type with its own F04 JSON Schema is answered with its own F04-valid answer, and an answer shaped for another step is refused at stage output with F04's problems for its own step; a `cannot_tell` answer and a `missing` finding citing a page are stored as answers | a hard-coded finding schema; a launcher that refuses `cannot_tell` |
| 8 AI-1 | the fake gains `exitCode`, `isError`, `subtype`, `emptyStdout` and `stderr` (on a rule or at the top); 6 rows (is_error, error_max_turns, error_during_execution, exit 1 after a success envelope, empty stdout, exit 2 with stderr) each become a refusal at stage run with no output and no stamp, and the next job is answered | reading `.result` when is_error is true; ignoring the exit code |
| 9 AI-8 SEC-10 | `sourceProblems` gains a truthy `shell:` and exec/execSync (import, bare call, `child_process.` call), with a rule test; a document text holding `" & \| < > %PATH% $(...)`, a backtick and a single quote reaches the fake unchanged inside the data wrapper (decoded from raw, JSON or HTML escaping), and none of it outside | `shell: process.platform === 'win32'` (caught by the source rule) |
| 10 ARC-22 | a run started while another is answering refuses with "a run is already going" and calls nothing; two runs started at once: one runs, one refuses, each job called once, each outbox file once; the lock is released after a run | two parallel runs with no lock |
| 11 | ORDERS.md needs a heading "never write to or about a client" (rule test with the heading removed); `isTest` as `"true"` or `1` refused at stage input | a truthy isTest check; the heading removed |
| modelUsage ruling | modelUsage lists a helper model before the approved one: answered with the approved model id, and the run log names every listed model; the approved model listed with 0 output tokens, or missing from two listed models, is refused at stage run naming the approved id | taking the first listed model; not logging the models |

## Fails first

All 218 fail at import: `src/modules/ai/project/index.ts` does not exist. Typecheck: only those three TS2307 lines. Lint: only the four unsafe-call errors the missing module causes. Everything else is green on the branch: unit 135 of 137 files (3175 tests); db 14 of 15 files (PGlite).

## Step 6b sweep

A throwaway stub (launcher, ORDERS.md, settings.json, RUNNING.md, an `ai:once` script; never committed) passed all 215 unit tests in the two files. With the stub in place the whole unit suite failed only 3 SC rule tests, all on the stub's own text (R18: no `@mutate`; R41: `.trim()`; R50: a Luhn check of its own). The db project was green on PGlite (15 files, 665 passed). The db file did not change, so it was not re-run on Postgres 16. No test retired. All 25 planted faults in the table above were caught, each on its own run. The stub worktree has been removed.

## Amber choices (for AMBER.md)

- **Ruling, modelUsage with several models**: "every listed model is recorded in the stamp" clashes with A426 (the stamp is exactly F04's 7 strict parts, and `versionStampSchema` is outside A08's Paths). The stamp keeps `modelId` = the approved model, and the run log names every listed model. To reverse: a contract card (F04) adds a stamp part, and this test then reads it.
- **Gap 6 ruling**: no key is exempt, so the map is empty. A bank_account value in any form (the `last four 4821` tail included) is refused, and the marker form is refused by A498 anyway. The exemption map and its stale check stay in place for a later reasoned entry.
- **Gap 1**: the wildcard deny counts when an entry starts with `mcp__*`. The builder picks the exact form after checking `claude --help`, and the test needs that same string in RUNNING.md.
- **Gap 2**: the config folder must be absolute, exist, be empty when the CLI starts, be new for each run, and sit outside the repo, `~/.claude` and the job folder (where it is beyond that is the builder's choice). The CLAUDE.md check is tested for the exchange folder and its direct parent, plus one no-false-alarm row for a sibling folder.
- **Gap 8**: stderr is tested only together with a failing exit code. A warning on stderr after a successful exit is not specified.
- **Gap 9**: "byte for byte" means the text decodes back exactly from the data block, because the earlier shape says each `<` inside the data is escaped.
- **Gap 10**: the second run refuses rather than skipping (the Lead's ruling). A stale lock left by a crashed run is not tested.
- **Builder notes**: use the one Luhn (R50: reference/sample-clients/lib/util.mjs, or guard.ts once it lands), mark `@mutate`, and use NonBlankSchema rather than `.trim()` (R41). Remove the run lock when a run ends; otherwise the "nothing written outside outbox" and "second run" tests fail.

Files the spec owns: the three test files, `__fixtures__/` (fake-claude.mjs, harness.ts, 13 inbox jobs) and `__golden__/` (2 outbox files, unchanged).
