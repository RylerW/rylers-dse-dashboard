import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchLatestDseMarketData } from "@/lib/dse-source";
import { emailDeliveryEnabled, getAlertEmailRecipient, sendAlertEmail } from "@/lib/email";
import type {
  Alert,
  Database,
  IngestionRun,
  MarketOverview,
  Notification,
  PriceSnapshot,
  Security,
  SecurityWithSnapshot,
  Trend,
  Watchlist,
  WatchlistItem,
} from "@/lib/types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const SOURCE_NAME = "Dar es Salaam Stock Exchange";
const SOURCE_REFERENCE = "Official DSE homepage sync";
const OFFICIAL_SOURCE_REFERENCE = "https://dse.co.tz/";
const USER_ID = "demo-investor";
const LIVE_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

let lastLiveSyncAttemptAt = 0;

const tickerAliases: Record<string, string> = {
  SWISSPORT: "SWIS",
  TWIGA: "TPCC",
};

const seedSecurities: Security[] = [
  { id: "sec-crdb", ticker: "CRDB", companyName: "CRDB Bank", sector: "Banking", listingType: "LOCAL", listingDate: "2009-06-17", isActive: true },
  { id: "sec-nmb", ticker: "NMB", companyName: "NMB Bank", sector: "Banking", listingType: "LOCAL", listingDate: "2008-10-31", isActive: true },
  { id: "sec-tbl", ticker: "TBL", companyName: "Tanzania Breweries", sector: "Consumer Goods", listingType: "LOCAL", listingDate: "2002-09-09", isActive: true },
  { id: "sec-tccl", ticker: "TCCL", companyName: "Tanzania Cigarette Company", sector: "Consumer Goods", listingType: "LOCAL", listingDate: "2000-11-24", isActive: true },
  { id: "sec-swis", ticker: "SWIS", companyName: "Swissport Tanzania", sector: "Transport", listingType: "LOCAL", listingDate: "2014-01-29", isActive: true },
  { id: "sec-tatepa", ticker: "TATEPA", companyName: "Tanzania Tea Packers", sector: "Agriculture", listingType: "LOCAL", listingDate: "2017-01-20", isActive: true },
  { id: "sec-tpcc", ticker: "TPCC", companyName: "Twiga Cement", sector: "Industrial", listingType: "LOCAL", listingDate: "1998-08-12", isActive: true },
  { id: "sec-itrust", ticker: "ITRUST", companyName: "iTrust EAC Large Cap ETF", sector: "ETF", listingType: "ETF", listingDate: "2026-02-20", isActive: true },
];

const seedHistory = [
  { ticker: "CRDB", prices: [610, 620, 625, 630, 640, 650], volumes: [75000, 78000, 80000, 88000, 92000, 95000] },
  { ticker: "NMB", prices: [4310, 4360, 4400, 4425, 4380, 4500], volumes: [62000, 64000, 69000, 71000, 76000, 82000] },
  { ticker: "TBL", prices: [10050, 10020, 9980, 9950, 9900, 9800], volumes: [9600, 10050, 9950, 10100, 10300, 10500] },
  { ticker: "TCCL", prices: [1850, 1840, 1830, 1825, 1820, 1792], volumes: [8800, 9000, 9100, 8900, 9200, 9800] },
  { ticker: "SWIS", prices: [2050, 2060, 2075, 2080, 2100, 2115], volumes: [4500, 5100, 5300, 4900, 6000, 6200] },
  { ticker: "TATEPA", prices: [260, 258, 257, 256, 255, 254], volumes: [1800, 1700, 1650, 1600, 1550, 1500] },
  { ticker: "TPCC", prices: [3500, 3520, 3510, 3540, 3575, 3600], volumes: [7300, 7600, 7450, 7900, 8100, 8500] },
  { ticker: "ITRUST", prices: [102, 102.4, 102.2, 103.1, 103.6, 104.2], volumes: [2100, 2200, 2150, 2250, 2350, 2400] },
];

function canonicalTicker(ticker: string) {
  return tickerAliases[ticker] ?? ticker;
}

function securityIdForTicker(ticker: string) {
  return `sec-${canonicalTicker(ticker).toLowerCase()}`;
}

