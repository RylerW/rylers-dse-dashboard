import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to backfill DSE history into Postgres.");
}

const SOURCE_NAME = "Dar es Salaam Stock Exchange";
const RANGE_URL = "https://dse.co.tz/api/get/market/prices/for/range";
const DURATION_URL = "https://dse.co.tz/api/get/market/prices/for/range/duration";
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
});

const companyNames = {
  AFRIPRISE: "AfriPrecise Holdings",
  CRDB: "CRDB Bank",
  DCB: "DCB Commercial Bank",
  DSE: "Dar es Salaam Stock Exchange PLC",
  EABL: "East African Breweries",
  JATU: "Jatu Holdings",
  JHL: "JHL Biotech",
  KA: "Kenya Airways",
  KCB: "KCB Group",
  MBP: "Maendeleo Bank",
  MKCB: "Mkombozi Commercial Bank",
  NICO: "National Investments Company",
  NMB: "NMB Bank",
  PAL: "Precision Air",
  SWIS: "Swissport Tanzania",
  TBL: "Tanzania Breweries",
  TCCL: "Tanzania Cigarette Company",
  TATEPA: "Tanzania Tea Packers",
  TICL: "Tanzania Investment Consortium",
  TPCC: "Twiga Cement",
  TOL: "Tanga Oceanic Limited",
  TPDF: "TPDF Community Trust",
  VODA: "Vodacom Tanzania",
  ITRUST: "iTrust EAC Large Cap ETF",
  VERTEX: "Vertex International Securities ETF",
};

const tickerAliases = {
  SWISSPORT: "SWIS",
  TWIGA: "TPCC",
  "ITRUST ETF": "ITRUST",
  "VERTEX ETF": "VERTEX",
};

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTicker(raw) {
  const clean = normalizeWhitespace(String(raw)).toUpperCase();
  return tickerAliases[clean] ?? clean.replace(/[^A-Z0-9]/g, "");
}

function parseMaybeNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
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

function inferSector(ticker) {
  if (["CRDB", "NMB", "DCB", "MKCB", "MBP", "KCB"].includes(ticker)) return "Banking";
  if (["TBL", "TCCL", "EABL", "KA"].includes(ticker)) return "Consumer Goods";
  if (["ITRUST", "VERTEX"].includes(ticker)) return "ETF";
  if (["SWIS"].includes(ticker)) return "Transport";
  if (["TPCC"].includes(ticker)) return "Industrial";
  if (["DSE"].includes(ticker)) return "Financial Services";
  return "Equity";
}

function inferListingType(ticker) {
  if (["ITRUST", "VERTEX"].includes(ticker)) return "ETF";
  if (["EABL", "KCB", "KA"].includes(ticker)) return "CROSS_LISTED";
  return "LOCAL";
}

function securityIdForTicker(ticker) {
  return `sec-${normalizeTicker(ticker).toLowerCase()}`;
}

function toIsoDate(raw) {
  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid DSE market date: ${String(raw)}`);
  }

  return date.toISOString().slice(0, 10);
}

async function fetchJson(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; RylersDseDashboard/1.0)",
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`DSE request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (attempt >= 4) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    return fetchJson(url, attempt + 1);
  }
}

async function latestMarketDate() {
  const result = await sql`select max(market_date) as market_date from price_snapshots`;
  return result[0]?.market_date ? toIsoDate(result[0].market_date) : currentDseDate();
}

