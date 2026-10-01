# slices.json re-cut into Zo's five phases (v1.1)

1 Oct 2026. Helper for the Lead, branch `claude/slices-v1-1`, rebased on main after the clauses-research landing (CK-48 to CK-50, CK-13 as a reconciliation, AI-2 rewritten). Sources: blueprint/README.md v1.1, decisions 0008 and 0009, reports/clauses-v1-1.md, reports/clauses-research.md, plan/AMBER.md (A28 to A43, A71, A72), the plan audit of 29 Sep, plan/taxprep-trial-plan.md.

## Result

`phases` renamed: 0 prove reality; 1 evidence and the source viewer; 2 return build, lock and trace; 3 checks and the CPA review; 4 learning list and sign-off. `blueprint` field now "v1.1". F00 is the first card in the file. Cards are ordered by phase (claim.mjs takes the first eligible card in file order). 255 cards became 279: 24 added, 14 parked, none deleted.

| Phase | done | carded | todo | parked | total |
|---|---|---|---|---|---|
| 0 | 1 | 6 | 9 | 3 | 19 |
| 1 | 0 | 76 | 29 | 2 | 107 |
| 2 | 0 | 30 | 9 | 3 | 42 |
| 3 | 0 | 65 | 13 | 6 | 84 |
| 4 | 0 | 12 | 15 | 0 | 27 |
| all | 1 | 189 | 75 | 14 | 279 |

Proof the tools still read it: `node tools/status.mjs` (done 1, carded 189, to write 75, parked 14 of 279); `node tools/next.mjs 12` (below); `node tools/claim.mjs list` ("no claims"); `node tools/matrix.mjs --summary --plan` "PLAN OK: every testable clause has a card, every card cites known clauses" (195 testable clauses; `--summary` so it wrote no MATRIX.md). My own check: no unknown dep, no cycle, no card depends on a card in a later phase, no live card depends on a parked v1.1 card, and every screen card depends on a design card. No clause is cited only by parked cards.

## Parked (status "parked", with a note)

| Card | Why | Replaced by |
|---|---|---|
| B00 Books core | No working trial balance or bookkeeping in Returns (A28); judgment inputs are typed in Taxprep and cited (A32) | B04, B05 |
| B02 Bank-only categorised lines | Categorising is bookkeeping, done in QBO (A28, OUT-7) | B07 |
| T03 Receipt check | Receipt export and RT-6 dropped (A30) | T04 (the "dropped" class) |
| T06 Fingerprint, two gates, binder | Gate 1 and the baseline and receipt exports dropped (A30) | T08, T09, T10 |
| V07 Judgment input sheet | No sheet in our app (A32) | V12 |
| D06 Design: judgment input sheet | Same (A32) | D12 |
| I20 AI checklist: next year's instalments | Now code (A40) | Q46 |
| Q33 CK-33 bonus unpaid | CK-33 removed (A39) | Q47 |
| I14 AI checklist: salary, dividends, slips | AI-2 no longer repeats what code flags (A72) | Q38 |
| I17 AI checklist: PSB signs | Same (A72) | Q35 |
| I18 AI checklist: capital dividend account | Same (A72) | Q41 |
| P02 Taxprep trial week (new) | Lead-run stream, not a queue job; starts when Zo starts the trial | (the Lead marks it done when FINDINGS.md lands) |
| P03 QBO sandbox companies (new) | Lead-run stream; the Intuit account waits on Zo | (done when reference/qbo/ holds the exports) |
| P04 Queue repairs (new) | Lead-run stream outside the queue; landed on main today (3461afb) | (the Lead can mark it done now) |

T03 and Q33 cite no clauses now (RT-6 and CK-33 are removed; matrix refuses removed IDs); their notes name them. P02 to P04 are "parked" because claim.mjs would hand any carded card to a worker; S03 depends on P02 on purpose, so the simulator waits for the trial findings.

## Added