function tradingDates(): string[] {
  return ["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-09", "2026-03-10", "2026-03-11"];
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
  if (["CRDB", "NMB", "DCB", "MKCB", "MBP"].includes(ticker)) return "Banking";
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

function makeSnapshots(): PriceSnapshot[] {
  const dates = tradingDates();
  const snapshots: PriceSnapshot[] = [];

  for (const item of seedHistory) {
    const security = seedSecurities.find((entry) => entry.ticker === item.ticker);
    if (!security) continue;

    item.prices.forEach((price, index) => {
      const previous = index === 0 ? price : item.prices[index - 1];
      const change = Number((price - previous).toFixed(2));
      const percent = previous === 0 ? 0 : Number((((price - previous) / previous) * 100).toFixed(2));
      snapshots.push({
        id: randomUUID(),
        securityId: security.id,
        marketDate: dates[index],
        openPrice: Number((price * 0.99).toFixed(2)),
        highPrice: Number((price * 1.01).toFixed(2)),
        lowPrice: Number((price * 0.98).toFixed(2)),
        lastPrice: price,
        previousClose: previous,
        absoluteChange: change,
        percentChange: percent,
        volume: item.volumes[index],
        sourceName: SOURCE_NAME,
        sourceReference: SOURCE_REFERENCE,
        ingestedAt: `${dates[index]}T18:10:00.000Z`,
      });
    });
  }

  return snapshots;
}

function seedDatabase(): Database {
  const watchlists: Watchlist[] = [{ id: "watchlist-default", userId: USER_ID, name: "My DSE Picks" }];
  const watchlistItems: WatchlistItem[] = [
    { id: randomUUID(), watchlistId: "watchlist-default", securityId: "sec-crdb" },
    { id: randomUUID(), watchlistId: "watchlist-default", securityId: "sec-nmb" },
    { id: randomUUID(), watchlistId: "watchlist-default", securityId: "sec-tbl" },
  ];
  const alerts: Alert[] = [
    { id: "alert-crdb-700", userId: USER_ID, securityId: "sec-crdb", type: "PRICE_ABOVE", thresholdValue: 700, channel: "EMAIL", isActive: true, lastTriggeredAt: null },
    { id: "alert-nmb-rise", userId: USER_ID, securityId: "sec-nmb", type: "PERCENT_RISE", thresholdValue: 3, channel: "EMAIL", isActive: true, lastTriggeredAt: "2026-03-08T18:10:00.000Z" },
    { id: "alert-tbl-drop", userId: USER_ID, securityId: "sec-tbl", type: "PRICE_BELOW", thresholdValue: 9500, channel: "IN_APP", isActive: false, lastTriggeredAt: "2026-03-02T18:10:00.000Z" },
  ];
  const notifications: Notification[] = [
    {
      id: randomUUID(),
      userId: USER_ID,
      alertId: "alert-nmb-rise",
      securityId: "sec-nmb",
      title: "NMB crossed your daily rise rule",
      body: "NMB moved above your 3% daily gain threshold in the latest published session.",
      channel: "EMAIL",
      status: "SENT",
      createdAt: "2026-03-08T18:12:00.000Z",
      sentAt: "2026-03-08T18:12:00.000Z",
    },
  ];
  const ingestionRuns: IngestionRun[] = [
    {
      id: "run-1042",
      sourceName: SOURCE_NAME,
      marketDate: "2026-03-11",
      status: "SUCCESS",
      recordsSeen: seedSecurities.length,
      recordsInserted: 0,
      recordsUpdated: seedSecurities.length,
      recordsFailed: 0,
      startedAt: "2026-03-11T18:05:00.000Z",
      completedAt: "2026-03-11T18:06:32.000Z",
      errorSummary: null,
    },
  ];

  return {
    securities: seedSecurities,
    snapshots: makeSnapshots(),
    watchlists,
    watchlistItems,
    alerts,
    notifications,
    ingestionRuns,
  };
}

async function ensureDb() {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await readFile(DB_PATH, "utf8");
  } catch {
    await writeFile(DB_PATH, JSON.stringify(seedDatabase(), null, 2));
  }
}

function mergeSecurity(existing: Security, candidate: Security): Security {
  return {
    ...existing,
    ...candidate,
    ticker: canonicalTicker(candidate.ticker || existing.ticker),
    companyName: candidate.companyName || existing.companyName,
    sector: existing.sector || candidate.sector,
    listingType: existing.listingType || candidate.listingType,
    listingDate: existing.listingDate <= candidate.listingDate ? existing.listingDate : candidate.listingDate,
    isActive: existing.isActive || candidate.isActive,
  };
}

