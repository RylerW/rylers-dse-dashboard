import type { ReactNode } from "react";
import Link from "next/link";

import { formatCompactNumber, formatMoney, formatPercent, trendLabel } from "@/lib/format";
import type { SecurityWithSnapshot } from "@/lib/types";

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <span className="muted-copy">No trend</span>;
  }

  const width = 120;
  const height = 36;
  const padding = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const up = values.at(-1)! >= values[0];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`mini-sparkline ${up ? "mini-sparkline-up" : "mini-sparkline-down"}`} role="img" aria-label="Security trend">
      <polyline fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function periodChange(item: SecurityWithSnapshot, periodsBack: number) {
  if (item.history.length <= periodsBack) return null;
  const latest = item.history.at(-1);
  const baseline = item.history[item.history.length - (periodsBack + 1)];
  if (!latest || !baseline || baseline.lastPrice === 0) return null;
  return (((latest.lastPrice - baseline.lastPrice) / baseline.lastPrice) * 100);
}

export function WatchlistTable({ items, action }: { items: SecurityWithSnapshot[]; action?: (securityId: string) => ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Last Price</th>
            <th>Daily Move</th>
            <th>7D</th>
            <th>30D</th>
            <th>Volume</th>
            <th>Trend</th>
            <th>Chart</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td><Link href={`/securities/${item.ticker}`}>{item.ticker}</Link></td>
              <td>{item.companyName}</td>
              <td>{formatMoney(item.latestSnapshot?.lastPrice ?? null)}</td>
              <td className={(item.latestSnapshot?.percentChange ?? 0) >= 0 ? "text-green" : "text-red"}>{formatPercent(item.latestSnapshot?.percentChange ?? null)}</td>
              <td className={(periodChange(item, 5) ?? 0) >= 0 ? "text-green" : "text-red"}>{formatPercent(periodChange(item, 5))}</td>
              <td className={(periodChange(item, 20) ?? 0) >= 0 ? "text-green" : "text-red"}>{formatPercent(periodChange(item, 20))}</td>
              <td>{formatCompactNumber(item.latestSnapshot?.volume ?? null)}</td>
              <td>{trendLabel(item.trend)}</td>
              <td><MiniSparkline values={item.history.map((entry) => entry.lastPrice)} /></td>
              <td>{action ? action(item.id) : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
