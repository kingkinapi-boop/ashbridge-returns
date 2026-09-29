# Design basis for the staff screens

Research of 28 Sep 2026 for cards D00 to D11, U00, U01 and a future `.claude/rules/staff-screens.md`. Background, not authority: the blueprint and `decisions/` rule. Labels: **[fact Sn]** checked on 28 Sep 2026 against source n (list at the end); **[fact: path]** read in ashbridge-app (read-only); **[inference]** a recommendation.

## Decisions in brief

1. GOV.UK is the basis in the code, not in a review: the official `govuk-frontend` 6.x and `@ministryofjustice/frontend` 11.x (both MIT), used through a thin React layer `src/ui/` that is proven to emit their exact HTML. No Tailwind, no shadcn, no third-party React port. [inference]
2. The Ashbridge brand enters only through GOV.UK Frontend's own settings: Generic header with the Ashbridge Tax logo, Roboto, the approved palette as functional colours. No GOV.UK crown, logotype, typeface or colours. [inference from S2, S3]
3. Dense and desktop-first (RV-51), yet WCAG 2.2 AA, reflow at 320 px and every journey by keyboard alone. [inference]
4. Design pages first (official macros, made-up data), one look by Zo for all screens, then build to them, held by visual comparison tests. [inference]

## (a) What to reuse from the client app

**How GOV.UK was lost once.** GOV.UK patterns were approved on 16 Sep only as a post-build review lens (B27 in `docs/ashbridge-decisions-log.md`), then made the build basis for client screens on 24 Sep ("wrongly used only as a post-build lens", V2-05 in `decisions/0002-v2-reset-2026-09-24.md`). The staff pages under `src/app/internal/**` never moved: no `govuk-` class, no v2 frame, no `aria-sort`; they draw on the v1 stylesheet (for example `src/app/internal/engagements/queue.module.css`). [fact: those paths, searched 28 Sep] Lesson: put the basis in the code and in a test (rules 1 and 2 below), not in a review.

**How the client app draws GOV.UK.** It does not use the `govuk-frontend` package. It redraws the patterns in its own CSS (`src/components/flow/flow.css`, every rule under `.abf`) beside Tailwind v4 without preflight (`src/app/globals.css`) and shadcn-style parts on Radix (`src/components/ui/*`, `package.json`). It has no axe test and no screenshot test. [fact: those paths]

| Reuse | Where in ashbridge-app | Use in the staff app |
|---|---|---|
| Palette "derived from ashbridgecpa.ca and approved with the mock-ups on 11 September 2026" | `src/app/globals.css` (`@theme`, `--color-db-*`); `src/components/flow/flow.css` line 2 (`.abf` custom properties) | `$govuk-functional-colours` (map below) |
| Roboto 400 to 700, self-hosted by `next/font` | `src/app/layout.tsx` | `$govuk-font-family`; 400 and 700 are enough [inference] |
| Logo (634 x 492 PNG) and icons | `public/brand/ashbridge-tax-logo.png`, `src/app/icon.png`, `src/app/apple-icon.png`, `public/favicon.ico`; `spec/tools/logo.b64` for static pages | Generic header logo; replaces GOV.UK's icons [S3] |
| Frame: logo top left, the name of the thing above the h1, Sign out top right | `src/components/flow/Frame.tsx` | Generic header, service navigation, MOJ identity bar |
| Error summary that takes focus and focuses its field; loading state on submit (`useFormStatus`, `aria-busy`) | `src/components/flow/parts.tsx` | The same behaviour in `src/ui` |
| Rules run on every screen, each first proven to fail a planted bad page | `tests/flow/crawler.test.ts`, `tests/flow/screenRules.ts`, `tests/flow/noEmDash.test.ts` | Model for the rule tests in (d) |
| Designs generated from one source, shown in batches, approved in one line | `spec/tools/designs.py`, `spec/designs/index.html`; approval V2-30 in `decisions/0004-chat-page-and-designs-2026-09-25.md` | Model for `design/` in (e) |
| Status tags (text contrast 5.18:1 to 8.15:1) | `flow.css` `.t-todo` to `.t-other` | GOV.UK tags; one status, one word, one colour |

