# Cards V15, B06, T09, T10, T11: draft notes for the Lead

Drafted 3 Oct 2026 by a helper. Cards in `plan/cards/`; `plan/slices.json` entries filled (deps, paths, clauses, size, core, security, hard) with status left at `todo` and a note pointing here. Every choice below is amber for the Lead to log (what, why, how to reverse). No RED found; one note for LIVE-6 at the end.

## The five cards

**V15 CPA review queue** (phase 3, M, security, screens). The CPA's `/review` page: returns in `review` only, ordered by X01's `queueOrder` (Z20-4), tier in words, both due dates, waiting since, round, plus the "Back from rework" view Z20-4 asked for.
Deps added: X01 (`queueOrder`, tier), V02 (the brief it links to; rule 16, no dead link), F02 (due dates, state events). A small read-only module `src/modules/review/queue/` works out waiting since and the round from F02's events.
Waits on D02 being approved with a queue page in it; the spec job releases the job if D02 has none.

**B06 Books changed after approval** (phase 4, M, hard, core, security). Re-reads QBO through B04, compares by account id, transaction id (or composite key) and journal entry id with the snapshots the approval used, and voids through T08's approval-watch step naming exactly the fingerprinted items fed.
Dep added: B01 (a new account since approval is matched to its GIFI cell through QBO's mapping). Results `clean`, `voided`, `blocked`; a change feeding no figure is recorded, not voided.
New table file `77_recheck.sql`; shares `approval-watch.ts` and `handlers.ts` with T08 (serialized by deps) and `src/contracts/books.ts`, `src/modules/books/index.ts` with B05 and B01 (serialized by deps).

**T09 The check before transmit** (phase 4, size raised to L, hard, core, security). B06 first, then the check export against the approval cell for cell (byte-equal shortcut, natural keys, ignore list as data), `check` version through N00, the `ready_to_file_to_filed` guard and the filing record with the confirmation number.
Dep added: N00 (`saveVersion` kind `check`, LL-1). A mismatch voids through T08's step, so RT-19's "back to review" goes through trace as FLOW-5 says.
New `78_transmit.sql`, `data/transmit/ignore-cells.json` and `settings.json`; shares `src/pipeline/deps.ts` with V04, V09, T10, T11.

**T10 The frozen binder and retention** (phase 4, size raised to L, hard, security, core). A manifest of every binder part, each with sha256, fingerprinted as a whole; freeze plus the move to `closed` in one transaction; `verifyBinder`; keep-until dates; no delete anywhere.
Deps added: T11 (T183CORP and certificate), V04 (comments), A05 (write-once store). FLOW-9's "read-only" is a database guard on every table with a `return_id` (`99_closed.sql`, built from the catalog, runs last), proved by a rule test over the catalog.
New `81_binder.sql`, `99_closed.sql`, `src/pipeline/steps/binder.ts`.

**T11 Approval summary data and the T183CORP record** (phase 4, size raised to M, core, security). Writes the six approved numbers and the assumption rows to `returns.client_handoff` (ids and numbers only) when ops records the T183CORP as sent; certificate upload; the two guards approved to client_sign and client_sign to ready_to_file; withdraws the summary on a void; T183CORP keep-until.
Deps added: T07 (review lines), B03 (last year's values). Clauses added: FLOW-5, ARC-2, AI-7, SEC-7.
New `79_clientsign.sql`, `data/clientsign/summary-lines.json`.

## Amber choices

1. **V15 order (Z20-4 over the slice title).** The slice title said "oldest first"; decision 0020 Z20-4 sets overdue, then tier, then due date. The card follows Z20-4 through X01's `queueOrder`; waiting since is shown and sortable. Recommend one Lead line on X01 (not yet specced): tie-break by waiting since before id, so "oldest first" holds inside ties. Reverse: sort by waiting since alone.
2. **V15 "Back from rework" is a second view** (MOJ sub navigation), not a filter, per rule 14 (separate things on separate tabs). Reverse: a filter on the one table.
3. **V15 data:** waiting since is the latest move into review; round is "back from rework" when that move came from rework. Reverse: count rounds.
4. **D02 brief must name the CPA queue page and its Back from rework view.** The map lists the CPA queue; D02's slice clauses carry RV-8 but no card said the queue is in D02. Reverse: a D-card of its own.
5. **B06 "the snapshot the approval used"** = every QBO snapshot named by pointers reached from the standing approval's items (`sourcesOf` per fingerprinted cell, plus facts and entries). Two trial-balance snapshots of one date are both compared and named.
6. **B06 "feeds a figure"** = reached from a fingerprinted item; a changed account balance voids by naming the cells it feeds (F02's `ChangedItem` kind `cell`), since accounts are not fingerprint items themselves.
7. **B06 transactions compared by id even when the balance is unchanged** (TB-11 names transactions separately). Reverse: compare balances only.
8. **B06 an unmapped new account with a balance is `blocked`** (a flag for a person), and T09 refuses while it stands. **Question for the Lead:** blueprint 02 has no move out of `ready_to_file` except a void, so the only exits are fixing QBO and rechecking, or mapping the account (B01) so the void can name its GIFI cell. If that is not enough, a "withdraw approval" move is a clause change (blueprint 02's table), amber by the rules but worth the Critic's eye.
9. **B06 runs inside T09 each time** (no separate recheck freshness rule); it can also be called alone by ops, the CPA or the owner.
10. **T08's `checkAgainstApproval` must take a list of fingerprinted items from a books recheck.** T08 is not specced yet: recommend a one-line Lead note on T08 now, so B06 does not have to report it later. B06 and T09 never edit `src/modules/approval/`.
11. **T09 ignore list as data** (`data/transmit/ignore-cells.json`), starting with `IFirm.ContactPartner` only (wiped when the return is opened, FINDINGS Q23); everything else is compared; a new row is an amber row. Day 6 of the trial may add cells.
12. **T09 "just before transmit" = a passed check no more than 24 hours old** (firm parameter in `data/transmit/settings.json`), still the latest export, approval still standing. Reverse: no time limit.
13. **T09 confirmation number stored as typed** (non-blank only) until a real CRA confirmation number's format is seen. One filing record per return.
14. **T09 a newly filled cell (empty at approval, filled at check) is a mismatch**; a check export missing a fingerprinted row is a mismatch, never a pass.
15. **T10 binder contents:** FLOW-9's list plus the approved lock export, every document received (marked whether it feeds a figure), the QBO snapshots and attachments reached from the approval, the check export, and the notice of assessment. Reverse: only sources that feed a figure.
16. **T10 keep-until = six years after the freeze date** (freeze is after filing and after year end, so SEC-8's "at least" holds), never earlier than the T183CORP's date; 29 Feb gives 28 Feb.
17. **T10 read-only by database guard on every `return_id` table**, with only two named exemptions (the source log, so reading a closed binder is still logged; the events table for the closing event). This touches every module's tables at once; SC's rule sweeps should know it. Reverse: a guard in each service.
18. **T10 nothing deletes after keep-until**: deleting is not built (a go-live question).
19. **T10 a missing part refuses the freeze** and flags for a person; the return stays in `assessed`.
20. **T11 summary written when ops records the T183CORP as sent**, as a new `list_version` with status `sent` in the same transaction as the move; a void moves the rows to `withdrawn`. Reverse: write it at approval as `draft`.
21. **T11 mapping of the six numbers** follows V02: `federal_tax` is T07's `part1_tax`, `net_income` is `net_income_tax`; data file, refused on load if one is missing or doubled. Values come from the approval's fingerprint, never a later export.
22. **T11 assumption rows** = questions of the sent list with no answer when the T183CORP is sent; slots name the question's bank item id and fact id only.
23. **T11 certificate identity:** another corporation's name refuses; neither name nor year end found is accepted with "certificate not checked" for a person (T07's pattern for the printed return).
24. **T11 and T10: an amended return (FLOW-8) is a new cycle, so a new approval**: the earlier T183CORP never satisfies the new cycle's guards. Whether an amendment is a new return record or the same one is not settled here; the closed-return guard (T10) assumes a new record.
25. **New migration numbers:** 77_recheck (B06), 78_transmit (T09), 79_clientsign (T11), 81_binder and 99_closed (T10). All under FX3's `db/schema/**` claim, which lands long before phase 4.
26. **Shared files:** `src/pipeline/deps.ts` (V04, V09, T09, T10, T11) and `src/pipeline/handlers.ts` (T08, I01, I30, V13, B06, T09, T10, T11) take additive lines only; `approval-watch.ts` is serialized T08, B06, T09 by deps. Overlap only delays a claim.

## Gaps found (no card owns them yet)

- **The notice of assessment compare and the move filed to assessed** (FLOW-8's follow-up item, guard `filed_to_assessed`). V10 carries FLOW-8 but is a screen card; E18 only reads the notice. Recommend a module card (phase 4, deps E18, T09, N00 for the `assessed` version, LL-1) or a line on V10.
- **Proceeding on documented assumptions** (contract section 5, line 5): no card records which questions the file proceeds without; T11 only derives them at send time from unanswered sent questions.
- **T06** (parked, the old combined card) is fully covered by T08, T09 and T10; its parked note could say so.

## RED

None. One note: the client app must word the six numbers and the assumption rows, including the sign of `balance_or_refund` and that `federal_tax` is Part I tax; that is LIVE-6 in the client app's repo, already red there. This repo writes no sentence.
