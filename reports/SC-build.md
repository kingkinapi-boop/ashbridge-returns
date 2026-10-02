# SC build released (cloud-4cdd51, 2 Oct)
Branch claude/SC (origin/main merged in at 89d38a6). No product code is in SC's paths: the card is rules only, so the build has nothing to write; what is left is red because of files other cards own, and the tests are not mine to edit.
Result on the merged branch: 58 of 65 pass, 7 fail (unit 4, db 3). Each failure is a real defect on main, or a test list that needs updating:
- R12: `returns.returns` refuses UPDATE or DELETE but not TRUNCATE (db/schema, F01 or F01D).
- R15 (db and file): `returns.exceptions.status` has no CHECK list; `ExceptionRecordSchema.status` in records.ts is not an enum of a records.ts list (F01 / F09).
- R18: `src/modules/gaps/index.ts` is listed by a core card but has no `// @mutate` in its first 5 lines (owner: the gaps card, G10/G11).
- R23: records.ts schemas (about 18) accept a stray key at the top; FactRecord, AdjustingEntry, Figure, CheckResult need valid samples in R23_SAMPLES (test file, spec job).
- R41: `src/contracts/ai.ts` and `src/modules/gaps/bank/index.ts` use `.trim()` and `z.string().min(1)` (owners: AI contract card, G11).
- R43: 19 `*_id` columns point at unbuilt tables and FUTURE_POINTERS (test file) names no card for them (spec job: list qbo_*, cell_id, record_id, check_id, from_id, to_id and the source_* ids with their cards).
The Lead should: (1) add the defects to the owning cards, or reopen a spec job to extend KNOWN, R23_SAMPLES and FUTURE_POINTERS for these (SC itself may not fix them); (2) re-offer SC build after.
Not run: lint, deps:check, mutate (nothing to build). Typecheck and scope: scope OK (34 files inside paths).
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