function normalizeDb(db: Database): { db: Database; changed: boolean } {
  let changed = false;
  const securitiesById = new Map<string, Security>();
  const tickerToId = new Map<string, string>();
  const idRemap = new Map<string, string>();

  for (const security of db.securities) {
    const canonical = { ...security, ticker: canonicalTicker(security.ticker), id: securityIdForTicker(security.ticker) };
    if (canonical.id !== security.id || canonical.ticker !== security.ticker) changed = true;

    const existingById = securitiesById.get(canonical.id);
    if (existingById) {
      securitiesById.set(canonical.id, mergeSecurity(existingById, canonical));
      idRemap.set(security.id, canonical.id);
      changed = true;
      continue;
    }

    const existingIdForTicker = tickerToId.get(canonical.ticker);
    if (existingIdForTicker) {
      const merged = mergeSecurity(securitiesById.get(existingIdForTicker)!, canonical);
      securitiesById.set(existingIdForTicker, merged);
      idRemap.set(security.id, existingIdForTicker);
      changed = true;
      continue;
    }

    securitiesById.set(canonical.id, canonical);
    tickerToId.set(canonical.ticker, canonical.id);
    if (security.id !== canonical.id) {
      idRemap.set(security.id, canonical.id);
    }
  }

  const remapId = (value: string) => idRemap.get(value) ?? value;

  const snapshotsSeen = new Set<string>();
  const snapshots: PriceSnapshot[] = [];
  for (const snapshot of db.snapshots) {
    const normalized = { ...snapshot, securityId: remapId(snapshot.securityId) };
    const key = `${normalized.securityId}:${normalized.marketDate}`;
    const existingIndex = snapshots.findIndex((item) => `${item.securityId}:${item.marketDate}` === key);
    if (existingIndex >= 0) {
      snapshots[existingIndex] = normalized.ingestedAt > snapshots[existingIndex].ingestedAt ? normalized : snapshots[existingIndex];
      changed = true;
    } else if (!snapshotsSeen.has(key)) {
      snapshotsSeen.add(key);
      snapshots.push(normalized);
    }
    if (normalized.securityId !== snapshot.securityId) changed = true;
  }

  const uniqueBy = <T,>(items: T[], keyFn: (item: T) => string) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) {
        changed = true;
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const watchlistItems = uniqueBy(
    db.watchlistItems.map((item) => ({ ...item, securityId: remapId(item.securityId) })),
    (item) => `${item.watchlistId}:${item.securityId}`,
  );
  const alerts = uniqueBy(
    db.alerts.map((item) => ({ ...item, securityId: remapId(item.securityId) })),
    (item) => item.id,
  );
  const notifications = db.notifications.map((item) => ({ ...item, securityId: item.securityId ? remapId(item.securityId) : null }));
  if (notifications.some((item, index) => item.securityId !== db.notifications[index]?.securityId)) changed = true;

  return {
    changed,
    db: {
      ...db,
      securities: Array.from(securitiesById.values()).sort((a, b) => a.ticker.localeCompare(b.ticker)),
      snapshots,
      watchlistItems,
      alerts,
      notifications,
    },
  };
}

async function readDb(): Promise<Database> {
  await ensureDb();
  const content = await readFile(DB_PATH, "utf8");
  const parsed = JSON.parse(content) as Database;
  const normalized = normalizeDb(parsed);
  if (normalized.changed) {
    await writeDb(normalized.db);
  }
  return normalized.db;
}

async function writeDb(db: Database) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
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

function upsertSecurity(db: Database, input: { ticker: string; companyName: string }) {
  const ticker = canonicalTicker(input.ticker);
  const id = securityIdForTicker(ticker);
  let security = db.securities.find((item) => item.id === id || item.ticker === ticker);
  if (security) {
    security.id = id;
    security.ticker = ticker;
    security.companyName = input.companyName || security.companyName;
    security.sector = security.sector || inferSector(ticker);
    security.isActive = true;
    return security;
  }

  security = {
    id,
    ticker,
    companyName: input.companyName,
    sector: inferSector(ticker),
    listingType: inferListingType(ticker),
    listingDate: currentDseDate(),
    isActive: true,
  };
  db.securities.push(security);
  return security;
}

