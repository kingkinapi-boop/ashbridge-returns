# Design report: the source viewer (D03), fix round 1

Branch `claude/design-source-viewer-2` (from `origin/claude/findings-source-viewer`, then `origin/main` for the extended rules 3, 18 to 23 and design check 8 over http), 1 Oct 2026. Brief and fix list: `design/briefs/source-viewer.md`, section "Fix round 1 (findings review, 1 Oct)". Panel report read: `reports/panel-source-viewer.md` (13 faults, branch `claude/panel-source-viewer`). Prototypes: `design/prototypes/source-viewer/` (start at `index.html`). Data: `reference/sample-clients/01-maple-ridge` (Maple Ridge Consulting Inc. (Test)).

## Fix round 2 (1 Oct 2026, findings review 2, "Source viewer" fixes 1 to 3; fix 4 waits for D01)

Branch `claude/design-source-viewer-2` again, with `origin/main`, `origin/claude/design-verify` (shared `design/verify/rules.mjs`, V1 to V8) and the shared part `design/parts/cite-or-reason/` from `origin/claude/design-workbench-2`.

| Fix | What changed | Where |
|---|---|---|
| 1 (D2) | B calls the shared `advance` after Cite and after Record: the next figure that still needs a source or a reason opens with focus in its box; with none left the "recorded" notice takes focus. The "Go to ..." button stays as a second route | `assets/v2.js` (`recorded`) |
| 2 (D4) | B uses the shared cite-or-reason part (its css and js are linked from `../../../parts/cite-or-reason/`). No closed fold: the "candidate shown" radio, the "A written reason" radio with its always-visible box and one Record button sit in one row under the evidence. Typing a reason checks the reason radio (never a "choose" error); the source path is radio plus Record (2 clicks after opening), the reason path box plus Record (2 clicks) | `assets/v2.js` (`citeForm`), `build/build.mjs`, `assets/app.css` |
| 3 (D3) | C: a decided row shows its tag (Complete or Chasing the client) and an Undo; no live Complete or Chase button remains on that row or in its decision slot. Undo opens one reason box in place (GOV.UK error pattern, summary at the top of that form, page scroll kept); a reason clears the decision, keeps the reason in session storage and puts focus on the row's Complete | `assets/v3.js` |
| Hooks | `data-identity-bar` on the MOJ identity bar of every page; `data-evidence` on the viewer stage; `data-primary` on Supports this figure (A), Record (B cite), Accept (B verify), Complete (C; Chase when there is no file); `data-count` and `data-scope` on every count (figures, values, items, rows shown per list) | `build/build.mjs`, `assets/viewer.js`, `assets/v1.js` to `v3.js` |

Two things found by V7 while checking, fixed in `assets/work.js`: a second click on "Show sources" of the row already shown redrew the same pane and changed nothing. It now moves focus into the box at once; with the pane hidden because the second window follows, it brings that window forward and says so.

### Round 2 numbers (`build/verify.mjs`, 282 checks, 0 failed; was 154)

Run through `node tools/heavy.mjs --`, pages over http from `design/` (so the shared parts folder is served), Playwright through `PW_NM`, 1366 x 650 and 1093 x 525. Full run about 40 minutes (V7 reloads the page between controls).