| Card | Phase | Status | Clauses |
|---|---|---|---|
| P02 Taxprep trial week, FINDINGS.md | 0 | parked | RT-2, RT-23, RT-24 |
| P03 QBO sandbox companies and exports | 0 | parked | TB-1, TB-3, TB-10 |
| P04 Queue repairs | 0 | parked | ARC-19 |
| S03 Simulator: apply the trial findings | 0 | todo | RT-23, RT-2, RT-24 |
| B04 QBO reader: adapter, sample-client stand-in, snapshots | 1 | todo | TB-10, TB-1, ARC-6, ARC-20, OUT-3 |
| B05 Books read from QBO | 1 | todo | TB-1, TB-2, TB-5, TB-7, TB-9, EV-5 |
| B07 Bank-only: match QBO lines to statements | 1 | todo | TB-4 |
| V14 CPA review, early slice | 1 | todo | RV-1, RV-3, RV-4, END-3, RV-53, RV-54 |
| D12 Design: cite button and orphan list | 2 | carded (design) | RV-53, RV-22, RV-24 |
| V12 The cite button | 2 | todo | RV-22, TB-6, RT-16, RT-18, RV-53, RV-54 |
| Q01 Reconciling items: type table as data, item records, $1 rounding | 3 | todo | CK-4, CK-48, CK-49, CK-50 |
| Q43 CK-43 shareholder-loan continuity | 3 | carded (check) | CK-43 |
| Q44 CK-44 CCA additions | 3 | carded (check) | CK-44 |
| Q45 CK-45 income tax provision | 3 | carded (check) | CK-45 |
| Q46 CK-46 next year's instalments | 3 | carded (check) | CK-46 |
| Q47 CK-47 remuneration unpaid after day 180 | 3 | carded (check) | CK-47 |
| I21 AI checklist: large GIFI 9270 | 3 | carded (aicheck) | AI-2, CK-42 |
| I22 AI checklist: shareholder-loan signs code does not catch | 3 | carded (aicheck) | AI-2, CK-42 |
| T08 Approval fingerprint and approval record | 3 | todo | FLOW-4, FLOW-5, RV-11, SEC-7 |
| V13 AI-drafted fixes for simple comments | 3 | todo | RV-12, RV-7, AI-1, AI-7, RV-53, RV-54 |
| B06 Books changed after approval | 4 | todo | TB-11, FLOW-5 |
| T09 The check before transmit | 4 | todo | RT-19, END-4, FLOW-5 |
| T10 Frozen binder and retention | 4 | todo | FLOW-9, SEC-8, RT-11 |
| T11 Approval summary data and T183CORP record | 4 | todo | FLOW-2, FLOW-8, RV-30, SEC-8, END-7 |

CK-48 to CK-50 went on one non-family card (Q01), not three check-family cards: they are rules for every reconciliation (item records, type table, rounding limit), and the check template's "raised on the kind that plants it" does not fit them. Every reconciliation card (Q13, Q20 to Q26, Q44, Q45) now depends on Q01.

