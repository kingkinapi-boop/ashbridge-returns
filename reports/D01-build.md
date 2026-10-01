# D01 build report (cloud-a33104)

Branch claude/D01. Files: design/map/screens.md (29 screens), design/map/navigation.md (service navigation by role, identity bar, Back, 90 links, entry points, 14 shortcuts, Mermaid flow). Scope clean.
Acceptance tests: 19 of 19 pass (`npx vitest run design/map`). The spec file is untouched. Typecheck and lint do not apply: this branch has no package.json (F00 not on main yet).

Ambers:
- Shared screens (Sign in, Today, Search results, Return overview, Source viewer) link only to shared screens, because the test rejects a link a role cannot open; each role reaches its queue through the service navigation and the Entry points table.
- Source viewer lists no `review` state and is seen by ops, because the test bars ops from review screens; the CPA reaches it from the Three-pane view.
- Shortcuts: n m o r a on Full return; n p m o c r on Three-pane view; ] and [ on Source viewer; s everywhere. None uses a modifier or a reserved key. Reverse: edit the Shortcuts table.
- Return brief, Full return, Three-pane view, Comment, Rework changes and Approve are separate screens (Zo's separate-tabs rule); merge rows if the D02 design chooses fewer.

Permission gaps: none. Model: Sonnet 5.5.
