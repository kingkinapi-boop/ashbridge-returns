# Navigation

The service navigation by role, the identity bar, where each control leads, what Back does and the keyboard shortcuts. Screen names are those in `screens.md`.

## Service navigation by role

The GOV.UK service navigation sits under the header on every screen and shows only what the role may open (SEC-2). Sign out is its last item.

- Preparer: Today, Queue (Preparer queue), Search.
- Ops: Today, Ops work (Ops queue, New returns), Search.
- CPA: Today, Review (CPA queue), Queue, Ops work, Board, Search. The CPA sees everything.
- Owner: Today, Board (Pipeline, Weekly lessons, Measures), Review, Queue, Ops work, Search. The owner sees everything.
- Inside a return, every role sees the same record tabs (Z20-6; the approved record, version A, Z20-1). Each role lands on its own tab: the preparer on Workbench, the CPA on Review, ops on Overview (A387).

## Identity bar

The MOJ identity bar sits on every return screen: the corporation name and year end first, then state and tier as tags with words, the filing due date and balance-due date, who holds the return, and a button menu for the actions that role can take. It is the same on every return screen for every role (RV-50), and an "approval void" alert appears under it when FLOW-5 applies.

## Back

Back always returns to the list you came from, with its filter, sort and scroll kept (staff-screens rule 21). Next and previous follow that list. Opening a source adds no history entry, so Back skips it. A save or an action stays on the list, moves focus to the result or next row and announces it. The Back column below names the usual screen.

## Links

