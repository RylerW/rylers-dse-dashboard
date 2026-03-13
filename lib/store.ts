import { hasDatabaseUrl } from "@/lib/postgres";
import * as localStore from "@/lib/local-store";
import * as postgresStore from "@/lib/postgres-store";
import type { Alert } from "@/lib/types";

const activeStore = () => (hasDatabaseUrl() ? postgresStore : localStore);

export async function getMarketOverview() {
  return activeStore().getMarketOverview();
}

export async function listSecurities() {
  return activeStore().listSecurities();
}

export async function getSecurityByTicker(ticker: string) {
  return activeStore().getSecurityByTicker(ticker);
}

export async function getDefaultWatchlist() {
  return activeStore().getDefaultWatchlist();
}

export async function addWatchlistSecurity(securityId: string) {
  return activeStore().addWatchlistSecurity(securityId);
}

export async function removeWatchlistSecurity(securityId: string) {
  return activeStore().removeWatchlistSecurity(securityId);
}

export async function listAlerts() {
  return activeStore().listAlerts();
}

export async function createAlert(input: { securityId: string; type: Alert["type"]; thresholdValue: number; channel: Alert["channel"] }) {
  return activeStore().createAlert(input);
}

export async function toggleAlert(alertId: string) {
  return activeStore().toggleAlert(alertId);
}

export async function listNotifications() {
  return activeStore().listNotifications();
}

export async function listIngestionRuns() {
  return activeStore().listIngestionRuns();
}

export async function runOfficialIngestion(recordFailure?: boolean) {
  return activeStore().runOfficialIngestion(recordFailure);
}
