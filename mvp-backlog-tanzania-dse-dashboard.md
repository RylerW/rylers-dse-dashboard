# MVP Backlog

## Project
Tanzania DSE Investor Dashboard

## Date
March 11, 2026

## Prioritization Method
- P0: Required to launch MVP
- P1: Important soon after MVP or if capacity allows
- P2: Later enhancements

## Epic 1: Foundations
### P0
- Set up the web app scaffold with TypeScript, linting, and environment management.
- Set up the PostgreSQL database and ORM schema.
- Configure authentication for persistent user accounts.
- Add shared layout, navigation, and error states.

### Acceptance Criteria
- App runs in local and deployment environments.
- Authenticated and unauthenticated states are supported.
- Database migrations can be applied repeatably.

## Epic 2: Security Master Data
### P0
- Define canonical security schema.
- Create seed process for DSE-listed securities.
- Store ticker, company name, sector, listing type, and status.
- Expose a searchable securities API for watchlist selection.

### Acceptance Criteria
- Users can search and select DSE securities by name or ticker.
- Duplicate securities are prevented.

## Epic 3: Market Data Ingestion
### P0
- Build the first DSE source adapter.
- Fetch daily market data from the chosen public DSE source.
- Parse and normalize latest daily pricing fields.
- Persist price snapshots with market date and ingestion timestamp.
- Create ingestion run logs with success and failure details.

### P1
- Add fallback parsing for alternate DSE source formats.
- Store raw payload metadata for auditability.
- Add retry logic for transient source failures.

### Acceptance Criteria
- A successful ingestion run stores one daily snapshot per tracked security for the market date.
- Failed rows are logged without breaking the whole run.
- Duplicate snapshots for the same security and date are prevented.

## Epic 4: Market Overview Dashboard
### P0
- Build dashboard header with last updated and market date.
- Show top gainers and top losers.
- Show tracked securities count.
- Show most active by volume if the field is available.
- Add stale-data state when latest market date is older than expected.

### P1
- Add sector filter.
- Add market breadth indicators if source coverage supports them.

### Acceptance Criteria
- User can open the home page and immediately identify daily risers and fallers.
- All market cards display source and freshness context.

## Epic 5: Watchlists
### P0
- Create watchlist CRUD.
- Add and remove securities from a watchlist.
- Display watchlist table with latest price, absolute change, percent change, and volume if available.
- Support one default watchlist for the first release.

### P1
- Support multiple named watchlists.
- Add sorting by price move, price, and ticker.

### Acceptance Criteria
- Logged-in user can save a watchlist and return to it later.
- Watchlist rows update after new ingestion runs.

## Epic 6: Security Detail View
### P0
- Build security detail page with current price summary.
- Show 1D, 7D, 30D, and 90D percentage changes.
- Show historical chart using daily close or latest price.
- Display issuer metadata and listing type.

### P1
- Add comparative mini-chart versus sector average if available.
- Add recent announcements or news links.

### Acceptance Criteria
- User can open a security and understand short-term and medium-term direction.
- Missing history is shown clearly instead of breaking the chart.

## Epic 7: Alerts
### P0
- Create alert rules for price above and price below.
- Create alert rules for daily percent rise and daily percent drop.
- Run alert evaluation after each successful ingestion.
- Store in-app alert records.
- Send email notifications.

### P1
- Add alert mute period or digest options.
- Add SMS or WhatsApp integration if legally and technically viable.

### Acceptance Criteria
- User receives an alert when a saved rule is satisfied by the latest snapshot.
- Duplicate notifications for the same rule and market date are suppressed.

## Epic 8: Admin And Ops
### P0
- Build admin page showing latest ingestion run statuses.
- Show records inserted, updated, failed, and market date coverage.
- Show latest alert job run summary.

### P1
- Add row-level failed record inspection.
- Add manual re-run control for admins.

### Acceptance Criteria
- Admin can quickly diagnose stale or failed market updates.

## Epic 9: Quality And Reliability
### P0
- Add unit tests for parsing and change calculations.
- Add integration tests for ingestion to database flow.
- Add API tests for watchlists and alerts.
- Add monitoring and structured logging.

### P1
- Add synthetic health check for dashboard freshness.
- Add screenshot or E2E tests for primary user journeys.

### Acceptance Criteria
- Critical parsing and alert logic are covered by automated tests.
- Production logs are sufficient to debug ingestion and alert issues.

## Suggested Sprint Plan
### Sprint 1
- Foundations
- Security master data
- Initial ingestion pipeline skeleton

### Sprint 2
- Complete daily ingestion
- Market overview dashboard
- Basic stale-data handling

### Sprint 3
- Watchlists
- Security detail page with chart

### Sprint 4
- Alerts
- Email notifications
- Admin ops page

### Sprint 5
- Hardening
- Testing
- Launch readiness

## Launch Checklist
### Product
- PRD signed off
- MVP scope frozen
- Legal and disclaimer copy reviewed

### Data
- Source of record confirmed
- Daily market date validation working
- Historical backfill strategy decided

### Engineering
- Migrations finalized
- Ingestion scheduler active
- Error monitoring enabled
- Backup and rollback plan documented

### Go-To-Market
- Landing page copy ready
- User onboarding flow ready
- Support email or contact path configured

## Candidate Tickets
1. Create Prisma schema for securities, snapshots, watchlists, alerts, notifications, and ingestion runs.
2. Implement `GET /api/securities` search endpoint.
3. Implement DSE source adapter interface.
4. Implement first parser for the selected DSE daily data source.
5. Compute daily absolute and percent change during snapshot upsert.
6. Build dashboard overview API.
7. Build dashboard home screen.
8. Implement watchlist storage and add/remove actions.
9. Build security detail history endpoint.
10. Build security detail UI with chart.
11. Implement alert creation endpoint.
12. Implement alert evaluation job.
13. Integrate email notification provider.
14. Build admin ingestion status page.
15. Add tests for parser and alert engine.
