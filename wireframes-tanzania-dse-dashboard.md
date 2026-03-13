# Low-Fidelity Wireframes

## Project
Tanzania DSE Investor Dashboard

## Date
March 11, 2026

## Notes
- These are low-fidelity structural wireframes for MVP planning.
- Content assumes daily or delayed market data.
- Labels can change during design.

## 1. Dashboard Home
```text
+----------------------------------------------------------------------------------+
| Tanzania DSE Investor Dashboard                            User   Alerts   Admin |
+----------------------------------------------------------------------------------+
| Market Date: 2026-03-11   Last Updated: 18:10 EAT   Source: DSE   Status: Fresh |
+----------------------------------------------------------------------------------+
| [Tracked Securities: 28] [Top Gainer: TICK +4.2%] [Top Loser: TICK -3.1%]       |
| [Most Active: TICK 120,000]                                                      |
+----------------------------------------------------------------------------------+
| Top Gainers                              | Top Losers                            |
|------------------------------------------|---------------------------------------|
| 1. TICK   Company Name        +4.2%      | 1. TICK   Company Name       -3.1%    |
| 2. TICK   Company Name        +3.4%      | 2. TICK   Company Name       -2.8%    |
| 3. TICK   Company Name        +2.6%      | 3. TICK   Company Name       -2.1%    |
| 4. TICK   Company Name        +1.9%      | 4. TICK   Company Name       -1.7%    |
| 5. TICK   Company Name        +1.2%      | 5. TICK   Company Name       -1.2%    |
+----------------------------------------------------------------------------------+
| My Watchlist                                                                  >  |
|----------------------------------------------------------------------------------|
| Ticker | Company         | Last Price | Change | % Change | Volume | Trend |     |
| NMB    | NMB Bank        | 4,500      | +120   | +2.7%    | 82,000 | up    | !   |
| TBL    | Tanzania Brewer.| 9,800      | -100   | -1.0%    | 10,500 | down  | -   |
| CRDB   | CRDB Bank       | 650        | +25    | +4.0%    | 95,000 | up    | !   |
+----------------------------------------------------------------------------------+
| Footer: Informational use only. Data may be delayed.                            |
+----------------------------------------------------------------------------------+
```

## 2. Watchlist Screen
```text
+----------------------------------------------------------------------------------+
| Watchlist: My DSE Picks                                      [+ Add Security]    |
+----------------------------------------------------------------------------------+
| Search: [ CRD...                     ]   Sort: [% Change v]   Filter: [All v]    |
+----------------------------------------------------------------------------------+
| Ticker | Company Name     | Last | Abs Chg | % Chg | 7D | 30D | Volume | Alerts |
|----------------------------------------------------------------------------------|
| CRDB   | CRDB Bank        | 650  | +25     | +4.0% | up | up  | 95,000 | On     |
| NMB    | NMB Bank         | 4500 | +120    | +2.7% | up | up  | 82,000 | On     |
| TCCL   | Tanzania Cement  | 2700 | -40     | -1.5% | dn | up  | 11,200 | Off    |
| TBL    | Tanzania Brewer. | 9800 | -100    | -1.0% | dn | dn  | 10,500 | Off    |
+----------------------------------------------------------------------------------+
| Row actions: [View] [Create Alert] [Remove]                                     |
+----------------------------------------------------------------------------------+
```

## 3. Security Detail Screen
```text
+----------------------------------------------------------------------------------+
| CRDB Bank (CRDB)                                              [Add to Watchlist] |
+----------------------------------------------------------------------------------+
| Last Price: 650    Change: +25 (+4.0%)    Volume: 95,000    Sector: Banking      |
| Market Date: 2026-03-11    Last Updated: 18:10 EAT    Listing: Local              |
+----------------------------------------------------------------------------------+
| Range: [1D] [7D] [30D] [90D] [1Y]                                                |
|----------------------------------------------------------------------------------|
|                                 PRICE CHART                                      |
|                             historical line area                                 |
|----------------------------------------------------------------------------------|
| Change Summary                                                                    |
| 1D: +4.0%      7D: +5.8%      30D: +9.2%      90D: +12.7%                        |
+----------------------------------------------------------------------------------+
| Company Info                                                                       |
| Sector: Banking                                                                    |
| Listing Type: Local                                                                |
| Listing Date: 2009-06-17                                                           |
| Alerts: [Create Price Alert] [Create % Move Alert]                                |
+----------------------------------------------------------------------------------+
```

## 4. Alerts Screen
```text
+----------------------------------------------------------------------------------+
| Alerts                                                               [+ New Alert]|
+----------------------------------------------------------------------------------+
| Security | Rule Type            | Threshold | Channel | Status | Last Triggered  |
|----------------------------------------------------------------------------------|
| CRDB     | Price above          | 700       | Email   | Active | Never           |
| NMB      | Daily gain exceeds   | 3%        | Email   | Active | 2026-03-08      |
| TBL      | Price below          | 9500      | In-app  | Paused | 2026-03-02      |
+----------------------------------------------------------------------------------+
| New Alert Drawer                                                                   |
| Security:   [CRDB v]                                                               |
| Rule Type:  [Price Above v]                                                        |
| Value:      [700      ]                                                            |
| Channel:    [Email v ]                                                             |
| Actions:    [Save Alert] [Cancel]                                                  |
+----------------------------------------------------------------------------------+
```

## 5. Admin Data Health Screen
```text
+----------------------------------------------------------------------------------+
| Admin: Data Health                                                                |
+----------------------------------------------------------------------------------+
| Latest Market Date: 2026-03-11   Latest Run: Success   Started: 18:05            |
+----------------------------------------------------------------------------------+
| Run History                                                                        |
|----------------------------------------------------------------------------------|
| Run ID | Market Date | Status  | Seen | Inserted | Updated | Failed | Duration   |
| 1042   | 2026-03-11  | Success | 28   | 0        | 28      | 0      | 00:01:32   |
| 1041   | 2026-03-10  | Success | 28   | 0        | 28      | 0      | 00:01:28   |
| 1040   | 2026-03-09  | Partial | 28   | 0        | 25      | 3      | 00:01:41   |
+----------------------------------------------------------------------------------+
| Failed Records Summary                                                             |
| - 2026-03-09: 3 rows missing price value                                           |
| - Action: [View Details] [Retry Source Fetch]                                      |
+----------------------------------------------------------------------------------+
```

## 6. Mobile Dashboard Sketch
```text
+--------------------------------------+
| Tanzania DSE Dashboard               |
| Market Date: 2026-03-11              |
| Updated: 18:10 EAT                   |
+--------------------------------------+
| Top Gainer                           |
| TICK +4.2%                           |
+--------------------------------------+
| Top Loser                            |
| TICK -3.1%                           |
+--------------------------------------+
| My Watchlist                         |
| CRDB   650   +4.0%                   |
| NMB    4500  +2.7%                   |
| TBL    9800  -1.0%                   |
+--------------------------------------+
| Nav: Home | Watchlist | Alerts       |
+--------------------------------------+
```

## Wireframe Notes
- Dashboard home should prioritize top movers and the user's watchlist above everything else.
- Security detail should make the trend and freshness legible before deeper metadata.
- Alerts creation should be fast enough to complete in one small form.
- Admin data health should help diagnose stale data in under one minute.
