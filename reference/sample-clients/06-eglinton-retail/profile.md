# 06 Eglinton Retail Ltd. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Eglinton Retail Ltd. (Test) is owned 100% by Eglinton Holdings Inc. (Test) (client 05). It sells home goods online: Shopify payouts in CAD twice a week and Stripe payouts in USD (about 35% of sales, US customers). It buys stock from suppliers in both currencies and pays a fulfilment company.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | B: Maplestone Bank (Test) chequing | CAD | maplestone-chequing-cad-1176.csv | 421 | 13708.94 | 144945.45 |
| USD | B: Maplestone Bank (Test) chequing | USD | maplestone-chequing-usd-1183.csv | 144 | 25000.00 | 43502.36 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-5527.csv | 578 | 462.49 | 9941.87 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Shopify payouts in CAD twice a week (Tuesday and Friday); US customers through Stripe into the USD account (Monday and Thursday), about 35% of sales, zero-rated.
- Opening inventory $42,000.00; closing count $51,500.00 (onboarding).
- Year-end exchange rate in onboarding (1.3900), marked as a test rate.
- Dividends to 05: $60,000.00 on 30 Jun and $40,000.00 on 15 Dec 2025.
- Onboarding allocates the whole $500,000 business limit to this company; 05 says it keeps $100,000.

## What each check should find

- **shared business limit set inconsistently with Eglinton Holdings** (06-F01, a person decides): Onboarding here allocates the whole $500,000.00 business limit to this company. Eglinton Holdings Inc. (Test) says it keeps $100,000.00. The two add to $600,000.00. One agreement on Schedule 23 is needed (associated corporations). A person asks the owner.
- **zero-rated exports: no HST on US sales** (06-F02): About 35% of sales go to US customers through Stripe into the US-dollar account. They are zero-rated exports: no HST collected, and evidence of export is kept. Canadian Shopify sales carry 13% HST.
- **foreign exchange: year-end revaluation at a test rate** (06-F03, a person decides): US-dollar balance revalued at 1.3900 (marked as a test rate in onboarding). Conversions to CAD show the bank spread as an exchange loss.
- **inventory count: closing $51,500.00 against opening $42,000.00** (06-F04): The count at year end is $51,500.00. Opening inventory $42,000.00 goes to cost of sales (8300) and the count to closing inventory (8500).
- **dividends to the holding company** (06-F05): $60,000.00 on 30 Jun and $40,000.00 on 15 Dec 2025 to Eglinton Holdings Inc. (Test): Schedule 3 dividends paid, designation (client says ordinary), dividend refund and Part IV on the holding company's side. No T5 for a corporate shareholder (confirm).
- **payouts are net of processor fees** (06-F06): Shopify and Stripe payouts are sales (with HST for Shopify) less fees. Gross them up: fees to 6076 (processing fees), sales to 4010 or 4020.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 13708.94 | 39508.58 | 25799.64 | yes |
| CHQ | 2025-02 | 39508.58 | 57981.54 | 18472.96 | yes |
| CHQ | 2025-03 | 57981.54 | 79950.68 | 21969.14 | yes |
| CHQ | 2025-04 | 79950.68 | 90839.36 | 10888.68 | yes |
| CHQ | 2025-05 | 90839.36 | 101158.14 | 10318.78 | yes |
| CHQ | 2025-06 | 101158.14 | 69185.42 | -31972.72 | yes |
| CHQ | 2025-07 | 69185.42 | 96851.55 | 27666.13 | yes |
| CHQ | 2025-08 | 96851.55 | 114482.90 | 17631.35 | yes |
| CHQ | 2025-09 | 114482.90 | 134641.67 | 20158.77 | yes |
| CHQ | 2025-10 | 134641.67 | 146951.92 | 12310.25 | yes |
| CHQ | 2025-11 | 146951.92 | 157852.54 | 10900.62 | yes |
| CHQ | 2025-12 | 157852.54 | 144945.45 | -12907.09 | yes |
| USD | 2025-01 | 25000.00 | 26751.40 | 1751.40 | yes |
| USD | 2025-02 | 26751.40 | 23931.79 | -2819.61 | yes |
| USD | 2025-03 | 23931.79 | 17330.71 | -6601.08 | yes |
| USD | 2025-04 | 17330.71 | 18478.28 | 1147.57 | yes |
| USD | 2025-05 | 18478.28 | 27502.16 | 9023.88 | yes |
| USD | 2025-06 | 27502.16 | 27158.18 | -343.98 | yes |
| USD | 2025-07 | 27158.18 | 34672.62 | 7514.44 | yes |
| USD | 2025-08 | 34672.62 | 42213.81 | 7541.19 | yes |
| USD | 2025-09 | 42213.81 | 41934.10 | -279.71 | yes |
| USD | 2025-10 | 41934.10 | 43242.80 | 1308.70 | yes |
| USD | 2025-11 | 43242.80 | 44578.74 | 1335.94 | yes |
| USD | 2025-12 | 44578.74 | 43502.36 | -1076.38 | yes |
| BCD | 2025-01 | 462.49 | 10447.11 | -9984.62 | yes |
| BCD | 2025-02 | 10447.11 | 9794.15 | 652.96 | yes |
| BCD | 2025-03 | 9794.15 | 10153.08 | -358.93 | yes |
| BCD | 2025-04 | 10153.08 | 11118.07 | -964.99 | yes |
| BCD | 2025-05 | 11118.07 | 8334.06 | 2784.01 | yes |
| BCD | 2025-06 | 8334.06 | 8456.97 | -122.91 | yes |
| BCD | 2025-07 | 8456.97 | 10275.24 | -1818.27 | yes |
| BCD | 2025-08 | 10275.24 | 9804.00 | 471.24 | yes |
| BCD | 2025-09 | 9804.00 | 9946.53 | -142.53 | yes |
| BCD | 2025-10 | 9946.53 | 11516.46 | -1569.93 | yes |
| BCD | 2025-11 | 11516.46 | 10595.80 | 920.66 | yes |
| BCD | 2025-12 | 10595.80 | 9941.87 | 653.93 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- Import duty and HST paid at the border on inventory are not modelled.
- USD rows are in US dollars in the account files and QBO files; the answer key posts them in Canadian dollars at the monthly test rates in the exchange table below.
- Test rates (CAD per USD): open 1.4380, 2025-01 1.4400, 2025-02 1.4350, 2025-03 1.4300, 2025-04 1.4050, 2025-05 1.3900, 2025-06 1.3700, 2025-07 1.3750, 2025-08 1.3800, 2025-09 1.3900, 2025-10 1.4000, 2025-11 1.3950, 2025-12 1.3850.
