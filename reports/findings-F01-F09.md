# Findings review: F01 and F09, build side (2 Oct, Opus, cold; text returned to the Lead and recorded here)

Inputs: reports F01-check, F01-spec, F01-build, F01-spec-refit (e8acadc), F09-check, F09-build, findings-W14-D01; cards F01, F09, E00, E01, E03, A01, A02, A03, A07, L00, F02, F06, B04, B05, G00, I00, N00, T04, T12; blueprint EV-1, EV-5, EV-6, EV-14, TB-2, TB-6, FLOW-1, FLOW-4, SEC-7, ARC-10, AI-4. No code run.

**Headline.** Both Fix round 1 sections say "no content change: the build stands". That holds for the toolchain only. Do not start either re-check until the content fixes below are in.

## Root causes (5)

**RC1 (F01). The schema enforces each card sentence literally, not the rule the clause protects; the spec planted one fault per check.** TRUNCATE gets past append-only (20_ledger:64, 30_books:54, 50_returns:28, 60_versions:28-33). TB-2 counts the sources array, not its members (`[null]`, `[""]` pass; one 0-cent line "nets to zero"). events.actor and .reason, judgment_inputs.author and .reason accept blanks. is_version_stamp accepts `{"x":null}` (SQL and zod). state_events.from_state/to_state have no CHECK against the 16 states. A return can be inserted in any state with no event. Where else: every append-only table to come (B04, T04, T12, N00, E00, L00), every ARC-10 stamp (E00, E01, F06, B05, T04, I00, N00), every reason or actor column (T12, G00, L00, F02).

**RC2 (F01 and F09). F01 never spelled out each record field by field, and F01 and F09 defined the same box in parallel.** EV-5: a document pointer does not require page and box, and they are allowed with other pointer kinds. FLOW-4: adjusting_entries and judgment_inputs have no version_no. Facts have no sheet, row, column (EV-14 pointers cannot be stored). A QBO pointer stores only the snapshot (EV-5 and B04 need account and transaction). F01 box `{x0,y0,x1,y1}` unbounded (records.ts:86) vs F09 Box `{page,left,top,width,height}` as page fractions: E01 writes F09 boxes, I00 and V01 read them back. Nothing stops in-place UPDATE of facts.value, adjusting_entries.reason, judgment_inputs.value (EV-1). Where else: L00, E01, B05, T12, N00, V01.

**RC3 (F01). "Latest" decided by keys the caller sets or that tie.** FLOW-1 latest state event by created_at then text id; created_at is transaction time, so events in one transaction tie and 'se-2' sorts after 'se-10'. One event can license more than one move. Where else: F02, B05, T12, N00, G00.

**RC4 (F09). valueInBox accepts any contiguous run of words glued with no separator.** "12" "34" matches 1234; "234.56" matches from "1 234.56"; a separate sign word is ignored ("-" "1,234.56", "DR", parentheses); "001234" matches 1,234.00; text mode removes every space ("Maple" "Leaf" = "MapleLeaf"). Where else: I00 checkCitation (AI-4), E01 acceptance gate, E00, A01, A02, SK0; A07 and E01 through normaliseAmount.

**RC5 (F09). Geometry checked field by field, never as a whole.** Converters clamp per field (a box partly off the page shifts or grows); zero page size gives NaN; BoxSchema allows left+width > 1; pageCount never checked against the page list. Where else: A01, A02, E00, V01.

## Card decisions (amber, none red)
- F01: acceptance misses TRUNCATE, blank array members, the full EV-5 pointer, FLOW-4 versions, FLOW-1 ordering: add checks 13 to 19 (within EV-1, EV-5, EV-14, FLOW-1, FLOW-4, SEC-7). F01 takes F09 as a dependency so the box has one shape.
- F09: add the "maximal amount group" rule, whole-box validity, and "box on another page" means a page the result does not have.

