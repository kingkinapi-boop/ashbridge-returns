# Phase 1 card review

1 Oct 2026. Independent reviewer (wrote none of these cards). Read: CLAUDE.md, `.claude/rules/testing.md`, `.claude/rules/staff-screens.md`, `blueprint/README.md`, blueprint 02, 03, 05 (AI), 06, 08, 09 and the cited clauses, `plan/slices.json`, every written phase 1 card, the design, extract, render, kind, question and journey families, `reports/cards-phase1a.md`, `-1b.md`, `-1c.md`, `reports/review-phase0.md`, `reference/taxprep/day1-findings.md`. Branch `claude/review-phase1`.

Every phase 1 card serves the plain end state v1.1 (items 2, 3, 5, 6, 9, 10, 11, 12). Every cited clause exists. Nothing is above L. No dependency cycle; no phase 1 card depends on a later phase or a parked card (B00 and B02 are parked and nothing live waits on them). Card headers and `slices.json` agree on deps, paths, clauses and size. Every acceptance check now carries a clause ID, and every clause on a card is tested by one of its checks (a script read every card). Every V card waits for its design card (V00 D13, V01 D03, V05 D04, V08 D07, V14 D02), and U00 waits for Zo's approval of D00.

## Per card

| Card | Verdict | Fixes made |
|---|---|---|
| F02 | Fixed | FLOW-3 and FLOW-12 were cited but untested: new check 6 (waiting flag is dated, state unchanged); check 4 names FLOW-12, check 3 FLOW-4. Tagged core (CRA due dates, voiding approval). |
| F06 | Fixed | A04's Lead note gives `ai:*` jobs a 24-hour lease "set per job kind in F06's queue", but F06 had no way to do it: a handler may now name its own lease; new check 11. |
| F07 | Fixed | B05 (first-year opening check) and B07 (bank-only clients) read facts from the bridge that F07 did not supply: each return now carries its incorporation date and a books source (`firm-books` or `client-qbo`, unclear goes to ops), new check 5. ARC-2 was untested: new check 8 (hand-off table in `returns`, RLS on, no free-text column). Clause IDs on checks 6, 7. Tagged security. |
| F10 | Fixed | The step order had no place for the gap pass, so the phase 1 journeys could not run "gaps are right": added a `gaps` step (ten steps, eight placeholders). Noted that E02 replaces the `read` step once E00 reads at intake, and that B03 and B07 extend `books.ts` and G02 extends `gaps.ts`. |
| W20 | Fixed | Check 9 tagged ARC-18 (added to clauses). |
| A02 | Fixed | Clause IDs on checks 4 and 9. |
| A03 | OK | None. |
| A04 | Fixed | New check 11 for the Lead note (24-hour lease; a late result accepted only when its input hash matches). |
| A05 | OK | None. |
| A06 | OK | None. |
| A07 | Fixed | Clause ID on check 9. |
| A08 | Fixed | Check 12 tests AI-4 to AI-7 sections in `ORDERS.md` but they were not on the card: added. Clause ID on check 10. |
| D00 | Fixed | Clause IDs on checks 2 and 5; design range now D02 to D13. |
| D01 | Fixed | No check had a clause ID and RV-1, RV-20, RV-30, RV-40, RV-50 were untested by name: IDs added; SEC-2 and RV-51 added (checks 3 and 5 test them). Stale "nine design cards and twelve screen cards" removed. |
| D02, D03, D04, D07, D13 | OK | Design family; family text now names D02 to D13 (D13 is new). |
| U00 | OK | Design range wording only. |
| U01 | OK | None. |
| U02 | OK | None. |
| L00 | Fixed | Clause ID on check 9 (EV-1). |
| L01 | Fixed | Clause ID on check 6 (EV-11). |
| E03 | Fixed | Check 2 tested `suppliedBy` against E02's `kinds.json`, but E03 runs early (deps F00) and E02 runs late (after E00): it could not be specified. E03 now owns `DOCUMENT_KINDS` in `src/contracts/facts.ts`; E02 must use exactly those ids. Clause ID on check 5. |
| E00 | Fixed | Checks cited EV-14 and RV-4 and had two without IDs: EV-14, RV-4 and SEC-4 (no document words in logs) added; IDs on checks 6 and 10. |
| E02 | Fixed | Dep on E03 added; check 6 now requires `kinds.json` ids to equal `DOCUMENT_KINDS`. E02 now owns `src/pipeline/steps/read.ts` (split and classify; no second read), since E00 already reads at intake and F10's `read` step would otherwise read twice; new checks 8 and 9 (skeleton fixture page still classifies and SK0 still passes). ARC-10 added (check 7 tested it). |
| E01 | Fixed | Clause IDs on checks 7 and 9. |
| E10 to E25 | OK | Extract family; acceptance checks are specific. |
| W01 to W13 | OK with an issue | See bigger issue 1 (new sample clients). |
| W21 to W38 | OK | Render family. |
| B04 | Fixed | Clause ID on check 10. |
| B05 | Fixed | Dep on F07 (incorporation date); TB-10 added (check 8 tests it); IDs on checks 8 and 9. |
| B01 | Fixed | IDs on checks 7 and 8. Upload owner recorded on D05 and V06 (see bigger issue 2). |
| B03 | Fixed | Now extends the books step (path `src/pipeline/steps/books.ts`), new check 7; IDs on checks 5 and 6. |
| B07 | Fixed | "Bank-only" now reads F07's books source (dep F07 added); runs inside the books step, new check 8; ARC-10 added; IDs on checks 6 and 7. |
| G01 | Fixed | ID on check 5. |
| G00 | Fixed | Owns `src/pipeline/steps/gaps.ts` (dep F10), new check 8; EV-8 was untested: check 2 now also proves no fact status changes; FLOW-10 added (check 5 tests it); IDs on checks 6 and 7. |
| G02 | Fixed | Adds the slot fill to the gaps step, new check 8; ID on check 7. |
| G10 to G17 | OK | Question family. |
| I00 | Fixed | Return-cell citations need return versions, which arrive in phase 2: checked through a versions contract passed in, with a typed fake until then. ID on check 10. |
| V00 | OK | None. |
| V01 | Fixed | SEC-2 added; EV-5, EV-14 and ARC-11 were untested by name: IDs on checks 1, 3 and 7. |
| V05 | Fixed | Shows "documents flagged for a person" (E02) as a blocker without depending on E02: dep added. SEC-2 added; ID on check 6. |
| V08 | Fixed | FLOW-10 added (check 6 tests it). |
| V14 | Fixed | SEC-2 added; EV-11 named on check 2. |
| J2-K01 to J2-K13 | Fixed (family) | Journey family's evidence stage now says which steps run, that the .GFI stand-in is uploaded through B01's `importGfi`, that GIFI totals must trace to accounts, and that this is the phase 1 gate (at least ten kinds green). |

