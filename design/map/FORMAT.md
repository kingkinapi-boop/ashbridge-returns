# Format the D01 acceptance tests read

`screens.md`: one markdown table with exactly these columns, one row per screen, in this order:
`Name | Address | Roles | Lifecycle states | Clauses | Screen states | Pattern`.
- Roles: comma list from `preparer`, `ops`, `cpa`, `owner`. A preparer entry is written `preparer (assigned only)` (SEC-2).
- Lifecycle states: comma list of state names from blueprint 02 (for example `prepare, trace`), or `none`.
- Clauses: comma list of clause IDs. Screen states: comma list from `empty, normal, error, flagged, approved, void`.
- Below the table, a heading `## Every screen` whose text names RV-50 to RV-55.

`navigation.md`:
- Heading `## Identity bar` naming corporation and year end.
- Heading `## Links`: a table `From | Control | Leads to | Back goes to`; From and Leads to are screen names from screens.md; Back goes to is a screen name.
- Heading `## Entry points`: a table `Role | Screen` (the screens a role lands on or sees in its service navigation).
- Heading `## Shortcuts`: a table `Key | Control it repeats | Screen`; Screen is a screen name or `all`; Control is text that also appears in the Control column of Links.
- A fenced ```mermaid block that names every screen.
