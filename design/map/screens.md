# Staff screen map

One row per staff screen (card D01). Every screen is staff only (SEC-1). Format: `FORMAT.md`. Roles follow SEC-2: a preparer sees only the returns assigned to them, ops sees ops work, the CPA and the owner see everything. Lifecycle states are those of blueprint 02; `none` means the screen is not tied to a state. Addresses use `{returnId}`, `{section}`, `{line}`, `{sourceId}` and `{itemId}` as made-up ids in the test world.

| Name | Address | Roles | Lifecycle states | Clauses | Screen states | Pattern |
| --- | --- | --- | --- | --- | --- | --- |
| Sign in | /sign-in | preparer (assigned only), ops, cpa, owner | none | SEC-1, RV-50, RV-54 | empty, error | Question page; text input and password input; GOV.UK error summary; paste and password managers allowed |
| Two-step code | /sign-in/code | preparer (assigned only), ops, cpa, owner | none | SEC-1, RV-50, RV-54 | empty, error | Question page; numeric text input with autocomplete one-time-code; error summary |
| Today | /today | preparer (assigned only), ops, cpa, owner | none | RV-50, RV-51, FLOW-7 | empty, normal | Service navigation by role; summary list of the role's counts; table of what is due next with MOJ contextual dates |
| Search results | /search | preparer (assigned only), ops, cpa, owner | none | RV-50, RV-51, SEC-2 | empty, normal | MOJ search and sortable table; one match opens the return directly; the preparer sees only assigned returns |
| Return overview | /returns/{returnId} | preparer (assigned only), ops, cpa, owner | none | RV-50, FLOW-1, FLOW-5, FLOW-7, FLOW-9, SEC-2 | normal, flagged, approved, void | MOJ identity bar; MOJ alert for approval void; summary list of state, due dates and holder; MOJ timeline of events; closed returns read-only |
| Source viewer | /returns/{returnId}/sources/{sourceId} | preparer (assigned only), ops, cpa, owner | evidence, gaps, trace, respond, rework | RV-4, RV-53, SEC-3, SEC-4 | empty, normal, error | One viewer for every source; labelled region; page image with the figure boxed and a text caption; Previous and Next buttons; opens beside the work and in a second window |
| Preparer queue | /queue | preparer (assigned only), cpa, owner | gaps, prepare, trace, respond, rework | RV-20, FLOW-7, FLOW-10, SEC-2 | empty, normal, flagged | MOJ sortable table by due date; state and tier tags; Blocked by and Held by columns; MOJ filter and pagination once a list outgrows a screen |
| Gap review | /returns/{returnId}/gaps | preparer (assigned only), cpa, owner | gaps | RV-23, RV-50 | empty, normal, error, approved | Summary card per draft question; small radios Keep, Edit slot values, Merge, Drop with conditional reveals; add from the bank with a select; MOJ confirm an action to sign |
| Round trip checklist | /returns/{returnId}/round-trip | preparer (assigned only), cpa, owner | prepare, trace | RV-21, RV-22, RV-50 | normal, error, flagged | GOV.UK task list with Completed, Incomplete and Cannot start yet; file upload page per upload; summary list of what each export proved |
| Judgment inputs | /returns/{returnId}/judgment | preparer (assigned only), cpa, owner | prepare | RV-22, RV-50 | empty, normal, error | One page per kind of choice; fieldset per item; text input with dollar prefix; required Reason; MOJ add another; summary list before lock |
| Exceptions and orphans | /returns/{returnId}/exceptions | preparer (assigned only), cpa, owner | trace, respond | RV-24, RV-22, RV-50 | empty, normal, error, flagged | Table, red first then dollar effect; answer radios Fixed, Explained, Accepted risk with reveals; class tags with a Cite link; the refusal as a GOV.UK error message |
| Cite source or reason | /returns/{returnId}/cite/{itemId} | preparer (assigned only), cpa, owner | trace, respond | RV-22, RT-16, RV-50 | empty, error | Question page; radios Document box, Answer, Written reason with none preselected; text area; error summary |
| CPA comments | /returns/{returnId}/comments | preparer (assigned only), cpa, owner | rework | RV-25, RV-7, RV-12, RV-50 | empty, normal, error | One h2 per topic; summary card per comment with type and severity tags; AI draft fix shown with citations and approved by the preparer before anything changes |
| CPA queue | /review | cpa, owner | review | RV-8, FLOW-7, RV-50 | empty, normal, flagged | MOJ sortable table by tier then due date; tier tag with words; Back returns with filter and sort kept |
| Return brief | /returns/{returnId}/review | cpa, owner | review | RV-1, RV-2, RV-8, RV-50 | normal, flagged, void | Tables with numeric cells for the six numbers against last year; tier tag with a details Why this tier; pinned flags table, red first; summary lists for assumptions and attestations |
| Full return | /returns/{returnId}/review/{section} | cpa, owner | review | RV-1, RV-3, RV-5, RV-6, RV-8, RV-9, RV-10 | normal, flagged, error, approved, void | One h2 and one table per section in fixed order; every number a link with its own address; MOJ side navigation as the coverage tracker; no tabs or accordions; Approve link only when every section is marked |
| Three-pane view | /returns/{returnId}/review/{section}/{line} | cpa, owner | review | RV-4, RV-3, RV-6, RV-11, RV-53 | normal, flagged, error | Wide container; return, trace and source panes each a labelled region; trace as summary list, source table and MOJ timeline; ARIA window splitter; panes stack at narrow widths |
| Comment on a number | /returns/{returnId}/review/{section}/{line}/comment | cpa, owner | review | RV-7, RV-50 | empty, error | Small radios for type and severity; text area; Send to preparer; GOV.UK error summary |
| Rework changes | /returns/{returnId}/review/changes | cpa, owner | review | RV-7, FLOW-5, RV-50 | empty, normal, void | Table of changed cells only with Before and After columns; sections whose marks came off listed as links |
| Approve return | /returns/{returnId}/review/approve | cpa, owner | review | RV-5, RV-10, RV-11, FLOW-4, RV-50 | empty, normal, approved | MOJ confirm an action with a summary list of what is approved; double-click prevention; one success banner; unmarked sections listed as links when any remain |
| Ops queue | /ops | ops, cpa, owner | approved, ready_to_file, filed | RV-30, FLOW-7, RV-50 | empty, normal, flagged | MOJ sortable table of ops work by state and due date; MOJ filter |
| New returns | /ops/new | ops, cpa, owner | intake, evidence | RV-30, RV-50 | empty, normal | MOJ sortable table of returns created from client-app data |
| CRA data capture | /ops/returns/{returnId}/cra | ops, cpa, owner | evidence | RV-30, RV-50 | empty, normal, error | GOV.UK task list per return; file upload page for the saved PDF; summary list of facts read |
| T183CORP | /ops/returns/{returnId}/t183corp | ops, cpa, owner | approved | RV-30, RV-50 | empty, normal, error, approved | File upload page for the signed certificate; summary list of what was sent and when |
| Check export upload | /ops/returns/{returnId}/check-export | ops, cpa, owner | ready_to_file | RV-30, FLOW-5, RV-50 | empty, error, flagged | File upload page; summary list of the result; a mismatch uses an interruption panel listing the changed cells |
| Filing confirmation | /ops/returns/{returnId}/filing | ops, cpa, owner | ready_to_file | RV-30, RV-50 | empty, normal, error | Text input for the confirmation number; summary list of the transmit details; error summary |
| Notice of assessment | /ops/returns/{returnId}/notice | ops, cpa, owner | filed | RV-30, FLOW-8, RV-50 | empty, normal, error, flagged | File upload page; summary list comparing the notice with the filed return; follow-up item when they differ |
| Pipeline | /board | cpa, owner | none | RV-40, FLOW-7, RV-50 | empty, normal | Table by state in lifecycle order with due-date bands |
| Weekly lessons | /board/lessons | cpa, owner | none | RV-40, RV-50 | empty, normal | MOJ sortable table of the weekly lesson list |
| Measures | /board/measures | cpa, owner | none | RV-40, RV-50 | empty, normal | MOJ numeric data with a table first; any chart comes with its table |

