import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { syncManager } from "../lib/adapters";
import type { OutboxEntry } from "../lib/adapters/dexie/db";
import { getDb } from "../lib/adapters/dexie/db";

import { formatDateTimeTZ } from "../lib/formatters";
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
    const unsubPending = useSyncStore.subscribe(() => {
      fetchOutbox();
    });
    const unsubLast = useSyncStore.subscribe(() => {
      fetchOutbox();
    });

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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">ID</TableHead>
                <TableHead>Sheet</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Retries</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outbox.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="hidden sm:table-cell">
                    {item.id}
                  </TableCell>
                  <TableCell>{item.sheetName}</TableCell>
                  <TableCell>{item.operation.op}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {item.retries}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTimeTZ(item.createdAt)}
                  </TableCell>
                  <TableCell
                    className="max-w-40 truncate text-red-600"
                    title={item.errorMessage ?? ""}
                  >
                    {item.errorMessage ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
