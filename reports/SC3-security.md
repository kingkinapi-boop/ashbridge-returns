# SC3 security review (Opus, 3 Oct)

Scope: `git diff origin/main...origin/claude/SC3` (tools/test/security-rules.test.mjs, src/contracts/security-rules.db.test.ts, tools/test/__fixtures__/security-rules/**, three JSDoc tags in src/modules/auth/testusers/engine.ts), read against plan/cards/SC3.md, reports/A06-findings.md and the schema in db/schema/. Static read plus a regex probe in node; no npm, no tests run.

**Verdict: FINDINGS** (4 medium, 5 low). No rule is weaker than the card asks, but each rule claims "every" and can be slipped by a plausible edit.

## Medium

**M1. R66 misses every append-only table guarded by `version_table_guard`.** `src/contracts/security-rules.db.test.ts:213-214` and `:224-226` select only tables with a `refuse_change` trigger. Six tables refuse delete and truncate and freeze their columns through `returns.version_table_guard` (EV-1, SEC-7; db/schema/00_schema.sql:92-110): `facts` (20_ledger.sql:101-104), `adjusting_entries` (30_books.sql:71-74), `judgment_inputs` (30_books.sql:171-174), `gifi_mappings` (30_books.sql:28-31), `versions` (60_versions.sql:31,37) and `client_handoff` (05_bridge.sql:121-124). The planted shape is live there today: `judgment_inputs.author text not null` and `adjusting_entries.author text`, staff user ids with no key, plus free `reason` and `value` columns R66 never lists. Fix: treat a table as append-only when any non-internal trigger runs `refuse_change` or `version_table_guard`. Add a sentinel that every guard function in 00_schema.sql whose message starts "append-only" is on that list, a sentinel table (`judgment_inputs`), and then key the new columns or give each a reviewed line.

**M2. The tag scan silently drops malformed tags.** `security-rules.db.test.ts:45-47`: the pattern needs a line that is exactly `* @tag [N] name`. Probed in node: `/** @once approve */` (one-line JSDoc), `* @once approve - one use only` (trailing text) and a bare `* @once` are all ignored without a sound. A later card that tags an export and forgets the registry line passes R63, R64 or R65 untested, and that is exactly the slip the registry exists to stop. Fix: any line in a JSDoc block that mentions `@once`, `@limit` or `@standin` and does not parse strictly is a problem. Add those three forms to planted-tags.ts.txt.

**M3. R62's inventory is keyed on a name regex, so a factory or a stand-in can sit outside it.** `tools/test/security-rules.test.mjs:47` and `:139-146`.
- (a) A setting read by destructuring (`const { MAIL_ENGINE } = options.env ?? {}`) or by a template literal (`` `STORAGE_${k}_ENGINE` ``) matches nothing (probed). It is then neither checked as declared nor required in FACTORIES, so its factory is never called under production.
- (b) A stand-in constructor reachable without its factory is never tested. `src/modules/ocr/index.ts:39,41` publicly re-export `createTextLayerEngine` and `createRecordedEngine`; neither takes env nor refuses production. The module-boundary rule (.dependency-cruiser.cjs) binds only `src/modules/*`, so `src/app` code could build the recorded stand-in in production. No product caller does so today (grep), so the gap is latent.

Fix:
- Flag every `[A-Z][A-Z0-9_]*_ENGINE` token, and any template literal containing `_ENGINE`, whatever comes before it.
- Add an inventory rule: every product file with `isLive: false` is either reached only through a registered factory (no import of its constructor outside its own module folder) or sits on a reviewed "local reader, no live side" list with a reason (today `src/modules/sheets/index.ts`).
- Stop re-exporting the OCR engine constructors from the module's public index, or list them as reviewed.

**M4. The R66 free-text list carries three deferred fixes as permanent "reviewed" lines.** `security-rules.db.test.ts:230` `approvals.approved_by`, `:233` `events.actor` and `:241` `state_events.actor` are staff user ids with no key: the A06 RC3 shape (reports/A06-findings.md:8, :15) that R66's own planted fixture models. Each reason says "a key to staff_users waits on V00". But plan/cards/V00.md does not carry that work, and FREE_TEXT has no owner-card check, so nothing ever forces it. These are KNOWN entries hiding a live gap outside the KNOWN discipline (A407). The values are set by code today, not typed, hence medium. Fix: move the three to an owner-checked list (owner V00, open, the same check as KNOWN) and add the key work to V00's card. Alternatively, key them now: named system actors become rows in `staff_users`, or a CHECK on a fixed list of system actors.

## Low

- **L1** `security-rules.db.test.ts:217-218`: any CHECK that names the column and contains `= ANY`, `~` or `<@` anywhere counts. A multi-column CHECK that lists one column vouches for its neighbours, and a non-blank regex (`x !~ '^$'`) counts as a format. Tie the operator to the column, or parse each check per column.
- **L2** `:212`: only `text`, `varchar` and `text[]` are checked. A domain over text, `citext`, `char` and text fields inside `jsonb` (`facts.sources`, `client_handoff.slots`) are not.
- **L3** `security-rules.test.mjs:148-152`: the unit FACTORIES production test tries only the unset case, not blank `''`. The AUTH_ENGINE db test covers both, so add `''` here too.
- **L4** R63, R64 and R65 are opt-in by tag, as the card designs them (R26 style). An untagged stand-in, once-only export or limited export is invisible. The M3 `isLive: false` inventory would backstop R63.
- **L5** A tag's name is not tied to the declaration under it, so `@once finishSignIn` could sit on any block in the file. The harness calls the method by name, so a rename breaks typecheck. Acceptable.

## Checked and clean

- **KNOWN.** The list is empty after FX2. `applyKnown` fails both unlisted and stale strings, and the KNOWN test requires one rule, one existing file, exact strings and an owner card that is not done. Each file scan asserts files were read plus a sentinel (`src/modules/auth/index.ts`, `AUTH_ENGINE`, `sign_in_events`).
- **Planted faults.** Each rule's planted fault is caught and its clean twin passes. R64 requires exactly one success, not zero. R65 counts evaluated attempts from the database, not from return values. R63 asserts both the refusal and that no row was written.
- **The JSDoc change** (engine.ts:90-92, 164-166, 186-188) is comment-only. The tags are read by nothing but this rule file (grep for `@once`, `@limit` and `@standin` across the repo), and no eslint jsdoc plugin is configured. No behaviour change.