Tools after the fixes: `node tools/status.mjs` shows done 2, carded 232, to write 37, parked 13 of 284. `node tools/next.mjs 12` starts F00 and D01. `node tools/matrix.mjs --plan` gives PLAN OK. `plan/MATRIX.md` was generated and is not committed.

## Bigger issues for the Lead

1. **Four new sample clients have no owner.** Blueprint 00 says K1, K5, K6 and K13 start from "new" sample clients; the kind family says they are needed "there first" (`reference/sample-clients/`), and W00 excludes any change to that folder. W01, W05, W06 and W13 list only `testworld/kinds/K0n/**`. Without them, only nine kinds (ten returns, counting K7b) can pass, which is the bare minimum for the gate. Card one small job (a worker extends `reference/sample-clients/generate.mjs` with clients 11 to 14 and their checks) before W01, W05, W06 and W13, or allow those kind cards to build the new client inside `testworld/kinds/` (ARC-8 says extend, never a second set).
2. **The .GFI upload screen.** No phase 1 screen uploads the .GFI; B01 is reached through its function and the journeys use it the same way. I put notes on D05 (design brief must include the upload) and V06 (owns the screen) in `slices.json`. Separately, the real .GFI layout is still unknown and getting one needs a made-up company in the firm's QBOA (red, Zo's, per batch c). Ask before B01 is spec'd or accept that B01 lands on the assumed layout.
3. **Pipeline step order changed** (amber below). JH0's harness reads the order from `src/pipeline/order.ts`, so nothing else moves, but the shared files now run in a fixed sequence: `books.ts` (B05, then B03, B07), `gaps.ts` (G00, then G02), `read.ts` (F10, then E02). They already share module index files, so no new serialisation.
4. **Taxprep day 1 findings touch no phase 1 card.** They change phase 0 cards (F03 golden and header, S00 header and description column, RT-3, RT-9, RT-21 clause edits) and phase 2 (M00, the schedule family). A07 already reads Windows-1252 and CRLF for client files. Make those edits before F03 and S00 are spec'd.
5. **B03's "amalgamation or wind-up marked in the bridge data"** has no field in `reference/onboarding-contract.md`. The B03 test uses a typed fixture; when the bridge has no such mark, the flag cannot fire in real use. Decide whether ops records it (an ops-confirms item in F07) when the ops screens are carded.
6. **The gaps step with AI.** In real use G02's slot fill is an `ai:` job answered by a person running `npm run ai:once` (A08), so the gaps step can wait hours; with the 24-hour lease that is safe, but the preparer queue (V05) should show "waiting on AI run" as a blocker when the ops screens are carded.
7. **E00 is the widest card** (L, nine deps, ten checks, the timing check in the cloud). It is within L, but if its spec job runs long, split page images (ARC-11, the 200 ms check) into its own S card.

