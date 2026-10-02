# SC build (released, cloud-2c4bc3, 2 Oct)

Branch claude/SC (spec 90899c5 plus main 433c2c0 merged). No product code was written: SC is rules only, the tests cannot be edited by the builder, and the 7 failing tests (58 of 65 pass) fail on defects in files other cards own ("added to that card, never fixed here").

Failing now, by owner (the KNOWN list in the test file has no entry for any of these):
- F01 (db/schema): R12 `returns.returns` refuses UPDATE or DELETE but not TRUNCATE. R15 `returns.exceptions.status` has no CHECK list. R43 twenty `*_id` columns point at tables not built yet and FUTURE_POINTERS names no card (accounts, adjusting_entries, check_results, differences, entry_lines, events.record_id, facts.source_*, figures, judgment_inputs, links, version_cells).
- F09 or F01 (records.ts): R15 one state/status field not an enum equal to a list. R23 stray keys accepted at top level in 20 schemas of records.ts (use `.strict()`), plus 4 with no valid sample in R23_SAMPLES (FactRecordSchema, AdjustingEntryRecordSchema, FigureRecordSchema, CheckResultRecordSchema; the sample list is in the test file, so the spec job must add them).
- Owner of src/modules/gaps: R18 gaps/index.ts lacks `// @mutate`. R41 gaps/bank/index.ts uses `.trim()` and `z.string().min(1)`.
- Owner of src/contracts/ai.ts: R41 `.trim()` and `z.string().min(1)`.

Needed from the Lead: add each defect to its owning card (or add KNOWN entries with owners through a spec job), then re-offer the SC build.

Amber: none. Permission gaps: none. Model: Sonnet 5.5.
