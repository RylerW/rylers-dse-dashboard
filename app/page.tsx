export const dynamic = "force-dynamic";

import { ActivityCard, MetricCard, MoversCard } from "@/components/cards";
import { WatchlistTable } from "@/components/watchlist-table";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getDefaultWatchlist, getMarketOverview, listAlerts, listNotifications } from "@/lib/store";

export default async function HomePage() {
  const [overview, watchlist, alerts, notifications] = await Promise.all([
    getMarketOverview(),
    getDefaultWatchlist(),
    listAlerts(),
    listNotifications(),
  ]);

  const topGainer = overview.topGainers[0];
  const topLoser = overview.topLosers[0];
  const mostActive = overview.mostActive[0];

  return (
    <div className="page-grid">
      <section className="hero panel panel-wide">
        <div>
          <p className="eyebrow">Market Status</p>
          <h1>Track live price rises and drops across the Tanzania DSE.</h1>
          <p className="hero-copy">
            The dashboard now attempts to sync against the official Dar es Salaam Stock Exchange homepage, normalizes the published market table, and falls back to the last known good dataset if the source is unavailable.
          </p>
        </div>
        <div className="status-strip">
          <div>
            <span>Market Date</span>
            <strong>{overview.marketDate}</strong>
          </div>
          <div>
            <span>Last Updated</span>
            <strong>{formatDateTime(overview.lastUpdated)}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>{overview.sourceName}</strong>
          </div>
          <div>
            <span>Freshness</span>
            <strong>{overview.freshness}</strong>
          </div>
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard label="Tracked Securities" value={`${overview.trackedSecurities}`} subtext="Available in the current live or cached market set." />
        <MetricCard label="Top Gainer" value={`${topGainer?.ticker ?? "-"} ${topGainer ? formatMoney(topGainer.latestSnapshot?.lastPrice ?? null) : ""}`} subtext={topGainer ? `${topGainer.latestSnapshot?.percentChange}% today` : undefined} />
        <MetricCard label="Top Loser" value={`${topLoser?.ticker ?? "-"} ${topLoser ? formatMoney(topLoser.latestSnapshot?.lastPrice ?? null) : ""}`} subtext={topLoser ? `${topLoser.latestSnapshot?.percentChange}% today` : undefined} />
        <MetricCard label="Most Active" value={`${mostActive?.ticker ?? "-"}`} subtext={mostActive ? `${mostActive.latestSnapshot?.volume?.toLocaleString()} shares traded` : undefined} />
      </div>

      <MoversCard title="Top Gainers" items={overview.topGainers} />
      <MoversCard title="Top Losers" items={overview.topLosers} negative />
      <ActivityCard items={overview.mostActive} />

      <section className="panel panel-wide">
        <div className="panel-header">
          <div>
            <p className="eyebrow">My Watchlist</p>
            <h2>{watchlist.watchlist.name}</h2>
          </div>
          <a href="/watchlist" className="button-link">Manage watchlist</a>
        </div>
        <WatchlistTable items={watchlist.securities} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Alert Snapshot</h2>
          <a href="/alerts" className="button-link">Open alerts</a>
        </div>
        <div className="stack-list">
          {alerts.slice(0, 4).map((alert) => (
            <div key={alert.id} className="row-between">
              <div>
                <p className="row-title">{alert.security?.ticker} {alert.type.replaceAll("_", " ")}</p>
                <p className="muted-copy">Threshold {alert.thresholdValue} via {alert.channel}</p>
              </div>
              <span className={alert.isActive ? "pill pill-green" : "pill"}>{alert.isActive ? "Active" : "Paused"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Recent Notifications</h2>
        </div>
        <div className="stack-list">
          {notifications.slice(0, 4).map((notification) => (
            <div key={notification.id}>
              <p className="row-title">{notification.title}</p>
              <p className="muted-copy">{notification.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