## Clauses and titles changed on kept cards
- F01 clauses unchanged (card text edited); F02 + FLOW-12; B01 now TB-3, TB-12 (retitled: GIFI mapping read from the .GFI file); A04 + ARC-22 (retitled: the Claude project job queue, no paid API); T04 + RT-24 (retitled: adds dropped and the roll-forward map); M00 + RT-24; T07 retitled (review lines inside the lock export); V03 + RV-10, RV-11; W09 CK-33 to CK-47 (plus a note: sample client 03's answer key says "day 179 (26 Dec 2025)"; CK-47 means day 180 (27 Dec 2025) is in time; build K9 on day 180 and leave the sample client to the Lead); W08 + CK-43; W11 + CK-44; J5 cards + RV-5, RV-10; J6 + END-4.
- Q13 is now a reconciliation (params kind, path `checks/reconciliations/ck13/`, title).
- Journeys keep their ids but `params.phase` became `params.stage` (evidence, return, checks, screens, learning) and the spec paths follow (`e2e/kinds/K01/evidence.spec.ts`, ...), because the old phase numbers no longer match.
- Card files edited (short): F00, F01, F03, F04, F05, SK0 headers to phase 0; F01 (books read from QBO, TB-2 wording), F02 (FLOW-12), SK0 (no receipt export; lock export with no dropped cell), D00 (dep on F00); families design (D02 to D12; a design card is done only when Zo approves it), check (Q10 to Q47; reconciling types from Q01; firm parameters as data), aicheck (I10 to I19 plus I21, I22; the Claude project, no paid API), journey (stages; no exports 0 to 3 or two gates), kind (starts from its sample client; books as the QBO stand-in serves them), schedule (use the trial's cell map).

## Dependencies changed
- B00 replaced by B05 in B03, T01 and every check (Q10 to Q41); B01 now B05, A07 (no AI proposals); T01 adds B01.
- T03 and T06 removed everywhere: T04 now T01, T02, M00; V06 drops T03; N00 now T04; GL2 now N20, T10; V03 now T08 (and V14); V10 now T09, T11.
- M00 adds S03 (the mapping waits for the trial's cell map). A04 adds F06 (AI jobs are queued jobs, ARC-22). D00 adds F00 (plan audit: it needs `npm ci`).
- Screens on their design cards: V00 now depends on D01 instead of D11 (D11 is no longer a gate; screens wait on their own design); V04 adds D02; V12 on D12; V13 and V14 on D02. V02 adds Q46 (instalments shown in the brief).
- Journeys: J2 drops B02, adds B04, B05, B07; J3 drops T03, T06, adds S01, S03, N00; J4 drops Q33, I14, I17, I18, I20, adds T08, Q01, Q43 to Q47, I21, I22; J5 drops V07, V10, V11, adds V12, V13, V14; J6 adds V10, V11, T09, T10, T11, B06.

## The first jobs next.mjs offers now

`next.mjs 12` offers only 2: START F00 (no spec needed) and START D01 (needs spec first). D00 now waits for F00. After F00 lands: F01, F03, F04, F05, D00, D01. The walking skeleton (SK0) also waits on nine phase 0 cards with no card text yet: F08, F09, W00, S00, S01, S02, S03, A01, JH0. The queue stays thin until the Lead writes those. Phase 1 has 29 more to write; the most urgent are B04, B05, V00, V01, V14, U00, U02, L00, E00, E01.

## Looks red, or close
- Nothing I changed is red by itself. Things to watch:
- T11: the approval summary's wording is client-facing, so it stays in the client app. The card covers data only. The client app side is LIVE-6 (red at go-live).
- B04/B01: reading a real QBO company, or a .GFI from the firm's QBOA Workpapers, touches the firm's account and live data (red; the clauses report says the same). The cards use the sample-client stand-in and sandbox companies only.
- P03 needs Zo's Intuit developer account (already on the to-do), and P02 needs Zo to start the trial. Design cards close only on Zo's approval at a sitting, so every screen card waits on Zo.

## Amber rows the Lead may want to log (not added to AMBER.md)
- Lead-run streams (trial, QBO sandbox, queue repairs) sit in slices.json as parked P02 to P04, so the queue never hands them out. Reverse: drop them from the file.
- D11 (one look at all screens) is no longer a gate. Each screen waits on its own design card, which is done only on Zo's approval at a sitting. Reverse: put D11 back in V00's deps.
- The preparer queue (V05, D04) and the gap review (V08, D07) moved to phase 1, so V08 does not depend on a later phase. Reverse: move V08 to phase 2.
- The mapping (M00, so all of M10 to M23 and the round trip) waits on S03, meaning the trial findings. Reverse: drop S03 from M00 and build on placeholders.
- CK-48 to CK-50 go on one engine-level card (Q01) instead of check-family cards. Reverse: split into three cards.
- Journey params renamed from phase to stage. Reverse: restore the old params and paths.