| From | Control | Leads to | Back goes to |
| --- | --- | --- | --- |
| Sign in | Continue | Two-step code | Sign in |
| Two-step code | Verify | Today | Sign in |
| Today | Search | Search results | Today |
| Today | Open return | Return overview | Today |
| Today | Sign out | Sign in | Sign in |
| Search results | Open return | Return overview | Search results |
| Search results | Today | Today | Today |
| Return overview | Open source | Source viewer | Return overview |
| Return overview | Search | Search results | Today |
| Return overview | Today | Today | Today |
| Source viewer | Next source | Source viewer | Return overview |
| Source viewer | Previous source | Source viewer | Return overview |
| Source viewer | Close source | Return overview | Return overview |
| Preparer queue | Open return | Return overview | Preparer queue |
| Preparer queue | Gap review | Gap review | Preparer queue |
| Preparer queue | Round trip | Round trip checklist | Preparer queue |
| Preparer queue | Exceptions | Exceptions and orphans | Preparer queue |
| Preparer queue | CPA comments | CPA comments | Preparer queue |
| Preparer queue | Judgment inputs | Judgment inputs | Preparer queue |
| Preparer queue | Search | Search results | Today |
| Preparer queue | Today | Today | Today |
| Gap review | Open source | Source viewer | Gap review |
| Gap review | Sign question list | Preparer queue | Gap review |
| Gap review | Overview | Return overview | Preparer queue |
| Round trip checklist | Overview | Return overview | Preparer queue |
| Judgment inputs | Overview | Return overview | Preparer queue |
| Exceptions and orphans | Overview | Return overview | Preparer queue |
| CPA comments | Overview | Return overview | Preparer queue |
| Round trip checklist | Judgment inputs | Judgment inputs | Round trip checklist |
| Round trip checklist | Cite | Cite source or reason | Round trip checklist |
| Round trip checklist | Exceptions | Exceptions and orphans | Round trip checklist |
| Judgment inputs | Cite | Cite source or reason | Judgment inputs |
| Judgment inputs | Round trip | Round trip checklist | Judgment inputs |
| Exceptions and orphans | Cite | Cite source or reason | Exceptions and orphans |
| Exceptions and orphans | Open source | Source viewer | Exceptions and orphans |
| Exceptions and orphans | Sign and send to review | Preparer queue | Exceptions and orphans |
| Cite source or reason | Save citation | Exceptions and orphans | Exceptions and orphans |
| Cite source or reason | Cancel | Exceptions and orphans | Exceptions and orphans |
| CPA comments | Open source | Source viewer | CPA comments |
| CPA comments | Approve draft fix | Round trip checklist | CPA comments |
| CPA comments | Sign and send to review | Preparer queue | CPA comments |
| CPA queue | Review return | Return brief | CPA queue |
| CPA queue | Open return | Return overview | CPA queue |
| CPA queue | Search | Search results | Today |
| CPA queue | Today | Today | Today |
| Return brief | Full return | Full return | Return brief |
| Return brief | Open flag | Three-pane view | Return brief |
| Return brief | See changed cells | Rework changes | Return brief |
| Return brief | Overview | Return overview | CPA queue |
| Full return | Open number | Three-pane view | Full return |
| Full return | Next flag | Full return | Return brief |
| Full return | Next number | Full return | Return brief |
| Full return | Reviewed, next | Full return | Return brief |
| Full return | Approve | Approve return | Full return |
| Full return | Brief | Return brief | CPA queue |
| Three-pane view | Next flag | Three-pane view | Full return |
| Three-pane view | Previous flag | Three-pane view | Full return |
| Three-pane view | Next number | Three-pane view | Full return |
| Three-pane view | Reviewed, next | Three-pane view | Full return |
| Three-pane view | Comment | Comment on a number | Three-pane view |
| Three-pane view | Open source | Source viewer | Three-pane view |
| Three-pane view | Back to full return | Full return | Full return |
| Comment on a number | Send to preparer | Three-pane view | Three-pane view |
| Comment on a number | Cancel | Three-pane view | Three-pane view |
| Rework changes | Open number | Three-pane view | Rework changes |
| Rework changes | Full return | Full return | Return brief |
| Rework changes | Approve | Approve return | Rework changes |
| Approve return | Confirm approval | CPA queue | Full return |
| Approve return | Unmarked section | Full return | Approve return |
| Ops queue | New returns | New returns | Ops queue |
| Ops queue | CRA data capture | CRA data capture | Ops queue |
| Ops queue | T183CORP | T183CORP | Ops queue |
| Ops queue | Check export | Check export upload | Ops queue |
| Ops queue | Filing confirmation | Filing confirmation | Ops queue |
| Ops queue | Notice of assessment | Notice of assessment | Ops queue |
| Ops queue | Open return | Return overview | Ops queue |
| Ops queue | Search | Search results | Today |
| Ops queue | Today | Today | Today |
| New returns | Start CRA capture | CRA data capture | New returns |
| New returns | Open return | Return overview | New returns |
| CRA data capture | Open source | Source viewer | CRA data capture |
| CRA data capture | Save capture | Ops queue | CRA data capture |
| T183CORP | Upload certificate | Ops queue | T183CORP |
| Check export upload | Upload check export | Filing confirmation | Check export upload |
| Check export upload | Open return | Return overview | Check export upload |
| Filing confirmation | Save confirmation number | Ops queue | Filing confirmation |
| Notice of assessment | Save notice | Ops queue | Notice of assessment |
| Notice of assessment | Open return | Return overview | Notice of assessment |
| Pipeline | Weekly lessons | Weekly lessons | Pipeline |
| Pipeline | Measures | Measures | Pipeline |
| Pipeline | Open return | Return overview | Pipeline |
| Pipeline | Search | Search results | Today |
| Pipeline | Today | Today | Today |
| Weekly lessons | Pipeline | Pipeline | Pipeline |
| Weekly lessons | Measures | Measures | Pipeline |
| Measures | Pipeline | Pipeline | Pipeline |
| Measures | Weekly lessons | Weekly lessons | Pipeline |

The Approve control appears only when every section is marked (RV-10); until then the Full return screen lists the unmarked sections as links, and the Unmarked section control leads to them. Sign out, Search and Today are in the service navigation on every screen and are listed once from the screens where the work starts.

## Entry points

| Role | Screen |
| --- | --- |
| preparer | Today |
| preparer | Preparer queue |
| ops | Today |
| ops | Ops queue |
| ops | New returns |
| cpa | Today |
| cpa | CPA queue |
| cpa | Preparer queue |
| cpa | Ops queue |
| cpa | Pipeline |
| owner | Today |
| owner | Pipeline |
| owner | CPA queue |
| owner | Preparer queue |
| owner | Ops queue |

