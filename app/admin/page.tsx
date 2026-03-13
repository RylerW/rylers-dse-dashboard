export const dynamic = "force-dynamic";

import { runIngestionAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { listIngestionRuns } from "@/lib/store";

export default async function AdminPage() {
  const runs = await listIngestionRuns();
  const latest = runs[0];

  return (
    <div className="page-grid">
      <section className="panel panel-wide">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Data health and ingestion</h1>
          </div>
          <form action={runIngestionAction}>
            <button type="submit" className="primary-button">Run official DSE sync</button>
          </form>
        </div>
        <div className="status-strip compact-strip">
          <div>
            <span>Latest Market Date</span>
            <strong>{latest?.marketDate}</strong>
          </div>
          <div>
            <span>Latest Run</span>
            <strong>{latest?.status}</strong>
          </div>
          <div>
            <span>Started</span>
            <strong>{latest ? formatDateTime(latest.startedAt) : "-"}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>{latest?.completedAt ? formatDateTime(latest.completedAt) : "-"}</strong>
          </div>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-header">
          <h2>Run History</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Market Date</th>
                <th>Status</th>
                <th>Seen</th>
                <th>Inserted</th>
                <th>Updated</th>
                <th>Failed</th>
                <th>Error Summary</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>{run.marketDate}</td>
                  <td>{run.status}</td>
                  <td>{run.recordsSeen}</td>
                  <td>{run.recordsInserted}</td>
                  <td>{run.recordsUpdated}</td>
                  <td>{run.recordsFailed}</td>
                  <td>{run.errorSummary ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

