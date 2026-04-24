import { useEffect, useState } from "react";
import { getDb } from "../lib/adapters/dexie/db";
import { useAuthStore } from "../store/authStore";
import type { OutboxEntry } from "../lib/adapters/dexie/db";
import { Button } from "../components/ui/button";

import { formatDate } from "../lib/formatDate";
import { syncManager } from "../lib/adapters";

export default function OutboxPage() {
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const activeStoreId = useAuthStore((s) => s.activeStoreId) ?? "__init__";
  const db = getDb(activeStoreId);

  const fetchOutbox = async () => {
    setLoading(true);
    const items = await db._outbox.orderBy("id").reverse().toArray();
    setOutbox(items);
    setLoading(false);
  };

  useEffect(() => {
    fetchOutbox();
    // Optionally, subscribe to sync events to refresh
  }, [activeStoreId]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold">Outbox Sync</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => {
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
