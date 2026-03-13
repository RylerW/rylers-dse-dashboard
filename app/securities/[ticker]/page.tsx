export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { addToWatchlistAction, createAlertAction } from "@/app/actions";
import { HistoryChart } from "@/components/history-chart";
import { formatMoney, formatPercent } from "@/lib/format";
import { getSecurityByTicker } from "@/lib/store";

export default async function SecurityDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const security = await getSecurityByTicker(ticker);
  if (!security) notFound();

  const latest = security.latestSnapshot;
  const current = latest?.lastPrice ?? null;
  const byRange = (points: number) => {
    const history = security.history;
    if (history.length <= points) return null;
    const start = history[history.length - (points + 1)];
    if (!start || !latest || start.lastPrice === 0) return null;
    return Number((((latest.lastPrice - start.lastPrice) / start.lastPrice) * 100).toFixed(2));
  };

  return (
    <div className="page-grid two-column-layout">
      <section className="panel panel-wide">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Security Detail</p>
            <h1>{security.companyName} ({security.ticker})</h1>
            <p className="muted-copy">{security.sector} | {security.listingType.replace("_", " ")}</p>
          </div>
          <div className="actions-inline">
            <form action={addToWatchlistAction}>
              <input type="hidden" name="securityId" value={security.id} />
              <button type="submit" className="ghost-button">Add to watchlist</button>
            </form>
            <Link href="/watchlist" className="button-link">Open watchlist</Link>
          </div>
        </div>

        <div className="detail-summary-grid">
          <div className="summary-box">
            <span>Last Price</span>
            <strong>{formatMoney(current)}</strong>
          </div>
          <div className="summary-box">
            <span>Daily Change</span>
            <strong className={(latest?.percentChange ?? 0) >= 0 ? "text-green" : "text-red"}>{formatPercent(latest?.percentChange ?? null)}</strong>
          </div>
          <div className="summary-box">
            <span>Volume</span>
            <strong>{latest?.volume?.toLocaleString() ?? "-"}</strong>
          </div>
          <div className="summary-box">
            <span>Listing Date</span>
            <strong>{security.listingDate}</strong>
          </div>
        </div>

        <HistoryChart history={security.history} />

        <div className="range-grid">
          <div className="summary-box"><span>1D</span><strong>{formatPercent(latest?.percentChange ?? null)}</strong></div>
          <div className="summary-box"><span>7D</span><strong>{formatPercent(byRange(5))}</strong></div>
          <div className="summary-box"><span>30D</span><strong>{formatPercent(byRange(20))}</strong></div>
          <div className="summary-box"><span>90D</span><strong>{formatPercent(byRange(60))}</strong></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Create Alert</p>
            <h2>{security.ticker} threshold</h2>
          </div>
        </div>
        <form action={createAlertAction} className="form-stack">
          <input type="hidden" name="securityId" value={security.id} />
          <label>
            Rule Type
            <select name="type" defaultValue="PRICE_ABOVE">
              <option value="PRICE_ABOVE">Price Above</option>
              <option value="PRICE_BELOW">Price Below</option>
              <option value="PERCENT_RISE">Daily Percent Rise</option>
              <option value="PERCENT_DROP">Daily Percent Drop</option>
            </select>
          </label>
          <label>
            Threshold
            <input type="number" name="thresholdValue" min="0.1" step="0.1" defaultValue={Math.round((latest?.lastPrice ?? 1) * 1.05)} />
          </label>
          <label>
            Channel
            <select name="channel" defaultValue="EMAIL">
              <option value="EMAIL">Email</option>
              <option value="IN_APP">In-app</option>
            </select>
          </label>
          <button type="submit" className="primary-button">Save Alert</button>
        </form>
      </section>
    </div>
  );
}