**Spacing and type.** The client app has radius and shadow tokens but no spacing scale (literal px in `flow.css`); body 17 px, h1 27 to 34 px. [fact: `flow.css`, `globals.css`] Use GOV.UK's spacing scale and v6 type scale instead (80 down to 16 px, since v6.0.0 removed 14 [S1; `settings/_typography-responsive.scss`]). [inference]

**Colour map** (contrast on white, computed 28 Sep with the WCAG formula): brand and link #355b7d (7.13:1); link hover #4d7092 (5.19:1); text #15283b (15.02:1); secondary text #627283 (4.94:1; 4.52:1 on #f3f5f8); error #b3413a (5.62:1); focus #f5c94c with focus text #15283b (9.54:1). Do not copy two client values: the success green #2f9e76 is 3.35:1, below 4.5:1 for text (use #1f6e50, 6.17:1, the client's own done-tag text), and the input border #8b9dae is 2.79:1, below WCAG 1.4.11's 3:1 (keep GOV.UK's input border). [fact: computed]

**Zo's rules that carry over** (`.claude/rules/client-screens.md`): logo top left in the same place; every screen names what it is about (RV-50); a loading state at once on every button that waits on the server; after a save the next page opens at the top, after an error at the error summary; errors say what to do; brand "Ashbridge Tax"; no em dashes; no placeholder, dead button or unexplained field. Client only, not carried: six sentences, one white box, Questions?, the Dashboard button, phone width first. [inference]

**Two clashes with GOV.UK.** Zo's headings in AP title case against "Always use sentence case, even in page titles and service names" [S4]; Zo's red asterisk on required fields against "Never mark mandatory fields with asterisks" [S5]. Amber, settled by the tie-breaker "the client app's patterns": keep Zo's two rules, so staff see one look; log it in `plan/AMBER.md`. [inference]

## (b) The component library for the staff app

- `govuk-frontend` 6.5.1, 14 Sep 2026, MIT. v6 needs Dart Sass 1.79 or later and has functional colours as CSS custom properties; `@use` and `pkg:` URLs since 6.2.0, Generic header since 6.3.0, interruption panel since 6.4.0. [fact S1]
- A service not on GOV.UK uses the Generic header, sets `$govuk-font-family` and `$govuk-functional-colours` (brand), replaces favicons, icons and theme colour, and never uses the crown, the GOV.UK logotype, GDS Transport or GOV.UK brand colours. [fact S2, S3]
- `@ministryofjustice/frontend` 11.1.0, 17 Sep 2026, MIT, peer `govuk-frontend` ^6.0.0. Its `moment` peer is used only by its Nunjucks filters; 11.2.0-beta.1 moves its Sass to `@forward`. [fact S6; package source]
- MOJ statuses: Official is fully accessible and supported; To be reviewed may have unknown issues; Experimental should not go straight into a live service; Archived is not to be used. [fact S7] Official: alert, button menu, pagination. To be reviewed: sortable table, filter, filter a list, identity bar, side and sub navigation, timeline, messages, multi select, badge, page header actions, scrollable pane. Experimental: numeric data, contextual date, progress tracker, confirm an action. [fact S19]
- There is no official React version. GOV.UK ships `fixtures.json` (options and expected HTML) and `macro-options.json` for every component, for testing ports: "pass `options` into your own macro and check the generated HTML matches `html`". [fact S8; package listing] Ports are stale or narrow: govuk-react 0.10.7 (May 2024, styled-components), govuk-react-jsx 7.1.0 (2022, govuk-frontend 4.0.1), LandRegistry govuk-react-components (last commit 2021); `@not-govuk/*` 0.19.1 (Aug 2026, MIT) tracks v6 but has no MOJ parts and is pre-1.0. [fact S9]
- Next.js 16 compiles Sass with `sass` and `sassOptions` [fact S10]. GOV.UK JavaScript can start for one part of a page with a scope and needs the `govuk-frontend-supported` class from an inline snippet [fact S11].

