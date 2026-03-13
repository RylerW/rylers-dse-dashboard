import { randomUUID } from "node:crypto";
import { cache } from "react";

import { fetchLatestDseMarketData } from "@/lib/dse-source";
import { emailDeliveryEnabled, getAlertEmailRecipient, sendAlertEmail } from "@/lib/email";
import { getSql } from "@/lib/postgres";
import type { Alert, Database, IngestionRun, MarketOverview, Notification, PriceSnapshot, Security, SecurityWithSnapshot, Trend } from "@/lib/types";

const SOURCE_NAME = "Dar es Salaam Stock Exchange";
const OFFICIAL_SOURCE_REFERENCE = "https://dse.co.tz/";
const USER_ID = "demo-investor";
const LIVE_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const AUTO_SYNC_ON_READ = process.env.AUTO_SYNC_ON_READ === "true";

let lastLiveSyncAttemptAt = 0;

const tickerAliases: Record<string, string> = {
  SWISSPORT: "SWIS",
  TWIGA: "TPCC",
};

function canonicalTicker(ticker: string) {
  return tickerAliases[ticker] ?? ticker;
}

function securityIdForTicker(ticker: string) {
  return `sec-${canonicalTicker(ticker).toLowerCase()}`;
}

function currentDseDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function inferSector(ticker: string) {
  if (["CRDB", "NMB", "DCB", "MKCB", "MBP", "KCB"].includes(ticker)) return "Banking";
  if (["TBL", "TCCL", "EABL", "KA"].includes(ticker)) return "Consumer Goods";
  if (["ITRUST", "VERTEX"].includes(ticker)) return "ETF";
  if (["SWIS"].includes(ticker)) return "Transport";
  if (["TPCC"].includes(ticker)) return "Industrial";
  if (["DSE"].includes(ticker)) return "Financial Services";
  return "Equity";
}

function inferListingType(ticker: string): Security["listingType"] {
  if (["ITRUST", "VERTEX"].includes(ticker)) return "ETF";
  if (["EABL", "KCB", "KA"].includes(ticker)) return "CROSS_LISTED";
  return "LOCAL";
}

function sortHistory(history: PriceSnapshot[]) {
  return [...history].sort((a, b) => a.marketDate.localeCompare(b.marketDate));
}

function computeTrend(history: PriceSnapshot[]): Trend {
  if (history.length < 2) return "FLAT";
  const ordered = sortHistory(history);
  const first = ordered.at(-5) ?? ordered[0];
  const last = ordered.at(-1)!;
  if (last.lastPrice > first.lastPrice) return "UP";
  if (last.lastPrice < first.lastPrice) return "DOWN";
  return "FLAT";
}

function latestSnapshot(snapshots: PriceSnapshot[], securityId: string) {
  const relevant = snapshots.filter((item) => item.securityId === securityId);
  if (relevant.length === 0) return null;
  return relevant.sort((a, b) => b.marketDate.localeCompare(a.marketDate))[0] ?? null;
}

function withSnapshot(db: Database, security: Security): SecurityWithSnapshot {
  const history = sortHistory(db.snapshots.filter((item) => item.securityId === security.id));
  return {
    ...security,
    latestSnapshot: latestSnapshot(db.snapshots, security.id),
    trend: computeTrend(history),
    history,
  };
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToSecurity(row: Record<string, unknown>): Security {
  return {
    id: String(row.id),
    ticker: String(row.ticker),
    companyName: String(row.company_name),
    sector: String(row.sector),
    listingType: row.listing_type as Security["listingType"],
    listingDate: String(row.listing_date).slice(0, 10),
    isActive: Boolean(row.is_active),
  };
}

function rowToSnapshot(row: Record<string, unknown>): PriceSnapshot {
  return {
    id: String(row.id),
    securityId: String(row.security_id),
    marketDate: String(row.market_date).slice(0, 10),
    openPrice: row.open_price === null ? null : Number(row.open_price),
    highPrice: row.high_price === null ? null : Number(row.high_price),
    lowPrice: row.low_price === null ? null : Number(row.low_price),
    lastPrice: Number(row.last_price),
    previousClose: row.previous_close === null ? null : Number(row.previous_close),
    absoluteChange: Number(row.absolute_change),
    percentChange: Number(row.percent_change),
    volume: row.volume === null ? null : Number(row.volume),
    sourceName: String(row.source_name),
    sourceReference: String(row.source_reference),
    ingestedAt: toIsoOrNull(row.ingested_at) ?? new Date(0).toISOString(),
  };
}

function rowToAlert(row: Record<string, unknown>): Alert {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    securityId: String(row.security_id),
    type: row.type as Alert["type"],
    thresholdValue: Number(row.threshold_value),
    channel: row.channel as Alert["channel"],
    isActive: Boolean(row.is_active),
    lastTriggeredAt: toIsoOrNull(row.last_triggered_at),
  };
}

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    alertId: row.alert_id ? String(row.alert_id) : null,
    securityId: row.security_id ? String(row.security_id) : null,
    title: String(row.title),
    body: String(row.body),
    channel: row.channel as Notification["channel"],
    status: row.status as Notification["status"],
    createdAt: toIsoOrNull(row.created_at) ?? new Date(0).toISOString(),
    sentAt: toIsoOrNull(row.sent_at),
  };
}

