---
name: blueprint-change
description: How the blueprint changes (decision 0008) - the plain end state and approved designs only with Zo's yes; clauses by the Lead as amber, checked by the Critic and the Reviewer. Use for any blueprint edit, when a red question needs an end-state change, or when ten ambers pile up on one blueprint file.
---

# Changing the blueprint

Two layers (decision 0008, Z8-18):
- **The plain end state** (first section of `blueprint/README.md`) and **approved designs**: only with Zo's yes.
- **The numbered clauses** in the other files: the Lead's, kept in line with the plain end state. A clause change is amber.

## A clause change (amber)
1. Edit the clause; add one row to `plan/AMBER.md` naming the clause IDs and why. Tax-rule clauses also go on the list for the CPA's check (decision 0008, B8).
2. Update the cards and tests that cite those clauses (`node tools/matrix.mjs` shows which tests cite them).
3. Never renumber a clause. A removed clause stays as `- **RT-9** (removed in v1.2, amber A31)`. A new clause takes the next free number in its prefix.

## An end-state or design change (red)
1. Propose in TODO-ZO section 1: what changes in one or two plain sentences, why, what it costs in build work, your recommendation, "Reply N yes". Park only the cards that depend on it.
2. After Zo's yes: edit the plain end state or the design; raise the version in `blueprint/README.md`; write `decisions/NNNN-<name>.md` quoting Zo's words; bring the clauses into line as above.
