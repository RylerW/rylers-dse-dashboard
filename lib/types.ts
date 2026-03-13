export type ListingType = "LOCAL" | "CROSS_LISTED" | "ETF";
export type Trend = "UP" | "DOWN" | "FLAT";
export type AlertType = "PRICE_ABOVE" | "PRICE_BELOW" | "PERCENT_RISE" | "PERCENT_DROP";
export type DeliveryChannel = "IN_APP" | "EMAIL";
export type RunStatus = "SUCCESS" | "PARTIAL" | "FAILED";

export interface Security {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  listingType: ListingType;
  listingDate: string;
  isActive: boolean;
}

export interface PriceSnapshot {
  id: string;
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
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
}

export interface WatchlistItem {
  id: string;
  watchlistId: string;
  securityId: string;
}

export interface Alert {
  id: string;
  userId: string;
  securityId: string;
  type: AlertType;
  thresholdValue: number;
  channel: DeliveryChannel;
  isActive: boolean;
  lastTriggeredAt: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  alertId: string | null;
  securityId: string | null;
  title: string;
  body: string;
  channel: DeliveryChannel;
  status: "SENT" | "PENDING";
  createdAt: string;
  sentAt: string | null;
}

export interface IngestionRun {
  id: string;
  sourceName: string;
  marketDate: string;
  status: RunStatus;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  startedAt: string;
  completedAt: string | null;
  errorSummary: string | null;
}

export interface Database {
  securities: Security[];
  snapshots: PriceSnapshot[];
  watchlists: Watchlist[];
  watchlistItems: WatchlistItem[];
  alerts: Alert[];
  notifications: Notification[];
  ingestionRuns: IngestionRun[];
}

export interface SecurityWithSnapshot extends Security {
  latestSnapshot: PriceSnapshot | null;
  trend: Trend;
  history: PriceSnapshot[];
}

export interface MarketOverview {
  marketDate: string;
  lastUpdated: string;
  sourceName: string;
  trackedSecurities: number;
  topGainers: SecurityWithSnapshot[];
  topLosers: SecurityWithSnapshot[];
  mostActive: SecurityWithSnapshot[];
  freshness: "FRESH" | "STALE";
}