function rowToRun(row: Record<string, unknown>): IngestionRun {
  return {
    id: String(row.id),
    sourceName: String(row.source_name),
    marketDate: String(row.market_date).slice(0, 10),
    status: row.status as IngestionRun["status"],
    recordsSeen: Number(row.records_seen),
    recordsInserted: Number(row.records_inserted),
    recordsUpdated: Number(row.records_updated),
    recordsFailed: Number(row.records_failed),
    startedAt: toIsoOrNull(row.started_at) ?? new Date(0).toISOString(),
    completedAt: toIsoOrNull(row.completed_at),
    errorSummary: row.error_summary ? String(row.error_summary) : null,
  };
}

function buildSecurityWithSnapshots(securities: Security[], snapshots: PriceSnapshot[]) {
  const snapshotsBySecurity = new Map<string, PriceSnapshot[]>();
  for (const snapshot of snapshots) {
    const existing = snapshotsBySecurity.get(snapshot.securityId);
    if (existing) {
      existing.push(snapshot);
    } else {
      snapshotsBySecurity.set(snapshot.securityId, [snapshot]);
    }
  }

  return securities.map((security) => {
    const history = sortHistory(snapshotsBySecurity.get(security.id) ?? []);
    return {
      ...security,
      latestSnapshot: history.at(-1) ?? null,
      trend: computeTrend(history),
      history,
    } satisfies SecurityWithSnapshot;
  });
}

async function ensureDefaultWatchlist() {
  const sql = await getSql();
  const existing = await sql`select id from watchlists where user_id = ${USER_ID} limit 1`;
  if (existing.length === 0) {
    await sql`insert into watchlists (id, user_id, name) values ('watchlist-default', ${USER_ID}, 'My DSE Picks')`;
  }
}

const loadDatabaseShape = cache(async (): Promise<Database> => {
  const sql = await getSql();
  await ensureDefaultWatchlist();

  const securitiesRows = await sql`select * from securities order by ticker asc`;
  const snapshotRows = await sql`select * from price_snapshots order by market_date asc`;
  const watchlistsRows = await sql`select * from watchlists order by name asc`;
  const watchlistItemsRows = await sql`select * from watchlist_items order by watchlist_id asc`;
  const alertRows = await sql`select * from alerts order by id desc`;
  const notificationRows = await sql`select * from notifications order by created_at desc`;
  const runRows = await sql`select * from ingestion_runs order by started_at desc`;

  return {
    securities: securitiesRows.map((row) => rowToSecurity(row as Record<string, unknown>)),
    snapshots: snapshotRows.map((row) => rowToSnapshot(row as Record<string, unknown>)),
    watchlists: watchlistsRows.map((row) => ({ id: String(row.id), userId: String(row.user_id), name: String(row.name) })),
    watchlistItems: watchlistItemsRows.map((row) => ({ id: String(row.id), watchlistId: String(row.watchlist_id), securityId: String(row.security_id) })),
    alerts: alertRows.map((row) => rowToAlert(row as Record<string, unknown>)),
    notifications: notificationRows.map((row) => rowToNotification(row as Record<string, unknown>)),
    ingestionRuns: runRows.map((row) => rowToRun(row as Record<string, unknown>)),
  };
});

