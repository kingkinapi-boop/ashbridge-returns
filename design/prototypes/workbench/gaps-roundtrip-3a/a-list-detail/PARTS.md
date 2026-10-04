# Version A (3a): list on the left, one sticky pane on the right

Gap review and Round trip inside the one record shell (identity bar plus record tabs; the steps rail is the base shell's). Open `index.html`; every page and state is linked from `states.html`. Made-up data only (Maple Ridge, Halton, Danforth, all "(Test)").

## Shape
- Gap review: the question list on the left; a sticky pane on the right (390 px under 1280 wide, 440 px above) with the question, the source viewer and the deciding buttons. Keep, Edit, Merge, Drop, Add from the bank and Sign run in place. Merge and the bank are one button for each choice.
- Round trip: a task list on the left (six steps, Sign off as a seventh, uncounted row); the open step's form or result is the detail on the right. A step change is a client-side route.
- The second window follows every selection (BroadcastChannel, postMessage, storage).

## GOV.UK parts
Header (Generic), skip link, task list, table, details, inset text, warning text, error summary, error message, button, checkboxes, file upload, textarea, text input, select, tags, summary list, notification banner, visually hidden.

## MOJ parts
Identity bar (return bar), sortable table (diagnostics), sub navigation (record tabs), as in the base shell.

## Composed outside GOV.UK or MOJ, and why
Nothing here has a GOV.UK or MOJ part. Each `app-` class below is layout or behaviour only.

Base shell classes reused from workbench-2 (listed in `../../b-split-pane/PARTS.md`): `app-actions`, `app-count-line`, `app-dense`, `app-filter-row`, `app-hl`, `app-hold`, `app-item`, `app-item__foot`, `app-item__head`, `app-item__scroll`, `app-keys`, `app-linkbtn`, `app-live`, `app-logo`, `app-numeric`, `app-pager`, `app-pane`, `app-paneset`, `app-proto`, `app-return-bar`, `app-row-flag`, `app-scroll`, `app-steps`, `app-tabs`, `app-topbar`, `app-topbar__inner`, `app-topbar__name`, `app-viewer`, `app-viewer__bar`, `app-viewer__box`, `app-viewer__box--tall`, `app-viewer__cap`, `app-viewer__head`, `app-wide`.

New classes of this family (`assets/g3.css`):
- `app-g3-a`: body class that selects layout A.
- `app-g3-b`: body class for layout B (shared stylesheet).
- `app-g3-split`: two columns, list left and pane right, no page scroll.
- `app-g3-split--rt`: the same split for Round trip, task list left and step detail right.
- `app-g3-list`: left column holder.
- `app-g3-detail`: right column holder for a round trip step.
- `app-g3-content`: page content wrapper.
- `app-g3-titlerow`: heading and count on one row to save height.
- `app-g3-view`: one routed view (Gap review or Round trip).
- `app-g3-rows`: the question list, a table with selectable rows.
- `app-g3-qlist`: the disclosure holding the list in layout B.
- `app-g3-disc`: one row holding "All questions" and the bank disclosures.
- `app-g3-bank`: the bank list, one button for each bank question.
- `app-g3-q`: one question block in the pane.
- `app-g3-qtext`: bold question text with the evidence tag inline.
- `app-g3-tagline`: the state line under the question.
- `app-g3-slots`: the slot fields, label left, to fit the pane.
- `app-g3-ev`: the evidence tag holder.
- `app-g3-observe`: the code's observation under the source.
- `app-g3-inline`: the merge and drop inline forms.
- `app-g3-pane-empty`: the empty pane text when no question is chosen.
- `app-g3-rt-item--here`: marks the open step in the task list (left bar and tint, not colour alone: the step name is bold and the status word shows).
- `app-g3-rt-count`: the steps-complete count line.
- `app-g3-rt-sec`, `app-g3-rt-sec--here`: layout B's step section and its open marker.
- `app-g3-bn`: the business-number flag line, no margin.
- `app-g3-signed`: body state after sign-off; hides edit controls.
- `app-g3-rt-list`: the round trip step list.
- `app-g3-body`: a step's body inside the list (layout B).
- `app-g3-btnrow`: a button and the prototype-only select on one row.
- `app-g3-cols`, `app-g3-cols--paste`: two columns for the paste form, one under 720 px.
- `app-g3-sw`, `app-g3-sw-toggle`: the "second window" checkbox wrapper and its input hook.
- `app-g3-second`: the second-window checkbox beside the open-source button.
- `app-g3-focus`: layout B's one-question-at-a-time block (work on the left, source on the right, no pane).
- `app-g3-ws`: the work area grid, steps rail then content.

Keys: `r` Keep, `n` next, `p` previous, `o` open source, `/` search, `s` second window, `?` list. Each carries `aria-keyshortcuts`, repeats a visible button, and `#keys-on` turns them off. No single key unmarks, approves, signs or deletes.

Hooks: `data-identity-bar`, `data-evidence`, `data-primary`, `data-count`, `data-scope`, `data-form`, `data-goto`.
