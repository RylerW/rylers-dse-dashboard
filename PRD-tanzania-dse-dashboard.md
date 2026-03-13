# Product Requirements Document

## Product Name
Tanzania DSE Investor Dashboard

## Document Status
Draft v1

## Date
March 11, 2026

## Problem Statement
Retail and self-directed investors interested in the Dar es Salaam Stock Exchange (DSE) lack a simple, trustworthy dashboard for tracking price rises and drops in selected securities. Public information exists, but it is fragmented and not packaged for quick decision support. This makes it hard to monitor watchlist names, spot momentum or weakness, and build conviction before investing.

## Product Vision
Build a lightweight investor dashboard that helps a new DSE investor monitor selected securities, understand recent price movement, and receive timely alerts when notable changes happen.

## Goal
Help the user move from passive market interest to active, informed monitoring of DSE-listed securities.

## Non-Goals
- This product will not place trades in the MVP.
- This product will not provide personalized financial advice.
- This product will not rely on real-time tick data unless DSE-approved premium access is later secured.
- This product will not support every African exchange in the MVP.

## Background And Market Context
The Dar es Salaam Stock Exchange is Tanzania's main securities exchange. Public DSE web properties expose market information such as listed securities and daily price movement fields, and the exchange also promotes formal market-data services. This suggests a practical phased approach:
- MVP: daily or end-of-day tracking using public DSE data.
- Phase 2: richer intraday or lower-latency data if licensed access becomes available.

## Target Users
### Primary User
A beginner or intermediate retail investor in Tanzania who wants to track a shortlist of DSE securities before investing.

### Secondary Users
- Existing DSE investors monitoring positions.
- Research-oriented users comparing multiple listed securities.

## User Needs
- See which watched securities are up or down today.
- Understand how much a security has moved over 1 day, 1 week, 1 month, and 3 months.
- Detect unusual price changes and volume changes.
- Get alerted when a watched security crosses a threshold.
- View enough context to decide whether a move is noise or meaningful.
- Trust the source and freshness of the data.

## Key User Stories
- As a new investor, I want to create a watchlist of DSE securities so I can focus on the names I care about.
- As a user, I want to see daily gainers and losers so I can quickly spot where price action is happening.
- As a user, I want to view a simple price chart and change percentages over common time windows so I can understand trend direction.
- As a user, I want alerts for percentage moves or price thresholds so I do not have to manually check every day.
- As a user, I want to know when the data was last updated so I can judge whether it is actionable.
- As a user, I want basic issuer details and sector tags so I can understand what I am watching.

## MVP Scope
### 1. Market Overview
- Show DSE market summary cards:
  - Number of tracked securities
  - Top 5 gainers
  - Top 5 losers
  - Most active by volume, if available
  - Last data refresh timestamp

### 2. Watchlist
- User can add and remove DSE securities from a personal watchlist.
- Each watchlist row displays:
  - Ticker or code
  - Company name
  - Last price
  - Daily absolute change
  - Daily percentage change
  - Volume, if available
  - 7-day trend indicator
  - Alert status

### 3. Security Detail View
- Detail page for each security shows:
  - Current or latest available price
  - Daily open, high, low, close, if available
  - Historical price chart
  - Percentage change over 1D, 7D, 30D, 90D
  - Average volume over recent periods, if available
  - Basic company metadata:
    - Sector
    - Listing date, if available
    - Local or cross-listed status

### 4. Alerts
- Users can create alerts based on:
  - Price above a threshold
  - Price below a threshold
  - Daily percentage rise exceeds X%
  - Daily percentage drop exceeds X%
- Delivery channels in MVP:
  - In-app alert center
  - Email notification

### 5. Data Freshness And Trust
- Every dashboard view must show:
  - Data source
  - Last updated timestamp
  - Market date represented
  - A disclaimer that data may be delayed and is for informational purposes

### 6. Historical Tracking
- Store daily snapshots to support trend views, comparisons, and alert history.
- Retain at least 12 months of daily history in v1 if source coverage allows.

## Out Of Scope For MVP
- Brokerage integration or order placement
- AI-generated buy or sell recommendations
- Portfolio performance tracking across custodians
- Corporate actions automation beyond simple display
- Mobile-native apps
- Full real-time streaming market depth

## Product Requirements
### Functional Requirements
1. The system must ingest daily DSE market data from approved public or licensed sources.
2. The system must normalize securities into a consistent schema.
3. The system must compute daily absolute and percentage price changes.
4. The system must persist historical daily prices for trend analysis.
5. The system must let users create and manage a watchlist.
6. The system must let users create threshold-based alerts.
7. The system must trigger alerts after each successful data refresh.
8. The system must expose a dashboard UI optimized for desktop and mobile web.
9. The system must show when a security has missing or stale data.
10. The system must log ingestion failures and skipped records for admin review.

