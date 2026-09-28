# 0006: Blueprint v1 (28 September 2026)

Status: PROPOSED. In force when Zo replies "blueprint ok" (recorded in a new decision quoting him). Never edit: supersede.

Blueprint v1 is Zo's design of 28 Sep (`reference/design-2026-09-28.md`) plus these fixes from its review (`reference/design-review-2026-09-28.html`), folded in as the Lead's recommendations:

1. Four exports prove every round trip, with a token, identity checks, natural keys for repeating rows, changed-cells-only re-imports and fixed export settings (RT-1 to RT-13).
2. Two gates: the filed return must equal the approved return (RT-19).
3. A working trial balance with adjusting entries between facts and figures (TB-1 to TB-9).
4. Judgment inputs made in our app; no AI guessing sources for orphans (TB-6, RT-16).
5. Ties separated from reconciliations; only unexplained remainders raise exceptions (CK-3, CK-4).
6. Full review enforced by a coverage tracker (RV-5).
7. Evidence graded by who made it; exceptions shown apart from the dot (EV-10 to EV-13).
8. AI grounding checked by code; omissions kept; a different model for the red team; AI never clears (AI-1 to AI-11).
9. Learning loop attribution by cell owner and code cause rules (LL-2 to LL-4).
10. Contracts pinned before parallel building; jobs off the web path (ARC-3 to ARC-7).
11. Errors fixed: the calculated-lines export (RT-10), the retained earnings formula (CK-11), the passive income test (CK-36), payroll against T4 Summaries (CK-23), the shareholder loan series test (CK-31), converted values (TB-8), client text out of AI (AI-12, RULE-19).
12. Added: tax pool continuity (CK-12), Schedule 1 ties (CK-15), specified investment business (CK-34), foreign reporting and slips (CK-37, CK-38), the associated group check (CK-19), due dates (FLOW-7), late evidence (FLOW-6), follow-ups after assessment (FLOW-8), spreadsheets read directly (EV-14), image redaction (AI-9), file holds (FLOW-10).
13. Client-facing parts stay in the client app; this system shares its database at go-live in its own schema (ARC-2).
