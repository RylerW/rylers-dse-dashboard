export const dynamic = "force-dynamic";

import { addToWatchlistAction, removeFromWatchlistAction } from "@/app/actions";
import { HistoryChart } from "@/components/history-chart";
import { WatchlistTable } from "@/components/watchlist-table";
import { formatCompactNumber, formatMoney, formatPercent, trendLabel } from "@/lib/format";
import { getDefaultWatchlist, listSecurities } from "@/lib/store";
import type { SecurityWithSnapshot } from "@/lib/types";

function changeOverPeriod(security: SecurityWithSnapshot, periodsBack: number) {
  const history = security.history;
  if (history.length <= periodsBack) return null;
  const latest = history.at(-1);
  const baseline = history[history.length - (periodsBack + 1)];
  if (!latest || !baseline || baseline.lastPrice === 0) return null;
  return Number((((latest.lastPrice - baseline.lastPrice) / baseline.lastPrice) * 100).toFixed(2));
}

export default async function WatchlistPage() {
  const [watchlist, securities] = await Promise.all([getDefaultWatchlist(), listSecurities()]);
  const watchlistIds = new Set(watchlist.securities.map((item) => item.id));
  const available = securities.filter((item) => !watchlistIds.has(item.id));
  const selected = watchlist.securities[0] ?? null;
  const strongest = [...watchlist.securities].sort((a, b) => (b.latestSnapshot?.percentChange ?? 0) - (a.latestSnapshot?.percentChange ?? 0))[0] ?? null;
  const weakest = [...watchlist.securities].sort((a, b) => (a.latestSnapshot?.percentChange ?? 0) - (b.latestSnapshot?.percentChange ?? 0))[0] ?? null;
  const mostActive = [...watchlist.securities].sort((a, b) => (b.latestSnapshot?.volume ?? 0) - (a.latestSnapshot?.volume ?? 0))[0] ?? null;

  return (
    <div className="page-grid">
      <section className="panel panel-wide">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Watchlist</p>
            <h1>{watchlist.watchlist.name}</h1>
            <p className="muted-copy">Track momentum, compare recent moves, and inspect a focus security without leaving the page.</p>
          </div>
        </div>
        <div className="watchlist-signal-grid">
          <div className="summary-box">
            <span>Strongest Daily Move</span>
            <strong>{strongest?.ticker ?? "-"}</strong>
            <p className="muted-copy">{strongest ? formatPercent(strongest.latestSnapshot?.percentChange ?? null) : "No data yet"}</p>
          </div>
          <div className="summary-box">
            <span>Weakest Daily Move</span>
            <strong>{weakest?.ticker ?? "-"}</strong>
            <p className="muted-copy">{weakest ? formatPercent(weakest.latestSnapshot?.percentChange ?? null) : "No data yet"}</p>
          </div>
          <div className="summary-box">
            <span>Highest Volume</span>
            <strong>{mostActive?.ticker ?? "-"}</strong>
            <p className="muted-copy">{mostActive ? `${formatCompactNumber(mostActive.latestSnapshot?.volume ?? null)} traded` : "No data yet"}</p>
          </div>
          <div className="summary-box">
            <span>Focus Security</span>
            <strong>{selected?.ticker ?? "-"}</strong>
            <p className="muted-copy">{selected ? `${trendLabel(selected.trend)} trend across the recent window` : "Add a security to begin"}</p>
          </div>
        </div>
        <WatchlistTable
          items={watchlist.securities}
          action={(securityId) => (
            <form action={removeFromWatchlistAction}>
              <input type="hidden" name="securityId" value={securityId} />
              <button type="submit" className="ghost-button">Remove</button>
            </form>
          )}
        />
      </section>

      <section className="panel panel-wide watchlist-analysis-layout">
        <section className="analysis-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Selected Security</p>
              <h2>{selected ? `${selected.companyName} (${selected.ticker})` : "No security selected"}</h2>
            </div>
          </div>
          {selected ? (
            <>
              <div className="detail-summary-grid">
                <div className="summary-box">
                  <span>Last Price</span>
                  <strong>{formatMoney(selected.latestSnapshot?.lastPrice ?? null)}</strong>
                </div>
                <div className="summary-box">
                  <span>Daily Move</span>
                  <strong className={(selected.latestSnapshot?.percentChange ?? 0) >= 0 ? "text-green" : "text-red"}>
                    {formatPercent(selected.latestSnapshot?.percentChange ?? null)}
                  </strong>
                </div>
                <div className="summary-box">
                  <span>7D Change</span>
                  <strong className={(changeOverPeriod(selected, 5) ?? 0) >= 0 ? "text-green" : "text-red"}>
                    {formatPercent(changeOverPeriod(selected, 5))}
                  </strong>
                </div>
                <div className="summary-box">
                  <span>30D Change</span>
                  <strong className={(changeOverPeriod(selected, 20) ?? 0) >= 0 ? "text-green" : "text-red"}>
                    {formatPercent(changeOverPeriod(selected, 20))}
                  </strong>
                </div>
              </div>
              <HistoryChart history={selected.history} />
              <div className="watchlist-analysis-table">
                <div className="analysis-row">
                  <span>Sector</span>
                  <strong>{selected.sector}</strong>
                </div>
                <div className="analysis-row">
                  <span>Listing Type</span>
                  <strong>{selected.listingType.replace("_", " ")}</strong>
                </div>
                <div className="analysis-row">
                  <span>Volume</span>
                  <strong>{formatCompactNumber(selected.latestSnapshot?.volume ?? null)}</strong>
                </div>
                <div className="analysis-row">
                  <span>Trend Signal</span>
                  <strong>{trendLabel(selected.trend)}</strong>
                </div>
              </div>
            </>
          ) : (
            <p className="muted-copy">Add securities to your watchlist and the first one will become your default analysis panel.</p>
          )}
        </section>

        <section className="panel watchlist-comparison-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Comparison Table</p>
              <h2>Recent performance snapshot</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>1D</th>
                  <th>7D</th>
                  <th>30D</th>
                  <th>Volume</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.securities.map((security) => (
                  <tr key={`${security.id}-analysis`}>
                    <td>{security.ticker}</td>
                    <td className={(security.latestSnapshot?.percentChange ?? 0) >= 0 ? "text-green" : "text-red"}>
                      {formatPercent(security.latestSnapshot?.percentChange ?? null)}
                    </td>
                    <td className={(changeOverPeriod(security, 5) ?? 0) >= 0 ? "text-green" : "text-red"}>
                      {formatPercent(changeOverPeriod(security, 5))}
                    </td>
                    <td className={(changeOverPeriod(security, 20) ?? 0) >= 0 ? "text-green" : "text-red"}>
                      {formatPercent(changeOverPeriod(security, 20))}
                    </td>
                    <td>{formatCompactNumber(security.latestSnapshot?.volume ?? null)}</td>
                    <td>{trendLabel(security.trend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Add Securities</p>
            <h2>Expand your coverage</h2>
          </div>
        </div>
        <div className="stack-list">
          {available.map((security) => (
            <div key={security.id} className="row-between card-row">
              <div>
                <p className="row-title">{security.ticker}</p>
                <p className="muted-copy">{security.companyName}</p>
              </div>
              <form action={addToWatchlistAction}>
                <input type="hidden" name="securityId" value={security.id} />
                <button type="submit" className="primary-button small-button">Add</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