- **Re-walks:** B cite and reason 5 checks per size, C Complete and Undo 6 per size, all pass. The B cite flow checks: 2 clicks after opening for both paths, typing checks the reason radio, focus lands in the next box, the "choose" error shows only when nothing is chosen and nothing is typed, a short reason shows its own error with the summary focused and the title starting "Error: ".
- **Shared rules V1 to V8** (104 checks across 8 pages or states at both sizes: A f1, A f4 flagged, B p1, B p2, B verify, C o1, C o5, C o4 empty): V1 32 checks, V2 10, V3 16, V4 4, V5 24, V6 6, V7 10, V8 2. All pass. V2 covers A mark, B Cite, B cite error, B Accept, C Complete; V4 covers focus after each, a done row in C and the shortcuts `]`, `[`, `j`, `k`; V6 searches by the figure's name for A, B and C; V7 clicks up to 45 controls on A, B cite, B verify, C, and every control of a done row in C.
- **axe over http** (wcag2a to wcag22aa plus `region` and `landmark-unique`): 102 page-states at both sizes, 0 violations, 0 incomplete (B's cite error state is now the "choose a source" error).
- **Keyboard walk:** A 32 stops, B 27 (was 26), B verify 33, C 36, window 5, at both sizes: 0 problems. From the box 1 Tab reaches the decision in A, B cite (the radio group), B verify and C.
- **320 px:** 9 views, none scrolls sideways (the hidden legend of the cite form first did; fixed).
- **Budgets:** page area as in round 1 (A 62%, B verify 62%, C 62% at 1093 x 525; 69% to 71% at 1366 x 650). One new figure: B with the cite form under the evidence, orphan p1, page area **63.6% at 1366 x 650 and 55.0% at 1093 x 525**.
- **Lint (checks 6, 7, 9):** 0 findings; the new `app-` classes (`app-cor`, `app-cor__row`, `app-cor__reason`, `app-req`, `app-viewer__foot--cite`, `app-cite__sum`, `app-cite__go`, `app-undo`, `app-undo-sum`) have CSS and are listed with their reasons in the version's `notes.md`.

### For the Lead (amber candidates)

- **B cite state is 55.0% page area at 1093 x 525, below rule 18's 60%.** Rule 20 puts the evidence and the decision in view together, and the decision now sits under the page. The stacked radios plus the box cost about 48 px more than the old button row. Options: leave it (V3 passes: evidence and decision fully in view), or cut the identity bar and chrome rows (D01's one shell). I left it; my own threshold in the check is 55%, set after measuring, so treat it as a known miss.
- Undo is offered on a "Chasing the client" row too (same form), so no decided row keeps a live Complete or Chase. Reverse: show Undo only after Complete.
- V7 is told to skip the skip link (Playwright cannot click it off-screen) and the current-page tab link (`aria-current="page"`, it is the page you are on).
- `design/prototypes/source-viewer/build/verify.mjs` now takes `PW_NM` (falls back to `SV_NM`) and serves `design/`, so URLs gain `/prototypes/source-viewer/`.
- Fix 4 (D1, one shell for the record tabs) is not done: it waits for D01.

## The three versions after fix round 1

A (docked strip) is the one base component; B and C are the embed variants the panel named. All three run the same `assets/viewer.js`, `work.js` and `window.js`; they differ only in the source navigation, the decision slot (`extra`) and the family's list.

| Version | Path | Role now |
|---|---|---|
| A, docked strip | `a-docked-strip/` | Base component, CPA review. Decision slot: "Supports this figure, next source" and the key `m` (Reviewed, next) |
| B, tabs and decision slot | `b-tabs-and-decision/` | Preparer. Source tabs; slot holds the cite form (RV-22) or Accept and Reject (EV-6). Cite figures and Verify values are two client routes on one page (`index.html`, `index.html?tab=verify`) |
| C, window first | `c-window-first/` | Ops. Slot holds Complete and Chase; its "pane hides while the window follows" is now in all three |

Parts used and composed `app-` parts with reasons: `notes.md` in each version folder (the lint fails an `app-` class that is not listed there).

## What changed, by fix (brief, "Fixes for the designer")