async function maybeAutoSync() {
  if (!AUTO_SYNC_ON_READ) return;

  const now = Date.now();
  if (now - lastLiveSyncAttemptAt < LIVE_SYNC_COOLDOWN_MS) return;

  const sql = await getSql();
  const latestRun = await sql`select market_date from ingestion_runs order by started_at desc limit 1`;
  const latestMarketDate = latestRun[0]?.market_date ? String(latestRun[0].market_date).slice(0, 10) : "";
  const latestRef = await sql`
    select source_reference from price_snapshots
    where market_date = ${latestMarketDate}
    order by ingested_at desc
    limit 1
  `;
  const latestSourceReference = latestRef[0]?.source_reference ? String(latestRef[0].source_reference) : null;
  const needsOfficialReplacement = latestSourceReference !== OFFICIAL_SOURCE_REFERENCE;

  if (latestMarketDate >= currentDseDate() && !needsOfficialReplacement) return;

  lastLiveSyncAttemptAt = now;
  try {
    await runOfficialIngestion(false);
  } catch {
    // Preserve last known good database state.
  }
}

async function upsertSecurity(input: { ticker: string; companyName: string }) {
  const sql = await getSql();
  const ticker = canonicalTicker(input.ticker);
  const id = securityIdForTicker(ticker);
  const rows = await sql`
    insert into securities (id, ticker, company_name, sector, listing_type, listing_date, is_active)
    values (${id}, ${ticker}, ${input.companyName}, ${inferSector(ticker)}, ${inferListingType(ticker)}, ${currentDseDate()}, true)
    on conflict (id) do update set
      ticker = excluded.ticker,
      company_name = excluded.company_name,
      sector = coalesce(securities.sector, excluded.sector),
      listing_type = coalesce(securities.listing_type, excluded.listing_type),
      is_active = true
    returning *
  `;
  return rowToSecurity(rows[0] as Record<string, unknown>);
}

async function evaluateAlertsForMarketDate(marketDate: string) {
  const db = await loadDatabaseShape();
  for (const alert of db.alerts) {
    if (!alert.isActive) continue;
    const snapshot = latestSnapshot(db.snapshots, alert.securityId);
    if (!snapshot || snapshot.marketDate !== marketDate) continue;

    const shouldTrigger =
      (alert.type === "PRICE_ABOVE" && snapshot.lastPrice > alert.thresholdValue) ||
      (alert.type === "PRICE_BELOW" && snapshot.lastPrice < alert.thresholdValue) ||
      (alert.type === "PERCENT_RISE" && snapshot.percentChange > alert.thresholdValue) ||
      (alert.type === "PERCENT_DROP" && snapshot.percentChange < -alert.thresholdValue);

    if (!shouldTrigger) continue;
    if (alert.lastTriggeredAt?.startsWith(marketDate)) continue;

    const security = db.securities.find((item) => item.id === alert.securityId);
    const title = `${security?.ticker ?? "Security"} triggered ${alert.type.replaceAll("_", " ").toLowerCase()}`;
    const body = `${security?.companyName ?? "A security"} met your alert threshold on ${marketDate}.`;
    const sql = await getSql();

    await sql`update alerts set last_triggered_at = ${`${marketDate}T18:15:00.000Z`} where id = ${alert.id}`;
    await sql`
      insert into notifications (id, user_id, alert_id, security_id, title, body, channel, status, created_at, sent_at)
      values (${randomUUID()}, ${USER_ID}, ${alert.id}, ${security?.id ?? null}, ${title}, ${body}, ${alert.channel}, 'SENT', ${`${marketDate}T18:15:00.000Z`}, ${`${marketDate}T18:15:00.000Z`})
    `;

    if (alert.channel === "EMAIL" && emailDeliveryEnabled()) {
      await sendAlertEmail({
        subject: `[DSE Alert] ${title}`,
        text: `${body}\n\nRecipient: ${getAlertEmailRecipient() ?? "not configured"}`,
        html: `<p>${body}</p><p><strong>Recipient:</strong> ${getAlertEmailRecipient() ?? "not configured"}</p>`,
      });
    }
  }
}

