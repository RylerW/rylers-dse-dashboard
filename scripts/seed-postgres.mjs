import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed Postgres.");
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
});

const db = JSON.parse(await readFile("data/db.json", "utf8"));

await sql.begin(async (tx) => {
  for (const security of db.securities) {
    await tx`
      insert into securities (id, ticker, company_name, sector, listing_type, listing_date, is_active)
      values (${security.id}, ${security.ticker}, ${security.companyName}, ${security.sector}, ${security.listingType}, ${security.listingDate}, ${security.isActive})
      on conflict (id) do update set
        ticker = excluded.ticker,
        company_name = excluded.company_name,
        sector = excluded.sector,
        listing_type = excluded.listing_type,
        listing_date = excluded.listing_date,
        is_active = excluded.is_active
    `;
  }

  for (const snapshot of db.snapshots) {
    await tx`
      insert into price_snapshots (
        id, security_id, market_date, open_price, high_price, low_price, last_price,
        previous_close, absolute_change, percent_change, volume, source_name,
        source_reference, ingested_at
      ) values (
        ${snapshot.id}, ${snapshot.securityId}, ${snapshot.marketDate}, ${snapshot.openPrice}, ${snapshot.highPrice}, ${snapshot.lowPrice}, ${snapshot.lastPrice},
        ${snapshot.previousClose}, ${snapshot.absoluteChange}, ${snapshot.percentChange}, ${snapshot.volume}, ${snapshot.sourceName},
        ${snapshot.sourceReference}, ${snapshot.ingestedAt}
      )
      on conflict (security_id, market_date) do update set
        open_price = excluded.open_price,
        high_price = excluded.high_price,
        low_price = excluded.low_price,
        last_price = excluded.last_price,
        previous_close = excluded.previous_close,
        absolute_change = excluded.absolute_change,
        percent_change = excluded.percent_change,
        volume = excluded.volume,
        source_name = excluded.source_name,
        source_reference = excluded.source_reference,
        ingested_at = excluded.ingested_at
    `;
  }

  for (const watchlist of db.watchlists) {
    await tx`
      insert into watchlists (id, user_id, name)
      values (${watchlist.id}, ${watchlist.userId}, ${watchlist.name})
      on conflict (id) do update set user_id = excluded.user_id, name = excluded.name
    `;
  }

  for (const item of db.watchlistItems) {
    await tx`
      insert into watchlist_items (id, watchlist_id, security_id)
      values (${item.id}, ${item.watchlistId}, ${item.securityId})
      on conflict (watchlist_id, security_id) do nothing
    `;
  }

  for (const alert of db.alerts) {
    await tx`
      insert into alerts (id, user_id, security_id, type, threshold_value, channel, is_active, last_triggered_at)
      values (${alert.id}, ${alert.userId}, ${alert.securityId}, ${alert.type}, ${alert.thresholdValue}, ${alert.channel}, ${alert.isActive}, ${alert.lastTriggeredAt})
      on conflict (id) do update set
        user_id = excluded.user_id,
        security_id = excluded.security_id,
        type = excluded.type,
        threshold_value = excluded.threshold_value,
        channel = excluded.channel,
        is_active = excluded.is_active,
        last_triggered_at = excluded.last_triggered_at
    `;
  }

  for (const notification of db.notifications) {
    await tx`
      insert into notifications (id, user_id, alert_id, security_id, title, body, channel, status, created_at, sent_at)
      values (${notification.id}, ${notification.userId}, ${notification.alertId}, ${notification.securityId}, ${notification.title}, ${notification.body}, ${notification.channel}, ${notification.status}, ${notification.createdAt}, ${notification.sentAt})
      on conflict (id) do update set
        user_id = excluded.user_id,
        alert_id = excluded.alert_id,
        security_id = excluded.security_id,
        title = excluded.title,
        body = excluded.body,
        channel = excluded.channel,
        status = excluded.status,
        created_at = excluded.created_at,
        sent_at = excluded.sent_at
    `;
  }

  for (const run of db.ingestionRuns) {
    await tx`
      insert into ingestion_runs (
        id, source_name, market_date, status, records_seen, records_inserted, records_updated,
        records_failed, started_at, completed_at, error_summary
      ) values (
        ${run.id}, ${run.sourceName}, ${run.marketDate}, ${run.status}, ${run.recordsSeen}, ${run.recordsInserted}, ${run.recordsUpdated},
        ${run.recordsFailed}, ${run.startedAt}, ${run.completedAt}, ${run.errorSummary}
      )
      on conflict (id) do update set
        source_name = excluded.source_name,
        market_date = excluded.market_date,
        status = excluded.status,
        records_seen = excluded.records_seen,
        records_inserted = excluded.records_inserted,
        records_updated = excluded.records_updated,
        records_failed = excluded.records_failed,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        error_summary = excluded.error_summary
    `;
  }
});

await sql.end();
console.log("Seeded Postgres from data/db.json.");