## Red

None. Nothing costs money (A08 runs on the subscription per decision 0008 Z8-11; QBO sandbox and live engines stay off with no key), nothing touches live data or the client app, nothing changes who sees what beyond SEC-2 as written, no real client data, and no client wording (G01's lint refuses sentences). Bigger issue 2's real .GFI would become red only if the Lead asks Zo to use the firm's QBOA.

## Ambers

- F10 adds a `gaps` step after `books` (ten steps, eight placeholders); G00 owns `gaps.ts`, G02 extends it. Why: the phase 1 journeys must prove "gaps are right" and the harness runs only pipeline steps. Reverse: drop the step and let the journeys call G00 directly.
- E02 owns the `read` pipeline step (split and classify on the stored reading), since E00 reads at intake. Why: F10's `read` step would read every document twice. Reverse: keep reading in `read` and drop reading from intake (against ARC-11).
- B03 and B07 run inside B05's `books` step. Why: one step per pipeline stage, and their inputs (facts, snapshots) are ready by then. Reverse: separate `prior` and `bankmatch` steps.
- E03 owns `DOCUMENT_KINDS`; E02's `kinds.json` must use exactly those ids, and E02 depends on E03. Why: E03 runs early and could not test against a file E02 writes late. Reverse: E03 depends on E02.
- F06 handlers may name their own lease; `ai:*` handlers name 24 hours. Why: A04's Lead note had no mechanism in F06. Reverse: a separate "waiting on project" job status.
- F07 gives each return its incorporation date and a books source (`firm-books`, `client-qbo`, unclear to ops), from the bookkeeping service line. Why: B05's first-year check and B07's bank-only rule read them, and no card supplied them. Reverse: pass them in from test fixtures only and card a bridge field later.
- F02 tagged core; F07 tagged security. Why: CRA due dates and voiding approval; F07 decides which client-app fields enter Returns. Reverse: remove the tags.
- Clauses added to cards whose checks already tested them: SEC-2 (D01, V01, V05, V14), FLOW-10 (G00, V08), TB-10 (B05), ARC-10 (B07, E02), ARC-18 (W20), RV-51 (D01), AI-4 to AI-7 (A08), EV-14, RV-4 and SEC-4 (E00). Why: every test names a clause on its card. Reverse: drop the IDs from those checks instead.
- Notes on D05 and V06 in `slices.json`: the .GFI upload belongs to the round-trip checklist. Why: no screen owned it. Reverse: a books tab card instead.
- The journey family's evidence stage defines the phase 1 gate as at least ten kinds green with every GIFI total traced to its accounts. Why: "10 test files fully traced to source" had no test that measured it. Reverse: a separate gate journey.
