# F02 check (cloud-f10790, 2 Oct 2026): PASS

Head fa6d1d8 (6 commits behind main). typecheck, lint, deps:check clean; npm test unit 1721 and db 427 pass; scope OK (13 files); spec files unchanged since the last spec commit; mutate:canary ok; mutate:changed F02 score 100 (225 killed, 0 survived).
Opus adversarial read: no breach of the move table, FLOW-1/3/7/12, blank refusal or transactions. Notes for the Lead (none fails an acceptance check):
1. voidApproval writes an event only; the approval itself is not marked void and ApprovalFingerprintSource.current() cannot report a void (index.ts:96-101). A void return moved back to approved could read a stale approval. Put on T06 / RT-19 card.
2. Balance due uses min(day, last day), so 30 Jun year end gives 30 Aug, 28 Feb gives 28 Apr (dates.ts:34). Ambered on Interpretation Act s.28; the CPA should confirm against T4012.
3. A throwing guard makes move() reject rather than return {ok:false} (index.ts:72); nothing is written.
4. move() does not check the hold holder (FLOW-10); the card only asks that take be refused.
5. Evidence change after filed or assessed returns voided:false with a reason; no test or amber says so.
Permission gaps: none. Model: Sonnet 5.5 plus an Opus 5.5 read.
