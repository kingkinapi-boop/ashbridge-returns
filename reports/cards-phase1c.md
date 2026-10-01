# Phase 1 cards, batch c

1 Oct 2026. Helper drafting cards for the Lead. Branch `claude/cards-phase1c`. Read: CLAUDE.md, `.claude/rules/testing.md`, `.claude/rules/staff-screens.md`, `blueprint/README.md`, blueprint 02, 03, 05 (AI), 06, 08, 09, `reference/research/2026-10-01-qbo-reconciled.md`, `reference/qbo/2026-10-01-sandbox-checks.md`, `reference/sample-clients/README.md` and C01's answer key, `plan/slices.json`, `reports/cards-phase1a.md`, `reports/cards-phase1b.md`, cards F00, F01, F02, F07, F09, F10, A04, A05, A06, A07, E00, E02, L00, L01, SK0, U00, W00, D01, the design, extract and question families.

## Cards

| Card | Size | Tags | Deps | One line |
|---|---|---|---|---|
| E03 (new) | S | core | F00 | The fact catalogue `data/facts/catalogue.json` (keys, value types, repeating rows, sensitive kinds) and its loader in `src/contracts/facts.ts`. |
| E01 | L, hard | core | E00, E02, E03, L00, A04, A07, F10 | Extractor registry, the box and cell gate, rejection counts, cents self-checks, suspect marks, storing through L00, a data-driven labelled-amount extractor; removes the skeleton's "one fact" stub. |
| B04 | M, hard | core, security | F01, W00, A05 | Read-only QBO adapter in Returns' own normalised shapes; `samples` stand-in folder; `sandbox` and `live` API engines off and tested on a fake; dated fingerprinted snapshots; `testworld/qbo/export.ts`. |
| B05 | L, hard | core | B04, L00, SK0, F10 | Account records from snapshots, adjusting entries explained by the memo convention, TB-5 refusals, `accountTrace`; the books step. |
| B01 | M | core | B05, A05, A07 | .GFI upload read under an assumed layout (data, unconfirmed), mapping record, `gifiTotals`, TB-3 flags, TB-12 total codes refused; `data/gifi/codes.json` from RC4088. |
| B03 | M | core | B05, L01, E17, E18, E19 | Prior-year values by a fixed source order; converted values amber until they agree with the assessment; CK-12 source choice; the 3849 opening check. |
| B07 | M | core | B05, L01, E10, E11 | One-to-one bank and card matching by account, date and amount from `data/books/match-rules.json`; agrees-with links; five flags for a person. |
| G01 | S | none | F00, E03 | Question bank schema, loader, no-sentence lint, `pick`, `toHandOff`. |
| G00 | M | core | L00, F02, F05, F07, E03, G01 | `data/gaps/required.json`; found, missing, conflicting, weak by code; draft list; `signAndSend` to qa with the dated waiting flag. |
| G02 | M | core | G00, G01, A04, I00 | AI fills slot values only, through I00; added ids, ill-typed values and failed citations dropped and counted. |
| I00 | M, hard | core, security | A04, A08, E01, E03, L00 | Redaction of text and page images, citation checks, the grounded step wrapper, data envelope, no action fields on AI schemas. |
| U01 | S | none | U00, D01 | Shortcut registry from D01's list, visible controls, off in text fields, single keys can be turned off, no single key approves or sends. |
| U02 | M, hard | security | U00, U01, A06, F02, D01, E03, JH0 | `ReturnFrame`, masking, `HoldBanner`, `StatusWords`; one sweep per automatable staff-screen rule over every D01 route and kind, each shown failing on a planted page. |
| D13 (new, design family) | M | none | D00, D01 | Design: sign-in and the return record shell. |
| V00 | M | security, screens | U00, U01, U02, A06, F02, D01, D13 | Sign-in screens, cookie, `canSee` and `visibleReturns` (SEC-2), source log, staff layout and record shell, holds. |
| V01 | M | security, screens | V00, E00, B04, I00, U01, U02, D03 | The one source viewer for every pointer kind, masked page images only, second window, logged opens, under 1 s. |
| V05 | M | screens | V00, F02, G00, B05, D04, U01, U02 | Preparer queue by due date with state, tier, blockers and both due dates. |
| V08 | M | screens | V05, V01, G00, G01, G02, D07, U01, U02 | Gap review: keep, edit, merge, drop, add from bank, sign and send. |
| V14 | M, hard | screens | V00, V01, L01, B01, B03, B05, D02, U01, U02 | CPA review early slice: statements and GIFI section, dots, last year, three panes, under 1 s. |

