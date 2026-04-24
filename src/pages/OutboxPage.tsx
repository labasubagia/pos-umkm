import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { syncManager } from "../lib/adapters";
import type { OutboxEntry } from "../lib/adapters/dexie/db";
import { getDb } from "../lib/adapters/dexie/db";

import { formatDate } from "../lib/formatDate";
import { useAuthStore } from "../store/authStore";
import { useSyncStore } from "../store/syncStore";

export default function OutboxPage() {
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const activeStoreId = useAuthStore((s) => s.activeStoreId) ?? "__init__";
  const db = getDb(activeStoreId);
  // subscriptions below will react to changes in sync store

  const fetchOutbox = useCallback(async () => {
    // Log DB info so we can compare with SyncManager's DB when debugging
    console.info("[OutboxPage] activeStoreId and DB name", {
      activeStoreId,
      dbName: db.name ?? "unknown",
    });
    setLoading(true);
    const items = await db._outbox.orderBy("id").reverse().toArray();
    setOutbox(items);
    setLoading(false);
  }, [db, activeStoreId]);

  useEffect(() => {
    // Re-fetch outbox on mount
    fetchOutbox();

    // Subscribe to sync store changes so the Outbox refreshes when
    // `pendingCount` or `lastSyncedAt` updates. This avoids putting
    // those values into the effect dependency array and triggering
    // unnecessary re-runs.
    const unsubPending = useSyncStore.subscribe(
      (s) => s.pendingCount,
      () => {
        fetchOutbox();
      },
    );
    const unsubLast = useSyncStore.subscribe(
      (s) => s.lastSyncedAt,
      () => {
        fetchOutbox();
      },
    );

    return () => {
      unsubPending();
      unsubLast();
    };
  }, [fetchOutbox]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold">Outbox Sync</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              console.log("[OutboxPage] Sync Now clicked");
              syncManager.triggerSync();
              fetchOutbox();
            }}
            size="sm"
          >
            Sync Now
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              console.log("[OutboxPage] Retry All Failed clicked");
              await syncManager.resetFailedEntries();
              fetchOutbox();
            }}
            size="sm"
          >
            Retry All Failed
          </Button>
        </div>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : outbox.length === 0 ? (
        <div className="text-muted-foreground">No outbox items.</div>
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-muted">
              <th className="p-2">ID</th>
              <th className="p-2">Sheet</th>
              <th className="p-2">Operation</th>
              <th className="p-2">Status</th>
              <th className="p-2">Retries</th>
              <th className="p-2">Created</th>
              <th className="p-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {outbox.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-2">{item.id}</td>
                <td className="p-2">{item.sheetName}</td>
                <td className="p-2">{item.operation.op}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">{item.retries}</td>
                <td className="p-2">{formatDate(item.createdAt)}</td>
                <td className="p-2 text-red-600">{item.errorMessage ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
