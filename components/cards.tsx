import { formatCompactNumber, formatPercent } from "@/lib/format";
import type { SecurityWithSnapshot } from "@/lib/types";

export function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <section className="metric-card">
      <p className="eyebrow">{label}</p>
      <h3>{value}</h3>
      {subtext ? <p className="muted-copy">{subtext}</p> : null}
    </section>
  );
}

export function MoversCard({ title, items, negative = false }: { title: string; items: SecurityWithSnapshot[]; negative?: boolean }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      <div className="stack-list">
        {items.map((item) => (
          <div key={item.id} className="row-between">
            <div>
              <p className="row-title">{item.ticker}</p>
              <p className="muted-copy">{item.companyName}</p>
            </div>
            <div className={negative ? "pill pill-red" : "pill pill-green"}>{formatPercent(item.latestSnapshot?.percentChange ?? 0)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivityCard({ items }: { items: SecurityWithSnapshot[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Most Active</h2>
      </div>
      <div className="stack-list">
        {items.map((item) => (
          <div key={item.id} className="row-between">
            <div>
              <p className="row-title">{item.ticker}</p>
              <p className="muted-copy">{item.companyName}</p>
            </div>
            <strong>{formatCompactNumber(item.latestSnapshot?.volume ?? 0)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

