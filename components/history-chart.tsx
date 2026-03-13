import { formatMoney } from "@/lib/format";
import type { PriceSnapshot } from "@/lib/types";

export function HistoryChart({ history }: { history: PriceSnapshot[] }) {
  if (history.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-empty muted-copy">Not enough history yet to render a chart.</div>
      </div>
    );
  }

  const width = 640;
  const height = 240;
  const padding = 24;
  const values = history.map((item) => item.lastPrice);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = history.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(history.length - 1, 1);
    const y = height - padding - ((item.lastPrice - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="chart-card">
      <svg viewBox={`0 0 ${width} ${height}`} className="history-chart" role="img" aria-label="Historical price chart">
        <rect x="0" y="0" width={width} height={height} rx="20" className="chart-bg" />
        <polyline fill="none" stroke="currentColor" strokeWidth="4" points={points} />
        {history.map((item, index) => {
          const x = padding + (index * (width - padding * 2)) / Math.max(history.length - 1, 1);
          const y = height - padding - ((item.lastPrice - min) / range) * (height - padding * 2);
          return <circle key={item.id} cx={x} cy={y} r="4" className="chart-dot" />;
        })}
      </svg>
      <div className="chart-labels">
        <span>{history[0]?.marketDate}</span>
        <strong>{formatMoney(max)}</strong>
        <span>{history.at(-1)?.marketDate}</span>
      </div>
    </div>
  );
}