1. **Opening zoom** (RC-a, faults 1, 4). Page sources open at the smallest zoom at which the box text is at least 12 CSS px (each source carries `minText`); zoom in stops at the largest size where the whole box still shows, so the box is never clipped; if it cannot be both whole and readable the page opens readable and scrolls to the box's left edge. The size persists per kind for the session; keys `+` or `=`, `-`, `0` (Fit box) and buttons "Zoom +", "Zoom -", "Fit box" repeat them. The page images are SVG, so they stay sharp at any zoom (the real build renders them at 2x).
2. **Chrome** (RC-a, fault 2). One row for the title and zoom; the steps or tabs; the source line; who added it with the words found in the box (kept visible, in the box's accessible name too). Page area is at least 60% of the height at both sizes, in the pane and in the window (the window puts the steps on the title row).
3. **One shell** (RC-b, faults 3, 5, 9). The identity bar and record tabs sit in one labelled region; the splitter sits inside the one "Source viewer" pane region; the viewer draws no landmark of its own (the empty state's duplicate is gone); the 1 px overflow came from the visually hidden live region placed after the split (moved to the top). Record tabs are client routes: `pushState`, 0 loads, own URL, Back and Forward, and the window receives the new list.
4. **Window link both ways** (RC-c, faults 6, 9). Each page says hello on load and answers the other's hello; both beat every 2 s and the other counts the window closed after 6 s (3 missed), or at once on a close; no window handle is used. Every message carries the return id (another return's page is ignored); the window follows the work tab last used on its return and a step in the window drives only that tab. One window layout (A's strip) for all families.
5. **Sign-out** (RC-c, fault 7). `assets/signout.js` broadcasts `signout` from any page's Sign out link; every same-origin page (work pages, windows, landing) goes to the signed-out page. Note for V00: the server ends the session; this channel is the second line.
6. **Selection in the URL** (RC-d, fault 8). `history.replaceState` writes `?item=&src=` (and `q=` for the filter, `tab=` for B); the list scroll is kept in session storage; B's cites and reasons are kept in session storage so a reload keeps them. Reload and Back return to the same figure, source and filter with no history entry.
7. **Decision slot and one shared next** (RC-e, faults 10, 11, 13). From the box 1 Tab reaches the decision in A, B (cite and verify) and C. Shared `advance`: the next unhandled row after this one in list order, then the first unhandled above, else focus and announce the done message ("All items checked" in C). `m` marks and steps, on the last source goes to the first unmarked source of the figure, then the next unmarked figure; it never unmarks ("Remove mark" is a button only).
8. **Pane hides while the window follows** (fault 12 for C, and all versions). While the window is open and following, the pane hides and the list uses the full width; with Follow off, a closed window or a blocked pop-up the pane returns and says so. C's one-line summary shows only while the pane is hidden.
9. **C fallback rows** (fault 12). Heading and count, filter and window controls fold into three short rows, the table caption is visually hidden and the item row holds one cell of buttons ("Chase" with a hidden "the client about ..."): 3 full rows beside the pane at both sizes.

Also: the sheet card now shows the header and three rows and fits the pane without sideways scrolling (needed so no cell is half clipped, which axe reports as "incomplete"); the key glyph inside the primary button was white on white and now has its own dark text colour (a real contrast fault axe flagged).

Not the viewer's job, left for D02 as the brief says: the mark comes off when the number changes; Approve only when every section is marked.

## Checks (design.md 6 to 9) and the ten acceptance checks

Script: `design/prototypes/source-viewer/build/verify.mjs` (Playwright and @axe-core/playwright from a scratch folder, headless Chromium only, pages served over **http** by the script on a random local port, never file://, no Chrome extension). Run through `node tools/heavy.mjs --`. Result file: `build/verify-result.json`. **154 checks, 0 failed.** Full run about 6 minutes.

- **6 Retired terms and brief age:** none of the eight retired terms in the brief or any prototype file; no em or en dash, no filler, no SIN digits, no CSS `zoom`, no third-party host. The brief names its blueprint commit.
- **7 Prototype lint:** 0 findings: every href resolves, no `#` link, no self-link (the current-page record tab keeps the MOJ `aria-current` link), one h1 per page, skip link and Generic header on every page, only `govuk-`, `moj-`, `app-` classes, every `app-` class (62) has CSS and is listed in a `notes.md`, no inline style in HTML (JS sets only the box position and page width), no page draws its own viewer, counts agree (8, 10 and 5 rows against "of N" text).
- **8 axe over http** (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, **plus `region` and `landmark-unique`**): 102 page-states (every state, every source of the multi-source figures, the failed image and Try again, the cite error, the recorded reason, all marked, the route to Verify, the three windows with a selection, the three work pages with the pane hidden, landing, signed out, six 320 px views) at 1366 x 650 and 1093 x 525: **0 violations, 0 incomplete.** One exception, reported not hidden: at 320 px a table inside its labelled scroll region is partly clipped by design; one such node (the fifth column header of the figures table in A, 15.0:1) was resolved by calculating its contrast from computed colours, as the old script did; the same view at both desktop sizes is 0 incomplete without calculation.
- **Keyboard Tab walk** (both sizes; A 32 stops, B 26, B verify 33, C 36, window 5): every stop has a visible focus style, is in view (a tall scroll region counts when its top is) and is at least 24 x 24 px. 0 problems.
- **9 Basis:** only listed `app-` parts; Roboto 400 and 700 self-hosted; `assets/govuk-moj.css` is still the one compiled from govuk-frontend 6.5.1 and @ministryofjustice/frontend 11.1.0 with the Ashbridge palette (the D00 finding about MOJ's forwarded GOV.UK settings stands).
- **320 px reflow:** nine views, none scrolls sideways except a table inside a labelled scrollable region; the viewer replaces the list, and Esc returns with focus on the figure's button.

### The ten acceptance checks (brief, "Acceptance tests for D03"), each a check in `verify.mjs`

| # | Check | Result |
|---|---|---|
| 1 | Smallest text in the box at opening zoom at least 12 px; box whole or its left edge in view; both sizes (TB-9, rule 20) | 7 page sources x 2 sizes pass: Lakeview p2 opens at 149% (text 12 px, box 442 of 479 px wide, whole), Lakeview p3 at 103% (12.1 px), T5 at 164% (12 px) |
| 2 | Page area at least 60% of the height at 1093 x 525, in the pane and in the window | pane 323 px (A, 62%), 337 (B, 64%), 324 (C, 62%); all page sources 62% to 65%; window 328 px (62%) in all three. At 1366 x 650: 69% to 71%; window 453 px (70%) |
| 3 | 3 sources marked with 3 keys and 0 clicks (rule 22) | pass at both sizes: "Checked", 0 clicks |
| 4 | The mark key pressed twice never unmarks | pass: source 1 stays marked, status "Checking, 1 of 2 sources" |
| 5 | C Complete on the last unhandled row focuses "All items checked" (rule 19) | pass from the row and from the slot; also Accept on the last value in B |
| 6 | Reload with the window open shows "open, following" on both within 2 s | work page reload 37 to 82 ms, window reload 68 to 76 ms, all three versions |
| 7 | Sign-out from the window signs out the work page (SEC) | work page and a second page signed out in 113 to 171 ms; sign-out from the work page closes the window |
| 8 | Reload and Back keep `?item=&src=` | pass (`item=f1&src=3` and `q=due`); history length 3 before and after; list scroll 119 px kept |
| 9 | A tab change makes 0 loads and the window follows (rules 18, 20) | pass: marker kept, 1 navigation entry, own URL `?tab=verify`, history +1, window shows the Verify list and its figure; Back and Forward work with 0 loads |
| 10 | axe over http incl. `region`, `landmark-unique`: 0 violations, 0 incomplete | pass (see check 8 above) |

### Budgets (rule 18), measured by script at both sizes

| Task | A | B | C |
|---|---|---|---|
| Open a source (1 click) to box in view, focus on the box | 0 loads, 0 history, 150 to 180 ms | same | same |
| Esc | focus back on the figure's row | same | same |
| Full rows beside the pane, 1366 x 650 / 1093 x 525 | 8 / 3 | 6 / 6 | 5 / 3 |
| Page overflow | 0 px, no sideways scroll | same | same |
| Step a source | 1 key (`]`) | 1 key | 1 key |
| Decide | `m`: 1 key per source | cite: 2 clicks; verify: 1 click per value | Complete or Chase: 1 click or Enter |
| From the box to the decision | 1 Tab | 1 Tab | 1 Tab |
| Second window | opens from 1 click or `o`; follows in about 0.1 s; closed state in under 0.05 s; blocked message shows | same | same |

Other panel scripts re-run: zoom in to the cap never clips the box; zoom persists to the next page source; keys typed in the reason or filter field fire nothing; two work tabs on one return (the window follows the last used, a window step drives only that tab); another return's message is ignored; Follow off keeps the window on its source, says what the work page shows, and catches up; the failed page image shows Try again and recovers; the splitter takes Left, Home, Enter.

## Findings and limits for the Lead

- Viewer chrome text is 14 to 15 px (source line 15, who and words 14, tags 14); body text in the list is 16 px; source page text is at least 12 px. Rule 18 says "body text at least 16 px": I read it as paragraphs, not the viewer's chrome rows (making them 16 px costs the 60% page area at 1093 x 525). Lead's call (amber).
- A at 1093 x 525 shows exactly 3 full list rows beside the pane (C also 3); the pane is 504 px including its 24 px handle.
- The window shortens its status to "Following the work page." (the figure is named in its title row); the long message shows only when Follow is off or the work page closed.
- The shared heavy-job lock (`/tmp/ashbridge-returns-heavy-1.lock`) was left behind twice by killed jobs whose process no longer existed; I removed those two orphan locks by hand after checking the pid was gone.
- Not changed: the brief, rules and plan files (none are mine to edit in this round).
