"use server";

import { revalidatePath } from "next/cache";

import { addWatchlistSecurity, createAlert, removeWatchlistSecurity, runOfficialIngestion, toggleAlert } from "@/lib/store";
import type { AlertType, DeliveryChannel } from "@/lib/types";

export async function addToWatchlistAction(formData: FormData) {
  const securityId = String(formData.get("securityId") ?? "");
  if (!securityId) return;
  await addWatchlistSecurity(securityId);
  revalidatePath("/");
  revalidatePath("/watchlist");
}

export async function removeFromWatchlistAction(formData: FormData) {
  const securityId = String(formData.get("securityId") ?? "");
  if (!securityId) return;
  await removeWatchlistSecurity(securityId);
  revalidatePath("/");
  revalidatePath("/watchlist");
}

export async function createAlertAction(formData: FormData) {
  const securityId = String(formData.get("securityId") ?? "");
  const type = String(formData.get("type") ?? "PRICE_ABOVE") as AlertType;
  const thresholdValue = Number(formData.get("thresholdValue") ?? 0);
  const channel = String(formData.get("channel") ?? "EMAIL") as DeliveryChannel;

  if (!securityId || Number.isNaN(thresholdValue) || thresholdValue <= 0) return;

  await createAlert({ securityId, type, thresholdValue, channel });
  revalidatePath("/");
  revalidatePath("/alerts");
  revalidatePath("/watchlist");
}

export async function toggleAlertAction(formData: FormData) {
  const alertId = String(formData.get("alertId") ?? "");
  if (!alertId) return;
  await toggleAlert(alertId);
  revalidatePath("/");
  revalidatePath("/alerts");
}

export async function runIngestionAction() {
  await runOfficialIngestion();
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/alerts");
  revalidatePath("/admin");
}
