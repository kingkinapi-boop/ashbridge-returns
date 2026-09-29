# 06 Screens (staff only)

## CPA review

- **RV-1** One screen per return. First the brief, then the full return section by section in a fixed order: balance sheet, income statement, Schedule 1, then every other schedule present.
- **RV-2** The brief: the return in six numbers against last year (net income, taxable income, federal tax, Ontario tax, instalments, balance or refund); the tier and why; pinned flags, red first, each with its dollar effect and the preparer's answer; what changed since last year; assumptions and client decisions; attestations (zero orphans, diagnostics cleared, preparer signed).
- **RV-3** Every number is clickable and carries its dot. Flagged numbers are highlighted where they sit. Each line shows last year's value and the change.
- **RV-4** Clicking a number opens three panes: the return (left); the trace (middle: how it is built, each source and its status, what agrees with it, last year, notes, comments); the source (right: the document at the right page with the figure boxed, and next and previous when several sources feed it). The source opens in under one second.
- **RV-5** A section is marked reviewed once it has been on screen and the CPA moves past it. Approve appears only when every section is marked; until then the screen lists the sections left, as links (GOV.UK advises against disabled buttons). The approval record stores the sections, the time on each and every source opened.
- **RV-6** Keyboard first: next flag, next number, open source, comment, next section, approve.
- **RV-7** Comments have a type (error, question, missing evidence, presentation) and a severity, and go to the preparer. After rework the CPA sees only the changed cells, before and after.
- **RV-8** The tier sets queue order and how much is highlighted (green: pinned flags; amber: also the five largest lines and every amber-dot line; red: also every changed, amber or red line). It never reduces the review below the full return.
- **RV-9** Schedules not drawn as structured views show the printed return's pages and still count toward RV-5.

## Preparer

- **RV-20** A queue sorted by due date, showing state, tier and what blocks each return.
- **RV-21** The round trip as a checklist: download the import file; upload the import report and export 1; make the judgment inputs; lock; upload export 2, the review-lines export and the printed return.
- **RV-22** The judgment input sheet: CCA claims, dividend designations, elections, business limit shares, each with a reason.
- **RV-23** Gap review: each draft question beside its evidence; keep, edit slot values, merge, drop, or add from the bank; sign.
- **RV-24** The exception list with one answer box each (EX-1), and the orphan and override list with the cite action (RT-16).
- **RV-25** CPA comments grouped by topic.

## Ops

- **RV-30** New returns; the CRA data capture checklist for each return with access (a fixed checklist, saved as a PDF and read into facts); T183CORP sent and signed (certificate upload); gate 1 and gate 2 uploads; the confirmation number; the notice of assessment.

## Owner

- **RV-40** The pipeline by state and due date; the weekly lesson list; the measures (LL-9).

## Every screen

- **RV-50** Staff only. Every screen names the return (corporation and year end). No dead button, no placeholder, no unexplained field.
- **RV-51** Built for many returns a day: dense, fast and keyboard-first, not a first-visit experience.

## Design basis (Zo, 28 Sep: "same formatting and Gov.uk rules wherever applicable")

- **RV-52** Every staff screen is built from the official GOV.UK Frontend and MOJ Frontend components (the MOJ Design System adds patterns made for staff and caseworking tools, such as sortable tables, filters, timelines and the identity bar), through our own thin React layer. Where no pattern exists (the three-pane review, keyboard shortcuts, the coverage tracker), the screen is composed from their parts, and the reason is written in the design notes.
- **RV-53** Every screen is designed first, as static pages with made-up test-world data, and Zo approves the designs in one sitting before any screen is built. Builds match the approved design, and a visual comparison test on every screen keeps them there.
- **RV-54** Every screen meets WCAG 2.2 AA: automated accessibility checks find no violation, every action works by keyboard alone, and focus is always visible.
- **RV-55** The Ashbridge Tax brand from the client app (logo, Roboto, the approved palette) comes in through GOV.UK Frontend's own settings, with no GOV.UK branding, so staff and client screens read as one firm. Client colours that fail contrast are not copied.