### Non-Functional Requirements
- Availability target: 99.0% monthly for the dashboard.
- Freshness target for MVP: same-day update after DSE publishes the relevant market data.
- Initial page load target: under 3 seconds on a standard mobile connection for the watchlist screen.
- Secure user authentication for saved watchlists and alerts.
- Auditability of all alert triggers and data refresh runs.

## Assumptions
- Public DSE data is sufficient for end-of-day or delayed daily monitoring in MVP.
- More granular intraday data may require a commercial or partner arrangement with DSE.
- The first version serves a small number of users and a limited set of tracked securities.
- Users care more about reliability and clarity than advanced analytics in v1.

## Risks And Constraints
### Data Risks
- Public DSE data formats may change without notice.
- Some fields such as intraday high, low, or volume may be inconsistent or unavailable.
- Historical backfill may be incomplete.

### Compliance Risks
- The product must avoid language that can be interpreted as regulated investment advice.
- Licensing terms for DSE data need to be verified before commercial launch.

### Product Risks
- DSE users may expect near-real-time updates even if the source is delayed.
- Low-liquidity securities may produce sparse or misleading short-term trend signals.

## Success Metrics
### Product Metrics
- 80% of active users create at least one watchlist in their first session.
- 60% of active users return at least 3 times per week.
- 40% of active users configure at least one alert.

### Outcome Metrics
- Users can identify daily risers and fallers in under 30 seconds.
- Users report improved confidence in monitoring DSE opportunities before investing.

## UX Principles
- Keep the dashboard simple enough for first-time investors.
- Make gain and loss signals obvious without relying only on color.
- Always surface data freshness and source context.
- Prefer explainable metrics over opaque scoring.

## Proposed Screens
1. Home dashboard
2. Watchlist view
3. Security detail page
4. Alerts manager
5. Sign-in and profile
6. Admin or ops data-monitoring page

## Suggested Data Model
### Security
- security_id
- ticker
- company_name
- sector
- listing_type
- listing_date
- status

### Price Snapshot
- security_id
- market_date
- last_price
- open_price
- high_price
- low_price
- previous_close
- absolute_change
- percent_change
- volume
- source_name
- ingested_at

### Watchlist
- watchlist_id
- user_id
- name

### Watchlist Item
- watchlist_id
- security_id

### Alert
- alert_id
- user_id
- security_id
- alert_type
- threshold_value
- delivery_channel
- is_active
- last_triggered_at

## MVP Workflow
1. System fetches DSE data on a scheduled job.
2. System validates, normalizes, and stores daily snapshots.
3. User signs in and creates a watchlist.
4. User opens dashboard and sees movers plus watchlist changes.
5. User opens a security detail page for trend context.
6. User creates alerts for thresholds or sharp daily moves.
7. System evaluates alerts after each data refresh and sends notifications.

## Analytics And Reporting
- Track most-watched securities.
- Track alert creation and trigger rates.
- Track dashboard screen engagement and repeat usage.
- Track stale-data incidents and ingestion error rates.

## Recommended MVP Tech Direction
### Frontend
- Responsive web app
- Charting library for simple historical price charts

### Backend
- Scheduled ingestion service
- API for securities, prices, watchlists, and alerts
- Relational database for normalized market and user data

### Data Ingestion
- Source adapter layer so the team can swap from public scraping or extraction to licensed feeds later without rewriting the app

## Release Plan
### Phase 1: MVP
- Public-data daily tracking
- Watchlist
- Top movers
- Historical daily chart
- Basic alerts

### Phase 2
- Better historical backfill
- News or announcement linkage
- Sector filters
- More advanced volume and momentum views

### Phase 3
- Licensed lower-latency data
- Portfolio tracking
- Broker integration if commercially viable

## Open Questions
- What exact DSE source will be the system of record for daily prices?
- Are official APIs available, or will the MVP begin with website extraction?
- What licensing or permission is required for public redistribution of DSE data?
- Should the first release support only equities, or also bonds and ETFs?
- Does the user want email only, or also WhatsApp or SMS alerts?
- Is sign-in required for launch, or can the first cut store watchlists locally in the browser?

## Recommended Next Step
Convert this PRD into a lean implementation plan with:
- architecture
- data ingestion design
- screen wireframes
- MVP backlog with priorities

## Notes From Current Research
- DSE public properties currently show market data and listed-securities information.
- DSE also advertises formal market-data services, which is relevant for a later upgrade path.
- Tanzania launched the iTrust EAC Large Cap ETF on DSE in 2026, so ETF support should be considered even if equities are the MVP focus.