async function fetchTopTraded(marketDate, limit = 20) {
  const params = new URLSearchParams({
    to_date: marketDate,
    isLastTradeTrend: "1",
    security_code: "ALL",
    class: "EQUITY",
  });

  const payload = await fetchJson(`${RANGE_URL}?${params}`);
  if (!payload.success) {
    throw new Error(`DSE range endpoint did not report success for ${marketDate}.`);
  }

  return payload.data
    .map((row) => {
      const ticker = normalizeTicker(row.company ?? "");
      const closePrice = parseMaybeNumber(row.closing_price);
      if (!ticker || closePrice === null) {
        return null;
      }

      const previousClose = parseMaybeNumber(row.prev_close);
      const changePercent = parseMaybeNumber(row.change);
      return {
        ticker,
        companyName: companyNames[ticker] ?? ticker,
        closePrice,
        previousClose,
        changePercent: changePercent === null ? (previousClose && closePrice ? Number((((closePrice - previousClose) / previousClose) * 100).toFixed(2)) : 0) : Number(changePercent.toFixed(2)),
        volume: parseMaybeNumber(row.volume),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, limit);
}

async function fetchHistory(ticker, days = 90) {
  const normalizedTicker = normalizeTicker(ticker);
  const params = new URLSearchParams({
    security_code: normalizedTicker,
    days: String(days),
    class: "EQUITY",
  });

  const payload = await fetchJson(`${DURATION_URL}?${params}`);
  if (!payload.success) {
    throw new Error(`DSE duration endpoint did not report success for ${normalizedTicker}.`);
  }

  return payload.data
    .map((row) => {
      const closePrice = parseMaybeNumber(row.closing_price);
      if (closePrice === null) return null;

      const previousClose = parseMaybeNumber(row.prev_close);
      const changePercent = parseMaybeNumber(row.change);
      return {
        ticker: normalizedTicker,
        companyName: String(row.fullName ?? companyNames[normalizedTicker] ?? normalizedTicker),
        marketDate: toIsoDate(row.trade_date),
        openPrice: parseMaybeNumber(row.opening_price),
        closePrice,
        highPrice: parseMaybeNumber(row.high),
        lowPrice: parseMaybeNumber(row.low),
        previousClose,
        changePercent: changePercent === null ? (previousClose && closePrice ? Number((((closePrice - previousClose) / previousClose) * 100).toFixed(2)) : 0) : Number(changePercent.toFixed(2)),
        volume: parseMaybeNumber(row.volume),
        sourceReference: `${DURATION_URL}?${params}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.marketDate.localeCompare(b.marketDate));
}

async function upsertSecurity(ticker, companyName, listingDate) {
  const normalizedTicker = normalizeTicker(ticker);
  const securityId = securityIdForTicker(normalizedTicker);

  await sql`
    insert into securities (id, ticker, company_name, sector, listing_type, listing_date, is_active)
    values (${securityId}, ${normalizedTicker}, ${companyName}, ${inferSector(normalizedTicker)}, ${inferListingType(normalizedTicker)}, ${listingDate}, true)
    on conflict (id) do update set
      ticker = excluded.ticker,
      company_name = excluded.company_name,
      sector = coalesce(securities.sector, excluded.sector),
      listing_type = coalesce(securities.listing_type, excluded.listing_type),
      is_active = true
  `;

  return securityId;
}

const startedAt = new Date().toISOString();
const anchorDate = await latestMarketDate();
const leaders = await fetchTopTraded(anchorDate, 20);

if (leaders.length === 0) {
  throw new Error(`No top-traded DSE securities were returned for ${anchorDate}.`);
}

let recordsSeen = 0;
let recordsInserted = 0;
let recordsUpdated = 0;
const processedTickers = [];
const failedTickers = [];

for (const leader of leaders) {
  try {
    const history = await fetchHistory(leader.ticker, 90);
    if (history.length === 0) continue;

    const securityId = await upsertSecurity(leader.ticker, leader.companyName, history[0].marketDate);
    processedTickers.push(leader.ticker);

    for (const row of history) {
      recordsSeen += 1;
      const absoluteChange = row.previousClose === null ? 0 : Number((row.closePrice - row.previousClose).toFixed(2));
      const result = await sql`
        insert into price_snapshots (
          id, security_id, market_date, open_price, high_price, low_price, last_price,
          previous_close, absolute_change, percent_change, volume, source_name,
          source_reference, ingested_at
        ) values (
          ${randomUUID()}, ${securityId}, ${row.marketDate}, ${row.openPrice}, ${row.highPrice}, ${row.lowPrice}, ${row.closePrice},
          ${row.previousClose}, ${absoluteChange}, ${row.changePercent}, ${row.volume}, ${SOURCE_NAME},
          ${row.sourceReference}, ${startedAt}
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
        returning xmax = 0 as inserted
      `;

      if (result[0]?.inserted) {
        recordsInserted += 1;
      } else {
        recordsUpdated += 1;
      }
    }

    console.log(`Imported ${history.length} days for ${leader.ticker}.`);
  } catch (error) {
    failedTickers.push(leader.ticker);
    console.warn(`Skipped ${leader.ticker}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const status = failedTickers.length > 0 ? "PARTIAL" : "SUCCESS";
const summary = [
  `Top 20 by latest volume: ${processedTickers.join(", ")}`,
  failedTickers.length > 0 ? `Failed: ${failedTickers.join(", ")}` : null,
].filter(Boolean).join(" | ");

await sql`
  insert into ingestion_runs (
    id, source_name, market_date, status, records_seen, records_inserted, records_updated,
    records_failed, started_at, completed_at, error_summary
  ) values (
    ${randomUUID()}, ${`${SOURCE_NAME} Historical Backfill`}, ${anchorDate}, ${status}, ${recordsSeen}, ${recordsInserted}, ${recordsUpdated},
    ${failedTickers.length}, ${startedAt}, ${new Date().toISOString()}, ${summary}
  )
`;

await sql.end();
console.log(`Backfilled 90 days for ${processedTickers.length} DSE securities anchored to ${anchorDate}. Snapshots seen: ${recordsSeen}. Inserted: ${recordsInserted}. Updated: ${recordsUpdated}. Failed tickers: ${failedTickers.length}.`);
