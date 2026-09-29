# 05 Eglinton Holdings Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Daniel Okafor (Test) owns Eglinton Holdings Inc. (Test), a holding company. It owns 100% of Eglinton Retail Ltd. (Test) (client 06), a portfolio of listed shares and ETF units, and GICs. It receives dividends from the retail company and pays dividends to Daniel.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | A: Lakeview Bank (Test) chequing | CAD | lakeview-chequing-3318.csv | 56 | 78539.01 | 206767.21 |
| BRK | Crestview Investing (Test) | CAD | crestview-brokerage-9051.csv | 34 | 3203.14 | 49023.76 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Dividends from 06: $60,000.00 on 30 Jun and $40,000.00 on 15 Dec 2025.
- GIC interest $8,000.00 ($2,000.00 each quarter); listed-share dividends $11,800.00 (eligible, $2,950.00 each quarter).
- Sale of ETF units on 12 Sep 2025: proceeds $175,000.00, cost $85,000.00.
- Capital dividend of $30,000.00 paid 20 Nov 2025 with no election filed (onboarding says so).
- Dividend of $25,000.00 on 20 Dec 2025 (a Saturday), designated eligible.
- Onboarding says Holdco keeps $100,000.00 of the business limit; 06 allocates the whole $500,000.00 to itself.
- Volumes are low on purpose: a holding company has few transactions.

## What each check should find

- **investment income over $50,000 in the group: business limit reduction** (05-F01, a person decides): Interest $8,000.00 plus a taxable capital gain of $45,000.00 (half of the $90,000.00 gain on the ETF sale; inclusion rate confirm) is $53,000.00, over the $50,000.00 threshold, before anything Eglinton Retail adds. Portfolio and connected dividends are left out of that sum (confirm). The reduction of the business limit is computed by Taxprep and must be reflected in the Schedule 23 agreement.
- **capital dividend paid with no election filed** (05-F02, a person decides): A $30,000.00 capital dividend was paid 20 Nov 2025 and onboarding says no election was filed. A capital dividend is tax-free only with an election made at or before payment. A person decides how to fix it (late election with penalty, or treat as an ordinary dividend) (confirm). It is not reported as an ordinary T5 dividend by the client.
- **eligible dividend designated above GRIP** (05-F03, a person decides): The $25,000.00 dividend on 20 Dec 2025 is designated eligible. The client's own note gives a general rate income pool of $3,000.00 at the start of the year; eligible dividends received ($11,800.00 from listed shares) may add to it, but the designation looks well above GRIP. Risk of an excessive eligible dividend designation (Schedule 53). A person checks.
- **business limit allocation contradicts Eglinton Retail** (05-F04, a person decides): This company's onboarding says Holdco keeps $100,000.00 of the business limit. Eglinton Retail Ltd. (Test) allocates the whole $500,000.00 to itself. The two agreements add to $600,000.00. Schedule 23 needs one agreement that adds to no more than the limit. A person asks the client.
- **dividends from a connected corporation** (05-F05): $60,000.00 (30 Jun) and $40,000.00 (15 Dec) came from Eglinton Retail Ltd. (Test), a 100% owned subsidiary: Schedule 3, connected. Part IV tax depends on the subsidiary's dividend refund (Taxprep, with 06's return).
- **capital gain on ETF units** (05-F06): Sold 4,000 ETF units 12 Sep 2025: proceeds $175,000.00, adjusted cost base $85,000.00, gain $90,000.00. Schedule 6. The non-taxable half feeds the capital dividend account; the $30,000.00 capital dividend must fit inside it (Taxprep).
- **not registered for HST** (05-F07): The company is not registered: expenses carry HST inside the cost, no input tax credits. A person confirms it makes no taxable supplies.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 78539.01 | 78120.11 | -418.90 | yes |
| CHQ | 2025-02 | 78120.11 | 17701.21 | -60418.90 | yes |
| CHQ | 2025-03 | 17701.21 | 17232.31 | -468.90 | yes |
| CHQ | 2025-04 | 17232.31 | 16813.41 | -418.90 | yes |
| CHQ | 2025-05 | 16813.41 | 16394.51 | -418.90 | yes |
| CHQ | 2025-06 | 16394.51 | 75975.61 | 59581.10 | yes |
| CHQ | 2025-07 | 75975.61 | 75556.71 | -418.90 | yes |
| CHQ | 2025-08 | 75556.71 | 75137.81 | -418.90 | yes |
| CHQ | 2025-09 | 75137.81 | 224718.91 | 149581.10 | yes |
| CHQ | 2025-10 | 224718.91 | 224300.01 | -418.90 | yes |
| CHQ | 2025-11 | 224300.01 | 192186.11 | -32113.90 | yes |
| CHQ | 2025-12 | 192186.11 | 206767.21 | 14581.10 | yes |
| BRK | 2025-01 | 3203.14 | 3198.19 | -4.95 | yes |
| BRK | 2025-02 | 3198.19 | 4283.25 | 1085.06 | yes |
| BRK | 2025-03 | 4283.25 | 9228.30 | 4945.05 | yes |
| BRK | 2025-04 | 9228.30 | 9223.35 | -4.95 | yes |
| BRK | 2025-05 | 9223.35 | 9218.40 | -4.95 | yes |
| BRK | 2025-06 | 9218.40 | 14163.45 | 4945.05 | yes |
| BRK | 2025-07 | 14163.45 | 14158.50 | -4.95 | yes |
| BRK | 2025-08 | 14158.50 | 14153.55 | -4.95 | yes |
| BRK | 2025-09 | 14153.55 | 44088.61 | 29935.06 | yes |
| BRK | 2025-10 | 44088.61 | 44083.66 | -4.95 | yes |
| BRK | 2025-11 | 44083.66 | 44078.71 | -4.95 | yes |
| BRK | 2025-12 | 44078.71 | 49023.76 | 4945.05 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- The brokerage export carries about three rows a month on purpose (a small admin fee each month, dividends, GIC interest, one sale).
