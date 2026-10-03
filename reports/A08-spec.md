# A08 spec (round 4 patch: A509, gaps 1 to 11 and the Lead rulings)

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
