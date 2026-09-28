---
name: blueprint-change
description: How a blueprint clause is added, changed or removed - only with Zo's yes. Use when a red question needs a blueprint change, or ten ambers pile up on one blueprint file.
---

# Changing the blueprint

1. Propose in TODO-ZO section 1: the clause IDs, the change in one or two plain sentences, why, what it costs in build work, your recommendation, "Reply N yes". Park only the cards that depend on those clauses.
2. After Zo's yes: edit the blueprint files; raise the version in `blueprint/README.md` (v1 to v1.1); write `decisions/NNNN-<name>.md` quoting Zo's words; update the cards and tests that cite those clauses (`node tools/matrix.mjs` shows which tests cite them).
3. Never renumber a clause. A removed clause stays as `- **RT-9** (removed in v1.2, decision 0009)`. A new clause takes the next free number in its prefix.
4. After "blueprint ok" on v1, write the decision that puts 0006 in force (quote Zo), and set `"blueprint": "v1"` in `plan/slices.json`.