export async function getMarketOverview(): Promise<MarketOverview> {
  await maybeAutoSync();
  const sql = await getSql();
  const runRows = await sql`select * from ingestion_runs order by started_at desc limit 1`;
  const latestRun = runRows[0] ? rowToRun(runRows[0] as Record<string, unknown>) : null;
  const marketDate = latestRun?.marketDate ?? "";
  const lastUpdated = latestRun?.completedAt ?? latestRun?.startedAt ?? new Date().toISOString();
  const securitiesRows = await sql`
    select distinct s.*
    from securities s
    join price_snapshots ps on ps.security_id = s.id
    where ps.market_date = ${marketDate}
    order by s.ticker asc
  `;
  const snapshotRows = await sql`
    with ranked_snapshots as (
      select
        ps.*,
        row_number() over (partition by ps.security_id order by ps.market_date desc) as snapshot_rank
      from price_snapshots ps
      where ps.security_id in (
        select security_id
        from price_snapshots
        where market_date = ${marketDate}
      )
    )
    select *
    from ranked_snapshots
    where snapshot_rank <= 5
    order by market_date asc
  `;
  const securities = buildSecurityWithSnapshots(
    securitiesRows.map((row) => rowToSecurity(row as Record<string, unknown>)),
    snapshotRows.map((row) => rowToSnapshot(row as Record<string, unknown>)),
  );
  const withPrices = securities.filter((security) => security.latestSnapshot !== null);
  const byGain = [...withPrices].sort((a, b) => (b.latestSnapshot?.percentChange ?? 0) - (a.latestSnapshot?.percentChange ?? 0));
  const byVolume = [...withPrices].sort((a, b) => (b.latestSnapshot?.volume ?? 0) - (a.latestSnapshot?.volume ?? 0));
  const freshness = marketDate >= currentDseDate() ? "FRESH" : "STALE";

  return {
    marketDate,
    lastUpdated,
    sourceName: SOURCE_NAME,
    trackedSecurities: withPrices.length,
    topGainers: byGain.slice(0, 5),
    topLosers: [...byGain].reverse().slice(0, 5),
    mostActive: byVolume.slice(0, 5),
    freshness,
  };
}

