import { useQuery } from "@tanstack/react-query";
import { listMembers } from "../modules/settings/members.service";
import { useAuthStore } from "../store/authStore";

export const MEMBERS_QUERY_KEY = (storeId: string | null) => [
  "members",
  storeId,
];

export function useMembers() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  return useQuery({
    queryKey: MEMBERS_QUERY_KEY(activeStoreId),
    queryFn: listMembers,
    enabled: !!activeStoreId,
  });
}
