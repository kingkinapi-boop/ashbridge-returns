# .GFI file from QBO Accountant Workpapers (walker attempt, 1 Oct 2026)

Status: BLOCKED. No .GFI was produced. Nothing in the file format is known yet.

## What was found

- The extension had two Chromes connected, both named "Browser 1" and "Browser 2". `switch_browser` let Zo pick; it selected "Ashbridge Test".
- In that Chrome, qbo.intuit.com opens only the company "Sandbox Company CA 7cf6" (a regular QBO company, the same one earlier walkers found). Signed in as "Z".
- `/app/accountantdashboard` shows "We're sorry, we can't find the page you requested." The settings (gear) menu shows only company tools (Your Company, Lists, Tools, Profile). No Accountant view, no client list, no "Add client", no Workpapers.
- So the session is signed in to QBO, not to QuickBooks Online Accountant. The decision 0015 premise ("signed in to QBO Accountant") does not hold in this window.

## Not done

- No client "Probe Co. (Test)" was added, so none needed deleting. No accounts, no mapping, no export, no download. No file copied to the inbox.
- No real client was opened. No billing, subscription or invite screen was opened (the "Subscriptions and billing" link was only visible in the menu, not clicked).

## What is needed

Zo signs in to QuickBooks Online Accountant (the firm's accountant login, an accountant.qbo.intuit.com style page, or the "Go to QuickBooks Accountant" switch from the apps menu if the account has it) in the "Ashbridge Test" Chrome. Then rerun the walker.

## Open questions (unchanged)

Click path, record layout, field order, separators, header lines, sign conventions, what Workpapers needs before export.