## Shortcuts

One list for the whole app. Every shortcut repeats a visible control, is a single key with no modifier, avoids keys owned by browsers and screen readers, carries `aria-keyshortcuts`, does nothing while focus is in a text field and can be turned off (WCAG 2.1.4). A key never unmarks, approves, sends or deletes: it moves focus to the control, and the person presses it (rule 22). The list shows under a details control named Keyboard shortcuts on every review page.

| Key | Control it repeats | Screen |
| --- | --- | --- |
| `n` | Next flag | Full return |
| `m` | Next number | Full return |
| `o` | Open number | Full return |
| `r` | Reviewed, next | Full return |
| `a` | Approve | Full return |
| `n` | Next flag | Three-pane view |
| `p` | Previous flag | Three-pane view |
| `m` | Next number | Three-pane view |
| `o` | Open source | Three-pane view |
| `c` | Comment | Three-pane view |
| `r` | Reviewed, next | Three-pane view |
| `]` | Next source | Source viewer |
| `[` | Previous source | Source viewer |
| `s` | Search | all |

## Flow diagram

```mermaid
flowchart TD
  n0["Sign in"]
  n1["Two-step code"]
  n2["Today"]
  n3["Search results"]
  n4["Return overview"]
  n5["Source viewer"]
  n6["Preparer queue"]
  n7["Gap review"]
  n8["Round trip checklist"]
  n9["Judgment inputs"]
  n10["Exceptions and orphans"]
  n11["Cite source or reason"]
  n12["CPA comments"]
  n13["CPA queue"]
  n14["Return brief"]
  n15["Full return"]
  n16["Three-pane view"]
  n17["Comment on a number"]
  n18["Rework changes"]
  n19["Approve return"]
  n20["Ops queue"]
  n21["New returns"]
  n22["CRA data capture"]
  n23["T183CORP"]
  n24["Check export upload"]
  n25["Filing confirmation"]
  n26["Notice of assessment"]
  n27["Pipeline"]
  n28["Weekly lessons"]
  n29["Measures"]
  n0 --> n1
  n1 --> n2
  n2 --> n3
  n2 --> n4
  n2 --> n0
  n3 --> n4
  n3 --> n2
  n4 --> n5
  n4 --> n3
  n4 --> n2
  n5 --> n4
  n6 --> n4
  n6 --> n7
  n6 --> n8
  n6 --> n10
  n6 --> n12
  n6 --> n9
  n6 --> n3
  n6 --> n2
  n7 --> n5
  n7 --> n6
  n7 --> n4
  n8 --> n4
  n9 --> n4
  n10 --> n4
  n12 --> n4
  n8 --> n9
  n8 --> n11
  n8 --> n10
  n9 --> n11
  n9 --> n8
  n10 --> n11
  n10 --> n5
  n10 --> n6
  n11 --> n10
  n12 --> n5
  n12 --> n8
  n12 --> n6
  n13 --> n14
  n13 --> n4
  n13 --> n3
  n13 --> n2
  n14 --> n15
  n14 --> n16
  n14 --> n18
  n14 --> n4
  n15 --> n16
  n15 --> n19
  n15 --> n14
  n16 --> n17
  n16 --> n5
  n16 --> n15
  n17 --> n16
  n18 --> n16
  n18 --> n15
  n18 --> n19
  n19 --> n13
  n19 --> n15
  n20 --> n21
  n20 --> n22
  n20 --> n23
  n20 --> n24
  n20 --> n25
  n20 --> n26
  n20 --> n4
  n20 --> n3
  n20 --> n2
  n21 --> n22
  n21 --> n4
  n22 --> n5
  n22 --> n20
  n23 --> n20
  n24 --> n25
  n24 --> n4
  n25 --> n20
  n26 --> n20
  n26 --> n4
  n27 --> n28
  n27 --> n29
  n27 --> n4
  n27 --> n3
  n27 --> n2
  n28 --> n27
  n28 --> n29
  n29 --> n27
  n29 --> n28
```