function upsertSnapshot(db: Database, input: {
  securityId: string;
  marketDate: string;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  lastPrice: number;
  previousClose: number | null;
  absoluteChange: number;
  percentChange: number;
  volume: number | null;
  sourceName: string;
  sourceReference: string;
  ingestedAt: string;
}) {
  const existing = db.snapshots.find((item) => item.securityId === input.securityId && item.marketDate === input.marketDate);
  if (existing) {
    Object.assign(existing, input);
    return "updated" as const;
  }

  db.snapshots.push({ id: randomUUID(), ...input });
  return "inserted" as const;
}

async function maybeAutoSync() {
  const now = Date.now();
  if (now - lastLiveSyncAttemptAt < LIVE_SYNC_COOLDOWN_MS) return;

  const db = await readDb();
  const latestMarketDate = db.ingestionRuns[0]?.marketDate ?? "";
  const latestSourceReference = db.snapshots
    .filter((item) => item.marketDate === latestMarketDate)
    .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt))[0]?.sourceReference;
  const needsOfficialReplacement = latestSourceReference !== OFFICIAL_SOURCE_REFERENCE;

  if (latestMarketDate >= currentDseDate() && !needsOfficialReplacement) return;

  lastLiveSyncAttemptAt = now;
  try {
    const synced = await syncOfficialDseData(db, false);
    await writeDb(synced);
  } catch {
    // Keep the app usable on the last known good dataset.
  }
}

async function syncOfficialDseData(db: Database, recordFailure: boolean) {
  const startedAt = new Date().toISOString();
  try {
    const live = await fetchLatestDseMarketData();
    let recordsInserted = 0;
    let recordsUpdated = 0;

    for (const row of live.rows) {
      const security = upsertSecurity(db, { ticker: row.ticker, companyName: row.companyName });
      const absoluteChange = row.previousClose ? Number((row.closePrice - row.previousClose).toFixed(2)) : 0;
      const outcome = upsertSnapshot(db, {
        securityId: security.id,
        marketDate: live.marketDate,
        openPrice: row.openPrice,
        highPrice: row.highPrice,
        lowPrice: row.lowPrice,
        lastPrice: row.closePrice,
        previousClose: row.previousClose,
        absoluteChange,
        percentChange: row.changePercent,
        volume: row.volume,
        sourceName: live.sourceName,
        sourceReference: live.sourceReference,
        ingestedAt: startedAt,
      });
      if (outcome === "inserted") recordsInserted += 1;
      if (outcome === "updated") recordsUpdated += 1;
    }

    db.ingestionRuns.unshift({
      id: randomUUID(),
      sourceName: live.sourceName,
      marketDate: live.marketDate,
      status: "SUCCESS",
      recordsSeen: live.rows.length,
      recordsInserted,
      recordsUpdated,
      recordsFailed: 0,
      startedAt,
      completedAt: new Date().toISOString(),
      errorSummary: null,
    });

    await evaluateAlerts(db, live.marketDate);
    return db;
  } catch (error) {
    if (recordFailure) {
      db.ingestionRuns.unshift({
        id: randomUUID(),
        sourceName: SOURCE_NAME,
        marketDate: currentDseDate(),
        status: "FAILED",
        recordsSeen: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        startedAt,
        completedAt: new Date().toISOString(),
        errorSummary: error instanceof Error ? error.message : "Unknown sync error",
      });
    }
    throw error;
  }
}

