export const dynamic = "force-dynamic";

import { createAlertAction, toggleAlertAction } from "@/app/actions";
import { alertTypeLabel, formatDateTime } from "@/lib/format";
import { listAlerts, listSecurities } from "@/lib/store";

export default async function AlertsPage() {
  const [alerts, securities] = await Promise.all([listAlerts(), listSecurities()]);

  return (
    <div className="page-grid two-column-layout">
      <section className="panel panel-wide">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Alerts</p>
            <h1>Threshold monitoring</h1>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Security</th>
                <th>Rule</th>
                <th>Threshold</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Last Triggered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.security?.ticker}</td>
                  <td>{alertTypeLabel(alert.type)}</td>
                  <td>{alert.thresholdValue}</td>
                  <td>{alert.channel}</td>
                  <td>{alert.isActive ? "Active" : "Paused"}</td>
                  <td>{alert.lastTriggeredAt ? formatDateTime(alert.lastTriggeredAt) : "Never"}</td>
                  <td>
                    <form action={toggleAlertAction}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <button type="submit" className="ghost-button">{alert.isActive ? "Pause" : "Resume"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Create Alert</p>
            <h2>New rule</h2>
          </div>
        </div>
        <form action={createAlertAction} className="form-stack">
          <label>
            Security
            <select name="securityId" defaultValue={securities[0]?.id}>
              {securities.map((security) => (
                <option key={security.id} value={security.id}>{security.ticker} - {security.companyName}</option>
              ))}
            </select>
          </label>
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
            <input type="number" name="thresholdValue" min="0.1" step="0.1" defaultValue="700" />
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


