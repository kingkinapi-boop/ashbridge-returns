---
paths:
  - "src/app/**"
  - "src/ui/**"
  - "design/**"
  - "e2e/**"
---

# Rules for every staff screen

Loaded automatically when you touch screens, the component library or designs. Every rule is a test that runs on every staff screen of every test-world kind, first shown failing on a planted bad page. The basis and the reasons are in `reference/design-basis.md`; the clauses are RV-50 to RV-55.

## Basis
- Zo's taste (decisions 0008, 0009): Excel and Salesforce (record pages with related lists, list views with search and saved filters, grids for numbers); a logical top-to-bottom order; separate tabs for separate things; as many screens as the work needs; a laptop with two monitors, so a document can open in a second window that follows the clicks. Every task has page-load and click budgets in its design brief, and a test enforces them.
- Built from the official `govuk-frontend` 6.x and `@ministryofjustice/frontend` 11.x through our thin React layer in `src/ui/` (RV-52). No Tailwind, no shadcn, no third-party React port. Where both offer a part, use GOV.UK's.
- The Ashbridge Tax brand comes only through GOV.UK Frontend's settings: the Generic header with the Ashbridge Tax logo top left, Roboto, the approved palette as functional colours (`design/basis/settings.scss`). No GOV.UK crown, logotype, typeface or colours (RV-55).
- Every screen is built to its approved design page and matches it (RV-53).

## The rules (each one is a test)
1. Rendered HTML uses only `govuk-`, `moj-` and `app-` classes; every `app-` class is listed in `design/basis/` with its reason; the only stylesheet is `src/ui/styles/app.scss`; no inline style except the source viewer's box position.
2. Every `src/ui` component emits the HTML of every GOV.UK fixture, or of the MOJ macro, for the same options.
3. axe with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, plus the `region` and `landmark-unique` rules, finds no violation on any screen, in every state the journeys reach (empty, error, flagged, approved, void).
4. Every page has one h1, a skip link to `main`, the Generic header with the logo, and a `<title>` naming the page and the return, starting "Error: " when the error summary shows. Every return screen shows the MOJ identity bar with the corporation and year end (RV-50).
5. Every table has a caption and scoped headers; money sits in numeric cells with tabular figures; one figure prints the same string in the brief, the section, the trace and the viewer caption.
6. Every list of returns, flags, exceptions or lessons longer than 5 rows is an MOJ sortable table with `aria-sort` and a default order stated by its own clause in its brief (preparer queue by due date, RV-20; CPA queue by tier, RV-8); one measure has one name everywhere and one column has one date format. Return sections keep the printed order and are never sortable (RV-1).
7. Colour never works alone: every dot, tier, flag, tag and highlight has words (visible or visually hidden) and a non-colour cue. One status has one word and one colour everywhere.
8. No disabled buttons and no dead controls: an action that cannot run yet is absent, and the page says what is left, with links. (So "Approve" appears only when every section is reviewed, RV-5.)
9. Every form uses the GOV.UK error pattern (summary focused, links to fields, the same message at the field, says what to do). No radio is preselected. A button that waits on the server shows a loading state at once.
10. Every keyboard shortcut repeats a visible control, carries `aria-keyshortcuts`, is listed under "Keyboard shortcuts", does nothing while focus is in a text field, and single-key shortcuts can be turned off (WCAG 2.1.4).
11. Every journey completes by keyboard alone; focus is always visible and never hidden by a sticky header, the identity bar or a pane (WCAG 2.4.11).
12. Targets are at least 24 by 24 CSS px or spaced so (WCAG 2.5.8); nothing needs dragging (2.5.7); resizable panes use arrow keys.
13. At 320 CSS px wide nothing scrolls sideways except a table inside a labelled scrollable region, and the panes stack (WCAG 1.4.10).
14. Separate things go on separate tabs or screens, never all in one place (Zo, 1 Oct, decision 0009). The CPA's return sections keep their fixed order, each with an explicit "Reviewed" mark, and none can be skipped without showing as unreviewed (RV-1, RV-5).
15. SINs, dates of birth and banking numbers planted in the test world never appear unmasked on any page or page image (SEC-4).
16. Never ship a placeholder, "coming soon", lorem ipsum, an em dash, a link or button that goes nowhere, or a field without a label; a field a stranger could misread has a hint (RV-50).
17. Every built screen matches its approved design page within the visual threshold, with baselines made in the cloud container, never on the laptop.
18. Budgets and the fold are measured at 1366 x 650 and at 1093 x 525 (125% zoom), and include readable text (body text at least 16 px, source page text at least 12 px at fit width), the page area height and the rows visible beside a pane; panes never stack at either size. A page load is a full document navigation; a tab or section change is a client-side route with its own URL (0 loads); opening a source adds no history entry.
19. Every action on a list or record runs in place (no separate page for a form of 3 fields or fewer), keeps the scroll, moves focus to the result or next row and announces it; bulk bars are sticky; a bulk action never includes a row flagged for a person.
20. Every source opens through the one source viewer (D03): beside the work, never below a table; full height, the box scrolled into view, focus moved in; plus a second window opened by script (`window.open(url, name)`, no `noopener`) that follows every selection and tab change.
21. Header search shows a results page when more than one thing matches; every list over 5 rows has search or a filter. Back returns to the list you came from with its filter, sort and scroll; next and previous follow that list. The current selection lives in the URL (history.replaceState), so a reload or a second window restores it.
22. A single key never unmarks, approves, sends or deletes; such keys only move focus to the control. "Reviewed, next" marks and moves on, never unmarks.
23. One return record shell (identity bar plus record tabs) for every role and family; a family fills a tab, never adds its own tab set. SINs show no digits ("SIN on file").

## Carried over from the client app (so both apps look like one firm)
- Headings in title case and a red asterisk on required fields, as in the client app, although GOV.UK advises otherwise (amber A20).
- After a save on a form, the next page opens at the top; after an error, at the error summary. After an action on a list, the list stays where it was, focus moves to the next row and the result is announced (the client app's "back to the top" on lists was one of /internal's faults). Errors say what to do. The brand is written "Ashbridge Tax".