export async function getMarketOverview(): Promise<MarketOverview> {
  await maybeAutoSync();
  const db = await readDb();
  const securities = db.securities.map((security) => withSnapshot(db, security));
  const withPrices = securities.filter((security) => security.latestSnapshot !== null);
  const byGain = [...withPrices].sort((a, b) => (b.latestSnapshot?.percentChange ?? 0) - (a.latestSnapshot?.percentChange ?? 0));
  const byVolume = [...withPrices].sort((a, b) => (b.latestSnapshot?.volume ?? 0) - (a.latestSnapshot?.volume ?? 0));
  const marketDate = db.ingestionRuns[0]?.marketDate ?? "";
  const lastUpdated = db.ingestionRuns[0]?.completedAt ?? db.ingestionRuns[0]?.startedAt ?? new Date().toISOString();
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
  const db = await readDb();
  return db.securities.map((security) => withSnapshot(db, security)).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function getSecurityByTicker(ticker: string) {
  await maybeAutoSync();
  const db = await readDb();
  const matchTicker = canonicalTicker(ticker.toUpperCase());
  const security = db.securities.find((item) => item.ticker.toLowerCase() === matchTicker.toLowerCase());
  return security ? withSnapshot(db, security) : null;
}

export async function getDefaultWatchlist() {
  await maybeAutoSync();
  const db = await readDb();
  const watchlist = db.watchlists.find((item) => item.userId === USER_ID) ?? db.watchlists[0];
  const items = db.watchlistItems.filter((item) => item.watchlistId === watchlist.id);
  const securities = items
    .map((item) => db.securities.find((security) => security.id === item.securityId))
    .filter((item): item is Security => Boolean(item))
    .map((security) => withSnapshot(db, security));

  return { watchlist, securities };
}

export async function addWatchlistSecurity(securityId: string) {
  const db = await readDb();
  const watchlist = db.watchlists.find((item) => item.userId === USER_ID) ?? db.watchlists[0];
  const exists = db.watchlistItems.some((item) => item.watchlistId === watchlist.id && item.securityId === securityId);
  if (!exists) {
    db.watchlistItems.push({ id: randomUUID(), watchlistId: watchlist.id, securityId });
    await writeDb(db);
  }
}

export async function removeWatchlistSecurity(securityId: string) {
  const db = await readDb();
  const watchlist = db.watchlists.find((item) => item.userId === USER_ID) ?? db.watchlists[0];
  db.watchlistItems = db.watchlistItems.filter((item) => !(item.watchlistId === watchlist.id && item.securityId === securityId));
  await writeDb(db);
}

export async function listAlerts() {
  await maybeAutoSync();
  const db = await readDb();
  return db.alerts.map((alert) => ({
    ...alert,
    security: db.securities.find((item) => item.id === alert.securityId) ?? null,
  }));
}

export async function createAlert(input: { securityId: string; type: Alert["type"]; thresholdValue: number; channel: Alert["channel"]; }) {
  const db = await readDb();
  db.alerts.unshift({
    id: randomUUID(),
    userId: USER_ID,
    securityId: input.securityId,
    type: input.type,
    thresholdValue: input.thresholdValue,
    channel: input.channel,
    isActive: true,
    lastTriggeredAt: null,
  });
  await writeDb(db);
}

export async function toggleAlert(alertId: string) {
  const db = await readDb();
  const alert = db.alerts.find((item) => item.id === alertId);
  if (alert) {
    alert.isActive = !alert.isActive;
    await writeDb(db);
  }
}

export async function listNotifications() {
  const db = await readDb();
  return db.notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listIngestionRuns() {
  const db = await readDb();
  return db.ingestionRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function runOfficialIngestion() {
  const db = await readDb();
  const synced = await syncOfficialDseData(db, true);
  await writeDb(synced);
}

async function evaluateAlerts(db: Database, marketDate: string) {
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

    alert.lastTriggeredAt = `${marketDate}T18:15:00.000Z`;
    const security = db.securities.find((item) => item.id === alert.securityId);
    const title = `${security?.ticker ?? "Security"} triggered ${alert.type.replaceAll("_", " ").toLowerCase()}`;
    const body = `${security?.companyName ?? "A security"} met your alert threshold on ${marketDate}.`;
    db.notifications.unshift({
      id: randomUUID(),
      userId: USER_ID,
      alertId: alert.id,
      securityId: security?.id ?? null,
      title,
      body,
      channel: alert.channel,
      status: "SENT",
      createdAt: `${marketDate}T18:15:00.000Z`,
      sentAt: `${marketDate}T18:15:00.000Z`,
    });

    if (alert.channel === "EMAIL" && emailDeliveryEnabled()) {
      await sendAlertEmail({
        subject: `[DSE Alert] ${title}`,
        text: `${body}\n\nRecipient: ${getAlertEmailRecipient() ?? "not configured"}`,
        html: `<p>${body}</p><p><strong>Recipient:</strong> ${getAlertEmailRecipient() ?? "not configured"}</p>`,
      });
    }
  }
}