## Every screen

RV-50: staff only; every screen names the return (corporation and year end) through the identity bar; no dead button, no filler text, no unexplained field. RV-51: built for many returns a day, dense, fast and keyboard first. RV-52: built from GOV.UK Frontend and MOJ Frontend parts through our thin React layer; where no pattern exists (the three-pane view, shortcuts, the coverage tracker) the screen is composed from their parts and the design notes give the reason. RV-53: every screen is designed first as static pages with made-up data and approved by Zo before it is built. RV-54: WCAG 2.2 AA, every action by keyboard alone, focus always visible. RV-55: the Ashbridge Tax brand through GOV.UK Frontend settings, with no GOV.UK branding.

Every screen carries the GOV.UK skip link, the Generic header, the service navigation for the signed-in role and, on every return screen, the identity bar (navigation.md). The screen states worth designing are empty, normal, error, flagged, approved and void; a screen lists only the ones that can happen on it.

## Notes

- The return record is one shell for every role (identity bar plus record tabs); a family fills a tab and never adds its own tab set.
- Screens in the Preparer group are also seen by the CPA and the owner, who see everything; the preparer sees them only for assigned returns.
- Ops screens are never shown to a preparer. The pipeline, weekly lessons and measures are shown only to the owner and the CPA.
- The CPA review screens are not shown to ops or to a preparer. The preparer sees the CPA's comments (CPA comments) and, after rework, the cells the CPA will see again.
- States acted on by the system or the client (intake, qa, build, client_sign, assessed) have no staff action screen; their results show on Return overview.