## Consolidated fix list
**F01 Lead:** amend the card, add the spec file to Paths, add the F09 dep. Hold the F01 re-check.
**F01 spec job** (a new worker: not the first spec writer, not the refit writer, not the builder; build on e8acadc; validate on main):
13. TRUNCATE refused on every append-only table.
14. Explaining an entry refused when sources holds `[null]`, `[""]`, `["  "]` or `[{}]`, a single 0-cent line, fewer than two lines (amber).
15. EV-5: a document pointer needs exactly one of (page and box) or (sheet, row, column); those refused with other kinds; a QBO pointer needs snapshot and account; the box is F09's shape (fixture changes).
16. FLOW-1: two events in one transaction, a back-dated event, ids 'se-2' vs 'se-10' resolve right; one event licenses one move; states outside the 16 refused; a return inserted other than at intake refused (amber).
17. Blank actor, reason or author refused on events and judgment_inputs.
18. Version stamps `{"x":null}`, `{"x":""}`, `{}` refused in SQL and zod.
19. FLOW-4 and EV-1: entries and judgment inputs carry version_no; in-place UPDATE of value columns on facts, entries, judgment inputs refused (status and explained may change); DELETE refused; judgment inputs append-only.
Also: replace "Maple Grove Dental Professional Corporation (Test)" with a clearly made-up name.
**F01 build round 2:** statement-level `before truncate` triggers calling refuse_change; `seq bigint generated always as identity` on state_events and returns.current_state_event_id that must change on every move (drop created_at ordering); enum CHECKs, non-blank CHECKs, member-wise sources check, stricter is_version_stamp (non-blank scalars); pointer columns (sheet, row, column; QBO account, transaction) and the pointer CHECK; source_box CHECK with fractions 0 to 1 reusing F09's BoxSchema without page; version_no columns and a column-guard trigger on facts, adjusting_entries, judgment_inputs.
**F09 spec** (fold into the lint refit if not started, else a second spec job): (a) amount-group cases: each wrong match refused; "-" "1,234.56" matches -1234.56; "1" "234.56" and "1,234" ".56" still match; (b) property test: an adjacent sign word flips the match; a split whose second part is not a three-digit group never joins; (c) text joins with one space; (d) leading zeros refused ("0.56" passes); (e) BoxSchema refuses overflow; converters refuse off-page or zero-size rects; page list exactly 1 to pageCount; (f) `// @mutate` in reading.ts.
**F09 build round 2:** tokenise into maximal amount groups (same line, reading order; joins only across "$", a sign word, ".dd" or a ",ddd" / space-separated three-digit group; compare whole groups); text joins with a space; leading-zero rule; whole-box validation; @mutate. Amber: accept "$-1,234.56", "-$1,234.56", "$(1,234.56)".
**Order:** F09 spec, build, check (lands first); then F01 spec, build, check.

## Rule tests (a card of their own, "schema and contract rules")
Each first fails on a planted bad example in `tools/test/__fixtures__`; database rules run over every table in schema returns.
- R12 every table with an update or delete refusal also refuses TRUNCATE.
- R13 every column named actor, author, reason, approved_by, holder or `*_by` refuses '' and '  '.
- R14 every version_stamp column refuses `{}`, `{"x":null}`, `{"x":""}`; every zod VersionStampSchema matches.
- R15 every column named state, `*_state`, status, origin, entry_type has a CHECK equal to its records.ts list.
- R16 no `order by ... created_at` or `order by ... id` in db/schema or src/modules unless an identity seq comes first.
- R17 one box shape: no zod object with x0/y0/x1/y1 in src/contracts; every box field uses F09's BoxSchema.
- R18 every core file under src/contracts and src/modules carries `// @mutate`.

## Risks and re-tests
- TRUNCATE triggers: W00, JH0, SK0 seeding must never truncate; confirm PGlite and Postgres 16 both fire statement-level truncate triggers.
- Insert only at intake: test-world and SK0 returns in later states go through events (a W00 or JH0 helper).
- Stricter stamps: E00, E01, F06, B05, T04, I00, N00 specs must name the stamp shape before they are specced.
- Column guard: L00 changeFact and verifyFact, B05 explained still work; L00, B05, E00 keep the guard.
- Stricter valueInBox: A02's 9 of 10 on Tesseract splits may drop (join rule is lexical, not by gap); F09 tests 91, 100, 147, 156 stay green.
- Leading-zero refusal reaches A07 money cells and E01; check the C01 CSVs for zero-padded amounts.
- Box shape: L00, E01, I00, V01 cards name F09's Box.
- Re-test both: typecheck, lint, `npm test`, db project, `test:flake` 5 of 5, Stryker on reading.ts (break 70; 80.4% now), a second Opus adversarial read on each.
