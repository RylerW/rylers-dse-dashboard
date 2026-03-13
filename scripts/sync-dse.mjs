import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import * as cheerio from "cheerio";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to sync DSE data into Postgres.");
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
});

const DSE_URL = "https://dse.co.tz/";
const SOURCE_NAME = "Dar es Salaam Stock Exchange";
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
  VERTEX: "Vertex International Securities ETF"
};
const tickerAliases = {
  SWISSPORT: "SWIS",
  TWIGA: "TPCC",
  "ITRUST ETF": "ITRUST",
  "VERTEX ETF": "VERTEX"
};
const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();
const normalizeTicker = (raw) => tickerAliases[normalizeWhitespace(raw).toUpperCase()] ?? normalizeWhitespace(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
const parseNumber = (raw) => {
  const clean = raw.replace(/[,%\s]/g, "").replace(/[??]/g, "").replace(/[??]/g, "-").replace(/[^0-9.-]/g, "");
  if (!clean || clean === "-" || clean === ".") return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
};
const extractMarketDate = (text) => {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(/(?:Market Summary|Equity Market Summary|Market Highlights)[:\- ]+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!match) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};
const inferSector = (ticker) => {
  if (["CRDB", "NMB", "DCB", "MKCB", "MBP", "KCB"].includes(ticker)) return "Banking";
  if (["TBL", "TCCL", "EABL", "KA"].includes(ticker)) return "Consumer Goods";
  if (["ITRUST", "VERTEX"].includes(ticker)) return "ETF";
  if (["SWIS"].includes(ticker)) return "Transport";
  if (["TPCC"].includes(ticker)) return "Industrial";
  if (["DSE"].includes(ticker)) return "Financial Services";
  return "Equity";
};
const inferListingType = (ticker) => {
  if (["ITRUST", "VERTEX"].includes(ticker)) return "ETF";
  if (["EABL", "KCB", "KA"].includes(ticker)) return "CROSS_LISTED";
  return "LOCAL";
};
const securityIdForTicker = (ticker) => `sec-${normalizeTicker(ticker).toLowerCase()}`;
const looksLikeEquityRow = (cells) => {
  if (cells.length < 7) return false;
  const first = normalizeTicker(cells[0]);
  if (!/^[A-Z0-9]{2,12}$/.test(first)) return false;
  return cells.slice(1).map(parseNumber).filter((value) => value !== null).length >= 4;
};

const response = await fetch(DSE_URL, {
  headers: {
    "user-agent": "Mozilla/5.0 (compatible; RylersDseDashboard/1.0)",
    accept: "text/html,application/xhtml+xml"
  },
  cache: "no-store"
});
if (!response.ok) throw new Error(`DSE request failed with status ${response.status}`);
const html = await response.text();
const $ = cheerio.load(html);
const marketDate = extractMarketDate($("body").text()) ?? new Date().toISOString().slice(0, 10);
const startedAt = new Date().toISOString();
const rows = [];
$("tr").each((_, row) => {
  const cells = $(row).find("th,td").map((__, cell) => normalizeWhitespace($(cell).text())).get().filter(Boolean);
  if (!looksLikeEquityRow(cells)) return;
  const ticker = normalizeTicker(cells[0]);
  const closePrice = parseNumber(cells[3]);
  if (closePrice === null) return;
  rows.push({
    ticker,
    companyName: companyNames[ticker] ?? ticker,
    openPrice: parseNumber(cells[1]),
    previousClose: parseNumber(cells[2]),
    closePrice,
    highPrice: parseNumber(cells[4]),
    lowPrice: parseNumber(cells[5]),
    changePercent: parseNumber(cells[6]) ?? 0,
    volume: parseNumber(cells[10]) ?? parseNumber(cells[9])
  });
});
if (rows.length === 0) throw new Error("No market rows were parsed from the official DSE page.");

let inserted = 0;
let updated = 0;
await sql.begin(async (tx) => {
  for (const row of rows) {
    const securityId = securityIdForTicker(row.ticker);
    await tx`
      insert into securities (id, ticker, company_name, sector, listing_type, listing_date, is_active)
      values (${securityId}, ${row.ticker}, ${row.companyName}, ${inferSector(row.ticker)}, ${inferListingType(row.ticker)}, ${marketDate}, true)
      on conflict (id) do update set
        ticker = excluded.ticker,
        company_name = excluded.company_name,
        sector = excluded.sector,
        listing_type = excluded.listing_type,
        is_active = true
    `;

    const absoluteChange = row.previousClose ? Number((row.closePrice - row.previousClose).toFixed(2)) : 0;
    const existing = await tx`select id from price_snapshots where security_id = ${securityId} and market_date = ${marketDate} limit 1`;
    await tx`
      insert into price_snapshots (
        id, security_id, market_date, open_price, high_price, low_price, last_price,
        previous_close, absolute_change, percent_change, volume, source_name,
        source_reference, ingested_at
      ) values (
        ${existing[0]?.id ? String(existing[0].id) : randomUUID()}, ${securityId}, ${marketDate}, ${row.openPrice}, ${row.highPrice}, ${row.lowPrice}, ${row.closePrice},
        ${row.previousClose}, ${absoluteChange}, ${row.changePercent}, ${row.volume}, ${SOURCE_NAME},
        ${DSE_URL}, ${startedAt}
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
    if (existing.length > 0) { updated += 1; } else { inserted += 1; }
  }

  await tx`
    insert into ingestion_runs (
      id, source_name, market_date, status, records_seen, records_inserted, records_updated,
      records_failed, started_at, completed_at, error_summary
    ) values (
      ${randomUUID()}, ${SOURCE_NAME}, ${marketDate}, 'SUCCESS', ${rows.length}, ${inserted}, ${updated},
      0, ${startedAt}, ${new Date().toISOString()}, null
    )
  `;
});

await sql.end();
console.log(`Synced ${rows.length} official DSE rows for ${marketDate}. Inserted: ${inserted}, Updated: ${updated}`);
