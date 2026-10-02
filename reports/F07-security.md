# F07 security review

Card: plan/cards/F07.md (security). Branch claude/F07 at 5dbacd3, diff `origin/main...HEAD` without plan/ and reports/ (11 files: db/schema/05_bridge.sql, db/schema/55_bridge_returns.sql, src/contracts/bridge.ts, src/modules/bridge/**). Read with reference/onboarding-contract.md (sections 1, 3, 4, 6), CLAUDE.md hard rules and decision 0003. Reviewer: Opus, 2 Oct 2026. Nothing fixed.

## Verdict: FINDINGS (HIGH 0, MEDIUM 0, LOW 1)

Nothing blocks boarding. The one LOW sits in a table F07 creates but no F07 code writes; it belongs on the card that first writes hand-off rows.

## Findings

### L1 (LOW): the hand-off table accepts SIN-shaped and bank-shaped digit runs in slot values and id columns

- Where: db/schema/05_bridge.sql:44 (`returns.is_handoff_id`, `^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,79}$`), db/schema/05_bridge.sql:61 (slot strings: 60 characters at most and not blank, nothing else); src/contracts/bridge.ts:83 and :86 mirror the same rules.
- What happens: `returns.client_handoff` is the one table the client app reads with its service role, which skips row-level security (contract section 4), and it shows slot values in client-facing templates. A slot label is allowed to be "a label copied from a document". For example, a T4 slip line copied into a slot reads `J Doe 046 454 286`, which is 18 characters and passes both the zod shape and the SQL check. The same goes for `046454286`, or a bank account written as `00123-004-1234567`, placed in `item_id`, `fact_id`, `choice_ids` or a slot key: each passes `is_handoff_id`. The SIN or account number would then sit in plain text in a table the client app serves, outside `restricted_data` encryption. The client app refuses exactly these digit runs in its own answers, file names and transcripts (contract section 3, last bullet: M0006:71-76, M0019:50, M0024:80), so this table is the one way such values could cross the boundary.
- Why LOW: F07 has no writer for `client_handoff` (run.ts writes only client_refs, bridge_ops_items, returns and bridge_returns), and the data is made up until go-live. Someone can exploit it only once a later card writes question lists or approval rows from document labels.
- Suggested home: the card that first writes `client_handoff` rows. Add the client app's SIN-shaped and bank-shaped refusal (the same patterns as M0006:71-76) to `is_handoff_id` and `is_slot_map`, plus a rule test that plants such a run in every text column and every slot.

## Checked and clean

- **Fields that could slip past the never-read list.** Every bridge shape is a `z.strictObject`: snapshot, entity, corporation, engagement and hand-off row. Nested objects are strict at each level, so an unknown key is refused, not stripped. Case variants (`Email`), renamed fields (`sin`, `value_encrypted`) and an own `__proto__` key from JSON.parse are all unknown keys. The parsed output is a new object holding only the declared keys. No shape holds a section 3 name, and the acceptance tests read the list from the contract file and plant fields to prove refusal. Free text that is allowed in (`outstanding_years`, `services`, `current_state`) is only compared, never stored or logged. Only `legal_name` is stored (as `returns.returns.entity_name`), and the contract allows it. `business_number` is checked but never written. Slot values cannot be objects (SQL refuses nested values; zod allows only number or string), so a `__proto__` slot key cannot pollute a prototype.
- **Live database or live client app.** run.ts takes a PGlite handle passed in by the caller. The diff has no connection string, `process.env`, fetch, HTTP or Supabase client. `is_test: z.literal(true)` on the snapshot, corporation and engagement refuses anything not marked as made-up (decision 0003).
- **Secrets.** None in the diff. The fixture business numbers are made-up nine-digit values, and every name ends in "(Test)".
- **SQL injection.** Every query in run.ts uses bound parameters ($1 to $5, `$4::uuid[]`, `any($1::uuid[])`). The new SQL functions are `language sql immutable` with no dynamic SQL and are not `security definer`.
- **Row-level security.** All four new tables (client_refs, bridge_ops_items, client_handoff, bridge_returns) enable row-level security with no policies. That matches the rest of `db/schema/`, which has no grants, roles or policies, so the change widens no permissions. client_refs and bridge_ops_items are append-only, with update, delete and truncate refused. client_handoff lets only `status` and `sent_at` change.
- **Logging and error text.** The diff has no logging. Error messages carry no client values: zod issues name keys, not values; `returnYearEnd` echoes a date that has already been checked; `formatClientRef` echoes a counter.
- **client_ref.** It is minted from a sequence number only, never from client data, and the regex check and both unique constraints enforce that in SQL.