export async function listSecurities() {
  await maybeAutoSync();
  const db = await loadDatabaseShape();
  return db.securities.map((security) => withSnapshot(db, security)).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function getSecurityByTicker(ticker: string) {
  await maybeAutoSync();
  const db = await loadDatabaseShape();
  const matchTicker = canonicalTicker(ticker.toUpperCase());
  const security = db.securities.find((item) => item.ticker.toLowerCase() === matchTicker.toLowerCase());
  return security ? withSnapshot(db, security) : null;
}

export async function getDefaultWatchlist() {
  await maybeAutoSync();
  const db = await loadDatabaseShape();
  const watchlist = db.watchlists.find((item) => item.userId === USER_ID) ?? db.watchlists[0] ?? { id: 'watchlist-default', userId: USER_ID, name: 'My DSE Picks' };
  const items = db.watchlistItems.filter((item) => item.watchlistId === watchlist.id);
  const securities = items
    .map((item) => db.securities.find((security) => security.id === item.securityId))
    .filter((item): item is Security => Boolean(item))
    .map((security) => withSnapshot(db, security));

  return { watchlist, securities };
}

export async function addWatchlistSecurity(securityId: string) {
  const sql = await getSql();
  await ensureDefaultWatchlist();
  await sql`
    insert into watchlist_items (id, watchlist_id, security_id)
    values (${randomUUID()}, 'watchlist-default', ${securityId})
    on conflict (watchlist_id, security_id) do nothing
  `;
}

export async function removeWatchlistSecurity(securityId: string) {
  const sql = await getSql();
  await sql`delete from watchlist_items where watchlist_id = 'watchlist-default' and security_id = ${securityId}`;
}

export async function listAlerts() {
  await maybeAutoSync();
  const sql = await getSql();
  const rows = await sql`
    select
      a.*,
      s.id as security_join_id,
      s.ticker as security_ticker,
      s.company_name as security_company_name,
      s.sector as security_sector,
      s.listing_type as security_listing_type,
      s.listing_date as security_listing_date,
      s.is_active as security_is_active
    from alerts a
    left join securities s on s.id = a.security_id
    order by a.id desc
  `;

  return rows.map((row) => ({
    ...rowToAlert(row as Record<string, unknown>),
    security: row.security_join_id
      ? {
          id: String(row.security_join_id),
          ticker: String(row.security_ticker),
          companyName: String(row.security_company_name),
          sector: String(row.security_sector),
          listingType: row.security_listing_type as Security["listingType"],
          listingDate: String(row.security_listing_date).slice(0, 10),
          isActive: Boolean(row.security_is_active),
        }
      : null,
  }));
}

export async function createAlert(input: { securityId: string; type: Alert["type"]; thresholdValue: number; channel: Alert["channel"] }) {
  const sql = await getSql();
  await sql`
    insert into alerts (id, user_id, security_id, type, threshold_value, channel, is_active, last_triggered_at)
    values (${randomUUID()}, ${USER_ID}, ${input.securityId}, ${input.type}, ${input.thresholdValue}, ${input.channel}, true, null)
  `;
}

export async function toggleAlert(alertId: string) {
  const sql = await getSql();
  await sql`update alerts set is_active = not is_active where id = ${alertId}`;
}

export async function listNotifications() {
  const sql = await getSql();
  const rows = await sql`select * from notifications order by created_at desc limit 50`;
  return rows.map((row) => rowToNotification(row as Record<string, unknown>));
}

export async function listIngestionRuns() {
  const sql = await getSql();
  const rows = await sql`select * from ingestion_runs order by started_at desc limit 100`;
  return rows.map((row) => rowToRun(row as Record<string, unknown>));
}

export async function runOfficialIngestion(recordFailure = true) {
  const startedAt = new Date().toISOString();
  try {
    const sql = await getSql();
    const live = await fetchLatestDseMarketData();
    let recordsInserted = 0;
    let recordsUpdated = 0;

    for (const row of live.rows) {
      const security = await upsertSecurity({ ticker: row.ticker, companyName: row.companyName });
      const absoluteChange = row.previousClose ? Number((row.closePrice - row.previousClose).toFixed(2)) : 0;
      const existing = await sql`
        select id from price_snapshots where security_id = ${security.id} and market_date = ${live.marketDate} limit 1
      `;

      await sql`
        insert into price_snapshots (
          id, security_id, market_date, open_price, high_price, low_price, last_price,
          previous_close, absolute_change, percent_change, volume, source_name,
          source_reference, ingested_at
        ) values (
          ${existing[0]?.id ? String(existing[0].id) : randomUUID()}, ${security.id}, ${live.marketDate}, ${row.openPrice}, ${row.highPrice}, ${row.lowPrice}, ${row.closePrice},
          ${row.previousClose}, ${absoluteChange}, ${row.changePercent}, ${row.volume}, ${live.sourceName},
          ${live.sourceReference}, ${startedAt}
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

      if (existing.length > 0) {
        recordsUpdated += 1;
      } else {
        recordsInserted += 1;
      }
    }

    await sql`
      insert into ingestion_runs (
        id, source_name, market_date, status, records_seen, records_inserted, records_updated,
        records_failed, started_at, completed_at, error_summary
      ) values (
        ${randomUUID()}, ${live.sourceName}, ${live.marketDate}, 'SUCCESS', ${live.rows.length}, ${recordsInserted}, ${recordsUpdated},
        0, ${startedAt}, ${new Date().toISOString()}, null
      )
    `;

    await evaluateAlertsForMarketDate(live.marketDate);
  } catch (error) {
    if (recordFailure) {
      const sql = await getSql();
      await sql`
        insert into ingestion_runs (
          id, source_name, market_date, status, records_seen, records_inserted, records_updated,
          records_failed, started_at, completed_at, error_summary
        ) values (
          ${randomUUID()}, ${SOURCE_NAME}, ${currentDseDate()}, 'FAILED', 0, 0, 0,
          0, ${startedAt}, ${new Date().toISOString()}, ${error instanceof Error ? error.message : 'Unknown sync error'}
        )
      `;
    }
    throw error;
  }
}
