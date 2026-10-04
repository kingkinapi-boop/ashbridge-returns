# Design report: Workbench, Gap review (D07) and Round trip (D05), batch 3a

Branch `claude/design-workbench-3a` (from `origin/claude/design-base`), 4 Oct 2026, designer 4. Brief `design/briefs/workbench.md` section 7; `plan/cards/D07.md` and `D05.md` do not exist yet, so the task scripts came from the brief and `plan/slices.json`. Made-up data only (Maple Ridge, Halton Haulage, Danforth Cleaning, all "(Test)"). The shared `b.js` and `b.css` of workbench-2 are untouched; this batch has its own page and asset files.

## Versions

Start at `design/prototypes/workbench/gaps-roundtrip-3a/index.html`. Parts and every `app-` class with its reason: `PARTS.md` in each version folder. Every state is linked from `states.html` in each folder (Gap review: fresh, edit, edit error, merge, drop, drop error, bank, partial, ready to sign, refused, signed, held, empty; Round trip: every step scene, refusal and flag, including the 23 diagnostics rows).

| Version | Path | Structure |
|---|---|---|
| A, list and detail | `design/prototypes/workbench/gaps-roundtrip-3a/a-list-detail/` | Gap review: question list left, one sticky pane right (evidence and deciding buttons together). Round trip: task list left, the open step's form or result right. |
| B, one column | `design/prototypes/workbench/gaps-roundtrip-3a/b-one-column/` | Gap review: a disclosure row (All questions, Add from the bank), then one question block, work left and source right. Round trip: an accordion task list with the step inside its row. |

## Numbers (`build/verify.mjs`, run over http, Playwright, 1366 x 650 and 1093 x 525; 107 pages and states served)

| Check | Result |
|---|---|
| 6 retired-term lint, em dash, CSS zoom, CDN, filler, inline style, only govuk/moj/app classes, every app- class listed in PARTS.md | 12 of 12 pass |
| 7 prototype lint: links, missing files, duplicate ids | pass (included in the 12) |
| 8 axe (wcag2a to wcag22aa, region, landmark-unique), 53 pages and states for each version at each size | 0 violations, 8 of 8 pass |
| Keyboard walk (tab walks, journeys by keys only, shortcuts) | 72 of 72 pass. Tab stops: A 32 to 43, B 8 to 39 by state |
| 320 px | 53 pages for each version, 0 sideways scroll, panes stack |
| Budgets (P2 gap review clicks and fields, P3 .GFI, P5 download and Ready, P7 paste, history, second window following, text sizes) | 79 of 80 pass |
| Shared rules V1 to V5, V7 (V6 and V8 do not apply: header search is the shared one, no field is tied to an option) | 527 of 544 pass |

P2 clicks: keep 1, edit 2, merge 2, drop 2, add from the bank 2, sign 1; fields 0, 1, 0, 1, 0, 0 (as the brief). Body text 16 px, source text 16 px at both sizes. Page height in the window: A 558 of 650 and 797 of 525 (the 1093 page scrolls only below the pane), B 533 of 650 and 489 of 525.

## What still fails, and why

These are structural limits left for the panel, not hidden.

1. A at 1093 x 525 shows 2 of 5 questions whole beside the pane (the brief wants 3). The list columns wrap. At 1366 x 650 all 5 show.
2. A, error states (edit error, drop error), 1366 and 1093: the pane's error summary sits in the foot and leaves the evidence box partly scrolled inside its scroll area (the pane scrolls; nothing is lost). At 1093 the Keep button of the edit error state is 32 px under the fold. Held (read only) at 1093: box partly below the scroll area.
3. A at 1093, opening "Add from the bank" scrolls the page 447 px: the bank list grows the list column. Fix idea: cap the bank list height with its own scroll.
4. B, bank open (both sizes) and the held state at 1093: the disclosure pushes the question block below the fold. B's one-column page is long by nature.
5. B round trip at 1093 x 525: the accordion puts the step body under the completed rows, so the deciding control of Upload refusals, Diagnostics paste, Cite is 20 to 160 px under the fold. A shorter completed row or a horizontal step bar would fix it. At 1366 only Diagnostics paste error fails (by 19 px).
6. B at 1093, opening a Warning reason scrolls 311 px (same cause as 5).

## Judgment calls (for the Lead to log as amber)

- Sign off is a seventh, uncounted row ("N of 6 steps complete").
- The rail drops Books and Diagnostics because Round trip holds them.
- Diagnostics rows are ordered "rows you can clear first": Warning, Informative, Error, Filing error. The caption says so.
- Merge and the bank are one button for each choice, so the click budget holds (2 clicks, 0 fields) and neither has an error state.
- A prototype-only select ("what the upload gives") picks the scene; it is marked prototype only.
- Keys follow A485 K1: `r` Keep, `n` next, `p` previous, `o` open source, `/` search, `s` second window, `?` list; each repeats a visible control and carries `aria-keyshortcuts`; `#keys-on` turns them off; none unmarks, approves, signs or deletes.
- Draft state tags are hidden in the pane (the list shows them).
- The Cite step links to Trace, which belongs to another family. Some diagnostic codes and cell pairings are made up.
- Headings: the page h1, h2 for pane and step titles, so axe heading-order passes.
- Verify script test fixes made in this batch: the second-window test registers the popup before the checkbox is ticked; B state text is read with `textContent` because the list sits inside a closed disclosure.

## Files

`design/prototypes/workbench/gaps-roundtrip-3a/`: `index.html`, `assets/g3.css`, `assets/g3.js`, `assets/g3-window.js`, `build/` (generator, data, verify, helpers), `a-list-detail/` and `b-one-column/` (pages, `states.html`, `source-window.html`, `PARTS.md`). Rebuild with `node build/build.mjs`; verify with `PW_NM=<folder holding playwright> node build/verify.mjs [lint|rules|axe|keys|reflow|budgets]`.
