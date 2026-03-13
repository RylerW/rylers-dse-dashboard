import * as cheerio from "cheerio";

export interface LiveDseRow {
  ticker: string;
  companyName: string;
  openPrice: number | null;
  previousClose: number | null;
  closePrice: number;
  highPrice: number | null;
  lowPrice: number | null;
  changePercent: number;
  volume: number | null;
  sourceReference: string;
}

export interface LiveDseMarketData {
  marketDate: string;
  rows: LiveDseRow[];
  sourceName: string;
  sourceReference: string;
}

export interface DseHistoricalRow {
  ticker: string;
  companyName: string;
  marketDate: string;
  openPrice: number | null;
  closePrice: number;
  highPrice: number | null;
  lowPrice: number | null;
  previousClose: number | null;
  changePercent: number;
  volume: number | null;
  sourceReference: string;
}

const DSE_URL = "https://dse.co.tz/";
const RANGE_URL = "https://dse.co.tz/api/get/market/prices/for/range";
const DURATION_URL = "https://dse.co.tz/api/get/market/prices/for/range/duration";
const SOURCE_NAME = "Dar es Salaam Stock Exchange";

const companyNames: Record<string, string> = {
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

const tickerAliases: Record<string, string> = {
  "ITRUST ETF": "ITRUST",
  "VERTEX ETF": "VERTEX",
  SWISSPORT: "SWIS",
  "SWISS PORT": "SWIS",
  TWIGA: "TPCC",
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTicker(raw: string) {
  const clean = normalizeWhitespace(raw).toUpperCase();
  return tickerAliases[clean] ?? clean.replace(/[^A-Z0-9]/g, "");
}

function parseNumber(raw: string): number | null {
  const clean = raw.replace(/[,%\s]/g, "").replace(/[??]/g, "").replace(/[??]/g, "-").replace(/[^0-9.-]/g, "");
  if (!clean || clean === "-" || clean === ".") return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMaybeNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMarketDate(text: string) {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(/(?:Market Summary|Equity Market Summary|Market Highlights)[:\- ]+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!match) return null;
  const date = new Date(match[1]);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function looksLikeEquityRow(cells: string[]) {
  if (cells.length < 7) return false;
  const first = normalizeTicker(cells[0]);
  if (!/^[A-Z0-9]{2,12}$/.test(first)) return false;
  const numerics = cells.slice(1).map(parseNumber).filter((value) => value !== null);
  return numerics.length >= 4;
}

function toIsoDate(raw: unknown) {
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid DSE market date: ${String(raw)}`);
  }

  return date.toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TanzaniaDseDashboard/1.0)",
      accept: "application/json,text/plain,*/*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`DSE request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchLatestDseMarketData(): Promise<LiveDseMarketData> {
  const response = await fetch(DSE_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TanzaniaDseDashboard/1.0)",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`DSE request failed with status ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const bodyText = $("body").text();
  const marketDate = extractMarketDate(bodyText) ?? new Date().toISOString().slice(0, 10);
  const rows: LiveDseRow[] = [];

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("th,td")
      .map((__, cell) => normalizeWhitespace($(cell).text()))
      .get()
      .filter(Boolean);

    if (!looksLikeEquityRow(cells)) return;

    const ticker = normalizeTicker(cells[0]);
    const openPrice = parseNumber(cells[1]);
    const previousClose = parseNumber(cells[2]);
    const closePrice = parseNumber(cells[3]);
    const highPrice = parseNumber(cells[4]);
    const lowPrice = parseNumber(cells[5]);
    const changePercent = parseNumber(cells[6]) ?? (previousClose && closePrice ? Number((((closePrice - previousClose) / previousClose) * 100).toFixed(2)) : 0);
    const volume = parseNumber(cells[10]) ?? parseNumber(cells[9]);

    if (closePrice === null) return;

    rows.push({
      ticker,
      companyName: companyNames[ticker] ?? ticker,
      openPrice,
      previousClose,
      closePrice,
      highPrice,
      lowPrice,
      changePercent,
      volume,
      sourceReference: DSE_URL,
    });
  });

  const uniqueRows = rows.filter((row, index, list) => list.findIndex((candidate) => candidate.ticker === row.ticker) === index);

  if (uniqueRows.length === 0) {
    throw new Error("No market rows were parsed from the official DSE page.");
  }

  return {
    marketDate,
    rows: uniqueRows,
    sourceName: SOURCE_NAME,
    sourceReference: DSE_URL,
  };
}

export async function fetchTopTradedDseSecurities(marketDate: string, limit = 20): Promise<LiveDseRow[]> {
  const params = new URLSearchParams({
    to_date: marketDate,
    isLastTradeTrend: "1",
    security_code: "ALL",
    class: "EQUITY",
  });

  const payload = await fetchJson<{ success: boolean; data: Array<Record<string, unknown>> }>(`${RANGE_URL}?${params}`);
  if (!payload.success) {
    throw new Error("DSE range endpoint did not report success.");
  }

  return payload.data
    .map((row) => {
      const ticker = normalizeTicker(String(row.company ?? ""));
      const previousClose = parseMaybeNumber(row.prev_close);
      const closePrice = parseMaybeNumber(row.closing_price);
      const changePercent = parseMaybeNumber(row.change);
      if (!ticker || closePrice === null) {
        return null;
      }

      return {
        ticker,
        companyName: companyNames[ticker] ?? ticker,
        openPrice: parseMaybeNumber(row.opening_price),
        previousClose,
        closePrice,
        highPrice: parseMaybeNumber(row.high),
        lowPrice: parseMaybeNumber(row.low),
        changePercent: changePercent === null ? (previousClose && closePrice ? Number((((closePrice - previousClose) / previousClose) * 100).toFixed(2)) : 0) : Number(changePercent.toFixed(2)),
        volume: parseMaybeNumber(row.volume),
        sourceReference: `${RANGE_URL}?${params}`,
      } satisfies LiveDseRow;
    })
    .filter((row): row is LiveDseRow => Boolean(row))
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, limit);
}

export async function fetchDseHistoryForSecurity(ticker: string, days = 90): Promise<DseHistoricalRow[]> {
  const normalizedTicker = normalizeTicker(ticker);
  const params = new URLSearchParams({
    security_code: normalizedTicker,
    days: String(days),
    class: "EQUITY",
  });

  const payload = await fetchJson<{ success: boolean; data: Array<Record<string, unknown>> }>(`${DURATION_URL}?${params}`);
  if (!payload.success) {
    throw new Error(`DSE duration endpoint did not report success for ${normalizedTicker}.`);
  }

  return payload.data
    .map((row) => {
      const closePrice = parseMaybeNumber(row.closing_price);
      if (closePrice === null) {
        return null;
      }

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
      } satisfies DseHistoricalRow;
    })
    .filter((row): row is DseHistoricalRow => Boolean(row))
    .sort((a, b) => a.marketDate.localeCompare(b.marketDate));
}