**Decision.** [inference]
- Dependencies: `govuk-frontend` ^6.5, `@ministryofjustice/frontend` ^11.1 (11.2 once out of beta), `sass`; `nunjucks` (BSD-2-Clause) as a dev dependency for design pages and fixture tests.
- One stylesheet, `src/ui/styles/app.scss`: `@use` GOV.UK Frontend `with` the settings from `design/basis/settings.scss` (`$govuk-font-family: var(--font-roboto), Roboto, arial, sans-serif`, which alone turns off the GDS Transport font face [S12]; the colour map above); then MOJ Frontend; then the few `app-` classes. If the Next build cannot resolve `pkg:` URLs, use load paths or the Dart Sass CLI with `--pkg-importer=node` [S12].
- Width: `$govuk-page-width` stays 960 px (its default in `settings/_measurements.scss`; the Layout page's "1020px" includes the side margins [inference]) for form pages, keeping lines near 75 characters; an `app-width-container--wide` class built with GOV.UK's `govuk-width-container($width)` mixin, up to 1600 px, for tables and the review screen. GOV.UK: "you can make it wider if your content requires it" [S13]. The client queue already widens to 1560 px (`queue.module.css`).
- `src/ui/` (U00): one React component per GOV.UK or MOJ component used, props typed from `macro-options.json`, HTML tested equal to every GOV.UK fixture or to the MOJ macro's output. Server-rendered first. Official JavaScript starts in an effect, scoped to the component, only where it enhances markup React leaves alone (tabs, character count, button menu, service navigation, file upload). Where it rewrites DOM that React owns (sortable table rows, multi select, conditional reveals), React does the behaviour with the same markup, classes and ARIA.
- Where GOV.UK and MOJ both offer a part, use GOV.UK's: tag over badge, service navigation over MOJ primary navigation, GOV.UK task list and header. MOJ pagination only for its results count [S19 pagination].
- Accessibility target WCAG 2.2 AA: GOV.UK aims at AA of the latest WCAG version published for a year, and says using it does not make a service accessible by itself [fact S14]. WCAG 2.2 (5 Oct 2023) adds 2.4.11 focus not obscured, 2.5.7 dragging, 2.5.8 target size, 3.2.6, 3.3.7 and 3.3.8 at A and AA [fact S15]. axe-core tags it `wcag22aa`; run it with `@axe-core/playwright`; automated tests do not find every problem [fact S16].
- Internal services may depart from a pattern with evidence: "It's okay to deviate occasionally, but you'll need to back up these decisions with user research"; one thing per page may not suit admin users [fact S17]. GOV.UK: "Small radios can work well on information dense screens in services designed for repeat use, like caseworking systems" [fact S18 radios].

## (c) Screen by screen

**Every staff screen:** GOV.UK skip link; Generic header (logo, service name); GOV.UK service navigation by role (queue, review, ops, board; Sign out at its end); the MOJ identity bar on every return screen, naming corporation and year end with state and tier tags and a button menu for actions (RV-50) [S19 identity bar]; MOJ alert for in-page state such as "approval void" (FLOW-5), since it suits complex screens [S19 alert]; at most one GOV.UK success notification banner after an action [S18 notification banner]; the GOV.UK error summary and error messages on every form.

| Screen (clauses) | Build from | Gap, and the closest principled approach |
|---|---|---|
| Sign-in (SEC-1) | Question pages; text input and password input; code field numeric with `autocomplete="one-time-code"` | Paste and password managers allowed (WCAG 3.3.8) [S15] |
| Review: brief (RV-2) | Six numbers: table with numeric cells (this year, last year, change); tier: tag with words and a details "Why this tier"; pinned flags: table, red first then dollar effect (EX-4), each linking to its line; changes since last year: table; assumptions, client decisions, attestations: summary lists | MOJ numeric data is experimental and shows one number without last year [S19]: use tables |
| Review: full return (RV-1, RV-3, RV-8, RV-9) | One h2 and one table per section, fixed order; each number a link with its own address (so Back works) carrying its dot and flag as text; last year and change columns; schedules without a structured view drawn by the source viewer | No tabs or accordions: GOV.UK says not to use tabs when users must read content in order [S18 tabs] |
| Coverage tracker, approve (RV-5) | MOJ side navigation listing sections in order, "Reviewed" or "Not reviewed" in words, `aria-current`; "9 of 14 sections reviewed"; Approve: GOV.UK button with double-click prevention, then MOJ confirm an action (summary list of what is approved), then a success banner | GOV.UK: avoid disabled buttons [S18 button]; so "Approve stays off" means no button until coverage is complete, with a line naming the sections left, as links. Fix side navigation's h4 level and its reflow issue [S19] |
| Three panes (RV-4) | Wide container and GOV.UK grid; each pane a labelled region with a heading; trace: summary list (formula, value, last year), table of sources with origin and status tags, "Agrees with" summary list, MOJ timeline for notes and comments; source: the prepared page image with the figure boxed and a text caption (value, page, "source 3 of 12"), Previous and Next buttons | No GOV.UK or MOJ split view or document viewer exists (searched 28 Sep). If panes resize, the ARIA window splitter (separator role, arrow keys, optional F6 to cycle panes) [S20]; scrolling panes as MOJ scrollable pane does (region, `tabindex="0"`, label) [S19]; panes stack below 1280 px and at 400% zoom; the box has a text alternative and a thick outline, not colour alone. PDF.js (`pdfjs-dist` 6.3, Apache-2.0) for pages and text layer [S21] |
| Comments, rework (RV-7) | Small radios for type and severity; textarea; "Send to preparer"; rework view: table of changed cells only, Before and After columns | No diff pattern: a two-column table |
| Keyboard (RV-6, U01) | Shortcuts on visible controls with `aria-keyshortcuts`; a details "Keyboard shortcuts" on every review page | No GOV.UK or MOJ shortcut pattern [inference]. WCAG 2.1.4: a single-key shortcut must be possible to turn off or remap, or act only on focus [S15]; ARIA APG: "keyboard shortcuts enhance, not replace, standard keyboard access", and they avoid operating system, browser and screen reader keys [S20] |
| Preparer queue (RV-20, FLOW-7, FLOW-10) | Table as MOJ sortable table, due date first; MOJ contextual date for filing and balance-due dates; state and tier tags; "Blocked by" and "Held by" columns; MOJ filter a list and pagination only once a list outgrows a screen | Sortable table and filter are To be reviewed [S19]: our own axe and keyboard tests cover them |
| Round trip (RV-21) | GOV.UK task list: Completed, Incomplete, Cannot start yet (not a link) [S18 task list]; one GOV.UK file upload page per upload; summary list of what each export proved | GOV.UK prefers tasks in any order [S18 complete multiple tasks]; ours depend on each other, which "Cannot start yet" covers |
| Judgment inputs (RV-22, TB-6) | One page per kind (CCA, dividends, elections, business limit); a fieldset per item; text input with "$" prefix and numeric keyboard; required "Reason"; MOJ add another for repeated items; summary list before lock | Several questions per page is fine for internal users [S17] |
| Gap review (RV-23) | Summary card per draft question: slot values, evidence link that opens the viewer; small radios Keep, Edit slot values, Merge, Drop with conditional reveals; add from the bank with a select or MOJ search; sign with MOJ confirm an action | Question wording is read from the client app, never typed here (RULE-19) |
| Exceptions, orphans (RV-24, RT-16, EX-1 to EX-4) | Table, red first then dollar effect, each linking to its answer page; answer: radios Fixed, Explained, Accepted risk with reveals; EX-2's refusal as a GOV.UK error message; orphans and overrides: table with class tags and a Cite link; cite page: radios Document box, Answer, Written reason, none preselected [S18 radios] | none |
| CPA comments (RV-25) | One h2 per topic; a summary card per comment (line, type and severity tags, text, Answer) | none |
| Ops (RV-30, FLOW-8) | New returns: sortable table; CRA data capture: task list per return; T183CORP, gates 1 and 2, notice of assessment: file upload pages with summary list results; a gate mismatch: interruption panel [S1] listing the changed cells; confirmation number: text input | none |
| Owner board (RV-40, LL-9) | Pipeline: table by state in lifecycle order with due-date bands; weekly lessons: sortable table; measures: MOJ numeric data | GOV.UK has no chart component [S18]: tables first; any chart comes with its table |

## (d) Draft rules for `.claude/rules/staff-screens.md`

Each rule is a test that runs on every staff screen of every test-world kind, and each test is first shown failing on a planted bad page (the client app's crawler does this). [inference]

1. Rendered HTML uses only `govuk-`, `moj-` and `app-` classes; every `app-` class is listed in `design/basis/` with its reason; the only stylesheet is `src/ui/styles/app.scss`; no inline style except the viewer's box position.
2. Every `src/ui` component emits the HTML of every GOV.UK fixture, or of the MOJ macro, for the same options.
3. axe with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` finds no violation on any screen, in every state the journeys reach (empty, error, flagged, approved, void).
4. Every page has one h1, a skip link that reaches `main`, the Generic header with the Ashbridge Tax logo, and a `<title>` naming the page and the return, starting "Error: " when the error summary shows; every return screen shows the identity bar with corporation and year end.
5. Every table has a caption and scoped headers; money sits in numeric cells (right-aligned, tabular figures); one figure prints the same string in the brief, the section, the trace and the viewer caption.
6. Every list of returns, flags, exceptions or lessons longer than 5 rows is an MOJ sortable table with `aria-sort` and a stated default order (queue: due date); return sections keep the printed order and are not sortable (RV-1).
7. Colour never works alone: every dot, tier, flag, tag and highlight has words (visible or visually hidden) and a non-colour cue; one status has one word and one colour everywhere.
8. No disabled buttons and no dead controls: an action that cannot run yet is absent, and the page says what is left, with links.
9. Every form uses the GOV.UK error pattern (summary focused, links to fields, the same message at the field, says what to do) and no radio is preselected.
10. Every keyboard shortcut repeats a visible control, carries `aria-keyshortcuts`, is listed under "Keyboard shortcuts", does nothing while focus is in a text field, and single-key shortcuts turn off with one setting (WCAG 2.1.4).
11. Every journey completes by keyboard alone; focus is always visible, and after any shortcut or link the focused element is not hidden by a sticky header, the identity bar or a pane (WCAG 2.4.11).
12. Targets are at least 24 by 24 CSS px or spaced so (WCAG 2.5.8), and nothing needs dragging (2.5.7): resizing panes works with arrow keys.
13. At 320 CSS px wide nothing scrolls sideways except a table inside a labelled scrollable region, and the panes stack (WCAG 1.4.10).
14. No tabs or accordions hide return sections or evidence the CPA must read in order (RV-1, RV-5).
15. SINs, dates of birth and banking numbers planted in the test world never appear unmasked in any page or page image (SEC-4).
16. Never ship a placeholder, "coming soon", lorem, an em dash, a link or button that goes nowhere, or a field without a label; a field a stranger could misread has a hint (RV-50).
17. Every built screen matches its approved design page within the visual threshold (e).

## (e) The design process

1. **Basis (D00, D01).** `design/basis/`: `settings.scss` (font, colours, widths), the list of parts used with their MOJ status, each `app-` exception with its reason, the logo copy. `design/map/`: every screen, its URL, who sees it (SEC-2) and the navigation.
2. **Static design pages (D02 to D10).** One HTML page per screen state in `design/screens/<screen>/`, rendered by a small Node script from the official Nunjucks macros of both packages, the compiled Ashbridge stylesheet and made-up returns from `testworld/` (names end "(Test)"). Each page shows its states (normal, error, flagged, empty, void) and, below the screen, the clauses and parts it uses. No design uses a part missing from `design/basis/`. [inference]
3. **One look (D11).** `design/review/index.html` shows every design in batches (review and viewer; preparer; ops and owner) at desktop size, each with "Open full size" and one "what to look at" line, as `spec/designs/index.html` did [fact]. Zo answers once in TODO-ZO ("designs ok", or a design and his change); the Lead records it in a decision file, as V2-30 did for the client app [fact]. Each comment becomes a rule and a test on every screen (lesson 28). [inference]
4. **Build to the approved design (V cards).** Screens are built only from `src/ui`. At approval a script screenshots each approved design page in the cloud container at 1440 x 900 and 1280 x 800; the V card's test loads the same test-world return, screenshots the built screen and compares (`toMatchSnapshot`, small `maxDiffPixelRatio`, dates masked). Baselines and runs share one environment, because rendering differs by operating system and browser [fact S22]. Fonts are self-hosted, so nothing is fetched at test time. [inference]
5. **Why the comparison is fair.** Design pages and `src/ui` share the official markup (rule 2) and one stylesheet, so a difference is real drift, not a porting artefact. A change after approval goes into the next look with a new design page; the visual test fails until then, so drift cannot pass silently. [inference]
6. **Walk.** The tester walks each changed screen by keyboard on the preview against its design and rules 3 to 16.

**Suggested clause wording** (the cards cite RV-52 to RV-55, which are not in blueprint 06 yet [fact: grep 28 Sep]) [inference]: RV-52 staff screens are built from GOV.UK Frontend and MOJ Frontend through `src/ui`; anything else is an `app-` part listed in `design/basis/` with its reason. RV-53 every staff screen is built to a design page Zo approved and matches it. RV-54 every staff screen meets WCAG 2.2 AA and the staff screen rules. RV-55 the Ashbridge Tax brand (logo, Roboto, palette) comes through GOV.UK Frontend's settings, with no GOV.UK branding.

## Sources (checked 28 Sep 2026)

- S1 GOV.UK Frontend releases: https://github.com/alphagov/govuk-frontend/releases ; npm: https://registry.npmjs.org/govuk-frontend
- S2 Generic header: https://design-system.service.gov.uk/components/generic-header/
- S3 Without GOV.UK branding: https://frontend.design-system.service.gov.uk/using-govuk-frontend-without-govuk-branding/
- S4 GOV.UK style guide, capitalisation: https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/
- S5 Question pages: https://design-system.service.gov.uk/patterns/question-pages/
- S6 MOJ Frontend releases: https://github.com/ministryofjustice/moj-frontend/releases ; npm: https://registry.npmjs.org/@ministryofjustice/frontend
- S7 MOJ statuses: https://design-patterns.service.justice.gov.uk/design-system-statuses/
- S8 Testing your HTML (fixtures): https://frontend.design-system.service.gov.uk/testing-your-html
- S9 Ports: https://registry.npmjs.org/govuk-react , https://registry.npmjs.org/govuk-react-jsx , https://registry.npmjs.org/@not-govuk/components , https://github.com/LandRegistry/govuk-react-components
- S10 Next.js and Sass (docs for 16.3.6): https://nextjs.org/docs/app/guides/sass
- S11 Import JavaScript: https://frontend.design-system.service.gov.uk/import-javascript/
- S12 Import CSS and Sass API: https://frontend.design-system.service.gov.uk/import-css/ , https://frontend.design-system.service.gov.uk/sass-api-reference/
- S13 Layout: https://design-system.service.gov.uk/styles/layout/
- S14 Accessibility: https://design-system.service.gov.uk/accessibility/accessibility-strategy/ , https://design-system.service.gov.uk/accessibility/
- S15 WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ ; Understanding 2.1.4 and 2.4.11: https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html , https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- S16 axe tags: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md ; Playwright: https://playwright.dev/docs/accessibility-testing
- S17 Services for government users: https://www.gov.uk/service-manual/design/services-for-government-users ; DWP: https://design-system.dwp.gov.uk/research/internal-systems
- S18 GOV.UK components and patterns: https://design-system.service.gov.uk/components/ (radios, tabs, button, task-list, table, summary-list, notification-banner, tag, panel) and https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
- S19 MOJ components and patterns: https://design-patterns.service.justice.gov.uk/components/ (identity-bar, alert, side-navigation, scrollable-pane, sortable-table, filter, contextual-date, numeric-data, timeline, messages, button-menu, multi-select, badge, pagination) and https://design-patterns.service.justice.gov.uk/patterns/ (filter-a-list, confirm-an-action)
- S20 ARIA APG: https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/ , https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- S21 PDF.js: https://registry.npmjs.org/pdfjs-dist
- S22 Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
