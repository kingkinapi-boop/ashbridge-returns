# SC build (released again, cloud-a03a3e, 2 Oct)

Branch claude/SC with main 3df2e9b merged. No product code written: SC is rules only and the builder cannot edit the tests. 7 of 65 still fail (unit 4 of 48, db 3 of 17), all on defects in files other cards own ("added to that card, never fixed here"). The KNOWN list has no entry for any of them.

- F01 (db/schema): R12 `returns.returns` refuses UPDATE/DELETE but not TRUNCATE. R15 `returns.exceptions.status` has no CHECK list. R43 `*_id` columns pointing at unbuilt tables are not in FUTURE_POINTERS.
- records.ts owner (F09/F01): R15 `ExceptionRecordSchema.status` not an enum of a list. R23 stray keys accepted at top level in about 22 schemas (use `.strict()`); FactRecordSchema and others lack a valid sample in R23_SAMPLES (a spec job adds them).
- src/modules/gaps owner: R18 `gaps/index.ts` lacks `// @mutate`. R41 `gaps/bank/index.ts` uses `.trim()` and `z.string().min(1)`.
- src/contracts/ai.ts owner: R41 `.trim()` and `z.string().min(1)`.

Needed from the Lead: add each defect to its owning card (or KNOWN entries with owners via a spec job), then re-offer the SC build. Re-offering without that gives the same result.

Amber: none. Permission gaps: none. Model: Sonnet 5.5.
