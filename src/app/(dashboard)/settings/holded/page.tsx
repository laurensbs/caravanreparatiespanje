import { getHoldedSyncStatus } from "@/actions/holded-sync";
import { getHoldedStatus } from "@/actions/holded";
import { HoldedSyncClient } from "./holded-sync-client";

export default async function HoldedSettingsPage() {
  const [status, syncStatus] = await Promise.all([
    getHoldedStatus(),
    getHoldedSyncStatus().catch(() => null),
  ]);

  return (
    <HoldedSyncClient
      configured={status.configured}
      syncStatus={syncStatus}
    />
  );
}