Every V card has a "When it starts" section: it waits for its design card, which is done only when Zo approves it. After the update: `node tools/status.mjs` shows carded 232, to write 37, parked 13, done 2 of 284; phase 1 has no todo card. `node tools/next.mjs 12` starts F00 and D01; next cards to write: M00 T01 T02 T04 T05 T07. `node tools/matrix.mjs --plan` gives PLAN OK, no dependency cycle, no phase 1 card depends on a later phase. `plan/MATRIX.md` was generated and is not committed.

## Ambers

- E03 is a new card holding the fact catalogue (`data/facts/catalogue.json`, loader in `src/contracts/facts.ts`); E01, G00, G01, I00 and U02 depend on it. Why: the question family's check 2 names a fact catalogue no card owned, and masking needs to know which keys are sensitive. Reverse: fold the catalogue into E01 and drop E03.
- D13 is a new design card (sign-in and the return record shell) and V00 waits for it. Why: RV-53 says every screen is designed and approved first, and no design card covered V00's screens. Reverse: fold the shell into D01's map and let V00 build from D00's sample page.
- B04: the contract defines Returns' own normalised QBO shapes; Intuit's JSON is mapped in one file tested only on fake responses marked `"confirmed": false`. Why: the sandbox check is blocked, so no row shape is confirmed. Reverse: model the contract on Intuit's report JSON once the sandbox answers.
- B04: a transaction with no QBO id gets a composite key (date, type, number, account, cents) marked `idKind: "composite"` and flagged by B05; an unknown report column is refused. Why: TB-10 needs an id and ids in report rows are unconfirmed; a flag rather than a silent pass. Reverse: refuse any row without an id.
- B04: three engines, `samples` (default), `sandbox` (Intuit's sandbox host only, off, no key) and `live` (off until go-live); limits 10 a second, 500 a minute, 60 s wait on a 429, 3 retries. Why: ARC-6 names sandbox companies as a free stand-in and the research's confirmed limits. Reverse: one `live` engine with a host setting.
- B04 writes `testworld/qbo/export.ts` (and B01 `testworld/qbo/gfi.ts`) to make stand-in folders from the answer keys, since the sample `qbo/` files hold bank lines only. Why: the trial balance, coding and adjusting entries live in the answer key; nothing under `src/` may import `testworld/`. Reverse: commit stand-in folders under `reference/sample-clients/<client>/qbo/`.
- B05: an adjusting entry is a QBO journal entry whose memo starts `AJE` or whose Adjustment flag is set; type, reason and sources are read from the memo `AJE <type>: <reason> | source: <pointer>[; <pointer>]`; a written reason alone is not a source; other journal entries in the last month or after year end are flagged. Why: QBO has no type or source field, and TB-2 needs all three. Reverse: a separate sourcing screen in Returns for each entry.
- B05: opening retained earnings are checked against the prior year-end QBO trial balance (retained earnings plus that year's net income); first year must be zero; otherwise "opening not checked: no evidence" until B03 adds last year's filed 3849. Why: TB-5 with only QBO data in B05. Reverse: refuse when no prior source exists.
- B01: the .GFI layout is data (`data/gifi/gfi-layout.json`, account-level, unconfirmed); a totals-only file is refused. Why: research open point 1; TB-3 needs account-level mapping. Reverse: route (b) of the research, our own account-to-GIFI table with the .GFI as a cross-check.
- B01: a difference of twice the file amount is reported "sign reversed?"; last-year mapping compared only when Returns holds one, else "not checked: no prior mapping". Why: research open point 5 and no prior mapping before go-live. Reverse: drop the hint.
- B03 adds the rule `prior-return-agrees-assessment` to `data/ledger/agree-rules.json` (its paths include the file). Why: TB-8 "until tied" needs a written agree rule (EV-13). Reverse: L01 ships the rule.
- B07: 3-day date window (cards: transaction or posting date, either way), exact cents, accounts paired by last four digits and currency, nearest-date one-to-one matching with fixed tie-breaks, rules in `data/books/match-rules.json`. Why: deterministic matching that catches C10's planted faults. Reverse: other windows or pairing rules in the data file.
- G00: required facts in `data/gaps/required.json` with a `needs` level (document, third party, any); `weak` means all facts suspect or client-said only where a document is needed; `signAndSend` lives in G00 and V08 calls it. Why: AI-12 says code decides, and FLOW-2 and FLOW-3 need one place that moves gaps to qa. Reverse: put sending in V08.
- G01: ids `Q-<TOPIC>-<nnn>`, never reused; the no-sentence lint refuses final punctuation, "you" or "your", and labels over 60 characters. Why: RULE-19 and END-7. Reverse: a looser lint.
- I00: SIN-shaped numbers are masked whatever their check digit; account numbers are 7 to 19 digit runs next to account words or values of sensitive keys; redacted page images are stored write-once keyed by original hash plus redactor version. Why: a flag rather than a silent pass, and V01 reuses the masked images. Reverse: mask only valid SINs.
- V01 depends on I00 and serves only masked page images, masked on first open and cached; the 1 s test measures a first open. Why: SEC-4 on every screen with one masking code path. Reverse: mask at intake as a job in E00.
- V05 depends on G00 and B05 to show blockers; V08 on V01 and G02; V14 on B01, B03 and B05 and shows only the statements and GIFI section. Why: phase 1 has no Taxprep figures, and rule 16 bans placeholders for later sections. Reverse: V14 on made-up fixture figures only.
- U01 and U02 depend on D01 (the shortcut list and the route map); U02 also on JH0 for the shared axe fixture and the kinds. Why: one list and one map for every screen. Reverse: lists inside each card.
- Tags: E03, E01, B01, B03, B05, B07, G00, G02 core; B04 and I00 core and security; U02, V00, V01 security; G01, U01, V05, V08, V14 none beyond screens. Reverse: change the tags.

## For the Lead

1. The .GFI layout is the biggest unknown: if the real Workpapers file holds GIFI totals only, TB-3 ("a GIFI figure equals the sum of its mapped accounts", account-level flags) cannot be met from the file, and README item 2's "QBO makes the GIFI mapping" would need the research's route (b). Getting one real .GFI needs a made-up company in the firm's QBOA (research open point 3), which is red and Zo's. Worth a to-do question before B01 is spec'd.
2. When the QBO sandbox check succeeds, add a small card to replace B04's `unconfirmed` fake responses with recorded sandbox responses and settle whether report rows carry ids (B04 says how).
3. The `AJE` memo convention (B05) is a working practice for whoever books adjusting entries in QBO; it belongs in the trial plan or a staff note once Zo agrees with it (not client wording).
4. No phase 1 screen uploads the .GFI file; B01 is tested through its function. The round-trip checklist (V06, phase 2) or a books tab should own the upload; D05's brief should mention it.
5. Shared files, so these run one after another: `src/modules/books/index.ts` (B05, B01, B03, B07), `src/modules/gaps/index.ts` (G01, G00, G02), `src/modules/ai/index.ts` (A04, I00), `data/ledger/agree-rules.json` (L01, B03), `db/schema/30_books.sql` (F01, B05), the skeleton files (E01 with T01, M00, T04, Q00).
6. E03's catalogue must cover the keys E10 to E25 read; the extractor family cards do not list the catalogue in their paths. If a reader needs a new key, either E03 is extended first or the family template should add `data/facts/catalogue.json` to their paths (they would then run one after another).
7. Before phase 1's spec jobs, the loop wants an independent worker to review the phase 1 cards against the blueprint; this batch is ready for it.

## Red

None. Nothing costs money (the QBO sandbox and live engines are off with no key), nothing touches live data or the client app, and no card carries client wording (G01's lint refuses it). The real .GFI question in "For the Lead" 1 would become red only if the Lead asks Zo to use the firm's QBOA.
