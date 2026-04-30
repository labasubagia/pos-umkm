import { useLiveQuery } from "dexie-react-hooks";
import type { Member } from "../modules/settings/members.service";
import { listMembers } from "../modules/settings/members.service";
import { useAuthStore } from "../store/authStore";

// Kept for backward-compat.
export const MEMBERS_QUERY_KEY = (storeId: string | null) => [
  "members",
  storeId,
];

export function useMembers() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const result = useLiveQuery(
    () => (activeStoreId ? listMembers() : Promise.resolve([] as Member[])),
    [activeStoreId],
  );
  return {
    data: result ?? ([] as Member[]),
    isLoading: result === undefined,
    error: null as Error | null,
  };
}
