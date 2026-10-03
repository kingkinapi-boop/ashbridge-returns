# SC10 build (cloud-ddf73a, 3 Oct): BLOCKED, spec has 3 stale KNOWN entries

- Branch claude/SC10 at 0d26289a plus main merged. Test run: tools/test/card-rules.test.mjs 26 of 27 pass.
- The one failure, "ARC-15 R85 on every card in plan/slices.json": three KNOWN entries are stale because main fixed those flags after the spec: F00T (slices core true now, Tags say core), V10 (core false, Tags say security), SC3 (core false, Tags say security). The test says "remove it".
- The fix is in the spec file (delete the three R85 entries from KNOWN in tools/test/card-rules.test.mjs), which a builder must not edit. No product or data change is needed: data/lifecycle/unbuilt-guards.json already exists in the spec commit, and R86 (FX7) and R89 pass.
- Needs: reopen the SC10 spec for a patch (drop those 3 entries, re-check the others against live slices.json), then a build round that only runs the tests.
- Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
