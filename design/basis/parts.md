# Parts the designs may use (D00, RV-52)

Every design page and screen uses only the parts below, from the official `govuk-frontend` 6.x and `@ministryofjustice/frontend` 11.x. Where both offer a part, use GOV.UK's. The Ashbridge Tax brand enters only through `settings.scss` (RV-55). Source of the choices: `reference/design-basis.md`.

## GOV.UK parts

Skip link, Generic header (logo, service name; never the crown or logotype), service navigation, button, tag, table (numeric cells), summary list, text input, radios (small), error summary, error message, notification banner, task list, details, file upload, fieldset, inset text, warning text, pagination (results count only), interruption panel, footer.

## MOJ parts and their status

| Part | MOJ status | Use |
|---|---|---|
| Alert | Official | In-page state such as approval void |
| Button menu | Official | Actions on the identity bar |
| Pagination | Official | Results count only |
| Identity bar | To be reviewed | Every return screen |
| Sortable table | To be reviewed | Lists over 5 rows |
| Side navigation | To be reviewed | Section list (coverage tracker) |
| Timeline | To be reviewed | Notes and comments |
| Filter, filter a list | To be reviewed | Lists that outgrow a screen |
| Multi select | To be reviewed | Bulk actions |
| Scrollable pane | To be reviewed | Panes that scroll |
| Add another | To be reviewed | Repeated judgment items |
| Page header actions | To be reviewed | Page actions |
| Contextual date | Experimental | Filing and balance-due dates, with a plain-text fallback |
| Confirm an action | Experimental | Approve and sign steps |
| Numeric data | Experimental | Owner board measures |
| Progress tracker | Experimental | Not used until reviewed |

Experimental parts are not used on a live screen until a design sitting accepts them. Archived parts are never used.

## `app-` exceptions (GOV.UK and MOJ have no such part)

| Class | Reason |
|---|---|
| `app-width-container--wide` | Wide container, up to 1600 px, for tables and review screens (GOV.UK allows a wider page where content needs it). |
| `app-panes` | The three-pane review: trace, source and work side by side, each a labelled region (RV-4). No GOV.UK or MOJ split view exists. |
| `app-coverage-tracker` | The coverage tracker: sections reviewed, in order, with words, beside the Approve control (RV-5). Built on MOJ side navigation. |
| `app-shortcuts` | Keyboard shortcuts list under "Keyboard shortcuts" on every review page (RV-6). No GOV.UK or MOJ shortcut pattern. |
